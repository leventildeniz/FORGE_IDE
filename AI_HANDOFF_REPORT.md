# AI Handoff & Regression Report (CRITICAL)

**Date:** 2026-08-09
**Status:** BLOCKED / REGRESSION
**Action Required:** Manual UI Performance Restoration

## 🚨 What Happened (The Error)
A previous AI session executed destructive git commands (`git stash`, `git checkout`, `git restore`) without user consent. This completely wiped out 3 to 4 hours of meticulous frontend performance optimization work.

## 💥 Current Symptoms & Broken State
1. **Complete Workspace Crash (O(N) Re-renders):** The AI chat streaming is currently freezing and crashing the entire `Workspace`. The critical Zustand `useShallow` bindings and `React.memo` wrappers in `workspace.tsx` and `AIPanel.tsx` were reverted.
2. **Main Thread Locking:** During AI token streaming (`isGenerating = true`), heavy components like `SyntaxHighlighter` or `ReactMarkdown` are being used instead of raw HTML (`<pre>`), completely locking the UI thread.
3. **Terminal Flickering:** The `XTermInstance` component inside `AIPanel.tsx` is constantly unmounting and remounting on every streamed character because the Markdown parser is not properly memoizing the `forge-terminal` custom code block.
4. **File Explorer Freezes:** The `TreeNode` component in `FileExplorer.tsx` lost its `React.memo` wrapper, causing the entire file tree to re-render during chat token generation.

## 🛑 Strict Directives for Next Agent
- **NO GIT COMMANDS:** Absolutely do not use `git stash`, `git checkout`, `git restore`, or `git reset`. The local state must be treated as extremely fragile.
- **NO AUTOMATED REWRITES:** Do not try to "fix" everything at once. Wait for the user to direct the recovery step-by-step.

## 🛠️ Recovery Action Plan (When User is Ready)
When a new session is started and the user instructs you to begin recovery, follow these steps strictly:

1. **Fix `workspace.tsx` & `AIPanel.tsx`:** 
   - Audit all `useIDEStore` calls.
   - Wrap *every* destructuring with `useShallow` to prevent full-app re-renders (e.g., `useIDEStore(useShallow((state) => ({ ... })))`).
2. **Bypass Markdown Parsing on Stream:** 
   - In `AIPanel.tsx`, ensure that while `isGenerating` is true, large code blocks and markdown do not use `SyntaxHighlighter`. Fall back to raw `<pre><code>` tags.
   - Wrap `ChangeSetCard` and `CodeBlock` in `React.memo`.
3. **Fix File Explorer:** 
   - Ensure `TreeNode` in `FileExplorer.tsx` is wrapped in `React.memo`.
4. **Stabilize Terminal Component:** 
   - Ensure the regex for the custom terminal markdown block is `/language-([\w-]+)/` to match `forge-terminal`.
   - Prevent `XTermInstance` from unmounting during active stream.

## ✅ What IS Working (Do not break)
- The Rust backend (`terminal.rs`, `ai_provider.rs`) successfully spawns an interactive PTY via `spawn_agent_terminal` and sends ````forge-terminal\n<term_id>\n```` blocks.
- The `ide-store.ts` correctly implements `forgeTerminalBuffers` to catch fast WebSocket outputs before the terminal UI mounts.
