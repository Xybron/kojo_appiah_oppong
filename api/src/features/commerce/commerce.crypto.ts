const encoder = new TextEncoder();
export async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function sha256(message: string) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(message));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
export const orderToken = (secret: string, reference: string) =>
  hmacHex(secret, `kojo-order-v1:${reference}`);
export async function verifyBachsSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
  now = Date.now(),
) {
  const v2 = headers.get('X-Bachs-Signature-V2');
  let timestamp: string | null = headers.get('X-Bachs-Timestamp');
  let signatures = [headers.get('X-Bachs-Signature') || ''];
  if (v2) {
    const parts = v2.split(',').map((part) => part.trim().split('='));
    const times = parts.filter(([key]) => key === 't');
    if (times.length !== 1) return false;
    timestamp = times[0][1];
    signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  }
  if (
    !timestamp ||
    !/^\d{10,11}$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300 ||
    !secret
  )
    return false;
  const expected = await hmacHex(secret, `${timestamp}.${rawBody}`);
  return signatures.some(
    (signature) =>
      /^[a-f\d]{64}$/i.test(signature) && constantTimeEqual(expected, signature.toLowerCase()),
  );
}
