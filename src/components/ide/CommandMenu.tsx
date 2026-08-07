import { useNavigate } from "@tanstack/react-router";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useIDEStore } from "@/stores/ide-store";
import { flattenFileNodes } from "@/lib/utils"; // Updated import to use our new utility function
import {
  FileCode,
  Home,
  Settings as SettingsIcon,
  PanelLeft,
  PanelRight,
  PanelBottom,
  Save,
  Sparkles,
} from "lucide-react";

export function CommandMenu() {
  const {
    commandOpen,
    setCommandOpen,
    tree,
    openFile,
    toggleExplorer,
    toggleAi,
    toggleBottom,
    saveActive,
  } = useIDEStore();
  const navigate = useNavigate();
  const files = flattenFileNodes(tree); // Use flattenFileNodes with the real tree state

  function run(fn: () => void) {
    setCommandOpen(false);
    setTimeout(fn, 0);
  }

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Type a command or search files…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Files">
          {files.map((f) => (
            <CommandItem
              key={f.path}
              value={`file ${f.path}`}
              onSelect={() => run(() => openFile(f.path))}
            >
              <FileCode className="mr-2 size-4" />
              <span className="truncate">{f.path}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(() => saveActive())}>
            <Save className="mr-2 size-4" /> Save current file
          </CommandItem>
          <CommandItem onSelect={() => run(() => toggleExplorer())}>
            <PanelLeft className="mr-2 size-4" /> Toggle explorer
          </CommandItem>
          <CommandItem onSelect={() => run(() => toggleAi())}>
            <PanelRight className="mr-2 size-4" /> Toggle AI panel
          </CommandItem>
          <CommandItem onSelect={() => run(() => toggleBottom())}>
            <PanelBottom className="mr-2 size-4" /> Toggle bottom panel
          </CommandItem>
          <CommandItem onSelect={() => run(() => {})}>
            <Sparkles className="mr-2 size-4" /> Ask AI about current file
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => run(() => navigate({ to: "/" }))}>
            <Home className="mr-2 size-4" /> Go to welcome
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/settings" }))}>
            <SettingsIcon className="mr-2 size-4" /> Open settings
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
