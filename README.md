# Distribution API — Client Demo

A demo-purpose client application for the **Syno Distribution API** (`https://distribution-api.synoint.com`). It shows, from a consumer's perspective, how to correctly use every client-facing endpoint: creating projects (samples) and surveys (subsets), targeting & quotas, providers, feasibility & costs, the survey lifecycle, and response reconciliation.

The codebase is the documentation: the backend wraps each endpoint in a small, heavily-commented module, and the frontend shows on every screen exactly which API call it makes.

```
┌──────────────┐   /api/* (JSON)   ┌──────────────────┐  Access-token   ┌────────────────────────┐
│ Vue 3 client │ ────────────────► │ Node.js backend  │ ──────────────► │ Distribution API (prod)│
│  (browser)   │                   │ (reference       │                 │ distribution-api.      │
│              │                   │  API consumer)   │                 │ synoint.com            │
└──────────────┘                   └──────────────────┘                 └────────────────────────┘
```

The API key lives only on the backend (`server/.env`) — never in the browser.

> ⚠️ **This demo talks to the production Distribution API.** Launching a survey (status → Live) starts real, billable fieldwork. The UI warns before any status change; during development never set a survey Live.

## The API flow in 60 seconds

1. **Look up ids** — countries, languages, regions, profiling answers, providers, panels come from `GET /reference/*`.
2. **Create a project** (`POST /samples`) — the top-level container; its `limit` hard-caps completes across all its surveys (your cost control).
3. **Create a survey** (`POST /samples/{id}/subsets`) — metadata (LOI, IR, field period), targeting, quotas (send `globalQuotaGroups: []` for automatic ones), provider split, and your survey URLs containing the literal `[ID]` placeholder.
4. **Check feasibility** (`GET /subsets/{id}/feasibility`) — achievable completes + estimated CPI/cost, before spending anything.
5. **Launch** — `PATCH …/status` with `{status: 3}` (Live). Panelists start arriving at your URL with `[ID]` replaced by a per-response **GUID** — store it.
6. **Field** — your survey must redirect every finished respondent back to Syno (complete / screen-out / quota-full / quality screen-out URLs); poll statistics and responses; adjust limits if needed.
7. **Reconcile** — correct response statuses by GUID (e.g. reject bad completes).
8. **Close** — `{status: 6}`. Final: invoicing starts, all further changes are rejected.

The in-app **API Guide** page explains each step in depth.

## Prerequisites

- **[nvm](https://github.com/nvm-sh/nvm)** — used to select the right Node.js version
- **Node.js ≥ 22.12** (the repo pins **Node 24 LTS** via `.nvmrc`)
- **npm ≥ 10** (bundled with Node 24)

## Setup

```bash
nvm install        # reads .nvmrc → installs/activates Node 24
npm install        # installs server + client workspaces

cp server/.env.example server/.env
# edit server/.env and paste your Access-token (issued by Syno International)
```

## Running

```bash
npm run dev        # starts backend (http://localhost:3001) + frontend (Vite, http://localhost:5173)
```

## Testing

```bash
npm test           # server tests (Vitest) — mocked HTTP, never hits production
```

## Project layout

| Path | Purpose |
|---|---|
| `server/` | Node.js (Express 5) backend — the reference Distribution API consumer |
| `server/src/distribution/` | The core: API client (auth, content types, errors) + domain constants |
| `server/src/routes/` | Each client-facing endpoint group, re-exposed 1:1 under `/api` with contract docs |
| `client/` | Vue 3 (Vite) frontend — interactive guide and workflow UI |

## Endpoint catalog

Demo routes mirror the upstream Distribution API 1:1 (same path under `/api`):

| Area | Endpoints |
|---|---|
| Reference data | `GET /reference/countries[/{id}]` · `languages[/{id}]` · `genders[/{id}]` · `statuses[/{id}]` · `providers[/{id}]` · `providers/{id}/countries[/{cid}/languages]` · `panels?country=` · `questions?countryId=` |
| Projects (samples) | `GET\|POST /samples` · `GET\|PATCH /samples/{id}` · `GET /samples/{id}/statistics` |
| Surveys (subsets) | `GET\|POST /samples/{id}/subsets` · `GET\|PATCH /samples/{id}/subsets/{sid}` · `PATCH …/{sid}/status` (3 Live · 4 Paused · 6 Closed) · `PATCH …/{sid}/limit` (per-quota limits; full structure required; each group must sum to the survey limit) |
| Providers | `GET\|POST /subsets/{id}/providers` · `GET /subsets/{id}/providers/{pid}` |
| Quotas (read) | `GET /subsets/{id}/global-quota-groups[/{gid}]` · `GET /global-quota-groups/{gid}/global-quotas[/{qid}]` · `GET /global-quotas/{qid}/statistics` |
| Responses | `GET /responses/{guid}` · `GET /subsets/{id}/responses` · `PATCH /subsets/{id}/responses/{guid}/status` (2·3·4·5·11) |
| Monitoring | `GET /subsets/{id}/statistics` · `GET /subsets/{id}/feasibility` |
| Demo-only | `GET /api/health` · `GET /api/meta/constants` |

Behaviors worth knowing (verified against the live API): `feasibility` and `responses` may answer **500** for draft surveys that were never launched; the subset-providers collection key is **`subsetProviders`**; `GET /samples/{id}` returns `subsets` as IRI strings (use `GET /samples/{id}/subsets` for objects); the questions collection key is **`profilingQuestions`** (answers carry `label`); `PATCH …/limit` without `globalQuotaGroups` returns 422 "Quota groups are required"; **Closed surveys reject limit/provider/modify changes with 409**. **Test accounts**: panel filters are skipped (always the dedicated test panel), the provider list contains only the test provider, and non-test providers in a survey payload are silently skipped on creation.

## How to read this codebase

1. `server/src/distribution/client.js` — the minimal correct way to call the API (auth header, `merge-patch+json` for PATCH, JSON error normalization).
2. `server/src/distribution/constants.js` — statuses, transitions, providers, redirect URLs.
3. `server/src/routes/*.js` — endpoint-by-endpoint contracts.
4. The running app's **API Guide** page — the business-logic narrative (terminology, workflow, GUIDs, redirects, costs).
