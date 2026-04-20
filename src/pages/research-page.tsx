import { useState, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { desktop } from "@/services/desktop";
import type { ResearchResult, DeepResearchResult } from "@shared/types";
import { Search, Loader2, FolderOpen, Copy, Check, BrainCircuit, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/layouts/app-shell";

type FileType = "all" | ".md" | ".txt" | ".pdf" | ".docx";

export function ResearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileType, setFileType] = useState<FileType>("all");
  const [projectId, setProjectId] = useState<string | undefined>();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"quick" | "deep">("quick");

  // Deep Research states
  const [objective, setObjective] = useState("");
  const [isDeepResearching, setIsDeepResearching] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [deepProgress, setDeepProgress] = useState<string[]>([]);
  const [deepResult, setDeepResult] = useState<DeepResearchResult | null>(null);

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    return desktop().research.onProgress((msg) => {
      setDeepProgress(prev => [...prev, msg]);
    });
  }, []);

  useEffect(() => {
    desktop()
      .settings.getPreferences()
      .then((prefs) => {
        if (prefs.activeProjectId) {
          setProjectId(prefs.activeProjectId);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!debouncedQuery || !projectId) {
      setResults([]);
      return;
    }

    const search = async () => {
      setLoading(true);
      try {
        const data = await desktop().projects.searchContext(projectId, debouncedQuery);
        setResults(data);
      } catch (error) {
        console.error("Search failed:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    search();
  }, [debouncedQuery, projectId]);

  const filteredResults = results.filter((r) => {
    if (fileType === "all") return true;
    return r.filePath.toLowerCase().endsWith(fileType);
  });

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getFileIcon = (filePath: string) => {
    if (filePath.endsWith(".md")) return "📝";
    if (filePath.endsWith(".txt")) return "📄";
    if (filePath.endsWith(".pdf")) return "📕";
    if (filePath.endsWith(".docx")) return "📘";
    return "📁";
  };

  const highlightMatches = (content: string, searchTerm: string) => {
    if (!searchTerm) return content;
    const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapedSearch})`, "gi");
    const singleMatchRegex = new RegExp(`^${escapedSearch}$`, "i");
    const parts = content.split(regex);
    return parts.map((part, i) =>
      singleMatchRegex.test(part) ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-900 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const startDeepResearch = async () => {
    if (!objective.trim()) return;
    setIsDeepResearching(true);
    setDeepProgress(["Iniciando Pesquisa Profunda..."]);
    setDeepResult(null);
    try {
      const result = await desktop().research.startDeepResearch(objective);
      setDeepResult(result);
    } catch(err) {
      console.error(err);
      setDeepProgress(prev => [...prev, `Erro: ${err instanceof Error ? err.message : 'Falha'}`]);
    } finally {
      setIsDeepResearching(false);
    }
  };

  const exportArtifact = async () => {
    if (!deepResult || !projectId) return;
    setIsExporting(true);
    try {
      const markdown = `# ${objective}\n\n${deepResult.markdownReport}\n\n## Fontes Mapeadas\n${deepResult.sources.map(s => `- ${s}`).join('\n')}`;
      const { filePath } = await desktop().research.exportArtifact(projectId, objective, markdown);
      toast.success(`Relatório salvo em: ${filePath.split("/").pop()}`);
    } catch (error) {
      toast.error(`Erro ao salvar: ${error instanceof Error ? error.message : "Desconhecido"}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppShell
      title="Pesquisa com RAG"
      subtitle="Busque conteúdo diretamente nos arquivos do seu projeto ou execute pesquisas profundas multi-step."
    >
      <div className="space-y-6">
        <div className="flex bg-muted/50 p-1 rounded-lg w-max">
          <button
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'quick' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('quick')}
          >
            Busca Rápida
          </button>
          <button
            className={`px-4 py-1.5 text-sm font-medium flex items-center gap-2 rounded-md transition-colors ${activeTab === 'deep' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('deep')}
          >
            <BrainCircuit className="h-4 w-4" />
            Pesquisa Profunda
          </button>
        </div>

        {activeTab === 'quick' && (
          <>
            <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Digite para buscar nos arquivos do projeto..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={fileType}
          onChange={(e) => setFileType(e.target.value as FileType)}
          className="h-10 w-[180px] rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">Todos os tipos</option>
          <option value=".md">Markdown (.md)</option>
          <option value=".txt">Texto (.txt)</option>
          <option value=".pdf">PDF (.pdf)</option>
          <option value=".docx">Word (.docx)</option>
        </select>
      </div>

      {!projectId && (
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="flex items-center gap-3 p-4">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Selecione um projeto ativo em <strong>Projects</strong> para pesquisar
            </p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && query && filteredResults.length === 0 && (
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="flex items-center gap-3 p-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum resultado encontrado para "{query}"
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filteredResults.map((result, index) => (
          <Card key={index} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getFileIcon(result.filePath)}</span>
                  <div>
                    <p className="text-sm font-medium">
                      {result.filePath.split("/").pop()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {result.filePath}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    Rank: {result.rank?.toFixed(2) ?? "N/A"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(result.content, `${index}-${result.filePath}`)}
                    className="h-8 w-8 p-0"
                  >
                    {copiedId === `${index}-${result.filePath}` ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="mt-3 p-3 bg-muted/50 rounded-md">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {highlightMatches(result.content, query)}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
            </div>
          </>
        )}

        {activeTab === 'deep' && (
          <div className="space-y-6">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-primary">
                    <BrainCircuit className="h-5 w-5" />
                    Deep Research Engine
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Define um objetivo macro. O agente quebrará em múltiplos passos cruzando a Web e o contexto do seu Projeto.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Input
                    placeholder="Ex: Quais os impactos da nova lei XPTO considerando nossos relatórios?"
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    disabled={isDeepResearching}
                    className="flex-1"
                  />
                  <Button 
                    onClick={startDeepResearch} 
                    disabled={!objective.trim() || isDeepResearching}
                  >
                    {isDeepResearching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {isDeepResearching ? "Pesquisando..." : "Iniciar"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {(isDeepResearching || deepProgress.length > 0) && !deepResult && (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-muted p-4 border-b flex items-center gap-3">
                    {isDeepResearching && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    <span className="font-medium text-sm">Progresso do Agente</span>
                  </div>
                  <div className="p-4 bg-black/90 font-mono text-xs text-green-400 space-y-2 h-[200px] overflow-y-auto">
                    {deepProgress.map((msg, i) => (
                      <div key={i}>{'>'} {msg}</div>
                    ))}
                    {isDeepResearching && <div className="animate-pulse">{'>'} _</div>}
                  </div>
                </CardContent>
              </Card>
            )}

            {deepResult && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between">
                  <div className="flex gap-3 items-center">
                    <h3 className="text-xl font-bold">Relatório Executivo</h3>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      {deepResult.sources.length} Fontes Analisadas
                    </Badge>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={exportArtifact} 
                    disabled={isExporting || !projectId}
                    className="flex text-xs h-8 items-center gap-2"
                  >
                    {isExporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Salvar Artifact (.md)
                  </Button>
                </div>
                
                <Card className="p-8 prose dark:prose-invert max-w-none text-sm leading-relaxed">
                  <div className="whitespace-pre-wrap">{deepResult.markdownReport}</div>
                </Card>

                <div className="pt-4 space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground">Fontes Mapeadas</h4>
                  <div className="flex flex-wrap gap-2">
                    {deepResult.sources.map((src, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] py-1 font-normal max-w-[300px] truncate">
                        {src}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
