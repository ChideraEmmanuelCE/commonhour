import { isZone, validDate } from './time.js';
const PLAN_KEY = 'commonhour.plan.v1';
const GROUP_KEY = 'commonhour.groups.v1';
const DURATIONS = [15, 30, 45, 60, 90, 120];
export function validatePeople(people) {
  if (!Array.isArray(people) || people.length < 1 || people.length > 8) throw new Error('Choose between 1 and 8 locations.');
  return people.map((p, i) => {
    if (!p || !isZone(p.zone) || !Number.isInteger(p.start) || !Number.isInteger(p.end)
      || p.start < 0 || p.start > 1439 || p.end < 0 || p.end > 1439
      || (p.anytime !== true && p.start === p.end) || !Array.isArray(p.days) || !p.days.length
      || p.days.some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw new Error('A location has invalid hours or a time zone this browser does not support.');
    return { id: `p${i}`, label: String(p.label || p.zone).slice(0, 50),
      name: String(p.name || '').slice(0, 50), zone: p.zone, start: p.start, end: p.end,
      days: [...new Set(p.days)], anytime: p.anytime === true };
  });
}

export function validatePlan(p) {
  if (!p || p.v !== 1 || !validDate(p.date) || !DURATIONS.includes(p.duration)
    || !Number.isInteger(p.minute) || p.minute < 0 || p.minute >= 1440
    || !isZone(p.anchorZone)) throw new Error('This plan is incomplete or not supported.');
  const people = validatePeople(p.people);
  if (!people.some(person => person.zone === p.anchorZone)) throw new Error('The reference location is missing.');
  const location = String(p.location || '').slice(0, 300);
  return { v: 1, date: p.date, duration: p.duration, minute: p.minute,
    anchorZone: p.anchorZone, people, title: String(p.title || 'Team catch-up').slice(0, 100),
    location, format: p.format === '12' ? '12' : '24', occurrence: p.occurrence === 1 ? 1 : 0 };
}

export function readPlan() {
  try { return validatePlan(JSON.parse(localStorage.getItem(PLAN_KEY))); } catch { return null; }
}
export function writePlan(plan) {
  try { localStorage.setItem(PLAN_KEY, JSON.stringify(plan)); return true; } catch { return false; }
}
export function readGroups() {
  try {
    const g = JSON.parse(localStorage.getItem(GROUP_KEY));
    if (!Array.isArray(g)) return [];
    return g.slice(0, 20).flatMap(item => {
      try { return [{ id: String(item.id).slice(0, 70), name: String(item.name).slice(0, 60),
        people: validatePeople(item.people), anchorZone: isZone(item.anchorZone) ? item.anchorZone : item.people[0].zone }]; }
      catch { return []; }
    });
  } catch { return []; }
}
export function writeGroups(groups) {
  try { localStorage.setItem(GROUP_KEY, JSON.stringify(groups)); return true; } catch { return false; }
}

export function encodePlan(plan) {
  const data = new TextEncoder().encode(JSON.stringify(validatePlan(plan)));
  return btoa(Array.from(data, b => String.fromCharCode(b)).join('')).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export function decodePlan(encoded) {
  if (!encoded || encoded.length > 12_000 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('This shared link is invalid.');
  const binary = atob(encoded.replaceAll('-', '+').replaceAll('_', '/'));
  return validatePlan(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, c => c.charCodeAt(0)))));
}
