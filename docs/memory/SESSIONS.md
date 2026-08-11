# Session registry

Every agent session that built this project. `scripts/extract-prompts.mjs` reads
this file and regenerates PROMPTS.md from the transcripts (raw user inputs only).

Row format (keep exactly): `- <tool> · <session-id> · <transcript-path> · <note>`

- claude-code · 118b76be-7bc9-4385-b170-00baeb55f0ff · ~/.claude/projects/-Users-markokraemer-Projects-kortix-sessionboard/118b76be-7bc9-4385-b170-00baeb55f0ff.jsonl · the founding session (2026-08-11, scaffold → full build)
- claude-code · 83a5b5a1-d91e-408d-b337-5efb2db29b66 · ~/.claude/projects/-Users-markokraemer-Projects-kortix-sessionboard/83a5b5a1-d91e-408d-b337-5efb2db29b66.jsonl · continuation of the founding session (2026-08-11, mega-waves → sbek hill-climb → launch prep)
- claude-code · 021fe28b-5b5b-4d0b-ab44-8896eba50c69 · ~/.claude/projects/-Users-markokraemer-Projects-kortix-sessionboard/021fe28b-5b5b-4d0b-ab44-8896eba50c69.jsonl · side session (2026-08-11)
- claude-code · ed1dc323-5f5d-48a2-a715-c561271dee2c · ~/.claude/projects/-Users-markokraemer-Projects-kortix-sessionboard/ed1dc323-5f5d-48a2-a715-c561271dee2c.jsonl · side session (2026-08-11)
- claude-code · c6ee6f3e-07ab-4730-9776-190cc71b4b57 · ~/.claude/projects/-Users-markokraemer-Projects-kortix-sessionboard/c6ee6f3e-07ab-4730-9776-190cc71b4b57.jsonl · side session (2026-08-11)
- claude-code · ca3e4acd-dff4-4716-ad3b-816f82556923 · ~/.claude/projects/-Users-markokraemer-Projects-kortix-sessionboard/ca3e4acd-dff4-4716-ad3b-816f82556923.jsonl · side session (2026-08-11)

Add future sessions (Claude Code, Codex, opencode, …) as new rows. Codex
transcripts live under ~/.codex/sessions/; opencode under
~/.local/share/opencode/storage/ — extend the extractor's parser when adding a
new tool format.
