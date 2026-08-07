import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { FileNode } from "@/types/ide"; // Import FileNode type

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// New: Helper function to flatten a hierarchical FileNode tree into a flat list of files
export function flattenFileNodes(nodes: FileNode[]): FileNode[] {
  const out: FileNode[] = [];

  const walk = (list: FileNode[] | undefined) => {
    // list now can be undefined
    if (!list) return; // Handle cases where children might be null or undefined

    for (const n of list) {
      if (!n.is_dir) {
        // If it's a file
        out.push(n);
      } else if (n.children) {
        // If it's a directory and has children
        walk(n.children); // Pass children to walk, which also handles undefined
      }
    }
  };

  walk(nodes);
  return out;
}
