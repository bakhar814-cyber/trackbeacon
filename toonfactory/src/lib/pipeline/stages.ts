// Canonical pipeline definition shared by the orchestrator, the queue worker,
// the REST API, and the dashboard. The order here IS the production workflow:
//
// Story Planning → Script → Storyboard → Images → Animation → Voice → Music →
// Video Edit → Thumbnail → SEO → Quality Check → Upload → Analytics →
// Continuous Improvement.

export const PIPELINE_STAGES = [
  "plan",        // Story planning: pick the next episode premise from canon
  "script",      // Title, hook, outline, scenes, narration, dialogue, cliffhanger
  "storyboard",  // Per-scene image prompts derived from the script
  "images",      // Generate character/background/prop/action frames
  "animation",   // Convert frames into moving clips (camera, motion, lipsync)
  "voice",       // Synthesize per-character dialogue + narration
  "music",       // Background music, ambient, action and emotional cues
  "edit",        // Assemble clips + audio + captions + intro/outro into mp4
  "thumbnail",   // Generate + score multiple thumbnails, pick the best
  "seo",         // Title, description, tags, chapters, keywords, hashtags
  "qc",          // Automated quality + policy (kids-safety) check
  "upload",      // Publish/schedule to YouTube, playlists, end screens, cards
] as const;

export type StageName = (typeof PIPELINE_STAGES)[number];

// Episode status each stage drives the episode into while running.
export const STAGE_STATUS: Record<StageName, string> = {
  plan: "PLANNED",
  script: "WRITING",
  storyboard: "STORYBOARD",
  images: "ASSETS",
  animation: "ANIMATION",
  voice: "AUDIO",
  music: "AUDIO",
  edit: "EDITING",
  thumbnail: "EDITING",
  seo: "REVIEW",
  qc: "REVIEW",
  upload: "SCHEDULED",
};

export const STAGE_LABELS: Record<StageName, string> = {
  plan: "Story Planning",
  script: "Script Writing",
  storyboard: "Storyboard",
  images: "Image Generation",
  animation: "Animation",
  voice: "Voice Generation",
  music: "Music & SFX",
  edit: "Video Editing",
  thumbnail: "Thumbnail",
  seo: "SEO",
  qc: "Quality Check",
  upload: "YouTube Upload",
};
