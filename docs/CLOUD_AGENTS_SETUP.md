# Cursor Cloud Agents — FairTrip

This repo is ready for [Cursor Cloud Agents](https://cursor.com/docs/cloud-agent) once your Cursor account and GitHub app access are configured. Cloud runs use a **fresh clone of the remote**; uncommitted local changes are **not** included.

## Repository (verified)

| Item | Value |
|------|--------|
| Remote | `https://github.com/NoStringsDev/FairTrip.git` |
| GitHub | `NoStringsDev/FairTrip` |
| Default branch | `main` (confirm on GitHub if renamed) |

## 1. Connect SCM and grant this repo

1. Open **[Cursor Integrations](https://cursor.com/dashboard/integrations)**.
2. Connect **GitHub** (or GitLab if you mirror here).
3. Install the Cursor GitHub app and grant access to **`NoStringsDev/FairTrip`**.
   - If you use **Selected repositories**, add this repo explicitly.
4. Ensure the integration can **push branches** and **open pull requests** (needed for Cloud Agent PR workflow).

## 2. Onboard the repo and secrets

1. Open **[Cloud Agent onboarding](https://cursor.com/onboard)**.
2. Select **`NoStringsDev/FairTrip`**.
3. Set a **spend limit** when prompted (first-time Cloud Agent use).
4. Add **Cloud Agent secrets / env vars** only if your automated tasks need them:

| Typical need | Notes |
|--------------|--------|
| `npm test` / `npm run build` | Usually **no secrets** — Vitest + Vite build are local. |
| Optional API in tests | If you add integration tests hitting a Worker, set e.g. `VITE_API_URL` to a **throwaway** or mock URL; do not paste production secrets into chat. |
| `wrangler deploy` / D1 / R2 | Prefer **not** running deploy from Cloud Agents unless you intend it; use `CLOUDFLARE_API_TOKEN` only in Cursor Cloud secrets if required, with minimal token scope. Deployments must use **[`wrangler.toml`](../wrangler.toml)** at the repo root (or `npm run deploy:worker`): a minimal root **`wrangler.jsonc`** takes precedence over **`wrangler.toml`** and can deploy **with no D1/R2 bindings**, which breaks production sync. |

FairTrip’s app optionally uses **`VITE_API_URL`** for sync ([README](../README.md)); unit tests in this repo do not require it unless you change tests.

## 3. First Cloud Agent run (smoke test)

1. In **Cursor Desktop**, open Agent chat for this workspace.
2. Under the prompt, set execution to **Cloud** (not Local).
3. Example prompt:

   > On a new branch from `main`, add a one-line comment at the top of `README.md` describing FairTrip in ≤10 words, then open a PR titled `chore: cloud agent smoke test`.

4. Verify:
   - A new **remote branch** appears on GitHub.
   - A **PR** is opened with that commit.
   - CI (if configured) runs on the PR.

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Repo not listed in onboarding | GitHub app does not include `NoStringsDev/FairTrip`. |
| Agent cannot push | Write access / org SSO / branch protection blocking the integration bot. |
| Build/test fails in cloud | Missing Node version (Cloud image vs `engines` in package.json); add setup step or pin Volta/nvm in docs. |
| “Missing” local edits | Commit or push a branch first; Cloud Agents clone **remote** state only. |

## References

- [Cloud Agents](https://cursor.com/docs/cloud-agent)
- [Cloud Agent setup](https://cursor.com/docs/cloud-agent/setup)
- [Cloud Agent settings](https://cursor.com/docs/cloud-agent/settings)
- [GitHub integration](https://cursor.com/docs/integrations/github)
