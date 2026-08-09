import { useEffect, useRef, useState } from "react";
import { IDEStore, useIDEStore, forgeTerminalBuffers } from "@/stores/ide-store";
import { useShallow } from "zustand/react/shallow";
import * as xterm from "@xterm/xterm";
const { Terminal } = xterm;
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { getWebSocketManager } from "@/lib/backend-websocket";
import { BackendRequestType } from "@/types/backend-messages";
import { Plus, X, Terminal as TerminalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TerminalPanel() {
  const {
    terminals,
    activeTerminalId,
    addTerminal,
    removeTerminal,
    setActiveTerminal,
    activeEnvId,
    environments,
    projectRootPath,
  } = useIDEStore(
    useShallow((state: IDEStore) => ({
      terminals: state.terminals,
      activeTerminalId: state.activeTerminalId,
      addTerminal: state.addTerminal,
      removeTerminal: state.removeTerminal,
      setActiveTerminal: state.setActiveTerminal,
      activeEnvId: state.activeEnvId,
      environments: state.environments,
      projectRootPath: state.projectRootPath,
    })),
  );

  const handleAddTerminal = () => {
    const activeEnv = environments.find((e) => e.id === activeEnvId);
    const terminalId = `term_${Math.random().toString(36).slice(2, 9)}`;
    const title = activeEnv?.kind === "ssh" ? "SSH" : activeEnv?.kind === "wsl" ? "WSL" : "Local";

    // Default columns and rows, will be resized by FitAddon
    getWebSocketManager().sendRequest({
      type: BackendRequestType.SpawnTerminal,
      payload: {
        terminal_id: terminalId,
        cwd: projectRootPath || ".",
        cols: 80,
        rows: 24,
        environmentId: activeEnvId,
        active_environment_details: activeEnv,
      },
    });

    addTerminal({ id: terminalId, title });
  };

  // Create default terminal if none exists
  useEffect(() => {
    if (terminals.length === 0 && activeEnvId) {
      handleAddTerminal();
    }
  }, [terminals.length, activeEnvId]);

  return (
    <div className="flex h-full flex-col bg-editor">
      <div className="flex shrink-0 items-center border-b border-border bg-panel px-2">
        <div className="flex flex-1 overflow-x-auto">
          {terminals.map((t) => (
            <div
              key={t.id}
              onClick={() => setActiveTerminal(t.id)}
              className={`group flex items-center gap-2 border-r border-border px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                activeTerminalId === t.id
                  ? "bg-editor text-foreground"
                  : "bg-panel text-muted-foreground hover:bg-editor/50"
              }`}
            >
              <TerminalIcon className="size-3" />
              <span>{t.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  getWebSocketManager().sendRequest({
                    type: BackendRequestType.CloseTerminal,
                    payload: { terminal_id: t.id },
                  });
                  removeTerminal(t.id);
                }}
                className="rounded-sm p-0.5 opacity-0 hover:bg-muted group-hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 rounded-none hover:bg-muted"
          onClick={handleAddTerminal}
        >
          <Plus className="size-3" />
        </Button>
      </div>
      <div className="flex-1 relative min-h-0">
        {terminals.map((t) => (
          <div
            key={t.id}
            className={`absolute inset-0 ${activeTerminalId === t.id ? "z-10" : "z-0 opacity-0 pointer-events-none"}`}
          >
            <XTermInstance terminalId={t.id} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function XTermInstance({ terminalId }: { terminalId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<any>(null); // changed to any to fix typeof Terminal mismatch
  const fitAddonRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 12,
      lineHeight: 1.2,
      theme: {
        background: "transparent",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
      },
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    // Flush any buffered data that arrived before we mounted
    if (forgeTerminalBuffers[terminalId]) {
      term.write(forgeTerminalBuffers[terminalId]);
    }

    // Fit immediately after opening
    setTimeout(() => {
      try {
        fitAddon.fit();
        term.focus(); // Focus automatically so the user can start typing
        getWebSocketManager().sendRequest({
          type: BackendRequestType.ResizeTerminal,
          payload: {
            terminal_id: terminalId,
            cols: term.cols,
            rows: term.rows,
          },
        });
      } catch (e) {}
    }, 10);

    const onDataDisposable = term.onData((data) => {
      getWebSocketManager().sendRequest({
        type: BackendRequestType.TerminalInput,
        payload: {
          terminal_id: terminalId,
          data,
        },
      });
    });

    const onResizeDisposable = term.onResize(({ cols, rows }) => {
      getWebSocketManager().sendRequest({
        type: BackendRequestType.ResizeTerminal,
        payload: {
          terminal_id: terminalId,
          cols,
          rows,
        },
      });
    });

    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch (e) {}
    };

    window.addEventListener("resize", handleResize);

    // Register a global listener for terminal output
    const handleTerminalOutput = (e: CustomEvent) => {
      if (e.detail.terminalId === terminalId) {
        term.write(e.detail.data);
      }
    };
    window.addEventListener("forge-terminal-output" as any, handleTerminalOutput);

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    return () => {
      onDataDisposable.dispose();
      onResizeDisposable.dispose();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("forge-terminal-output" as any, handleTerminalOutput);
      term.dispose();
    };
  }, [terminalId]);

  return <div ref={containerRef} className="h-full w-full pl-2 pt-1 overflow-hidden" />;
}
