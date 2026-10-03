import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePlan, decodePlan, validatePlan } from '../public/js/storage.js';
import { calendarFile, foldLine, meetingText } from '../public/js/export.js';
const plan = { v: 1, date: '2026-10-05', minute: 900, duration: 30, anchorZone: 'Africa/Lagos', occurrence: 0,
  title: '设计团队 · Café', location: 'https://meet.example.com/room', format: '24',
  people: [{ id: 'a', name: 'Chidera', label: 'Lagos', zone: 'Africa/Lagos', start: 540, end: 1020, days: [1, 2, 3, 4, 5], anytime: false }] };
const instant = Date.parse('2026-10-05T14:00:00Z');

test('Unicode sharing round-trips without losing names or hours', () => {
  assert.deepEqual(decodePlan(encodePlan(plan)), validatePlan(plan));
});
test('malformed and oversized shared payloads are rejected', () => {
  assert.throws(() => decodePlan('bad!'));
  assert.throws(() => decodePlan('A'.repeat(12001)));
  assert.throws(() => validatePlan({ ...plan, people: [{ ...plan.people[0], zone: 'Fake/City' }] }));
  assert.throws(() => validatePlan({ ...plan, duration: 17 }));
  assert.throws(() => validatePlan({ ...plan, people: [{ ...plan.people[0], days: [] }] }));
  assert.throws(() => validatePlan({ ...plan, date: '2026-02-30' }));
  assert.throws(() => validatePlan({ ...plan, people: [{ ...plan.people[0], start: 0, end: 0, anytime: 'yes' }] }));
});
test('calendar events use UTC instants, correct end, CRLF, and RFC fields', () => {
  const ics = calendarFile(plan, instant, instant, 'test-id');
  assert.ok(ics.includes('DTSTART:20261005T140000Z\r\n'));
  assert.ok(ics.includes('DTEND:20261005T143000Z\r\n'));
  assert.ok(ics.includes('UID:test-id@commonhour.local\r\n'));
  assert.ok(ics.includes('LOCATION:https://meet.example.com/room'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal(ics.replaceAll('\r\n', '').includes('\n'), false);
});
test('calendar text escapes newlines, semicolons, commas, and backslashes', () => {
  const ics = calendarFile({ ...plan, title: 'A,B;C\\D\nFake:line' }, instant, instant, 'test');
  assert.ok(ics.includes('SUMMARY:A\\,B\\;C\\\\D\\nFake:line'));
  assert.equal(ics.includes('\r\nFake:line'), false);
});
test('folding respects UTF-8 bytes and unfolds losslessly', () => {
  const line = `SUMMARY:${'设计团队'.repeat(30)}`;
  const folded = foldLine(line);
  for (const physical of folded.split('\r\n')) assert.ok(new TextEncoder().encode(physical).length <= 75);
  assert.equal(folded.replaceAll('\r\n ', ''), line);
});
test('details explicitly show different local end dates at midnight', () => {
  const text = meetingText({ ...plan, duration: 60 }, Date.parse('2026-10-05T22:30:00Z'));
  assert.ok(text.includes('23:30 – 00:30 (Tue 6 Oct)'));
});
