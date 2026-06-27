// A lightweight, deterministic CTR predictor for thumbnails. It rewards the
// traits that drive click-through on kids content: a big emotional face, bright
// high-contrast colors, and large readable text. In live mode this can be
// swapped for/augmented by an LLM vision judge; the score contract is identical.

export interface ThumbScore {
  score: number; // 0..100
  detail: {
    emotion: number;
    color: number;
    text: number;
    subject: number;
    novelty: number;
  };
}

function has(prompt: string, words: string[]): boolean {
  const p = prompt.toLowerCase();
  return words.some((w) => p.includes(w));
}

export function scoreThumbnail(prompt: string, seed: number): ThumbScore {
  const emotion = has(prompt, ["surpris", "happy", "excited", "wow", "shock", "smil", "gasp"]) ? 92 : 60;
  const color = has(prompt, ["bright", "vivid", "vibrant", "neon", "high-contrast", "glow"]) ? 90 : 65;
  const text = has(prompt, ["big text", "bold text", "title", "1-3 words", "large text"]) ? 88 : 55;
  const subject = has(prompt, ["close-up", "face", "character", "portrait"]) ? 90 : 62;
  // Small deterministic jitter so equally-strong candidates still rank.
  const novelty = 60 + (seed % 35);

  const score =
    emotion * 0.3 + color * 0.25 + text * 0.2 + subject * 0.15 + novelty * 0.1;

  return {
    score: Math.round(score * 10) / 10,
    detail: { emotion, color, text, subject, novelty },
  };
}
