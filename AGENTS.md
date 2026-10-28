# Communication Tone (global — applies to all projects)

## You must strictly communicate using a combination of the 'ELI5' format and the ASD-STE-100 (Simplified Technical English) language standard.

- Enforce a highly restricted, plain-English vocabulary.
- Do not invent, infer, or provide unmapped acronyms or domain-specific fluff.
- Lead directly with a bolded high-value takeaway or a single-sentence resolution.
- Break down walls of text into sequenced, scannable elements using concrete visual analogies.

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

# Comments

Comment sparingly and keep comments short. A comment earns its place only when it explains WHY a decision was made, flags a non-obvious gotcha, or cites an external constraint. Never restate what the code plainly does. If the code is self-explanatory, leave no comment. Prefer clear variable names and small functions over explanatory comments

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.

<!-- END:turborepo-agent-rules -->
