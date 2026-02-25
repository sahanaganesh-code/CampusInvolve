import { NextResponse } from "next/server";
import { z } from "zod";

const BodySchema = z.object({
  rankedClubs: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      score: z.number(),
      categories: z.array(z.string()).optional().default([]),
      matched: z.array(z.string()).optional().default([]),
      url: z.string().nullable().optional(),
    })
  ),
  lockedIds: z.array(z.string()).optional().default([]), // must-include
  weeklyBudgetHours: z.number().min(1).max(40).default(6),
  maxClubs: z.number().int().min(1).max(10).default(4),
});

function estimateHoursPerWeek(categories: string[]) {
  const cats = categories.map((c) => c.toLowerCase());
  if (cats.some((c) => c.includes("professional") || c.includes("career"))) return 3;
  if (cats.some((c) => c.includes("academic") || c.includes("research"))) return 2.5;
  return 2;
}

function isCareer(categories: string[]) {
  const cats = categories.map((c) => c.toLowerCase());
  return cats.some((c) => c.includes("professional") || c.includes("career"));
}

export async function POST(req: Request) {
  const body = BodySchema.parse(await req.json());

  const candidates = body.rankedClubs.map((c) => {
    const hours = estimateHoursPerWeek(c.categories);
    const utilityPerHour = c.score / hours;
    return { ...c, hours, utilityPerHour };
  });

  const lockedSet = new Set(body.lockedIds);

  const locked = candidates.filter((c) => lockedSet.has(c.id));
  const unlocked = candidates.filter((c) => !lockedSet.has(c.id));

  // Start with locked clubs
  let chosen: any[] = [...locked];
  let used = locked.reduce((sum, c) => sum + c.hours, 0);

  if (chosen.length > body.maxClubs) {
    return NextResponse.json(
      { error: "Too many locked clubs", detail: `Locked ${chosen.length}, max is ${body.maxClubs}` },
      { status: 400 }
    );
  }

  if (used > body.weeklyBudgetHours) {
    return NextResponse.json(
      { error: "Locked clubs exceed time budget", detail: `Locked hours ${used}, budget ${body.weeklyBudgetHours}` },
      { status: 400 }
    );
  }

  // Fill remaining slots greedily by utility/hour
  const remaining = unlocked.sort((a, b) => b.utilityPerHour - a.utilityPerHour);

  for (const c of remaining) {
    if (chosen.length >= body.maxClubs) break;
    if (used + c.hours > body.weeklyBudgetHours) continue;
    chosen.push(c);
    used += c.hours;
  }

  // Diversity constraint: try include one career/professional if possible
  // Only swap out a non-locked club
  const hasCareerAlready = chosen.some((c) => isCareer(c.categories));
  if (!hasCareerAlready) {
    const careerCandidate = remaining.find((c) => isCareer(c.categories));
    if (careerCandidate) {
      const swappableIndex = chosen.findIndex((c) => !lockedSet.has(c.id));
      if (swappableIndex !== -1) {
        const toReplace = chosen[swappableIndex];
        const newUsed = used - toReplace.hours + careerCandidate.hours;
        if (newUsed <= body.weeklyBudgetHours) {
          chosen[swappableIndex] = careerCandidate;
          used = newUsed;
        }
      } else if (chosen.length < body.maxClubs && used + careerCandidate.hours <= body.weeklyBudgetHours) {
        chosen.push(careerCandidate);
        used += careerCandidate.hours;
      }
    }
  }

  return NextResponse.json({ chosen, usedHours: used });
}