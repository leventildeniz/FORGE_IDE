# Forge — UI Reference

This document describes the **frontend-only** user interface of Forge, an AI coding IDE inspired by DYAD's minimal, code-first philosophy. It covers the current UI structure, state management, design system, keyboard shortcuts, and the places where the future Rust Core backend will plug in.

> **Scope:** This is a UI/UX reference. It does not describe backend implementations, WebSocket protocols, SSH/WSL internals, GitHub API contracts, or AI model inference.

---

## 1. Product Overview

**Forge** is a minimal, dark-themed, code-first AI coding IDE. The interface is designed to keep the developer focused on code while providing an AI pair programmer, project preview, publish flow, and configuration for environments, GitHub, and AI models.

All UI text is in English. All state is managed directly in the frontend through Zustand stores and local component state. There is no mock service layer, fake API abstraction, or simulated backend.

### Future Architecture

```text
React / TanStack Start UI
        │
        ▼
    Rust Core
        │
        ├── Local machine
        ├── WSL
        └── Remote SSH
        │
        ▼
   AI Model Adapter
        │
        ├── Gemma 4 31B
        ├── Qwen
        ├── Llama
        └── Other local / remote / API models
```

GitHub is used as a project source / repository connection.

---

## 2. Routes & Navigation

Forge uses TanStack Start file-based routing.

| Route        | Purpose                                                              |
| ------------ | -------------------------------------------------------------------- |
| `/`          | Welcome / empty state: create project, open project, recent projects |
| `/workspace` | Main IDE shell with top-level workspace tabs                         |
| `/settings`  | Preferences: model, editor, theme, shortcuts                         |

Inside `/workspace`, a secondary tab bar switches between workspace views:

| Workspace View | Purpose                                                   |
| -------------- | --------------------------------------------------------- |
| **Preview**    | Embedded browser preview, device toggles, system messages |
| **Code**       | Explorer + Monaco editor + AI panel + bottom panel        |
| **Publish**    | Deploy target, domain, source, recent deploys             |
| **Configure**  | Environments, GitHub, AI models, general settings         |
| **More**       | Placeholder dropdown for Tests, Logs, Database, Analytics |

---

## 3. Global Shell

### 3.1 Topbar

The topbar is always visible inside `/workspace`.

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Forge  ·  Project  ·  ⌘K Search  ·  [Explorer] [Bottom] [AI]  ·  Env  ·  Model  ·  Theme  ·  ⚙ │
└─────────────────────────────────────────────────────────────────────┘
```

| Element                              | Behavior                                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| **Logo**                             | Link back to `/`                                                                             |
| **Project switcher**                 | Dropdown with New project, Open project, recent hint                                         |
| **Search / Command palette trigger** | Click to open command menu; shows `⌘K` shortcut                                              |
| **Panel toggles**                    | Toggle Explorer (`⌘B`), Bottom panel (`⌘J`), AI panel (`⌘I`)                                 |
| **Environment badge**                | Shows active environment (e.g., "This Mac · Local"). Click jumps to Configure → Environments |
| **Model badge**                      | Shows active model (e.g., "Gemma 4 31B · Local"). Click jumps to Configure → AI Models       |
| **Theme toggle**                     | Switches between dark and light mode                                                         |
| **Settings link**                    | Navigates to `/settings`                                                                     |

### 3.2 Workspace Tabs

A horizontal tab bar below the topbar switches the main workspace view:

```text
Preview · Code · Publish · Configure · More ▾
```

- The **Preview** tab shows a green dot when the dev server is running.
- **More** opens a dropdown with disabled placeholders: Tests, Logs, Database, Analytics.

### 3.3 Command Menu

Opened with `⌘K` / `Ctrl+K`.

Sections:

- **Files** — searchable list of all files in the current project tree; selecting opens the file.
- **Actions** — Save current file, Toggle explorer, Toggle AI panel, Toggle bottom panel, Ask AI about current file.
- **Navigate** — Go to welcome, Open settings.

---

## 4. Code Workspace

This is the primary editing view.

```text
┌──────────┬───────────────────────────────┬──────────────────┐
│ Explorer │ Tabs + Breadcrumbs            │ AI Assistant     │
│ (files)  │ Monaco Editor                 │ (chat + plan +  │
│          │                               │  review/apply)   │
│          ├───────────────────────────────┤                  │
│          │ Bottom Panel (collapsible)    │                  │
│          │ Terminal · Problems · Output  │                  │
│          │ Changes · Diff                │                  │
└──────────┴───────────────────────┴──────────────────┘
```

### 4.1 Explorer

Left sidebar showing the project file tree, supporting local, WSL, and remote SFTP file systems.

- Header with "Explorer" label and toolbar buttons: New file, New folder, Refresh.
- Search input to filter files by name.
- Tree supports folders and files, with specific handling for remote SFTP operations when connected to an SSH environment.
- Files are opened on click.
- Active file is highlighted.
- Context menus:
  - **File:** Open, Rename, Duplicate, Copy path, Delete (all operations support SFTP for remote files)
  - **Folder:** New file, New folder, Rename, Delete (all operations support SFTP for remote directories)
- File icons are determined by extension (`.json`, `.md`/`.txt`, code files, default file).

### 4.2 Editor Area

Multi-tab Monaco editor.

- **Tabs:** one per open file; shows filename and dirty indicator (`●`).
- **Close tab:** `×` button on each tab.
- **Breadcrumbs:** path segments of the active file.
- **Monaco Editor:** loaded via `@monaco-editor/react` behind `React.lazy` + `Suspense` for SSR safety.
  - Theme: `vs-dark`
  - Font: JetBrains Mono, 13px
  - Minimap toggle controlled from Settings
  - Line highlight, smooth scrolling, automatic layout
- **Split editor button:** visual placeholder for future split editing.
- Empty state: "No file open. Pick one from the explorer."

### 4.3 AI Assistant Panel

Right sidebar for AI chat.

- Header: "AI assistant" label, New chat button, Clear conversation button.
- Message list:
  - User messages appear as right-aligned primary-colored bubbles.
  - Assistant messages can contain:
    - Plain text paragraphs
    - Code blocks with language label and Copy button
    - Plan cards (numbered steps)
    - ChangeSet cards (files affected, added/removed counts)
- Composer:
  - Multi-line textarea
  - `Enter` sends, `Shift+Enter` inserts a new line
  - Send button
  - Regenerate and Stop buttons above the textarea
- ChangeSet card actions:
  - **Review changes** — switches bottom panel to the Diff tab
  - **Apply** — marks the change set as applied and updates open tabs / tree content visually
  - **Reject** — marks the change set as rejected

### 4.4 Bottom Panel

Collapsible bottom panel with five tabs.

| Tab          | Content                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| **Terminal** | Visual terminal with prompt echo. User types commands and sees echoed output. No real shell is connected. |
| **Problems** | Static list of sample warnings / info messages with file, line, and description.                          |
| **Output**   | Static build/dev server output lines.                                                                     |
| **Changes**  | List of change sets from the store with status badges.                                                    |
| **Diff**     | Side-by-side diff for the active change set with Accept all / Reject all actions.                         |

---

## 5. Preview Workspace

A DYAD-like embedded browser preview for the running application.

### Toolbar

- **Back / Forward** — history navigation inside the preview session.
- **Refresh** — adds a system message indicating the URL was reloaded.
- **Start / Stop dev server** — toggles `previewRunning` state.
- **URL bar** — editable input; submitting updates the preview URL and history.
- **External link** — opens the current URL in a new browser tab.
- **Device toggles:** Desktop, Tablet, Mobile.
- **Runtime status badge:** "Running · dev" or "Stopped · dev".

### Preview Frame

- Shows a visual placeholder when the dev server is stopped.
- When running, renders a mock app UI inside a bordered frame.
- Frame size changes based on selected device.

### System Messages Sidebar

Right-hand column listing runtime messages:

- Levels: `info`, `warn`, `error`
- Each message shows an icon, text, and timestamp.
- Header shows total message count.

> **Future backend connection:** Once the Rust Core is wired up, this frame will render the actual dev server URL via an iframe or native preview surface, and system messages will stream from the runtime.

---

## 6. Publish Workspace

Deployment and hosting UI.

### Deploy Target

Three selectable cards:

- Static site
- Node server
- Container

### Domain

- Custom domain input
- Generated preview URL: `{project-name}.forge.dev`

### Source

- GitHub connection status
- Buttons:
  - Publish local workspace
  - Publish from GitHub (disabled when not connected)

### Recent Deploys

Visual list of recent deploys with status icon, commit/branch label, and relative time.

> **Future backend connection:** The Rust Core will handle the actual build, bundle, and deploy pipeline.

---

## 7. Configure Workspace

Left sidebar navigation:

- Environments
- GitHub
- AI Models
- General

### 7.1 Environments

Manage development environments, including local, WSL, and remote SSH connections.

Supported kinds:

| Kind           | Icon     | Detail Example                              |
| -------------- | -------- | ------------------------------------------- |
| **Local**      | Monitor  | `/Users/me/projects`                        |
| **WSL**        | Terminal | `Ubuntu-22.04`                              |
| **Remote SSH** | Network  | `user@host:port` (e.g., `dev@10.0.0.14:22`) |

**Remote SSH Specifics:**

- **Authentication:** Supports password-based and public key authentication.
- **Key Management:** Users can generate new SSH key pairs directly within the IDE (Ed25519 algorithm).
  The generated private key is securely stored, and the public key is provided to the user for adding to remote servers.

Features:

- List of environments with kind badge and connection status
- Active environment highlighted
- Add environment dialog: Type, Name, Detail, Host, Username, Port, Password (for password auth) or Private Key Path (for key auth).
- Remove environment
- Connect/Disconnect SSH environments.

> **Backend Connection:** The Rust Core now actively manages environment lifecycle, file system access (including SFTP for SSH environments), and command execution across Local / WSL / SSH environments. SSH connections are maintained per client session.

### 7.2 GitHub

GitHub integration workflow.

- **Connect account:** input username + Connect button
- **Connected state:** shows connected user and Disconnect button
- **Repository list:**
  - Lists repositories with name, privacy lock, default branch, updated time
  - Active repository highlighted
  - Open button to select a repository
- **Branch selector:** dropdown of branches + "View changes" button
- Note: Git changes appear in the bottom panel's Changes tab.

> **Future backend connection:** OAuth flow, repository cloning, branch/commit/push operations will be handled by the Rust Core.

### 7.3 AI Models

Model management panel.

- List of configured models with:
  - Name
  - Connection type badge (`local`, `remote`, `api`)
  - Provider
  - Identifier and endpoint
- Active model highlighted
- Add model dialog fields:
  - Model name
  - Provider
  - Connection type (Local / Remote / API)
  - Endpoint
  - Model identifier
  - API key
  - Test Connection button (visual action)
- Remove model (disabled if only one model remains)

Default model:

```text
Gemma 4 31B · Local · Google · gemma4:31b @ http://localhost:11434
```

> **Important:** Only one model is required. Multi-model support is optional.

> **Future backend connection:** The Rust Core's AI Model Adapter will route completion requests to the selected model endpoint.

### 7.4 General

General preferences placeholder within Configure. Full editor preferences live under `/settings`.

---

## 8. Settings Page

Standalone page at `/settings`.

Sections:

| Section       | Content                                |
| ------------- | -------------------------------------- |
| **Model**     | Active model input (visual preference) |
| **Editor**    | Minimap toggle                         |
| **Shortcuts** | Reference table of keyboard shortcuts  |

Navigation:

- Back arrow returns to `/workspace`
- "Back to workspace" button at the bottom

---

## 9. State Management

All state lives in a single Zustand store: `useIDEStore` (`src/stores/ide-store.ts`).

### Store Slices

| Slice             | Responsibility                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------ |
| **UISlice**       | `workspaceView`, panel visibility, `bottomTab`, `commandOpen`, `configureTab`, minimap     |
| **ProjectSlice**  | `projectName`, file `tree`                                                                 |
| **EditorSlice**   | Open `tabs`, `activePath`, open/close/update/save files                                    |
| **AISlice**       | `messages`, `streaming`, `changeSets`, send/stop/clear/regenerate/apply/reject             |
| **TerminalSlice** | `terminalLines`, push prompt/output lines                                                  |
| **PreviewSlice**  | `previewUrl`, `previewDevice`, `previewRunning`, history, `systemMessages`                 |
| **EnvSlice**      | `environments`, `activeEnvId`, add/remove/select                                           |
| **ModelSlice**    | `models`, `activeModelId`, add/remove/select                                               |
| **GitHubSlice**   | `githubConnected`, `githubUser`, `githubRepos`, `activeRepoId`, `branches`, `activeBranch` |

### Key Initial Values

- Workspace view: `code`
- Explorer, AI panel, bottom panel: open
- Bottom tab: `terminal`
- Active file: `src/components/LoginForm.tsx`
- Active environment: `This Mac · Local`
- Active model: `Gemma 4 31B · Local`
- Preview URL: `http://localhost:5173/`
- Preview device: `desktop`
- Preview running: `true`

---

## 10. Types

Core TypeScript types live in `src/types/ide.ts`.

```typescript
FileNode; // file or folder in the project tree
EditorTab; // open editor tab with dirty flag
ChatMessage; // user or assistant message
ChatMessagePart; // text | code | plan | changeset
ChangeSet; // pending/applied/rejected set of file changes
ChangeSetFile; // per-file diff metadata
Environment; // local / wsl / ssh environment
AIModel; // model configuration
GitHubRepo; // repository metadata
WorkspaceView; // "preview" | "code" | "publish" | "configure"
PreviewDevice; // "desktop" | "tablet" | "mobile"
ConfigureTab; // "environments" | "github" | "models" | "general"
BottomTab; // "terminal" | "problems" | "output" | "changes" | "diff"
```

---

## 11. Design System

### Stack

- Tailwind CSS v4
- shadcn/ui components
- OKLCH color tokens
- Inter (UI) and JetBrains Mono (code) fonts

### Theme

- Dark theme is the default.
- Light theme is available via the topbar toggle.
- Corner radius: `0.375rem`

### Semantic Tokens

| Token                | Usage                                |
| -------------------- | ------------------------------------ |
| `--background`       | App background                       |
| `--foreground`       | Primary text                         |
| `--primary`          | Accent color (cyan/teal)             |
| `--accent`           | Hover/active surfaces                |
| `--muted`            | Subtle backgrounds                   |
| `--muted-foreground` | Secondary text                       |
| `--panel`            | Panel backgrounds (topbar, sidebars) |
| `--editor`           | Editor background                    |
| `--border`           | Borders and dividers                 |
| `--diff-add`         | Added lines in diff                  |
| `--diff-remove`      | Removed lines in diff                |

### Rules

- No hardcoded color utilities like `text-white` or `bg-black`.
- All colors go through semantic tokens so light/dark mode works correctly.
- Icons are from `lucide-react`.

---

## 12. Keyboard Shortcuts

| Shortcut        | Action              |
| --------------- | ------------------- |
| `⌘K` / `Ctrl+K` | Open command menu   |
| `⌘B` / `Ctrl+B` | Toggle explorer     |
| `⌘J` / `Ctrl+J` | Toggle bottom panel |
| `⌘I` / `Ctrl+I` | Toggle AI panel     |
| `⌘S` / `Ctrl+S` | Save active file    |

Shortcuts are registered globally on the `/workspace` route.

---

## 13. Component Inventory

### Routes

| File                       | Purpose                               |
| -------------------------- | ------------------------------------- |
| `src/routes/index.tsx`     | Welcome screen                        |
| `src/routes/workspace.tsx` | IDE shell and view switching          |
| `src/routes/settings.tsx`  | Settings page                         |
| `src/routes/__root.tsx`    | Root layout, providers, head metadata |

### IDE Components

| File                                             | Purpose             |
| ------------------------------------------------ | ------------------- |
| `src/components/ide/Topbar.tsx`                  | Global topbar       |
| `src/components/ide/WorkspaceTabs.tsx`           | Workspace view tabs |
| `src/components/ide/CommandMenu.tsx`             | Command palette     |
| `src/components/ide/explorer/FileExplorer.tsx`   | File tree sidebar   |
| `src/components/ide/editor/EditorArea.tsx`       | Monaco editor area  |
| `src/components/ide/ai/AIPanel.tsx`              | AI chat panel       |
| `src/components/ide/bottom/BottomPanel.tsx`      | Bottom tabbed panel |
| `src/components/ide/preview/PreviewView.tsx`     | Preview workspace   |
| `src/components/ide/publish/PublishView.tsx`     | Publish workspace   |
| `src/components/ide/configure/ConfigureView.tsx` | Configure workspace |

### shadcn/ui Components Used

`button`, `dialog`, `dropdown-menu`, `context-menu`, `input`, `label`, `select`, `switch`, `tabs`, `tooltip`, `scroll-area`, `command`, `badge`, `separator`, `sonner`, `textarea`.

### Utilities

| File                        | Purpose                             |
| --------------------------- | ----------------------------------- |
| `src/lib/sample-project.ts` | Demo project tree and file contents |
| `src/lib/utils.ts`          | General helpers                     |

---

## 14. Sample Data

The demo project (`acme-web`) is embedded in `src/lib/sample-project.ts`.

```text
acme-web/
├── src/
│   ├── components/
│   │   ├── LoginForm.tsx
│   │   └── Button.tsx
│   ├── pages/
│   │   └── index.tsx
│   └── app.tsx
├── public/
│   └── robots.txt
├── package.json
└── README.md
```

This data is used for:

- File explorer rendering
- Monaco editor initial content
- AI change set demo (`Add loading state to the login form`)
- Command menu file search

---

## 15. Future Backend Integration Points

The UI is prepared for future Rust Core integration. The following areas will be wired up later:

### 15.1 Preview

- Render actual dev server URL in an iframe or native preview surface.
- Stream build/runtime errors into System Messages.
- Start/stop the real dev server through the Rust Core.

### 15.2 Terminal

- Replace visual echo with a real shell / pseudoterminal.
- Route commands through the active environment (Local / WSL / SSH).

### 15.3 AI Assistant

- Send user prompts to the Rust Core AI Model Adapter.
- Stream assistant responses.
- Receive structured change sets and apply them through the Rust Core.

### 15.4 File System

- File tree, open files, save operations, and change set application will be backed by the real file system on the active environment.

### 15.5 Environments

- Environment status will reflect real connection state.
- Add environment will validate reachability through the Rust Core.

### 15.6 GitHub

- OAuth-based account connection.
- Repository cloning, branch switching, commit, push, pull.
- Real git diff and status in the bottom panel.

### 15.7 Publish

- Build, bundle, and deploy through the Rust Core.
- Domain and hosting integration.

---

## 16. Notes for Maintainers

- Keep all UI text in English.
- Do not introduce mock service layers or fake backend abstractions.
- Continue using semantic color tokens; avoid hardcoded colors.
- Monaco Editor requires browser APIs — keep it behind `React.lazy` + `Suspense`.
- The `react-resizable-panels` library was removed in favor of a flex-based layout for stability; preserve this unless there is a strong reason to reintroduce resizable panels.
- Default active model remains `Gemma 4 31B · Local`; multi-model support is optional.
