/* =========================================================================
   sync.mjs — build the deployed web copies from each project's real source.

   Each web project lives twice: the source you actually develop (a full app,
   often with node_modules / electron / build junk) in the workspace folder next
   to this repo, and the trimmed, web-ready copy that ships in this repo and gets
   served by GitHub Pages. This script rebuilds the shipped copies from the
   sources and re-applies every transform the deploy needs, so you only ever edit
   the source.

   Usage (from anywhere):
     node scripts/sync.mjs                 # sync all projects
     node scripts/sync.mjs the-counter     # sync only these dest folders
     node scripts/sync.mjs --list          # show the mapping and exit

   Then review with `git status` and commit. Layout assumption: this repo
   (HomePage) sits inside the workspace beside the source folders, e.g.
     Claude Code 1/
       HomePage/            <- this repo
       AweCrap/  Game Test/  Shopping List/  Home Hub/   <- sources
   Adjust a project's `src` below if you move things.

   NOT synced (maintained directly in this repo): mttd/ and daytrader/ (hand-written
   install pages), and moderntools/ (the Modern Exteriors sales-tools site — this repo
   is now its home; edit the files under moderntools/ directly and commit).
   ========================================================================= */
import { existsSync, rmSync, mkdirSync, cpSync, readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");        // .../HomePage
const WORKSPACE = resolve(REPO, "..");   // .../Claude Code 1

const AWECRAP_AUDIO_BASE =
  "https://github.com/CJCx3/HomePage/releases/download/awecrap-audio-v1/";

/* Home Hub ships publicly, so strip personal/network data from its source. */
const HOMEHUB_SCRUB = [
  ["100.86.241.110:8096", "localhost:8096"],
  ["192.168.68.109:8096", "localhost:8096"],
  ["192.168.68.1", "192.168.1.1"],
  ["Seven Valleys, PA", "your area"],
  ["Seven Valleys", "New York"],
  ["'CJC'", "'You'"],
];

const PROJECTS = [
  { dest: "awecrap",     src: "AweCrap",
    copy: ["index.html", "css", "js", "assets", "AweCrapBossPics"],
    transforms: ["awecrapAudio"] },
  { dest: "metanoia",    src: "Game Test",
    copy: ["index.html", "styles.css", "src"],
    transforms: [] },
  { dest: "the-counter", src: "Shopping List",
    copy: ["index.html", "app.js", "scan.js", "styles.css", "manifest.webmanifest", "sw.js", "lib", "vendor", "icons", "fonts"],
    transforms: [] },
  { dest: "ledger",      src: "Ledger",
    copy: ["index.html", "styles.css", "js", "icons", "manifest.webmanifest", "sw.js"],
    transforms: [] },
  { dest: "home-hub",    src: "Home Hub",
    copy: ["index.html", "ambient.html", "css", "js"],
    transforms: ["homehubScrub"] },
];

/* ---- transforms ---- */
function eachHtml(dir, fn) {
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".html")) continue;
    const p = join(dir, name);
    if (statSync(p).isFile()) fn(p);
  }
}
const transforms = {
  // stream AweCrap's music from the GitHub Release instead of the 177MB folder
  awecrapAudio(dir) {
    const p = join(dir, "js", "config.js");
    if (!existsSync(p)) return;
    writeFileSync(p, readFileSync(p, "utf8").split("AweCrapMusic/").join(AWECRAP_AUDIO_BASE));
  },
  // remove personal/network data from Home Hub before it goes public
  homehubScrub(dir) {
    const files = [];
    const jsdir = join(dir, "js");
    if (existsSync(jsdir)) for (const f of readdirSync(jsdir)) if (f.endsWith(".js")) files.push(join(jsdir, f));
    eachHtml(dir, (p) => files.push(p));
    for (const p of files) {
      let s = readFileSync(p, "utf8");
      const before = s;
      for (const [a, b] of HOMEHUB_SCRUB) s = s.split(a).join(b);
      if (s !== before) writeFileSync(p, s);
    }
  },
};

/* ---- run ---- */
const args = process.argv.slice(2);
if (args.includes("--list") || args.includes("--help")) {
  console.log("Project mapping (source  ->  shipped copy):\n");
  for (const p of PROJECTS) console.log(`  ../${p.src}  ->  ${p.dest}   [${p.transforms.join(", ")}]`);
  console.log("\nUsage: node scripts/sync.mjs [dest ...]");
  process.exit(0);
}
const only = args.filter((a) => !a.startsWith("-"));

let synced = 0, skipped = 0;
for (const proj of PROJECTS) {
  if (only.length && !only.includes(proj.dest)) continue;
  const srcDir = join(WORKSPACE, proj.src);
  const destDir = join(REPO, proj.dest);
  if (!existsSync(srcDir)) {
    console.log(`  SKIP ${proj.dest}: source not found (${srcDir})`);
    skipped++;
    continue;
  }
  rmSync(destDir, { recursive: true, force: true });   // fresh, so deleted files vanish too
  mkdirSync(destDir, { recursive: true });
  for (const item of proj.copy) {
    const s = join(srcDir, item);
    if (existsSync(s)) cpSync(s, join(destDir, item), { recursive: true });
    else console.log(`     (note: ${proj.src}/${item} missing, skipped)`);
  }
  for (const t of proj.transforms) transforms[t](destDir);
  console.log(`  synced ${proj.dest}  <-  ${proj.src}   [${proj.transforms.join(", ")}]`);
  synced++;
}
console.log(`\nDone: ${synced} synced${skipped ? `, ${skipped} skipped` : ""}. Review with 'git status', then commit.`);
