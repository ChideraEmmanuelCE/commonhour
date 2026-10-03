import test from 'node:test';
import assert from 'node:assert/strict';
import { wallInstants, localParts, daySlots, evaluate, personStatus, suggestions, validDate, offsetLabel, MINUTE } from '../public/js/time.js';
const p = (zone, overrides = {}) => ({ zone, start: 540, end: 1020, days: [1, 2, 3, 4, 5], anytime: false, ...overrides });
const utc = s => Date.parse(s);

test('Lagos, London, and New York see the same instant with date-specific offsets', () => {
  const t = wallInstants('2026-10-05', 900, 'Africa/Lagos')[0];
  assert.equal(t, utc('2026-10-05T14:00:00Z'));
  assert.equal(localParts(t, 'Europe/London').minute, 900);
  assert.equal(localParts(t, 'America/New_York').minute, 600);
  assert.equal(evaluate([p('Africa/Lagos'), p('Europe/London'), p('America/New_York')], t, 30).available, 3);
});
test('DST spring gap cannot silently turn 02:30 into 03:30', () => {
  assert.deepEqual(wallInstants('2026-03-08', 150, 'America/New_York'), []);
  assert.equal(daySlots('2026-03-08', 'America/New_York').length, 92);
});
test('DST autumn repetition exposes two distinct 01:30 instants and a 25-hour day', () => {
  const times = wallInstants('2026-11-01', 90, 'America/New_York');
  assert.deepEqual(times, [utc('2026-11-01T05:30:00Z'), utc('2026-11-01T06:30:00Z')]);
  assert.equal(daySlots('2026-11-01', 'America/New_York').length, 100);
  assert.equal(offsetLabel(times[0], 'America/New_York'), 'UTC−4');
  assert.equal(offsetLabel(times[1], 'America/New_York'), 'UTC−5');
});
test('fractional offsets work for India, Nepal, and Chatham', () => {
  const t = utc('2026-07-01T00:00:00Z');
  assert.equal(localParts(t, 'Asia/Kolkata').minute, 330);
  assert.equal(localParts(t, 'Asia/Kathmandu').minute, 345);
  assert.equal(localParts(t, 'Pacific/Chatham').minute, 765);
  assert.equal(wallInstants('2026-07-01', 345, 'Asia/Kathmandu')[0], t);
});
test('local dates differ across the international date line', () => {
  const t = utc('2026-10-05T12:00:00Z');
  assert.equal(localParts(t, 'Pacific/Kiritimati').date, '2026-10-06');
  assert.equal(localParts(t, 'Pacific/Honolulu').date, '2026-10-05');
});
test('the whole duration must fit; the exact end is exclusive', () => {
  const person = p('UTC');
  assert.equal(personStatus(person, utc('2026-10-05T16:30:00Z'), 30).available, true);
  assert.equal(personStatus(person, utc('2026-10-05T16:45:00Z'), 30).available, false);
  assert.equal(personStatus(person, utc('2026-10-05T16:45:00Z'), 30).outside, 15);
});
test('minute-level hours do not falsely accept a short partial window', () => {
  assert.equal(personStatus(p('UTC', { start: 547, end: 558 }), utc('2026-10-05T09:00:00Z'), 15).outside, 7);
});
test('an overnight Monday shift includes early Tuesday, not early Monday', () => {
  const person = p('UTC', { start: 1320, end: 360, days: [1] });
  assert.equal(personStatus(person, utc('2026-10-06T02:00:00Z'), 60).available, true);
  assert.equal(personStatus(person, utc('2026-10-05T02:00:00Z'), 60).available, false);
  assert.equal(personStatus(person, utc('2026-10-06T05:30:00Z'), 60).available, false);
});
test('explicit overnight availability takes priority over late/early classification', () => {
  assert.equal(personStatus(p('UTC', { start: 1320, end: 360 }), utc('2026-10-05T23:00:00Z'), 30).label, 'Within hours');
});
test('full-day availability still honours the local selected days across midnight', () => {
  const person = p('UTC', { anytime: true, days: [1] });
  assert.equal(personStatus(person, utc('2026-10-05T23:45:00Z'), 15).available, true);
  assert.equal(personStatus(person, utc('2026-10-05T23:45:00Z'), 30).available, false);
});
test('suggestions prioritize entire-meeting overlap and exclude past starts', () => {
  const slots = daySlots('2026-10-05', 'Africa/Lagos');
  const people = [p('Africa/Lagos'), p('Europe/London'), p('America/New_York')];
  const choices = suggestions(slots, people, 30, 'Africa/Lagos', utc('2026-10-05T12:00:00Z'));
  assert.equal(choices.length, 3);
  assert.ok(choices.every(c => c.available === 3 && c.instant >= utc('2026-10-05T12:00:00Z')));
  assert.ok(Math.abs(choices[0].instant - choices[1].instant) >= 30 * MINUTE);
});
test('no-overlap results stay honest', () => {
  const people = [p('UTC', { start: 480, end: 540 }), p('UTC', { start: 1020, end: 1080 })];
  assert.ok(suggestions(daySlots('2026-10-05', 'UTC'), people, 60, 'UTC', 0).every(c => c.available < 2));
});
test('a skipped calendar date has no selectable instants', () => {
  assert.equal(daySlots('2011-12-30', 'Pacific/Apia').length, 0);
});
test('a half-hour DST change produces the correct day length', () => {
  assert.equal(daySlots('2026-10-04', 'Australia/Lord_Howe').length, 94);
});
test('invalid calendar dates are rejected rather than normalized', () => {
  for (const date of ['2026-02-30', '2026-13-01', '1900-01-01', '2101-01-01', 'not a date']) assert.equal(validDate(date), false);
  assert.equal(validDate('2028-02-29'), true);
});

test('the first and last supported dates both have complete selectable days', () => {
  assert.equal(daySlots('2000-01-01', 'UTC').length, 96);
  assert.equal(daySlots('2100-12-31', 'UTC').length, 96);
});
