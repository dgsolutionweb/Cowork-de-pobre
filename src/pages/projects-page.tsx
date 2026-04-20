import { useEffect, useMemo, useState } from "react";
import type {
  AppPreferences,
  ApprovalEvent,
  CreateProjectInput,
  ProjectDetail,
  ProjectSummary,
} from "@shared/types";
import {
  CheckCircle2,
  FileWarning,
  FolderPlus,
  FolderTree,
  Globe,
  Layers3,
  Link,
  Network,
  Plus,
  ShieldCheck,
  Trash2,
  Archive,
  Type,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/layouts/app-shell";
import { desktop } from "@/services/desktop";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface ProjectsPageProps {
  onPrefsChange?: (prefs: AppPreferences) => void;
}

export const ProjectsPage = ({ onPrefsChange }: ProjectsPageProps) => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [prefs, setPrefs] = useState<AppPreferences | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [approvalEvents, setApprovalEvents] = useState<ApprovalEvent[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [mode, setMode] = useState<CreateProjectInput["mode"]>("existing");
  const [name, setName] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [instructionsDraft, setInstructionsDraft] = useState("");
  const [projectInstructionDraft, setProjectInstructionDraft] = useState("");
  const [domainDraft, setDomainDraft] = useState("");
  const [allowDestructive, setAllowDestructive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingDetail, setSavingDetail] = useState(false);
  const [newContextValue, setNewContextValue] = useState("");
  const [newContextType, setNewContextType] = useState<"file" | "url" | "text">("url");

  const activeProjectId = prefs?.activeProjectId;

  const loadBase = async () => {
    const [nextProjects, nextPrefs, nextApprovalEvents] = await Promise.all([
      desktop().projects.list(),
      desktop().settings.getPreferences(),
      desktop().projects.listApprovalEvents(30),
    ]);

    setProjects(nextProjects);
    setPrefs(nextPrefs);
    onPrefsChange?.(nextPrefs);
    setApprovalEvents(nextApprovalEvents);

    const preferredId =
      nextPrefs.activeProjectId && nextProjects.some((item) => item.id === nextPrefs.activeProjectId)
        ? nextPrefs.activeProjectId
        : nextProjects[0]?.id ?? null;

    if (!isCreating) {
      setSelectedProjectId((current) =>
        current && nextProjects.some((item) => item.id === current) ? current : preferredId,
      );
    }
  };

  const loadDetail = async (projectId: string | null) => {
    if (!projectId) {
      setDetail(null);
      setProjectInstructionDraft("");
      setDomainDraft("");
      setAllowDestructive(false);
      return;
    }

    const nextDetail = await desktop().projects.get(projectId);
    setDetail(nextDetail);

    const projectInstruction =
      nextDetail?.instructions.find((item) => item.scope === "project")?.content ?? "";
    setProjectInstructionDraft(projectInstruction);
    setDomainDraft(nextDetail?.policy.domainAllowlist.join("\n") ?? "");
    setAllowDestructive(nextDetail?.policy.allowDestructive ?? false);
  };

  useEffect(() => {
    loadBase().catch(() => {
      toast.error("Falha ao carregar projects.");
    });
  }, []);

  useEffect(() => {
    loadDetail(selectedProjectId).catch(() => {
      toast.error("Falha ao carregar detalhes do project.");
    });
  }, [selectedProjectId]);

  const activeCount = useMemo(
    () => projects.filter((item) => item.status === "active").length,
    [projects],
  );

  const handlePickFolder = async () => {
    const picked =
      mode === "existing"
        ? await desktop().projects.pickRootFolder()
        : await desktop().projects.pickParentFolder();
    if (picked) setFolderPath(picked);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Nome do project obrigatório.");
      return;
    }
    if (!folderPath.trim()) {
      toast.error(mode === "existing" ? "Selecione pasta raiz." : "Selecione pasta pai.");
      return;
    }

    setLoading(true);
    try {
      const created = await desktop().projects.create({
        name: name.trim(),
        mode,
        rootPath: mode === "existing" ? folderPath : undefined,
        parentPath: mode === "new-folder" ? folderPath : undefined,
        instructions: instructionsDraft.trim() || undefined,
      });
      toast.success(`Project ${created.project.name} criado.`);
      setName("");
      setFolderPath("");
      setInstructionsDraft("");
      await loadBase();
      setIsCreating(false);
      setSelectedProjectId(created.project.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar project.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetActive = async (projectId: string) => {
    try {
      await desktop().projects.setActive(projectId);
      const nextPrefs = await desktop().settings.getPreferences();
      setPrefs(nextPrefs);
      onPrefsChange?.(nextPrefs);
      await loadBase();
      setSelectedProjectId(projectId);
      toast.success("Project ativo atualizado.");
    } catch {
      toast.error("Falha ao ativar project.");
    }
  };

  const handleArchive = async (projectId: string) => {
    try {
      await desktop().projects.archive(projectId);
      await loadBase();
      toast.success("Projeto arquivado.");
    } catch {
      toast.error("Falha ao arquivar projeto.");
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm("Tem certeza que deseja excluir permanentemente este projeto? Esta ação apagará todas as configurações, mas manterá seus arquivos na pasta intactos.")) return;
    try {
      await desktop().projects.delete(projectId);
      if (detail?.project.id === projectId) setDetail(null);
      await loadBase();
      toast.success("Projeto excluído da base.");
    } catch {
      toast.error("Falha ao excluir projeto.");
    }
  };

  const handleSaveDetail = async () => {
    if (!detail) return;

    setSavingDetail(true);
    try {
      await desktop().projects.updateInstruction(detail.project.id, {
        scope: "project",
        content: projectInstructionDraft.trim(),
      });

      await desktop().projects.updatePolicy(detail.project.id, {
        allowDestructive,
        domainAllowlist: domainDraft
          .split(/\r?\n|,/)
          .map((item) => item.trim())
          .filter(Boolean),
      });

      await loadDetail(detail.project.id);
      await loadBase();
      toast.success("Instructions e policy salvas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar settings do project.");
    } finally {
      setSavingDetail(false);
    }
  };

  const handleAddContext = async () => {
    if (!detail || !newContextValue.trim()) return;
    try {
      await desktop().projects.addContextItem(detail.project.id, {
        type: newContextType,
        value: newContextValue.trim(),
      });
      setNewContextValue("");
      await loadDetail(detail.project.id);
      toast.success("Item de contexto adicionado.");
    } catch (error) {
      toast.error("Erro ao adicionar contexto.");
    }
  };

  const handleRemoveContext = async (itemId: string) => {
    if (!detail) return;
    try {
      await desktop().projects.removeContextItem(detail.project.id, itemId);
      await loadDetail(detail.project.id);
      toast.success("Item removido.");
    } catch {
      toast.error("Erro ao remover item.");
    }
  };

  return (
    <AppShell
      title="Workspaces"
      subtitle="Gerencie seus ambientes de projeto, memórias geradas e políticas de segurança locais."
      inspector={
        <div className="flex h-full flex-col gap-6">
          <div>
            <Badge variant="outline" className="bg-primary/5 text-[9px] text-primary border-primary/20 px-2 py-0.5 rounded-full">
              Foundation
            </Badge>
            <h3 className="mt-3 text-sm font-medium tracking-tight text-foreground">
              M0 + M1
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Base vital do RAG. Cada workspace retém contextos isolados, aprovações e instruções únicas para a AI.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Métricas Globais</h4>
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <span className="text-xs text-foreground">Projetos Locais</span>
              <span className="text-xs font-mono">{projects.length}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <span className="text-xs text-foreground">Workspace Ativo</span>
              <span className="text-xs font-mono">{activeCount}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <span className="text-xs text-foreground">Ações Auditadas</span>
              <span className="text-xs font-mono">{approvalEvents.length}</span>
            </div>
          </div>

          <div className="pt-2">
            <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Eventos Sensíveis recentes</h4>
            <div className="flex flex-col gap-2">
              {approvalEvents.length === 0 && (
                <p className="text-xs text-muted-foreground/60 italic">Sem eventos auditáveis no momento.</p>
              )}
              {approvalEvents.slice(0, 6).map((event) => (
                <div
                  key={event.id}
                  className="rounded-md border border-border/40 bg-muted/10 p-2 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 capitalize">{event.actionType}</p>
                    <span className="text-[9px] text-muted-foreground">{new Date(event.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground" title={event.target}>
                    {event.target.split('/').pop()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      }
    >
      <div className="flex h-[calc(100vh-[180px])] max-h-[800px] gap-8 antialiased">
        {/* SIDEBAR: Lista de Projetos */}
        <div className="w-[300px] flex flex-col gap-4 border-r border-border/40 pr-6 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Meus Workspaces</h2>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => { setIsCreating(true); setSelectedProjectId(null); }} 
              className={`h-8 w-8 rounded-full ${isCreating ? 'bg-primary/10 text-primary' : 'hover:bg-primary/5 hover:text-primary'}`}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {projects.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 text-center px-4 rounded-xl border border-dashed border-border/60 bg-muted/10">
                <p className="text-xs text-muted-foreground">Você ainda não possui projetos.</p>
                <Button variant="link" onClick={() => setIsCreating(true)} className="text-xs mt-1 h-auto p-0">Criar o primeiro</Button>
              </div>
            )}
            
            {projects.map((project) => {
              const isSelected = selectedProjectId === project.id && !isCreating;
              const isActive = activeProjectId === project.id;
              
              return (
                <div
                  key={project.id}
                  onClick={() => { setIsCreating(false); setSelectedProjectId(project.id); }}
                  className={`group relative rounded-xl border p-3 text-left transition-all cursor-pointer ${
                    isSelected 
                      ? "border-primary/30 bg-primary/5 shadow-sm ring-1 ring-primary/20" 
                      : "border-border/40 bg-card hover:bg-muted/30 hover:border-border/80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 pr-6">
                      <p className={`truncate text-sm font-medium transition-colors ${isSelected ? "text-primary" : "text-foreground"}`}>
                        {project.name}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80 flex items-center gap-1.5" title={project.rootPath}>
                        {project.rootPath.split('/').pop()}
                      </p>
                    </div>
                  </div>
                  
                  {isActive && (
                    <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-green-500 ring-2 ring-green-500/20 shadow-[0_0_8px_rgba(34,197,94,0.6)]" title="Projeto Ativo da Sessão"></div>
                  )}

                  {/* Ações Rápidas no Hover */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-card/80 backdrop-blur pb-1 pl-1 rounded-bl-md z-10">
                    {!isActive && project.status === "active" && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-background" onClick={(e) => { e.stopPropagation(); handleSetActive(project.id); }} title="Ativar para RAG">
                        <CheckCircle2 className="size-3" />
                      </Button>
                    )}
                    {project.status === "active" && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-background text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleArchive(project.id); }} title="Arquivar">
                        <Archive className="size-3" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-500" onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }} title="Excluir Definitivamente">
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 overflow-y-auto pb-10">
          {isCreating ? (
            <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8">
                <h2 className="text-2xl font-semibold tracking-tight">Criar Novo Workspace</h2>
                <p className="text-sm text-muted-foreground mt-1">Configure um novo ambiente isolado para a IA analisar.</p>
              </div>

              <div className="space-y-8 bg-card border border-border/40 rounded-2xl p-8 shadow-sm">
                <div className="flex p-1 bg-muted/40 rounded-lg w-max border border-border/50">
                  <button
                    type="button"
                    onClick={() => setMode("existing")}
                    className={`rounded-md px-5 py-1.5 text-xs font-medium transition-colors ${
                      mode === "existing" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Mapear pasta existente
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("new-folder")}
                    className={`rounded-md px-5 py-1.5 text-xs font-medium transition-colors ${
                      mode === "new-folder" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Criar do zero
                  </button>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground">Nome do Workspace</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Produto Alfa" className="h-[42px] bg-muted/20 border-border/50 font-medium" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground">
                      {mode === "existing" ? "Caminho da Pasta" : "Diretório Pai"}
                    </label>
                    <div className="flex gap-2">
                      <Input value={folderPath} readOnly placeholder="Selecione um diretório local" className="h-[42px] bg-muted/20 border-border/50" />
                      <Button variant="outline" onClick={handlePickFolder} className="shrink-0 h-[42px] px-5 border-border/50 hover:bg-muted/40">
                        <FolderPlus className="size-4 mr-2" />
                        Localizar
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground">Prompt de Sistema do Workspace (Opcional)</label>
                    <Textarea
                      value={instructionsDraft}
                      onChange={(e) => setInstructionsDraft(e.target.value)}
                      rows={4}
                      className="resize-none bg-muted/20 border-border/50 p-4 text-sm leading-relaxed focus-visible:ring-1"
                      placeholder="Identidade da IA para esse projeto específico, tom de voz, regras absolutas ou informações pregressas."
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button onClick={handleCreate} disabled={loading} className="px-8 font-medium h-[42px] shadow-sm rounded-full">
                    {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Layers3 className="size-4 mr-2" />}
                    Construir Workspace
                  </Button>
                </div>
              </div>
            </div>
          ) : detail ? (
            <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-semibold tracking-tight">{detail.project.name}</h2>
                    {activeProjectId === detail.project.id && (
                      <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20">Ativo na Sessão</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 font-mono text-[11px] bg-muted/30 w-max px-2 py-0.5 rounded-md mt-2">{detail.project.rootPath}</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleDelete(detail.project.id)} variant="outline" className="rounded-full shadow-sm text-red-500 hover:text-red-600 hover:bg-red-50 border-red-100">
                    <Trash2 className="size-4 mr-2" />
                    Excluir
                  </Button>
                  {activeProjectId !== detail.project.id && (
                    <Button onClick={() => handleSetActive(detail.project.id)} variant="default" className="rounded-full shadow-sm">
                      Definir como Ativo
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-8">
                {/* INSTRUCTIONS SEC */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                    <Type className="size-4 text-primary" />
                    <h3 className="text-sm font-semibold">Diretrizes do Modelo</h3>
                  </div>
                  <div className="bg-card border border-border/50 rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-primary/40 focus-within:border-primary/40 transition-shadow">
                    <Textarea
                      value={projectInstructionDraft}
                      onChange={(e) => setProjectInstructionDraft(e.target.value)}
                      rows={6}
                      className="resize-none border-0 box-shadow-none focus-visible:ring-0 p-5 text-sm leading-relaxed bg-transparent"
                      placeholder="Escreva como o assistente deve se comportar quando este projeto estiver ativo. Exemplo: 'Foque apenas no backend em Go. Não gere UI.'"
                    />
                  </div>
                </div>

                {/* SECURITY SEC */}
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                      <Network className="size-4 text-primary" />
                      <h3 className="text-sm font-semibold">Egress Network Allowlist</h3>
                    </div>
                    <div className="bg-card border border-border/50 rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-primary/40 focus-within:border-primary/40 transition-shadow">
                      <Textarea
                        value={domainDraft}
                        onChange={(e) => setDomainDraft(e.target.value)}
                        rows={5}
                        className="resize-none font-mono text-[12px] border-0 box-shadow-none focus-visible:ring-0 p-4 bg-transparent"
                        placeholder="github.com&#10;api.meusistema.com"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground px-1">Defina quais domínios a IA pode acessar via network requests (um por linha).</p>
                  </div>

                  <div className="space-y-5">
                    <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                      <ShieldCheck className="size-4 text-primary" />
                      <h3 className="text-sm font-semibold">Políticas Locais</h3>
                    </div>
                    
                    <div className="flex items-start justify-between p-4 rounded-xl border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors">
                      <div className="pr-4 mt-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-destructive">Ações Destrutivas</h4>
                        </div>
                        <p className="mt-1 text-xs text-destructive/80 leading-snug">
                          Permitir que a IA exclua ou sobrescreva arquivos sensíveis sem aprovação rígida. (Perigoso)
                        </p>
                      </div>
                      <Switch checked={allowDestructive} onCheckedChange={setAllowDestructive} className="mt-1 data-[state=checked]:bg-destructive" />
                    </div>

                    <div className="p-4 rounded-xl border border-border/40 bg-muted/10">
                      <h4 className="text-xs font-medium text-foreground">Scopos Indexados Mapeados</h4>
                      <p className="text-2xl font-light mt-1 tabular-nums">{detail.policy.fileRoots.length}</p>
                    </div>
                  </div>
                </div>

                {/* PINNED CONTEXT SEC */}
                <div className="space-y-4 pt-4 border-t border-border/40">
                  <div className="flex items-center gap-2">
                    <Link className="size-4 text-primary" />
                    <h3 className="text-sm font-semibold">Pinned Context / References</h3>
                  </div>
                  
                  <div className="flex gap-2 items-center bg-card p-1.5 rounded-xl border border-border/50">
                    <div className="flex rounded-lg bg-muted p-1 shrink-0">
                      {(["url", "file", "text"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNewContextType(t)}
                          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                            newContextType === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {t === "url" ? "URL" : t === "file" ? "File" : "Texto"}
                        </button>
                      ))}
                    </div>
                    <Input
                      value={newContextValue}
                      onChange={(e) => setNewContextValue(e.target.value)}
                      placeholder={newContextType === "url" ? "https://..." : newContextType === "file" ? "/caminho/do/arquivo" : "Insira uma nota fixa"}
                      className="h-8 border-0 bg-transparent focus-visible:ring-0 px-2"
                    />
                    <Button size="sm" onClick={handleAddContext} variant="secondary" className="h-8 px-4 rounded-lg shrink-0">
                      Adicionar
                    </Button>
                  </div>

                  <div className="flex flex-col gap-2 mt-4">
                    {(!detail.contextItems || detail.contextItems.length === 0) && (
                      <p className="text-xs text-muted-foreground/60 italic py-2">Nenhum contexto base fixado permanentemente.</p>
                    )}
                    {detail.contextItems?.map((item) => (
                      <div key={item.id} className="group flex items-center justify-between rounded-lg border border-border/40 bg-card hover:bg-muted/30 px-4 py-2.5 transition-colors">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="p-1.5 bg-primary/10 rounded-md shrink-0">
                            {item.type === "url" ? <Globe className="size-3.5 text-primary" /> : item.type === "file" ? <FolderTree className="size-3.5 text-primary" /> : <Type className="size-3.5 text-primary" />}
                          </div>
                          <span className="text-xs font-medium truncate" title={item.value}>{item.value}</span>
                        </div>
                        <button onClick={() => handleRemoveContext(item.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 transition-all">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 pb-12 flex items-center justify-between border-t border-border/40">
                  <p className="text-xs text-muted-foreground">Última atualização: {new Date(detail.project.updatedAt).toLocaleString()}</p>
                  <Button onClick={handleSaveDetail} disabled={savingDetail} className="rounded-full px-8 shadow-sm">
                    {savingDetail ? <Loader2 className="size-4 animate-spin mr-2" /> : <CheckCircle2 className="size-4 mr-2" />}
                    Salvar Alterações
                  </Button>
                </div>
              </div>
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center h-full max-w-sm mx-auto text-center animate-in fade-in duration-700">
               <div className="h-16 w-16 bg-primary/5 text-primary rounded-full flex items-center justify-center mb-6 ring-1 ring-primary/20 shadow-sm">
                 <Layers3 className="size-8 opacity-80" />
               </div>
               <h3 className="text-xl font-semibold text-foreground tracking-tight">Nenhum Workspace Selecionado</h3>
               <p className="text-sm text-muted-foreground mt-2 mb-8 leading-relaxed">
                 O Cowork roda localmente baseado em diretórios isolados. Escolha um workspace na lateral para customizar suas políticas, ou crie o seu primeiro para começar.
               </p>
               <Button onClick={() => setIsCreating(true)} className="rounded-full px-6 shadow-sm">
                 <Plus className="size-4 mr-2" />
                 Novo Workspace
               </Button>
             </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};
