import fs from "fs";

const BASE =
  "https://win.wisc.edu/api/discovery/search/organizations?orderBy%5B0%5D=UpperName%20asc&filter=&query=";

const TOP = 100; // if this errors, change to 50
const PAUSE_MS = 250;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let skip = 0;
  const all = [];

  while (true) {
    const url = `${BASE}&top=${TOP}&skip=${skip}`;
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        referer: "https://win.wisc.edu/Organizations",
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);

    const json = await res.json();
    const page = Array.isArray(json) ? json : (json.value ?? json.items ?? []);

    if (!Array.isArray(page)) {
      fs.writeFileSync("data/debug_response.json", JSON.stringify(json, null, 2));
      throw new Error("Unexpected response shape. Wrote data/debug_response.json");
    }

    console.log(`skip=${skip} got=${page.length}`);
    if (page.length === 0) break;

    all.push(...page);

    if (page.length < TOP) break; // last page
    skip += page.length;
    await sleep(PAUSE_MS);
  }

  fs.writeFileSync("data/win_orgs_raw.json", JSON.stringify(all, null, 2));
  console.log(`Saved data/win_orgs_raw.json with ${all.length} orgs`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});