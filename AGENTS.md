# Agent guidance for this repository

For agents editing **arcade-plugin** itself.

Client-specific files are generated. Edit the source, then in `dev/` run
`npm run generate` and `npm run verify` (it fails if a generated file was
edited by hand).
[ARCHITECTURE.md](ARCHITECTURE.md) lists the sources; `.gitattributes` lists
every fully generated file. `skills/try-arcade/SKILL.md`,
`agents/arcade-operator.agent.md`, and `docs/telemetry.md` are hand-written
except for a marked generated block (the event tables in docs/telemetry.md
come from `hooks/telemetry-contract.mjs`; never edit inside those markers).

- Routing rules: edit `hooks/routing-guidance.mjs`, never the rules text in
  the Cursor rule, arcade-operator, or try-arcade.
- Hooks: add a hook or a client in `hooks/hook-hosts.mjs`, never in a
  `hooks.json`. A new client also needs its expected output in
  `dev/test/hooks.test.mjs`.
- Telemetry: `hooks/telemetry-contract.mjs` defines every event, property,
  and allowed value; change them there only. Client-specific hook input mapping
  lives only in `hooks/telemetry-adapters/<host>.mjs`. Wire a client through
  `HOSTS.telemetry` in `hooks/hook-hosts.mjs` (generated manifests follow
  that source). `telemetry.mjs` prints nothing; only `telemetry-send.mjs` may
  touch the network (a test enforces both). `TELEMETRY_ENABLED` in
  `hooks/telemetry-config.mjs` stays `false` without separate approval; while
  false, `npm run generate` writes no telemetry hooks. `docs/telemetry.md`
  documents the event contract, privacy, opt-outs, and approval before enabling.
  `dev/scripts/telemetry-docs.mjs` generates its event tables from the contract;
  keep its tests in `dev/test/telemetry-docs.test.mjs`.
- Dev tooling: keep `package.json`, its lockfile, scripts, and tests in `dev/`.
  Claude Code runs a package install when a plugin's root has `package.json`
  beside an npm or Bun lockfile.
- Codex hooks are blocked upstream ([docs/install/codex.md](docs/install/codex.md)).
  Don't remove the root `$schema` to force them; that breaks Agent Plugins
  conformance.
