# Contributing to Commonhour

Commonhour helps people agree on a meeting time without accounts or tracking.
Keep it fast, accessible, and easy to host as a static website.

1. Fork the repository and create a branch for your change.
2. Run `npm start` to preview the app. Node 20 or newer is sufficient; there are no dependencies to install.
3. Make the smallest complete change. Use textContent or HTML escaping for any user-controlled text.
4. Run `npm test` and `npm run build`.
5. Check keyboard navigation, an iPhone-sized viewport, an Android-sized viewport, and a desktop. Also check 200% text enlargement and reduced motion.
6. Open a pull request explaining the problem, the resulting behavior, and your checks.

For scheduling changes, include a regression case involving clock changes,
fractional-hour offsets, overnight shifts, or a meeting that crosses midnight.
Use UTC instants internally, not fixed offsets such as UTC+1 for a city.

For an app update, change the version in `package.json` and the cache name in
`public/sw.js`. The new worker waits until existing tabs close; its cache is
installed as a complete set before it can take over. Keep the offline asset list
aligned with the app's imports and icons.

Please do not add analytics, advertising, credentials, external font downloads,
or API requirements to the default app. Larger changes should explain how they
preserve this local-first model.
