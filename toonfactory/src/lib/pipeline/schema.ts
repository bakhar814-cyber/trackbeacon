// Shared shapes for the narrative payloads produced by the script stage and
// consumed by downstream stages. Kept loose (strings/arrays) so any LLM
// provider can populate them; validated at parse time where it matters.

export interface DialogueLine {
  character: string; // character name (resolved to id at persist time)
  line: string;
  emotion: string;
}

export interface ScriptScene {
  index: number;
  heading: string;
  location: string;
  characters: string[];
  action: string;
  narration: string;
  dialogue: DialogueLine[];
  mood: string;
  durationSec: number;
}

export interface EpisodeScript {
  title: string;
  hook: string;
  outline: string[];
  theme: string;
  lesson: string;
  scenes: ScriptScene[];
  cliffhanger: string;
  nextSetup: string;
  // New canon facts this episode establishes (fed back into the Story Manager).
  canon: Array<{ category: string; summary: string; detail?: string }>;
}

export interface EpisodeSeo {
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
  keywords: string[];
  chapters: Array<{ start: number; label: string }>;
}
