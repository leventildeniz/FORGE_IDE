import React, { useEffect, useState } from "react";
import { useIDEStore } from "@/stores/ide-store";
import { Environment } from "@/types/ide";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Folder, ChevronUp, Plus } from "lucide-react";
import { DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FileBrowserProps {
  currentPath: string;
  onPathChange: (path: string) => void;
  onSelectFolder: (path: string) => void;
  onCancel: () => void;
  activeEnvironment: Environment;
}

export default function FileBrowser({
  currentPath,
  onPathChange,
  onSelectFolder,
  onCancel,
}: FileBrowserProps) {
  const listDirectory = useIDEStore((s) => s.listDirectory);
  const createDirectory = useIDEStore((s) => s.createDirectory);
  const activeEnvId = useIDEStore((s) => s.activeEnvId);
  const environments = useIDEStore((s) => s.environments);
  const sftpListDir = useIDEStore((s) => s.sftpListDir);
  const sftpCreateDir = useIDEStore((s) => s.sftpCreateDir);

  const activeEnvironment = environments.find((env) => env.id === activeEnvId);
  const isSshEnvironment = activeEnvironment?.kind === "ssh";
  const [currentFolderContents, setCurrentFolderContents] = useState<any[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);

  // currentFolderContents state'ini izlemek için yeni bir useEffect ekleyelim
  useEffect(() => {
    console.log("FileBrowser: currentFolderContents UPDATED. New value:", currentFolderContents);
  }, [currentFolderContents]);

  const fetchContents = async (path: string) => {
    try {
      console.log("FileBrowser: Calling listDirectory for path:", path);
      let contents;
      if (isSshEnvironment && activeEnvironment) {
        contents = await sftpListDir(path, activeEnvironment.id, activeEnvironment);
      } else if (activeEnvironment) {
        contents = await listDirectory(path, false, activeEnvironment.id, activeEnvironment);
      } else {
        console.error("No active environment found for file browser.");
        setCurrentFolderContents([]);
        return;
      }

      if (!contents) {
        // Backend'den boş veya tanımsız yanıt gelirse
        console.warn("FileBrowser: Received empty or undefined contents from backend.");
        setCurrentFolderContents([]);
        return;
      }
      console.log("FileBrowser: Raw contents received from backend:", contents); // 'SSH test' etiketi kaldırıldı

      contents.forEach((node) => {
        console.log(
          "FileBrowser: Node details - Name:",
          node.name,
          "Path:",
          node.path,
          "is_dir:",
          node.is_dir,
        );
      });

      const filteredContents = contents.filter((node) => node.is_dir);
      console.log("FileBrowser: Filtered contents (only directories):", filteredContents); // 'SSH test' etiketi kaldırıldı
      // filteredContents'in boş olup olmadığını kontrol eden bir log ekleyelim
      if (filteredContents.length === 0) {
        console.warn(
          "FileBrowser: filteredContents is empty despite receiving nodes from backend.",
        ); // 'SSH test' etiketi kaldırıldı
      }
      setCurrentFolderContents(filteredContents);
      console.log("FileBrowser: currentFolderContents after update:", filteredContents); // 'SSH test' etiketi kaldırıldı
    } catch (error) {
      console.error("Failed to list directory:", error); // 'SSH test' etiketi kaldırıldı
      setCurrentFolderContents([]);
      console.log("FileBrowser: currentFolderContents after error (should be empty):", []); // 'SSH test' etiketi kaldırıldı
    }
  };

  useEffect(() => {
    console.log("FileBrowser: useEffect triggered for path:", currentPath);
    if (currentPath) {
      fetchContents(currentPath);
    }
    console.log(
      "FileBrowser: currentFolderContents (in useEffect after fetchContents call):",
      currentFolderContents,
    ); // YENİ LOG
  }, [currentPath, listDirectory]);

  const handleFolderClick = (path: string) => {
    onPathChange(path);
  };

  const handleGoUp = () => {
    const parentPath = currentPath.split("/").slice(0, -1).join("/") || "/";
    onPathChange(parentPath);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    // Clean up path concatenation to avoid double slashes
    const cleanPath = currentPath.endsWith("/") ? currentPath.slice(0, -1) : currentPath;
    const fullPath = `${cleanPath}/${newFolderName}`;

    if (!activeEnvironment) {
      console.error("Active environment not found.");
      return;
    }

    try {
      if (isSshEnvironment) {
        await sftpCreateDir(fullPath, activeEnvironment.id, activeEnvironment);
      } else {
        await createDirectory(fullPath, false, activeEnvironment.id, activeEnvironment);
      }
      setNewFolderName("");
      setCreateFolderDialogOpen(false);
      fetchContents(currentPath); // Klasör oluşturulduktan sonra içeriği yenile
    } catch (error) {
      console.error("Failed to create directory:", error);
      // Hata mesajı gösterebilirsiniz
    }
  };

  useEffect(() => {
    console.log("FileBrowser: useEffect triggered for path:", currentPath);
    if (currentPath) {
      fetchContents(currentPath);
    }
  }, [currentPath, listDirectory, sftpListDir, activeEnvId, environments]); // sftpListDir, activeEnvId, environments eklendi

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleGoUp} disabled={currentPath === "/"}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{currentPath}</span>
        </div>
        <AlertDialog open={createFolderDialogOpen} onOpenChange={setCreateFolderDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <Plus className="h-4 w-4 mr-2" /> Create Folder
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Create New Folder</AlertDialogTitle>
              <AlertDialogDescription>Enter a name for the new folder.</AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              placeholder="New folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleCreateFolder}>Create</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <ScrollArea className="flex-1 p-2">
        <ul className="space-y-1">
          {currentFolderContents.length === 0 ? (
            <li className="text-muted-foreground text-sm p-2">
              {isSshEnvironment
                ? "No folders in this directory. (SSH)"
                : "No folders in this directory."}
            </li>
          ) : (
            currentFolderContents.map((node) => (
              <li key={node.path}>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-foreground hover:bg-accent hover:text-foreground" // Orijinal tema uyumlu stillere döndük
                  onClick={() => handleFolderClick(node.path)}
                >
                  <Folder className="h-4 w-4 text-muted-foreground" />
                  {node.name}
                </Button>
              </li>
            ))
          )}
        </ul>
      </ScrollArea>
      <DialogFooter className="p-2 border-t border-border">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSelectFolder(currentPath)}>Select Folder</Button>
      </DialogFooter>
    </div>
  );
}
