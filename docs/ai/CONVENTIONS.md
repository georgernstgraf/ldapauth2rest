# Conventions

Coding patterns, naming rules, and style agreements for this project.
Follow these without question. Do not deviate unless explicitly told.

## Indentation & Formatting
- 4-space indent throughout (configured in deno.jsonc `fmt.indentWidth: 4`)
- Semicolons: yes (`semiColons: true`)
- Single quotes: no (`singleQuote: false`)
- Run `deno fmt` to auto-format

## TypeScript
- All source files use `.ts` extension
- ES module imports with full `.ts` extensions (e.g. `import { X } from "./routes/verify.ts"`)
- Environment variables: `Deno.env.get("KEY")` + `Number()` cast for numeric values
- Catch blocks: narrow `unknown` via `e instanceof Error ? e.message : String(e)`

## Deno Config
- Project config in `deno.jsonc` (import map, tasks, fmt, lint)
- Tasks: `deno task start`, `deno task dev`, `deno task lint`, `deno task check`
- Permissions: `--allow-net --allow-env --allow-read` (plus `--watch` for dev)
- No `--env-file` in production (envdir provides vars)

## Frontend
- Static assets in `static/` directory, served by express.static
- htmx attributes on form for AJAX: `hx-post`, `hx-ext`, `hx-target`, `hx-swap`, `hx-indicator`
- Mustache templates in `<template id="...">` tags with `mustache-template` attribute
- PicoCSS classless: no CSS classes needed for standard elements
- Use PicoCSS variables (`--pico-*`) for style overrides when possible

## Backend
- Express router pattern: `routes/verify.ts` exports `verifyRouter`
- Response class in `routes/response.ts` — always use `ResponseJson` interface for JSON shape
- `toJSON()` controls what gets serialized
- LDAP service client created once at module level, reconnected on events

## Git & Deployment
- `.gitignore`: `.env`, `*.rest`, `deno.lock`
- Commits reference GitHub issue numbers
- Deployment to grafg1: restart daemontools service (`sudo svc -t <path>`)
- Run script auto-pulls from GitHub on restart
