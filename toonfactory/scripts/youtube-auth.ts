// One-time helper to mint a YouTube refresh token via a local OAuth loopback flow.
//
//   1. Put YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET in .env
//      (Google Cloud → Credentials → OAuth client ID → "Desktop app").
//   2. npm run youtube:auth
//   3. Open the printed URL, sign in with the channel-owner account, allow.
//   4. Copy the printed YOUTUBE_REFRESH_TOKEN into .env.
//
// Run this on your own machine (the callback is http://localhost). On a headless
// box use the OAuth Playground instead (see docs/DEPLOYMENT.md).
import http from "node:http";
import { loadDotenv } from "./_env";

loadDotenv();

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET ?? "";
const PORT = Number(process.env.YOUTUBE_AUTH_PORT ?? 53682);
const REDIRECT = `http://localhost:${PORT}`;

// Scopes: upload covers videos + thumbnails; force-ssl covers playlists, cards,
// end screens, and pinning comments.
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.force-ssl",
].join(" ");

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET in .env");
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline", // required to receive a refresh token
    prompt: "consent", // force a refresh token even on re-auth
  }).toString();

async function exchange(code: string): Promise<void> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });
  const json = (await res.json()) as { refresh_token?: string; error?: string; error_description?: string };
  if (!res.ok || !json.refresh_token) {
    console.error("\nToken exchange failed:", json.error, json.error_description ?? "");
    console.error("No refresh_token returned. Make sure you used prompt=consent and a fresh authorization.");
    process.exit(1);
  }
  console.log("\n✅ Success! Add this line to your .env:\n");
  console.log(`YOUTUBE_REFRESH_TOKEN=${json.refresh_token}\n`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", REDIRECT);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  if (err) {
    res.end(`Authorization denied: ${err}. You can close this tab.`);
    console.error("Authorization denied:", err);
    server.close();
    process.exit(1);
  }
  if (!code) {
    res.end("Waiting for Google authorization…");
    return;
  }
  res.setHeader("content-type", "text/html");
  res.end("<h2>ToonFactory connected ✅</h2><p>You can close this tab and return to the terminal.</p>");
  try {
    await exchange(code);
  } finally {
    server.close();
    process.exit(0);
  }
});

server.listen(PORT, () => {
  console.log("ToonFactory — YouTube OAuth\n");
  console.log("1) Open this URL in your browser and authorize the channel-owner account:\n");
  console.log(authUrl + "\n");
  console.log(`2) Listening for the callback on ${REDIRECT} …`);
});
