import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Accept both `major` (old) and `majors` (new) so nothing breaks.
 */
const BodySchema = z
  .object({
    major: z.string().optional(),
    majors: z.array(z.string()).optional(),
    interests: z.array(z.string()).optional().default([]),
    topK: z.number().int().min(1).max(200).optional().default(60),
    broad: z.boolean().optional().default(true),
  })
  .refine((x) => (x.majors && x.majors.length > 0) || (x.major && x.major.length > 0), {
    message: "Provide `major` or `majors`",
    path: ["majors"],
  });

function normalizeText(s: string) {
  return (s || "")
    .replace(/\b([A-Za-z])\./g, "$1") // A.I. -> AI
    .toLowerCase();
}

function tokenize(s: string) {
  return normalizeText(s).match(/[a-z0-9]+/g) ?? [];
}

const STOP = new Set([
  "and","or","the","of","in","to","for","with","on","at","by","from",
  "club","organization","org","student","students","uw","wisc","wisconsin",
  "university","madison"
]);

function cleanTokens(tokens: string[]) {
  return tokens.filter((t) => t.length > 1 && !STOP.has(t));
}

function tokenSetFromText(s: string) {
  return new Set(cleanTokens(tokenize(s)));
}

function isShortToken(term: string) {
  const t = term.trim().toLowerCase();
  return t.length <= 2; // ai, cs, ml, etc.
}

/**
 * Synonym expansion (lightweight, but high impact).
 * Add as you notice gaps.
 */
const EXPAND: Record<string, string[]> = {
  cs: ["computer", "computing", "software", "coding", "programming", "systems"],
  ai: ["artificial intelligence", "machine learning", "ml", "deep learning", "nlp"],
  ml: ["machine learning", "ai", "deep learning"],
  robotics: ["robotics", "robot", "autonomous", "mechatronics", "engineering"],
  consulting: ["consulting", "strategy", "case", "business", "management", "professional", "career", "leadership"],
  finance: ["finance", "investing", "markets", "trading", "quant", "banking"],
  ie: ["industrial engineering", "operations", "optimization", "process", "quality", "logistics", "supply", "analytics"],
  econ: ["economics", "markets", "policy", "finance"],
  data: ["data", "analytics", "statistics", "machine learning"],
};

function expandTerms(terms: string[], broad: boolean) {
  const out: string[] = [];
  for (const raw of terms) {
    const t = raw.trim();
    if (!t) continue;
    out.push(t);

    if (broad) {
      const key = t.toLowerCase();
      if (EXPAND[key]) out.push(...EXPAND[key]);
    }
  }
  return Array.from(new Set(out));
}

function phraseMatch(phrase: string, text: string) {
  const p = phrase.trim().toLowerCase().replace(/\s+/g, " ");
  if (!p) return false;
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "i");
  return re.test(normalizeText(text).replace(/\s+/g, " "));
}

/**
 * Token/phrase score (explainable)
 */
function overlapScore(terms: string[], club: any) {
  const nameText = club.name ?? "";
  const descText = club.description ?? "";
  const catsArr: string[] = club.categories ?? [];
  const tagsArr: string[] = club.tags ?? [];

  const nameTokens = tokenSetFromText(nameText);
  const descTokens = tokenSetFromText(descText);
  const catTokens = new Set(catsArr.map((c) => normalizeText(c)));
  const tagTokens = new Set(tagsArr.map((t) => normalizeText(t)));

  let score = 0;
  const matched: string[] = [];

  for (const term of terms) {
    const t = term.toLowerCase().trim();
    if (!t) continue;

    const isPhrase = t.includes(" ");
    let hit = false;

    if (!isPhrase && isShortToken(t)) {
      // exact-token only for short acronyms
      if (nameTokens.has(t)) { score += 5; hit = true; }
      if (tagTokens.has(t)) { score += 4; hit = true; }
      if (descTokens.has(t)) { score += 2; hit = true; }
      if (catTokens.has(t)) { score += 2; hit = true; }
    } else if (isPhrase) {
      const phraseHit =
        phraseMatch(t, nameText) ||
        phraseMatch(t, descText) ||
        phraseMatch(t, catsArr.join(" ")) ||
        phraseMatch(t, tagsArr.join(" "));

      const tTokens = t.split(/\s+/).filter(Boolean);
      const allTokensPresent = tTokens.every((w) => nameTokens.has(w) || descTokens.has(w) || tagTokens.has(w));

      if (phraseHit || allTokensPresent) {
        score += 6;
        hit = true;
      }
    } else {
      if (tagTokens.has(t)) { score += 4; hit = true; }
      if (nameTokens.has(t)) { score += 3; hit = true; }
      if (descTokens.has(t)) { score += 1.5; hit = true; }
      if (catTokens.has(t)) { score += 1.5; hit = true; }
    }

    if (hit) matched.push(term);
  }

  return { score, matched: Array.from(new Set(matched)) };
}

/**
 * TF-IDF cosine similarity (brings in "more can be included" without garbage matches).
 * We compute similarity only on query tokens (fast enough for ~1000 clubs).
 */
function tfIdfSimilarity(queryTokens: string[], club: any, idf: Map<string, number>) {
  const docText =
    `${club.name ?? ""} ${club.description ?? ""} ${(club.categories ?? []).join(" ")} ${(club.tags ?? []).join(" ")}`;

  const docTokens = cleanTokens(tokenize(docText));
  if (docTokens.length === 0 || queryTokens.length === 0) return 0;

  const qCounts = new Map<string, number>();
  for (const t of queryTokens) qCounts.set(t, (qCounts.get(t) ?? 0) + 1);

  const qTotal = queryTokens.length;
  const qWeights = new Map<string, number>();
  let qNorm = 0;

  for (const [t, c] of qCounts) {
    const w = (c / qTotal) * (idf.get(t) ?? 1);
    qWeights.set(t, w);
    qNorm += w * w;
  }
  qNorm = Math.sqrt(qNorm);
  if (qNorm === 0) return 0;

  // count only query tokens in doc (fast)
  const qSet = new Set(qCounts.keys());
  const dCounts = new Map<string, number>();
  for (const t of docTokens) {
    if (qSet.has(t)) dCounts.set(t, (dCounts.get(t) ?? 0) + 1);
  }
  if (dCounts.size === 0) return 0;

  const dTotal = docTokens.length;
  let dot = 0;
  let dNorm = 0;

  for (const [t, dc] of dCounts) {
    const dw = (dc / dTotal) * (idf.get(t) ?? 1);
    const qw = qWeights.get(t) ?? 0;
    dot += qw * dw;
    dNorm += dw * dw;
  }

  dNorm = Math.sqrt(dNorm);
  if (dNorm === 0) return 0;

  return dot / (qNorm * dNorm);
}

export async function POST(req: Request) {
  const body = BodySchema.parse(await req.json());
  const supabase = supabaseServer();

  const majors = (body.majors && body.majors.length > 0)
    ? body.majors
    : [body.major!];

  // pull keywords for all selected majors
  const { data: majorRows, error: majorErr } = await supabase
    .from("majors")
    .select("name,keywords")
    .in("name", majors);

  if (majorErr) {
    return NextResponse.json({ error: majorErr.message }, { status: 500 });
  }

  const mergedMajorKeywords =
    (majorRows ?? []).flatMap((r: any) => (r.keywords ?? []) as string[]);

  // include major names themselves as additional query terms (helps recall)
  const majorNameTokens = majors.flatMap((m) => m.split(/[\/,&-]/g).map((x) => x.trim()).filter(Boolean));

  const baseTerms = [...mergedMajorKeywords, ...majorNameTokens, ...body.interests];

  const terms = expandTerms(baseTerms, body.broad);

  // Fetch clubs
  const { data: clubs, error: clubsErr } = await supabase
    .from("clubs")
    .select("id,name,description,categories,tags,url");

  if (clubsErr || !clubs) {
    return NextResponse.json({ error: clubsErr?.message ?? "Failed to fetch clubs" }, { status: 500 });
  }

  // Build IDF over corpus once per request (fine for ~1k clubs)
  const N = clubs.length;
  const df = new Map<string, number>();

  for (const c of clubs) {
    const docText =
      `${c.name ?? ""} ${c.description ?? ""} ${(c.categories ?? []).join(" ")} ${(c.tags ?? []).join(" ")}`;
    const uniq = new Set(cleanTokens(tokenize(docText)));
    for (const t of uniq) df.set(t, (df.get(t) ?? 0) + 1);
  }

  const idf = new Map<string, number>();
  for (const [t, d] of df) {
    // smooth IDF
    idf.set(t, Math.log((N + 1) / (d + 1)) + 1);
  }

  // Query tokens for TF-IDF similarity
  const queryTokens = cleanTokens(tokenize(terms.join(" ")));

  const ranked = clubs
    .map((club) => {
      const o = overlapScore(terms, club);
      const sim = tfIdfSimilarity(queryTokens, club, idf);

      // Final score: explainable overlap + semantic-ish similarity
      const finalScore = o.score + 12 * sim;

      return {
        ...club,
        score: finalScore,
        matched: o.matched,
        sim,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, body.topK);

  return NextResponse.json({ results: ranked });
}