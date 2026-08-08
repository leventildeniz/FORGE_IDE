import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Plus, Trash, Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIDEStore } from "@/stores/ide-store";
import { useShallow } from "zustand/react/shallow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
import type { AIModel, ModelConnection, MCPTool, CustomProfile } from "@/types/ide";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Forge" },
      { name: "description", content: "Configure Forge: model, theme, and shortcuts." },
      { property: "og:title", content: "Settings — Forge" },
      { property: "og:description", content: "Configure Forge preferences." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const {
    minimap,
    toggleMinimap,
    models,
    activeModelId,
    setActiveModel,
    addModel,
    removeModel,
    updateModel,
    mcpTools,
    addMCPTool,
    removeMCPTool,
    toggleMCPTool,
    profiles,
    addProfile,
    removeProfile,
    contextSettings,
    updateContextSettings,
  } = useIDEStore(useShallow((state) => ({
    minimap: state.minimap,
    toggleMinimap: state.toggleMinimap,
    models: state.models,
    activeModelId: state.activeModelId,
    setActiveModel: state.setActiveModel,
    addModel: state.addModel,
    removeModel: state.removeModel,
    updateModel: state.updateModel,
    mcpTools: state.mcpTools,
    addMCPTool: state.addMCPTool,
    removeMCPTool: state.removeMCPTool,
    toggleMCPTool: state.toggleMCPTool,
    profiles: state.profiles,
    addProfile: state.addProfile,
    removeProfile: state.removeProfile,
    contextSettings: state.contextSettings,
    updateContextSettings: state.updateContextSettings,
  })));

  const [isAddModelOpen, setIsAddModelOpen] = useState(false);
  const [newModel, setNewModel] = useState<Partial<AIModel>>({
    name: "",
    provider: "",
    connection: "api",
    endpoint: "",
    identifier: "",
    hasApiKey: true,
    apiKey: "",
    thinkingBudget: "none",
    systemPrompt: "",
    temperature: 0.7,
    topP: 0.9,
    repetitionPenalty: 1.1,
    maxTokens: 8192,
    contextWindow: 32768,
    kvCache: "q8_0",
    chatTemplate: "",
    customParams: [],
  });

  const handleAddCustomParam = () => {
    setNewModel((prev) => ({
      ...prev,
      customParams: [...(prev.customParams || []), { key: "", value: "" }],
    }));
  };

  const handleUpdateCustomParam = (index: number, field: "key" | "value", val: string) => {
    setNewModel((prev) => {
      const updated = [...(prev.customParams || [])];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, customParams: updated };
    });
  };

  const handleRemoveCustomParam = (index: number) => {
    setNewModel((prev) => {
      const updated = [...(prev.customParams || [])];
      updated.splice(index, 1);
      return { ...prev, customParams: updated };
    });
  };

  const handleAddModel = () => {
    if (!newModel.name || !newModel.provider || !newModel.identifier) return;
    addModel({
      name: newModel.name,
      provider: newModel.provider,
      connection: newModel.connection as ModelConnection,
      endpoint: newModel.endpoint || "",
      identifier: newModel.identifier,
      hasApiKey: newModel.hasApiKey || false,
      apiKey: newModel.apiKey,
      thinkingBudget: newModel.thinkingBudget as any,
      systemPrompt: newModel.systemPrompt,
      temperature: newModel.temperature,
      topP: newModel.topP,
      repetitionPenalty: newModel.repetitionPenalty,
      maxTokens: newModel.maxTokens,
      contextWindow: newModel.contextWindow,
      kvCache: newModel.kvCache,
      chatTemplate: newModel.chatTemplate,
      customParams: newModel.customParams?.filter((p) => p.key.trim() !== ""),
    });
    setIsAddModelOpen(false);
    setNewModel({
      name: "",
      provider: "",
      connection: "api",
      endpoint: "",
      identifier: "",
      hasApiKey: true,
      apiKey: "",
      thinkingBudget: "none",
      systemPrompt: "",
      temperature: 0.7,
      topP: 0.9,
      repetitionPenalty: 1.1,
      maxTokens: 8192,
      contextWindow: 32768,
      kvCache: "q8_0",
      chatTemplate: "",
      customParams: [],
    });
  };

  const [isEditModelOpen, setIsEditModelOpen] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);

  const handleEditModelOpen = (m: AIModel) => {
    setEditingModelId(m.id);
    setNewModel(m); // reuse newModel state for editing
    setIsEditModelOpen(true);
  };

  const handleUpdateModel = () => {
    if (!editingModelId || !newModel.name || !newModel.provider || !newModel.identifier) return;
    updateModel(editingModelId, {
      name: newModel.name,
      provider: newModel.provider,
      connection: newModel.connection as ModelConnection,
      endpoint: newModel.endpoint || "",
      identifier: newModel.identifier,
      hasApiKey: newModel.hasApiKey || false,
      apiKey: newModel.apiKey,
      thinkingBudget: newModel.thinkingBudget as any,
      systemPrompt: newModel.systemPrompt,
      temperature: newModel.temperature,
      topP: newModel.topP,
      repetitionPenalty: newModel.repetitionPenalty,
      maxTokens: newModel.maxTokens,
      contextWindow: newModel.contextWindow,
      kvCache: newModel.kvCache,
      chatTemplate: newModel.chatTemplate,
      customParams: newModel.customParams?.filter((p) => p.key.trim() !== ""),
    });
    setIsEditModelOpen(false);
    setEditingModelId(null);
    setNewModel({
      name: "",
      provider: "",
      connection: "api",
      endpoint: "",
      identifier: "",
      hasApiKey: true,
      apiKey: "",
      thinkingBudget: "none",
      systemPrompt: "",
      temperature: 0.7,
      topP: 0.9,
      repetitionPenalty: 1.1,
      maxTokens: 8192,
      contextWindow: 32768,
      kvCache: "q8_0",
      chatTemplate: "",
      customParams: [],
    });
  };

  const [isAddMCPOpen, setIsAddMCPOpen] = useState(false);
  const [newMCP, setNewMCP] = useState<Partial<MCPTool>>({
    name: "",
    command: "",
    args: [],
    description: "",
    isEnabled: true,
  });
  const [mcpArgsStr, setMcpArgsStr] = useState("");

  const handleAddMCP = () => {
    if (!newMCP.name || !newMCP.command) return;
    addMCPTool({
      name: newMCP.name,
      command: newMCP.command,
      args: mcpArgsStr.split(" ").filter(Boolean),
      description: newMCP.description,
      isEnabled: true,
    });
    setIsAddMCPOpen(false);
    setNewMCP({ name: "", command: "", args: [], description: "", isEnabled: true });
    setMcpArgsStr("");
  };

  const [isAddProfileOpen, setIsAddProfileOpen] = useState(false);
  const [newProfile, setNewProfile] = useState<Partial<CustomProfile>>({
    name: "",
    description: "",
    systemPrompt: "",
  });

  const handleAddProfile = () => {
    if (!newProfile.name || !newProfile.systemPrompt) return;
    addProfile({
      name: newProfile.name,
      description: newProfile.description || "",
      systemPrompt: newProfile.systemPrompt,
    });
    setIsAddProfileOpen(false);
    setNewProfile({ name: "", description: "", systemPrompt: "" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <Link to="/workspace" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-sm font-semibold">Settings</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="mb-8 w-full justify-start border-b rounded-none bg-transparent h-auto p-0 space-x-6">
            <TabsTrigger
              value="general"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2"
            >
              General
            </TabsTrigger>
            <TabsTrigger
              value="models"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2"
            >
              Models
            </TabsTrigger>
            <TabsTrigger
              value="mcp"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2"
            >
              MCP (Tools)
            </TabsTrigger>
            <TabsTrigger
              value="profiles"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2"
            >
              Profiles
            </TabsTrigger>
            <TabsTrigger
              value="context"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2"
            >
              Context Manager
            </TabsTrigger>
          </TabsList>

          {/* GENERAL TAB */}
          <TabsContent value="general" className="space-y-8">
            <Section title="Editor" description="Monaco editor preferences.">
              <Row label="Minimap" description="Show the code minimap on the right.">
                <Switch checked={minimap} onCheckedChange={toggleMinimap} />
              </Row>
            </Section>

            <Section
              title="Shortcuts"
              description="Global keyboard shortcuts inside the workspace."
            >
              <ul className="divide-y divide-border rounded-md border border-border bg-card text-sm">
                {[
                  ["Command menu", "⌘K / Ctrl+K"],
                  ["Toggle explorer", "⌘B / Ctrl+B"],
                  ["Toggle AI panel", "⌘I / Ctrl+I"],
                  ["Toggle bottom panel", "⌘J / Ctrl+J"],
                  ["Save file", "⌘S / Ctrl+S"],
                ].map(([label, keys]) => (
                  <li key={label} className="flex items-center justify-between px-4 py-2.5">
                    <span>{label}</span>
                    <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs">
                      {keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </Section>
          </TabsContent>

          {/* MODELS TAB */}
          <TabsContent value="models" className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">AI Models</h2>
                <p className="text-sm text-muted-foreground">
                  Configure local and remote AI models.
                </p>
              </div>

              {/* Edit Model Dialog */}
              <Dialog open={isEditModelOpen} onOpenChange={setIsEditModelOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add AI Model</DialogTitle>
                    <DialogDescription>
                      Add a local (Ollama/LMStudio) or remote API model.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Display Name</Label>
                        <Input
                          placeholder="e.g. GPT-4o"
                          value={newModel.name}
                          onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Provider</Label>
                        <Input
                          placeholder="e.g. OpenAI"
                          value={newModel.provider}
                          onChange={(e) => setNewModel({ ...newModel, provider: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Model Identifier</Label>
                        <Input
                          placeholder="e.g. gpt-4o"
                          value={newModel.identifier}
                          onChange={(e) => setNewModel({ ...newModel, identifier: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Connection Type</Label>
                        <Select
                          value={newModel.connection}
                          onValueChange={(val: any) =>
                            setNewModel({ ...newModel, connection: val })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="api">Remote API</SelectItem>
                            <SelectItem value="local">Local (Ollama/VLLM)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>API Base Endpoint</Label>
                        <Input
                          placeholder="https://api.openai.com/v1"
                          value={newModel.endpoint}
                          onChange={(e) => setNewModel({ ...newModel, endpoint: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>API Key (Optional)</Label>
                        <Input
                          type="password"
                          placeholder="sk-..."
                          value={newModel.apiKey}
                          onChange={(e) => setNewModel({ ...newModel, apiKey: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Thinking Budget</Label>
                      <Select
                        value={newModel.thinkingBudget}
                        onValueChange={(val: any) =>
                          setNewModel({ ...newModel, thinkingBudget: val })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>System Prompt (Override)</Label>
                      <Textarea
                        placeholder="You are an expert coder..."
                        value={newModel.systemPrompt}
                        onChange={(e) => setNewModel({ ...newModel, systemPrompt: e.target.value })}
                        className="h-20 resize-none text-xs"
                      />
                    </div>

                    <Accordion
                      type="single"
                      collapsible
                      className="w-full border rounded-lg bg-card mt-2"
                    >
                      <AccordionItem value="advanced" className="border-b-0">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/5 rounded-t-lg text-sm font-medium">
                          Advanced Settings (Local & Custom Models)
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 space-y-6 pt-2">
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Temperature</Label>
                                <Input
                                  type="number"
                                  step={0.01}
                                  min={0}
                                  max={2}
                                  className="h-6 w-16 text-right text-xs"
                                  value={newModel.temperature || 0}
                                  onChange={(e) =>
                                    setNewModel({
                                      ...newModel,
                                      temperature: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                />
                              </div>
                              <Slider
                                value={[newModel.temperature || 0]}
                                min={0}
                                max={2}
                                step={0.01}
                                onValueChange={(v) =>
                                  setNewModel({ ...newModel, temperature: v[0] })
                                }
                              />
                            </div>
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Repetition Penalty</Label>
                                <Input
                                  type="number"
                                  step={0.01}
                                  min={1}
                                  max={2}
                                  className="h-6 w-16 text-right text-xs"
                                  value={newModel.repetitionPenalty || 1}
                                  onChange={(e) =>
                                    setNewModel({
                                      ...newModel,
                                      repetitionPenalty: parseFloat(e.target.value) || 1,
                                    })
                                  }
                                />
                              </div>
                              <Slider
                                value={[newModel.repetitionPenalty || 1]}
                                min={1}
                                max={2}
                                step={0.01}
                                onValueChange={(v) =>
                                  setNewModel({ ...newModel, repetitionPenalty: v[0] })
                                }
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs">Context Window</Label>
                              <Input
                                type="number"
                                value={newModel.contextWindow || ""}
                                onChange={(e) =>
                                  setNewModel({
                                    ...newModel,
                                    contextWindow: parseInt(e.target.value) || undefined,
                                  })
                                }
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Max Tokens</Label>
                              <Input
                                type="number"
                                value={newModel.maxTokens || ""}
                                onChange={(e) =>
                                  setNewModel({
                                    ...newModel,
                                    maxTokens: parseInt(e.target.value) || undefined,
                                  })
                                }
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs">KV Cache (Quantization)</Label>
                              <Input
                                placeholder="e.g. fp16, q8_0"
                                value={newModel.kvCache || ""}
                                onChange={(e) =>
                                  setNewModel({ ...newModel, kvCache: e.target.value })
                                }
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Chat Template</Label>
                              <Textarea
                                placeholder="e.g. {{ bos_token }}..."
                                value={newModel.chatTemplate || ""}
                                onChange={(e) =>
                                  setNewModel({ ...newModel, chatTemplate: e.target.value })
                                }
                                className="h-8 text-xs resize-y"
                              />
                            </div>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-border/50">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-semibold">Additional Parameters</Label>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleAddCustomParam}
                                className="h-6 text-[10px] px-2"
                              >
                                <Plus className="size-3 mr-1" /> Add Param
                              </Button>
                            </div>
                            {newModel.customParams?.length === 0 && (
                              <p className="text-[10px] text-muted-foreground">
                                e.g. stop tokens, top_k, seed
                              </p>
                            )}
                            <div className="space-y-2 mt-2">
                              {newModel.customParams?.map((param, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <Input
                                    placeholder="Key (e.g. stop)"
                                    className="h-8 text-xs flex-1"
                                    value={param.key}
                                    onChange={(e) =>
                                      handleUpdateCustomParam(idx, "key", e.target.value)
                                    }
                                  />
                                  <Input
                                    placeholder='Value (e.g. ["<end_of_turn>"])'
                                    className="h-8 text-xs flex-[2]"
                                    value={param.value}
                                    onChange={(e) =>
                                      handleUpdateCustomParam(idx, "value", e.target.value)
                                    }
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => handleRemoveCustomParam(idx)}
                                  >
                                    <Trash className="size-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleUpdateModel}>Update Model</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isAddModelOpen} onOpenChange={setIsAddModelOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="size-4" /> Add Model
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add AI Model</DialogTitle>
                    <DialogDescription>
                      Add a local (Ollama/LMStudio) or remote API model.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Display Name</Label>
                        <Input
                          placeholder="e.g. GPT-4o"
                          value={newModel.name}
                          onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Provider</Label>
                        <Input
                          placeholder="e.g. OpenAI"
                          value={newModel.provider}
                          onChange={(e) => setNewModel({ ...newModel, provider: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Model Identifier</Label>
                        <Input
                          placeholder="e.g. gpt-4o"
                          value={newModel.identifier}
                          onChange={(e) => setNewModel({ ...newModel, identifier: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Connection Type</Label>
                        <Select
                          value={newModel.connection}
                          onValueChange={(val: any) =>
                            setNewModel({ ...newModel, connection: val })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="api">Remote API</SelectItem>
                            <SelectItem value="local">Local (Ollama/VLLM)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>API Base Endpoint</Label>
                        <Input
                          placeholder="https://api.openai.com/v1"
                          value={newModel.endpoint}
                          onChange={(e) => setNewModel({ ...newModel, endpoint: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>API Key (Optional)</Label>
                        <Input
                          type="password"
                          placeholder="sk-..."
                          value={newModel.apiKey}
                          onChange={(e) => setNewModel({ ...newModel, apiKey: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>System Prompt (Override)</Label>
                      <Textarea
                        placeholder="You are an expert coder..."
                        value={newModel.systemPrompt}
                        onChange={(e) => setNewModel({ ...newModel, systemPrompt: e.target.value })}
                        className="h-20 resize-none text-xs"
                      />
                    </div>

                    <Accordion
                      type="single"
                      collapsible
                      className="w-full border rounded-lg bg-card mt-2"
                    >
                      <AccordionItem value="advanced" className="border-b-0">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/5 rounded-t-lg text-sm font-medium">
                          Advanced Settings (Local & Custom Models)
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 space-y-6 pt-2">
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Temperature</Label>
                                <Input
                                  type="number"
                                  step={0.01}
                                  min={0}
                                  max={2}
                                  className="h-6 w-16 text-right text-xs"
                                  value={newModel.temperature || 0}
                                  onChange={(e) =>
                                    setNewModel({
                                      ...newModel,
                                      temperature: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                />
                              </div>
                              <Slider
                                value={[newModel.temperature || 0]}
                                min={0}
                                max={2}
                                step={0.01}
                                onValueChange={(v) =>
                                  setNewModel({ ...newModel, temperature: v[0] })
                                }
                              />
                            </div>
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Repetition Penalty</Label>
                                <Input
                                  type="number"
                                  step={0.01}
                                  min={1}
                                  max={2}
                                  className="h-6 w-16 text-right text-xs"
                                  value={newModel.repetitionPenalty || 1}
                                  onChange={(e) =>
                                    setNewModel({
                                      ...newModel,
                                      repetitionPenalty: parseFloat(e.target.value) || 1,
                                    })
                                  }
                                />
                              </div>
                              <Slider
                                value={[newModel.repetitionPenalty || 1]}
                                min={1}
                                max={2}
                                step={0.01}
                                onValueChange={(v) =>
                                  setNewModel({ ...newModel, repetitionPenalty: v[0] })
                                }
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs">Max Tokens</Label>
                              <Input
                                type="number"
                                value={newModel.maxTokens || ""}
                                onChange={(e) =>
                                  setNewModel({
                                    ...newModel,
                                    maxTokens: parseInt(e.target.value) || undefined,
                                  })
                                }
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Chat Template</Label>
                              <Textarea
                                placeholder="e.g. {{ bos_token }}..."
                                value={newModel.chatTemplate || ""}
                                onChange={(e) =>
                                  setNewModel({ ...newModel, chatTemplate: e.target.value })
                                }
                                className="h-8 text-xs resize-y"
                              />
                            </div>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-border/50">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-semibold">Additional Parameters</Label>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleAddCustomParam}
                                className="h-6 text-[10px] px-2"
                              >
                                <Plus className="size-3 mr-1" /> Add Param
                              </Button>
                            </div>
                            {newModel.customParams?.length === 0 && (
                              <p className="text-[10px] text-muted-foreground">
                                e.g. stop tokens, top_k, seed
                              </p>
                            )}
                            <div className="space-y-2 mt-2">
                              {newModel.customParams?.map((param, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <Input
                                    placeholder="Key (e.g. stop)"
                                    className="h-8 text-xs flex-1"
                                    value={param.key}
                                    onChange={(e) =>
                                      handleUpdateCustomParam(idx, "key", e.target.value)
                                    }
                                  />
                                  <Input
                                    placeholder='Value (e.g. ["<end_of_turn>"])'
                                    className="h-8 text-xs flex-[2]"
                                    value={param.value}
                                    onChange={(e) =>
                                      handleUpdateCustomParam(idx, "value", e.target.value)
                                    }
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => handleRemoveCustomParam(idx)}
                                  >
                                    <Trash className="size-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAddModel}>Save Model</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Active Global Model</Label>
                <Select value={activeModelId ?? ""} onValueChange={setActiveModel}>
                  <SelectTrigger className="w-full sm:w-[300px]">
                    <SelectValue placeholder="Select a model..." />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.provider})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This model will be selected by default in new chat sessions.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                {models.map((m) => (
                  <div
                    key={m.id}
                    className="relative rounded-lg border border-border bg-card p-5 space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{m.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {m.provider} &middot; {m.connection}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEditModelOpen(m)}>
                          <Pencil className="size-4 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeModel(m.id)}>
                          <Trash className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Endpoint</Label>
                        <Input value={m.endpoint} readOnly className="h-8 text-xs" />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">System Prompt</Label>
                        <Textarea
                          value={m.systemPrompt || ""}
                          placeholder="You are a helpful AI assistant..."
                          className="h-20 text-xs resize-none"
                          readOnly
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs font-medium">Thinking Budget:</span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {m.thinkingBudget || "None"}
                        </span>
                      </div>

                      {(m.temperature !== undefined || m.chatTemplate) && (
                        <div className="pt-2 border-t border-white/5 space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">Temperature</span>
                            <span>{m.temperature}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">Template</span>
                            <span>{m.chatTemplate || "Default"}</span>
                          </div>
                          {m.customParams && m.customParams.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {m.customParams.map((p, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.5 bg-white/10 rounded text-[9px] text-muted-foreground"
                                >
                                  {p.key}: {p.value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* MCP TAB */}
          <TabsContent value="mcp" className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Model Context Protocol</h2>
                <p className="text-sm text-muted-foreground">
                  Add MCP servers to extend AI capabilities.
                </p>
              </div>
              <Dialog open={isAddMCPOpen} onOpenChange={setIsAddMCPOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="size-4" /> Add Server
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add MCP Server</DialogTitle>
                    <DialogDescription>
                      Configure an external tool for the AI to use.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label>Tool Name</Label>
                      <Input
                        placeholder="e.g. SQLite DB"
                        value={newMCP.name}
                        onChange={(e) => setNewMCP({ ...newMCP, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        placeholder="What does this tool do?"
                        value={newMCP.description}
                        onChange={(e) => setNewMCP({ ...newMCP, description: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Command</Label>
                        <Input
                          placeholder="e.g. npx, python, etc."
                          value={newMCP.command}
                          onChange={(e) => setNewMCP({ ...newMCP, command: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Arguments (space separated)</Label>
                        <Input
                          placeholder="-y @modelcontextprotocol/server-sqlite"
                          value={mcpArgsStr}
                          onChange={(e) => setMcpArgsStr(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAddMCP}>Save Server</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {mcpTools.length === 0 ? (
              <div className="rounded-lg border border-border border-dashed p-10 text-center">
                <p className="text-sm text-muted-foreground mb-2">No MCP servers configured yet.</p>
                <p className="text-xs text-muted-foreground">
                  MCP allows the AI to interact with external tools and datasets.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {mcpTools.map((tool) => (
                  <div
                    key={tool.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-5"
                  >
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        {tool.name}
                        {!tool.isEnabled && (
                          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            Disabled
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-muted-foreground">{tool.description}</p>
                      <code className="text-xs text-muted-foreground mt-2 inline-block bg-muted px-2 py-1 rounded">
                        {tool.command} {tool.args.join(" ")}
                      </code>
                    </div>
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={tool.isEnabled}
                        onCheckedChange={() => toggleMCPTool(tool.id)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => removeMCPTool(tool.id)}>
                        <Trash className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* PROFILES TAB */}
          <TabsContent value="profiles" className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Custom Profiles</h2>
                <p className="text-sm text-muted-foreground">
                  Configure customized instructions for Code, Ask, Plan, or custom modes.
                </p>
              </div>
              <Dialog open={isAddProfileOpen} onOpenChange={setIsAddProfileOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="size-4" /> Add Profile
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Add Custom Profile</DialogTitle>
                    <DialogDescription>
                      Create a specific persona with custom base instructions.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label>Profile Name</Label>
                      <Input
                        placeholder="e.g. Senior Rust Engineer"
                        value={newProfile.name}
                        onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Short Description</Label>
                      <Input
                        placeholder="e.g. For reviewing critical systems"
                        value={newProfile.description}
                        onChange={(e) =>
                          setNewProfile({ ...newProfile, description: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>System Prompt (Base Instructions)</Label>
                      <Textarea
                        placeholder="You are a strict code reviewer..."
                        value={newProfile.systemPrompt}
                        onChange={(e) =>
                          setNewProfile({ ...newProfile, systemPrompt: e.target.value })
                        }
                        className="h-32 text-xs resize-none"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAddProfile}>Save Profile</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {profiles.length === 0 ? (
              <div className="rounded-lg border border-border border-dashed p-10 text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Default profiles (Code, Ask, Plan, Debug) are active.
                </p>
                <p className="text-xs text-muted-foreground">
                  Add custom profiles to define specific permissions and base instructions.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="relative rounded-lg border border-border bg-card p-5 space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{profile.name}</h3>
                        <p className="text-xs text-muted-foreground">{profile.description}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeProfile(profile.id)}>
                        <Trash className="size-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Instructions</Label>
                      <div className="h-20 overflow-y-auto text-xs text-muted-foreground bg-muted p-2 rounded">
                        {profile.systemPrompt}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* CONTEXT TAB */}
          <TabsContent value="context" className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Context & Budget Manager</h2>
                <p className="text-sm text-muted-foreground">
                  Manage how tokens are allocated during context generation.
                </p>
              </div>
            </div>

            <Section
              title="Context Strategy"
              description="Choose how the token budget should be distributed."
            >
              <Row
                label="Strategy"
                description="Determines priority between files, history, and system instructions."
              >
                <Select
                  value={contextSettings.strategy}
                  onValueChange={(val) => updateContextSettings({ strategy: val as any })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (Task Based)</SelectItem>
                    <SelectItem value="prefer_history">Prefer History</SelectItem>
                    <SelectItem value="prefer_codebase">Prefer Codebase</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
            </Section>

            {contextSettings.strategy === "custom" && (
              <Section
                title="Custom Token Budget"
                description="Manually allocate token percentage constraints."
              >
                <Row
                  label="System Instructions (%)"
                  description="Max percentage for system and profile rules."
                >
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    className="w-24"
                    value={contextSettings.customSystemBudget || 10}
                    onChange={(e) =>
                      updateContextSettings({ customSystemBudget: parseInt(e.target.value) || 0 })
                    }
                  />
                </Row>
                <Row label="Chat History (%)" description="Max percentage for previous messages.">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    className="w-24"
                    value={contextSettings.customHistoryBudget || 20}
                    onChange={(e) =>
                      updateContextSettings({ customHistoryBudget: parseInt(e.target.value) || 0 })
                    }
                  />
                </Row>
                <Row
                  label="Codebase & Files (%)"
                  description="Max percentage for relevant project files and attachments."
                >
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    className="w-24"
                    value={contextSettings.customCodebaseBudget || 70}
                    onChange={(e) =>
                      updateContextSettings({ customCodebaseBudget: parseInt(e.target.value) || 0 })
                    }
                  />
                </Row>
              </Section>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-5">{children}</div>
    </section>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      {children}
    </div>
  );
}
