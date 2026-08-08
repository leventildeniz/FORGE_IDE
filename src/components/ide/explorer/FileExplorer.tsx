import { useState, useEffect } from "react";
import {
  ChevronRight,
  File,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  FilePlus,
  FolderPlus,
  RefreshCw,
  Search,
} from "lucide-react";
import { FileNode, Environment } from "@/types/ide";
import { IDEStore, useIDEStore } from "@/stores/ide-store";
import { useShallow } from "zustand/react/shallow";
import { Input } from "@/components/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function iconFor(name: string) {
  if (name.endsWith(".json")) return FileJson;
  if (name.endsWith(".md") || name.endsWith(".txt")) return FileText;
  if (/\.(tsx?|jsx?|css|scss|html|py|rs|go)$/.test(name)) return FileCode;
  return File;
}

export function FileExplorer() {
  const {
    projectName,
    tree,
    openFile,
    activePath,
    fetchFileTree,
    projectRootPath,
    activeEnvId,
    environments,
    sftpListDir,
    createFile,
    createDirectory,
  } = useIDEStore(
    useShallow((state: IDEStore) => ({
      projectName: state.projectName,
      tree: state.tree,
      openFile: state.openFile,
      activePath: state.activePath,
      fetchFileTree: state.fetchFileTree,
      projectRootPath: state.projectRootPath,
      activeEnvId: state.activeEnvId,
      environments: state.environments,
      sftpListDir: state.sftpListDir,
      createFile: state.createFile,
      createDirectory: state.createDirectory,
    })),
  );
  const [query, setQuery] = useState("");

  const activeEnvironment = environments.find((env) => env.id === activeEnvId);
  const isSshEnvironment = activeEnvironment?.kind === "ssh";

  // Removed DIAGNOSTIC LOG: Log projectRootPath on every render of FileExplorer

  // Removed DIAGNOSTIC LOG: Log when projectRootPath changes
  useEffect(() => {
    // If projectRootPath becomes null, clear the search query to prevent showing old results
    if (projectRootPath === null) {
      setQuery("");
    }
  }, [projectRootPath]);

  const handleNewFileRoot = () => {
    console.log(
      "handleNewFileRoot clicked. projectRootPath:",
      projectRootPath,
      "activeEnvironment:",
      activeEnvironment,
    );
    if (!projectRootPath || !activeEnvironment) return;
    const fileName = window.prompt("Enter new file name:");
    if (fileName) {
      const newPath = `${projectRootPath}/${fileName}`;
      createFile(newPath, false, activeEnvironment.id, activeEnvironment).catch((err: any) =>
        console.error("Failed to create file:", err),
      );
    }
  };

  const handleNewFolderRoot = () => {
    console.log(
      "handleNewFolderRoot clicked. projectRootPath:",
      projectRootPath,
      "activeEnvironment:",
      activeEnvironment,
    );
    if (!projectRootPath || !activeEnvironment) return;
    const folderName = window.prompt("Enter new folder name:");
    if (folderName) {
      const newPath = `${projectRootPath}/${folderName}`;
      createDirectory(newPath, false, activeEnvironment.id, activeEnvironment).catch((err: any) =>
        console.error("Failed to create directory:", err),
      );
    }
  };

  // Refresh butonu için handler
  const handleRefresh = () => {
    console.log("handleRefresh clicked. projectRootPath:", projectRootPath);
    if (!projectRootPath) {
      console.warn("Frontend: No project root path set, cannot refresh file tree.");
      return;
    }

    console.log("Frontend: Refreshing file tree for project root:", projectRootPath);

    if (isSshEnvironment && activeEnvironment) {
      sftpListDir(projectRootPath, activeEnvironment.id, activeEnvironment);
    } else {
      fetchFileTree(projectRootPath);
    }
  };

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      {/* Removed debug div from UI */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Explorer
        </div>
        <div className="flex items-center gap-0.5">
          <IconBtn tip="New file" onClick={handleNewFileRoot}>
            <FilePlus className="size-3.5" />
          </IconBtn>
          <IconBtn tip="New folder" onClick={handleNewFolderRoot}>
            <FolderPlus className="size-3.5" />
          </IconBtn>
          <IconBtn tip="Refresh" onClick={handleRefresh}>
            <RefreshCw className="size-3.5" />
          </IconBtn>
        </div>
      </div>

      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files"
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto py-1">
        {projectRootPath ? (
          <>
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {projectName} (<span className="text-muted-foreground/70">{projectRootPath}</span>)
            </div>
            <TreeList
              nodes={tree}
              depth={0}
              filter={query.trim().toLowerCase()}
              activePath={activePath}
              onOpen={openFile}
              isSshEnvironment={isSshEnvironment}
              activeEnvironment={activeEnvironment}
            />
          </>
        ) : (
          <div className="p-2 text-sm text-muted-foreground">
            <p>No project opened.</p>
            {/* Geçici düğmeler kaldırıldı */}
          </div>
        )}
      </div>
    </aside>
  );
}

function IconBtn({
  tip,
  children,
  onClick,
}: {
  tip: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

function TreeList({
  nodes,
  depth,
  filter,
  activePath,
  onOpen,
  isSshEnvironment,
  activeEnvironment,
}: {
  nodes: FileNode[];
  depth: number;
  filter: string;
  activePath: string | null;
  onOpen: (path: string) => void;
  isSshEnvironment: boolean;
  activeEnvironment: Environment | undefined;
}) {
  return (
    <ul>
      {nodes.map((n) => (
        <TreeNode
          key={n.path}
          node={n}
          depth={depth}
          filter={filter}
          activePath={activePath}
          onOpen={onOpen}
          isSshEnvironment={isSshEnvironment}
          activeEnvironment={activeEnvironment}
        />
      ))}
    </ul>
  );
}

function nodeMatches(node: FileNode, filter: string): boolean {
  if (!filter) return true;
  if (node.name.toLowerCase().includes(filter)) return true;
  if (node.is_dir) {
    if (node.children) {
      return node.children.some((c) => nodeMatches(c, filter));
    }
    return false;
  }
  return false;
}

function TreeNode({
  node,
  depth,
  filter,
  activePath,
  onOpen,
  isSshEnvironment,
  activeEnvironment,
}: {
  node: FileNode;
  depth: number;
  filter: string;
  activePath: string | null;
  onOpen: (path: string) => void;
  isSshEnvironment: boolean;
  activeEnvironment: Environment | undefined;
}) {
  const [open, setOpen] = useState(Boolean(filter));
  const {
    sftpCreateDir,
    sftpRemoveDir,
    sftpRemoveFile,
    sftpRename,
    createDirectory,
    createFile,
    deletePath,
    renamePath,
    duplicateFile,
  } = useIDEStore(
    useShallow((state: IDEStore) => ({
      sftpCreateDir: state.sftpCreateDir,
      sftpRemoveDir: state.sftpRemoveDir,
      sftpRemoveFile: state.sftpRemoveFile,
      sftpRename: state.sftpRename,
      createDirectory: state.createDirectory,
      createFile: state.createFile,
      deletePath: state.deletePath,
      renamePath: state.renamePath,
      duplicateFile: state.duplicateFile,
    })),
  );

  // console.log(`TreeNode: Node: ${node.name}, Path: ${node.path}, is_dir: ${node.is_dir}, Children count: ${node.children ? node.children.length : 'N/A'}`);

  if (!nodeMatches(node, filter)) return null;

  if (node.is_dir) {
    const Icon = open ? FolderOpen : Folder;
    return (
      <li>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <button
              onClick={() => setOpen((v) => !v)}
              className="group flex w-full items-center gap-1 py-0.5 pr-2 text-xs hover:bg-accent/40"
              style={{ paddingLeft: 8 + depth * 12 }}
            >
              <ChevronRight
                className={`size-3 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
              />
              <Icon className="size-3.5 text-primary/80" />
              <span className="truncate">{node.name}</span>
            </button>
          </ContextMenuTrigger>
          <FolderContextItems
            node={node}
            isSshEnvironment={isSshEnvironment}
            activeEnvironment={activeEnvironment}
            sftpCreateDir={sftpCreateDir}
            sftpRemoveDir={sftpRemoveDir}
            sftpRename={sftpRename}
            createDirectory={createDirectory}
            createFile={createFile}
            deletePath={deletePath}
            renamePath={renamePath}
          />
        </ContextMenu>
        {open && node.children && (
          <TreeList
            nodes={node.children}
            depth={depth + 1}
            filter={filter}
            activePath={activePath}
            onOpen={onOpen}
            isSshEnvironment={isSshEnvironment}
            activeEnvironment={activeEnvironment}
          />
        )}
      </li>
    );
  }

  const Icon = iconFor(node.name);
  const isActive = activePath === node.path;
  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            onClick={() => onOpen(node.path)}
            className={`flex w-full items-center gap-1 py-0.5 pr-2 text-xs transition ${isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/40"}`}
            style={{ paddingLeft: 8 + depth * 12 + 12 }}
          >
            <Icon className="size-3.5 text-muted-foreground" />
            <span className="truncate">{node.name}</span>
            <span className="ml-auto text-[10px] font-medium text-muted-foreground opacity-0 group-hover:opacity-100">
              M
            </span>
          </button>
        </ContextMenuTrigger>
        <FileContextItems
          node={node}
          isSshEnvironment={isSshEnvironment}
          activeEnvironment={activeEnvironment}
          sftpRemoveFile={sftpRemoveFile}
          sftpRename={sftpRename}
          deletePath={deletePath}
          renamePath={renamePath}
          duplicateFile={duplicateFile}
          onOpen={onOpen}
        />
      </ContextMenu>
    </li>
  );
}

function FileContextItems({
  node,
  isSshEnvironment,
  activeEnvironment,
  sftpRemoveFile,
  sftpRename,
  deletePath,
  renamePath,
  duplicateFile,
  onOpen,
}: {
  node: FileNode;
  isSshEnvironment: boolean;
  activeEnvironment: Environment | undefined;
  sftpRemoveFile: (
    path: string,
    environmentId: string,
    activeEnvironmentDetails: Environment,
  ) => Promise<any>;
  sftpRename: (
    oldPath: string,
    newPath: string,
    environmentId: string,
    activeEnvironmentDetails: Environment,
  ) => Promise<any>;
  deletePath: (path: string, envId?: string, envDetails?: Environment) => Promise<boolean>;
  renamePath: (
    oldPath: string,
    newPath: string,
    envId?: string,
    envDetails?: Environment,
  ) => Promise<boolean>;
  duplicateFile: (path: string, envId?: string, envDetails?: Environment) => Promise<boolean>;
  onOpen: (path: string) => void;
}) {
  const handleRename = () => {
    const newName = window.prompt("Enter new name:", node.name);
    if (newName && newName !== node.name) {
      const newPath = `${node.path.substring(0, node.path.lastIndexOf("/"))}/${newName}`;
      if (isSshEnvironment && activeEnvironment) {
        sftpRename(node.path, newPath, activeEnvironment.id, activeEnvironment).catch((err: any) =>
          console.error("Failed to rename via SFTP:", err),
        );
      } else if (activeEnvironment) {
        renamePath(node.path, newPath, activeEnvironment.id, activeEnvironment).catch((err: any) =>
          console.error("Failed to rename path:", err),
        );
      }
    }
  };

  const handleDuplicate = () => {
    if (activeEnvironment) {
      duplicateFile(node.path, activeEnvironment.id, activeEnvironment).catch((err: any) =>
        console.error("Failed to duplicate file:", err),
      );
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${node.name}?`)) {
      if (isSshEnvironment && activeEnvironment) {
        sftpRemoveFile(node.path, activeEnvironment.id, activeEnvironment);
      } else if (activeEnvironment) {
        deletePath(node.path, activeEnvironment.id, activeEnvironment).catch((err: any) =>
          console.error("Failed to delete file:", err),
        );
      }
    }
  };

  return (
    <ContextMenuContent className="w-44">
      <ContextMenuItem onClick={() => onOpen(node.path)}>Open</ContextMenuItem>
      <ContextMenuItem onClick={handleRename}>Rename</ContextMenuItem>
      <ContextMenuItem onClick={handleDuplicate}>Duplicate</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => navigator.clipboard.writeText(node.path)}>
        Copy path
      </ContextMenuItem>
      <ContextMenuItem className="text-destructive" onClick={handleDelete}>
        Delete
      </ContextMenuItem>
    </ContextMenuContent>
  );
}

function FolderContextItems({
  node,
  isSshEnvironment,
  activeEnvironment,
  sftpCreateDir,
  sftpRemoveDir,
  sftpRename,
  createDirectory,
  createFile,
  deletePath,
  renamePath,
}: {
  node: FileNode;
  isSshEnvironment: boolean;
  activeEnvironment: Environment | undefined;
  sftpCreateDir: (
    path: string,
    environmentId: string,
    activeEnvironmentDetails: Environment,
  ) => Promise<any>;
  sftpRemoveDir: (
    path: string,
    environmentId: string,
    activeEnvironmentDetails: Environment,
  ) => Promise<any>;
  sftpRename: (
    oldPath: string,
    newPath: string,
    environmentId: string,
    activeEnvironmentDetails: Environment,
  ) => Promise<any>;
  createDirectory: (
    path: string,
    recursive?: boolean,
    envId?: string,
    envDetails?: Environment,
  ) => Promise<boolean>;
  createFile: (
    path: string,
    recursive?: boolean,
    envId?: string,
    envDetails?: Environment,
  ) => Promise<boolean>;
  deletePath: (path: string, envId?: string, envDetails?: Environment) => Promise<boolean>;
  renamePath: (
    oldPath: string,
    newPath: string,
    envId?: string,
    envDetails?: Environment,
  ) => Promise<boolean>;
}) {
  const handleNewFile = () => {
    const fileName = window.prompt("Enter new file name:");
    if (fileName && activeEnvironment) {
      const newPath = `${node.path}/${fileName}`;
      createFile(newPath, false, activeEnvironment.id, activeEnvironment).catch((err: any) =>
        console.error("Failed to create file:", err),
      );
    }
  };

  const handleNewFolder = () => {
    const folderName = window.prompt("Enter new folder name:");
    if (folderName && activeEnvironment) {
      const newPath = `${node.path}/${folderName}`;
      createDirectory(newPath, false, activeEnvironment.id, activeEnvironment).catch((err: any) =>
        console.error("Failed to create directory:", err),
      );
    }
  };

  const handleRename = () => {
    const newName = window.prompt("Enter new name:", node.name);
    if (newName && newName !== node.name) {
      const newPath = `${node.path.substring(0, node.path.lastIndexOf("/"))}/${newName}`;
      if (isSshEnvironment && activeEnvironment) {
        sftpRename(node.path, newPath, activeEnvironment.id, activeEnvironment).catch((err: any) =>
          console.error("Failed to rename via SFTP:", err),
        );
      } else if (activeEnvironment) {
        renamePath(node.path, newPath, activeEnvironment.id, activeEnvironment).catch((err: any) =>
          console.error("Failed to rename path:", err),
        );
      }
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${node.name} and its contents?`)) {
      if (isSshEnvironment && activeEnvironment) {
        sftpRemoveDir(node.path, activeEnvironment.id, activeEnvironment);
      } else if (activeEnvironment) {
        deletePath(node.path, activeEnvironment.id, activeEnvironment);
      }
    }
  };

  return (
    <ContextMenuContent className="w-44">
      <ContextMenuItem onClick={handleNewFile}>New file</ContextMenuItem>
      <ContextMenuItem onClick={handleNewFolder}>New folder</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={handleRename}>Rename</ContextMenuItem>
      <ContextMenuItem className="text-destructive" onClick={handleDelete}>
        Delete
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
