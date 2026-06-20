// DJ Watchface — local OAuth + Google Health API data-proxy server.
//
// Flow:
//   1. Browser hits  /            -> serves the watchface preview page.
//   2. Browser hits  /auth/login  -> redirects to Google's OAuth consent screen.
//   3. Google calls  /auth/callback?code=...  -> we exchange the code for tokens.
//   4. Browser polls /api/today   -> we call the Google Health API and return
//                                     the user's steps + latest heart rate.
//
// This is a single-user DEV server: tokens are kept in memory, not a database.
// Do not deploy as-is.

import express from "express";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI = "http://localhost:3000/auth/callback",
  PORT = 3000,
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error(
    "\n  Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.\n" +
      "  Copy server/.env.example to server/.env and fill it in.\n"
  );
  process.exit(1);
}

// --- OAuth + API constants -------------------------------------------------
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const HEALTH_BASE = "https://health.googleapis.com/v4/users/me";

// Read-only access to activity & fitness (steps) and health metrics (heart rate).
const SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements",
];

// In-memory token store (single user, dev only).
let tokens = null; // { access_token, refresh_token, expires_at }

// --- App -------------------------------------------------------------------
const app = express();

// Serve the static preview (../preview) as the front-end.
app.use(express.static(join(__dirname, "..", "preview")));

// Step 2: kick off the OAuth flow.
app.get("/auth/login", (req, res) => {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline", // request a refresh token
    prompt: "consent",
  });
  res.redirect(`${AUTH_URL}?${params.toString()}`);
});

// Step 3: exchange the authorization code for tokens.
app.get("/auth/callback", async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.status(400).send(`OAuth error: ${error}`);
  if (!code) return res.status(400).send("Missing authorization code.");

  try {
    const resp = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(JSON.stringify(data));

    tokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in - 60) * 1000,
    };
    res.redirect("/?connected=1");
  } catch (e) {
    res.status(500).send(`Token exchange failed: ${e.message}`);
  }
});

// Refresh the access token when it's near expiry.
async function getAccessToken() {
  if (!tokens) throw new Error("not_authenticated");
  if (Date.now() < tokens.expires_at) return tokens.access_token;
  if (!tokens.refresh_token) throw new Error("not_authenticated");

  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(JSON.stringify(data));
  tokens.access_token = data.access_token;
  tokens.expires_at = Date.now() + (data.expires_in - 60) * 1000;
  return tokens.access_token;
}

async function healthGet(path, token) {
  const resp = await fetch(`${HEALTH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`Health API ${resp.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

// Step 4: return today's steps + latest heart rate for the preview.
//
// NOTE: The exact dataPoints path/params for each data type should be confirmed
// against the Google Health API reference for your enabled data types. The
// endpoint shapes below follow the documented /dataPoints pattern; adjust the
// `path` strings if the reference uses different data-type identifiers.
app.get("/api/today", async (req, res) => {
  try {
    const token = await getAccessToken();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const [stepsResp, hrResp] = await Promise.allSettled([
      healthGet(
        `/dataTypes/steps/dataPoints?startDate=${today}&endDate=${today}`,
        token
      ),
      healthGet(
        `/dataTypes/heart-rate/dataPoints?startDate=${today}&endDate=${today}`,
        token
      ),
    ]);

    res.json({
      connected: true,
      date: today,
      steps: extractSteps(stepsResp),
      heartRate: extractHeartRate(hrResp),
      raw: { steps: stepsResp, heartRate: hrResp }, // handy while wiring up
    });
  } catch (e) {
    if (e.message === "not_authenticated") {
      return res.status(401).json({ connected: false });
    }
    res.status(502).json({ connected: true, error: e.message });
  }
});

// Defensive extractors — tolerate shape differences in the API response.
function extractSteps(settled) {
  if (settled.status !== "fulfilled") return null;
  const pts = settled.value?.dataPoints || settled.value?.points || [];
  return pts.reduce((sum, p) => sum + (p.value?.intVal ?? p.steps ?? 0), 0) || null;
}

function extractHeartRate(settled) {
  if (settled.status !== "fulfilled") return null;
  const pts = settled.value?.dataPoints || settled.value?.points || [];
  const last = pts[pts.length - 1];
  return last ? (last.value?.intVal ?? last.bpm ?? null) : null;
}

app.listen(PORT, () => {
  console.log(`\n  DJ Watchface server running:  http://localhost:${PORT}`);
  console.log(`  Connect your Fitbit/Google account:  http://localhost:${PORT}/auth/login\n`);
});
