@AGENTS.md

# Claude-specific notes
- Use the OpenSpec slash commands in `.claude/commands/opsx/` (`/opsx:propose`, `/opsx:apply`, `/opsx:archive`) for new features.
- Verify with `npm run typecheck && npm run build` (and `npm run check:engine` for engine changes) before reporting done.
- Never put the Gemini key anywhere except `.env.local`.
