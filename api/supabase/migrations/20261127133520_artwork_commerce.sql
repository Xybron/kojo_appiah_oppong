-- Server-only commerce ledger. Apply to Kojo's Supabase project after review.
-- No policies grant public table access; only the Worker service-role key may call
-- these SECURITY INVOKER functions. No customer data is exposed via public reads.
create table public.commerce_inventory (
  artwork_id text primary key,
  kind text not null check (kind in ('Original', 'Print')),
  available boolean not null default true
);
create table public.commerce_orders (
  reference text primary key,
  idempotency_key uuid not null unique,
  request_hash text not null check (length(request_hash) = 64),
  artwork_id text not null references public.commerce_inventory(artwork_id),
  artwork_title text not null,
  kind text not null check (kind in ('Original', 'Print')),
  variant_id text not null,
  frame_id text not null,
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 9007199254740991),
  currency text not null check (currency = 'GHS'),
  status text not null default 'creating' check (status in ('creating', 'pending', 'paid', 'expired', 'review')),
  customer jsonb not null,
  checkout_id text unique,
  checkout_url text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);
create unique index commerce_one_original_order
  on public.commerce_orders(artwork_id)
  where kind = 'Original' and status in ('creating', 'pending', 'paid');
create index commerce_orders_recent on public.commerce_orders(created_at desc);
create table public.commerce_payment_events (
  event_id text primary key,
  reference text not null references public.commerce_orders(reference),
  checkout_id text not null,
  verified_state text not null check (verified_state in ('paid', 'expired', 'review')),
  processed_at timestamptz not null default now()
);
alter table public.commerce_inventory enable row level security;
alter table public.commerce_orders enable row level security;
alter table public.commerce_payment_events enable row level security;
revoke all on public.commerce_inventory, public.commerce_orders, public.commerce_payment_events from public, anon, authenticated;
grant select, insert, update on public.commerce_inventory, public.commerce_orders, public.commerce_payment_events to service_role;

insert into public.commerce_inventory(artwork_id, kind) values
 ('earth-held-still','Print'), ('terra-in-balance','Original'),
 ('between-light-and-form','Print'), ('where-the-tide-rests','Print'),
 ('study-in-red','Print'), ('a-door-to-blue','Print'),
 ('objects-of-attention','Print'), ('the-shape-of-silence','Print');

create function public.commerce_begin_checkout(
 p_reference text, p_idempotency_key uuid, p_request_hash text,
 p_artwork_id text, p_artwork_title text, p_kind text, p_variant_id text,
 p_frame_id text, p_amount_minor bigint, p_currency text, p_customer jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_order public.commerce_orders; v_inventory public.commerce_inventory;
begin
 -- Concurrent retries for one request serialize before the existence check.
 perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
 select * into v_order from public.commerce_orders where idempotency_key = p_idempotency_key;
 if found then
   if v_order.request_hash <> p_request_hash then raise exception 'checkout_details_changed' using errcode = 'P0001'; end if;
   return to_jsonb(v_order);
 end if;
 select * into v_inventory from public.commerce_inventory where artwork_id = p_artwork_id for update;
 if not found or not v_inventory.available or v_inventory.kind <> p_kind then
   raise exception 'artwork_unavailable' using errcode = 'P0001';
 end if;
 if p_kind = 'Original' and exists (select 1 from public.commerce_orders where artwork_id = p_artwork_id and status in ('creating','pending','paid','review')) then
   raise exception 'original_reserved' using errcode = 'P0001';
 end if;
 insert into public.commerce_orders(reference,idempotency_key,request_hash,artwork_id,artwork_title,kind,variant_id,frame_id,amount_minor,currency,customer)
 values(p_reference,p_idempotency_key,p_request_hash,p_artwork_id,p_artwork_title,p_kind,p_variant_id,p_frame_id,p_amount_minor,p_currency,p_customer)
 returning * into v_order;
 return to_jsonb(v_order);
end;
$$;

create function public.commerce_attach_checkout(p_reference text, p_checkout_id text, p_checkout_url text, p_expires_at timestamptz)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_order public.commerce_orders;
begin
 select * into strict v_order from public.commerce_orders where reference = p_reference for update;
 if v_order.checkout_id is not null and v_order.checkout_id <> p_checkout_id then
   raise exception 'checkout_reference_changed' using errcode = 'P0001';
 end if;
 update public.commerce_orders set checkout_id = p_checkout_id, checkout_url = p_checkout_url,
   expires_at = p_expires_at, status = case when status = 'creating' then 'pending' else status end, updated_at = now()
 where reference = p_reference returning * into v_order;
 return to_jsonb(v_order);
end;
$$;

create function public.commerce_settle_checkout(p_reference text, p_event_id text, p_checkout_id text, p_state text, p_amount_minor bigint, p_currency text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_order public.commerce_orders; v_inventory public.commerce_inventory; v_state text;
begin
 select * into strict v_order from public.commerce_orders where reference = p_reference for update;
 if exists(select 1 from public.commerce_payment_events where event_id = p_event_id) then return to_jsonb(v_order); end if;
 if p_state not in ('paid','expired','review') then raise exception 'invalid_state'; end if;
 v_state := p_state;
 if v_order.checkout_id is not null and v_order.checkout_id <> p_checkout_id then v_state := 'review'; end if;
 if v_state = 'paid' and (p_amount_minor is distinct from v_order.amount_minor or p_currency is distinct from v_order.currency) then v_state := 'review'; end if;
 -- Paid and review are terminal here: redirects, retries, and older expiry events
 -- cannot undo payment or approve a record already requiring human review.
 if v_order.status not in ('paid','review') then
   if v_order.kind = 'Original' and v_state in ('paid','review') then
     select * into strict v_inventory from public.commerce_inventory where artwork_id = v_order.artwork_id for update;
     if not v_inventory.available or exists(select 1 from public.commerce_orders where artwork_id = v_order.artwork_id and reference <> p_reference and status in ('creating','pending','paid','review')) then
       v_state := 'review';
     end if;
     update public.commerce_inventory set available = false where artwork_id = v_order.artwork_id;
   end if;
   update public.commerce_orders set status = v_state, checkout_id = coalesce(checkout_id,p_checkout_id),
     paid_at = case when v_state = 'paid' then now() else paid_at end, updated_at = now()
   where reference = p_reference returning * into v_order;
 end if;
 insert into public.commerce_payment_events(event_id,reference,checkout_id,verified_state)
 values(p_event_id,p_reference,p_checkout_id,v_state);
 return to_jsonb(v_order);
end;
$$;
revoke all on function public.commerce_begin_checkout(text,uuid,text,text,text,text,text,text,bigint,text,jsonb) from public, anon, authenticated;
revoke all on function public.commerce_attach_checkout(text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.commerce_settle_checkout(text,text,text,text,bigint,text) from public, anon, authenticated;
grant execute on function public.commerce_begin_checkout(text,uuid,text,text,text,text,text,text,bigint,text,jsonb) to service_role;
grant execute on function public.commerce_attach_checkout(text,text,text,timestamptz) to service_role;
grant execute on function public.commerce_settle_checkout(text,text,text,text,bigint,text) to service_role;
