# Decisions

Architectural and technical decisions made in this project.
Each entry documents WHAT was decided and WHY.

## 2026-06-05: Migrate from Node.js to Deno 2 with TypeScript
- **Choice**: Convert entire project from CommonJS Node.js to Deno 2 with ESM TypeScript
- **Reason**: Modern runtime, built-in TypeScript, no node_modules, simpler deployment
- **Considered**: Staying on Node.js (rejected: more tooling overhead)
- **Tradeoff**: Some npm packages may have compat issues under Deno

## 2026-06-05: Keep express/ldapjs via npm: specifiers
- **Choice**: Use `npm:express`, `npm:cors`, `npm:ldapjs` in import map rather than Deno-native alternatives
- **Reason**: Minimizes code changes, preserves existing middleware and LDAP logic
- **Considered**: Deno-native HTTP frameworks (oak, hono) and LDAP libraries (rejected: too much rewrite)
- **Tradeoff**: Larger download on first run, potential Node compat edge cases

## 2026-06-05: Use daemontools envdir for deployment config
- **Choice**: Production environment variables via daemontools `envdir` (directory-per-variable), not `.env` file
- **Reason**: Already set up on grafg1; `--env-file` not needed with `envdir`
- **Considered**: `.env` with `--env-file` flag (rejected: envdir already in place)
- **Tradeoff**: Must restart service to change env vars (same as .env)

## 2026-06-05: Use user grafg's Deno 2.8.2 (not system Deno)
- **Choice**: Explicit path `/usr/home/grafg/.deno/bin/deno` in run script
- **Reason**: User's Deno is newer (2.8.2 vs system 2.6.6) and has proper cache setup
- **Considered**: System `/usr/local/bin/deno` (rejected: older version)
- **Tradeoff**: Service depends on user's home directory

## 2026-06-05: PicoCSS classless slate theme
- **Choice**: PicoCSS v2 classless variant with slate accent
- **Reason**: Minimal setup, semantic HTML styling, built-in dark mode, single CSS file
- **Considered**: Tailwind, Bootstrap, custom CSS (rejected: heavier)
- **Tradeoff**: Less layout flexibility, default spacing may need overrides

## 2026-06-05: htmx + mustache for frontend
- **Choice**: htmx for AJAX form submission, mustache for client-side JSON-to-HTML rendering
- **Reason**: Replaces manual fetch() + DOM manipulation, declarative, no custom JS
- **Considered**: Keeping fetch() JS, Alpine.js, vanilla htmx with HTML responses (rejected: backend change needed)
- **Tradeoff**: Mustache template must mirror backend JSON schema

## 2026-06-05: Meta config for 4xx/5xx swapping (not response-targets extension)
- **Choice**: Use `<meta name="htmx-config">` to override default response handling for 4xx/5xx
- **Reason**: Simpler than adding another extension; avoids extension compatibility issues
- **Considered**: `response-targets` extension (rejected: extension placement sensitive, compatibility uncertain)
- **Tradeoff**: All 4xx/5xx are swapped; can't differentiate by status code at the attribute level

## 2026-06-05: Unminified assets in static/ for local serving
- **Choice**: Download unminified JS/CSS to `static/` and serve locally
- **Reason**: Open-source transparency; no CDN dependency in production; easier investigation
- **Considered**: CDN links (rejected: external dependency, harder to debug)
- **Tradeoff**: Larger git repo, manual updates needed for library upgrades

## 2026-06-05: ResponseJson type with toJSON() pattern
- **Choice**: Export a `ResponseJson` interface and use `toJSON()` on Response class
- **Reason**: Controls JSON serialization without `Object.defineProperty` or `declare` keyword
- **Considered**: Parameter properties only (code in JSON), getter + private field (more boilerplate)
- **Tradeoff**: `toJSON()` method must be kept in sync with ResponseJson interface

## 2026-06-05: Deploy via git pull on daemontools restart
- **Choice**: Run script does `git pull` before starting Deno; deploy = restart service
- **Reason**: Existing pattern on grafg1; simple, no separate deploy step
- **Considered**: Separate deploy script, CI/CD pipeline (rejected: overkill for this scale)
- **Tradeoff**: Every restart pulls from main; no version pinning
