import { lazy, Suspense } from "react";
import { X, ChevronRight, Circle, SplitSquareHorizontal, Anvil } from "lucide-react";
import { useIDEStore } from "@/stores/ide-store";
import { useShallow } from "zustand/react/shallow";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((m) => ({ default: m.default })),
);

export function EditorArea() {
  const { tabs, activePath, setActive, closeTab, updateContent, minimap } = useIDEStore(
    useShallow((state) => ({
      tabs: state.tabs,
      activePath: state.activePath,
      setActive: state.setActive,
      closeTab: state.closeTab,
      updateContent: state.updateContent,
      minimap: state.minimap,
    }))
  );
  const active = tabs.find((t) => t.path === activePath);

  return (
    <div className="flex h-full min-h-0 flex-col bg-editor">
      {/* Tabs */}
      <div className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-border bg-panel">
        {tabs.map((t) => {
          const isActive = t.path === activePath;
          return (
            <div
              key={t.path}
              onClick={() => setActive(t.path)}
              className={`group flex cursor-pointer items-center gap-2 border-r border-border px-3 text-xs transition ${
                isActive
                  ? "bg-editor text-foreground"
                  : "bg-panel text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{t.name}</span>
              {t.dirty ? (
                <Circle className="size-2 fill-primary text-primary" />
              ) : (
                <span className="size-2" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(t.path);
                }}
                className="grid size-4 place-items-center rounded opacity-60 hover:bg-accent/60 hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          );
        })}
        <div className="flex-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="grid size-9 place-items-center text-muted-foreground hover:text-foreground">
              <SplitSquareHorizontal className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Split editor</TooltipContent>
        </Tooltip>
      </div>

      {/* Breadcrumbs */}
      {active && (
        <div className="flex h-7 shrink-0 items-center gap-1 border-b border-border bg-panel/60 px-3 text-[11px] text-muted-foreground">
          {active.path.split("/").map((seg, i, arr) => (
            <span key={i} className="flex items-center gap-1">
              <span className={i === arr.length - 1 ? "text-foreground" : ""}>{seg}</span>
              {i < arr.length - 1 && <ChevronRight className="size-3" />}
            </span>
          ))}
        </div>
      )}

      {/* Editor */}
      <div className="min-h-0 flex-1">
        {active ? (
          <Suspense
            fallback={
              <div className="grid h-full place-items-center text-xs text-muted-foreground">
                Loading editor…
              </div>
            }
          >
            <MonacoEditor
              key={active.path}
              path={active.path}
              theme="vs-dark"
              language={active.language}
              value={active.content}
              onChange={(v) => updateContent(active.path, v ?? "")}
              options={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 13,
                minimap: { enabled: minimap },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                renderLineHighlight: "all",
                padding: { top: 12 },
                tabSize: 2,
                automaticLayout: true,
              }}
            />
          </Suspense>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-sm text-muted-foreground opacity-50 select-none">
            <div className="grid size-16 place-items-center rounded-2xl bg-primary/5 text-primary/40 mb-4 border border-primary/10 shadow-sm">
              <Anvil className="size-8" />
            </div>
            <p>No file open.</p>
            <p className="text-xs mt-1">Pick one from the explorer.</p>
          </div>
        )}
      </div>
    </div>
  );
}
