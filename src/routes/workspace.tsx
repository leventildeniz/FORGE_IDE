import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Topbar } from "@/components/ide/Topbar";
import { WorkspaceTabs } from "@/components/ide/WorkspaceTabs";
import { FileExplorer } from "@/components/ide/explorer/FileExplorer";
import { EditorArea } from "@/components/ide/editor/EditorArea";
import { AIPanel } from "@/components/ide/ai/AIPanel";
import { BottomPanel } from "@/components/ide/bottom/BottomPanel";
import { CommandMenu } from "@/components/ide/CommandMenu";
import { PreviewView } from "@/components/ide/preview/PreviewView";
import { PublishView } from "@/components/ide/publish/PublishView";
import { TelemetryView } from "@/components/ide/telemetry/TelemetryView";
import { ConfigureView } from "@/components/ide/configure/ConfigureView";
import { IDEStore, useIDEStore } from "@/stores/ide-store";
import { useShallow } from "zustand/react/shallow";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

export const Route = createFileRoute("/workspace")({
  head: () => ({
    meta: [
      { title: "Workspace — Forge" },
      {
        name: "description",
        content: "The Forge workspace: preview, code, publish, and configure.",
      },
      { property: "og:title", content: "Workspace — Forge" },
      {
        property: "og:description",
        content: "The Forge workspace: preview, code, publish, and configure.",
      },
    ],
  }),
  component: Workspace,
});

function Workspace() {
  const {
    workspaceView,
    explorerOpen,
    aiOpen,
    bottomOpen,
    toggleExplorer,
    toggleAi,
    toggleBottom,
    setCommandOpen,
    saveActive,
    initializeBackendConnection, // Get the new action from store
  } = useIDEStore(
    useShallow((state: IDEStore) => ({
      explorerOpen: state.explorerOpen,
      aiOpen: state.aiOpen,
      bottomOpen: state.bottomOpen,
      workspaceView: state.workspaceView,
      saveActive: state.saveActive,
      toggleExplorer: state.toggleExplorer,
      toggleAi: state.toggleAi,
      toggleBottom: state.toggleBottom,
      setCommandOpen: state.setCommandOpen,
      initializeBackendConnection: state.initializeBackendConnection,
    })),
  );
  const isAppLocked = useIDEStore((s) => s.isAppLocked);

  useEffect(() => {
    initializeBackendConnection(); // Initialize backend connection on component mount

    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "k") {
        e.preventDefault();
        setCommandOpen(true);
      } else if (k === "b") {
        e.preventDefault();
        toggleExplorer();
      } else if (k === "j") {
        e.preventDefault();
        toggleBottom();
      } else if (k === "i") {
        e.preventDefault();
        toggleAi();
      } else if (k === "s") {
        e.preventDefault();
        saveActive();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    setCommandOpen,
    toggleExplorer,
    toggleBottom,
    toggleAi,
    saveActive,
    initializeBackendConnection,
  ]); // Add initializeBackendConnection to dependencies

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <Topbar />
      <WorkspaceTabs />
      <div className="flex min-h-0 flex-1">
        {workspaceView === "code" ? (
          <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
            {explorerOpen && (
              <>
                <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
                  <div className="h-full border-r border-border min-w-0">
                    <FileExplorer />
                  </div>
                </ResizablePanel>
                <ResizableHandle />
              </>
            )}

            <ResizablePanel defaultSize={aiOpen ? 55 : 80} minSize={20}>
              <div className="flex h-full flex-col min-w-0">
                <div className="flex-1 overflow-hidden min-h-0">
                  <EditorArea />
                </div>
                {bottomOpen && (
                  <div className="h-72 shrink-0 border-t border-border min-h-0">
                    <BottomPanel />
                  </div>
                )}
              </div>
            </ResizablePanel>

            {aiOpen && (
              <>
                <ResizableHandle />
                <ResizablePanel defaultSize={30} minSize={20} maxSize={80}>
                  <div className="h-full min-w-0">
                    <AIPanel />
                  </div>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        ) : workspaceView === "preview" ? (
          <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
            <ResizablePanel defaultSize={aiOpen ? 70 : 100} minSize={20}>
              <div className="h-full min-w-0">
                <PreviewView />
              </div>
            </ResizablePanel>
            {aiOpen && (
              <>
                <ResizableHandle />
                <ResizablePanel defaultSize={30} minSize={20} maxSize={80}>
                  <div className="h-full min-w-0 border-l border-border">
                    <AIPanel />
                  </div>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        ) : workspaceView === "telemetry" ? (
          <TelemetryView />
        ) : workspaceView === "publish" ? (
          <PublishView />
        ) : (
          <ConfigureView />
        )}
      </div>
      <CommandMenu />
    </div>
  );
}
