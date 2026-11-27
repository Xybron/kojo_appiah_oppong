-- Run only in an isolated local database after applying the commerce migration.
-- The test rolls back all fixtures. Production Supabase roles must exist.
begin;

do $$
declare v_role text; v_table text; v_function text;
begin
  foreach v_role in array array['anon','authenticated'] loop
    foreach v_table in array array['commerce_inventory','commerce_orders','commerce_payment_events'] loop
      if has_table_privilege(v_role, 'public.' || v_table, 'SELECT, INSERT, UPDATE, DELETE') then
        raise exception '% has access to %', v_role, v_table;
      end if;
      if not (select relrowsecurity from pg_class where oid = ('public.' || v_table)::regclass) then
        raise exception 'RLS is disabled for %', v_table;
      end if;
    end loop;
    foreach v_function in array array[
      'public.commerce_begin_checkout(text,uuid,text,text,text,text,text,text,bigint,text,jsonb)',
      'public.commerce_attach_checkout(text,text,text,timestamptz)',
      'public.commerce_settle_checkout(text,text,text,text,bigint,text)'
    ] loop
      if has_function_privilege(v_role, v_function, 'EXECUTE') then
        raise exception '% can execute %', v_role, v_function;
      end if;
    end loop;
  end loop;
end;
$$;

set local role service_role;

do $$
declare v_order jsonb; v_retry jsonb; v_conflict boolean;
begin
  insert into public.commerce_inventory(artwork_id,kind) values
    ('integration-original','Original'), ('integration-print','Print');

  v_order := public.commerce_begin_checkout(
    'integration-first','11111111-1111-4111-8111-111111111111',repeat('a',64),
    'integration-original','Integration original','Original','original','studio',780000,'GHS','{}');
  v_retry := public.commerce_begin_checkout(
    'integration-retry','11111111-1111-4111-8111-111111111111',repeat('a',64),
    'integration-original','Integration original','Original','original','studio',780000,'GHS','{}');
  if v_order <> v_retry then raise exception 'Idempotency did not return the same order'; end if;

  v_conflict := false;
  begin
    perform public.commerce_begin_checkout(
      'integration-changed','11111111-1111-4111-8111-111111111111',repeat('b',64),
      'integration-original','Integration original','Original','original','studio',780000,'GHS','{}');
  exception when sqlstate 'P0001' then v_conflict := true;
  end;
  if not v_conflict then raise exception 'Changed idempotent request was accepted'; end if;

  v_conflict := false;
  begin
    perform public.commerce_begin_checkout(
      'integration-second','22222222-2222-4222-8222-222222222222',repeat('c',64),
      'integration-original','Integration original','Original','original','studio',780000,'GHS','{}');
  exception when sqlstate 'P0001' then v_conflict := true;
  end;
  if not v_conflict then raise exception 'Original was reserved twice'; end if;

  perform public.commerce_attach_checkout('integration-first','checkout-first','https://checkout.bachs.io/c/test-first',now()+interval '30 minutes');
  perform public.commerce_settle_checkout('integration-first','event-expired','checkout-first','expired',780000,'GHS');
  perform public.commerce_begin_checkout(
    'integration-second','22222222-2222-4222-8222-222222222222',repeat('c',64),
    'integration-original','Integration original','Original','original','studio',780000,'GHS','{}');

  v_order := public.commerce_settle_checkout('integration-first','event-late-payment','checkout-first','paid',780000,'GHS');
  if v_order->>'status' <> 'review' then raise exception 'Late conflicting payment was fulfilled'; end if;
  if (select available from public.commerce_inventory where artwork_id = 'integration-original') then
    raise exception 'Conflicted original stayed available';
  end if;

  perform public.commerce_begin_checkout(
    'integration-print-paid','33333333-3333-4333-8333-333333333333',repeat('d',64),
    'integration-print','Integration print','Print','small','unframed',180000,'GHS','{}');
  perform public.commerce_attach_checkout('integration-print-paid','checkout-print-paid','https://checkout.bachs.io/c/test-print',now()+interval '30 minutes');
  v_order := public.commerce_settle_checkout('integration-print-paid','event-print-paid','checkout-print-paid','paid',180000,'GHS');
  if v_order->>'status' <> 'paid' then raise exception 'Verified payment was not settled'; end if;
  v_retry := public.commerce_settle_checkout('integration-print-paid','event-print-paid','checkout-print-paid','paid',180000,'GHS');
  if v_order <> v_retry then raise exception 'Duplicate settlement changed the order'; end if;
  v_retry := public.commerce_settle_checkout('integration-print-paid','event-print-old-expiry','checkout-print-paid','expired',180000,'GHS');
  if v_retry->>'status' <> 'paid' then raise exception 'Older expiry undid a payment'; end if;
  if (select count(*) from public.commerce_payment_events where event_id = 'event-print-paid') <> 1 then
    raise exception 'Duplicate payment event was recorded';
  end if;

  perform public.commerce_begin_checkout(
    'integration-print-mismatch','44444444-4444-4444-8444-444444444444',repeat('e',64),
    'integration-print','Integration print','Print','small','unframed',180000,'GHS','{}');
  v_order := public.commerce_settle_checkout('integration-print-mismatch','event-print-mismatch','checkout-print-mismatch','paid',179999,'GHS');
  if v_order->>'status' <> 'review' then raise exception 'Underpayment was fulfilled'; end if;
  v_order := public.commerce_settle_checkout('integration-print-mismatch','event-print-retry','checkout-print-mismatch','paid',180000,'GHS');
  if v_order->>'status' <> 'review' then raise exception 'Review was cleared automatically'; end if;
end;
$$;

rollback;
