# Property Intelligence Dashboard

A small React single-page app for monitoring a property portfolio. Built as a zero-build static site (React + Babel + Leaflet via CDN) so it can be opened from any static file server and hosted directly on GitHub Pages without a build step.

## Layout

- **Left — Portfolio**
  - Scrollable list of all properties in the portfolio
  - Three filters at the top: **Risk**, **Severity**, **Date Added**
  - Click a property to select it
- **Right — Workspace** (two tabs)
  - **Map** — all currently visible (filtered) properties plotted on an OpenStreetMap canvas via Leaflet. Click a marker to select that property; the selected property is highlighted and zoomed to.
  - **Details** — the full intelligence profile for the property selected on the left (estimated value, specs, EPC, flood risk, intelligence notes, etc.)

## Run locally

No `npm install`. Just serve the folder with any static server:

```bash
cd "tries/Property Intelligence Platform"
python3 -m http.server 4173
```

Then open [http://localhost:4173](http://localhost:4173).

## Files

```
.
├── index.html       Loads React, Leaflet and Babel from CDN
├── app.js           All React components (JSX, transpiled in-browser by Babel)
├── properties.js    Mock portfolio data (window.PROPERTIES)
├── styles.css       Design tokens + all component styles
└── README.md
```

## Stack

- React 18 (UMD build) via `unpkg`
- Babel standalone — transpiles JSX in `<script type="text/babel">` at runtime
- Leaflet 1.9 (no API key, OpenStreetMap tiles)
- Plain CSS, Inter from Google Fonts

## Mock data

All portfolio data lives in `properties.js` and is exposed on `window.PROPERTIES`. Replace it (or add a `fetch` in `app.js`) when you connect to a real API.

Each property has:

```js
{
  id, address, city, postcode, lat, lng,
  risk: 'Low' | 'Medium' | 'High',
  severity: 'Low' | 'Medium' | 'High' | 'Critical',
  dateAdded: 'YYYY-MM-DD',
  type, bedrooms, bathrooms, sqft, yearBuilt,
  estimatedValue, lastValuation, epc, floodRisk, notes,
}
```

## Hosting on GitHub Pages

This is a static site — no build step is needed.

1. Push the repo contents to GitHub.
2. In **Settings → Pages**, set the source to **Deploy from a branch → main → / (root)**.
3. The site will be available at `https://<user>.github.io/<repo>/`.

For a production deployment you may want to swap Babel-standalone for a pre-built bundle (Vite/Parcel) so users don't pay the in-browser transpile cost on first load. For demos and prototypes the CDN setup is fast enough and avoids any build pipeline.
