/* All scheduling uses real UTC instants. Local clocks are views of that instant. */
const formatters = new Map();
const displayFormatters = new Map();
const partsCache = new Map();
const MINUTE = 60_000;
export { MINUTE };

export function isZone(zone) {
  try { new Intl.DateTimeFormat('en', { timeZone: zone }); return true; }
  catch { return false; }
}

export function localParts(instant, zone) {
  const key = `${zone}:${Math.floor(instant / MINUTE)}`;
  if (partsCache.has(key)) return partsCache.get(key);
  if (!formatters.has(zone)) {
    formatters.set(zone, new Intl.DateTimeFormat('en-CA-u-ca-gregory-nu-latn', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }));
  }
  const p = Object.fromEntries(formatters.get(zone).formatToParts(new Date(instant))
    .filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  const value = { date, minute: Number(p.hour) * 60 + Number(p.minute),
    weekday: new Date(`${date}T12:00:00Z`).getUTCDay() };
  if (partsCache.size > 40_000) partsCache.clear();
  partsCache.set(key, value);
  return value;
}

function calendarDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && !Number.isNaN(Date.parse(`${date}T12:00:00Z`))
    && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
}

export function validDate(date) {
  return calendarDate(date) && date >= '2000-01-01' && date <= '2100-12-31';
}

export function addDays(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function offsetMinutes(instant, zone) {
  const p = localParts(instant, zone);
  const wall = Date.parse(`${p.date}T00:00:00Z`) + p.minute * MINUTE;
  return Math.round((wall - Math.floor(instant / MINUTE) * MINUTE) / MINUTE);
}

/* Returns zero instants for a skipped clock time, two for a repeated time. */
export function wallInstants(date, minute, zone) {
  return validDate(date) ? wallCandidates(date, minute, zone) : [];
}

function wallCandidates(date, minute, zone) {
  if (!calendarDate(date) || !Number.isInteger(minute) || minute < 0 || minute >= 1440 || !isZone(zone)) return [];
  const wall = Date.parse(`${date}T00:00:00Z`) + minute * MINUTE;
  const offsets = new Set([-36, -18, 0, 18, 36].map(h => offsetMinutes(wall + h * 60 * MINUTE, zone)));
  return [...offsets].map(offset => wall - offset * MINUTE).filter(t => {
    const p = localParts(t, zone);
    return p.date === date && p.minute === minute;
  }).sort((a, b) => a - b);
}

function firstInstant(date, zone) {
  for (let minute = 0; minute < 1440; minute += 15) {
    const hits = wallCandidates(date, minute, zone);
    if (hits.length) return hits[0];
  }
  return null;
}

export function daySlots(date, zone) {
  const start = firstInstant(date, zone);
  if (start === null) return [];
  let end = null;
  for (let d = 1; d <= 3 && end === null; d++) end = firstInstant(addDays(date, d), zone);
  if (end === null) return [];
  const slots = [];
  for (let t = start; t < end; t += 15 * MINUTE) {
    if (localParts(t, zone).date === date) slots.push(t);
  }
  return slots;
}

export function availabilityAt(person, instant) {
  const p = localParts(instant, person.zone);
  const overnight = !person.anytime && person.start > person.end;
  const shiftDay = overnight && p.minute < person.end ? (p.weekday + 6) % 7 : p.weekday;
  const workingDay = person.days.includes(shiftDay);
  const inside = person.anytime || (overnight
    ? p.minute >= person.start || p.minute < person.end
    : p.minute >= person.start && p.minute < person.end);
  const available = workingDay && inside;
  const quiet = !available && (p.minute < 7 * 60 || p.minute >= 22 * 60);
  return { available, quiet, offDay: !workingDay, ...p };
}

export function personStatus(person, start, duration) {
  // Include every minute: short windows and a meeting's final minute matter.
  let outside = 0, quiet = 0, offDay = 0;
  for (let m = 0; m < duration; m++) {
    const s = availabilityAt(person, start + m * MINUTE);
    outside += Number(!s.available);
    quiet += Number(s.quiet);
    offDay += Number(s.offDay);
  }
  const available = outside === 0;
  return { available, outside, quiet, offDay,
    label: available ? 'Within hours' : quiet > 0 ? 'Late / early' : offDay > 0 ? 'Day off' : 'Outside hours',
    kind: available ? 'good' : quiet > 0 ? 'night' : 'outside' };
}

export function evaluate(people, instant, duration) {
  const statuses = people.map(p => personStatus(p, instant, duration));
  const available = statuses.filter(s => s.available).length;
  const worst = Math.max(...statuses.map(s => s.outside));
  const cost = statuses.reduce((sum, s) => sum + s.outside + s.quiet * 4 + s.offDay, 0);
  return { available, total: people.length, statuses, cost: cost + worst * 2 };
}

export function suggestions(slots, people, duration, anchorZone, now = Date.now()) {
  const ranked = slots.filter(t => t >= now).map(t => {
    const result = evaluate(people, t, duration);
    const center = Math.abs(localParts(t, anchorZone).minute - 14 * 60);
    return { instant: t, ...result, center };
  }).sort((a, b) => b.available - a.available || a.cost - b.cost || a.center - b.center || a.instant - b.instant);
  const result = [];
  for (const option of ranked) {
    if (result.every(s => Math.abs(s.instant - option.instant) >= duration * MINUTE)) result.push(option);
    if (result.length === 3) break;
  }
  return result;
}

export function clock(instant, zone, format = '24') {
  const key = `clock:${zone}:${format}`;
  if (!displayFormatters.has(key)) displayFormatters.set(key, new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: format === '12',
  }));
  return displayFormatters.get(key).format(instant);
}

export function dateLabel(instant, zone, short = false) {
  const key = `date:${zone}:${short}`;
  if (!displayFormatters.has(key)) displayFormatters.set(key, new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, weekday: short ? 'short' : 'long', day: 'numeric', month: short ? 'short' : 'long',
    year: short ? undefined : 'numeric',
  }));
  return displayFormatters.get(key).format(instant);
}

export function offsetLabel(instant, zone) {
  const n = offsetMinutes(instant, zone);
  if (!n) return 'UTC';
  return `UTC${n >= 0 ? '+' : '−'}${Math.floor(Math.abs(n) / 60)}${Math.abs(n) % 60 ? `:${String(Math.abs(n) % 60).padStart(2, '0')}` : ''}`;
}

export function timeValue(minute) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

export function parseTime(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) return NaN;
  const [h, m] = value.split(':').map(Number);
  return h < 24 && m < 60 ? h * 60 + m : NaN;
}
