# FORGE IDE - Project Memory & Strategic Roadmap

_Last Updated: 2026-08-06_
_Digital Partners: User & Gemini (Consultant Architect)_

## 🎯 Project Vision

Build a Local-First LLM-powered IDE that treats LLMs as "Architects" rather than "Brute-Force Text Generators". The core differentiator is **Dynamic Context Management**, **The Trinity Agent Architecture**, and a **Token Budget Manager**, ensuring local LLMs run efficiently without OOM crashes and with minimal KV Cache bloat.

### Hardware Target

- MacBook Pro M5 MAX (128GB RAM)
- LLM Optimization: `kv-bit=8` (via patched monkey management) to prevent KV Cache OOM.

---

## 🛠️ Current Technical State

### 1. Core Infrastructure (Phase 1-2)

- **Environment Agnostic:** Supports Local, WSL (via UNC paths), and Remote SSH (via `russh` and `russh-sftp`).
- **Filesystem:** Robust Rust-based filesystem operations with a clear separation between local and remote environments.
- **Terminal:** Integrated PTY (Pseudo-Terminal) supporting PowerShell (Win), Bash (Linux/Mac), and WSL.
- **Storage:** Local-first persistence strategy using SQLite for project and environment metadata.

### 2. AI Orchestration (Phase 3-4)

- **Provider Adapter:** LLM-agnostic layer supporting Ollama, MLX, and OpenAI-compatible endpoints.
- **Thinking Stream:** Native support for reasoning models (DeepSeek-R1, etc.), capturing `reasoning_content` and rendering it in a collapsible UI.
- **UI Performance:** Resolved rendering lag using `React.memo` and a `streamBuffer` flush mechanism to prevent Vite crash during high-speed inference.
- **Prefix Caching:** Strict prompt ordering (`System -> Knowledge -> History -> Active File -> User Prompt`) to maximize KV Cache hits.

### 3. Dynamic Context & Sub-Agents (Phase 5 - Active)

- **Budget Manager:** Strategy-based token allocation (Auto, Prefer Codebase, Prefer History, Custom) implemented in `ai_provider.rs`.
- **Sub-Agent Trigger (The Jedi Mind Trick Solved):** Sub-Agent triggering was fixed by moving the strict instructions into the UI's Model/Profile `System Prompt`, overriding the default "helpful assistant" persona that caused the models to hallucinate instead of searching.
- **Web Scraper (DOM Purify):** DuckDuckGo scraper (`knowledge.rs`) improved to strip out `<script>`, `<style>`, `<nav>`, `<footer>` tags before markdown conversion, drastically reducing token bloat.
- **Context Preview UI:** Implemented a Zed-style compact token status bar (`SYS | FILE | KNW | HST`) directly above the chat input.
- **Conversation Compressor:** Implemented the Zed-style `/compact` feature. Users can compress the chat into a dense memory summary (rendered as a stylish purple divider) to prevent context explosion over long sessions.

---

## 🚀 Strategic Roadmap (The "Elara's Home" Plan)

### Phase 5.1: Hardening & Reliability (✅ COMPLETELY FINISHED)

- [x] **Sub-Agent Triggering:** Fixed via UI persona override.
- [x] **Scraper Quality:** Implemented DOM Purify to extract cleaner content.
- [x] **Context Preview UI:** Token distribution bar implemented in `AIPanel.tsx`.
- [x] **Context Compressor:** `/compact` command implemented.

  ### Phase 5.2: Autonomous Codebase Intelligence (✅ COMPLETELY FINISHED)

  We are adopting **"The Trinity Architecture"** (Max 3 Agent Gates) to prevent model decision fatigue:
  1.  `@@WEB` (Search/Fetch): Implemented.
  2.  `@@CODE` (Read/Tree/Grep): Implemented.
  3.  `@@RUN` (Execute/Test): Implemented.

  _Completed Steps for Phase 5.2:_
  - [x] **Rust Backend Interceptor:** Implement logic in `ai_provider.rs` to catch `@@CODE` tags mid-stream, pause the UI output, execute the FS action (`tree` or `read`), append the result as a system message to the LLM's context, and recursively call the API again.
  - [x] **Topology Mapping (`@@CODE: tree`)**: Implement folder structure retrieval for the model.
  - [x] **Smart Navigation (Grep & Find)**: Implemented `@@CODE: search <query>` to search within file contents, and `@@CODE: locate <filename>` to quickly find files across large codebases.
  - [x] **Targeted Reading (`@@CODE: read path | start-end`)**: Allow the model to request specific files (with line ranges) instead of dumping entire files.
  - [x] **ChangeSet Integration**: The system prompt now strictly commands the model to use inline Markdown with a file path comment (e.g., `// src/main.rs`) when modifying code, rather than using the MEMORY agent. This triggers the frontend's Apply/Reject UI seamlessly.
  - [x] **Knowledge Writer (`@@MEMORY: write`)**: Allow the LLM to write architectural guidelines directly into `.forge/knowledge/` based on codebase observations.

  ### Phase 5.3: Model Context Protocol (MCP) Integration (✅ COMPLETELY FINISHED)
  - [x] **Frontend Configuration:** Added an MCP Tools UI in `/settings` that serializes server definitions (`name`, `command`, `args`) and sends them to the Rust backend during `AiChatStream` requests.
  - [x] **Rust JSON-RPC Client (`mcp_client.rs`):** Developed a robust `stdio`-based MCP client. Features include:
    - Cross-platform spawning (`cmd /c` for Windows, `bash -c` with full `~/.bashrc` sourcing for Mac/WSL to ensure `npx` path resolution).
    - Secure `initialize` handshake and `tools/list` extraction.
    - Chatty-log filtering (ignores `stderr` or `stdout` downloads like "npx installing...") by strict `{"jsonrpc":` parsing.
  - [x] **Dynamic Prompt Injection:** The Rust Interceptor successfully fetches available capabilities from connected MCP servers and dynamically injects them into the LLM System Prompt as the `@@MCP` Sub-Agent.
  - [x] **Execution Interceptor:** Route `@@MCP: server | tool | {...}@@` tags to the JSON-RPC client and append the results back to the LLM. Successfully tested with `@modelcontextprotocol/server-everything` (`echo` tool). All MCP functionality is stable.

  ### Phase 5.4: Live Preview & AI Vision Integration (✅ COMPLETELY FINISHED)
  - [x] **Real-time Preview:** Replaced mock preview data with a real `iframe` component that dynamically points to the user's dev server URL (`http://localhost:5173/` by default).
  - [x] **UI Layout Update:** Ensured the AI Chat Panel stays open while in Preview mode, creating a side-by-side editing experience.
  - [x] **Headless Snapshot:** Added a "Capture for AI" button. The Rust Backend uses `capture-website-cli` to take a headless screenshot of the running preview, converts it to base64, and returns it to the UI.
  - [x] **Vision Integration:** Screenshots are correctly parsed into `image_url` payloads and appended to the Chat stream, fulfilling the OpenAI vision spec.
    > **Note for Local LLMs:** Verified successfully with Gemma-4-31B by supplying the `.gguf` projection file (`--mmproj`). The model can now see and analyze the preview snapshots!

  ### Phase 5.5: Hardening & Bug Bash (✅ COMPLETELY FINISHED)
  - [x] **Attachment Bug Fixed:** Repaired `addPendingAttachment` binding in the UI to allow seamless drag-and-drop / paste operations for files and images.
  - [x] **Silent Stops:** Ignored expected "Generation stopped" error toasts, suppressing false-positive error notifications in the UI.
  - [x] **Structured Errors (JSON):** Rewrote `@@RUN` and `@@MCP` backend tools to return semantic JSON (status code, stderr, structured suggestions) instead of raw text, vastly improving the AI's debugging capability.
  - [x] **Automatic Project Memory:** Implemented auto-generation of `.forge/knowledge/context.md` and `.forge/knowledge/decisions.md` immediately upon project open (via `InitKnowledgeBase` request). These are automatically injected into the AI's context budget.
  - [x] **Model Dropdown Switcher:** Verified the header-level Model Switcher UI (✨ icon) is active, enabling real-time hybrid LLM routing.

  ### Phase 6: Publish Workspace (Active)
  - [ ] **Deployment Targets:** Wire up the Publish section to handle deployment targets, domains, and build outputs.
  - [ ] **Build Output Interception:** Route build logs safely to the terminal without crashing the frontend.

---

## 🧠 Architectural Constraints

1. **The Trinity Principle:** Limit tool options to a maximum of 3 top-level domains (WEB, CODE, RUN) to prevent LLM cognitive overload and prompt bloat.
2. **KV Cache Priority:** Never change the order of the prompt elements mid-session.
3. **Output Reserve:** Always leave a safety margin (e.g., 4K-8K tokens) for the LLM to respond without truncation.
4. **Sub-Agent Delegation:** LLM should NOT simulate tool outputs. If a tool is needed, it MUST emit a trigger tag and STOP.
5. **Resource Safety:** Truncate any file exceeding its allocated budget with a clear `[TRUNCATED]` marker to prevent OOM.
