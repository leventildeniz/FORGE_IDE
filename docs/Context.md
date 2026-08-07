# FORGE IDE - Development Context & Status

_Last Updated: 2026-08-03_

## 🎯 Recent Achievements (Phase 2)

1. **Knowledge Base UI (`@` Mentions)**:
   - Integrated the `.forge/knowledge/` directory into the frontend.
   - Typing `@` successfully lists scraped documentation.
   - Selected files are visually represented as UI pills (e.g., `[📚 reqwest_api.md]`) and successfully injected into the AI's context.

2. **Snippet Saving (Untitled Fix)**:
   - Resolved the issue where the IDE refused to save code blocks if the model forgot to provide a file path (`untitled.bash` issue).
   - The system now gracefully falls back to generating a unique `snippet_xyz.ext` path, ensuring code is always safely written to disk.

3. **Streaming & UI Refactoring**:
   - Upgraded the React Markdown parser in `AIPanel.tsx` to handle custom attachments and prepare the groundwork for live `<think>` process streaming.
   - Fixed Vite crash issues caused by duplicate UI icons.

## 🎯 Recent Achievements (Phase 3)

1. **Fixed Token Bloat (KV Cache Hits)**:
   - System prompt, knowledge base, history, and active file are now assembled in a STRICT order (`ai_provider.rs`) to ensure Prefix Caching / KV Cache is preserved for local LLMs (MLX/Ollama).
   - "Ask" mode vs. "Code/Plan" mode logic was added. Heavy instructions (Sub-Agent, Code Paths) are excluded from the basic "Ask" profile.
   - **Crucial Fix:** "Active File" context is now explicitly stripped from "Ask" mode. This solved the hallucination issue where the model randomly generated React Login Forms when simply greeted.

2. **UI Streaming Optimization & Vite Crash Fix**:
   - Implemented a 50ms throttle/debounce buffer in `ide-store.ts` for `AiChatStreamResponse`. The React UI no longer crashes Vite (`Maximum update depth exceeded`) during high-speed local inference.

3. **Dynamic Model Parameters (Model Adapter Pattern)**:
   - Stripped all hardcoded, forced "thinking" prompts from the Rust core to respect the "User owns the system" philosophy.
   - Connected the UI's `customParams` (Additional Parameters) directly to the Rust HTTP Payload builder. Users can now pass native flags (e.g., `enable_thinking: true`, `reasoning_effort: medium`) directly to the provider (MLX/Ollama).
   - Upgraded the React Markdown regex to dynamically catch `<think>`, `<|think|>`, `<thought>`, and `<reasoning>` tags if the model natively emits them.

## 🎯 Recent Achievements (Phase 4)

1. **Thinking Stream Captured and UI Perfected**:
   - **X-Ray Discovery**: Enabled raw chunk logging and discovered that MLX sends thinking processes through a specific JSON field (`"reasoning": "..."`) rather than embedding `<think>` tags inside standard content.
   - **Backend Adapter Update**: Updated `ai_provider.rs` to correctly parse `reasoning` (MLX format) and `reasoning_content` (DeepSeek format) natively, injecting `<think>` tags on the fly.
   - **UI Improvements**: Transformed the "Thinking process" visual block from a static `<div>` to an elegant, collapsible `<details>` and `<summary>` element. Added bouncing dots animation during active generation, and compressed line-heights/margins via Tailwind Typography to keep thinking logs compact.
   - **Context Budget Protection**: Explicitly filtered out "thinking" stream components from being saved to the SQLite chat history (`ide-store.ts`). This guarantees the model's token budget is preserved across turns and prevents hallucination spirals caused by the model reading its own past internal monologues.

2. **React UI Bottleneck Resolved**:
   - Discovered and purged a massive 1300-line hardcoded mock JSON array in `ide-store.ts` that was causing severe UI paralysis.
   - Applied `React.memo` correctly to the Chat Message component. Together with the mock data purge, this resolved the `Maximum update depth exceeded` loops and "sluggish" behavior during streaming, drastically reducing CPU/RAM spikes on the host machine.

## 🎯 Recent Achievements (Phase 5 - Context & Sub-Agents)

1. **Dynamic Context Allocator (Budget Manager) Completed**:
   - Added UI in Settings to control Context Manager strategy (Auto, Prefer Codebase, Prefer History, Custom).
   - Backend `ai_provider.rs` now dynamically calculates and enforces strict `file_budget_tokens` and `knowledge_budget_tokens`.
   - Files exceeding the budget are safely truncated (`[TRUNCATED DUE TO CONTEXT LIMIT]`) preserving exact token counts and preventing Mac/PC OOM crashes.

2. **Autonomous Sub-Agent (API-Free Search & Fetch)**:
   - Replaced fragile XML tagging with foolproof brackets syntax (`@@SEARCH: query@@` and `@@FETCH: url | topic@@`).
   - The React UI Regex intercepts these commands instantly, stops the streaming, and passes the baton to the Rust backend.
   - Built a native, zero-cost DuckDuckGo scraper in Rust (`knowledge::search_web`) using `reqwest` and `scraper`.
   - The UI auto-continues the conversation, injecting the retrieved `.md` files directly into the LLM context seamlessly.
   - Fixed the React `streamBuffer` loop bug that was causing massive CPU spikes during sub-agent interruptions.

## 🚨 Critical Issues to Resolve (Current Blockers)

1. **Scraper HTML Extraction Quality**:
   - *Problem*: The DuckDuckGo scraper creates the `.md` file, but it occasionally fails to extract meaningful text (like specific currency exchange rates or widgets), leaving the model with an empty or useless knowledge file.
   - *Next Step*: Improve the CSS selectors in `knowledge::search_web` or use a more robust parsing mechanism for search engine results.

2. **Post-RAG Thinking Freeze**:
   - *Problem*: After the Sub-Agent fetches data and the UI auto-continues the prompt, the main LLM enters a secondary `<think>` phase to process the new data but sometimes freezes, gets cut off, or enters a loop without finishing the response.
   - *Next Step*: Debug token limits (`output_reserve`) or investigate if stopping the stream abruptly corrupts the LLM's internal state on the provider side.

3. **AST / Codebase Crawler Sub-Agent**:
   - Once basic web searching is completely stable, implement the `read_file` or `search_codebase` Sub-Agent logic so the model can autonomously navigate the local project topology without needing the user to open tabs.

## 🧠 Architecture Reminder

- **Main Agent (Gemma/Qwen/DeepSeek)**: Should focus ONLY on reasoning, logic, and coding. Must be protected from context bloat.
- **Sub-Agent (Scraper/Tools)**: Handles heavy lifting, fetching documentation, and summarizing it _before_ the Main Agent sees it.
- **Context Manager**: A dedicated layer in Rust that manages priority, token thresholds, and prefix-caching order.
