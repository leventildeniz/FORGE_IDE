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

## ✅ Current State (Stable)
- **Interactive Terminal:** Fixed the severe UI deadlock where the `forge-terminal` UI component was trapped behind Zustand's stream-throttling buffer. AI tools that require interactive inputs (like `sudo`) now bypass the throttle and render instantly (`flushStreamBuffer`), preventing backend 45s timeouts.
- **UI Crash Immunity:** Wrapped `PartView` and `XTermInstance` with a custom `LocalErrorBoundary`. If a markdown parsing or layout shift error occurs during heavy token streams, the app will gracefully display a red "UI Crash" box on that specific message block instead of tearing down the entire `Workspace`.
- **Send Button Unlocked:** The "Send" button is no longer locked out when the AI is streaming. Users can now queue up follow-up messages while the AI is typing.
- **Removed Lovable:** Completely purged all Lovable remnants, configs, and dependencies. Restored raw TanStack Start and standard Vite configurations.
- **Context Limit Fixed:** The UI now dynamically respects the actual model's `contextWindow` limit (e.g., 128k) instead of hardlocking at 8192 tokens.
