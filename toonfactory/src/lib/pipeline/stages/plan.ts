import { prisma } from "../../db";
import { generateJson } from "../../ai";
import {
  buildContinuityContext,
  continuityToPrompt,
  getOrCreateSeries,
} from "../../story/manager";
import type { StageContext } from "../orchestrator";

interface Premise {
  workingTitle: string;
  premise: string;
  theme: string;
  lesson: string;
}

// STORY PLANNING — read the canon and decide what the next episode is about,
// continuing the series without contradicting anything established.
export async function runPlan(ctx: StageContext): Promise<Record<string, unknown>> {
  const series = await getOrCreateSeries();
  const continuity = await buildContinuityContext(series.id);

  const premise = await generateJson<Premise>({
    episodeId: ctx.episodeId,
    system:
      "You are the showrunner of a wholesome animated kids' series. You plan the next episode so it continues the ongoing story like a real TV series, respects every world rule, and teaches one gentle age-appropriate lesson. Reply ONLY with JSON.",
    user: `${continuityToPrompt(continuity)}

Plan episode #${continuity.nextNumber}. Return JSON:
{"workingTitle": string, "premise": string (3-4 sentences continuing the story and paying off the previous cliffhanger), "theme": string, "lesson": string}`,
  });

  await prisma.episode.update({
    where: { id: ctx.episodeId },
    data: {
      title: premise.workingTitle,
      script: {
        premise: premise.premise,
        theme: premise.theme,
        lesson: premise.lesson,
      } as object,
    },
  });

  return { workingTitle: premise.workingTitle, theme: premise.theme };
}
