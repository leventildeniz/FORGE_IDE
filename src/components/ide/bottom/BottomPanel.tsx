import { useState, type KeyboardEvent } from "react";
import {
  Terminal as TerminalIcon,
  AlertCircle,
  ScrollText,
  GitCompare,
  ListChecks,
  X,
  ChevronDown,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useIDEStore } from "@/stores/ide-store";
import { useShallow } from "zustand/react/shallow";
import type { BottomTab, ChangeSet } from "@/types/ide";
import { Button } from "@/components/ui/button";
import { TerminalPanel } from "@/components/ide/terminal/TerminalPanel";

const TABS: { id: BottomTab; label: string; icon: React.ComponentType<{ className?: string }> }[] =
  [
    { id: "terminal", label: "Terminal", icon: TerminalIcon },
    { id: "problems", label: "Problems", icon: AlertCircle },
    { id: "output", label: "Output", icon: ScrollText },
    { id: "changes", label: "Changes", icon: ListChecks },
    { id: "diff", label: "Diff", icon: GitCompare },
  ];

export function BottomPanel() {
  const { bottomTab, setBottomTab, toggleBottom } = useIDEStore(
    useShallow((state) => ({
      bottomTab: state.bottomTab,
      setBottomTab: state.setBottomTab,
      toggleBottom: state.toggleBottom,
    }))
  );
  return (
    <div className="flex h-full min-h-0 flex-col border-t border-border bg-panel">
      <div className="flex h-9 shrink-0 items-center border-b border-border pl-2 pr-1">
        <div className="flex items-stretch">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = bottomTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setBottomTab(t.id)}
                className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs transition ${
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <button
          onClick={toggleBottom}
          className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          title="Hide panel"
        >
          <ChevronDown className="size-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {bottomTab === "terminal" && <TerminalPanel />}
        {bottomTab === "problems" && <ProblemsView />}
        {bottomTab === "output" && <OutputView />}
        {bottomTab === "changes" && <ChangesView />}
        {bottomTab === "diff" && <DiffView />}
      </div>
    </div>
  );
}

function ProblemsView() {
  const problems: any[] = [];
  return (
    <div className="h-full overflow-auto">
      {problems.length === 0 ? (
        <div className="grid h-full place-items-center text-xs text-muted-foreground opacity-50 select-none font-sans">
          No problems detected in workspace
        </div>
      ) : (
        <ul className="h-full divide-y divide-border overflow-auto text-xs">
          {problems.map((p, i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-2">
              <AlertCircle
                className={`size-3.5 ${
                  p.severity === "warning" ? "text-[color:var(--diff-remove)]" : "text-primary"
                }`}
              />
              <span className="font-mono text-muted-foreground">{p.file}</span>
              <span className="font-mono text-muted-foreground">:{p.line}</span>
              <span className="text-foreground">{p.msg}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OutputView() {
  const lines: string[] = [];
  return (
    <div className="h-full overflow-auto bg-editor px-3 py-2 font-mono text-xs text-muted-foreground">
      {lines.length === 0 ? (
        <div className="grid h-full place-items-center text-xs text-muted-foreground opacity-50 select-none font-sans">
          No output to display
        </div>
      ) : (
        lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))
      )}
    </div>
  );
}

function ChangesView() {
  const changeSetsMap = useIDEStore((s) => s.changeSets);
  const changeSets = Object.values(changeSetsMap);
  return (
    <div className="h-full overflow-auto p-3">
      {changeSets.length === 0 ? (
        <div className="grid h-full place-items-center text-xs text-muted-foreground">
          No pending changes
        </div>
      ) : (
        <ul className="space-y-2">
          {changeSets.map((cs) => (
            <li key={cs.id} className="rounded-md border border-border bg-card p-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{cs.title}</span>
                <span
                  className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    cs.status === "pending"
                      ? "bg-muted text-muted-foreground"
                      : cs.status === "applied"
                        ? "bg-primary/15 text-primary"
                        : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {cs.status}
                </span>
              </div>
              <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-muted-foreground">
                {cs.files.map((f) => (
                  <li key={f.path}>
                    {f.path} <span className="text-[color:var(--diff-add)]">+{f.added}</span>{" "}
                    <span className="text-[color:var(--diff-remove)]">-{f.removed}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DiffView() {
  const changeSetsMap = useIDEStore((s) => s.changeSets);
  const changeSets = Object.values(changeSetsMap).filter(Boolean);
  const applyChangeSet = useIDEStore((s) => s.applyChangeSet);
  const rejectChangeSet = useIDEStore((s) => s.rejectChangeSet);
  const pending = changeSets.find((c) => c.status === "pending") ?? changeSets[0];

  if (!pending) {
    return (
      <div className="grid h-full place-items-center text-xs text-muted-foreground">
        No diff to show
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5 text-xs">
        <GitCompare className="size-3.5 text-primary" />
        <span className="font-semibold">{pending.title}</span>
        <div className="flex-1" />
        {pending.status === "pending" && (
          <>
            <Button
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                applyChangeSet(pending.id);
              }}
            >
              <CheckCircle2 className="size-3" /> Accept all
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs"
              onClick={() => rejectChangeSet(pending.id)}
            >
              <XCircle className="size-3" /> Reject all
            </Button>
          </>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {pending.files.map((f) => (
          <FileDiff key={f.path} path={f.path} before={f.before} after={f.after} />
        ))}
      </div>
    </div>
  );
}

function FileDiff({ path, before, after }: { path: string; before: string; after: string }) {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);
  return (
    <div className="border-b border-border">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-panel px-3 py-1.5 text-[11px] font-mono">
        <span>{path}</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border font-mono text-[11px] leading-relaxed">
        <div className="bg-[color:var(--editor)]">
          {beforeLines.map((l, i) => {
            const removed = !afterSet.has(l) && l.trim() !== "";
            return (
              <div
                key={i}
                className={`whitespace-pre px-3 ${
                  removed ? "bg-[color:var(--diff-remove)]/15" : ""
                }`}
              >
                <span className="mr-2 select-none text-muted-foreground">
                  {removed ? "-" : " "}
                </span>
                {l || " "}
              </div>
            );
          })}
        </div>
        <div className="bg-[color:var(--editor)]">
          {afterLines.map((l, i) => {
            const added = !beforeSet.has(l) && l.trim() !== "";
            return (
              <div
                key={i}
                className={`whitespace-pre px-3 ${added ? "bg-[color:var(--diff-add)]/15" : ""}`}
              >
                <span className="mr-2 select-none text-muted-foreground">{added ? "+" : " "}</span>
                {l || " "}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
