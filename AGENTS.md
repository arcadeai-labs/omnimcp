# Agent guidance for this repository

For agents editing **arcade-plugin** itself.

Client-specific files are generated and checked in. Do not edit a generated
file by hand. [ARCHITECTURE.md](ARCHITECTURE.md) lists the sources;
`.gitattributes` lists every fully generated file. `skills/try-arcade/SKILL.md`,
`agents/arcade-operator.agent.md`, and `docs/telemetry.md` are hand-written
except for a marked generated block (the event tables in docs/telemetry.md
come from `hooks/telemetry-contract.mjs`; never edit inside those markers).

- Routing rules: edit `hooks/routing-guidance.mjs`, never the rules text in
  the Cursor rule, arcade-operator, or try-arcade.
- Hooks: add a hook or a client in `hooks/hook-hosts.mjs`, never in a
  `hooks.json`.
- Telemetry: `hooks/telemetry-contract.mjs` defines every event, property,
  and allowed value; change them there only. Client-specific hook input mapping
  lives only in `hooks/telemetry-adapters/<host>.mjs`. Wire a client through
  `HOSTS.telemetry` in `hooks/hook-hosts.mjs` (generated manifests follow
  that source). `telemetry.mjs` prints nothing; only `telemetry-send.mjs` may
  touch the network. `TELEMETRY_ENABLED` in
  `hooks/telemetry-config.mjs` stays `false` without separate approval; while
  false, generated manifests include no telemetry hooks. `docs/telemetry.md`
  documents the event contract, privacy, opt-outs, and approval before enabling.
- Development packages, scripts, and tests stay out of this tree, so
  installing the plugin does not install them. This root has no
  `package.json`. A package manifest beside an npm or Bun lockfile would be
  installed with the plugin.
- Codex hooks are blocked upstream ([docs/install/codex.md](docs/install/codex.md)).
  Don't remove the root `$schema` to force them; that breaks Agent Plugins
  conformance.
