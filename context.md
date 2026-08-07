# Forge IDE - Development Context & Progress

## 1. What Have We Achieved So Far?

- **Terminal Stability (Backend/Frontend):**
  - `portable-pty` and `russh` integrated smoothly.
  - Local, WSL, and SSH environments successfully spin up terminals.
  - xterm.js SSR crashes fixed. Resizing and input/output pipes are completely stable.
- **Resizable Panels:**
  - Fixed Vite SSR compatibility with `react-resizable-panels` (Pinned to `v2.1.9`).
  - File Explorer, Editor, AI Panel, and Terminal are now fully adjustable.
- **AI Panel UI & State (Premium IDE Experience):**
  - **Chat Modes:** Added Ask, Plan, Code, and Debug modes.
  - **Drag & Drop + Paste:** Users can drag & drop files or `CTRL+V` images directly into the chat input.
  - **Context Budget UI:** Added a live token estimator directly in the chat panel showing usage out of max limits (turns orange/red near limits).
  - **Actionable Chat Messages:** Added Edit (Pencil) for user messages and Regenerate (Refresh) for AI messages. Fixed double-prompting loop bugs.
  - **Thinking Animation:** Real-time bouncing dot animation while waiting for the first chunk of stream.
  - **Persistent Chat History:** Integrated Zustand's `persist` middleware. Chat history survives page reloads. _(Note: History currently uses `localStorage`, moving to SQLite is pending)._
- **Settings & Customization (`/settings`):**
  - **Model Management:** Configured Advanced Settings UI (Temperature, Repetition Penalty, Context Window, Max Tokens, KV Cache, and custom stop tokens).
  - **Jinja Templates:** Handled HuggingFace chat templates (bos_token, start_of_turn, end_of_turn) for Gemma models natively to prevent infinite generation loops.
  - **Profiles & MCP:** UI added for custom personas and Model Context Protocol integrations.
- **Rust Backend AI Provider (`ai_provider.rs`):**
  - **Context Priority Manager (Rust):**
    - Implemented strict Token and Context Budgeting.
    - **Architecture:** We calculate tokens for System Prompt, New User Prompt, reserve `output_reserve_tokens` (max_tokens) and `safety_margin_tokens` (500). Then, we parse `chatHistory` _backwards_ and drop any old messages that exceed the remaining `budget_for_history`.
    - This directly solves the massive KV Cache / Apple Silicon memory saturation issue on long chats!
  - **Move Chat to SQLite:**
    - Shifted the "Single Source of Truth" for chat sessions and messages from Zustand's `persist` (localStorage) to the Rust backend (`forge.db` SQLite).
    - Added `chat_sessions` and `chat_messages` tables.
    - The frontend now loads chat history directly from the backend on connect (`GetChatSessions`) and fetches full conversation details when a chat is clicked (`GetChatMessages`).
  - Successfully created standard OpenAI-compatible `/chat/completions` API consumer via `reqwest`.
  - Implemented true WebSockets Server-Sent Events (SSE) streaming (`AiChatStreamResponse`).

## 2. What Is Next? (To-Do List)

**Phase 1 Completed: The Developer Loop (Diff / Apply / SSH)**

- **Backend Connection Stability:** Resolved a critical WebSocket routing mismatch (Vite proxy vs Rust Warp) that caused an infinite reconnect loop in the frontend. The IDE now reliably maintains a stable WebSocket connection (`ws://0.0.0.0:3030/ws`).
- **Intelligent Path Extraction:** Implemented strict System Prompts ("System Injection") in Rust to force the LLM to output the target file path in the first line of code blocks. Replaced naive regex with robust parsing (`/```([a-zA-Z0-9_-]*)[ \t]*\r?\n([\s\S]*?)```/g`).
- **Diff & Apply System:** Users can click "Apply" on AI-generated code blocks.
- **Remote & Local Sync:**
  - If a file path exists, the IDE opens it in Monaco, applies the diff, clears the `dirty` flag, and automatically writes the file to the target environment (`WriteFile` or `SftpWriteFile`).
  - **Auto-Directory Creation:** Rust backend recursively creates missing parent directories for both Local (`std::fs::create_dir_all`) and SSH (`russh_sftp::create_dir`) environments.
  - **Untitled Fallback:** If the AI fails to provide a path (or creates an "untitled" file), the IDE opens it in memory but alerts the user with a Toast that manual saving is required.

## 2. What Is Next? (To-Do List)

**Phase 2 (Agentic Autonomy): Multi-Agent Architecture (Researcher & Coder)**

- **Knowledge Base Foundation (Done):** The Rust backend now supports `InitKnowledgeBase`, `SaveKnowledge`, and `GetKnowledge` requests, automatically managing a `.forge/knowledge/` directory in the active project.
- **Dual-Agent System (Native Integration - IN PROGRESS):** Build a native multi-agent system consisting of a Main Agent (Coder) and a Sub-Agent (Researcher/Data Pre-processor).
  - _Sub-Agent (Researcher):_ Uses local machine resources (Rust backend) to scrape the web, read PDFs/Markdown, and crawl the codebase (via AST parsing). It extracts _only_ the necessary APIs, examples, and constraints, saving them as synthesized Markdown files in `.forge/knowledge/` and registering metadata in `forge.db`.
  - _Main Agent (Coder):_ Receives only the highly-refined, low-token context from the Sub-Agent. It focuses purely on architecture and code generation.
- **Why Not Just Standard MCP?** While MCP tools will be supported, the core Sub-Agent workflow will be deeply integrated into the IDE engine to optimize local LLM token usage natively. Instead of sending 50K tokens of raw documentation to Gemma-4 via an MCP tool, the Sub-Agent acts as a firewall, compressing 50K tokens into 2K tokens of pure logic.
- **MCP Execution:** Wire up the user-defined MCP tools list from `/settings` to allow the Main Agent to execute basic sub-processes via Rust Core when needed.

**Phase 3 (Advanced Context Manager - "The Vision"):**

- **Priority Queue System:** Implement `ContextItem { source, priority, tokens }` to rank context (User Code > Current File > Dependencies > Chat History).
- **Conversation Summarizer:** Instead of just truncating old chat history when the budget is full, compress it into a summary (e.g., "User asked to fix X, we tried Y") to retain long-term memory.
- **AST / Tree-sitter integration:** Only send relevant functions/structs to the LLM instead of entire 3000-line files.
- **Context Preview UI:** Add a debug pane so the user can see exactly how their token budget is being spent in real-time.

## 4. Phase 5.1: Hardening & Reliability (Current Progress)

- **Scraper Quality Improvements:**
  - Optimized CSS selectors for DuckDuckGo HTML to be more robust and flexible.
  - Transitioned from simple snippets to structured Markdown output for better LLM parsing.
  - Increased search result limit from 7 to 10 to provide broader context.
- **LLM Generation Stability:**
  - Increased default output token limit from 2048 to 4096 to accommodate long reasoning (`<think>`) blocks in models like Gemma-4.
  - Implemented safety clamping for token limits to prevent exceeding the total context window.
- **AI Stream Control (Stop/Resume):**
  - Introduced `CancellationToken` registry in the backend to allow abrupt termination of active AI tasks.
  - Added `StopAiGeneration` WebSocket request to trigger immediate abortion of the generation loop.
- **Sub-Agent Triggering & Identity:**
  - Shifted from "strict constraints" to "identity-based delegation".
  - Defined sub-agents as a team: **The Researcher** (Web Search) and **The Data Fetcher** (URL Scraping).
  - Modified system prompts to encourage the Lead Architect (Main Agent) to delegate to these specialists for current/version-specific data.
- **Pending Issues:**
  - **Ghost Stream Bug:** Despite backend cancellation logic, overlapping responses occasionally occur when stopping and restarting a query. Likely requires frontend verification (ensure `StopAiGeneration` is sent) or deeper provider-level abort analysis.
