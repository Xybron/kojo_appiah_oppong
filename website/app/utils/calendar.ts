export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  description?: string;
  location?: string;
  url?: string;
  timeZone?: string;
}

function parseZonedDate(value: string) {
  // Floating local times are intentionally rejected: a download must represent
  // the same instant regardless of the visitor's device timezone.
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw new Error("Calendar dates must include a timezone offset.");
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Invalid calendar date.");
  return date;
}

function interval(event: Pick<CalendarEvent, "startsAt" | "endsAt">) {
  const start = parseZonedDate(event.startsAt);
  const end = parseZonedDate(event.endsAt);
  if (end <= start) throw new Error("The event must end after it starts.");
  return { start, end };
}

export function hasCalendarDates(event: {
  startsAt?: string;
  endsAt?: string;
}) {
  if (!event.startsAt || !event.endsAt) return false;
  try {
    interval({ startsAt: event.startsAt, endsAt: event.endsAt });
    return true;
  } catch {
    return false;
  }
}

export function escapeCalendarText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function utcStamp(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

// RFC 5545 §3.1 folds at 75 octets, preserving complete UTF-8 codepoints.
export function foldCalendarLine(value: string) {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let line = "";
  let bytes = 0;
  for (const character of value) {
    const width = encoder.encode(character).length;
    if (bytes + width > 75) {
      lines.push(line);
      line = " ";
      bytes = 1;
    }
    line += character;
    bytes += width;
  }
  lines.push(line);
  return lines.join("\r\n");
}

export function createCalendarFile(event: CalendarEvent, now = new Date()) {
  const { start, end } = interval(event);
  if (!event.id.trim() || !event.title.trim())
    throw new Error("An event ID and title are required.");
  if (!Number.isFinite(now.getTime()))
    throw new Error("Invalid calendar timestamp.");
  const description = [event.description, event.url]
    .filter(Boolean)
    .join("\n\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kojo Appiah Oppong//The Living Exhibition//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${encodeURIComponent(event.id)}@living-exhibition`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${escapeCalendarText(event.title)}`,
    ...(description ? [`DESCRIPTION:${escapeCalendarText(description)}`] : []),
    ...(event.location
      ? [`LOCATION:${escapeCalendarText(event.location)}`]
      : []),
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(foldCalendarLine).join("\r\n")}\r\n`;
}

export function createGoogleCalendarUrl(event: CalendarEvent) {
  const { start, end } = interval(event);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${utcStamp(start)}/${utcStamp(end)}`,
    details: [event.description, event.url].filter(Boolean).join("\n\n"),
  });
  if (event.location) params.set("location", event.location);
  if (event.timeZone) params.set("ctz", event.timeZone);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
