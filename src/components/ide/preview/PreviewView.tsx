import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Play,
  Square,
  ExternalLink,
  Monitor,
  Tablet,
  Smartphone,
  Info,
  AlertTriangle,
  XCircle,
  Camera,
} from "lucide-react";
import { IDEStore, useIDEStore } from "@/stores/ide-store";
import { useShallow } from "zustand/react/shallow";
import type { PreviewDevice } from "@/types/ide";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { getWebSocketManager } from "@/lib/backend-websocket";
import { BackendRequestType, BackendResponseType } from "@/types/backend-messages";
import { toast } from "sonner"; // Assuming sonner is used for toasts, if not I'll just use console

const deviceSizes: Record<
  PreviewDevice,
  { w: number; h: number; label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  desktop: { w: 0, h: 0, label: "Desktop", icon: Monitor },
  tablet: { w: 820, h: 1180, label: "Tablet", icon: Tablet },
  mobile: { w: 390, h: 780, label: "Mobile", icon: Smartphone },
};

export function PreviewView() {
  const {
    previewUrl,
    previewDevice,
    previewRunning,
    previewHistory,
    previewHistoryIndex,
    systemMessages,
    setPreviewUrl,
    setPreviewDevice,
    togglePreviewRunning,
    previewBack,
    previewForward,
    previewRefresh,
    addPendingAttachment,
  } = useIDEStore(
    useShallow((state: IDEStore) => ({
      previewUrl: state.previewUrl,
      previewDevice: state.previewDevice,
      previewRunning: state.previewRunning,
      previewHistory: state.previewHistory,
      previewHistoryIndex: state.previewHistoryIndex,
      systemMessages: state.systemMessages,
      setPreviewUrl: state.setPreviewUrl,
      setPreviewDevice: state.setPreviewDevice,
      togglePreviewRunning: state.togglePreviewRunning,
      previewBack: state.previewBack,
      previewForward: state.previewForward,
      previewRefresh: state.previewRefresh,
      addPendingAttachment: state.addPendingAttachment,
    })),
  );

  const [draft, setDraft] = useState(previewUrl);
  const [isCapturing, setIsCapturing] = useState(false);
  const canBack = previewHistoryIndex > 0;
  const canFwd = previewHistoryIndex < previewHistory.length - 1;
  const device = deviceSizes[previewDevice];

  const handleCapture = async () => {
    if (!previewUrl) return;
    setIsCapturing(true);

    try {
      const wsManager = getWebSocketManager();
      const response = await wsManager.sendRequest({
        type: BackendRequestType.TakeScreenshot,
        payload: { url: previewUrl },
      });

      if (response.type === BackendResponseType.TakeScreenshotResponse) {
        // Convert base64 data URL to a File object
        const base64Data = response.payload.base64.split(",")[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "image/png" });
        const file = new File([blob], "preview_snapshot.png", { type: "image/png" });

        addPendingAttachment(file);
      } else {
        console.error("Screenshot capture failed:", response);
      }
    } catch (e) {
      console.error("Screenshot capture error:", e);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Toolbar */}
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border bg-panel px-2">
        <IconBtn tip="Back" onClick={previewBack} disabled={!canBack}>
          <ArrowLeft className="size-4" />
        </IconBtn>
        <IconBtn tip="Forward" onClick={previewForward} disabled={!canFwd}>
          <ArrowRight className="size-4" />
        </IconBtn>
        <IconBtn tip="Refresh" onClick={previewRefresh}>
          <RotateCw className="size-4" />
        </IconBtn>
        <IconBtn
          tip={previewRunning ? "Stop dev server" : "Start dev server"}
          onClick={togglePreviewRunning}
        >
          {previewRunning ? (
            <Square className="size-3.5 fill-current text-rose-400" />
          ) : (
            <Play className="size-3.5 fill-current text-emerald-400" />
          )}
        </IconBtn>
        <div className="mx-1 h-4 w-px bg-border" />
        <IconBtn tip="Capture for AI (Vision)" onClick={handleCapture} disabled={isCapturing}>
          <Camera className={`size-4 text-indigo-400 ${isCapturing ? "animate-pulse" : ""}`} />
        </IconBtn>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPreviewUrl(draft);
          }}
          className="mx-2 flex flex-1 items-center gap-2 rounded border border-border bg-background px-2 py-1"
        >
          <span
            className={`size-1.5 rounded-full ${
              previewRunning ? "bg-emerald-500" : "bg-muted-foreground/60"
            }`}
          />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            placeholder="http://localhost:5173/"
          />
          <a
            href={previewUrl || draft || "http://localhost:5173/"}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
          </a>
        </form>

        <div className="flex items-center gap-0.5 rounded border border-border bg-background/40 p-0.5">
          {(Object.keys(deviceSizes) as PreviewDevice[]).map((d) => {
            const Icon = deviceSizes[d].icon;
            const active = previewDevice === d;
            return (
              <Tooltip key={d}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setPreviewDevice(d)}
                    className={`grid size-6 place-items-center rounded transition ${
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{deviceSizes[d].label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <div className="ml-2 inline-flex items-center gap-1.5 rounded border border-border bg-background/40 px-2 py-1 text-[11px]">
          <span
            className={`size-1.5 rounded-full ${
              previewRunning ? "bg-emerald-500" : "bg-muted-foreground/60"
            }`}
          />
          <span className="font-medium">{previewRunning ? "Running" : "Stopped"}</span>
          <span className="text-muted-foreground">· dev</span>
        </div>
      </div>

      {/* Frame + system messages */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 items-start justify-center overflow-auto bg-[color:var(--muted)]/30 p-6">
          <div
            className="overflow-hidden rounded-md border border-border bg-background shadow-lg"
            style={
              device.w === 0
                ? { width: "100%", height: "100%" }
                : { width: device.w, height: device.h, maxWidth: "100%", maxHeight: "100%" }
            }
          >
            {previewRunning ? (
              <iframe
                src={previewUrl}
                title="Preview"
                className="h-full w-full border-0 bg-white"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              />
            ) : (
              <div className="grid h-full place-items-center p-8 text-center text-sm text-muted-foreground">
                <div>
                  <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full border border-border bg-panel">
                    <Play className="size-4" />
                  </div>
                  Dev server is stopped.
                  <div className="mt-1 text-xs">
                    Press the play button in the toolbar to start the preview.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="w-80 shrink-0 border-l border-border bg-panel">
          <div className="flex h-8 items-center justify-between border-b border-border px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <span>System Messages</span>
            <span className="text-[10px] normal-case">{systemMessages.length}</span>
          </div>
          <div className="flex h-full flex-col overflow-y-auto">
            <ul className="divide-y divide-border/60 text-xs">
              {systemMessages.map((m) => {
                const Icon =
                  m.level === "error" ? XCircle : m.level === "warn" ? AlertTriangle : Info;
                const color =
                  m.level === "error"
                    ? "text-rose-400"
                    : m.level === "warn"
                      ? "text-amber-400"
                      : "text-sky-400";
                return (
                  <li key={m.id} className="flex items-start gap-2 px-3 py-2">
                    <Icon className={`mt-0.5 size-3.5 shrink-0 ${color}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{m.text}</div>
                      <div className="text-[10px] text-muted-foreground">{m.at}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  tip,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  tip: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className="grid size-7 place-items-center rounded text-muted-foreground transition hover:bg-accent/50 hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}
