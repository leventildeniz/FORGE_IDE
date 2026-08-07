import { Eye, Code2, Rocket, Settings2, Activity } from "lucide-react";
import { useIDEStore } from "@/stores/ide-store";
import { useShallow } from "zustand/react/shallow";
import type { WorkspaceView } from "@/types/ide";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const tabs: {
  id: WorkspaceView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "preview", label: "Preview", icon: Eye },
  { id: "code", label: "Code", icon: Code2 },
  { id: "publish", label: "Publish", icon: Rocket },
  { id: "configure", label: "Configure", icon: Settings2 },
  { id: "telemetry", label: "Telemetry", icon: Activity },
];

export function WorkspaceTabs() {
  const { workspaceView, setWorkspaceView, previewRunning } = useIDEStore(
    useShallow((state) => ({
      workspaceView: state.workspaceView,
      setWorkspaceView: state.setWorkspaceView,
      previewRunning: state.previewRunning,
    }))
  );
  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-border bg-panel px-2">
      {tabs.map((t) => {
        const active = workspaceView === t.id;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => setWorkspaceView(t.id)}
            className={`group relative inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            }`}
          >
            <Icon className="size-3.5" />
            {t.label}
            {t.id === "preview" && (
              <span
                className={`ml-0.5 size-1.5 rounded-full ${
                  previewRunning ? "bg-emerald-500" : "bg-muted-foreground/60"
                }`}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
