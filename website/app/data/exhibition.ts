export type Discipline =
  | "Fine art"
  | "Architecture"
  | "Fashion"
  | "Advertising";

export interface Study {
  id: string;
  title: string;
  discipline: Discipline;
  image: string;
  alt: string;
  description: string;
  width: number;
  height: number;
  position?: string;
}

// Isolated presentation data. Replace through the separate Hono API later.
// These are fictional studies illustrated with generated demo images.
export const studies: Study[] = [
  {
    id: "study-in-red",
    title: "Study in red",
    discipline: "Fashion",
    image: "hero",
    alt: "A woman with closed eyes, framed by sculptural folds of red silk.",
    description:
      "A study of presence, fabric, and the quiet strength of a gesture. Rich red folds become a frame for a moment of stillness.",
    width: 1536,
    height: 1024,
    position: "62% 50%",
  },
  {
    id: "between-light-and-form",
    title: "Between light & form",
    discipline: "Architecture",
    image: "architecture",
    alt: "A curved concrete staircase and circular opening in strong sunlight.",
    description:
      "Light traces the edge of a curve. Architecture becomes a conversation between material, shadow, and the space in between.",
    width: 1122,
    height: 1402,
    position: "50% 50%",
  },
  {
    id: "earth-held-still",
    title: "Earth, held still",
    discipline: "Fine art",
    image: "fine-art",
    alt: "A close view of rust-coloured sand dunes, with a fine ridge dividing sunlight and deep shadow.",
    description:
      "A landscape seen closely enough to become something else. Lines, texture, and the slow passage of light across the earth.",
    width: 1536,
    height: 1024,
  },
  {
    id: "objects-of-attention",
    title: "Objects of attention",
    discipline: "Advertising",
    image: "still-life",
    alt: "A cobalt glass sphere on an ivory plinth beside a curved sheet of brushed metal.",
    description:
      "An everyday material, given a little more attention. Glass, stone, and metal held together by a single, deliberate light.",
    width: 1254,
    height: 1254,
  },
];

export const disciplines = [
  "All work",
  "Fine art",
  "Architecture",
  "Fashion",
  "Advertising",
] as const;
export type WorkFilter = (typeof disciplines)[number];
