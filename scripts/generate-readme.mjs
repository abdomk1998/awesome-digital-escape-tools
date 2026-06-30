#!/usr/bin/env node
/**
 * Generate README.md from Digital Escape Tools data/tools.json.
 *
 * Usage:
 *   node scripts/generate-readme.mjs
 *   node scripts/generate-readme.mjs --tools ../digitalescapetools_cursor/data/tools.json
 *   node scripts/generate-readme.mjs --tools data/tools.json --repos data/repos.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const SITE_ORIGIN = "https://digitalescapetools.com";
const TOOL_URL = (id) =>
  `${SITE_ORIGIN}/tools/tool.html?id=${encodeURIComponent(id)}`;

const LIVE_TOOLS_URL = `${SITE_ORIGIN}/data/tools.json`;
const LIVE_REPOS_URL = `${SITE_ORIGIN}/repos.json`;
const LOCAL_TOOLS = path.resolve(
  REPO_ROOT,
  "../digitalescapetools_cursor/data/tools.json",
);
const LOCAL_REPOS = path.resolve(
  REPO_ROOT,
  "../digitalescapetools_cursor/repos.json",
);
const README_PATH = path.join(REPO_ROOT, "README.md");

const FETCH_HEADERS = {
  Accept: "application/json",
  "User-Agent": "awesome-digital-escape-tools-generator/1.0",
};

function parseArgs(argv) {
  const opts = {
    toolsPath: null,
    reposPath: null,
    out: README_PATH,
    local: false,
    noFallback: false,
    noRepos: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tools" && argv[i + 1])
      opts.toolsPath = path.resolve(argv[++i]);
    else if (a === "--repos" && argv[i + 1])
      opts.reposPath = path.resolve(argv[++i]);
    else if (a === "--out" && argv[i + 1]) opts.out = path.resolve(argv[++i]);
    else if (a === "--local") opts.local = true;
    else if (a === "--no-fallback") opts.noFallback = true;
    else if (a === "--no-repos") opts.noRepos = true;
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: node scripts/generate-readme.mjs [options]

Options:
  --tools <path>   Use a local tools.json (skips live fetch)
  --repos <path>   Use a local repos.json for stars/licenses
  --local          Skip live fetch; read sibling website checkout
  --no-fallback    Fail if live fetch is blocked (no local fallback)
  --no-repos       Skip repos.json metadata
  --out <path>     Output README path (default: README.md)

Default: fetch ${LIVE_TOOLS_URL} (fallback: ${LOCAL_TOOLS})
`);
      process.exit(0);
    }
  }
  return opts;
}

function parseJson(raw, label) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[generate-readme] Invalid JSON in ${label}: ${e.message}`);
    process.exit(1);
  }
}

function loadJsonFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.error(`[generate-readme] Missing ${label}: ${filePath}`);
    process.exit(1);
  }
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (e) {
    console.error(`[generate-readme] Cannot read ${label}: ${e.message}`);
    process.exit(1);
  }
  return parseJson(raw, label);
}

async function fetchJson(url, label) {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`${label} fetch failed: HTTP ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  const raw = await res.text();
  if (!ct.includes("json") && raw.trimStart().startsWith("<")) {
    throw new Error(`${label} fetch returned HTML (likely bot protection)`);
  }
  return parseJson(raw, label);
}

async function loadToolsData(opts) {
  if (opts.toolsPath) {
    console.log(`[generate-readme] tools.json ← ${opts.toolsPath}`);
    return loadJsonFile(opts.toolsPath, "tools.json");
  }
  if (opts.local) {
    console.log(`[generate-readme] tools.json ← ${LOCAL_TOOLS}`);
    return loadJsonFile(LOCAL_TOOLS, "tools.json");
  }
  try {
    console.log(`[generate-readme] Fetching ${LIVE_TOOLS_URL}`);
    return await fetchJson(LIVE_TOOLS_URL, "tools.json");
  } catch (e) {
    if (opts.noFallback) {
      console.error(`[generate-readme] ${e.message}`);
      process.exit(1);
    }
    console.warn(
      `[generate-readme] Live fetch failed (${e.message}); using local fallback`,
    );
    return loadJsonFile(LOCAL_TOOLS, "tools.json");
  }
}

async function loadReposData(opts) {
  if (opts.noRepos) return null;
  if (opts.reposPath) {
    console.log(`[generate-readme] repos.json ← ${opts.reposPath}`);
    return loadJsonFile(opts.reposPath, "repos.json");
  }
  if (opts.local) {
    if (!fs.existsSync(LOCAL_REPOS)) return null;
    console.log(`[generate-readme] repos.json ← ${LOCAL_REPOS}`);
    return loadJsonFile(LOCAL_REPOS, "repos.json");
  }
  try {
    console.log(`[generate-readme] Fetching ${LIVE_REPOS_URL}`);
    return await fetchJson(LIVE_REPOS_URL, "repos.json");
  } catch (e) {
    if (opts.noFallback || !fs.existsSync(LOCAL_REPOS)) {
      console.warn(
        `[generate-readme] repos.json unavailable (${e.message}); skipping badges`,
      );
      return null;
    }
    console.warn(
      `[generate-readme] repos.json fetch failed; using local fallback`,
    );
    return loadJsonFile(LOCAL_REPOS, "repos.json");
  }
}

function loadConfig(name) {
  const p = path.join(REPO_ROOT, "config", name);
  return loadJsonFile(p, `config/${name}`);
}

/** GitHub-compatible heading anchor (matches github-slugger behaviour closely). */
function githubAnchor(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function categorySlugFromBackUrl(backUrl) {
  if (!backUrl) return "uncategorized";
  const cleaned = String(backUrl)
    .replace(/^\.\.\//, "")
    .replace(/\.html$/i, "");
  return cleaned || "uncategorized";
}

function normalizeCategorySlug(slug, aliases) {
  return aliases[slug] || slug;
}

function githubRepoSlug(tool) {
  if (tool.repo) return String(tool.repo).trim();
  const gh = tool.github;
  if (!gh) return "";
  const m = String(gh).match(/github\.com\/([^/]+\/[^/#?]+)/i);
  return m ? m[1] : "";
}

function formatStars(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return "";
  if (num >= 1_000_000)
    return `⭐ ${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (num >= 10_000) return `⭐ ${Math.round(num / 1000)}k`;
  if (num >= 1000) return `⭐ ${(num / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `⭐ ${num.toLocaleString("en-US")}`;
}

function formatLicense(license) {
  const t = String(license ?? "").trim();
  if (!t || t === "N/A" || t === "NOASSERTION") return "";
  return `\`${t}\``;
}

function oneLineDescription(tool) {
  const d = String(tool.description ?? tool.about ?? "").trim();
  if (!d) return "";
  return d.replace(/\s+/g, " ").replace(/[.\s]+$/, "");
}

function sortTools(tools, featuredSet) {
  return [...tools].sort((a, b) => {
    const af = featuredSet.has(a.id) ? 0 : 1;
    const bf = featuredSet.has(b.id) ? 0 : 1;
    if (af !== bf) return af - bf;
    return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  });
}

function sortCategories(slugs, orderList, labels) {
  const orderIndex = new Map(orderList.map((s, i) => [s, i]));
  return [...slugs].sort((a, b) => {
    const ai = orderIndex.has(a) ? orderIndex.get(a) : 9999;
    const bi = orderIndex.has(b) ? orderIndex.get(b) : 9999;
    if (ai !== bi) return ai - bi;
    const la = labels[a] || a;
    const lb = labels[b] || b;
    return la.localeCompare(lb, "en", { sensitivity: "base" });
  });
}

function buildToolLine(tool, featuredSet, reposData) {
  const name = tool.name || tool.id;
  const url = TOOL_URL(tool.id);
  const desc = oneLineDescription(tool);
  const repoKey = githubRepoSlug(tool);
  const repoMeta = repoKey && reposData ? reposData[repoKey] : null;

  const badges = [];
  const licenseBadge = repoMeta ? formatLicense(repoMeta.license) : "";
  if (licenseBadge) badges.push(licenseBadge);
  const starBadge = repoMeta ? formatStars(repoMeta.stars) : "";
  if (starBadge) badges.push(starBadge);

  const link = featuredSet.has(tool.id)
    ? `**[${name}](${url})**`
    : `[${name}](${url})`;
  const tail = [desc, ...badges].filter(Boolean).join(" ");
  return tail ? `- ${link} - ${tail}` : `- ${link}`;
}

function buildToc(categories, labels) {
  const lines = ["## Table of contents", ""];
  for (const slug of categories) {
    const label = labels[slug] || slug;
    const anchor = githubAnchor(label);
    lines.push(`- [${label}](#${anchor})`);
  }
  lines.push("");
  return lines.join("\n");
}

function buildReadme({
  toolsByCategory,
  categorySlugs,
  labels,
  featuredSet,
  reposData,
}) {
  const today = new Date().toISOString().slice(0, 10);
  const totalTools = Object.values(toolsByCategory).reduce(
    (n, arr) => n + arr.length,
    0,
  );
  const categoryCount = categorySlugs.length;

  const parts = [];

  parts.push(`# Awesome Digital Escape Tools

    [![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

> A curated directory of privacy tools, secure software, and open-source alternatives.
> Every link points to [Digital Escape Tools](${SITE_ORIGIN}) — an independent, privacy-first discovery platform.

**${totalTools} tools** across **${categoryCount} categories**. Last updated: **${today}**.

<!-- This file is auto-generated by scripts/generate-readme.mjs — do not edit by hand. -->

`);

  parts.push(buildToc(categorySlugs, labels));

  for (const slug of categorySlugs) {
    const label = labels[slug] || slug;
    const tools = sortTools(toolsByCategory[slug], featuredSet);
    parts.push(`## ${label}`, "");
    for (const tool of tools) {
      parts.push(buildToolLine(tool, featuredSet, reposData));
    }
    parts.push("");
  }

  parts.push(`## Contributing

This README is **machine-generated**. Pull requests that edit it directly will be closed — run \`npm run generate\` after updating source data instead.

To suggest a new tool or correction:

- **[Open a GitHub issue](issues/new?template=suggest-tool.yml)** (preferred)
- **[Contact us on the website](${SITE_ORIGIN}/contact.html)**

---

<sub>${totalTools} tools · ${categoryCount} categories · Generated ${today}</sub>
`);

  return parts.join("\n");
}

async function main() {
  const opts = parseArgs(process.argv);

  const toolsRaw = await loadToolsData(opts);
  const entries = Object.entries(toolsRaw);
  if (!entries.length) {
    console.error("[generate-readme] tools.json has zero entries.");
    process.exit(1);
  }

  const labels = loadConfig("category-labels.json");
  const aliases = loadConfig("category-aliases.json");
  const orderList = loadConfig("category-order.json");
  const featuredCfg = loadConfig("featured-ids.json");
  const featuredSet = new Set(featuredCfg.ids || []);

  const reposData = await loadReposData(opts);

  const toolsByCategory = {};

  for (const [id, tool] of entries) {
    if (!tool || typeof tool !== "object") continue;
    const rawSlug = categorySlugFromBackUrl(tool.backUrl);
    const slug = normalizeCategorySlug(rawSlug, aliases);
    if (!toolsByCategory[slug]) toolsByCategory[slug] = [];
    toolsByCategory[slug].push({ id, ...tool });
  }

  const categorySlugs = sortCategories(
    Object.keys(toolsByCategory),
    orderList,
    labels,
  );

  const readme = buildReadme({
    toolsByCategory,
    categorySlugs,
    labels,
    featuredSet,
    reposData,
  });

  if (readme.includes("undefined")) {
    console.error("[generate-readme] Output contains 'undefined' — aborting.");
    process.exit(1);
  }

  fs.writeFileSync(opts.out, readme, "utf8");

  const total = entries.length;
  console.log(`[generate-readme] Wrote ${opts.out}`);
  console.log(`  Tools: ${total}`);
  console.log(`  Categories: ${categorySlugs.length}`);
  console.log(`  Featured: ${featuredSet.size} IDs configured`);
  console.log(`  Repos metadata: ${reposData ? "yes" : "no"}`);
}

main().catch((e) => {
  console.error("[generate-readme]", e);
  process.exit(1);
});
