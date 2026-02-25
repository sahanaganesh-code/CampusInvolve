import fs from "fs";

function stripHtml(html = "") {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const raw = JSON.parse(fs.readFileSync("data/win_orgs_raw.json", "utf8"));

const clubs = raw
  .filter((o) => o?.Status === "Active" && o?.Visibility === "Public")
  .map((o) => {
    const websiteKey = o?.WebsiteKey;
    const categories = Array.isArray(o?.CategoryNames) ? o.CategoryNames : [];
    return {
      external_id: String(o?.Id ?? ""),
      name: o?.Name ?? "",
      description: stripHtml(o?.Description ?? o?.Summary ?? ""),
      categories,
      tags: [], // we’ll auto-generate later
      url: websiteKey ? `https://win.wisc.edu/organization/${websiteKey}` : null,
      image_id: o?.ProfilePicture ?? null,
    };
  })
  .filter((c) => c.external_id && c.name);

fs.writeFileSync("data/clubs_clean.json", JSON.stringify(clubs, null, 2));
console.log(`Saved data/clubs_clean.json with ${clubs.length} clubs`);