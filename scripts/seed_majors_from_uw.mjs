import fs from "fs";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";

const SOURCE_URL = "https://advising.wisc.edu/undergraduate-majors/";
const SCHOOL_CODES = new Set(["ALS", "BUS", "EDU", "EGR", "HEC", "L&S", "NUR", "PHM"]);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing env vars. Check .env.local has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

const STOP = new Set([
  "and", "or", "the", "of", "in", "to", "for", "with", "on",
  "studies", "study", "major", "science", "sciences"
]);

function keywordsFromMajorName(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9& ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP.has(t));

  const kws = new Set(base);

  const n = name.toLowerCase();
  if (n.includes("computer")) kws.add("cs");
  if (n.includes("data science")) kws.add("ds");
  if (n.includes("industrial") && n.includes("engineering")) kws.add("ie");
  if (n.includes("electrical") && n.includes("engineering")) kws.add("ee");
  if (n.includes("mechanical") && n.includes("engineering")) kws.add("me");
  if (n.includes("economics")) kws.add("econ");
  if (n.includes("statistics")) kws.add("stats");
  if (n.includes("mathematics")) kws.add("math");

  return Array.from(kws);
}

async function main() {
  const res = await fetch(SOURCE_URL, {
    headers: {
      accept: "text/html",
      "user-agent": "Mozilla/5.0",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${SOURCE_URL}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  // Find the table that contains the majors list
  let targetTable = null;
  $("table").each((_, el) => {
    const text = $(el).text();
    if (text.includes("MAJOR") && text.includes("SCHOOL/COLLEGE")) {
      targetTable = el;
      return false;
    }
  });

  if (!targetTable) {
    fs.mkdirSync("data", { recursive: true });
    fs.writeFileSync("data/debug_majors_page.html", html);
    throw new Error("Could not find the majors table. Saved data/debug_majors_page.html");
  }

  const majors = [];
  const seen = new Set();

  $(targetTable)
    .find("tbody tr")
    .each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 2) return;

      const name = $(tds[0]).text().trim();
      const school = $(tds[1]).text().trim();

      if (!name || !SCHOOL_CODES.has(school)) return;
      if (seen.has(name)) return;
      seen.add(name);

      majors.push({
        name,
        keywords: keywordsFromMajorName(name).concat([school.toLowerCase()]),
      });
    });

  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/majors_clean.json", JSON.stringify(majors, null, 2));
  console.log(`Parsed ${majors.length} majors. Seeding into Supabase...`);

  const chunkSize = 200;
  for (let i = 0; i < majors.length; i += chunkSize) {
    const chunk = majors.slice(i, i + chunkSize);
    const { error } = await supabase.from("majors").upsert(chunk, { onConflict: "name" });
    if (error) throw error;
    console.log(`Upserted ${Math.min(i + chunk.length, majors.length)}/${majors.length}`);
  }

  console.log("Done. majors table updated.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});