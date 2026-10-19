# Shaun GPT

My personal fork of the Raycast [ChatGPT extension](https://www.raycast.com/abielzulio/chatgpt) (`abielzulio/chatgpt`). It installs locally as **Shaun GPT** (`shaun-gpt`, author `shaun`) from the `scp-forks/extensions` repo. No Raycast account is needed.

## What's different from upstream

**Dash cleanup.** Every AI response (Ask, Conversations, AI commands, Summarize, image commands) goes through `normalizeDashes` (`src/utils/index.ts`) before it's shown, copied, pasted, spoken or saved:

| Input | Output | Example |
|---|---|---|
| Em-style dashes `— ― ⸺ ⸻ ︱ ﹘` | ` - ` (absorbs surrounding spaces) | `button—it` → `button - it` |
| All other Unicode dashes (`\p{Pd}`: en, figure, hyphens, fullwidth, ...) and minus `−` | `-` (spacing kept) | `10–20` → `10-20`, `a – b` → `a - b` |

It's applied in `src/hooks/useChat.tsx` (streaming and non-streaming) and `src/views/vision.tsx`. It runs on the whole accumulated text, not on each stream chunk, because a space and a dash can arrive in separate chunks. Your own input is never modified.

**Import/Export AI Commands.** In Search AI Command → ⌘K. Import accepts either an AI Commands export or an upstream **Models** export: upstream mirrors each AI command into Models as `command-<id>`. Command IDs are kept, and imports merge into your existing commands rather than replacing them.

**Upstream bug fixes:**
- Import Models crashed on the extension's own export format, which is an object keyed by ID, not a list (`src/model.tsx`).
- The edit forms for AI commands and models showed and saved `gpt-5-nano` instead of the stored model. The API model list loads asynchronously, and a Raycast dropdown whose value isn't among its items silently switches to the first one. Fixed by `withSelectedOption` (`src/hooks/useModel.tsx`).

**`package.json`:** name, title and author changed. I removed the hard-coded `"subtitle": "ChatGPT"` on six commands, so all commands show "Shaun GPT".

## Build and install

```bash
cd extensions/chatgpt
npm ci                # fresh clone only
npm run build         # installs straight into ~/.config/raycast/extensions/shaun-gpt (NOT ./dist)
npm run dev           # (re)registers with Raycast; Ctrl+C once it prints "ready"
```

- After code changes, `npm run build` is enough. Run `npm run dev` once on a new machine or after changing `package.json`. No Raycast restart is needed.
- Don't use `npm run lint`: it looks up `author` in the Raycast Store and fails. Use `npx tsc --noEmit && npx eslint src && npx prettier --check src` instead.
- `./dist` is a stale build and is unused.

## Quicklinks

```
raycast://extensions/shaun/shaun-gpt/search-ai-command?context=<url-encoded {"commandId":"<id>"}>
```

The easiest way to get one is Search AI Command → select command → ⌘K → **Save as Quicklink**. Changing `name` or `author` in `package.json` breaks every existing quicklink.

- **Rewrite** is the renamed built-in "Fix Spelling and Grammar" (ID `default-fix-spelling-and-grammar`). Never use **Reset** or **Delete All** on it, because both restore the original prompt. To make it safe, use ⌘D to duplicate it into a Custom command and point the quicklink at the copy.

## The old extension

The store ChatGPT and a leftover April dev copy (both `abielzulio/chatgpt`) are **disabled, not uninstalled**, in Raycast Settings → Extensions. Their history, saved answers, commands and settings are intact; re-check them to bring them back. Don't uninstall them, because uninstalling deletes their data permanently. Each extension's data lives in Raycast's encrypted LocalStorage and isn't shared between extensions.

## Pulling upstream changes

```bash
gh repo sync scp-forks/extensions --branch main   # update the fork from raycast/extensions
git fetch origin && git merge origin/main         # on this branch
```

Expect occasional conflicts only in `package.json`, `useChat.tsx`, `vision.tsx` and the two edit forms. Then rebuild.
