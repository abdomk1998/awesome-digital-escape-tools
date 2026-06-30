# Data sources

The generator fetches from the **live site** by default:

| File | URL |
|------|-----|
| `tools.json` | `https://digitalescapetools.com/data/tools.json` |
| `repos.json` | `https://digitalescapetools.com/repos.json` |

```bash
npm run generate
```

### Cloudflare / CI note

Programmatic fetches may receive **403** (Cloudflare challenge) outside a browser. The generator then **falls back** to a local sibling checkout:

```
../digitalescapetools_cursor/data/tools.json
../digitalescapetools_cursor/repos.json
```

To skip the network attempt:

```bash
npm run generate -- --local
```

To pin explicit files:

```bash
npm run generate -- --tools path/to/tools.json --repos path/to/repos.json
```

To fail instead of falling back when fetch is blocked:

```bash
npm run generate -- --no-fallback
```
