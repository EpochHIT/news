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

function markdownExcerpt(text) {
  return String(text || "")
    .replace(/^---\s*\n[\s\S]*?\n---/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

function safePathSegment(value) {
  const ascii = String(value || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (ascii) return ascii;
  return `p-${Buffer.from(String(value || "birthday"), "utf8").toString("hex").slice(0, 24)}`;
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

function dateValue(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysBetween(from, to) {
  return Math.round((dateValue(to) - dateValue(from)) / 86400000);
}

function addDays(dateText, days) {
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function collectBirthdayEvents(today) {
  const year = Number(today.slice(0, 4));
  const events = [];
  const seen = new Set();

  for (const branch of branchNames()) {
    const readme = branchFile(branch, "README.md");
    const meta = parseFrontMatter(readme);
    if (!meta) continue;
    const slug = safePathSegment(meta.slug || branch);
    const excerpt = markdownExcerpt(readme);
    const pageLede = extractClass(branchFile(branch, "index.html"), "lede");

    for (const entry of birthdayEntries(meta)) {
      for (const birthday of solarBirthdayCandidates(entry, year)) {
        const window = entry.window ?? meta.window ?? {};
        const before = Number(window.days_before ?? 3);
        const after = Number(window.days_after ?? 3);
        const start = addDays(birthday, -before);
        const end = addDays(birthday, after);
        if (start <= today && today <= end) {
          const offset = daysBetween(today, birthday);
          const phase = offset > 0 ? "before" : offset === 0 ? "today" : "after";
          const key = `${branch}:${birthday}:${entry.label ?? entry.date}`;
          if (seen.has(key)) continue;
          seen.add(key);
          events.push({
            branch,
            slug,
            name: meta.name ?? branch,
            relation: meta.relation ?? "",
            stage: meta.stage ?? "",
            born: meta.born ?? entry.born ?? null,
            birthday,
            birthdayEntry: entry,
            label: entry.label ?? meta.label ?? "生日",
            calendar: entry.calendar ?? meta.calendar ?? "solar",
            message: entry.message ?? meta.message ?? meta.wish ?? pageLede ?? excerpt,
            links: Array.isArray(meta.links) ? meta.links : [],
            start,
            end,
            phase,
            days: Math.abs(offset),
            url: `wishes/${slug}/`
          });
        }
      }
    }
  }

  return events.sort((a, b) => {
    const phaseOrder = { today: 0, before: 1, after: 2 };
    return phaseOrder[a.phase] - phaseOrder[b.phase] || a.days - b.days || a.name.localeCompare(b.name, "zh-CN");
  });
}

function resetOutput() {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
}

function copyDefault() {
  cpSync(defaultSite, output, { recursive: true });
}

function copyBranchTo(branch, destination) {
  git(["checkout", "--force", `origin/${branch}`]);
  mkdirSync(destination, { recursive: true });
  for (const item of readdirSync(source, { withFileTypes: true })) {
    if (item.name === ".git") continue;
    cpSync(join(source, item.name), join(destination, item.name), { recursive: true });
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

function decodeHtml(text) {
  return String(text || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXml(text) {
  return String(text || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function arxivIdFromUrl(url) {
  return String(url || "").replace(/^https?:\/\/arxiv.org\/abs\//, "").replace(/v\d+$/, "");
}

function dayIndex(today, length, salt = 0) {
  if (!length) return 0;
  const [year, month, day] = today.split("-").map(Number);
  const value = Date.UTC(year, month - 1, day) / 86400000;
  return Math.abs(Math.floor(value + salt)) % length;
}

function compactText(text, length = 220) {
  const value = decodeHtml(text);
  return value.length > length ? `${value.slice(0, length - 1)}...` : value;
}

function percentChange(first, last) {
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return 0;
  return ((last - first) / first) * 100;
}

function lastFinite(values) {
  return [...values].reverse().find((value) => Number.isFinite(value)) ?? 0;
}

function extractClass(block, className) {
  const match = block.match(new RegExp(`<[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i"));
  return match ? decodeHtml(match[1]) : "";
}

async function fetchArxivPapers() {
  const query = ["cat:cs.RO", "cat:cs.AI", "cat:cs.LG", "cat:cs.CV", "cat:eess.SY"].join("+OR+");
  const url = `https://export.arxiv.org/api/query?search_query=${query}&start=0&max_results=45&sortBy=submittedDate&sortOrder=descending`;
  const xml = await fetchText(url);
  const include = /(robot|robotic|manipulation|navigation|slam|embodied|vision-language|multimodal|foundation model|large language model|llm|vlm|autonomous|planning|control|reinforcement|diffusion policy|world model|humanoid|sim-to-real)/i;
  const exclude = /(protein|genomic|genome|molecule|molecular|chemistry|catalyst|battery|material|clinical trial|patient cohort|radiology|pathology|oncology|drug)/i;

  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
    .map(([, entry], index) => {
      const title = decodeXml(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]);
      const summary = decodeXml(entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]);
      const idUrl = decodeXml(entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]);
      const id = arxivIdFromUrl(idUrl);
      return {
        index: String(index + 1).padStart(2, "0"),
        title,
        summary,
        authors: [...entry.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>\s*<\/author>/g)].map((match) => decodeXml(match[1])).slice(0, 4),
        categories: [...entry.matchAll(/<category term="([^"]+)"/g)].map((match) => match[1]),
        published: decodeXml(entry.match(/<published>([\s\S]*?)<\/published>/)?.[1]).slice(0, 10),
        arxiv: idUrl,
        alphaxiv: id ? `https://www.alphaxiv.org/abs/${id}` : "",
        pdf: id ? `https://arxiv.org/pdf/${id}` : ""
      };
    })
    .filter((paper) => paper.title && include.test(`${paper.title} ${paper.summary}`))
    .filter((paper) => !exclude.test(`${paper.title} ${paper.summary}`))
    .slice(0, 9)
    .map((paper, index) => ({ ...paper, index: String(index + 1).padStart(2, "0") }));
}

async function fetchYahooSeries(item) {
  const encoded = encodeURIComponent(item.symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=1mo&interval=1d`;
  const data = await fetchJson(url);
  const result = data?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const rows = (quote?.close ?? [])
    .map((close, index) => ({
      open: quote?.open?.[index],
      high: quote?.high?.[index],
      low: quote?.low?.[index],
      close
    }))
    .filter((row) => [row.open, row.high, row.low, row.close].every(Number.isFinite));
  const closes = rows.map((row) => row.close);
  if (closes.length < 2) return null;

  return {
    ...item,
    price: lastFinite(closes),
    currency: result?.meta?.currency || item.currency || "",
    change: percentChange(closes[0], lastFinite(closes)),
    closes: closes.slice(-22).map((value) => Number(value.toFixed(3))),
    candles: rows.slice(-12).map((row) => ({
      open: Number(row.open.toFixed(3)),
      high: Number(row.high.toFixed(3)),
      low: Number(row.low.toFixed(3)),
      close: Number(row.close.toFixed(3))
    })),
    source: "Yahoo Finance chart"
  };
}

async function fetchFinance(notes) {
  const instruments = [
    { symbol: "^GSPC", label: "S&P 500", group: "US", url: "https://finance.yahoo.com/quote/%5EGSPC/" },
    { symbol: "^IXIC", label: "Nasdaq", group: "US", url: "https://finance.yahoo.com/quote/%5EIXIC/" },
    { symbol: "NVDA", label: "NVIDIA", group: "AI", url: "https://finance.yahoo.com/quote/NVDA/" },
    { symbol: "MSFT", label: "Microsoft", group: "AI", url: "https://finance.yahoo.com/quote/MSFT/" },
    { symbol: "BABA", label: "Alibaba ADR", group: "China", url: "https://finance.yahoo.com/quote/BABA/" },
    { symbol: "0700.HK", label: "Tencent", group: "HK", url: "https://finance.yahoo.com/quote/0700.HK/" },
    { symbol: "1810.HK", label: "Xiaomi", group: "HK", url: "https://finance.yahoo.com/quote/1810.HK/" },
    { symbol: "002594.SZ", label: "BYD", group: "CN", url: "https://finance.yahoo.com/quote/002594.SZ/" },
    { symbol: "300750.SZ", label: "CATL", group: "CN", url: "https://finance.yahoo.com/quote/300750.SZ/" },
    { symbol: "CNH=X", label: "USD/CNH", group: "Macro", url: "https://finance.yahoo.com/quote/CNH=X/" },
    { symbol: "GC=F", label: "Gold", group: "Macro", url: "https://finance.yahoo.com/quote/GC=F/" },
    { symbol: "CL=F", label: "Crude Oil", group: "Macro", url: "https://finance.yahoo.com/quote/CL=F/" }
  ];

  const markets = (await Promise.all(instruments.map(fetchYahooSeries))).filter(Boolean);
  const text = (notes || []).map((note) => `${note.title} ${note.summary}`).join(" ").toLowerCase();
  const keywordMap = [
    ["ai", "AI"],
    ["openai", "OpenAI"],
    ["nvidia", "NVIDIA"],
    ["deepseek", "DeepSeek"],
    ["robot", "Robotics"],
    ["unitree", "Unitree"],
    ["spacex", "SpaceX"],
    ["tesla", "Tesla"],
    ["china", "China"],
    ["rate", "Rates"],
    ["tariff", "Tariffs"],
    ["chip", "Chips"]
  ];
  const keywords = keywordMap.filter(([needle]) => text.includes(needle)).map(([, label]) => label).slice(0, 8);

  return {
    markets,
    keywords,
    privateWatch: [
      {
        label: "DeepSeek",
        summary: "Private AI company: track model releases, compute cost narratives, and China AI ecosystem signals.",
        url: "https://www.deepseek.com/"
      },
      {
        label: "Unitree",
        summary: "Private robotics company: track humanoid demos, developer kits, and embodied-AI adoption.",
        url: "https://www.unitree.com/"
      },
      {
        label: "SpaceX",
        summary: "Private aerospace company: track launch cadence, Starship milestones, Starlink economics, and policy signals.",
        url: "https://www.spacex.com/"
      }
    ],
    sources: [
      { label: "Yahoo Chart", title: "Daily market series for mini charts", url: "https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=1mo&interval=1d" },
      { label: "FRED", title: "US macro data source for a future deeper panel", url: "https://fred.stlouisfed.org/" },
      { label: "World Bank", title: "Long-run country macro indicators", url: "https://data.worldbank.org/" },
      { label: "Stooq", title: "Historical market data reference", url: "https://stooq.com/db/h/" }
    ]
  };
}

function interleave(left, right, limit) {
  const mixed = [];
  for (let index = 0; mixed.length < limit && (index < left.length || index < right.length); index++) {
    if (left[index]) mixed.push(left[index]);
    if (right[index] && mixed.length < limit) mixed.push(right[index]);
  }
  return mixed;
}

async function fetchPublicIndex(today) {
  const machineQueries = [
    ["RACE", "Le Mans racing car"],
    ["FERRARI", "Ferrari supercar"],
    ["HELLCAT", "Dodge Challenger SRT Hellcat"],
    ["RALLY", "World Rally Championship car"],
    ["ROCKET", "rocket launch spacecraft"]
  ];
  const machineRequests = machineQueries.map(([, query]) =>
    fetchJson(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=1400&format=json&origin=*`)
  );
  const [chinaPolicies, register, ...machineSearches] = await Promise.all([
    fetchJson("https://www.gov.cn/zhengce/zuixin/ZUIXINZHENGCE.json"),
    fetchJson("https://www.federalregister.gov/api/v1/documents.json?per_page=14&order=newest"),
    ...machineRequests
  ]);

  const policyA = (chinaPolicies || []).slice(0, 14).map((item) => ({
    title: item.TITLE,
    type: "POLICY",
    date: item.DOCRELPUBTIME,
    url: item.URL
  }));
  const policyB = (register?.results || []).slice(0, 14).map((item) => ({
    title: item.title,
    type: item.type === "Rule" ? "RULE" : "NOTICE",
    date: item.publication_date,
    url: item.html_url
  }));

  const machineGroups = machineSearches
    .map((search, searchIndex) => Object.values(search?.query?.pages || {}).map((item) => {
        const info = item.imageinfo?.[0];
        return {
          title: String(item.title || "").replace(/^File:/, "").replace(/\.(jpe?g|png|webp|gif|tiff?)$/i, ""),
          image: info?.thumburl || info?.url || "",
          kind: machineQueries[searchIndex][0],
          url: info?.descriptionurl || ""
        };
      }).filter((item) => item.image && item.url));
  const machines = Array.from({ length: 8 }, (_, itemIndex) =>
    machineGroups.map((group) => group[itemIndex]).filter(Boolean)
  )
    .flat()
    .filter((item, index, items) => items.findIndex((entry) => entry.image === item.image) === index)
    .slice(0, 25);

  return {
    date: today,
    policies: interleave(policyA, policyB, 24),
    machines,
    sources: [
      { label: "POLICY FILES / SOURCE A", url: "https://www.gov.cn/zhengce/zuixin/" },
      { label: "POLICY FILES / SOURCE B", url: "https://www.federalregister.gov/developers/documentation/api/v1" },
      { label: "OPEN MACHINE ARCHIVE", url: "https://commons.wikimedia.org/" }
    ]
  };
}

async function fetchMetObject(today) {
  const queries = ["landscape", "sea", "sunset", "garden", "mountain", "study", "machine", "map"];
  const query = queries[dayIndex(today, queries.length, 11)];
  const search = await fetchJson(`https://collectionapi.metmuseum.org/public/collection/v1/search?isHighlight=true&hasImages=true&q=${encodeURIComponent(query)}`);
  const ids = search?.objectIDs ?? [];

  for (let offset = 0; offset < Math.min(ids.length, 12); offset++) {
    const id = ids[(dayIndex(today, ids.length, offset) + offset) % ids.length];
    const item = await fetchJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
    if (!item?.primaryImageSmall) continue;
    if (String(item.title || "").length > 96) continue;
    if (/(book|catalog|catalogue|coin|fragment|textile|sample|plate)/i.test(`${item.objectName || ""} ${item.classification || ""}`)) continue;
    return {
      label: "Met Open Access",
      title: item.title || "Met collection object",
      summary: [item.artistDisplayName, item.objectDate, item.medium].filter(Boolean).join(" · "),
      image: item.primaryImageSmall,
      url: item.objectURL || `https://www.metmuseum.org/art/collection/search/${id}`,
      meta: item.department || "The Metropolitan Museum of Art"
    };
  }
  return null;
}

async function fetchArticArtwork(today) {
  const queries = ["landscape", "architecture", "light", "water", "study", "city", "history"];
  const query = queries[dayIndex(today, queries.length, 23)];
  const url = `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(query)}&query[term][is_public_domain]=true&limit=12&fields=id,title,image_id,artist_title,date_display,thumbnail`;
  const search = await fetchJson(url);
  const items = (search?.data ?? []).filter((item) => item.image_id);
  const item = items[dayIndex(today, items.length, 5)];
  if (!item) return null;
  return {
    label: "Art Institute",
    title: item.title || "Public domain artwork",
    summary: [item.artist_title, item.date_display, item.thumbnail?.alt_text].filter(Boolean).join(" · "),
    image: `https://www.artic.edu/iiif/2/${item.image_id}/full/843,/0/default.jpg`,
    url: `https://www.artic.edu/artworks/${item.id}`,
    meta: "Art Institute of Chicago"
  };
}

async function fetchApod() {
  const item = await fetchJson("https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&thumbs=true");
  if (!item?.url) return null;
  return {
    label: "NASA APOD",
    title: item.title || "Astronomy Picture of the Day",
    summary: compactText(item.explanation, 190),
    image: item.media_type === "image" ? item.url : item.thumbnail_url,
    url: item.hdurl || item.url || "https://apod.nasa.gov/apod/astropix.html",
    meta: item.date || "Astronomy Picture of the Day"
  };
}

async function fetchOnThisDay(today) {
  const [, month, day] = today.split("-");
  const data = await fetchJson(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/${month}/${day}`);
  const events = data?.selected ?? [];
  const event = events[dayIndex(today, events.length, 31)];
  if (!event) return null;
  const page = event.pages?.[0];
  return {
    label: "On This Day",
    title: `${event.year}: ${page?.titles?.normalized || "A historical signal"}`,
    summary: compactText(event.text, 190),
    image: page?.thumbnail?.source || "",
    url: page?.content_urls?.desktop?.page || "https://en.wikipedia.org/wiki/Main_Page",
    meta: "Wikipedia selected events"
  };
}

async function fetchArchiveItems(today) {
  const items = await Promise.all([
    fetchMetObject(today),
    fetchArticArtwork(today),
    fetchApod(),
    fetchOnThisDay(today)
  ]);
  return items.filter(Boolean);
}

async function writeDefaultFeed(today) {
  const bing = await fetchJson("https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=zh-CN");
  const wallpapers = (bing?.images ?? []).map((item) => ({
    title: item.title || "Daily image",
    caption: item.copyright || "",
    url: item.url?.startsWith("/") ? `https://www.bing.com${item.url}` : item.url
  }));

  const html = await fetchText("https://news.stormzhang.ai/");
  const notes = [...html.matchAll(/<a class=["']item["'] href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map(([, href, block]) => ({
      title: extractClass(block, "item-summary"),
      summary: extractClass(block, "item-en"),
      source: extractClass(block, "badge"),
      time: extractClass(block, "item-time"),
      index: extractClass(block, "item-index"),
      url: href.startsWith("/") ? `https://news.stormzhang.ai${href}` : href
    }))
    .filter((item) => item.title.length >= 8)
    .slice(0, 12);

  const papers = await fetchArxivPapers();
  const finance = await fetchFinance(notes);
  const publicIndex = await fetchPublicIndex(today);
  const archiveItems = await fetchArchiveItems(today);
  const archiveVisuals = archiveItems
    .filter((item) => item.image)
    .map((item) => ({
      title: item.title,
      caption: [item.label, item.meta].filter(Boolean).join(" · "),
      url: item.image
    }));
  const visualWallpapers = [...wallpapers.slice(0, 5), ...archiveVisuals].slice(0, 9);

  mkdirSync(join(output, "data"), { recursive: true });
  writeFileSync(join(output, "data", "public-index.json"), JSON.stringify(publicIndex, null, 2));
  writeFileSync(
    join(output, "data", "feed.json"),
    JSON.stringify(
      {
        date: today,
        wallpapers: visualWallpapers,
        notes,
        source: {
          name: "AI Daily",
          url: "https://news.stormzhang.ai/"
        },
        academic: {
          papers,
          awards: [
            {
              label: "RSS",
              title: "Outstanding Paper Award archive",
              url: "https://roboticsfoundation.org/awards/best-paper-award/"
            },
            {
              label: "ICRA",
              title: "Awards and finalists",
              url: "https://ewh.ieee.org/soc/ras/conf/fullysponsored/icra/ICRA2025/2025.ieee-icra.org/program/awards-and-finalists/index.html"
            },
            {
              label: "CoRL",
              title: "Best Paper Awards",
              url: "https://2025.corl.org/program/awards"
            }
          ],
          resources: [
            { label: "alphaXiv", title: "Social reading for arXiv papers", url: "https://www.alphaxiv.org/" },
            { label: "arXiv cs.RO", title: "Robotics preprints", url: "https://arxiv.org/list/cs.RO/recent" },
            { label: "IEEE T-RO", title: "Transactions on Robotics", url: "https://www.ieee-ras.org/publications/t-ro" },
            { label: "Papers with Code", title: "Robotics tasks and benchmarks", url: "https://paperswithcode.com/area/robots" },
            { label: "Semantic Scholar", title: "Citation graph and paper metadata", url: "https://www.semanticscholar.org/product/api" },
            { label: "Hugging Face", title: "Daily ML paper reading surface", url: "https://huggingface.co/papers" }
          ],
          projects: [
            {
              label: "MCP",
              title: "academic-search-mcp",
              summary: "Multi-source academic search as an MCP server; useful as a design reference for future deeper search.",
              url: "https://github.com/Linductor-alkaid/academic-search-mcp"
            },
            {
              label: "Graph",
              title: "OpenAlex",
              summary: "Open scholarly graph for works, authors, venues, institutions, and topic exploration.",
              url: "https://openalex.org/"
            },
            {
              label: "Benchmarks",
              title: "Papers with Code",
              summary: "Task pages and benchmark tables make papers easier to compare after the first skim.",
              url: "https://paperswithcode.com/"
            }
          ],
          lanes: [
            "Robot learning",
            "Embodied AI",
            "SLAM / VIO",
            "Manipulation",
            "Autonomous systems",
            "VLM / LLM agents"
          ]
        },
        finance,
        archive: {
          items: archiveItems,
          sources: [
            {
              label: "Met Timeline",
              title: "Curator-written art history essays",
              summary: "Reliable long-form context for art, objects, places, and eras.",
              url: "https://www.metmuseum.org/toah/"
            },
            {
              label: "ArtIC API",
              title: "Public-domain artworks with IIIF images",
              summary: "Good for daily visual cards because metadata and images are structured.",
              url: "https://api.artic.edu/docs/"
            },
            {
              label: "Wikimedia",
              title: "On-this-day historical events",
              summary: "Daily historical hooks that can connect the page to memory and time.",
              url: "https://api.wikimedia.org/wiki/Feed_API/Reference/On_this_day"
            },
            {
              label: "NASA APOD",
              title: "Astronomy image and explanation",
              summary: "A daily image source that keeps the archive feeling open and planetary.",
              url: "https://api.nasa.gov/"
            },
            {
              label: "Public Domain Review",
              title: "Essays and collections from cultural archives",
              summary: "A human-curated reading source for strange, beautiful archival material.",
              url: "https://publicdomainreview.org/"
            }
          ]
        },
        fallbackNotes: [
          { title: "读一页纸，留一张图，记录一个问题。", summary: "A quiet fallback signal.", source: "Local", time: today, url: "" },
          { title: "世界每天给出许多信号，值得慢一点筛选。", summary: "A small note for attention.", source: "Local", time: today, url: "" },
          { title: "学术、风景、生活和历史，都可以在同一页相遇。", summary: "A useful page should breathe.", source: "Local", time: today, url: "" }
        ]
      },
      null,
      2
    )
  );
}

function writeBirthdayData(today, events) {
  mkdirSync(join(output, "data"), { recursive: true });
  writeFileSync(
    join(output, "data", "birthdays.json"),
    JSON.stringify({ date: today, events }, null, 2)
  );
}

function writeMeta(mode, today, events = []) {
  writeFileSync(
    join(output, "publish.json"),
    JSON.stringify({ mode, today, events }, null, 2)
  );
  writeFileSync(join(output, ".nojekyll"), "");
}

const today = process.env.SIGNAL_DATE || todayShanghai();
resetOutput();
copyDefault();
await writeDefaultFeed(today);

const events = collectBirthdayEvents(today);
const copiedBranches = new Set();
for (const event of events) {
  if (copiedBranches.has(event.branch)) continue;
  copiedBranches.add(event.branch);
  copyBranchTo(event.branch, join(output, "wishes", event.slug));
}
writeBirthdayData(today, events);
writeMeta(events.some((event) => event.phase === "today") ? "birthday" : "default", today, events);

if (!existsSync(join(output, "index.html"))) {
  throw new Error("No index.html was generated.");
}
