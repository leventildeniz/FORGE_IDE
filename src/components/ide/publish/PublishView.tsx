import {
  Rocket,
  Github,
  Globe,
  CheckCircle2,
  Download,
  Archive,
  RefreshCw,
  GitCommit,
  Play,
  FolderGit2,
  Link as LinkIcon,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useIDEStore } from "@/stores/ide-store";
import { toast } from "sonner";
import { BackendRequestType } from "@/types/backend-messages";
import { getWebSocketManager } from "@/lib/backend-websocket";
import { useEffect, useState } from "react";

export function PublishView() {
  const {
    projectName,
    projectRootPath,
    isGitRepo,
    remoteUrl,
    gitStatus,
    activeBranch,
    generatedCommitMessage,
    isGeneratingCommit,
    isPushing,
    getGitStatus,
    generateCommitMessage,
    setGeneratedCommitMessage,
    commitAndPush,
    pullFromRemote,
    initGitRepo,
    addGitRemote,
    removeGitRemote,
  } = useIDEStore();

  const [remoteInput, setRemoteInput] = useState("");
  const [patInput, setPatInput] = useState("");

  useEffect(() => {
    if (projectRootPath) {
      getGitStatus();
    }
  }, [projectRootPath, getGitStatus]);

  const handleExportZip = () => {
    if (!projectRootPath) {
      toast.error("No active project to export.");
      return;
    }
    const ws = getWebSocketManager();
    ws.sendRequest({
      type: BackendRequestType.ExportProject as unknown as BackendRequestType,
      payload: {
        project_root: projectRootPath,
      },
    });
    toast.info("Exporting project... This might take a few seconds.");
  };

  const handleCommit = () => {
    if (gitStatus && gitStatus.length > 0 && !generatedCommitMessage.trim()) {
      toast.error("Please provide a commit message.");
      return;
    }
    commitAndPush(generatedCommitMessage.trim() || "Pushing existing commits");
  };

  const handleAddRemote = () => {
    if (!remoteInput.trim()) return;

    let finalUrl = remoteInput.trim();
    if (patInput.trim() && finalUrl.startsWith("https://")) {
      try {
        const urlObj = new URL(finalUrl);
        // We use the first path segment as the username (e.g. from /levent/repo.git)
        const pathParts = urlObj.pathname.split("/").filter(Boolean);
        if (pathParts.length > 0) {
          urlObj.username = pathParts[0];
        } else {
          urlObj.username = "oauth2";
        }
        urlObj.password = patInput.trim();
        finalUrl = urlObj.toString();
      } catch (e) {
        finalUrl = finalUrl.replace("https://", `https://oauth2:${patInput.trim()}@`);
      }
    }

    addGitRemote(finalUrl);
    setRemoteInput("");
    setPatInput("");
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background">
      <div className="mx-auto max-w-3xl space-y-6 p-8">
        <header className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-primary/15 text-primary">
            <Rocket className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Publish & Export</h1>
            <p className="text-xs text-muted-foreground">
              Package your project for deployment, version control, or local export.
            </p>
          </div>
        </header>

        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Archive className="size-4 text-blue-400" /> Export Project (ZIP)
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Download a clean snapshot of your project. Automatically excludes{" "}
                <code className="bg-white/10 px-1 py-0.5 rounded">node_modules</code>,{" "}
                <code className="bg-white/10 px-1 py-0.5 rounded">.git</code>, and{" "}
                <code className="bg-white/10 px-1 py-0.5 rounded">target</code> folders.
              </p>
            </div>
            <Button onClick={handleExportZip} size="sm" className="gap-2 shrink-0">
              <Download className="size-4" /> Export as ZIP
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Github className="size-4 text-emerald-400" /> Version Control (Git)
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                AI-assisted version control. Let the local architect summarize your diffs and
                generate commit messages.
              </p>
            </div>
            {isGitRepo && (
              <div className="flex flex-col items-end gap-1">
                <span className="rounded border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Branch: {activeBranch || "Unknown"}
                </span>
                {remoteUrl ? (
                  <div className="flex items-center gap-1">
                    <span
                      className="text-[10px] text-muted-foreground truncate max-w-[200px]"
                      title={remoteUrl}
                    >
                      {remoteUrl}
                    </span>
                    <button
                      onClick={removeGitRemote}
                      className="text-muted-foreground hover:text-red-400 p-0.5 rounded transition-colors"
                      title="Remove Remote"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-amber-500">No Remote URL</span>
                )}
              </div>
            )}
          </div>

          {!isGitRepo ? (
            <div className="flex flex-col items-center justify-center py-6 bg-white/5 rounded border border-dashed border-white/10">
              <FolderGit2 className="size-8 text-muted-foreground mb-3" />
              <p className="text-sm font-medium mb-1">Not a Git Repository</p>
              <p className="text-xs text-muted-foreground mb-4 text-center max-w-xs">
                This project folder is not initialized with Git. Would you like to initialize it
                now?
              </p>
              <Button onClick={initGitRepo} size="sm">
                Initialize Git Repository
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {!remoteUrl && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 p-3 rounded-md">
                  <LinkIcon className="size-4 text-amber-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-amber-500/90 font-medium">
                      Connect Remote Repository
                    </p>
                    <p className="text-[10px] text-amber-500/70">
                      Add a GitHub/GitLab URL to push your code.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Input
                      placeholder="https://github.com/user/repo.git"
                      value={remoteInput}
                      onChange={(e) => setRemoteInput(e.target.value)}
                      className="h-7 text-xs w-[350px] border-amber-500/30 bg-background/50"
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        type="password"
                        placeholder="Personal Access Token (Optional)"
                        value={patInput}
                        onChange={(e) => setPatInput(e.target.value)}
                        className="h-7 text-xs w-[280px] border-amber-500/30 bg-background/50"
                      />
                      <Button size="sm" className="h-7 w-[62px]" onClick={handleAddRemote}>
                        Connect
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {gitStatus && gitStatus.length > 0 ? (
                <div className="bg-[#18181b] rounded-md border border-white/5 p-3 max-h-[150px] overflow-y-auto">
                  <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">
                    Changed Files ({gitStatus.length})
                  </div>
                  {gitStatus.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-1 py-1 hover:bg-white/5 rounded text-xs font-mono"
                    >
                      <span
                        className={`w-4 text-center ${file.status.includes("M") ? "text-blue-400" : file.status.includes("D") ? "text-red-400" : "text-emerald-400"}`}
                      >
                        {file.status}
                      </span>
                      <span className="text-foreground/80">{file.file}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground bg-white/5 px-3 py-2 rounded border border-white/5">
                  No uncommitted changes. Working tree is clean.
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Textarea
                  value={generatedCommitMessage}
                  onChange={(e) => setGeneratedCommitMessage(e.target.value)}
                  placeholder="Commit message (Click 'Generate' to have AI write this for you based on diffs)..."
                  className="min-h-[80px] font-mono text-sm resize-none"
                  disabled={!gitStatus?.length}
                />
                <div className="flex justify-between items-center">
                  <Button
                    onClick={generateCommitMessage}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={isGeneratingCommit || !gitStatus?.length}
                  >
                    {isGeneratingCommit ? (
                      <RefreshCw className="size-3.5 animate-spin" />
                    ) : (
                      <GitCommit className="size-3.5" />
                    )}
                    {isGeneratingCommit ? "Analyzing diffs..." : "Generate AI Commit"}
                  </Button>

                  <Button
                    onClick={pullFromRemote}
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    disabled={isPushing || !remoteUrl}
                  >
                    <Download className="size-3.5" /> Pull from Remote
                  </Button>

                  <Button
                    onClick={handleCommit}
                    size="sm"
                    className="gap-2"
                    disabled={isPushing || (!gitStatus?.length && !remoteUrl) || (!!gitStatus?.length && !generatedCommitMessage.trim())}
                  >
                    {isPushing ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    {isPushing
                      ? remoteUrl
                        ? "Pushing..."
                        : "Committing..."
                      : gitStatus?.length
                        ? remoteUrl
                          ? "Commit & Push"
                          : "Commit Local"
                        : "Push to Remote"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
