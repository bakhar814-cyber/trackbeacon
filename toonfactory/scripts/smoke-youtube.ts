// Verify YouTube credentials WITHOUT uploading anything.
//
//   npm run smoke:youtube
//
// Exchanges the refresh token for an access token and fetches your channel —
// confirming the client id/secret/refresh token and scopes are wired correctly
// before you run a real production upload.
import { loadDotenv } from "./_env";

loadDotenv();

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET ?? "";
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN ?? "";

async function accessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { access_token?: string; scope?: string };
  if (!json.access_token) throw new Error("No access_token returned");
  if (json.scope) console.log("granted scopes:", json.scope);
  return json.access_token;
}

async function main() {
  const missing = [
    ["YOUTUBE_CLIENT_ID", CLIENT_ID],
    ["YOUTUBE_CLIENT_SECRET", CLIENT_SECRET],
    ["YOUTUBE_REFRESH_TOKEN", REFRESH_TOKEN],
  ].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error("Missing in .env: " + missing.join(", "));
    console.error("Run `npm run youtube:auth` to mint a refresh token.");
    process.exit(1);
  }

  const token = await accessToken();
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`channels.list failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as {
    items?: Array<{
      id: string;
      snippet?: { title?: string };
      statistics?: { subscriberCount?: string; videoCount?: string; viewCount?: string };
    }>;
  };
  const ch = data.items?.[0];
  if (!ch) {
    console.error("Authenticated, but no channel is associated with this account.");
    process.exit(1);
  }

  console.log("\n✅ Connected to YouTube channel:");
  console.log("  title:", ch.snippet?.title);
  console.log("  channelId:", ch.id);
  console.log("  subscribers:", ch.statistics?.subscriberCount ?? "hidden");
  console.log("  videos:", ch.statistics?.videoCount ?? "?");
  console.log("  views:", ch.statistics?.viewCount ?? "?");
  console.log("\nCredentials are valid. ToonFactory can upload to this channel in live mode.");
}

main().catch((e) => {
  console.error("\nSMOKE FAILED ❌");
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
