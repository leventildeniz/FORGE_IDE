# Forge UI Dokümantasyonu — Plan

Mevcut Forge arayüzünü ve kullanıcı etkileşimlerini teknik ekip ve gelecek backend entegrasyonu için referans alınacak detaylı bir Markdown dosyası olarak yazacağız. Doküman yalnızca frontend/UI durumunu anlatacak; backend, Rust Core, WebSocket, SSH, WSL, GitHub API veya model bağlantısı implementasyonu içermeyecek.

## Hedef Dosya

`docs/UI.md` (alternatif: `UI.md` proje kökünde — kullanıcı isterse konum değiştirilebilir).

## Doküman Yapısı

### 1. Overview

- Ürün adı: Forge — AI Coding IDE
- Misyon kısaca: minimal, karanlık, kod-odaklı, DYAD-benzeri deneyim
- Sadece frontend; tüm state Zustand + local component state içinde
- Gelecek mimari: React UI → Rust Core → Local/WSL/Remote → AI Model Adapter → Gemma/Qwen/diğer

### 2. Routes & Navigation

- `/` — Welcome / Empty State (New Project, Open Project, Recent Projects)
- `/workspace` — Ana IDE shell, WorkspaceTabs ile alt görünümler
- `/settings` — Model, tema, kısayol, genel ayarlar
- Workspace sekmeleri: Preview · Code · Publish · Configure · More

### 3. Global Shell

- **Topbar**: logo, proje switcher, command palette trigger, panel toggle butonları, env badge, model badge, tema toggle, settings link
- **WorkspaceTabs**: üst seviye görünüm geçişleri
- **CommandMenu (⌘K)**: dosya ve komut arama
- **Klavye kısayolları**: ⌘B explorer, ⌘J bottom panel, ⌘I AI panel, ⌘K command menu, ⌘S save

### 4. Code Workspace

```text
┌──────────┬───────────────────────┬──────────────────┐
│ Explorer │ Tabs + Breadcrumbs    │ AI Assistant     │
│ (files)  │ Monaco Editor         │ (chat + plan +  │
│          │                       │  review/apply)   │
│          ├───────────────────────┤                  │
│          │ Bottom Panel          │                  │
│          │ Terminal/Problems/... │                  │
└──────────┴───────────────────────┴──────────────────┘
```

- **FileExplorer**: interaktif dosya ağacı, context menu
- **EditorArea**: multi-tab Monaco editor, dirty indicator, breadcrumb, minimap toggle
- **AIPanel**: composer, mesaj balonları, code block, plan kartı, changeset kartı, apply/review/regenerate/clear
- **BottomPanel**: Terminal, Problems, Output, Changes, Diff

### 5. Preview Workspace

- Embedded browser benzeri önizleme
- Toolbar: back/forward/refresh, start/stop dev server, URL bar, external link
- Device toggle: Desktop / Tablet / Mobile
- Runtime status badge
- Sağ kolon: System Messages (info/warn/error)
- Not: şu an görsel placeholder; gerçek preview Rust Core bağlandığında gelecek

### 6. Publish Workspace

- Deploy target seçimi: Static site / Node server / Container
- Domain: custom domain input + generated preview URL
- Source: GitHub bağlantı durumu ve local workspace publish butonları
- Recent deploys listesi (görsel)

### 7. Configure Workspace

- **Environments**: Local / WSL / Remote SSH ekleme, active seçimi, status göstergesi
- **GitHub**: hesap bağlama, repo listeleme, repo açma, branch seçimi, changes uyarısı
- **AI Models**: model listesi, active model, add model dialog (name, provider, local/remote/api, endpoint, identifier, API key, Test Connection)
- **General**: tema, editor ayarları

### 8. State Management

- `useIDEStore` (Zustand) slice'ları:
  - UISlice: workspaceView, panel visibility, bottomTab, commandOpen, configureTab
  - ProjectSlice: projectName, file tree
  - EditorSlice: tabs, activePath, open/close/update/save
  - AISlice: messages, streaming, changeSets, send/stop/clear/regenerate/apply/reject
  - TerminalSlice: terminalLines
  - PreviewSlice: previewUrl, device, running, history, systemMessages
  - EnvSlice: environments, activeEnvId
  - ModelSlice: models, activeModelId
  - GitHubSlice: connected, user, repos, activeRepo, branches, activeBranch

### 9. Design System

- Tailwind v4 + shadcn/ui
- OKLCH renk tokenları: background, foreground, primary, accent, muted, panel, editor, diff-add, diff-remove
- Font: Inter (UI), JetBrains Mono (kod)
- Dark theme default; light toggle mevcut
- Radius: 0.375rem
- Renkler semantik tokenlar üzerinden; hardcode yok

### 10. Types

- `FileNode`, `EditorTab`, `ChatMessage`, `ChangeSet`, `Environment`, `AIModel`, `GitHubRepo`, `WorkspaceView`, `PreviewDevice`, `ConfigureTab`, `BottomTab`

### 11. Future Backend Integration Points

- `// TODO(rust-backend): ...` yorumlarının konumları ve anlamları
- Preview: gerçek dev server URL'si ve iframe
- Terminal: gerçek shell/pseudoterminal
- AI: model adapter üzerinden completion/streaming
- Environments: Local/WSL/SSH seçimi ve dosya sistemi erişimi (TAMAMLANDI)
- GitHub: OAuth, repo klonlama, branch/commit/push
- Publish: deploy pipeline tetikleme

### 12. Component Inventory

- Bileşen dosyalarının listesi ve kısa sorumlulukları
- shadcn/ui bileşenleri: button, dialog, dropdown-menu, input, label, select, tabs, tooltip, scroll-area, command, badge, separator, sonner

### 13. Sample Data

- `src/lib/sample-project.ts` içindeki demo proje ağacı ve dosya içerikleri
- Varsayılan model: Gemma 4 31B · Local
- Varsayılan environment: This Mac · Local

## Onay Bekleniyor

Onaylandığında build moduna geçip `docs/UI.md` dosyasını oluştururuz. Dosya konumunu veya eklemek istediğin bölümleri değiştirmek istersen şimdi söyle.
