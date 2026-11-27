import { HTTPException } from 'hono/http-exception';
import type { CheckoutInput, CheckoutSelection } from './commerce.types';

// Reviewed server-side catalog snapshot matching website/app/data/artworks.ts.
// Prices are integer PESEWAS. Live activation additionally requires CATALOG_VERIFIED.
// Publish verified studio catalog updates to both UI and Worker before enabling sales.
interface CatalogWork {
  id: string; title: string; kind: 'Original' | 'Print'; purchase: boolean;
  variants: Record<string, number>; frames: Record<string, number>;
}
const print = (id: string, title: string, small: number, large: number, purchase = true): CatalogWork => ({
  id, title, kind: 'Print', purchase,
  variants: { small, large }, frames: { unframed: 0, oak: 45000, black: 45000 },
});
export const commerceCatalog: readonly CatalogWork[] = [
  print('earth-held-still', 'Earth, held still', 180000, 324000),
  { id: 'terra-in-balance', title: 'Terra, in balance', kind: 'Original', purchase: false, variants: { original: 780000 }, frames: { studio: 0 } },
  print('between-light-and-form', 'Between light & form', 160000, 288000),
  print('where-the-tide-rests', 'Where the tide rests', 150000, 270000),
  print('study-in-red', 'Study in red', 220000, 396000),
  print('a-door-to-blue', 'A door to blue', 170000, 306000),
  print('objects-of-attention', 'Objects of attention', 190000, 342000, false),
  print('the-shape-of-silence', 'The shape of silence', 210000, 378000),
];
export function resolveCheckoutSelection(input: Pick<CheckoutInput, 'artworkId' | 'variantId' | 'frameId'>): CheckoutSelection {
  const work = commerceCatalog.find((entry) => entry.id === input.artworkId);
  if (!work || !work.purchase) throw new HTTPException(409, { message: 'This artwork is available by enquiry. Please contact the studio.' });
  const variant = Object.hasOwn(work.variants, input.variantId) ? work.variants[input.variantId] : undefined;
  const frame = Object.hasOwn(work.frames, input.frameId) ? work.frames[input.frameId] : undefined;
  if (variant === undefined || frame === undefined) throw new HTTPException(400, { message: 'Choose an available size and frame.' });
  const amountMinor = variant + frame;
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new HTTPException(503, { message: 'This artwork price is unavailable.' });
  return { artworkId: work.id, artworkTitle: work.title, kind: work.kind, variantId: input.variantId, frameId: input.frameId, amountMinor, currency: 'GHS' };
}
export function minorToDecimal(amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Invalid minor-unit amount');
  return `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, '0')}`;
}
export function decimalToMinor(value: unknown): number | null {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(value)) return null;
  const [whole, decimal = ''] = value.split('.');
  const amount = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(amount) ? amount : null;
}
