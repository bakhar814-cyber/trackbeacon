// ===========================================================================
// Provider contracts. Every AI capability is expressed as a small interface so
// concrete providers (OpenAI, Gemini, ElevenLabs, Runway, ...) are swappable.
// Each call returns a `cost` estimate in micro-USD so the cost ledger stays
// accurate regardless of provider.
// ===========================================================================

export interface ProviderResult<T> {
  data: T;
  provider: string;
  costMicroUsd: number;
  cached?: boolean;
  meta?: Record<string, unknown>;
}

// ---- LLM (story planning, scripts, SEO, scoring, optimization) ----
export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
export interface LlmGenerateOptions {
  system?: string;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  // When set, the provider must return strictly parseable JSON matching the hint.
  json?: boolean;
}
export interface LlmProvider {
  readonly name: string;
  generate(opts: LlmGenerateOptions): Promise<ProviderResult<string>>;
}

// ---- Image (characters, backgrounds, props, action, thumbnails) ----
export interface ImageRequest {
  prompt: string;
  // Reference images for character/style consistency (URLs or data URIs).
  refs?: string[];
  width?: number;
  height?: number;
  // Stable seed → deterministic re-generation of the same design.
  seed?: number;
  negativePrompt?: string;
}
export interface ImageResult {
  url: string;
  width: number;
  height: number;
  seed?: number;
}
export interface ImageProvider {
  readonly name: string;
  generate(req: ImageRequest): Promise<ProviderResult<ImageResult>>;
}

// ---- Voice ----
export interface VoiceRequest {
  text: string;
  // Provider-specific voice id; resolved from a Character.voiceProfile.
  voiceId: string;
  emotion?: string;
  speed?: number;
}
export interface VoiceResult {
  url: string;
  durationSec: number;
}
export interface VoiceProvider {
  readonly name: string;
  listVoices?(): Promise<Array<{ id: string; label: string }>>;
  synthesize(req: VoiceRequest): Promise<ProviderResult<VoiceResult>>;
}

// ---- Music & SFX ----
export interface MusicRequest {
  mood: string;
  durationSec: number;
  kind: "bgm" | "ambient" | "action" | "emotional" | "sfx";
  prompt?: string;
}
export interface AudioResult {
  url: string;
  durationSec: number;
}
export interface MusicProvider {
  readonly name: string;
  generate(req: MusicRequest): Promise<ProviderResult<AudioResult>>;
}

// ---- Animation (image -> moving clip) ----
export interface AnimationRequest {
  imageUrl: string;
  // Motion directives: camera move, character motion, expression, transition.
  motion: {
    camera?: "pan-left" | "pan-right" | "zoom-in" | "zoom-out" | "static";
    lipSyncAudioUrl?: string;
    action?: string;
    transition?: string;
  };
  durationSec: number;
}
export interface ClipResult {
  url: string;
  durationSec: number;
}
export interface AnimationProvider {
  readonly name: string;
  animate(req: AnimationRequest): Promise<ProviderResult<ClipResult>>;
}

// ---- Video assembly (clips + audio + captions -> final mp4) ----
export interface VideoTrackScene {
  clipUrl: string;
  voiceUrls: string[];
  musicUrl?: string;
  captions?: Array<{ start: number; end: number; text: string }>;
  durationSec: number;
}
export interface VideoAssembleRequest {
  scenes: VideoTrackScene[];
  introUrl?: string;
  outroUrl?: string;
  logoUrl?: string;
  title: string;
}
export interface VideoResult {
  url: string;
  durationSec: number;
}
export interface VideoProvider {
  readonly name: string;
  assemble(req: VideoAssembleRequest): Promise<ProviderResult<VideoResult>>;
}
