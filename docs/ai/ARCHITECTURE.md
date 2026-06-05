# Architecture

Living structural map of the system as of 2026-06-05.
Overwritten when structural changes occur during a session.

## Overview
LDAP authentication service exposed via REST API. A Deno 2 TypeScript server running Express on port 42139. Frontend is a single-page form using htmx + mustache + PicoCSS. Backend uses ldapjs to search an LDAP directory and verify user credentials. Deployment via daemontools on grafg1.spengergasse.at with auto git-pull on restart.

## Commands (`deno.jsonc` tasks)
| Command | Purpose |
|---------|---------|
| `deno task start` | Run production server |
| `deno task dev` | Run with --watch for auto-restart |
| `deno task lint` | Run deno lint |
| `deno task check` | Type-check without running |

## Source Files
| File | Purpose |
|------|---------|
| `app.ts` | Entry point — Express server setup, middleware, route mounting |
| `routes/verify.ts` | Verify router — LDAP search + bind logic, POST /verify handler |
| `routes/response.ts` | Response class + ResponseJson type — JSON serialization |
| `routes/failuretracker.ts` | FailureTracker — IP/user rate limiting in memory |
| `deno.jsonc` | Deno config: tasks, import map, fmt, lint exclude |
| `.env` | Local dev environment (gitignored) |

## Static Assets (`static/`)
| File | Purpose |
|------|---------|
| `index.html` | Single-page frontend (htmx form + mustache template) |
| `htmx.js` | htmx 2.0.4 unminified |
| `mustache.js` | Mustache 4.x unminified (client-side templating) |
| `client-side-templates.js` | htmx extension for JSON→HTML via mustache |
| `json-enc.js` | htmx extension for JSON-encoded form submissions |
| `pico.classless.slate.css` | PicoCSS v2 classless slate theme |
| `response-targets.js` | htmx extension (not currently used, kept for reference) |
| `style.css` | Old custom CSS (not linked, kept for reference) |

## Production Deployment (`grafg1.spengergasse.at`)
```
/usr/home/grafg/services/ldapauth2rest/
├── run            → daemontools run script (git pull + deno run)
├── env/           → envdir (one file per env var)
├── git/           → cloned repo (auto-pulled on restart)
├── log/           → daemontools multilog output
├── supervise/     → daemontools control directory (root-owned)
└── run.bak        → backup of previous run script
```

## Data Flows
- Browser → `POST /verify` (JSON body) → Express → ldapjs search → ldapjs bind → JSON response
- Browser → `GET /verify/` → express.static → index.html
- htmx form submit → json-enc (JSON body) → server → client-side-templates (mustache render) → DOM swap
- daemontools restart → run script → git pull → deno run app.ts
