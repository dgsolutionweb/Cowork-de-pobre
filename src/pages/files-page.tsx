import { useEffect, useMemo, useState } from "react";
import type { BrowseFilesInput, FileExplorerData, FileItem } from "@shared/types";
import {
  CheckSquare,
  Eye,
  File,
  FileImage,
  FileText,
  FileVideo,
  FolderPlus,
  Loader2,
  MoveRight,
  Search,
  Shield,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/layouts/app-shell";
import { desktop } from "@/services/desktop";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// ─── File type icons ──────────────────────────────────────────────────────────

const EXT_GROUPS: Record<string, { icon: typeof File; label: string; className: string }> = {
  ".pdf": { icon: FileText, label: "PDF", className: "text-rose-500" },
  ".doc": { icon: FileText, label: "DOC", className: "text-blue-500" },
  ".docx": { icon: FileText, label: "DOCX", className: "text-blue-500" },
  ".xls": { icon: FileText, label: "XLS", className: "text-emerald-600" },
  ".xlsx": { icon: FileText, label: "XLSX", className: "text-emerald-600" },
  ".ppt": { icon: FileText, label: "PPT", className: "text-orange-500" },
  ".pptx": { icon: FileText, label: "PPTX", className: "text-orange-500" },
  ".png": { icon: FileImage, label: "PNG", className: "text-violet-500" },
  ".jpg": { icon: FileImage, label: "JPG", className: "text-violet-500" },
  ".jpeg": { icon: FileImage, label: "JPG", className: "text-violet-500" },
  ".gif": { icon: FileImage, label: "GIF", className: "text-violet-500" },
  ".webp": { icon: FileImage, label: "WEBP", className: "text-violet-500" },
  ".mp4": { icon: FileVideo, label: "MP4", className: "text-amber-500" },
  ".mov": { icon: FileVideo, label: "MOV", className: "text-amber-500" },
};

const getFileType = (ext: string) =>
  EXT_GROUPS[ext.toLowerCase()] ?? { icon: File, label: ext || "—", className: "text-muted-foreground" };

// ─── Quick filter chips ───────────────────────────────────────────────────────

const FILTER_CHIPS = [
  { label: "Todos", ext: "" },
  { label: "PDF", ext: ".pdf" },
  { label: "Imagens", ext: ".png" },
  { label: "Word", ext: ".docx" },
  { label: "Excel", ext: ".xlsx" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const FilesPage = () => {
  const [query, setQuery] = useState("");
  const [extension, setExtension] = useState("");
  const [data, setData] = useState<FileExplorerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<FileItem | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [dragOverDirId, setDragOverDirId] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);

  const filters = useMemo<BrowseFilesInput>(
    () => ({ query: query || undefined, extension: extension || undefined }),
    [query, extension],
  );

  const loadFiles = async (nextFilters: BrowseFilesInput = filters) => {
    setLoading(true);
    try {
      setData(await desktop().files.browse(nextFilters));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar arquivos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
    const onFocus = () => loadFiles(filters);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [filters]);

  const addDirectory = async () => {
    const directory = await desktop().files.pickAuthorizedDirectory();
    if (directory) {
      setData((prev) => {
        if (!prev) return prev;
        if (prev.directories.some((entry) => entry.id === directory.id)) return prev;
        return {
          ...prev,
          directories: [directory, ...prev.directories],
        };
      });
      toast.success(`Pasta ${directory.name} adicionada ao escopo.`);
      loadFiles();
    }
  };

  const removeDirectory = async (id: string) => {
    await desktop().files.removeAuthorizedDirectory(id);
    toast.success("Pasta removida do escopo autorizado.");
    loadFiles();
  };

  const handleSearch = () => loadFiles();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const clearSearch = () => {
    setQuery("");
    setExtension("");
    loadFiles({ query: undefined, extension: undefined });
  };

  const hasActiveFilter = !!query || !!extension;

  const toggleSelect = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const files = data?.files ?? [];
    if (selected.size === files.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(files.map((f) => f.path)));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    try {
      const result = await desktop().files.deleteMany([...selected]);
      const msg = result.vaulted > 0
        ? `${result.deleted} excluído(s), ${result.vaulted} movido(s) pro vault.`
        : `${result.deleted} arquivo(s) excluído(s).`;
      toast.success(msg);
      setSelected(new Set());
      loadFiles();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir.");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleDrop = async (e: React.DragEvent, dirPath: string) => {
    e.preventDefault();
    setDragOverDirId(null);
    setDropping(true);
    const filePath = e.dataTransfer.getData("text/plain");
    if (!filePath) { setDropping(false); return; }

    // If dragged file is part of selection, move all selected; otherwise just that file
    const paths = selected.has(filePath) ? [...selected] : [filePath];
    try {
      const result = await desktop().files.moveMany(paths, dirPath);
      toast.success(`${result.moved} arquivo(s) movido(s).`);
      if (result.failed > 0) toast.error(`${result.failed} falha(s).`);
      setSelected(new Set());
      loadFiles();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao mover.");
    } finally {
      setDropping(false);
    }
  };

  return (
    <AppShell
      title="Arquivos e Repositórios"
      subtitle="Controle de acesso e biblioteca local autorizada para o IA (RAG e Análises)."
      inspector={
        <div className="flex h-full flex-col gap-6">
          {preview ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div>
                <Badge variant="outline" className="bg-primary/5 text-[9px] text-primary border-primary/20 px-2 py-0.5 rounded-full mb-3">
                  Visualização de Metadados
                </Badge>
                <div className="flex items-center gap-3">
                  {(() => {
                    const FileIcon = getFileType(preview.extension).icon;
                    return <FileIcon className={`size-8 ${getFileType(preview.extension).className}`} />;
                  })()}
                  <h3 className="text-sm font-semibold tracking-tight text-foreground truncate" title={preview.name}>
                    {preview.name}
                  </h3>
                </div>
                <p className="mt-4 font-mono text-[10px] text-muted-foreground p-2 bg-muted/40 rounded-lg break-all border border-border/50">
                  {preview.path}
                </p>
              </div>
              
              <div className="mt-6 rounded-xl border border-border/40 bg-card p-4 space-y-3 shadow-sm">
                <div className="flex justify-between items-center border-b border-border/40 pb-2">
                  <span className="text-[11px] font-medium text-muted-foreground">Tipo de Arquivo</span>
                  <span className="text-[11px] font-semibold">{preview.extension || "—"}</span>
                </div>
                <div className="flex justify-between items-center border-b border-border/40 pb-2">
                  <span className="text-[11px] font-medium text-muted-foreground">Tamanho em Disco</span>
                  <span className="text-[11px] font-semibold">{Math.max(1, Math.round(preview.size / 1024))} KB</span>
                </div>
                <div className="flex justify-between items-center pb-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Diretório Pai</span>
                  <span className="text-[11px] font-semibold truncate max-w-[120px]">{preview.directoryName ?? "—"}</span>
                </div>
              </div>
              
              <Button onClick={() => setPreview(null)} className="w-full mt-6 rounded-full shadow-sm">
                X Fechar Prévia
              </Button>
            </div>
          ) : (
            <div className="animate-in fade-in duration-500">
              <div>
                <Badge variant="outline" className="bg-card text-[9px] px-2 py-0.5 rounded-full border-border/60 mb-2">
                  Foundation
                </Badge>
                <h3 className="mt-2.5 text-sm font-semibold tracking-tight text-foreground">
                  Regras de Segurança RAG
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Políticas ativas neste perímetro.
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                {[
                  "A IA só lê o que está autorizado.",
                  "Listagem recursiva apenas dentro dos diretórios mapeados.",
                  "Mova arquivos livremente entre as zonas de segurança."
                ].map((rule, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-xl border border-border/40 bg-muted/10 p-3.5 hover:bg-muted/30 transition-colors"
                  >
                    <Shield className="mt-0.5 size-4 shrink-0 text-primary" />
                    <p className="text-[11px] font-medium leading-relaxed text-foreground">{rule}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      }
    >
      <div className="flex h-[calc(100vh-[180px])] max-h-[800px] gap-8 antialiased">
        {/* SIDEBAR: Pastas Autorizadas */}
        <div className="w-[280px] flex flex-col gap-4 border-r border-border/40 pr-6 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Escopos Locais</h2>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={addDirectory} 
              className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
              title="Adicionar pasta mãe"
            >
              <FolderPlus className="size-4" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {dropping && (
              <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 mb-2 text-center animate-pulse">
                <p className="text-[11px] font-medium text-primary">Pronto para mover...</p>
              </div>
            )}

            {data?.directories.length === 0 && (
              <div className="flex flex-col items-center justify-center p-6 text-center rounded-xl border border-dashed border-border/60 bg-muted/10">
                <p className="text-xs text-muted-foreground">Nenhum diretório seguro adicionado ainda.</p>
              </div>
            )}

            {data?.directories.map((directory) => (
              <div
                key={directory.id}
                onDragOver={(e) => { e.preventDefault(); setDragOverDirId(directory.id); }}
                onDragLeave={() => setDragOverDirId(null)}
                onDrop={(e) => handleDrop(e, directory.path)}
                className={`group relative rounded-xl border p-3.5 text-left transition-all ${
                  dragOverDirId === directory.id
                    ? "border-primary/50 bg-primary/10 scale-[1.02] shadow-sm ring-1 ring-primary/20"
                    : "border-border/40 bg-card hover:bg-muted/30 hover:border-border/80"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-muted/40 rounded-md shrink-0">
                    <FolderPlus className={`size-4 ${dragOverDirId === directory.id ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="min-w-0 pr-6">
                    <p className={`truncate text-[13px] font-semibold transition-colors ${dragOverDirId === directory.id ? 'text-primary' : 'text-foreground'}`}>
                      {directory.name}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground/80 flex items-center" title={directory.path}>
                      {directory.path.split('/').slice(-2).join('/') || '/'}
                    </p>
                  </div>
                </div>

                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeDirectory(directory.id)}
                    className="h-7 w-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-background"
                    title="Remover Permissão"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MAIN: Catálogo e Busca */}
        <div className="flex-1 flex flex-col min-w-0 pr-4 pb-8">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
            <div className="relative flex-1 group w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
              <Input
                className="pl-11 pr-10 h-[42px] bg-card border-border/60 shadow-sm rounded-full focus-visible:ring-1 focus-visible:ring-primary/30 transition-all"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar em todo o perímetro de segurança..."
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {hasActiveFilter && (
                <Button variant="ghost" onClick={clearSearch} className="h-[42px] px-4 rounded-full text-muted-foreground hover:text-foreground">
                  Limpar
                </Button>
              )}
              <Button onClick={handleSearch} disabled={loading} className="h-[42px] px-6 rounded-full shadow-sm font-medium">
                {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Search className="size-4 mr-2" />}
                Filtrar
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {FILTER_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => {
                  setExtension(chip.ext);
                  loadFiles({ query: query || undefined, extension: chip.ext || undefined });
                }}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200 ${
                  extension === chip.ext
                    ? "bg-foreground text-background shadow-sm ring-1 ring-border"
                    : "bg-muted/10 border border-border/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Tabela de Arquivos */}
          <div className="flex-1 overflow-hidden bg-card border border-border/40 shadow-sm rounded-2xl flex flex-col">
            {selected.size > 0 && (
              <div className="flex items-center gap-4 bg-primary/5 px-6 py-3 border-b border-primary/10">
                <span className="text-sm font-semibold text-primary">{selected.size} itens selecionados</span>
                <div className="flex gap-2 ml-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected(new Set())}
                    className="h-8 rounded-full px-4 text-xs font-medium text-muted-foreground hover:bg-background"
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    className="h-8 rounded-full px-4 text-xs font-medium shadow-sm transition-all"
                  >
                    {bulkDeleting ? <Loader2 className="size-3.5 animate-spin mr-2" /> : <Trash2 className="size-3.5 mr-2" />}
                    Apagar Tudo
                  </Button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {data?.files.length ? (
                <Table>
                  <TableHeader className="bg-muted/10 sticky top-0 backdrop-blur z-10 border-b border-border/40">
                    <TableRow className="hover:bg-transparent border-0">
                      <TableHead className="w-12 px-4">
                        <button type="button" onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground flex items-center justify-center">
                          {data?.files.length && selected.size === data.files.length
                            ? <CheckSquare className="size-4" />
                            : <Square className="size-4" />}
                        </button>
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground py-3">Arquivo</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground py-3">Tipo</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground py-3 hidden md:table-cell">Origem</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground py-3">Tamanho</TableHead>
                      <TableHead className="w-12 px-4" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.files.map((file) => {
                      const ft = getFileType(file.extension);
                      const FileIcon = ft.icon;
                      const isFileSelected = selected.has(file.path);
                      
                      return (
                        <TableRow
                          key={file.path}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", file.path);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          className={`group border-b border-border/20 transition-colors cursor-grab active:cursor-grabbing ${isFileSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"}`}
                        >
                          <TableCell className="px-4 w-12 text-center align-middle">
                            <button type="button" onClick={() => toggleSelect(file.path)} className={`transition-colors ${isFileSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                              {isFileSelected ? <CheckSquare className="size-4 outline-none" /> : <Square className="size-4" />}
                            </button>
                          </TableCell>
                          
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg bg-background border border-border/40 shrink-0 ${ft.className}`}>
                                <FileIcon className="size-4" />
                              </div>
                              <span className={`text-sm font-medium truncate max-w-[200px] lg:max-w-[300px] ${isFileSelected ? 'text-primary' : 'text-foreground'}`} title={file.name}>
                                {file.name}
                              </span>
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <Badge variant="outline" className={`font-mono text-[10px] bg-background border-border/60 ${ft.className}`}>
                              {ft.label}
                            </Badge>
                          </TableCell>
                          
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground truncate max-w-[150px]">
                            {file.directoryName ?? "Raiz"}
                          </TableCell>
                          
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            {Math.max(1, Math.round(file.size / 1024))} KB
                          </TableCell>
                          
                          <TableCell className="px-4 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPreview(file)}
                              className={`h-8 w-8 rounded-full transition-opacity ${isFileSelected ? 'opacity-100 bg-background text-primary' : 'opacity-0 group-hover:opacity-100 hover:bg-background'}`}
                              title="Ver Detalhes"
                            >
                              <Eye className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8">
                  <div className="h-16 w-16 bg-muted/30 text-muted-foreground rounded-full flex items-center justify-center mb-6 ring-1 ring-border/50">
                    <Search className="size-8 opacity-40" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground tracking-tight">
                    {hasActiveFilter ? "Filtro sem resultados" : "Nenhum arquivo listado"}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-sm">
                    {hasActiveFilter
                      ? "Experimente mudar os parâmetros da busca na barra acima."
                      : "Verifique se as pastas autorizadas na lateral esquerda contêm arquivos compatíveis com o sistema."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};
