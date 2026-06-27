// Central, typed access to environment configuration.
// Everything reads config through here so providers can be swapped via env only.

function str(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}
function num(key: string, fallback: number): number {
  const v = process.env[key];
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export type PipelineMode = "mock" | "live";

export const config = {
  env: str("NODE_ENV", "development"),
  appBaseUrl: str("APP_BASE_URL", "http://localhost:3000"),
  cronSecret: str("CRON_SECRET", "dev-secret"),
  mode: (str("PIPELINE_MODE", "mock") as PipelineMode),

  series: {
    title: str("SERIES_TITLE", "The Adventures of Pip & Bramble"),
    episodesPerDay: num("EPISODES_PER_DAY", 2),
    targetSeconds: num("TARGET_EPISODE_SECONDS", 900),
  },

  providers: {
    llm: str("LLM_PROVIDER", "mock"),
    image: str("IMAGE_PROVIDER", "mock"),
    voice: str("VOICE_PROVIDER", "mock"),
    music: str("MUSIC_PROVIDER", "mock"),
    animation: str("ANIMATION_PROVIDER", "mock"),
    video: str("VIDEO_PROVIDER", "mock"),
  },

  keys: {
    anthropic: str("ANTHROPIC_API_KEY"),
    anthropicModel: str("ANTHROPIC_MODEL", "claude-opus-4-8"),
    openai: str("OPENAI_API_KEY"),
    openaiModel: str("OPENAI_MODEL", "gpt-4o"),
    gemini: str("GEMINI_API_KEY"),
    geminiModel: str("GEMINI_MODEL", "gemini-1.5-pro"),
    stability: str("STABILITY_API_KEY"),
    flux: str("FLUX_API_KEY"),
    elevenlabs: str("ELEVENLABS_API_KEY"),
    // Default voice used for the narrator + any character without a real provider
    // voice id mapped yet. Defaults to a public ElevenLabs voice ("Rachel").
    elevenlabsDefaultVoice: str("ELEVENLABS_DEFAULT_VOICE_ID", "21m00Tcm4TlvDq8ikWAM"),
    googleTts: str("GOOGLE_TTS_API_KEY"),
    suno: str("SUNO_API_KEY"),
    runway: str("RUNWAY_API_KEY"),
    kling: str("KLING_API_KEY"),
    shotstack: str("SHOTSTACK_API_KEY"),
  },

  storage: {
    driver: str("STORAGE_DRIVER", "local"),
    localDir: str("STORAGE_LOCAL_DIR", "./storage"),
    s3Endpoint: str("S3_ENDPOINT"),
    s3Region: str("S3_REGION", "auto"),
    s3Bucket: str("S3_BUCKET", "toonfactory"),
    s3AccessKeyId: str("S3_ACCESS_KEY_ID"),
    s3SecretAccessKey: str("S3_SECRET_ACCESS_KEY"),
    s3PublicBaseUrl: str("S3_PUBLIC_BASE_URL"),
  },

  youtube: {
    clientId: str("YOUTUBE_CLIENT_ID"),
    clientSecret: str("YOUTUBE_CLIENT_SECRET"),
    refreshToken: str("YOUTUBE_REFRESH_TOKEN"),
    channelId: str("YOUTUBE_CHANNEL_ID"),
  },
} as const;

// In mock mode (or when a provider has no key) we transparently fall back to a
// deterministic mock implementation. This keeps the whole system runnable with
// zero credentials while remaining production-ready when keys are supplied.
export function effectiveProvider(
  kind: keyof typeof config.providers,
  hasKey: boolean,
): string {
  if (config.mode === "mock") return "mock";
  const chosen = config.providers[kind];
  if (!hasKey && chosen !== "mock") return "mock";
  return chosen;
}
