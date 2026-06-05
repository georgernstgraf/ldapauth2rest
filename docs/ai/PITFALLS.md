# Pitfalls

Things that do not work, subtle bugs, and non-obvious constraints.
Read this file carefully before making changes in affected areas.

- `--pico-main-max-width` does not exist in PicoCSS v2 classless — use custom CSS `max-width` + flexbox instead
- htmx `client-side-templates` extension for mustache uses `mustache-template` attribute (NOT `data-template`) and `<template>` tag (NOT `<script type="text/mustache">`)
- htmx `client-side-templates` extension is a separate npm package (`htmx-ext-client-side-templates`), NOT bundled in htmx.org dist
- htmx `json-enc` extension is separate from main htmx dist — must be loaded as standalone file
- `hx-ext` values on child elements MERGE with parent values, they do not replace
- htmx `response-targets` extension placement matters — docs recommend parent element, not the triggering element
- `htmx.logAll()` requires console Verbose level in Chrome DevTools
- Deno needs `$HOME` set when running via `setuidgid` (daemontools) — otherwise cache writes to `/.cache/deno` and fails
- `Deno.env.get()` returns `string | undefined` — use `!` or provide defaults for required vars
- Node `process.env.X` does NOT work in Deno without compat layer — always use `Deno.env.get("X")`
- `node:assert` module works in Deno but `import assert from "node:assert/strict"` may have compat issues
- express `req.client` is deprecated — use `req.socket.localAddress` instead
- The original verify.js had an undeclared `response` variable (line 131) that would silently create a global in non-strict mode — Deno ES modules are strict and this would throw
- htmx does not swap 4xx/5xx responses by default — need meta config `<meta name="htmx-config">` to override
- Mustache `{{status}}` is NOT auto-injected by `client-side-templates` extension — must be in JSON body or added separately
