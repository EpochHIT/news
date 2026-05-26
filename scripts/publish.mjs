import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { Lunar } from "lunar-javascript";

const root = process.cwd();
const source = join(root, ".source");
const output = join(root, "public");
const defaultSite = join(root, "site", "default");
const systemBranches = new Set(["HEAD", "main", "master", "gh-pages"]);

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: options.cwd ?? source,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"]
  }).trim();
}

function todayShanghai() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(new Date());
}

function parseDate(value) {
  const match = String(value || "").match(/^(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  return { month: Number(match[1]), day: Number(match[2]) };
}

function parseFrontMatter(text) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;
  return yaml.load(match[1]);
}

function branchNames() {
  const refs = git(["for-each-ref", "refs/remotes/origin", "--format=%(refname:short)"]);
  return refs
    .split(/\r?\n/)
    .map((ref) => ref.replace(/^origin\//, ""))
    .filter((name) => name && !systemBranches.has(name))
    .filter((name) => name !== "origin")
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function branchFile(branch, path) {
  try {
    return git(["show", `origin/${branch}:${path}`]);
  } catch {
    return "";
  }
}

function birthdayEntries(meta) {
  if (Array.isArray(meta?.birthdays)) {
    return meta.birthdays;
  }
  if (meta?.birthday) {
    return [meta.birthday];
  }
  return [];
}

function solarBirthdayCandidates(birthday, year) {
  const parsed = parseDate(birthday.date);
  if (!parsed) return [];

  if (String(birthday.calendar || "solar").toLowerCase() === "lunar") {
    return [year - 1, year, year + 1].map((lunarYear) => {
      const solar = Lunar.fromYmd(lunarYear, parsed.month, parsed.day).getSolar();
      return `${solar.getYear()}-${String(solar.getMonth()).padStart(2, "0")}-${String(solar.getDay()).padStart(2, "0")}`;
    });
  }

  return [`${year}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`];
}

function addDays(dateText, days) {
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function pickActive(today) {
  const year = Number(today.slice(0, 4));
  for (const branch of branchNames()) {
    const readme = branchFile(branch, "README.md");
    const meta = parseFrontMatter(readme);
    if (!meta) continue;

    for (const entry of birthdayEntries(meta)) {
      for (const birthday of solarBirthdayCandidates(entry, year)) {
        const window = entry.window ?? meta.window ?? {};
        const before = Number(window.days_before ?? 0);
        const after = Number(window.days_after ?? 6);
        const start = addDays(birthday, -before);
        const end = addDays(birthday, after);
        if (start <= today && today <= end) {
          return { branch, meta, birthday, birthdayEntry: entry, start, end };
        }
      }
    }
  }
  return null;
}

function resetOutput() {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
}

function copyDefault() {
  cpSync(defaultSite, output, { recursive: true });
}

function copyBranch(branch) {
  git(["checkout", "--force", `origin/${branch}`]);
  for (const item of readdirSync(source, { withFileTypes: true })) {
    if (item.name === ".git") continue;
    cpSync(join(source, item.name), join(output, item.name), { recursive: true });
  }
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, { headers: { "user-agent": "DailySignal/1.0" } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchText(url) {
  try {
    const response = await fetch(url, { headers: { "user-agent": "DailySignal/1.0" } });
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  }
}

async function writeDefaultFeed(today) {
  const bing = await fetchJson("https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=zh-CN");
  const wallpapers = (bing?.images ?? []).map((item) => ({
    title: item.title || "Daily image",
    caption: item.copyright || "",
    url: item.url?.startsWith("/") ? `https://www.bing.com${item.url}` : item.url
  }));

  const html = await fetchText("https://news.stormzhang.ai/");
  const notes = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map(([, href, raw]) => ({
      title: raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      url: href.startsWith("/") ? `https://news.stormzhang.ai${href}` : href
    }))
    .filter((item) => item.title.length >= 8 && item.title.length <= 90)
    .slice(0, 8);

  mkdirSync(join(output, "data"), { recursive: true });
  writeFileSync(
    join(output, "data", "feed.json"),
    JSON.stringify(
      {
        date: today,
        wallpapers,
        notes,
        fallbackNotes: [
          { title: "读一页纸，留一张图，记录一个问题。", url: "" },
          { title: "世界每天给出许多信号，值得慢一点筛选。", url: "" },
          { title: "学术、风景、生活和历史，都可以在同一页相遇。", url: "" }
        ]
      },
      null,
      2
    )
  );
}

function writeMeta(mode, today, active = null) {
  writeFileSync(
    join(output, "publish.json"),
    JSON.stringify({ mode, today, active }, null, 2)
  );
  writeFileSync(join(output, ".nojekyll"), "");
}

const today = process.env.SIGNAL_DATE || todayShanghai();
resetOutput();
const active = pickActive(today);
if (active) {
  copyBranch(active.branch);
  writeMeta("personal", today, active);
} else {
  copyDefault();
  await writeDefaultFeed(today);
  writeMeta("default", today);
}

if (!existsSync(join(output, "index.html"))) {
  throw new Error("No index.html was generated.");
}
