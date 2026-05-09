# FairTrip

**FairTrip** is an offline-first PWA for splitting travel expenses between **named couples or individuals** (colour-coded), with **GBP / JPY / EUR / USD** entry, settlement in **GBP**, per-day FX (Frankfurter ECB), optional on-device receipt OCR (Tesseract.js), and optional sync via a **free Cloudflare** Worker + D1 + R2 stack.

New trips walk you through name & notes, headcount (optional), currencies, and 2–6 balance groups. **Add expense** is a large floating action on Balance and History; receipts support **camera** or **photo library**.

## Cursor Cloud Agents

To use [Cursor Cloud Agents](https://cursor.com/docs/cloud-agent) on this repo (GitHub integration, onboarding, secrets, first PR smoke test), follow **[docs/CLOUD_AGENTS_SETUP.md](docs/CLOUD_AGENTS_SETUP.md)**.

## Repository

Remote: **https://github.com/NoStringsDev/FairTrip**

```bash
git clone https://github.com/NoStringsDev/FairTrip.git
cd FairTrip
npm install
npm run dev
```

Open the printed URL (usually `http://localhost:5173`).

### Optional: API + sync + uploads (Worker)

Terminal 1 (Worker, local):

```bash
cd worker
npx wrangler d1 execute fair-trip-db --local --file=./migrations/0001_init.sql
npx wrangler d1 execute fair-trip-db --local --file=./migrations/0002_trip_meta.sql
npx wrangler dev
```

Create D1 + R2 in the Cloudflare dashboard (free tier), then set `database_id` in [`wrangler.toml`](wrangler.toml) (repo root) to match your D1 database—the same values should stay in sync with [`worker/wrangler.toml`](worker/wrangler.toml) if you run Wrangler from `cd worker`.

Terminal 2 (Vite — proxies `/api` to `http://127.0.0.1:8787`):

```bash
echo 'VITE_API_URL=http://127.0.0.1:8787' > .env.local
npm run dev
```

Deploy (uses root [`wrangler.toml`](wrangler.toml) so D1/R2 bindings are included—do not add a competing `wrangler.json` / `wrangler.jsonc` at the repo root):

```bash
npm run deploy:worker
```

Point `VITE_API_URL` in Pages env vars at your Worker URL (e.g. `https://fair-trip-api.<subdomain>.workers.dev`).

## Tests

```bash
npm test
```

## Notes

- **FX**: Frankfurter (`api.frankfurter.app`), no API key. Historic date first; latest fallback when needed.
- **OCR**: In-browser; confirm amounts before saving.
- **Privacy**: Trip access is possession-based (trip code). Treat the code like a password.
- **IndexedDB**: The app database name is `FairTrip` (renaming from older builds starts with a fresh local store).
