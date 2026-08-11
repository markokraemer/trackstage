# Session registry

Every agent session that built this project. `scripts/extract-prompts.mjs` reads
this file and regenerates PROMPTS.md from the transcripts (raw user inputs only).

Row format (keep exactly): `- <tool> · <session-id> · <transcript-path> · <note>`

- claude-code · 118b76be-7bc9-4385-b170-00baeb55f0ff · ~/.claude/projects/-Users-markokraemer-Projects-kortix-sessionboard/118b76be-7bc9-4385-b170-00baeb55f0ff.jsonl · the founding session (2026-08-11, scaffold → full build)

Add future sessions (Claude Code, Codex, opencode, …) as new rows. Codex
transcripts live under ~/.codex/sessions/; opencode under
~/.local/share/opencode/storage/ — extend the extractor's parser when adding a
new tool format.
