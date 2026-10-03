import { MINUTE, isZone, validDate, localParts, addDays, daySlots, wallInstants,
  evaluate, suggestions, clock, dateLabel, offsetLabel, timeValue, parseTime, availabilityAt } from './time.js';
import { labelFor, searchZones } from './zones.js';
import { readPlan, writePlan, readGroups, writeGroups, validatePlan, validatePeople, encodePlan, decodePlan } from './storage.js';
import { meetingText, calendarFile, download, copyText } from './export.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const person = (label, zone, name = '') => ({ id: `p-${Math.random().toString(36).slice(2)}`, label, zone, name,
  start: 540, end: 1020, days: [1, 2, 3, 4, 5], anytime: false });
let sharedMessage = '';
let loadedShare = false;
let remembered = readPlan();
if (location.hash.startsWith('#plan=')) {
  try { remembered = decodePlan(location.hash.slice(6)); loadedShare = true; }
  catch (error) { sharedMessage = `${error.message} Your saved planner is still available.`; }
}
const fresh = !remembered;
let initialDate = localParts(Date.now(), browserZone).date;
while ([0, 6].includes(new Date(`${initialDate}T12:00:00Z`).getUTCDay())) initialDate = addDays(initialDate, 1);
const defaultPeople = [person(labelFor(browserZone), browserZone, 'You')];
for (const entry of [['London', 'Europe/London'], ['New York', 'America/New_York'], ['Lagos', 'Africa/Lagos']]) {
  if (defaultPeople.length >= 3) break;
  if (!defaultPeople.some(p => p.zone === entry[1])) defaultPeople.push(person(...entry));
}
let state = remembered || { v: 1, date: initialDate, minute: 14 * 60, duration: 30,
  anchorZone: browserZone, people: defaultPeople, title: 'Team catch-up', location: '',
  format: '24', occurrence: 0 };
let groups = readGroups();
let slots = [], options = [], slotScores = new Map();
let toastTimer = null, modalMode = '', editingPerson = null, chosenZone = null;
let persistedWarning = false, pickerTimer = null, installPrompt = null;
const modal = $('modal');

function selectedInstant() {
  const hits = wallInstants(state.date, state.minute, state.anchorZone);
  return hits[Math.min(state.occurrence, hits.length - 1)] ?? null;
}

function notify(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500);
}

function persist() {
  if (!writePlan(state) && !persistedWarning) {
    persistedWarning = true;
    $('app-notice').textContent = 'Browser storage is unavailable. You can still plan, share, and download an event, but changes will not survive a reload.';
    $('app-notice').hidden = false;
  }
}

function calculate() {
  slots = daySlots(state.date, state.anchorZone);
  slotScores = new Map(slots.map(t => [t, evaluate(state.people, t, state.duration)]));
  options = suggestions(slots, state.people, state.duration, state.anchorZone);
}

function chooseInstant(instant, recalculate = false) {
  const p = localParts(instant, state.anchorZone);
  state.date = p.date; state.minute = p.minute;
  state.occurrence = wallInstants(p.date, p.minute, state.anchorZone).indexOf(instant) > 0 ? 1 : 0;
  render(recalculate);
}

function render(recalculate = true) {
  const focusedSlot = document.activeElement?.dataset?.slot;
  const focusedSuggestion = document.activeElement?.dataset?.suggestion;
  if (recalculate) calculate();
  const instant = selectedInstant();
  const result = instant === null ? null : slotScores.get(instant) || evaluate(state.people, instant, state.duration);
  $('meeting-date').value = state.date;
  $('duration').value = String(state.duration);
  $('start-time').value = timeValue(state.minute);
  $('reference-zone').innerHTML = state.people.filter((p, i, all) => all.findIndex(x => x.zone === p.zone) === i)
    .map(p => `<option value="${esc(p.zone)}" ${p.zone === state.anchorZone ? 'selected' : ''}>${esc(p.label)}</option>`).join('');
  document.querySelectorAll('[data-format]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.format === state.format)));
  const hits = wallInstants(state.date, state.minute, state.anchorZone);
  $('occurrence-wrap').hidden = hits.length < 2;
  $('occurrence').value = String(state.occurrence);
  if (hits.length === 2) {
    $('occurrence').options[0].textContent = `First occurrence (${offsetLabel(hits[0], state.anchorZone)})`;
    $('occurrence').options[1].textContent = `Second occurrence (${offsetLabel(hits[1], state.anchorZone)})`;
  }
  $('time-error').hidden = instant !== null;
  $('time-error').textContent = slots.length
    ? 'This clock time is skipped by a clock change. Choose another time or one of the suggestions below.'
    : 'This local date does not exist in this time zone. Choose another date.';
  const slider = $('time-slider');
  slider.max = String(Math.max(0, slots.length - 1));
  slider.disabled = !slots.length;
  slider.value = String(Math.max(0, slots.findIndex(t => t === instant)));
  slider.setAttribute('aria-valuetext', instant === null ? 'No valid time selected' : `${clock(instant, state.anchorZone, state.format)} in ${labelFor(state.anchorZone)}`);
  if (slots.length) {
    $('first-hour').textContent = clock(slots[0], state.anchorZone, state.format);
    $('middle-hour').textContent = clock(slots[Math.floor(slots.length / 2)], state.anchorZone, state.format);
    $('last-hour').textContent = clock(slots.at(-1), state.anchorZone, state.format);
    const bands = slots.map((t, i) => `${slotScores.get(t).available === state.people.length ? '#a9d5c4' : '#e4e8f1'} ${(i / slots.length * 100).toFixed(2)}% ${((i + 1) / slots.length * 100).toFixed(2)}%`);
    slider.style.setProperty('--slider-bg', `linear-gradient(to right,${bands.join(',')})`);
  }
  $('slider-hint').textContent = slots.length !== 96 && slots.length
    ? `Clock-change day: ${slots.length / 4} hours. Every slider step is 15 real minutes.`
    : 'Move the slider to compare local times.';
  $('people-count').textContent = `${state.people.length} ${state.people.length === 1 ? 'location' : 'locations'} · 1 shared moment`;
  $('add-location').disabled = state.people.length >= 8;
  $('add-location').title = state.people.length >= 8 ? 'Maximum of 8 locations' : 'Add a city or time zone';
  renderPeople(instant, result);
  renderSummary(instant, result);
  renderSuggestions(instant);
  updateCounts(); updateLiveClock(); persist();
  if (focusedSlot) document.querySelector(`[data-slot="${focusedSlot}"]`)?.focus({ preventScroll: true });
  if (focusedSuggestion) document.querySelector(`[data-suggestion="${focusedSuggestion}"]`)?.focus({ preventScroll: true });
}

function renderPeople(instant, result) {
  const hourSlots = slots.filter((_, i) => i % 4 === 0);
  $('people-list').innerHTML = state.people.map((p, i) => {
    const local = instant === null ? null : localParts(instant, p.zone);
    const status = result?.statuses[i];
    const difference = local ? Math.round((Date.parse(local.date) - Date.parse(state.date)) / 86_400_000) : 0;
    const day = difference === 0 ? 'Same date' : dateLabel(instant, p.zone, true);
    const hours = p.anytime ? 'Any time' : `${timeValue(p.start)}–${timeValue(p.end)}${p.start > p.end ? ' overnight' : ''}`;
    const identity = p.name || p.label;
    return `<article class="person-row"><div class="person-main"><span class="avatar" data-color="${i % 4}" aria-hidden="true">${esc(identity.slice(0, 2).toUpperCase())}</span><div class="person-identity"><h3 class="person-name">${esc(identity)}</h3><p class="person-meta">${esc(p.name ? `${p.label} · ` : '')}${instant === null ? esc(p.zone) : offsetLabel(instant, p.zone)}</p></div><div class="person-time"><strong>${instant === null ? '—' : clock(instant, p.zone, state.format)}</strong><small>${esc(day)}</small><span class="status-label ${status?.kind || ''}">${esc(status?.label || 'Choose a time')}</span></div><button class="icon-button edit-person" data-person="${esc(p.id)}" aria-label="Edit ${esc(identity)}">${icon('edit')}</button></div><div class="hour-track" role="group" aria-label="Hourly timeline for ${esc(identity)}" style="--cols:${hourSlots.length || 24}">${hourSlots.map(t => {
      const s = availabilityAt(p, t), m = localParts(t, p.zone).minute;
      const className = s.available ? 'good' : s.quiet ? 'night' : 'outside';
      const active = instant !== null && instant < t + 60 * MINUTE && instant + state.duration * MINUTE > t;
      return `<button class="hour-cell ${className} ${active ? 'selected' : ''}" data-slot="${t}" aria-pressed="${active}" aria-label="Choose ${esc(clock(t, state.anchorZone, state.format))} in ${esc(labelFor(state.anchorZone))}; ${esc(clock(t, p.zone, state.format))} in ${esc(p.label)}, ${s.available ? 'available' : s.quiet ? 'late or early' : 'outside hours'}" title="${esc(clock(t, p.zone, state.format))} · ${s.available ? 'Available' : 'Outside hours'}">${String(Math.floor(m / 60)).padStart(2, '0')}</button>`;
    }).join('')}</div><p class="track-note">${esc(hours)} · ${esc(p.days.length === 7 ? 'Every day' : [1, 2, 3, 4, 5, 6, 0].filter(d => p.days.includes(d)).map(d => weekdays[d]).join(', '))}</p></article>`;
  }).join('');
}

function renderSummary(instant, result) {
  if (document.activeElement !== $('meeting-title')) $('meeting-title').value = state.title;
  if (document.activeElement !== $('meeting-location')) $('meeting-location').value = state.location;
  if (instant !== null) {
    const parts = clock(instant, state.anchorZone, state.format).split(' ');
    $('summary-time').innerHTML = `${esc(parts[0])}${parts[1] ? `<span class="period">${esc(parts[1])}</span>` : ''}`;
    $('summary-date').textContent = `${dateLabel(instant, state.anchorZone, true)} · ${state.duration} minutes`;
    $('summary-zone').textContent = `${labelFor(state.anchorZone)} · ${offsetLabel(instant, state.anchorZone)}`;
  } else {
    $('summary-time').textContent = '—';
    $('summary-date').textContent = 'Choose a valid start time';
    $('summary-zone').textContent = labelFor(state.anchorZone);
  }
  const status = $('meeting-status');
  const past = instant !== null && instant < Date.now();
  const allGood = result?.available === state.people.length;
  status.className = `meeting-status${instant === null ? ' invalid' : !allGood || past ? ' warning' : ''}`;
  const message = instant === null ? 'That local time does not exist'
    : past ? 'This meeting time is in the past'
      : allGood ? `Everyone is within their hours` : `${result.available} of ${result.total} within their hours`;
  status.innerHTML = `${icon(allGood && !past ? 'check' : 'clock')}<span>${esc(message)}</span>`;
  $('summary-people').innerHTML = state.people.map(p => {
    const end = instant === null ? null : instant + state.duration * MINUTE;
    const endDay = end === null ? '' : localParts(end, p.zone).date;
    const crosses = end !== null && endDay !== localParts(instant, p.zone).date;
    return `<div class="summary-person"><span>${esc(p.name || p.label)}<small>${esc(p.name ? p.label : p.zone)}</small></span><span><strong>${instant === null ? '—' : `${clock(instant, p.zone, state.format)}–${clock(end, p.zone, state.format)}`}</strong><small>${instant === null ? '' : esc(dateLabel(instant, p.zone, true))}${crosses ? `<br>ends ${esc(dateLabel(end, p.zone, true))}` : ''}</small></span></div>`;
  }).join('');
  ['share-plan', 'download-calendar', 'copy-summary'].forEach(id => { $(id).disabled = instant === null; });
}

function renderSuggestions(instant) {
  const overlap = [...slotScores.values()].filter(s => s.available === state.people.length).length;
  const allGood = options.some(o => o.available === state.people.length);
  $('suggestions-heading').textContent = allGood ? 'Your common hours' : 'Closest options';
  $('suggestion-description').textContent = !options.length ? 'Choose a future date to see suggested times.'
    : allGood ? `Full-meeting matches, shown in ${labelFor(state.anchorZone)}.`
      : `No full overlap on this date. Compare options or adjust hours.`;
  $('suggestions').innerHTML = options.length ? options.map(o => {
    const good = o.available === state.people.length;
    return `<button class="suggestion ${o.instant === instant ? 'selected' : ''}" data-suggestion="${o.instant}" aria-pressed="${o.instant === instant}"><span>${dateLabel(o.instant, state.anchorZone, true)}</span><strong>${clock(o.instant, state.anchorZone, state.format)}</strong><span class="suggestion-tag ${good ? '' : 'warning'}">${icon(good ? 'check' : 'clock')}${good ? 'Everyone within hours' : `${o.available} of ${o.total} within hours`}</span></button>`;
  }).join('') : `<div class="empty-suggestions">${slots.length ? 'There are no future start times left on this date. Try the next day.' : 'This date is skipped by a time-zone change. Pick another date.'}</div>`;
  $('suggestions').dataset.overlap = String(overlap);
}

function updateCounts() {
  $('group-count').textContent = String(groups.length); $('group-count').hidden = !groups.length;
}
function updateLiveClock() {
  $('live-clock').textContent = clock(Date.now(), browserZone, state.format);
  $('local-zone').textContent = labelFor(browserZone);
}

function openModal(title, content, mode) {
  modalMode = mode; $('modal-title').textContent = title; $('modal-content').innerHTML = content;
  if (!modal.open) modal.showModal();
}
function formError(message) {
  const e = $('form-error'); if (e) { e.textContent = message; e.hidden = false; }
}
function closeModal() { modal.close(); }

function openPicker(id = null) {
  if (!id && state.people.length >= 8) return notify('You can compare up to 8 locations.');
  editingPerson = id ? state.people.find(p => p.id === id) : null;
  chosenZone = editingPerson ? { label: editingPerson.label, zone: editingPerson.zone, country: '' } : null;
  if (editingPerson) return renderPersonForm();
  renderPicker();
}
function renderPicker() {
  openModal(editingPerson ? 'Change location' : 'Add a location', `<div class="field search-field"><label for="zone-search">Search a city, country, or time zone</label>${icon('search')}<input id="zone-search" type="search" placeholder="Try Lagos, Tokyo, or Asia/Kolkata" autocomplete="off" maxlength="100" aria-controls="zone-results"></div><div id="zone-results" class="zone-results" aria-label="Matching locations"></div><p class="helper">Includes this browser’s supported time zones. Add the same city more than once for people with different hours.</p>`, 'picker');
  updatePicker(''); $('zone-search').focus();
}
function updatePicker(query) {
  let entries = searchZones(query);
  if (query.trim().includes('/') && isZone(query.trim()) && !entries.some(e => e.zone === query.trim())) entries.unshift({ label: labelFor(query.trim()), zone: query.trim(), country: 'Time zone' });
  $('zone-results').innerHTML = entries.length ? entries.map(p => `<button class="zone-option" data-zone="${esc(p.zone)}" data-label="${esc(p.label)}"><span><strong>${esc(p.label)}</strong><small>${esc(p.country)} · ${esc(p.zone)}</small></span>${icon('plus')}</button>`).join('')
    : '<p class="helper">No matches. Try another city or enter an exact IANA time zone, such as Pacific/Fiji.</p>';
}
function renderPersonForm() {
  const p = editingPerson || person(chosenZone.label, chosenZone.zone);
  openModal(editingPerson ? 'Edit location' : 'Set available hours', `<form id="person-form"><div class="chosen-location"><span><strong>${esc(chosenZone.label)}</strong><small>${esc(chosenZone.zone)}</small></span><button type="button" class="text-button" data-action="change-zone">Change</button></div><div class="field"><label for="person-name">Person or group name <span class="optional">optional</span></label><input id="person-name" maxlength="50" value="${esc(p.name)}" placeholder="e.g. Design team"></div><fieldset class="days-field"><legend>Available days</legend><div class="day-options">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label><input type="checkbox" name="day" value="${d}" ${p.days.includes(d) ? 'checked' : ''}><span>${weekdays[d]}</span></label>`).join('')}</div></fieldset><label class="checkbox-field"><input type="checkbox" id="anytime" ${p.anytime ? 'checked' : ''}>Available all day on the selected days</label><div class="form-row" id="hours-row" ${p.anytime ? 'hidden' : ''}><div class="field"><label for="work-start">From</label><input id="work-start" type="time" step="60" value="${timeValue(p.start)}" ${p.anytime ? 'disabled' : ''} required></div><div class="field"><label for="work-end">Until</label><input id="work-end" type="time" step="60" value="${timeValue(p.end)}" ${p.anytime ? 'disabled' : ''} required></div></div><p class="helper">Hours belong to this location’s local clock. An end before the start creates an overnight shift; selected days are the days the shift begins.</p><p id="form-error" class="form-error" role="alert" hidden></p><div class="dialog-actions">${editingPerson ? `<button type="button" class="button button-danger remove-location" data-action="remove-person" ${state.people.length === 1 ? 'disabled' : ''}>${icon('trash')}Remove</button>` : ''}<button type="button" class="button button-quiet" data-action="cancel">Cancel</button><button type="submit" class="button button-primary">${editingPerson ? 'Save changes' : 'Add location'}</button></div></form>`, 'person');
  $('person-name').focus();
}
function savePerson(event) {
  event.preventDefault();
  const anytime = $('anytime').checked;
  const days = [...modal.querySelectorAll('input[name=day]:checked')].map(e => Number(e.value));
  const start = parseTime($('work-start').value), end = parseTime($('work-end').value);
  if (!days.length) return formError('Choose at least one available day.');
  if (!anytime && (!Number.isInteger(start) || !Number.isInteger(end) || start === end)) return formError('Choose different start and end times, or select available all day.');
  const updated = { id: editingPerson?.id || `p-${Date.now()}`, label: chosenZone.label, zone: chosenZone.zone,
    name: $('person-name').value.trim(), start: Number.isInteger(start) ? start : 540,
    end: Number.isInteger(end) ? end : 1020, days, anytime };
  const oldInstant = selectedInstant();
  if (editingPerson) {
    const index = state.people.findIndex(p => p.id === editingPerson.id);
    const oldZone = state.people[index].zone; state.people[index] = updated;
    if (state.anchorZone === oldZone && !state.people.some(p => p.zone === oldZone)) {
      state.anchorZone = updated.zone;
      if (oldInstant !== null) {
        const local = localParts(oldInstant, updated.zone); state.date = local.date; state.minute = local.minute;
        state.occurrence = wallInstants(local.date, local.minute, updated.zone).indexOf(oldInstant) > 0 ? 1 : 0;
      }
    }
  } else state.people.push(updated);
  closeModal(); render(); notify(editingPerson ? 'Location updated.' : 'Location added.');
}
function removePerson() {
  if (!editingPerson || state.people.length <= 1) return;
  const instant = selectedInstant();
  state.people = state.people.filter(p => p.id !== editingPerson.id);
  if (!state.people.some(p => p.zone === state.anchorZone)) {
    state.anchorZone = state.people[0].zone;
    if (instant !== null) {
      const local = localParts(instant, state.anchorZone); state.date = local.date; state.minute = local.minute;
      state.occurrence = wallInstants(local.date, local.minute, state.anchorZone).indexOf(instant) > 0 ? 1 : 0;
    }
  }
  closeModal(); render(); notify('Location removed.');
}

function openSaveGroup() {
  if (groups.length >= 20) return notify('You have 20 saved groups. Delete one to save another.');
  openModal('Save this group', `<form id="group-form"><p>Keep these locations and their available hours for next time. Groups are saved in this browser.</p><div class="field" style="margin-top:18px"><label for="group-name">Group name</label><input id="group-name" maxlength="60" placeholder="e.g. Our project team" required></div><p id="form-error" class="form-error" role="alert" hidden></p><div class="dialog-actions"><button type="button" class="button button-quiet" data-action="cancel">Cancel</button><button type="submit" class="button button-primary">Save group</button></div></form>`, 'save-group');
  $('group-name').focus();
}
function saveGroup(event) {
  event.preventDefault(); const name = $('group-name').value.trim();
  if (!name) return formError('Give this group a name.');
  const next = [...groups, { id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name,
    people: validatePeople(state.people), anchorZone: state.anchorZone }];
  if (!writeGroups(next)) return formError('This browser cannot save groups. Try allowing site storage, or share a plan link instead.');
  groups = next; updateCounts(); closeModal(); notify('Group saved in this browser.');
}
function openGroups() {
  const content = groups.length ? `<p>Reuse your locations and hours. Your meeting date and title stay as they are.</p>${groups.map(g => `<div class="saved-group"><button class="group-open" data-load-group="${esc(g.id)}"><strong>${esc(g.name)}</strong><small>${esc(g.people.map(p => p.name || p.label).join(' · '))}</small></button><button class="icon-button" data-delete-group="${esc(g.id)}" aria-label="Delete ${esc(g.name)}">${icon('trash')}</button></div>`).join('')}`
    : `<div class="empty-state">${icon('users')}<h3>Your people, ready for next time.</h3><p>Add your locations to the planner, then choose “Save group”.</p></div>`;
  openModal('Saved groups', content, 'groups');
}
function loadGroup(id) {
  const g = groups.find(x => x.id === id); if (!g) return;
  const instant = selectedInstant();
  state.people = structuredClone(g.people);
  state.anchorZone = state.people.some(p => p.zone === g.anchorZone) ? g.anchorZone : state.people[0].zone;
  if (instant !== null) {
    const local = localParts(instant, state.anchorZone); state.date = local.date; state.minute = local.minute;
    state.occurrence = wallInstants(local.date, local.minute, state.anchorZone).indexOf(instant) > 0 ? 1 : 0;
  }
  closeModal(); render(); notify(`${g.name} loaded.`);
}
function askDeleteGroup(id) {
  const g = groups.find(x => x.id === id); if (!g) return;
  openModal('Delete saved group?', `<p>Remove “${esc(g.name)}” from this browser? The locations in your current planner stay available.</p><div class="dialog-actions"><button class="button button-quiet" data-action="back-groups">Keep group</button><button class="button button-danger" data-confirm-delete="${esc(id)}">Delete group</button></div>`, 'delete-group');
}

function openShare() {
  const instant = selectedInstant(); if (instant === null) return;
  if (!['http:', 'https:'].includes(location.protocol)) return notify('Open Commonhour through a web server or Netlify before sharing a link.');
  const link = `${location.origin}${location.pathname}#plan=${encodePlan(state)}`;
  openModal('Share this meeting plan', `<p>The link opens this date, time, and these locations. Anyone with it can view the meeting details. It does not send invitations or reserve a time.</p><label for="share-link" class="sr-only">Plan link</label><textarea id="share-link" class="share-link" readonly spellcheck="false">${esc(link)}</textarea><div class="dialog-actions"><button class="button button-primary" id="copy-link">${icon('copy')}Copy link</button>${navigator.share ? `<button class="button button-quiet" id="native-share">${icon('link')}Share…</button>` : ''}</div><div class="share-preview">${esc(meetingText(state, instant))}</div>`, 'share');
  $('share-link').focus(); $('share-link').select();
}

function openGuide() {
  openModal('A good time, in three steps', `<div class="guide-step"><span>1</span><div><h3>Bring everyone into the picture.</h3><p>Add cities or time zones. Edit each location to set a name, available days, and local hours.</p></div></div><div class="guide-step"><span>2</span><div><h3>Find your common hour.</h3><p>Choose a date and duration. Green on the slider marks starts where the whole meeting fits everyone’s entered hours. Use a suggestion or move the slider.</p></div></div><div class="guide-step"><span>3</span><div><h3>Make it easy to show up.</h3><p>Share the plan, copy the details, or download an .ics event to open in your calendar. Send invitations from your own calendar if needed.</p></div></div><div class="guide-section"><h3>When the clocks change</h3><p>Dates use the time zone selected in “Time shown in”. Local dates can differ. Daylight-saving changes use your browser’s time-zone data; repeated times have a first/second choice. A skipped time is clearly marked.</p></div><div class="guide-section"><h3>What counts as available?</h3><p>Every minute of the meeting must fit the entered days and hours. Overnight shifts belong to the day they start. Outside the entered hours, 22:00–07:00 is marked late / early. Suggestions favour more people within hours, then avoid inconvenient times. This app does not read live calendars or public holidays.</p></div><div class="guide-section"><h3>Private, and useful offline</h3><p>Plans and groups stay in this browser. A shared link includes its meeting details in the part after #; recipients can edit their own copy. There is no shared voting or live synchronization. Clearing browser data removes saved plans.</p><p>After one successful online visit, the app can work offline on browsers that support service workers. On iPhone or iPad, open in Safari, use Share, then Add to Home Screen. On Android, use your browser’s install option. Very small browsers show a compact layout; watch browser capabilities vary.</p></div><div class="guide-section"><h3>Open source, without subscriptions</h3><p>Commonhour is released under the MIT License. The code can be used, improved, and hosted by anyone.</p></div>`, 'guide');
}

$('previous-day').addEventListener('click', () => changeDate(addDays(state.date, -1)));
$('next-day').addEventListener('click', () => changeDate(addDays(state.date, 1)));
function changeDate(date) {
  if (!validDate(date)) { $('meeting-date').value = state.date; return notify('Choose a date between 2000 and 2100.'); }
  state.date = date; render();
}
$('meeting-date').addEventListener('change', e => changeDate(e.target.value));
$('duration').addEventListener('change', e => { state.duration = Number(e.target.value); render(); });
$('start-time').addEventListener('change', e => {
  const minute = parseTime(e.target.value);
  if (!Number.isInteger(minute)) { e.target.value = timeValue(state.minute); return notify('Enter a valid start time.'); }
  state.minute = minute; state.occurrence = 0; render(false);
});
$('reference-zone').addEventListener('change', e => {
  const instant = selectedInstant(); state.anchorZone = e.target.value;
  if (instant !== null) chooseInstant(instant, true); else render();
});
$('occurrence').addEventListener('change', e => { state.occurrence = Number(e.target.value); render(false); });
let sliderFrame = null;
$('time-slider').addEventListener('input', e => {
  const instant = slots[Number(e.target.value)];
  if (instant === undefined) return;
  cancelAnimationFrame(sliderFrame); sliderFrame = requestAnimationFrame(() => chooseInstant(instant));
});
document.querySelectorAll('[data-format]').forEach(button => button.addEventListener('click', () => { state.format = button.dataset.format; render(false); }));
$('people-list').addEventListener('click', e => {
  const edit = e.target.closest('[data-person]'), slot = e.target.closest('[data-slot]');
  if (edit) openPicker(edit.dataset.person);
  if (slot) chooseInstant(Number(slot.dataset.slot));
});
$('suggestions').addEventListener('click', e => {
  const option = e.target.closest('[data-suggestion]'); if (option) chooseInstant(Number(option.dataset.suggestion));
});
$('go-now').addEventListener('click', () => chooseInstant(Math.ceil(Date.now() / (15 * MINUTE)) * 15 * MINUTE, true));
$('meeting-title').addEventListener('input', e => { state.title = e.target.value.slice(0, 100); persist(); });
$('meeting-location').addEventListener('input', e => { state.location = e.target.value.slice(0, 300); persist(); });
$('add-location').addEventListener('click', () => openPicker());
$('save-group').addEventListener('click', openSaveGroup);
$('open-groups').addEventListener('click', openGroups);
$('open-guide').addEventListener('click', openGuide);
$('open-about').addEventListener('click', () => openModal('Open source. Open to everyone.', `<p>Commonhour is free software, released under the MIT License. You can use, copy, modify, and host it, including commercially, while preserving the copyright and license notice.</p><div class="guide-section"><h3>Made by Chidera Emmanuel Okpala</h3><p>Copyright © 2026 Chidera Emmanuel Okpala. The full license, source code, contribution guide, and deployment instructions are included in the project package.</p></div><div class="guide-section"><h3>No data collection</h3><p>This version makes no requests to analytics services, advertising networks, or calendar providers. Hosting providers may keep their own access logs.</p></div>`, 'about'));
$('share-plan').addEventListener('click', openShare);
$('download-calendar').addEventListener('click', () => {
  const instant = selectedInstant(); if (instant === null) return;
  download(calendarFile(state, instant), 'commonhour-meeting.ics', 'text/calendar;charset=utf-8');
  notify('Event downloaded. Open it in your calendar to add it.');
});
$('copy-summary').addEventListener('click', async () => {
  const instant = selectedInstant(); if (instant === null) return;
  const value = meetingText(state, instant);
  if (await copyText(value)) notify('Meeting details copied.');
  else {
    openModal('Copy meeting details', `<p>Select the text below and copy it.</p><textarea class="share-link" id="manual-copy" readonly rows="10">${esc(value)}</textarea>`, 'manual-copy');
    $('manual-copy').select();
  }
});
$('close-modal').addEventListener('click', closeModal);
modal.addEventListener('click', e => {
  if (e.target === modal) { const r = modal.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeModal(); }
});
modal.addEventListener('input', e => {
  if (e.target.id === 'zone-search') {
    clearTimeout(pickerTimer); pickerTimer = setTimeout(() => { if (modalMode === 'picker' && $('zone-results')) updatePicker(e.target.value); }, 80);
  }
});
modal.addEventListener('change', e => {
  if (e.target.id === 'anytime') {
    $('hours-row').hidden = e.target.checked;
    $('work-start').disabled = e.target.checked;
    $('work-end').disabled = e.target.checked;
  }
});
modal.addEventListener('submit', e => {
  if (e.target.id === 'person-form') savePerson(e);
  if (e.target.id === 'group-form') saveGroup(e);
});
modal.addEventListener('click', async e => {
  const button = e.target.closest('button'); if (!button) return;
  if (button.dataset.zone) { chosenZone = { zone: button.dataset.zone, label: button.dataset.label }; renderPersonForm(); }
  const action = button.dataset.action;
  if (action === 'cancel') closeModal();
  if (action === 'change-zone') renderPicker();
  if (action === 'remove-person') removePerson();
  if (action === 'back-groups') openGroups();
  if (button.dataset.loadGroup) loadGroup(button.dataset.loadGroup);
  if (button.dataset.deleteGroup) askDeleteGroup(button.dataset.deleteGroup);
  if (button.dataset.confirmDelete) {
    const next = groups.filter(g => g.id !== button.dataset.confirmDelete);
    if (!writeGroups(next)) return notify('This browser could not delete the saved group.');
    groups = next; updateCounts(); openGroups(); notify('Saved group deleted.');
  }
  if (button.id === 'copy-link') {
    if (await copyText($('share-link').value)) { button.textContent = 'Link copied'; notify('Plan link copied.'); }
    else { $('share-link').select(); notify('Select and copy the link above.'); }
  }
  if (button.id === 'native-share') {
    try { await navigator.share({ title: state.title || 'Commonhour meeting', text: 'Here is our meeting time in every location.', url: $('share-link').value }); }
    catch (error) { if (error.name !== 'AbortError') notify('Sharing is unavailable. Copy the plan link instead.'); }
  }
});

function updateConnection() {
  $('connection-label').textContent = navigator.onLine ? 'Free & open source' : 'You’re offline';
}
window.addEventListener('online', updateConnection); window.addEventListener('offline', updateConnection);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; $('install-app').hidden = false; });
$('install-app').addEventListener('click', async () => {
  if (!installPrompt) return; await installPrompt.prompt(); installPrompt = null; $('install-app').hidden = true;
});
window.addEventListener('appinstalled', () => { installPrompt = null; $('install-app').hidden = true; });

// Browser-native agent access is optional and never required by the UI.
function registerTools() {
  if (!document.modelContext?.registerTool) return;
  const lifecycle = new AbortController();
  const tools = [
    { name: 'get_meeting_plan', title: 'Read meeting plan',
      description: 'Read the currently visible meeting and suggested times. Does not send invitations or read calendars.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute() { return { plan: validatePlan(state), selectedInstant: selectedInstant(),
        suggestions: options.map(s => ({ instant: new Date(s.instant).toISOString(), available: s.available, total: s.total })) }; } },
    { name: 'set_meeting_time', title: 'Set meeting time',
      description: 'Change the visible planner date and local start time in its reference zone. Stages a plan only; does not create a calendar event.',
      inputSchema: { type: 'object', properties: { date: { type: 'string' }, time: { type: 'string' }, occurrence: { type: 'integer', enum: [0, 1] } }, required: ['date', 'time'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || !validDate(input.date) || !Number.isInteger(parseTime(input.time)) || (input.occurrence !== undefined && ![0, 1].includes(input.occurrence))) throw new Error('Provide a valid date, HH:MM time, and optional occurrence 0 or 1.');
        const candidate = validatePlan({ ...state, date: input.date, minute: parseTime(input.time), occurrence: input.occurrence || 0 });
        const hits = wallInstants(candidate.date, candidate.minute, candidate.anchorZone);
        if (!hits.length || !hits[candidate.occurrence]) throw new Error('That local clock time or occurrence does not exist.');
        state = candidate; render(); return { date: state.date, time: timeValue(state.minute), instant: new Date(selectedInstant()).toISOString() };
      } },
  ];
  for (const tool of tools) {
    try { Promise.resolve(document.modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); }
    catch { /* Unsupported agent APIs do not affect the application. */ }
  }
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}

calculate();
if (fresh && options.length) {
  const p = localParts(options[0].instant, state.anchorZone); state.minute = p.minute;
  state.occurrence = wallInstants(p.date, p.minute, state.anchorZone).indexOf(options[0].instant) > 0 ? 1 : 0;
}
render(false); updateConnection(); registerTools();
if (sharedMessage || loadedShare) {
  $('app-notice').textContent = sharedMessage || 'Shared plan opened. Changes you make are saved as your own copy in this browser.';
  $('app-notice').hidden = false;
}
// Remove a loaded snapshot from the address bar so reloads restore subsequent edits.
if (loadedShare) history.replaceState(null, '', `${location.pathname}${location.search}`);
setInterval(() => { if (!document.hidden) updateLiveClock(); }, 30_000);
if ('serviceWorker' in navigator && ['https:', 'http:'].includes(location.protocol)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {
    // Planning works online even if this browser disallows an offline cache.
  }));
}
