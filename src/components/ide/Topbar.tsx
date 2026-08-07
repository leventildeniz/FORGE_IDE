import { Link } from "@tanstack/react-router";
import {
  Anvil,
  Search,
  Settings,
  FolderOpen,
  Plus,
  ChevronDown,
  Sun,
  Moon,
  PanelLeft,
  PanelRight,
  PanelBottom,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useIDEStore } from "@/stores/ide-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function Topbar() {
  const {
    projectName,
    explorerOpen,
    aiOpen,
    bottomOpen,
    toggleExplorer,
    toggleAi,
    toggleBottom,
    setCommandOpen,
  } = useIDEStore();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-panel px-2 text-panel-foreground">
      <Link to="/" className="flex items-center gap-2 rounded px-2 py-1 hover:bg-accent/50">
        <div className="grid size-6 place-items-center rounded bg-primary/15 text-primary">
          <Anvil className="size-3.5" />
        </div>
        <span className="text-sm font-semibold tracking-tight">Forge</span>
      </Link>

      <div className="h-5 w-px bg-border" />

      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium hover:bg-accent/50">
          <FolderOpen className="size-3.5 text-muted-foreground" />
          {projectName}
          <ChevronDown className="size-3 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[220px]">
          <DropdownMenuItem asChild>
            <Link to="/">
              <Plus className="mr-2 size-3.5" /> New project
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/">
              <FolderOpen className="mr-2 size-3.5" /> Open project
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            Recent projects appear on the welcome screen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        onClick={() => setCommandOpen(true)}
        className="ml-2 inline-flex items-center gap-2 rounded border border-border bg-background/40 px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-accent/40"
      >
        <Search className="size-3.5" />
        Search files and commands
        <kbd className="ml-6 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-0.5">
        <ToggleBtn active={explorerOpen} onClick={toggleExplorer} tip="Toggle explorer (⌘B)">
          <PanelLeft className="size-4" />
        </ToggleBtn>
        <ToggleBtn active={bottomOpen} onClick={toggleBottom} tip="Toggle bottom panel (⌘J)">
          <PanelBottom className="size-4" />
        </ToggleBtn>
        <ToggleBtn active={aiOpen} onClick={toggleAi} tip="Toggle AI panel (⌘I)">
          <PanelRight className="size-4" />
        </ToggleBtn>
      </div>

      <div className="mx-1 h-5 w-px bg-border" />

      <EnvBadge />
      <ModelBadge />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setIsDark((v) => !v)}
            className="ml-1 grid size-7 place-items-center rounded hover:bg-accent/50"
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>Toggle theme</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to="/settings"
            className="grid size-7 place-items-center rounded hover:bg-accent/50"
          >
            <Settings className="size-4" />
          </Link>
        </TooltipTrigger>
        <TooltipContent>Settings</TooltipContent>
      </Tooltip>
    </header>
  );
}

function ToggleBtn({
  active,
  onClick,
  tip,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tip: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={`grid size-7 place-items-center rounded transition ${
            active
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          }`}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

function EnvBadge() {
  const { environments, activeEnvId, setWorkspaceView, setConfigureTab } = useIDEStore();
  const env = environments.find((e) => e.id === activeEnvId) ?? environments[0];
  if (!env) return null;
  const kindLabel = env.kind === "local" ? "Local" : env.kind === "wsl" ? "WSL" : "Remote";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => {
            setWorkspaceView("configure");
            setConfigureTab("environments");
          }}
          className="inline-flex items-center gap-1.5 rounded border border-border bg-background/40 px-2 py-1 text-[11px] hover:bg-accent/40"
        >
          <span
            className={`size-1.5 rounded-full ${
              env.status === "connected" ? "bg-emerald-500" : "bg-muted-foreground/60"
            }`}
          />
          <span className="font-medium">{env.name}</span>
          <span className="text-muted-foreground">· {kindLabel}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>Manage environments</TooltipContent>
    </Tooltip>
  );
}

function ModelBadge() {
  const { models, activeModelId, setWorkspaceView, setConfigureTab } = useIDEStore();
  const model = models.find((m) => m.id === activeModelId) ?? models[0];
  if (!model) return null;
  const connLabel =
    model.connection === "local" ? "Local" : model.connection === "remote" ? "Remote" : "API";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => {
            setWorkspaceView("configure");
            setConfigureTab("models");
          }}
          className="ml-1 inline-flex items-center gap-1.5 rounded border border-border bg-background/40 px-2 py-1 text-[11px] hover:bg-accent/40"
        >
          <span className="size-1.5 rounded-full bg-primary" />
          <span className="font-medium">{model.name}</span>
          <span className="text-muted-foreground">· {connLabel}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>Manage AI models</TooltipContent>
    </Tooltip>
  );
}
