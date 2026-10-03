# Validation record — 3 October 2026

The following checks passed for the included version:

- **22 Node regression tests** covering clock gaps/repetitions, 23-/25-hour days, a half-hour clock change, a skipped date, fractional offsets, international date differences, overnight shifts, minute-level availability, full meeting duration, date-range boundaries, ranking, Unicode sharing, malformed data, and calendar-file escaping/folding.
- **1,254 time-zone round trips:** 14:00 converted to an instant and back for all 418 zones available in the test runtime, on January, July, and November 2026 dates.
- **Local HTTP checks:** the home page, modules, stylesheet, manifest, installation icons, and worker served successfully. JavaScript used a valid JavaScript MIME type. The local server also accepted the forwarded host/port flags.
- **Offline-worker logic checks using mocked browser APIs:** the complete cache asset list exists; HTML and JavaScript return from the cache during a simulated network failure; query strings normalize correctly; older Commonhour caches are removed while unrelated caches are preserved; unrelated origins are not intercepted.
- **Static checks:** all local imports and HTML assets exist; HTML IDs are unique; labels and SVG references point to existing elements; installation icons exist; CSS block structure and responsive/reduced-motion rules are present; JavaScript syntax and Netlify configuration passed.
- **Build:** `npm run build` produced the complete static website.

An eight-location, two-hour full-day evaluation took about 113 ms in the Node
test environment. This is an engine measurement, not a phone/browser benchmark.
Moving the time slider reuses the computed schedule instead of recalculating it.

## Checks that remain unverified

The available browser preview was blocked by this environment. Consequently,
rendered visual layout, actual touch/keyboard interactions, clipboard/download
behavior, real service-worker installation, browser WebMCP registration, and
real iPhone/Android/tablet/watch testing could not be completed here.

Before announcing the public site, open the deployed HTTPS URL and check:

1. Add, edit, and remove a location; include an overnight shift.
2. Change the date, duration, reference zone, and time format. Move the slider.
3. Share a link into a second tab/device and confirm the date and local times.
4. Download the event and open it in Apple Calendar, Google Calendar, or Outlook.
5. Save/load/delete a group, then reload the page to check persistence.
6. Install/cache the app online, then reopen it offline.
7. Check narrow phone widths, landscape, tablet/desktop widths, keyboard-only navigation, 200% text enlargement, and reduced motion.
8. For a watch-sized browser, check the compact layout and whether that device supports the required JavaScript and `Intl` features.

The app implements these features, but these checks should not be treated as
completed device testing.
