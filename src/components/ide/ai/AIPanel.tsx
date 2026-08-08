import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Send,
  Copy,
  Check,
  RefreshCw,
  Square,
  Trash2,
  MessageSquarePlus,
  Sparkles,
  FileCode,
  CheckCircle2,
  XCircle,
  Eye,
  ChevronRight,
  Bot,
  User as UserIcon,
  Paperclip,
  ChevronDown,
  MessageCircleQuestion,
  ListTodo,
  Code2,
  Bug,
  Image as ImageIcon,
  Archive,
  Settings,
  History,
  Pencil,
  Plus,
  FileText,
  Minimize2,
  Terminal,
  Bot as BotIcon,
  FastForward,
} from "lucide-react";
import { IDEStore, useIDEStore } from "@/stores/ide-store";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChangeSet, ChatMessage, ChatMessagePart, AIChatMode } from "@/types/ide";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

const CHAT_MODES: { id: AIChatMode; label: string; icon: any; desc: string }[] = [
  { id: "code", label: "Code", icon: Code2, desc: "Write and edit code" },
  { id: "ask", label: "Ask", icon: MessageCircleQuestion, desc: "Ask questions without editing" },
  { id: "plan", label: "Plan", icon: ListTodo, desc: "Create an execution plan" },
  { id: "debug", label: "Debug", icon: Bug, desc: "Find and fix errors" },
];

export interface ContextPill {
  type: "knowledge" | "file";
  name: string;
  path: string;
}

export function AIPanel() {
  const {
    messages,
    chatHistory,
    activeChatId,
    loadChat,
    deleteChat,
    streaming,
    stop,
    clear,
    regenerate,
    send,
    compactChat,
    setBottomTab,
    chatMode,
    setChatMode,
    models,
    activeModelId,
    setActiveModel,
    profiles,
    tree,
  } = useIDEStore(
    useShallow((state: IDEStore) => ({
      messages: state.messages,
      chatHistory: state.chatHistory,
      activeChatId: state.activeChatId,
      loadChat: state.loadChat,
      deleteChat: state.deleteChat,
      streaming: state.streaming,
      stop: state.stop,
      clear: state.clear,
      regenerate: state.regenerate,
      send: state.send,
      compactChat: state.compactChat,
      setBottomTab: state.setBottomTab,
      chatMode: state.chatMode,
      setChatMode: state.setChatMode,
      models: state.models,
      activeModelId: state.activeModelId,
      setActiveModel: state.setActiveModel,
      profiles: state.profiles,
      tree: state.tree,
    })),
  );

  const [input, setInput] = useState("");
  const pendingAttachments = useIDEStore((s) => s.pendingAttachments);
  const messageQueue = useIDEStore((s) => s.messageQueue);
  const addPendingAttachment = useIDEStore((s) => s.addPendingAttachment);
  const removePendingAttachment = useIDEStore((s) => s.removePendingAttachment);
  const clearPendingAttachments = useIDEStore((s) => s.clearPendingAttachments);
  const [contextPills, setContextPills] = useState<ContextPill[]>([]);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState(false);

  // Active Editor Content Context
  const activePath = useIDEStore((s) => s.activePath);
  const activeTab = useIDEStore((s) => s.tabs.find((t) => t.path === activePath));
  const activeModel = models.find((m) => m.id === activeModelId);

  const activeMode =
    CHAT_MODES.find((m) => m.id === chatMode) ||
    (profiles.find((p) => p.id === chatMode)
      ? {
          id: chatMode,
          label: profiles.find((p) => p.id === chatMode)?.name || "Custom",
          icon: UserIcon,
          desc: profiles.find((p) => p.id === chatMode)?.description || "",
        }
      : CHAT_MODES[0]);

  // Rough Token Estimation (1 word ~ 1.3 tokens)
  const estimateTokens = (text: string) => Math.ceil((text.trim().split(/\s+/).length || 0) * 1.3);

  const currentFileTokens = activeTab ? estimateTokens(activeTab.content) : 0;
  const inputTokens = estimateTokens(input);
  const systemTokens = activeMode.desc
    ? estimateTokens(activeMode.desc)
    : activeModel?.systemPrompt
      ? estimateTokens(activeModel.systemPrompt)
      : 0;
  const totalTokens = currentFileTokens + inputTokens + systemTokens;
  const maxTokens = activeModel?.contextWindow || 128000;
  const tokenPercentage = Math.min(100, Math.round((totalTokens / maxTokens) * 100));

  const safeChatHistory = Array.isArray(chatHistory) ? chatHistory : [];

  const extractKnowledgeFiles = useCallback((nodes: any[], currentPath: string[] = []): any[] => {
    let results: any[] = [];
    if (!nodes || !Array.isArray(nodes)) return results;

    for (const node of nodes) {
      if (!node) continue;
      if (node.is_dir) {
        if (node.children && Array.isArray(node.children)) {
          results = results.concat(
            extractKnowledgeFiles(node.children, [...currentPath, node.name]),
          );
        }
      } else {
        if (
          currentPath.includes(".forge") &&
          currentPath.includes("knowledge") &&
          node.name?.endsWith(".md")
        ) {
          results.push(node);
        }
      }
    }
    return results;
  }, []);

  const knowledgeFiles = useMemo(() => {
    return extractKnowledgeFiles(tree);
  }, [tree, extractKnowledgeFiles]);

  const filteredKnowledgeFiles = useMemo(() => {
    return knowledgeFiles.filter((f) =>
      f.name?.toLowerCase().includes((mentionQuery || "").toLowerCase()),
    );
  }, [knowledgeFiles, mentionQuery]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    // Check if user just typed `@`
    const lastWord = val.split(/\s/).pop() || "";
    if (lastWord.startsWith("@") && lastWord !== "@scrape") {
      setShowMentionMenu(true);
      setMentionQuery(lastWord.slice(1));
    } else {
      setShowMentionMenu(false);
    }
  };

  const handleMentionSelect = (file: any) => {
    setContextPills((prev) => [...prev, { type: "knowledge", name: file.name, path: file.path }]);
    // Remove the `@query` from input
    const words = input.split(/\s/);
    words.pop(); // remove the last word which is the query
    setInput(words.join(" ") + (words.length > 0 ? " " : ""));
    setShowMentionMenu(false);
    setMentionQuery("");
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;

    // If scrolled up more than 50px from bottom, pause auto-scroll
    if (distanceFromBottom > 50) {
      setIsAutoScrollPaused(true);
    } else {
      setIsAutoScrollPaused(false);
    }
  };

  useEffect(() => {
    if (!isAutoScrollPaused && listRef.current) {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight });
    }
  }, [messages, isAutoScrollPaused]);

  async function submit() {
    const text = input.trim();
    if (!text && pendingAttachments.length === 0 && contextPills.length === 0) return;

    if (text === "/compact") {
      compactChat();
      setInput("");
      return;
    }

    const processedAttachments = await Promise.all(
      pendingAttachments.map(async (file) => {
        return new Promise<{ name: string; type: string; content: string }>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            // if it's base64 data URL, we can pass it as is or strip the prefix
            resolve({
              name: file.name,
              type: file.type,
              content: result,
            });
          };
          // For text/md files, read as text. For images, read as Data URL.
          if (
            file.type.startsWith("text/") ||
            file.name.endsWith(".md") ||
            file.name.endsWith(".txt") ||
            file.name.endsWith(".json")
          ) {
            reader.readAsText(file);
          } else {
            reader.readAsDataURL(file);
          }
        });
      }),
    );

    if (streaming) {
      toast("AI is currently typing...", {
        description:
          "Do you want to interrupt the current response, or queue this message for later?",
        action: {
          label: "Interrupt & Send",
          onClick: () => {
            stop();
            // Wait for backend to clear the previous task muteces
            setTimeout(() => {
              send(text, processedAttachments, contextPills);
            }, 800);
            setInput("");
            clearPendingAttachments();
            setContextPills([]);
          },
        },
        cancel: {
          label: "Add to Queue",
          onClick: () => {
            useIDEStore.getState().enqueueMessage(text, processedAttachments, contextPills);
            toast.success("Message queued. It will be sent automatically when the AI finishes.");
            setInput("");
            clearPendingAttachments();
            setContextPills([]);
          },
        },
        duration: 8000,
      });
      return;
    }

    send(text, processedAttachments, contextPills);
    setInput("");
    clearPendingAttachments();
    setContextPills([]);
  }

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            addPendingAttachment(file);
          }
        }
      }
    },
    [addPendingAttachment],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      newFiles.forEach((file) => addPendingAttachment(file));
      e.target.value = ""; // Reset input so the same file can be selected again
    }
  };

  const removeAttachment = (index: number) => {
    removePendingAttachment(index);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) return <ImageIcon className="size-3 text-blue-400" />;
    if (file.name.endsWith(".md") || file.name.endsWith(".txt"))
      return <FileCode className="size-3 text-yellow-400" />;
    if (file.name.endsWith(".zip") || file.name.endsWith(".rar"))
      return <Archive className="size-3 text-red-400" />;
    return <Paperclip className="size-3 text-muted-foreground" />;
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const items = e.dataTransfer.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            addPendingAttachment(file);
          }
        }
      }
    },
    [addPendingAttachment],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleReview = useCallback(() => {
    setBottomTab("diff");
  }, [setBottomTab]);

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-border bg-[#18181b] text-foreground">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/5 px-3 bg-[#1e1e20]">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium hover:bg-white/10 transition-colors">
                <activeMode.icon className="size-3.5 text-primary" />
                <span>{activeMode.label}</span>
                <ChevronDown className="size-3 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 bg-[#1e1e20] border-white/10">
              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                Default Profiles
              </div>
              {CHAT_MODES.map((mode) => (
                <DropdownMenuItem
                  key={mode.id}
                  onClick={() => setChatMode(mode.id)}
                  className="flex flex-col items-start gap-1 py-2 focus:bg-white/10 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <mode.icon
                      className={`size-3.5 ${chatMode === mode.id ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <span className="font-medium">{mode.label}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground pl-5">{mode.desc}</span>
                </DropdownMenuItem>
              ))}

              {profiles.length > 0 && (
                <>
                  <div className="h-px bg-white/10 my-1"></div>
                  <div className="px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                    Custom Profiles
                  </div>
                  {profiles.map((profile) => (
                    <DropdownMenuItem
                      key={profile.id}
                      onClick={() => setChatMode(profile.id)}
                      className="flex flex-col items-start gap-1 py-2 focus:bg-white/10 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <UserIcon
                          className={`size-3.5 ${chatMode === profile.id ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <span className="font-medium">{profile.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground pl-5 line-clamp-1">
                        {profile.description}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-3 bg-white/10 mx-1"></div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium hover:bg-white/10 transition-colors text-muted-foreground">
                <Sparkles className="size-3.5" />
                <span className="max-w-[150px] truncate">
                  {models.find((m) => m.id === activeModelId)?.name || "Select Model"}
                </span>
                <ChevronDown className="size-3 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 bg-[#1e1e20] border-white/10">
              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                Models
              </div>
              {models.length === 0 && (
                <div className="px-2 py-2 text-xs text-muted-foreground">No models configured.</div>
              )}
              {models.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  className={`py-2 focus:bg-white/10 cursor-pointer ${activeModelId === m.id ? "text-foreground" : "text-muted-foreground"}`}
                  onClick={() => setActiveModel(m.id)}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium truncate">{m.name}</span>
                    {activeModelId === m.id && <Check className="size-3 text-primary shrink-0" />}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                title="Chat History"
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
              >
                <History className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-64 bg-[#1e1e20] border-white/10 max-h-[300px] overflow-auto"
            >
              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                Recent Chats
              </div>
              {safeChatHistory.length === 0 ? (
                <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                  No history yet
                </div>
              ) : (
                safeChatHistory.map((chat) => (
                  <div
                    key={chat.id}
                    className="flex items-center justify-between hover:bg-white/10 px-2 py-1.5 rounded-sm group cursor-pointer"
                    onClick={() => loadChat(chat.id)}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium truncate text-foreground/90">
                        {chat.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(chat.updated_at).toLocaleDateString()}{" "}
                        {new Date(chat.updated_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(chat.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 text-muted-foreground hover:text-destructive rounded-sm transition-all"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Link
            to="/settings"
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
            title="Settings"
          >
            <Settings className="size-4" />
          </Link>

          <button
            onClick={() => clear()}
            title="New chat"
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
          >
            <MessageSquarePlus className="size-4" />
          </button>
        </div>
      </div>

      <div
        ref={listRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-auto p-4 scroll-smooth relative"
      >
        {messages.length === 0 ? (
          <EmptyState mode={activeMode} />
        ) : (
          <div className="space-y-6">
            {messages.map((m, index) => (
              <Message
                key={m.id}
                message={m}
                onReview={handleReview}
                isLast={index === messages.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/5 p-3 bg-[#1e1e20]">
        {streaming && (
          <div className="mb-2 flex justify-center">
            <Button
              size="sm"
              variant="secondary"
              onClick={stop}
              className="h-7 gap-1.5 text-xs rounded-full shadow-sm"
            >
              <Square className="size-3" fill="currentColor" /> Stop generating
            </Button>
          </div>
        )}

        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {pendingAttachments.map((file, i) => (
              <div
                key={i}
                className="group relative flex items-center gap-1.5 rounded-md bg-white/5 border border-white/10 px-2 py-1 text-xs"
              >
                {getFileIcon(file)}
                <span className="max-w-[100px] truncate">{file.name}</span>
                <button
                  onClick={() => removeAttachment(i)}
                  className="absolute -top-1.5 -right-1.5 hidden group-hover:grid size-4 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-sm"
                >
                  <XCircle className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Context Preview UI (Compact & Detailed) */}
        <div className="flex items-center justify-between gap-2 mb-2 px-1">
          <div className="flex flex-wrap gap-1 items-center font-mono text-[9px] uppercase tracking-wider">
            {/* System Prompt Budget */}
            <div
              className="flex items-center gap-1 bg-blue-500/10 text-blue-400/90 border border-blue-500/20 px-1.5 py-0.5 rounded"
              title="System Prompt & Profile Instructions"
            >
              <span>SYS</span>
              <span className="opacity-60">{systemTokens}t</span>
            </div>

            {/* Active File Budget */}
            {activeTab && (
              <div
                className="flex items-center gap-1 bg-green-500/10 text-green-400/90 border border-green-500/20 px-1.5 py-0.5 rounded max-w-[120px]"
                title={`Active File: ${activeTab.path}\nTokens: ${currentFileTokens}`}
              >
                <span>FILE</span>
                <span className="opacity-60 truncate">{activeTab.name}</span>
              </div>
            )}

            {/* Knowledge Base Budget */}
            {contextPills.length > 0 && (
              <div
                className="flex items-center gap-1 bg-yellow-500/10 text-yellow-400/90 border border-yellow-500/20 px-1.5 py-0.5 rounded"
                title={`${contextPills.length} Knowledge Files attached`}
              >
                <span>KNW</span>
                <span className="opacity-60">{contextPills.length}f</span>
              </div>
            )}

            {/* History Budget */}
            {safeChatHistory.length > 0 && (
              <div
                className="flex items-center gap-1 bg-purple-500/10 text-purple-400/90 border border-purple-500/20 px-1.5 py-0.5 rounded"
                title={`${safeChatHistory.length} previous messages in context`}
              >
                <span>HST</span>
                <span className="opacity-60">{safeChatHistory.length}m</span>
              </div>
            )}
          </div>
        </div>

        {/* Queued Messages UI */}
        {messageQueue.length > 0 && (
          <div className="flex flex-col gap-2 mb-3">
            {messageQueue.map((msg, i) => (
              <div
                key={i}
                className="flex flex-col gap-1.5 p-2.5 rounded-lg border border-orange-500/20 bg-orange-500/5 relative group"
              >
                <div className="flex items-center gap-2 mb-1 text-[10px] uppercase font-bold tracking-wider text-orange-500/80">
                  <ListTodo className="size-3" /> Queued Message {i + 1}
                </div>
                <div className="text-xs text-white/80 line-clamp-3">{msg.text}</div>
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="text-[10px] text-muted-foreground mt-1">
                    + {msg.attachments.length} attachment(s)
                  </div>
                )}

                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 bg-white/5 hover:bg-orange-500/20 hover:text-orange-400"
                    title="Interrupt AI & Send Now"
                    onClick={() => useIDEStore.getState().promoteQueuedMessage(i)}
                  >
                    <FastForward className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 bg-white/5 hover:bg-destructive/20 hover:text-destructive"
                    title="Remove from Queue"
                    onClick={() => useIDEStore.getState().removeQueuedMessage(i)}
                  >
                    <XCircle className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          className="relative flex flex-col rounded-xl border border-white/10 bg-[#18181b] focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-sm"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
        >
          {/* Render Context Pills inside the input area, above the textarea */}
          {contextPills.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pt-3">
              {contextPills.map((pill, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-full bg-primary/20 text-primary px-2.5 py-0.5 text-xs font-medium border border-primary/30"
                >
                  <span className="truncate max-w-[150px]">📚 {pill.name}</span>
                  <button
                    onClick={() => setContextPills((prev) => prev.filter((_, idx) => idx !== i))}
                    className="hover:text-foreground"
                  >
                    <XCircle className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Mention Popover */}
          {showMentionMenu && (
            <div className="absolute left-3 bottom-full mb-1 w-64 bg-[#1e1e20] border border-white/10 rounded-md shadow-lg overflow-hidden z-50">
              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider bg-white/5 border-b border-white/10">
                Knowledge Base
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredKnowledgeFiles.length > 0 ? (
                  filteredKnowledgeFiles.map((file, i) => (
                    <button
                      key={i}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors flex items-center gap-2"
                      onClick={() => handleMentionSelect(file)}
                    >
                      <FileText className="size-3.5 text-yellow-400" />
                      <span className="truncate">{file.name}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-4 text-xs text-center text-muted-foreground">
                    No matching files found.
                  </div>
                )}
              </div>
            </div>
          )}

          <Textarea
            value={input}
            onChange={handleInput}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            placeholder={`Ask AI to ${activeMode.label.toLowerCase()}... (Paste or drop files)`}
            className="min-h-[80px] max-h-[400px] resize-none border-0 bg-transparent px-3 py-3 text-sm focus-visible:ring-0 shadow-none scrollbar-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />

          <div className="flex items-center justify-between p-2 pt-0">
            <div className="flex items-center gap-1">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                accept="image/*,.txt,.json,.md,.csv,.pdf,.zip,.rar"
                onChange={handleFileSelect}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    title="Add attachment or use tool"
                    className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
                  >
                    <Plus className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48 bg-[#18181b] border-white/10">
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer hover:bg-white/10 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="size-4 text-blue-400" /> Attach File
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer hover:bg-white/10 text-xs"
                    onClick={() => {
                      setInput((prev) => prev + "@scrape ");
                    }}
                  >
                    <Bot className="size-4 text-purple-400" /> @scrape (Sub-Agent)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer hover:bg-white/10 text-xs text-orange-400"
                    onSelect={(e) => {
                      e.preventDefault(); // Menü kapandığında odak kaybı vb. olmasın diye
                      compactChat();
                    }}
                    disabled={messages.length === 0 || streaming}
                  >
                    <Minimize2 className="size-4 text-orange-400" /> Compact Context
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-3">
              {/* Token Estimator UI */}
              <div
                className={`flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border ${
                  tokenPercentage > 90
                    ? "bg-destructive/10 border-destructive/20 text-destructive"
                    : tokenPercentage > 75
                      ? "bg-orange-500/10 border-orange-500/20 text-orange-500"
                      : "bg-white/5 border-white/10 text-muted-foreground"
                }`}
                title={`Context Usage: ${totalTokens.toLocaleString()} / ${maxTokens.toLocaleString()} tokens\n(Active File: ${currentFileTokens}, Input: ${inputTokens}, System: ${systemTokens})`}
              >
                <span>{totalTokens.toLocaleString()}</span>
                <span className="opacity-50">/</span>
                <span>{maxTokens.toLocaleString()}</span>
                <div className="w-12 h-1.5 bg-black/40 rounded-full ml-1 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      tokenPercentage > 90
                        ? "bg-destructive"
                        : tokenPercentage > 75
                          ? "bg-orange-500"
                          : "bg-primary"
                    }`}
                    style={{ width: `${tokenPercentage}%` }}
                  ></div>
                </div>
              </div>

              <Button
                size="sm"
                onClick={submit}
                disabled={streaming || !input.trim() || tokenPercentage >= 100}
                className="h-7 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 px-3 shadow-sm font-medium gap-1"
              >
                Send <Send className="size-3 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function EmptyState({ mode }: { mode: any }) {
  const ModeIcon = mode.icon;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center animate-in fade-in zoom-in duration-500">
      <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-inner border border-primary/10">
        <ModeIcon className="size-6" />
      </div>
      <div>
        <div className="text-base font-medium text-foreground">
          How can I help you {mode.label.toLowerCase()}?
        </div>
        <div className="mt-1.5 text-xs text-muted-foreground max-w-[200px] mx-auto leading-relaxed">
          {mode.desc}. You can tag files using @ or paste screenshots directly.
        </div>
      </div>
    </div>
  );
}

const Message = React.memo(function Message({
  message,
  onReview,
  isLast,
}: {
  message: ChatMessage;
  onReview: () => void;
  isLast?: boolean;
}) {
  const isUser = message.role === "user";
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const editMessage = useIDEStore((s) => s.editMessage);
  const regenerate = useIDEStore((s) => s.regenerate);
  const streaming = useIDEStore((s) => s.streaming);

  const handleEdit = () => {
    const textPart = message.parts.find((p) => p.type === "text");
    setEditValue(textPart && "text" in textPart ? textPart.text : "");
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editValue.trim()) {
      editMessage(message.id, editValue);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2 p-4 bg-white/5 border border-white/10 rounded-lg mb-4">
        <Textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="min-h-[100px] text-sm bg-transparent border-white/20 focus-visible:ring-1 focus-visible:ring-primary resize-y"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSaveEdit();
            } else if (e.key === "Escape") {
              setIsEditing(false);
            }
          }}
        />
        <div className="flex justify-end gap-2 mt-2">
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSaveEdit}>
            Save & Submit
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex flex-col gap-1 w-full max-w-full">
      {/* If this message contains a compact part, we render it completely differently (as a divider) */}
      {message.parts.some((p) => p.type === "compact") ? (
        <div className="w-full flex justify-center py-2">
          {message.parts.map((p, i) =>
            p.type === "compact" ? (
              <PartView key={i} part={p} onReview={onReview} isUser={false} />
            ) : null,
          )}
        </div>
      ) : (
        <div
          className={`flex w-full items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}
        >
          {!isUser && (
            <div className="flex size-8 shrink-0 select-none items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary shadow-sm">
              <Bot className="size-4" />
            </div>
          )}

          <div className={`flex flex-col gap-1 ${isUser ? "max-w-[85%]" : "w-full"}`}>
            <div
              className={`space-y-3 overflow-hidden ${
                isUser
                  ? "rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-md"
                  : "rounded-2xl rounded-tl-sm bg-accent/30 border border-border px-4 py-3 text-sm text-foreground shadow-sm"
              }`}
            >
              {message.parts.map((p, i) => (
                <PartView
                  key={i}
                  part={p}
                  onReview={onReview}
                  isUser={isUser}
                  isGenerating={!isUser && isLast && streaming}
                />
              ))}

              {!isUser &&
                isLast &&
                streaming &&
                message.parts.every((p: any) => p.type === "text" && !p.text) && (
                  <div className="flex items-center gap-1.5 h-6 opacity-60">
                    <div
                      className="size-1.5 rounded-full bg-foreground animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    ></div>
                    <div
                      className="size-1.5 rounded-full bg-foreground animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    ></div>
                    <div
                      className="size-1.5 rounded-full bg-foreground animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    ></div>
                  </div>
                )}
            </div>

            <div
              className={`flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 ${isUser ? "justify-end" : "justify-start"} px-2`}
            >
              {isUser ? (
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="size-3" /> Edit
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (streaming) {
                      alert("Lütfen mevcut akışın bitmesini bekleyin veya durdurun.");
                      return;
                    }
                    regenerate(message.id);
                  }}
                  className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="size-3" /> Regenerate
                </button>
              )}
            </div>
          </div>

          {isUser && (
            <div className="flex size-8 shrink-0 select-none items-center justify-center rounded-lg bg-accent border border-border text-foreground shadow-sm">
              <UserIcon className="size-4" />
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const remarkPluginsList = [remarkGfm];

const PartView = React.memo(function PartView({
  part,
  isUser,
  onReview,
  isGenerating,
}: {
  part: ChatMessagePart;
  onReview: () => void;
  isUser: boolean;
  isGenerating?: boolean;
}) {
  const markdownComponents = useMemo(() => ({
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-([\w-]+)/.exec(className || "");
      return !inline && match ? (
        <CodeBlock code={String(children).replace(/\n$/, "")} language={match[1]} isGenerating={isGenerating} />
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    pre({ children }: any) {
      // ReactMarkdown wraps code blocks in a <pre>, but our CodeBlock handles it.
      // So we just return the children (which is the CodeBlock).
      return <>{children}</>;
    },
  }), [isGenerating]);

  if (part.type === "compact") {
    return (
      <div className="relative my-2 w-full max-w-2xl mx-auto overflow-hidden rounded-md border border-purple-500/30 bg-purple-500/5 shadow-sm">
        <div className="bg-purple-500/10 px-3 py-1.5 flex items-center justify-center gap-2 border-b border-purple-500/30">
          <Minimize2 className="size-3.5 text-purple-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">
            Context Compacted
          </span>
        </div>
        <div className="p-4 prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed text-foreground/90">
          <ReactMarkdown remarkPlugins={remarkPluginsList}>{part.text}</ReactMarkdown>
        </div>
      </div>
    );
  }

  if (part.type === "text") {
    // Check if the message only contains a reasoning block (i.e., generating right now)
    if (isGenerating && part.text.trim().startsWith("<think>") && !part.text.includes("</think>")) {
      return null;
    }

    // If user's text is the internal system command, render it as a tiny terminal chip
    if (isUser && part.text.startsWith("[SYSTEM COMMAND]")) {
      return (
        <div className="flex items-center gap-2 text-[10px] font-mono text-primary-foreground/70 bg-black/20 px-2 py-1 rounded">
          <Terminal className="size-3" /> /compact
        </div>
      );
    }

    return (
      <div
        className={`prose prose-sm max-w-none ${isUser ? "prose-invert prose-p:leading-relaxed prose-pre:bg-primary-foreground/10" : "dark:prose-invert prose-p:leading-relaxed"}`}
      >
        <ReactMarkdown
          remarkPlugins={remarkPluginsList}
          components={markdownComponents}
        >
          {part.text}
        </ReactMarkdown>
      </div>
    );
  }
  if (part.type === "code") {
    return <CodeBlock code={part.code} language={part.language} isGenerating={isGenerating} />;
  }
  if (part.type === "plan") {
    return (
      <div className="rounded-md border border-border bg-background/40 p-3">
        <div className="mb-2 text-xs font-semibold">{part.title}</div>
        <ol className="space-y-1 text-xs text-muted-foreground">
          {part.steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="inline-grid size-4 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                {i + 1}
              </span>
              <span className="text-foreground/90">{s}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (part.type === "thinking") {
    return (
      <details className="mb-3 group rounded-md border border-white/5 bg-[#1e1e20]/50 text-sm text-muted-foreground italic max-w-full overflow-hidden">
        <summary className="flex cursor-pointer select-none items-center gap-2 p-2.5 opacity-70 transition-opacity hover:opacity-100 outline-none">
          <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
          <span className="text-[11px] font-medium not-italic uppercase tracking-wider flex items-center gap-2">
            Thinking process
            {isGenerating && (
              <span className="flex items-center gap-0.5">
                <span
                  className="size-1 rounded-full bg-current animate-bounce"
                  style={{ animationDelay: "0ms" }}
                ></span>
                <span
                  className="size-1 rounded-full bg-current animate-bounce"
                  style={{ animationDelay: "150ms" }}
                ></span>
                <span
                  className="size-1 rounded-full bg-current animate-bounce"
                  style={{ animationDelay: "300ms" }}
                ></span>
              </span>
            )}
          </span>
        </summary>
        <div className="px-3 pb-3 pt-0 text-xs overflow-x-auto whitespace-pre-wrap font-mono opacity-90 text-[#a0a0a0]">
          {part.text}
        </div>
      </details>
    );
  }

  if (part.type === "change") {
    return <ChangeSetCard id={part.changeSetId} onReview={onReview} />;
  }

  if (part.type === "attachment") {
    return (
      <div className="flex flex-wrap gap-1.5 mt-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/50 px-2 py-0.5 text-xs text-muted-foreground">
          {part.attachType === "knowledge" ? (
            <span className="text-yellow-500">📚</span>
          ) : part.attachType === "file" ? (
            <FileText className="size-3" />
          ) : (
            <Paperclip className="size-3" />
          )}
          <span>{part.name}</span>
        </div>
      </div>
    );
  }

  return null;
});

const CodeBlock = React.memo(function CodeBlock({ code, language, isGenerating }: { code: string; language: string, isGenerating?: boolean }) {
  const [copied, setCopied] = useState(false);

  if (language === "forge-terminal") {
    const termId = code.trim();
    return (
      <div className="my-3 overflow-hidden rounded-md border border-border bg-[#1e1e1e] shadow-sm">
        <div className="flex items-center justify-between border-b border-white/10 bg-[#2d2d2d] px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-400">
          <span className="font-semibold text-green-400">Interactive Terminal</span>
          <span className="text-xs text-muted-foreground">Type here to interact...</span>
        </div>
        <div className="h-[250px] w-full relative">
          <XTermInstance terminalId={termId} />
        </div>
      </div>
    );
  }

  return (
    <div className="my-3 overflow-hidden rounded-md border border-border bg-[#1e1e1e] shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#2d2d2d] px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-400">
        <span className="font-semibold">{language || "text"}</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="size-3 text-green-400" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="max-h-[400px] overflow-auto text-[11px] leading-relaxed">
        {/* Only syntax highlight if NOT generating to save CPU/Main Thread. If generating, use simple <pre> */}
        {isGenerating ? (
          <pre className="m-0 p-4 bg-transparent text-[11px] text-[#d4d4d4] font-mono">
            {code}
          </pre>
        ) : (
          <SyntaxHighlighter
            language={language || "text"}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: "1rem",
              background: "transparent",
              fontSize: "11px",
            }}
          >
            {code}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
});

function ChangeSetCard({ id, onReview }: { id: string; onReview: () => void }) {
  const cs = useIDEStore((s) => s.changeSets[id]) as ChangeSet | undefined;
  const applyChangeSet = useIDEStore((s) => s.applyChangeSet);
  const rejectChangeSet = useIDEStore((s) => s.rejectChangeSet);
  if (!cs) return null;

  return (
    <div className="rounded-md border border-border bg-background/40">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <FileCode className="size-3.5 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold">{cs.title}</div>
          <div className="text-[10px] text-muted-foreground">
            {cs.files.length} file{cs.files.length === 1 ? "" : "s"} affected
          </div>
        </div>
        {cs.status !== "pending" && (
          <span
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
              cs.status === "applied"
                ? "bg-primary/15 text-primary"
                : "bg-destructive/15 text-destructive"
            }`}
          >
            {cs.status === "applied" ? (
              <CheckCircle2 className="size-3" />
            ) : (
              <XCircle className="size-3" />
            )}
            {cs.status}
          </span>
        )}
      </div>
      <ul className="divide-y divide-border">
        {cs.files.map((f) => (
          <li key={f.path} className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
            <ChevronRight className="size-3 text-muted-foreground" />
            <span className="truncate font-mono">{f.path}</span>
            <span className="ml-auto font-mono text-[10px]">
              <span className="text-[color:var(--diff-add)]">+{f.added}</span>{" "}
              <span className="text-[color:var(--diff-remove)]">-{f.removed}</span>
            </span>
          </li>
        ))}
      </ul>
      {cs.status === "pending" && (
        <div className="flex items-center gap-1 border-t border-border p-2">
          <Button size="sm" className="h-7 flex-1 gap-1 text-xs" onClick={onReview}>
            <Eye className="size-3" /> Review changes
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 gap-1 text-xs"
            onClick={() => {
              applyChangeSet(cs.id);
            }}
          >
            <CheckCircle2 className="size-3" /> Apply
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-muted-foreground"
            onClick={() => rejectChangeSet(cs.id)}
          >
            <XCircle className="size-3" /> Reject
          </Button>
        </div>
      )}
    </div>
  );
}
