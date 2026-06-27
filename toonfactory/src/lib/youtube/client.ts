import { config } from "../config";

// Thin YouTube Data API v3 client. In mock mode (or without OAuth credentials)
// it returns deterministic fake ids so the whole pipeline runs offline. In live
// mode it exchanges the refresh token for an access token and performs a
// resumable upload, then sets the thumbnail and metadata.

export interface UploadRequest {
  title: string;
  description: string;
  tags: string[];
  videoUrl: string;
  thumbnailUrl?: string;
  categoryId?: string; // 1 = Film & Animation
  madeForKids?: boolean;
  publishAt?: Date; // schedule (privacyStatus=private + publishAt)
}

export interface UploadResult {
  youtubeId: string;
  status: "scheduled" | "published";
  mock: boolean;
}

function isLive(): boolean {
  return (
    config.mode === "live" &&
    !!config.youtube.clientId &&
    !!config.youtube.clientSecret &&
    !!config.youtube.refreshToken
  );
}

async function accessToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: config.youtube.clientId,
    client_secret: config.youtube.clientSecret,
    refresh_token: config.youtube.refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`YouTube token exchange failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export async function uploadVideo(req: UploadRequest): Promise<UploadResult> {
  if (!isLive()) {
    const id = `mock_${Buffer.from(req.title).toString("hex").slice(0, 11)}`;
    return { youtubeId: id, status: req.publishAt ? "scheduled" : "published", mock: true };
  }

  const token = await accessToken();

  // 1) Create the video resource with metadata (resumable upload init).
  const meta = {
    snippet: {
      title: req.title.slice(0, 100),
      description: req.description.slice(0, 5000),
      tags: req.tags.slice(0, 30),
      categoryId: req.categoryId ?? "1",
    },
    status: {
      privacyStatus: req.publishAt ? "private" : "public",
      publishAt: req.publishAt?.toISOString(),
      selfDeclaredMadeForKids: req.madeForKids ?? true,
    },
  };

  const init = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/*",
      },
      body: JSON.stringify(meta),
    },
  );
  if (!init.ok) throw new Error(`YouTube init failed: ${init.status}`);
  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube did not return an upload URL");

  // 2) Stream the video bytes to the resumable session.
  const video = await fetch(req.videoUrl);
  const bytes = Buffer.from(await video.arrayBuffer());
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/*", "Content-Length": String(bytes.length) },
    body: bytes,
  });
  if (!put.ok) throw new Error(`YouTube upload failed: ${put.status}`);
  const created = (await put.json()) as { id: string };

  // 3) Thumbnail (best-effort).
  if (req.thumbnailUrl) {
    try {
      const thumb = await fetch(req.thumbnailUrl);
      const tb = Buffer.from(await thumb.arrayBuffer());
      await fetch(
        `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${created.id}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/png" },
          body: tb,
        },
      );
    } catch {
      // non-fatal
    }
  }

  return {
    youtubeId: created.id,
    status: req.publishAt ? "scheduled" : "published",
    mock: false,
  };
}
