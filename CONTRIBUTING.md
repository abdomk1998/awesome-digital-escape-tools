# Contributing

Thanks for your interest in **Awesome Digital Escape Tools**.

## This README is auto-generated

`README.md` is produced by `scripts/generate-readme.mjs`. **Do not open a pull request that hand-edits `README.md`** — it will be overwritten on the next `npm run generate`.

## How to suggest a tool or report a mistake

Use either channel:

1. **GitHub Issues** — [Suggest a tool](../../issues/new?template=suggest-tool.yml) (preferred for public discussion)
2. **Website contact** — [digitalescapetools.com/contact.html](https://digitalescapetools.com/contact.html) or **contact@digitalescapetools.com**

Include the tool name, category, homepage/source links, and why it belongs on a privacy-first directory.

## Maintainer workflow

```bash
npm run generate
```

By default the generator **fetches** `tools.json` and `repos.json` from the live site. If Cloudflare blocks the request (common in CI), it falls back to a local sibling checkout — see `data/README.md`.

Commit the updated `README.md` only (source data lives on the main website).

## Featured / editor picks

Bold entries come from `config/featured-ids.json` (mirrors the site discovery feed). There is no `featured` field in `tools.json`.

## Categories

Categories are derived from each tool's `backUrl` in `tools.json`, normalized via `config/category-aliases.json` and labeled via `config/category-labels.json`. Fix categorization on the main site first, then regenerate.
