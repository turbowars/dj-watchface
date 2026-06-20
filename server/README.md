# Live data via the Google Health API

This local server connects the web watchface preview to **real** Fitbit /
Pixel Watch data through the [Google Health API](https://developers.google.com/health)
(the successor to the Fitbit Web API).

> **Important:** The Google Health API is a *cloud data* API — it reads health
> metrics into an app. It does **not** render UI on the watch. So this powers the
> **web** watchface (the preview), not an on-device face for a retail Versa 4.

## What you need to provide

The API requires **your own** Google Cloud project and OAuth credentials —
these can't be scaffolded for you.

### 1. Create OAuth credentials
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create (or pick) a project.
3. Enable the **Google Health API** for the project.
4. Configure the **OAuth consent screen** (External; add yourself as a test user).
5. Create an **OAuth 2.0 Client ID** of type **Web application**.
6. Add an **Authorized redirect URI**: `http://localhost:3000/auth/callback`
7. Copy the **Client ID** and **Client secret**.

See Google's own walkthrough: <https://developers.google.com/health/setup>

### 2. Configure the server
```bash
cd server
cp .env.example .env      # then paste your Client ID / secret into .env
npm install
npm start
```

### 3. Connect
1. Open <http://localhost:3000>
2. Click **Connect Google Health** and approve the requested scopes.
3. The watchface switches from *simulated* to *live* data and refreshes every 30s.

## OAuth scopes requested
- `…/auth/googlehealth.activity_and_fitness.readonly` — steps / activity (read)
- `…/auth/googlehealth.health_metrics_and_measurements` — heart rate & metrics

Full scope list: <https://developers.google.com/health/scopes>

## Caveats / TODO
- **Single-user dev server.** Tokens live in memory; restarting drops them.
  For anything real, persist tokens per-user and add CSRF `state` to the OAuth flow.
- **Verify data-type endpoints.** `server.js` reads from
  `/v4/users/me/dataTypes/{steps,heart-rate}/dataPoints`. Confirm the exact
  data-type identifiers and query params against the API reference for the data
  types you enable — the response extractors (`extractSteps` / `extractHeartRate`)
  are written defensively but may need tweaking. The endpoint returns a `raw`
  field in `/api/today` to help you inspect the real shape.
