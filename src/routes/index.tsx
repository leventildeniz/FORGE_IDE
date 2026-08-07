import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Anvil,
  Plus,
  FolderOpen,
  Clock,
  Sparkles,
  Monitor,
  Terminal,
  Globe,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import FileBrowser from "@/components/ui/file-browser";
import { useIDEStore } from "@/stores/ide-store";
import { Environment } from "@/types/ide";
import { RecentProject } from "@/types/ide";

// Backend functions will be used instead of localStorage
const RECENT_KEY = "recent-projects";

export const Route = createFileRoute("/")({
  head: () => {
    return {
      meta: [{ title: "Forge IDE" }, { name: "description", content: "Forge IDE" }],
    };
  },
  component: Welcome,
});

function Welcome() {
  const navigate = useNavigate();
  const projectName = useIDEStore((s) => s.projectName);
  const suggestedProjectRoots = useIDEStore((s) => s.suggestedProjectRoots);
  const setProjectRoot = useIDEStore((s) => s.setProjectRoot);
  const createProject = useIDEStore((s) => s.createProject);
  const environments = useIDEStore((s) => s.environments);
  const activeEnvId = useIDEStore((s) => s.activeEnvId);
  const setActiveEnv = useIDEStore((s) => s.setActiveEnv);
  const updateSshEnvironmentDetails = useIDEStore((s) => s.updateSshEnvironmentDetails);
  const connectSsh = useIDEStore((s) => s.connectSsh);
  const generateSshKey = useIDEStore((s) => s.generateSshKey);

  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [openOpen, setOpenOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPath, setNewPath] = useState("");
  const [selectedEnvId, setSelectedEnvId] = useState<string>(activeEnvId);
  const [sshHost, setSshHost] = useState("");
  const [sshUsername, setSshUsername] = useState("");
  const [sshPrivateKeyPath, setSshPrivateKeyPath] = useState(""); // Boş bırakılacak, backend kendisi bulacak
  const [sshPublicKey, setSshPublicKey] = useState("");
  const [fileBrowserOpen, setFileBrowserOpen] = useState(false);
  const [browseContext, setBrowseContext] = useState<"create" | "open" | null>(null);
  const [currentBrowsePath, setCurrentBrowsePath] = useState("/");

  const getRecentProjects = useIDEStore((s) => s.getRecentProjects);
  const deleteRecentProject = useIDEStore((s) => s.deleteRecentProject);
  const getEnvironments = useIDEStore((s) => s.getEnvironments);

  useEffect(() => {
    getEnvironments().catch((e) => {
      console.error("Failed to fetch environments from DB", e);
    });

    getRecentProjects()
      .then((projects) => {
        setRecent(projects);
      })
      .catch((e) => {
        console.error("Failed to get recent projects", e);
      });
  }, [getEnvironments, getRecentProjects]);

  async function removeRecent(id: string) {
    try {
      await deleteRecentProject(id);
      const projects = await getRecentProjects();
      setRecent(projects);
      toast.success("Project removed from recent list");
    } catch (e: any) {
      toast.error(`Failed to remove project: ${e.message}`);
    }
  }

  function getEnvIcon(envId: string) {
    const env = environments.find((e) => e.id === envId);
    if (!env) return <Monitor className="size-4 text-muted-foreground" />;

    if (env.kind === "ssh") return <Globe className="size-4 text-primary" />;
    if (env.kind === "wsl") return <Terminal className="size-4 text-green-500" />;
    return <Monitor className="size-4 text-blue-400" />;
  }

  async function goto(recentProj: RecentProject) {
    try {
      await openProject(recentProj.path, recentProj.environment_id);
    } catch (e) {
      // error is handled inside openProject
    }
  }

  useEffect(() => {
    setSelectedEnvId(activeEnvId);

    // Auto-fill SSH details if present in the selected environment
    const selectedEnv = environments.find((env) => env.id === activeEnvId);
    if (selectedEnv && selectedEnv.kind === "ssh") {
      if (selectedEnv.host) setSshHost(selectedEnv.host);
      if (selectedEnv.username) setSshUsername(selectedEnv.username);
      // Not populating private key here for security unless it's stored in the environment,
      // but if it is stored in the environment as private_key_path, we can restore it to the UI
      if (selectedEnv.privateKeyPath) setSshPrivateKeyPath(selectedEnv.privateKeyPath);
    }
  }, [activeEnvId, environments]);

  async function openProject(path: string, envId: string) {
    if (!path || path.trim() === "") {
      toast.error("Please enter a valid project path.");
      return;
    }

    const selectedEnv = environments.find((env) => env.id === envId);
    if (!selectedEnv) {
      toast.error("Environment not found.");
      throw new Error("Environment not found");
    }

    if (selectedEnv.kind === "ssh") {
      const hostToUse = sshHost || selectedEnv.host;
      const usernameToUse = sshUsername || selectedEnv.username;
      const keyToUse = sshPrivateKeyPath || selectedEnv.privateKeyPath;

      if (!hostToUse || !usernameToUse || !keyToUse) {
        toast.error(
          "Please fill in all SSH connection details (Host, Username, Private Key) to open the project.",
        );
        throw new Error("Missing SSH details");
      }
      const updatedEnv: Environment = {
        ...selectedEnv,
        host: hostToUse,
        username: usernameToUse,
        privateKeyPath: keyToUse,
        detail: `${usernameToUse}@${hostToUse}:22`,
        status: "disconnected",
      };
      updateSshEnvironmentDetails(selectedEnv.id, updatedEnv);

      const connectToast = toast.loading("Connecting to SSH...");
      try {
        await connectSsh(selectedEnv.id, updatedEnv);
        toast.success("Connected to SSH", { id: connectToast });
      } catch (err: any) {
        toast.error(`SSH Connection Failed: ${err.message}`, { id: connectToast });
        throw err;
      }
    }

    setActiveEnv(envId);
    setProjectRoot(path);
    useIDEStore.getState().fetchFileTree(path);

    // Save to recent projects
    const projectName = path.split("/").filter(Boolean).pop() || path;
    useIDEStore
      .getState()
      .saveRecentProject({
        id: `${envId}_${path}`,
        name: projectName,
        path: path,
        environment_id: envId,
      })
      .catch(console.error);

    navigate({ to: "/workspace" });
  }

  const handleBrowseClick = async (context: "create" | "open") => {
    const selectedEnv = environments.find((env) => env.id === selectedEnvId);
    if (!selectedEnv) {
      toast.error("Please select an environment.");
      return;
    }

    if (selectedEnv.kind === "ssh") {
      if (!sshHost || !sshUsername || !sshPrivateKeyPath) {
        toast.error(
          "Please fill in all SSH connection details (Host, Username, Private Key) before browsing.",
        );
        return;
      }
      const updatedEnv: Environment = {
        ...selectedEnv,
        host: sshHost,
        username: sshUsername,
        privateKeyPath: sshPrivateKeyPath,
        detail: `${sshUsername}@${sshHost}:22`,
        status: "disconnected",
      };
      updateSshEnvironmentDetails(selectedEnv.id, updatedEnv);

      const connectToast = toast.loading("Connecting to SSH...");
      try {
        await connectSsh(selectedEnv.id, updatedEnv);
        toast.success("Connected to SSH", { id: connectToast });
      } catch (err: any) {
        toast.error(`SSH Connection Failed: ${err.message}`, { id: connectToast });
        return;
      }
    }

    setBrowseContext(context);
    setFileBrowserOpen(true);
    setActiveEnv(selectedEnvId);

    let defaultBrowsePath = "/";

    if (selectedEnv) {
      const suggestedRoot = suggestedProjectRoots.find((root) => {
        if (selectedEnv.kind === "wsl" && root.name.includes("WSL Home")) {
          return true;
        }
        if (selectedEnv.kind === "ssh" && root.name.includes("Remote Home")) {
          return true;
        }
        if (selectedEnv.kind === "local" && root.name.includes("Home (Backend)")) {
          return true;
        }
        return false;
      });

      if (suggestedRoot) {
        defaultBrowsePath = suggestedRoot.path;
      } else {
        if (selectedEnv.kind === "wsl") {
          defaultBrowsePath = "/";
        } else if (selectedEnv.kind === "ssh") {
          defaultBrowsePath = "/"; // SFTP root is generally '/'
        } else if (selectedEnv.kind === "local") {
          defaultBrowsePath = "/";
        }
      }
    }
    setCurrentBrowsePath(defaultBrowsePath);
    console.log(
      `Frontend: handleBrowseClick. Setting currentBrowsePath to: ${defaultBrowsePath} for environment: ${selectedEnvId}`,
    );
  };

  const handleCreateProject = async () => {
    console.log("handleCreateProject called");
    setCreateOpen(false);

    const selectedEnv = environments.find((env) => env.id === selectedEnvId);

    if (!selectedEnv) {
      toast.error("Please select an environment.");
      return;
    }

    if (selectedEnv.kind === "ssh") {
      if (!sshHost || !sshUsername || !sshPrivateKeyPath) {
        toast.error("Please fill in all SSH connection details (Host, Username, Private Key).");
        return;
      }

      const updatedEnv: Environment = {
        ...selectedEnv,
        host: sshHost,
        username: sshUsername,
        privateKeyPath: sshPrivateKeyPath,
        detail: `${sshUsername}@${sshHost}:22`,
        status: "disconnected",
      };

      updateSshEnvironmentDetails(selectedEnv.id, updatedEnv);

      const connectToast = toast.loading("Connecting and creating project...");
      try {
        await connectSsh(selectedEnv.id, updatedEnv);
        await createProject(newName, newPath); // Actual project creation triggered here
        toast.success("Project created", { id: connectToast });

        // Reset fields after successful creation
        setNewName("");
        setNewPath("");
        setSshUsername("");
        setSshPrivateKeyPath("");

        // Refresh recent projects list
        const projects = await useIDEStore.getState().getRecentProjects();
        setRecent(projects);

        navigate({ to: "/workspace" });
      } catch (err: any) {
        toast.error(`Failed to create project: ${err.message}`, { id: connectToast });
      }
    } else {
      // Existing logic for local/WSL projects
      createProject(newName, newPath)
        .then(async () => {
          // Reset fields after successful creation
          setNewName("");
          setNewPath("");

          // Refresh recent projects list
          const projects = await useIDEStore.getState().getRecentProjects();
          setRecent(projects);

          navigate({ to: "/workspace" });
        })
        .catch((err: any) => {
          toast.error(`Failed to create project: ${err.message}`);
        });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-md bg-primary/15 text-primary">
              <Anvil className="size-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Forge IDE</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3" />
            AI pair programmer, code-first
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Write code. Understand it.
            <br />
            <span className="text-muted-foreground">Ship with AI.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground">
            Forge is a minimal coding environment focused on real software development. Open a
            project, edit files, get precise AI help, and review every change before it lands.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => setCreateOpen(true)}
            className="group flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-6 text-left transition hover:border-primary/60 hover:bg-accent/40"
          >
            <div className="grid size-10 place-items-center rounded-md bg-primary/15 text-primary">
              <Plus className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Create new project</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Start from a clean workspace.
              </div>
            </div>
          </button>

          <button
            onClick={() => setOpenOpen(true)}
            className="group flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-6 text-left transition hover:border-primary/60 hover:bg-accent/40"
          >
            <div className="grid size-10 place-items-center rounded-md bg-primary/15 text-primary">
              <FolderOpen className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Open project</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Open a folder from your machine.
              </div>
            </div>
          </button>
        </div>

        <div className="mt-12">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Clock className="size-3" />
            Recent projects
          </div>
          {recent.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
              No recent projects yet.
              <div className="mt-3">
                <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
                  Create a new project
                </Button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="group flex w-full items-center justify-between px-4 py-3 transition hover:bg-accent/40"
                >
                  <button
                    onClick={() => goto(r)}
                    className="flex-1 text-left flex items-center gap-3"
                  >
                    <div className="grid size-8 place-items-center rounded-md bg-background border border-border">
                      {getEnvIcon(r.environment_id)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{r.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{r.path}</div>
                    </div>
                  </button>
                  <div className="flex items-center gap-4">
                    <div className="text-xs text-muted-foreground">
                      {new Date(r.opened_at * 1000).toLocaleString()}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecent(r.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create new project</DialogTitle>
              <DialogDescription>Pick a name for the new workspace.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="pname">Project name</Label>
              <Input
                id="pname"
                placeholder="my-app"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ppath-create">Project path</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="ppath-create"
                  placeholder="~/projects"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                />
                <Button variant="outline" onClick={() => handleBrowseClick("create")}>
                  Browse
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="environment">Environment</Label>
              <Select value={selectedEnvId} onValueChange={setSelectedEnvId}>
                <SelectTrigger id="environment">
                  <SelectValue placeholder="Select an environment" />
                </SelectTrigger>
                <SelectContent>
                  {environments.map((env) => (
                    <SelectItem key={env.id} value={env.id}>
                      {env.name} ({env.kind})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedEnvId === "env_ssh" && (
              <div className="space-y-4 pt-2">
                <p className="text-sm font-medium">SSH Connection Details</p>
                <div className="space-y-2">
                  <Label htmlFor="ssh-host">Host</Label>
                  <Input
                    id="ssh-host"
                    placeholder="your.ssh.server.com"
                    value={sshHost}
                    onChange={(e) => setSshHost(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ssh-username">Username</Label>
                  <Input
                    id="ssh-username"
                    placeholder=""
                    value={sshUsername}
                    onChange={(e) => setSshUsername(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ssh-private-key">SSH Private Key (Path or PEM)</Label>
                  <Textarea
                    id="ssh-private-key"
                    placeholder="~/.ssh/id_ed25519 or -----BEGIN OPENSSH PRIVATE KEY-----..." // Placeholder for PEM
                    value={sshPrivateKeyPath}
                    onChange={(e) => setSshPrivateKeyPath(e.target.value)}
                    rows={6}
                  />
                  <Button
                    onClick={() => {
                      generateSshKey()
                        .then((response: any) => {
                          if (response && response.payload && response.payload.private_key_pem) {
                            setSshPrivateKeyPath(response.payload.private_key_pem);
                            setSshPublicKey(response.payload.public_key_openssh);
                            toast.success(
                              "SSH Key Generated! Please copy the Public Key below to your server.",
                            );
                          } else {
                            toast.error("Failed to generate SSH key. Response might be malformed.");
                          }
                        })
                        .catch((error: any) => {
                          toast.error(`Error generating SSH key: ${error.message}`);
                        });
                    }}
                    variant="outline"
                  >
                    Generate New SSH Key
                  </Button>
                </div>
                {sshPublicKey && (
                  <div className="grid gap-2">
                    <Label htmlFor="ssh-public-key">
                      Public Key (Copy to server's ~/.ssh/authorized_keys)
                    </Label>
                    <Textarea
                      id="ssh-public-key"
                      readOnly
                      value={sshPublicKey}
                      rows={4}
                      className="font-mono text-xs"
                    />
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateProject}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* FileBrowser Dialog */}
        <Dialog open={fileBrowserOpen} onOpenChange={setFileBrowserOpen}>
          <DialogContent className="max-w-xl h-[500px] flex flex-col">
            <DialogHeader>
              <DialogTitle>Select Folder</DialogTitle>
              <DialogDescription>
                Select the folder where you want to create your new project.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-hidden">
              <FileBrowser
                currentPath={currentBrowsePath}
                onPathChange={setCurrentBrowsePath}
                onSelectFolder={(path) => {
                  setNewPath(path);
                  setFileBrowserOpen(false);
                  if (browseContext === "create") {
                    setCreateOpen(true);
                  } else if (browseContext === "open") {
                    setOpenOpen(true);
                  }
                }}
                onCancel={() => {
                  setFileBrowserOpen(false);
                  if (browseContext === "create") {
                    setCreateOpen(true);
                  } else if (browseContext === "open") {
                    setOpenOpen(true);
                  }
                }}
                activeEnvironment={
                  {
                    ...(() => {
                      const selectedEnv = environments.find((env) => env.id === selectedEnvId);
                      const { password, privateKeyPath, ...restEnv } = selectedEnv || {};
                      return { ...restEnv, host: sshHost, username: sshUsername };
                    })(),
                  } as Environment
                }
              />
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={openOpen} onOpenChange={setOpenOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Open project</DialogTitle>
              <DialogDescription>
                Type the path to an existing project folder, or pick from a suggestion.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="ppath">Project path</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="ppath"
                  placeholder="~/projects/acme-web"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  autoFocus
                />
                <Button variant="outline" onClick={() => handleBrowseClick("open")}>
                  Browse
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="environment">Environment</Label>
              <Select
                value={selectedEnvId}
                onValueChange={(id) => {
                  setSelectedEnvId(id);
                  setActiveEnv(id);
                }}
              >
                <SelectTrigger id="environment">
                  <SelectValue placeholder="Select an environment" />
                </SelectTrigger>
                <SelectContent>
                  {environments.map((env) => (
                    <SelectItem key={env.id} value={env.id}>
                      {env.name} ({env.kind})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedEnvId === "env_ssh" && (
              <div className="space-y-4 pt-2">
                <p className="text-sm font-medium">SSH Connection Details</p>
                <div className="space-y-2">
                  <Label htmlFor="ssh-host-open">Host</Label>
                  <Input
                    id="ssh-host-open"
                    placeholder="your.ssh.server.com"
                    value={sshHost}
                    onChange={(e) => setSshHost(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ssh-username-open">Username</Label>
                  <Input
                    id="ssh-username-open"
                    placeholder=""
                    value={sshUsername}
                    onChange={(e) => setSshUsername(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ssh-private-key-open">SSH Private Key (Path or PEM)</Label>
                  <Textarea
                    id="ssh-private-key-open"
                    placeholder="~/.ssh/id_ed25519 or -----BEGIN OPENSSH PRIVATE KEY-----..."
                    value={sshPrivateKeyPath}
                    onChange={(e) => setSshPrivateKeyPath(e.target.value)}
                    rows={6}
                  />
                  <Button
                    onClick={() => {
                      generateSshKey()
                        .then((response: any) => {
                          if (response && response.payload && response.payload.private_key_pem) {
                            setSshPrivateKeyPath(response.payload.private_key_pem);
                            setSshPublicKey(response.payload.public_key_openssh);
                            toast.success(
                              "SSH Key Generated! Please copy the Public Key below to your server.",
                            );
                          } else {
                            toast.error("Failed to generate SSH key. Response might be malformed.");
                          }
                        })
                        .catch((error: any) => {
                          toast.error(`Error generating SSH key: ${error.message}`);
                        });
                    }}
                    variant="outline"
                  >
                    Generate New SSH Key
                  </Button>
                </div>
                {sshPublicKey && (
                  <div className="grid gap-2">
                    <Label htmlFor="ssh-public-key-open">
                      Public Key (Copy to server's ~/.ssh/authorized_keys)
                    </Label>
                    <Textarea
                      id="ssh-public-key-open"
                      readOnly
                      value={sshPublicKey}
                      rows={4}
                      className="font-mono text-xs"
                    />
                  </div>
                )}
              </div>
            )}
            {suggestedProjectRoots.length > 0 && (
              <div className="space-y-2">
                <Label>Suggestions</Label>
                <ScrollArea className="h-40 rounded-md border">
                  <ul className="divide-y divide-border">
                    {suggestedProjectRoots.map((root) => (
                      <li key={root.path}>
                        <button
                          onClick={async () => {
                            try {
                              await openProject(root.path, selectedEnvId);
                              setOpenOpen(false);
                            } catch (e) {
                              // error is handled inside openProject
                            }
                          }}
                          className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-accent/40"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{root.name}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {root.path}
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpenOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await openProject(newPath, selectedEnvId);
                    setOpenOpen(false);
                  } catch (e) {
                    // error is handled inside openProject
                  }
                }}
              >
                Open
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
