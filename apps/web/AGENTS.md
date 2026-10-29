This file adds rules for `apps/web`. Tree, imports, and routes: [README.md](README.md).

If `AGENTS.local.md` sits beside this file, read it and follow it. It holds tone and private notes. Do not commit it.

# Commands

```bash
pnpm --filter @opulent/web typecheck
pnpm exec vitest run apps/web/src/<file>.test.tsx
pnpm --filter @opulent/web dev:mock
```

`dev:mock` runs the UI with no API. Run `pnpm test:e2e` only when the browser flow changes.

# Data

Use `@opulent/shared` for contracts. Fetch through `src/api/client.ts`. Query keys live in `src/api/queryKeys.ts`. Server state is TanStack Query.

# Imports

Feature folders stay flat. A feature `index.ts` does not use `export *`. Import boundaries stay as written in [README.md](README.md).

# Tests

Tests sit next to source. Vitest project name is `web`.

# Frontend layout

When you change a screen, start from the phone and then add space for a wider window.

- The first styles are for a narrow screen. Use `sm` and `md` only to relax those styles, not to repair a desktop layout that breaks on a phone.
- A row of buttons, fields, or bar items must wrap or stack. Nothing should sit past the edge of the screen.
- Titles, binder names, and usernames must be allowed to wrap or shorten. Do not give them a fixed width that assumes a wide window.
- Touch targets stay easy to tap. Do not shrink a button just so a row fits.
- Write the layout for a phone and for a wider window. Do not open a browser to check the screen. The owner does that check.

# UI copy

Do not add helper sentences under a section title. The purpose of a section must be clear from its title, its controls, and its data.

- No subtitles such as "Ranked by the price of one copy" or "The biggest gains and drops in the chosen window."
- A short control label ("Window", "Split by") is fine. A sentence about what the section does is not.
- If data needs context, put it in the data, a tooltip, or a label. Do not write a paragraph.
- When you touch a section, remove this kind of helper text.
