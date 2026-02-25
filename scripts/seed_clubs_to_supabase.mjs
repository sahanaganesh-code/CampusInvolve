import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing env vars. Check .env.local has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);
const clubs = JSON.parse(fs.readFileSync("data/clubs_clean.json", "utf8"));

async function main() {
  const chunkSize = 200;

  for (let i = 0; i < clubs.length; i += chunkSize) {
    const chunk = clubs.slice(i, i + chunkSize);

    const { error } = await supabase
      .from("clubs")
      .upsert(chunk, { onConflict: "external_id" });

    if (error) throw error;
    console.log(`Upserted ${i + chunk.length}/${clubs.length}`);
  }

  console.log("Done seeding clubs.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});