# Automated deploy (GitHub Actions)

Every push to **`main`** runs [`.github/workflows/deploy-worker.yml`](../.github/workflows/deploy-worker.yml): `npm ci` → tests → lint → **`npm run deploy:worker`** (Vite build + `wrangler deploy -c wrangler.toml`).

## One-time setup (GitHub)

1. Create a Cloudflare **API token** with permission to deploy this Worker and use your bindings, for example:
   - Workers Scripts → **Edit**
   - Workers Routes → **Edit** (if you use custom routes/domains)
   - Account → **Workers R2 Storage** → Edit (or narrower if your token model allows)
   - Account → **D1** → Edit  
   Cloudflare docs: [Create API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/).

2. In GitHub: **Repository → Settings → Secrets and variables → Actions → New repository secret**
   - Name: **`CLOUDFLARE_API_TOKEN`**
   - Value: paste the token

3. Merge to **`main`** (or push directly). Open **Actions** and confirm **Deploy Worker** succeeds.

Wrangler picks up **`CLOUDFLARE_API_TOKEN`** from the environment; no `.env` file is committed.

## Manual deploy

```bash
npm run deploy:worker
```

Uses root [`wrangler.toml`](../wrangler.toml). Do **not** add a competing `wrangler.jsonc` at the repo root (see [`CLOUD_AGENTS_SETUP.md`](./CLOUD_AGENTS_SETUP.md)).

### Deep links and browser refresh

The Worker config sets **`assets.not_found_handling = "single-page-application"`** so routes like `/trip/…/balance` return `index.html` on a full page reload. Without it, Cloudflare’s asset layer handles navigation **before** your Worker script runs, so deep links can fail with “site can’t be reached” / 404 while in-app navigation still works.

## If Cursor or another automation also deploys

You may get **two** deploys per change (GitHub Actions + another integration). To stay hands-off with GitHub only, disable or disconnect the duplicate deploy integration in Cursor/Cloudflare if present.
