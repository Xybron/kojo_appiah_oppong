import assert from "node:assert/strict";
import {
  createCalendarFile,
  createGoogleCalendarUrl,
  hasCalendarDates,
  foldCalendarLine,
} from "../app/utils/calendar.ts";

const event = {
  id: "opening-evening",
  title: "Light, paper; presence",
  startsAt: "2027-01-15T18:00:00+02:00",
  endsAt: "2027-01-15T20:30:00+02:00",
  description: "A line\\a second line\r\nBEGIN:VEVENT\nMeet the work.",
  location: "Gallery; Room 1, Accra",
  url: "https://example.test/exhibitions/opening-evening",
  timeZone: "Africa/Accra",
};
const calendar = createCalendarFile(event, new Date("2026-11-27T12:00:00Z"));
assert(calendar.includes("DTSTART:20270115T160000Z\r\n"));
assert(calendar.includes("DTEND:20270115T183000Z\r\n"));
assert(calendar.includes("DTSTAMP:20261127T120000Z\r\n"));
assert(calendar.includes("SUMMARY:Light\\, paper\\; presence\r\n"));
assert(calendar.includes("LOCATION:Gallery\\; Room 1\\, Accra\r\n"));
assert.equal(
  calendar.split("\r\n").filter((line) => line === "BEGIN:VEVENT").length,
  1,
  "description cannot inject event properties",
);
assert.equal(
  calendar.replace(/\r\n/g, "").includes("\n"),
  false,
  "all newlines are CRLF",
);
assert(calendar.endsWith("END:VCALENDAR\r\n"));
assert.equal(
  createCalendarFile(event).match(/UID:([^\r]+)/)[1],
  calendar.match(/UID:([^\r]+)/)[1],
  "UID is stable across downloads",
);
const text = `DESCRIPTION:${"光é🙂".repeat(45)}`;
const folded = foldCalendarLine(text);
for (const line of folded.split("\r\n"))
  assert(
    Buffer.byteLength(line, "utf8") <= 75,
    "each physical line is <=75 octets",
  );
assert.equal(folded.replace(/\r\n /g, ""), text, "UTF-8 folding is lossless");
assert.equal(hasCalendarDates({}), false);
assert.equal(
  hasCalendarDates({ startsAt: "2027-01-15T18:00:00", endsAt: event.endsAt }),
  false,
  "floating local time rejected",
);
assert.equal(
  hasCalendarDates({ startsAt: event.endsAt, endsAt: event.startsAt }),
  false,
);
assert.equal(hasCalendarDates(event), true);
assert.throws(() => createCalendarFile({ ...event, endsAt: event.startsAt }));
const google = new URL(createGoogleCalendarUrl(event));
assert.equal(google.origin, "https://calendar.google.com");
assert.equal(
  google.searchParams.get("dates"),
  "20270115T160000Z/20270115T183000Z",
);
assert.equal(google.searchParams.get("text"), event.title);
assert.equal(google.searchParams.get("ctz"), "Africa/Accra");
console.log(
  "Calendar validation passed: UTC conversion, stable UID, escaping, UTF-8 folding, date guards, and Google Calendar link.",
);
