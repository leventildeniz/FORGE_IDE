import { IDEStore, useIDEStore } from "@/stores/ide-store";
import { useShallow } from "zustand/react/shallow";
import { Activity, Cpu, Database, Network, Clock, Zap } from "lucide-react";

export function TelemetryView() {
  const { isConnected, telemetry } = useIDEStore(
    useShallow((state: IDEStore) => ({
      isConnected: state.isConnected,
      telemetry: state.telemetry,
    })),
  );

  const formatNumber = (num: number) => new Intl.NumberFormat("en-US").format(Math.round(num));

  // Calculate percentages safely (avoid NaN)
  const total = telemetry.context_window || 1;
  const sysPct = Math.max(1, (telemetry.system_tokens / total) * 100);
  const knwPct = Math.max(1, (telemetry.knowledge_tokens / total) * 100);
  const hstPct = Math.max(1, (telemetry.history_tokens / total) * 100);
  const filePct = Math.max(1, (telemetry.file_tokens / total) * 100);
  const freePct = Math.max(1, (telemetry.free_tokens / total) * 100);

  const totalUsed =
    telemetry.system_tokens +
    telemetry.knowledge_tokens +
    telemetry.history_tokens +
    telemetry.file_tokens;
  const usagePct = Math.min(100, Math.max(0, (totalUsed / total) * 100));

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background text-foreground p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-lg bg-blue-500/10 text-blue-500">
            <Activity className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">AI Telemetry & State of Mind</h1>
            <p className="text-sm text-muted-foreground">
              Monitor KV cache utilization, context budgets, and inference metrics for the
              Local-First LLM.
            </p>
          </div>
        </header>

        {/* Global Connection Status */}
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-3 text-sm">
          <div
            className={`size-2.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-red-500"}`}
          />
          <span className="font-medium">Backend Status:</span>
          <span className="text-muted-foreground">
            {isConnected ? "Connected (WebSocket Active)" : "Disconnected"}
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Context Window */}
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold mb-4 text-purple-400">
              <Database className="size-4" /> Total Context Window
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div className="text-3xl font-bold font-mono">
                  {formatNumber(totalUsed)}
                  <span className="text-sm text-muted-foreground font-sans">
                    {" "}
                    / {formatNumber(total)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">Tokens Used</div>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden flex">
                <div
                  className="bg-purple-500 h-full transition-all duration-500"
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Inference Speed */}
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold mb-4 text-emerald-400">
              <Zap className="size-4" /> Inference Speed
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div className="text-3xl font-bold font-mono">
                  0.0<span className="text-sm text-muted-foreground font-sans"> t/s</span>
                </div>
                <div className="text-xs text-muted-foreground">Average</div>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full w-[0%]" />
              </div>
            </div>
          </div>

          {/* Card 3: Model Target */}
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold mb-4 text-blue-400">
              <Cpu className="size-4" /> Active Model
            </div>
            <div className="space-y-2 mt-2">
              <div className="text-lg font-bold font-mono truncate">{telemetry.active_model}</div>
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>Routing: Dynamic</span>
                <span>Type: Base</span>
              </div>
            </div>
          </div>
        </div>

        {/* Budget Manager Visualization */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Network className="size-4 text-amber-400" /> Context Budget Manager
          </h2>

          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Visualizing the active prompt distribution. This prevents the LLM from overflowing its
              context window by dynamically allocating tokens based on priority.
            </p>

            {/* Simulated Stack Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono text-muted-foreground px-1">
                <span>0</span>
                <span>Context Window ({formatNumber(total)})</span>
              </div>
              <div className="h-8 w-full bg-secondary rounded-md overflow-hidden flex ring-1 ring-border/50">
                <div
                  className="bg-red-500/80 h-full transition-all duration-500"
                  style={{ width: `${sysPct}%` }}
                  title={`System Prompt (${formatNumber(telemetry.system_tokens)})`}
                />
                <div
                  className="bg-blue-500/80 h-full transition-all duration-500"
                  style={{ width: `${knwPct}%` }}
                  title={`Knowledge Base (${formatNumber(telemetry.knowledge_tokens)})`}
                />
                <div
                  className="bg-emerald-500/80 h-full transition-all duration-500"
                  style={{ width: `${hstPct}%` }}
                  title={`History (${formatNumber(telemetry.history_tokens)})`}
                />
                <div
                  className="bg-amber-500/80 h-full transition-all duration-500"
                  style={{ width: `${filePct}%` }}
                  title={`Active File (${formatNumber(telemetry.file_tokens)})`}
                />
                <div
                  className="bg-transparent h-full transition-all duration-500"
                  style={{ width: `${freePct}%` }}
                  title={`Safety Margin/Free (${formatNumber(telemetry.free_tokens)})`}
                />
              </div>
              <div className="flex gap-4 text-[10px] uppercase font-bold justify-center pt-2">
                <div className="flex items-center gap-1 cursor-help" title="System Prompt">
                  <span className="size-2 bg-red-500/80 rounded-sm" /> SYS
                </div>
                <div className="flex items-center gap-1 cursor-help" title="Knowledge Base">
                  <span className="size-2 bg-blue-500/80 rounded-sm" /> KNW
                </div>
                <div className="flex items-center gap-1 cursor-help" title="Conversation History">
                  <span className="size-2 bg-emerald-500/80 rounded-sm" /> HST
                </div>
                <div className="flex items-center gap-1 cursor-help" title="Active File Content">
                  <span className="size-2 bg-amber-500/80 rounded-sm" /> FILE
                </div>
                <div
                  className="flex items-center gap-1 cursor-help"
                  title="Safety Margin (Free Space)"
                >
                  <span className="size-2 bg-transparent ring-1 ring-border rounded-sm" /> FREE
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Traces */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Clock className="size-4 text-rose-400" /> Recent AI Traces
          </h2>
          <div className="bg-black/50 border border-white/5 rounded-md p-4 min-h-[150px] font-mono text-xs text-muted-foreground overflow-y-auto">
            {telemetry.traces && telemetry.traces.length > 0 ? (
              <ul className="space-y-1">
                {telemetry.traces.map((trace, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-rose-400/50 shrink-0">
                      {new Date(trace.timestamp).toLocaleTimeString(undefined, {
                        hour12: false,
                        fractionalSecondDigits: 2,
                      })}
                    </span>
                    <span className="text-white/80">{trace.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-full flex items-center justify-center text-center opacity-50">
                Waiting for AI interaction... (Telemetry data will appear here)
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
