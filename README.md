# Commonhour

**A good time. For everyone.**

A complete open-source meeting planner for people in different time zones.
Choose a date, add locations, and compare the entire meeting against each
person's local available hours. Share a plan or download an event for your calendar.

Created by **Chidera Emmanuel Okpala**. Released under the **MIT License**.

## What works

- Search cities, countries, or the IANA time zones supported by your browser.
- Compare up to eight locations, including multiple people in the same city.
- Set local available days and hours, including overnight shifts and full days.
- Choose a 15-, 30-, 45-, 60-, 90-, or 120-minute meeting.
- Move through a real 23-, 24-, or 25-hour clock-change day in 15-minute steps.
- Handle skipped and repeated local times explicitly; keep the same instant when changing the reference time zone.
- Find the best full-duration overlaps. When none exists, compare the closest options rather than claiming everyone is available.
- Share a self-contained link, copy meeting details, or download a standards-based `.ics` calendar event.
- Save up to 20 reusable groups in the current browser.
- Use 12-hour or 24-hour displays.
- Work offline after the app's first successful online cache installation.
- Install as a home-screen web app in supported browsers.
- Use responsive desktop, tablet, phone, and compact browser layouts.

The planner opens directly into its working interface. It does not require an
account, a backend, an API key, a database, or any third-party runtime library.
All assets are included. There are no remote fonts or image requests.

## Publish on GitHub

1. Extract `Commonhour-Source.zip`.
2. Open the `commonhour` folder. This is the repository root.
3. Create a new repository named `commonhour` on GitHub. Choose **Public** to make your open-source project visible.
4. Upload everything **inside** `commonhour`, preserving the folders. Do not upload the ZIP itself as your source code. The repository root should contain `README.md`, `LICENSE`, `package.json`, `netlify.toml`, and the `public`, `scripts`, and `tests` folders.
5. Commit the files. The MIT license is already included.

With Git installed, you can instead initialize the extracted folder and push it
to the repository you created. The ZIP is supplied without machine-specific
Git metadata so it can be uploaded to any account.

## Host on Netlify from GitHub

1. In Netlify, choose **Add new project → Import an existing project** (wording may vary slightly).
2. Choose GitHub and select your new `commonhour` repository.
3. Leave the **base directory** empty. The `netlify.toml` file supplies:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Deploy. Open the Netlify URL after the build finishes.
5. Set a project name or custom domain if desired. Future commits can redeploy automatically.

Netlify's hosted HTTPS URL enables clipboard sharing, installation where
supported, and the offline service worker. No environment variables are needed.

## Host on Netlify without GitHub

Use the separate **`Commonhour-Netlify.zip`** for manual deployment. It contains
only the ready-to-host website, with `index.html` directly at the archive root.
Extract it and upload the resulting folder through Netlify's manual deploy page
(Netlify Drop). Choose the folder containing `index.html`, `css`, `js`, and `icons`.
If your Netlify interface accepts a ZIP, this is the ZIP to use.

You can also manually deploy the `public` folder from the source package. No
build is necessary for that route. Do not upload the outer source folder as a
manual deploy: its `index.html` is inside `public`.

On an iPhone or iPad, download the ZIP in Files and tap it to extract. Some
mobile browsers make folder upload awkward; importing the GitHub repository is
the most reliable alternative.

## Run locally

Install Node.js 20 or newer, then run these commands inside `commonhour`:

```sh
npm start
```

Open **http://localhost:4173**. Use a second argument to change the port:

```sh
npm start -- 5000
```

There are no dependencies to install. Serve the app over HTTP or HTTPS; opening
`index.html` as a `file://` URL will not reliably load JavaScript modules or the
offline worker. A phone can access your computer's local address on the same
network, but offline caching/clipboard access may be restricted on plain HTTP
outside localhost. A deployed HTTPS URL is the full experience.

## Test and build

```sh
npm test
npm run build
```

The build copies `public` into `dist`. That output can be hosted by Netlify,
GitHub Pages, or another static HTTPS host. Assets use relative paths, so a
subdirectory deployment is supported. No SPA rewrite is required; plans use a
URL fragment, and the app has a single HTML route.

## Project structure

| File or folder | Purpose |
| --- | --- |
| `public/index.html` | Semantic application layout and SVG interface icons |
| `public/css/styles.css` | Responsive design, compact layout, contrast and print styles |
| `public/js/app.js` | Interface, forms, scheduling state, and optional browser agent tools |
| `public/js/time.js` | IANA time-zone conversion, full-duration checks, and ranking |
| `public/js/zones.js` | Friendly city search plus browser-supported time zones |
| `public/js/storage.js` | Validated local persistence and Unicode-safe shared links |
| `public/js/export.js` | Text copying and RFC 5545 calendar-file generation |
| `public/sw.js` | Versioned offline cache |
| `public/manifest.webmanifest` | Installable web-app metadata |
| `public/icons/` | Included SVG favicon and PNG installation icons |
| `public/_headers` | Netlify security and cache headers |
| `scripts/` | Dependency-free local server and static build |
| `tests/` | Scheduling, validation, sharing, and calendar regression tests |
| `netlify.toml` | Git-connected deployment configuration |
| `CONTRIBUTING.md` | Contributor workflow |
| `LICENSE` | MIT open-source license |

## Scheduling rules

Each location has a supported IANA zone such as `Africa/Lagos`, not a fixed UTC
offset. The engine converts wall-clock inputs into UTC instants using `Intl`.
Every minute of the selected duration is checked against each participant's
available days and hours. The end is exclusive: a 16:30–17:00 meeting fits a
09:00–17:00 window; a 16:45–17:15 meeting does not.

For overnight availability (for example, Monday 22:00–06:00), Tuesday 02:00
belongs to Monday's shift. Outside available hours, 22:00–07:00 is marked
late / early. A person's explicit overnight availability takes precedence over
that label.

Suggested starts are on 15-minute intervals within the reference location's
selected date. Past starts are excluded. Ranking prioritizes the number of
people whose entire meeting fits, then minimizes unavailable minutes, quiet
hours, days off, and the worst person's unavailable minutes. Ties favour a
start near 14:00 in the reference zone. Three separated options are shown.
This is a transparent heuristic, not an AI prediction.

## Privacy and limits

- Plans and groups use localStorage. They belong to this browser/device, not a cloud account. Private browsing or blocked storage can prevent persistence; the app reports that and remains usable.
- A shared URL contains the plan after `#plan=`. This fragment is not included in the normal HTTP request to the host, but anyone who receives the full link can read its contents. Shared plans are independent snapshots, not live collaborative records.
- The app makes no analytics, advertising, or external API requests. The hosting provider may maintain access logs.
- Downloads do not send invitations. Open the event in your calendar, then invite people there.
- The app compares entered availability. It cannot see actual calendars, holidays, leave, or last-minute conflicts.
- Dates from 2000 through 2100 are supported. A device's browser/OS time-zone data determines clock-change rules; keep it up to date. Future government changes may not be known yet.
- The interface is in English; city names, time zones, dates, and Unicode person/group names are supported worldwide.
- Offline use begins only after a complete successful cache installation on a supported browser. Storage can be evicted by a device. Reconnect if needed.
- Small viewport support is a browser layout, not a native watchOS/Wear OS application. A watch needs a browser with modern JavaScript and `Intl`; actual device capabilities vary.
- Optional WebMCP tools are feature-detected. Their absence never blocks the app.

## Why this problem?

Microsoft Research's CHI 2023 study of 20 million meetings found that meetings
across time zones are associated with challenging early and late hours. This
project focuses on making those trade-offs visible before someone schedules.

Research: https://www.microsoft.com/en-us/research/publication/challenging-but-connective-large-scale-characteristics-of-synchronous-collaboration-across-time-zones/

Netlify configuration: https://docs.netlify.com/build/configure-builds/overview/

JavaScript time-zone formatting: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat

## License

MIT © 2026 Chidera Emmanuel Okpala. See `LICENSE`.

## Work with the creator

Commonhour is free and open source under the MIT License. For a separately scoped custom web application, website improvement or development task, see [Chidera Emmanuel Okpala’s portfolio](https://my-portfolio-ce.netlify.app) and [development services](https://my-portfolio-ce.netlify.app/services.html). Custom development is quoted separately and is not required to use or contribute to Commonhour.
