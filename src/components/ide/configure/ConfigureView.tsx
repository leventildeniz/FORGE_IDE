import { useState } from "react";
import {
  Cpu,
  Server,
  Settings2,
  Plus,
  Trash2,
  Check,
  Monitor,
  Terminal as TerminalIcon,
  Network,
  RefreshCw,
  GitBranch,
  Lock,
} from "lucide-react";
import { useIDEStore } from "@/stores/ide-store";
import { useShallow } from "zustand/react/shallow";
import type {
  AIModel,
  ConfigureTab,
  Environment,
  EnvironmentKind,
  ModelConnection,
} from "@/types/ide";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const tabs: {
  id: ConfigureTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "environments", label: "Environments", icon: Server },
  { id: "models", label: "AI Models", icon: Cpu },
  { id: "general", label: "General", icon: Settings2 },
];

export function ConfigureView() {
  const { configureTab, setConfigureTab } = useIDEStore(useShallow((state) => ({
    configureTab: state.configureTab,
    setConfigureTab: state.setConfigureTab,
  })));
  return (
    <div className="flex h-full min-h-0 bg-background">
      <aside className="w-56 shrink-0 border-r border-border bg-panel p-3">
        <div className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Configure
        </div>
        <nav className="space-y-0.5">
          {tabs.map((t) => {
            const active = configureTab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setConfigureTab(t.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                }`}
              >
                <Icon className="size-4" />
                {t.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 p-8">
          {configureTab === "environments" && <EnvironmentsPane />}
          {configureTab === "models" && <ModelsPane />}
          {configureTab === "general" && <GeneralPane />}
        </div>
      </div>
    </div>
  );
}

/* -------------------- Environments -------------------- */

const envIcon: Record<EnvironmentKind, React.ComponentType<{ className?: string }>> = {
  local: Monitor,
  wsl: TerminalIcon,
  ssh: Network,
};

function EnvironmentsPane() {
  const { environments, activeEnvId, setActiveEnv, addEnvironment, removeEnvironment } =
    useIDEStore(useShallow((state) => ({
      environments: state.environments,
      activeEnvId: state.activeEnvId,
      setActiveEnv: state.setActiveEnv,
      addEnvironment: state.addEnvironment,
      removeEnvironment: state.removeEnvironment,
    })));
  return (
    <section className="space-y-4">
      <PaneHeader
        title="Development environments"
        description="Run and edit projects on local, WSL, or remote SSH environments."
        action={<AddEnvironmentDialog onAdd={addEnvironment} />}
      />
      <ul className="space-y-2">
        {environments.map((e) => {
          const Icon = envIcon[e.kind];
          const active = activeEnvId === e.id;
          return (
            <li
              key={e.id}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                active ? "border-primary/60 bg-primary/5" : "border-border bg-card"
              }`}
            >
              <div className="grid size-8 place-items-center rounded-md border border-border bg-background text-muted-foreground">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{e.name}</span>
                  <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {e.kind}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] ${
                      e.status === "connected" ? "text-emerald-400" : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        e.status === "connected" ? "bg-emerald-500" : "bg-muted-foreground/60"
                      }`}
                    />
                    {e.status}
                  </span>
                </div>
                <div className="truncate text-xs text-muted-foreground">{e.detail}</div>
              </div>
              <div className="flex items-center gap-1">
                {active ? (
                  <span className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[11px] text-primary">
                    <Check className="size-3" /> Active
                  </span>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setActiveEnv(e.id)}>
                    Use
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeEnvironment(e.id)}
                  className="size-7"
                >
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AddEnvironmentDialog({
  onAdd,
}: {
  onAdd: (env: Omit<Environment, "id" | "status">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<EnvironmentKind>("local");
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  // YENİ STATE'LER: SSH bağlantı detayları için
  const [sshHost, setSshHost] = useState("");
  const [sshUsername, setSshUsername] = useState("");
  const [sshPort, setSshPort] = useState<number | string>(22);
  const [sshPrivateKeyPath, setSshPrivateKeyPath] = useState("");
  function reset() {
    setName("");
    setDetail("");
    setSshHost(""); // YENİ: SSH state'lerini temizle
    setSshUsername(""); // YENİ: SSH state'lerini temizle
    setSshPort(22); // YENİ: SSH state'lerini temizle
    setSshPrivateKeyPath(""); // YENİ: SSH state'lerini temizle
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 size-3.5" /> Add environment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add environment</DialogTitle>
          <DialogDescription>Register a local, WSL, or remote SSH environment.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Type</Label>
            <Select
              value={kind}
              onValueChange={(v) => {
                setKind(v as EnvironmentKind);
                setDetail(""); // Tür değişince detail'i temizle
                setSshHost(""); // SSH detaylarını da temizle
                setSshUsername("");
                setSshPort(22);
                setSshPrivateKeyPath("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local machine</SelectItem>
                <SelectItem value="wsl">WSL</SelectItem>
                <SelectItem value="ssh">Remote SSH</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dev box" />
          </div>
          {/* Ortam tipine göre dinamik detail/SSH alanları */}
          {kind !== "ssh" ? (
            <div>
              <Label className="text-xs">{kind === "wsl" ? "Distro" : "Path"}</Label>
              <Input
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder={kind === "wsl" ? "Ubuntu-22.04" : "/Users/me/projects"}
              />
            </div>
          ) : (
            <>
              <div>
                <Label className="text-xs">SSH Host</Label>
                <Input
                  value={sshHost}
                  onChange={(e) => setSshHost(e.target.value)}
                  placeholder="192.168.0.77"
                />
              </div>
              <div>
                <Label className="text-xs">SSH Username</Label>
                <Input
                  value={sshUsername}
                  onChange={(e) => setSshUsername(e.target.value)}
                  placeholder="dev"
                />
              </div>
              <div>
                <Label className="text-xs">SSH Port (optional)</Label>
                <Input
                  type="number"
                  value={sshPort}
                  onChange={(e) => setSshPort(e.target.value)}
                  placeholder="22"
                />
              </div>
              <div>
                <Label className="text-xs">Private Key Path (optional)</Label>
                <Input
                  value={sshPrivateKeyPath}
                  onChange={(e) => setSshPrivateKeyPath(e.target.value)}
                  placeholder="~/.ssh/id_rsa"
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!name.trim()) return;
              const baseEnv: Omit<Environment, "id" | "status"> = {
                kind,
                name: name.trim(),
                detail: detail.trim(),
              };

              if (kind === "ssh") {
                onAdd({
                  ...baseEnv,
                  host: sshHost.trim(),
                  username: sshUsername.trim(),
                  port: typeof sshPort === "number" ? sshPort : parseInt(sshPort || "22", 10),
                  privateKeyPath: sshPrivateKeyPath.trim(),
                  detail: `${sshUsername.trim() || "user"}@${sshHost.trim() || "host"}:${sshPort || "22"}`, // SSH için detail'i formatlıyoruz
                });
              } else {
                onAdd(baseEnv);
              }
              setOpen(false);
              reset();
            }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Models -------------------- */

function ModelsPane() {
  const { models, activeModelId, setActiveModel, addModel, removeModel } = useIDEStore(useShallow((state) => ({
    models: state.models,
    activeModelId: state.activeModelId,
    setActiveModel: state.setActiveModel,
    addModel: state.addModel,
    removeModel: state.removeModel,
  })));
  return (
    <section className="space-y-4">
      <PaneHeader
        title="AI models"
        description="Configure local, remote, or API-backed models. Only one model is required."
        action={<AddModelDialog onAdd={addModel} />}
      />
      <ul className="space-y-2">
        {models.map((m) => {
          const active = activeModelId === m.id;
          return (
            <li
              key={m.id}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                active ? "border-primary/60 bg-primary/5" : "border-border bg-card"
              }`}
            >
              <div className="grid size-8 place-items-center rounded-md border border-border bg-background text-muted-foreground">
                <Cpu className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{m.name}</span>
                  <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {m.connection}
                  </span>
                  <span className="text-[11px] text-muted-foreground">· {m.provider}</span>
                </div>
                <div className="truncate font-mono text-xs text-muted-foreground">
                  {m.identifier} @ {m.endpoint}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {active ? (
                  <span className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[11px] text-primary">
                    <Check className="size-3" /> Active
                  </span>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setActiveModel(m.id)}>
                    Use
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeModel(m.id)}
                  className="size-7"
                  disabled={models.length <= 1}
                >
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        Test Connection is a visual action here — real requests happen once the Rust core is wired
        up.
      </p>
    </section>
  );
}

function AddModelDialog({ onAdd }: { onAdd: (m: Omit<AIModel, "id">) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [connection, setConnection] = useState<ModelConnection>("local");
  const [endpoint, setEndpoint] = useState("http://localhost:11434");
  const [identifier, setIdentifier] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "ok" | "fail">("idle");

  function reset() {
    setName("");
    setProvider("");
    setConnection("local");
    setEndpoint("http://localhost:11434");
    setIdentifier("");
    setApiKey("");
    setTestStatus("idle");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 size-3.5" /> Add model
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add AI model</DialogTitle>
          <DialogDescription>
            Register a local, remote, or API-backed model. All fields are stored in the UI only.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="text-xs">Model name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Qwen 2.5 Coder 32B"
            />
          </div>
          <div>
            <Label className="text-xs">Provider</Label>
            <Input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="Alibaba / Meta / OpenAI"
            />
          </div>
          <div>
            <Label className="text-xs">Connection</Label>
            <Select value={connection} onValueChange={(v) => setConnection(v as ModelConnection)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="remote">Remote</SelectItem>
                <SelectItem value="api">API</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Endpoint</Label>
            <Input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="http://localhost:11434 or https://api.provider.com/v1"
            />
          </div>
          <div>
            <Label className="text-xs">Model identifier</Label>
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="qwen2.5-coder:32b"
            />
          </div>
          <div>
            <Label className="text-xs">API key (optional)</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTestStatus(endpoint && identifier ? "ok" : "fail")}
          >
            Test Connection
          </Button>
          {testStatus !== "idle" && (
            <span
              className={`text-xs ${testStatus === "ok" ? "text-emerald-400" : "text-rose-400"}`}
            >
              {testStatus === "ok" ? "Reachable (visual check)" : "Missing endpoint or identifier"}
            </span>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!name.trim() || !identifier.trim()) return;
              onAdd({
                name: name.trim(),
                provider: provider.trim() || "Custom",
                connection,
                endpoint: endpoint.trim(),
                identifier: identifier.trim(),
                hasApiKey: apiKey.length > 0,
              });
              setOpen(false);
              reset();
            }}
          >
            Add model
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- General -------------------- */

import { getWebSocketManager } from "@/lib/backend-websocket";
import { BackendRequestType } from "@/types/backend-messages";

function GeneralPane() {
  const setAppLocked = useIDEStore((s) => s.setAppLocked);
  const setAppPasswordHash = useIDEStore((s) => s.setAppPasswordHash);

  const handleChangePassword = () => {
    const newPass = prompt("Enter new master password (minimum 4 characters):");
    if (newPass === null) return;
    if (newPass.trim().length < 4) {
      alert("Password must be at least 4 characters.");
      return;
    }
    setAppPasswordHash(newPass.trim());
    alert("Password updated successfully!");
  };

  const handleRemovePassword = () => {
    if (confirm("Are you sure you want to remove the password? The IDE will be accessible to anyone on your network.")) {
      setAppPasswordHash(null);
      alert("Password removed.");
    }
  };

  const [debugLogEnabled, setDebugLogEnabled] = useState(false);

  const toggleDebugLog = () => {
    const newState = !debugLogEnabled;
    setDebugLogEnabled(newState);
    getWebSocketManager().sendRequest({
      type: BackendRequestType.SetDebugLog as any,
      payload: { enabled: newState }
    });
  };

  return (
    <section className="space-y-6">
      <PaneHeader title="General" description="Security and application-wide preferences." />
      
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Developer Mode</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Enable verbose debug logging in the Rust backend terminal.
            </p>
          </div>
          <Button variant={debugLogEnabled ? "default" : "secondary"} size="sm" onClick={toggleDebugLog}>
            {debugLogEnabled ? "Logging Enabled" : "Logging Disabled"}
          </Button>
        </div>
      </div>
      
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Security</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Manage your master password to protect your IDE from unauthorized access on the local network.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleChangePassword}>
              Change Password
            </Button>
            <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-500 hover:bg-red-400/10" onClick={handleRemovePassword}>
              Remove Password
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Lock Workspace</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Manually lock the IDE. You will need your password to get back in.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setAppLocked(true)}>
            Lock Now
          </Button>
        </div>
      </div>
    </section>
  );
}

/* -------------------- Shared -------------------- */

function PaneHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {action}
    </header>
  );
}
