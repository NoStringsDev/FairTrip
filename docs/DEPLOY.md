# Automated deploy (GitHub Actions)

Every push to **`main`** runs [`.github/workflows/deploy-worker.yml`](../.github/workflows/deploy-worker.yml): `npm ci` → tests → lint → **`npm run deploy:worker`** (Vite build + `wrangler deploy -c wrangler.toml`).

## One-time setup (GitHub)

Wrangler runs **non-interactively** in CI. It cannot use `wrangler login`, so GitHub Actions must expose **both**:

| Secret | What it is |
|--------|----------------|
| **`CLOUDFLARE_API_TOKEN`** | API token with permission to deploy this Worker + D1 + R2 (see scopes below). |
| **`CLOUDFLARE_ACCOUNT_ID`** | Your account ID (same one shown in the Cloudflare dashboard URLs and Workers overview — 32-character hex string). |

If **only** the API token is set, the workflow often fails at **deploy** with **exit code 1** even though the Cloudflare dashboard still shows correct **Workers bindings** for an already-deployed worker—bindings are configured in Cloudflare; GitHub lacks what it needs to **push** new versions.

### 1. Cloudflare API token

1. Cloudflare Dashboard → **My Profile** → **API Tokens** → **Create Token** (custom is fine).

2. Scopes typical for FairTrip (`fair-trip-api` + D1 + R2), for example:
   - **Account** → **Cloudflare Workers Scripts** → Edit  
   - **Account** → **Workers Routes** → Edit (if you use custom hostnames)
   - **Account** → **Workers R2 Storage** → Edit  
   - **Account** → **D1** → Edit  

3. **Account resources**: restrict to the account where this Worker lives.

Docs: [Create API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/).

### 2. Account ID

- Workers & Pages → your worker (**fair-trip-api**) → **Overview** URL is like  
  `https://dash.cloudflare.com/<ACCOUNT_ID_HERE>/workers/...`  
  Or: any zone/worker sidebar often shows **Account ID**.

### 3. GitHub repository secrets

**Repository → Settings → Secrets and variables → Actions**.

Add:

- **`CLOUDFLARE_API_TOKEN`** — paste the token string.  
- **`CLOUDFLARE_ACCOUNT_ID`** — paste **only** the 32-character id (no quotes).

### 4. Confirm

Merge to **`main`** (or **Actions → Deploy Worker → Run workflow**). The **deploy** step should go green.

Wrangler reads these from the environment; nothing is committed in the repo.

## Manual deploy

```bash
npm run deploy:worker
```

Uses [`wrangler.toml`](../wrangler.toml). Do **not** add a competing `wrangler.jsonc` at the repo root without D1/R2 (see [`CLOUD_AGENTS_SETUP.md`](./CLOUD_AGENTS_SETUP.md)).

Locally, `wrangler login` fills account context interactively—CI cannot.

### API routes

The Worker serves **`GET /api/sync/rev`** (tiny JSON watermark) alongside **`GET /api/sync/pull`**. Older deployments may only expose `/pull`.

### Deep links and browser refresh

**`assets.not_found_handling = "single-page-application"`** ensures deep routes like `/trip/…/balance` return **`index.html`** on full reload.

## If Cursor or another automation also deploys

Two deploy pipelines can race. Prefer one (e.g. GitHub Actions only).
