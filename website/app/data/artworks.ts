import { studies, type Study } from './exhibition';

export interface ArtworkVariant { id: string; label: string; widthCm: number; heightCm: number; price: number }
export interface ArtworkFrame { id: string; label: string; borderCm: number; depthCm: number; price: number }
export interface Artwork extends Study {
  kind: 'Original' | 'Print'; medium: string; year: number;
  purchaseMode: 'purchase' | 'enquiry'; status: 'available' | 'sold'; currency: string;
  variants: ArtworkVariant[]; framing: ArtworkFrame[]; story: string[]; edition: string; delivery: string;
}
// Local editorial/product fixtures, expressly authorized for this build. Replace
// prices, dimensions, editions, and imagery with verified studio records before
// enabling live payments. They are not sent to a payment provider in demo mode.
const printFrames: ArtworkFrame[] = [
  { id: 'unframed', label: 'Unframed', borderCm: 0, depthCm: 0, price: 0 },
  { id: 'oak', label: 'Natural oak', borderCm: 3, depthCm: 3, price: 450 },
  { id: 'black', label: 'Black ash', borderCm: 3, depthCm: 3, price: 450 },
];
const sizes = (width: number, height: number, price: number): ArtworkVariant[] => [
  { id: 'small', label: 'Intimate', widthCm: width, heightCm: height, price },
  { id: 'large', label: 'Statement', widthCm: width * 1.5, heightCm: height * 1.5, price: Math.round(price * 1.8) },
];
const asPrint = (study: Study, price: number, width: number, height: number): Artwork => ({
  ...study, kind: 'Print', medium: 'Pigment print on cotton paper', year: 2026,
  purchaseMode: 'purchase', status: 'available', currency: 'GHS',
  variants: sizes(width, height, price), framing: printFrames,
  story: [study.description, 'Give the image room to breathe. Explore the complete composition, look closely at its details, and find the scale that feels right for your space.'],
  edition: 'Fine-art photographic print', delivery: 'Studio collection. Delivery can be arranged by enquiry.',
});
const newStudy = (s: Study) => s;
export const artworks: Artwork[] = [
  asPrint(studies[2]!, 1800, 60, 40),
  { ...asPrint(newStudy({ id:'terra-in-balance', title:'Terra, in balance', discipline:'Fine art', image:'terra', alt:'A terracotta arc crosses a charcoal form on textured ivory canvas.', description:'Earth pigments and an unhurried curve. A tactile conversation between weight, space, and the marks a hand leaves behind.', width:1122, height:1402 }), 7800, 80, 100), kind:'Original', medium:'Mineral pigment and plaster on canvas', edition:'Unique work', purchaseMode:'enquiry', variants:[{id:'original',label:'Original',widthCm:80,heightCm:100,price:7800}], framing:[{id:'studio',label:'Canvas, unframed',borderCm:0,depthCm:4,price:0}] },
  asPrint(studies[1]!, 1600, 40, 50),
  asPrint(newStudy({id:'where-the-tide-rests',title:'Where the tide rests',discipline:'Fine art',image:'tide',alt:'An empty wooden canoe rests on wet sand beside a pale dawn sea.',description:'A boat at rest. A horizon almost lost in the morning air. The space between journeys has a rhythm of its own.',width:1536,height:1024}),1500,60,40),
  asPrint(studies[0]!, 2200, 60, 40),
  asPrint(newStudy({id:'a-door-to-blue',title:'A door to blue',discipline:'Architecture',image:'blue-hour',alt:'A cobalt staircase curves toward a tall opening filled with warm light.',description:'Blue holds the shadow; a narrow opening holds the light. A study of the unexpected warmth inside a cool, quiet space.',width:1086,height:1448}),1700,45,60),
  { ...asPrint(studies[3]!,1900,50,50), purchaseMode:'enquiry' },
  asPrint(newStudy({id:'the-shape-of-silence',title:'The shape of silence',discipline:'Fashion',image:'silence',alt:'A woman in sculptural ivory pleated fabric turns toward warm light against an olive background.',description:'The smallest turn of a shoulder. Cloth becomes a landscape, and a gesture becomes its own quiet language.',width:1086,height:1448}),2100,45,60),
];
export const getArtwork = (id: string) => artworks.find((artwork) => artwork.id === id);
export const formatPrice = (value: number, currency = 'GHS') => new Intl.NumberFormat('en-GH', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
