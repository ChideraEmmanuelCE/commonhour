import { clock, dateLabel, MINUTE, offsetLabel } from './time.js';
const escape = s => String(s).replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;').replaceAll('\r', '');
const utc = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

export function meetingText(plan, instant) {
  const lines = [plan.title || 'Team catch-up', `${plan.duration}-minute meeting`, ''];
  for (const p of plan.people) {
    const end = instant + plan.duration * MINUTE;
    const crosses = dateLabel(instant, p.zone, true) !== dateLabel(end, p.zone, true);
    lines.push(`${p.name ? `${p.name} · ` : ''}${p.label}: ${dateLabel(instant, p.zone, true)}, ${clock(instant, p.zone, plan.format)} – ${clock(end, p.zone, plan.format)}${crosses ? ` (${dateLabel(end, p.zone, true)})` : ''} (${offsetLabel(instant, p.zone)}; ${p.zone})`);
  }
  if (plan.location) lines.push('', `Location / meeting link: ${plan.location}`);
  lines.push('', 'Planned with Commonhour. Times compare entered hours, not live calendars.');
  return lines.join('\n');
}

/* RFC 5545 content lines fold at 75 UTF-8 octets, not 75 JavaScript characters. */
export function foldLine(line) {
  const encoder = new TextEncoder();
  let out = '', current = '', size = 0;
  for (const char of line) {
    const n = encoder.encode(char).length;
    if (size + n > 75) { out += `${current}\r\n`; current = ' '; size = 1; }
    current += char; size += n;
  }
  return out + current;
}

export function calendarFile(plan, instant, now = Date.now(), uid = null) {
  const token = uid || globalThis.crypto?.randomUUID?.() || `${now}-${Math.random().toString(36).slice(2)}`;
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Commonhour//Meeting Planner//EN',
    'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${token}@commonhour.local`, `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(instant)}`, `DTEND:${utc(instant + plan.duration * MINUTE)}`,
    `SUMMARY:${escape(plan.title || 'Team catch-up')}`, `DESCRIPTION:${escape(meetingText(plan, instant))}`,
    ...(plan.location ? [`LOCATION:${escape(plan.location)}`] : []), 'STATUS:CONFIRMED',
    'END:VEVENT', 'END:VCALENDAR'].map(foldLine).join('\r\n') + '\r\n';
}

export function download(content, name, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(value); return true; } catch { /* Try the selection fallback. */ }
  }
  const el = document.createElement('textarea');
  el.value = value; el.style.position = 'fixed'; el.style.top = '0'; el.style.left = '-9999px';
  document.body.append(el); el.select(); el.setSelectionRange(0, value.length);
  let success = false;
  try { success = document.execCommand('copy'); } catch { /* Manual selection is available in the share dialog. */ }
  el.remove(); return success;
}
