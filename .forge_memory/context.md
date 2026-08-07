# FORGE IDE - Handoff Document (Phase 8 -> 9)

**Goal**
Finalize "Forge IDE" v1.0 (a Local-First LLM-powered IDE). Complete Phase 8 (Hardening, Code Cleanup, and Security) and transition into Phase 9 (Documentation & Release).

**State**
- **UI/UX & Mock Data ✅:** Removed all "Lovable" artifacts, mock data panels (Problems/Output), and unused `.Identifier` metadata files. Replaced the generic logo with a custom "Anvil" SVG.
- **AI Chat Queue ✅:** Built a Zed-style message queue. If the AI is streaming and the user types, a prompt allows them to "Interrupt & Send" or "Add to Queue", preventing overlapping backend API calls.
- **Security ✅:** Implemented a "Master Password" Lock Screen to protect the IDE from local network access. Fixed a router crash related to unauthenticated redirects.
- **Git Pull ✅:** Implemented robust `git pull` logic in Rust that safely handles untracked files (using auto-stash/pop) and "unborn branch" edge cases.
- **Production Backend & SystemD ✅:** Replaced noisy `println!` spam with a toggleable `debug_log!` macro (Developer Mode). Configured `forge-backend.service` to run the optimized `--release` binary to fix Vite proxy `EPIPE` timeouts. Added `OOMScoreAdjust=-1000` to prevent the Linux kernel from silently killing the backend during high KV-cache usage.
- **Data Bleed (Cross-Project Chat) 🟡:** Fixed a severe bug where chat sessions bled across different projects. Added a `project_root` column to the `chat_sessions` SQLite table via automatic migration (`ALTER TABLE`). *Status: Code is deployed, but user must restart the release binary to test if ghost chats are fully isolated.*

**Context**
- **Architecture:** Rust backend (`forge-backend/`) + React/TypeScript/Zustand frontend (`src/`).
- **Memory:** The single source of truth for the project roadmap and constraints is `.forge_memory/context.md`.
- **The Trinity Principle:** The LLM is restricted to a maximum of 3 top-level sub-agent tags (`@@WEB`, `@@CODE`, `@@RUN`).

**Next**
1. **Verify Chat Isolation:** Confirm with the user if the "Data Bleed" fix is working after they execute `cargo build --release` and `sudo systemctl restart forge-backend.service`.
2. **Phase 9 (Documentation):** Write a comprehensive `README.md` explaining the architecture, the Trinity Agent system, and installation/run steps.
3. **Code Freeze:** Avoid adding new features ("feature creep"). Focus strictly on stability and documentation.

**Pitfalls (Do Not Repeat)**
- **SystemD + `cargo run`:** Running `cargo run` inside SystemD causes massive Vite proxy timeouts (`EPIPE`) because the frontend hits the proxy while the backend is still compiling. Always use the compiled binary in `.service` files.
- **OOM Silent Crashes:** SystemD aggressively kills memory-heavy AI processes without throwing errors (`Deactivated successfully`). Must use `LimitAS=infinity` and `OOMScoreAdjust=-1000`.
- **Git Pull over Untracked Files:** `git pull` will abort if auto-generated local files (like `.forge/knowledge/context.md`) conflict. Must wrap the pull command in `git stash push --include-untracked` and `git stash pop`.
- **Nested Zustand Sets:** Calling `set()` inside a `.map()` loop while the AI streams markdown causes state race conditions, completely erasing `ChangeSetCard` components from the UI. Accumulate state changes in a local variable and execute a single `set()` instead.
