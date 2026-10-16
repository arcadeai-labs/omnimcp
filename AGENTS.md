# Agent guidance for this repository

For agents editing **arcade-plugin** itself.

Client-specific files are generated. Edit the source, run `npm run generate`,
then `npm run verify` (it fails if a generated file was edited by hand).
[ARCHITECTURE.md](ARCHITECTURE.md) lists the sources; `.gitattributes` lists
every fully generated file. `skills/try-arcade/SKILL.md` and
`agents/arcade-operator.agent.md` are hand-written except
for a marked rules block.

- Routing rules: edit `hooks/routing-guidance.mjs`, never the rules text in
  the Cursor rule, arcade-operator, or try-arcade.
- Hooks: add a hook or a client in `hooks/hook-hosts.mjs`, never in a
  `hooks.json`. A new client also needs its expected output in
  `test/hooks.test.mjs`.
- Codex hooks are blocked upstream ([docs/install/codex.md](docs/install/codex.md)).
  Don't remove the root `$schema` to force them; that breaks Agent Plugins
  conformance.
