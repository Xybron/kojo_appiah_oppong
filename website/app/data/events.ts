export interface ExhibitionEvent {
  id: string;
  title: string;
  subtitle: string;
  type: "Exhibition" | "Artist encounter";
  status: "forthcoming" | "upcoming" | "past";
  image: string;
  alt: string;
  width: number;
  height: number;
  position?: string;
  description: string;
  story: string[];
  artworkIds: string[];
  startsAt?: string;
  endsAt?: string;
  timeZone: string;
  venue?: string;
  address?: string;
  admission?: string;
  accessNote?: string;
}

// User-authorized fictional event fixtures for the local experience. Replace
// titles, dates, venue descriptions, and access details through the artist
// dashboard before public launch. Dates carry explicit offsets for calendars.
export const events: ExhibitionEvent[] = [
  {
    id: "ways-of-seeing",
    title: "Ways of seeing",
    subtitle: "One perspective. Many encounters.",
    type: "Exhibition",
    status: "upcoming",
    image: "exhibition",
    alt: "Sunlight crosses a quiet gallery containing three rust-coloured photographic prints.",
    width: 1672,
    height: 941,
    position: "57% 50%",
    description:
      "A gathering of photographs around presence, light, and the spaces between. An invitation to spend a little more time with an image.",
    story: [
      "A portrait asks for one kind of attention. A landscape asks for another. Bring them into the same room and a conversation begins.",
      "Ways of seeing brings together the human figure, architectural form, and the natural world. Moving between them, the familiar becomes something to look at again.",
      "Explore the works here, save the pieces that stay with you, and return to them in the room.",
    ],
    artworkIds: ["earth-held-still", "between-light-and-form", "study-in-red"],
    timeZone: "Africa/Accra",
    startsAt: "2026-12-12T18:00:00Z",
    endsAt: "2026-12-12T21:00:00Z",
    venue: "The studio gallery",
    address: "Osu, Accra",
    admission: "Free entry",
    accessNote:
      "For access requirements or a quieter viewing, enquire before your visit.",
  },
  {
    id: "the-shape-of-quiet",
    title: "The shape of quiet",
    subtitle: "An encounter with material and light.",
    type: "Artist encounter",
    status: "upcoming",
    image: "paper",
    alt: "Warm light reveals the curled edge and cotton-paper texture of a landscape print on a wooden table.",
    width: 1536,
    height: 1024,
    description:
      "A closer conversation with the physical work: its surface, its scale, and the small decisions that give an image its presence.",
    story: [
      "Light changes as you move. Paper has a weight and a surface. The distance between you and an artwork becomes part of the experience.",
      "The shape of quiet opens a space for looking closely at the physical photograph, and for conversations about how an image becomes an object.",
      "Discover the accompanying works and enquire about visiting.",
    ],
    artworkIds: ["earth-held-still", "objects-of-attention"],
    timeZone: "Africa/Accra",
    startsAt: "2027-01-16T15:00:00Z",
    endsAt: "2027-01-16T18:00:00Z",
    venue: "The viewing room",
    address: "Labone, Accra",
    admission: "By enquiry",
    accessNote:
      "A small gathering around the work. Enquire about a place and any access requirements.",
  },
  {
    id: "earth-and-afterlight",
    title: "Earth & afterlight",
    subtitle: "Landscapes at the edge of abstraction.",
    type: "Exhibition",
    status: "past",
    image: "fine-art",
    alt: "Rust-coloured dune ridges divide warm light from deep plum shadow.",
    width: 1536,
    height: 1024,
    description:
      "A passage through earth, shadow, and the quiet geometry of the natural world.",
    story: [
      "A ridge becomes a line. A shadow becomes a shape. A landscape can hold another landscape inside it.",
      "Earth & afterlight gathers close observations of natural form, allowing colour and surface to carry the story.",
      "The exhibition has closed. Its accompanying works remain here to revisit, save, and explore.",
    ],
    artworkIds: ["earth-held-still", "between-light-and-form"],
    timeZone: "Africa/Accra",
    startsAt: "2026-10-10T17:00:00Z",
    endsAt: "2026-10-10T20:00:00Z",
    venue: "The project room",
    address: "Cantonments, Accra",
    admission: "Exhibition closed",
  },
];

export function getEvent(id: string) {
  return events.find((event) => event.id === id);
}

export function eventDateLabel(event: ExhibitionEvent) {
  if (!event.startsAt) return "Dates to be announced";
  const start = new Date(event.startsAt);
  if (!Number.isFinite(start.getTime())) return "Dates to be announced";
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: event.timeZone,
  });
  if (!event.endsAt) return formatter.format(start);
  const end = new Date(event.endsAt);
  if (!Number.isFinite(end.getTime())) return formatter.format(start);
  return formatter.formatRange(start, end);
}

export function eventTimeLabel(event: ExhibitionEvent) {
  if (!event.startsAt || !event.endsAt) return "Visiting times to be announced";
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()))
    return "Visiting times to be announced";
  const format = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: event.timeZone,
  });
  const zone =
    new Intl.DateTimeFormat("en-GB", {
      timeZone: event.timeZone,
      timeZoneName: "short",
    })
      .formatToParts(start)
      .find((part) => part.type === "timeZoneName")?.value || event.timeZone;
  return `${format.format(start)} – ${format.format(end)} · ${zone}`;
}
