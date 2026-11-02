@AGENTS.md

# Claude-specific notes
- Use the OpenSpec slash commands in `.claude/commands/opsx/` (`/opsx:propose`, `/opsx:apply`, `/opsx:archive`) for new features.
- Verify with `npm run typecheck && npm run build` (and `npm run check:engine` for engine changes) before reporting done.
- Keep the Gemini key only in `.env.local` (local) or Vercel's server-side environment variables (hosted). Never put it in the repo, a `VITE_` variable or chat.
