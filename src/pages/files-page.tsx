import { useEffect, useMemo, useState } from "react";
import type { BrowseFilesInput, FileExplorerData } from "@shared/types";
import {
  File,
  FileImage,
  FileText,
  FileVideo,
  FolderPlus,
  Loader2,
  Search,
  Shield,
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

  const filters = useMemo<BrowseFilesInput>(
    () => ({ query: query || undefined, extension: extension || undefined }),
    [query, extension],
  );

  const loadFiles = async (nextFilters: BrowseFilesInput = filters) => {
    setLoading(true);
    try {
      setData(await desktop().files.browse(nextFilters));
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

  return (
    <AppShell
      title="Arquivos e Permissões"
      subtitle="Explore o catálogo local dentro do perímetro autorizado, filtrando por nome ou tipo."
      inspector={
        <div className="flex h-full flex-col gap-4">
          <div>
            <Badge variant="outline" className="bg-white text-[9px] px-1.5 py-0">
              Pastas autorizadas
            </Badge>
            <h3 className="mt-2.5 text-sm font-semibold tracking-tight text-foreground">
              Controle de acesso
            </h3>
            <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
              Nenhum caminho fora desta lista é acessado pelo app.
            </p>
          </div>

          <Button variant="outline" onClick={addDirectory} className="h-9 gap-2">
            <FolderPlus className="size-3.5" />
            Adicionar pasta
          </Button>

          <div className="flex flex-col gap-2">
            {data?.directories.length ? (
              data.directories.map((directory) => (
                <div
                  key={directory.id}
                  className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-foreground">{directory.name}</p>
                    <p className="mt-0.5 break-all text-[10px] text-muted-foreground">
                      {directory.path}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeDirectory(directory.id)}
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-[12px] text-muted-foreground">Nenhuma pasta adicionada.</p>
            )}
          </div>
        </div>
      }
    >
      {/* Search bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10 pr-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar por nome… (Enter para pesquisar)"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <Button onClick={handleSearch} disabled={loading} className="h-10 gap-2">
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
          Pesquisar
        </Button>
        {hasActiveFilter && (
          <Button variant="ghost" onClick={clearSearch} className="h-10 gap-1.5 text-muted-foreground">
            <X className="size-3.5" />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Extension chips */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => {
              setExtension(chip.ext);
              loadFiles({ query: query || undefined, extension: chip.ext || undefined });
            }}
            className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
              extension === chip.ext
                ? "border-foreground bg-foreground text-background"
                : "border-border/60 bg-white text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        {/* File catalog */}
        <Card className="shadow-sm border-border/60">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm">Catálogo local</CardTitle>
              <span className="text-[11px] text-muted-foreground">
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-3 animate-spin" /> Carregando…
                  </span>
                ) : (
                  `${data?.files.length ?? 0} item(s)`
                )}
              </span>
            </div>
            <CardDescription className="text-[11px]">
              Arquivos dentro do escopo autorizado.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {data?.files.length ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Arquivo
                    </TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Tipo
                    </TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Pasta
                    </TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Tamanho
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.files.map((file) => {
                    const ft = getFileType(file.extension);
                    const FileIcon = ft.icon;
                    return (
                      <TableRow
                        key={file.path}
                        className="border-border/40 transition-colors hover:bg-muted/30"
                      >
                        <TableCell className="text-[12px] font-medium text-foreground">
                          <span className="flex items-center gap-2">
                            <FileIcon className={`size-3.5 shrink-0 ${ft.className}`} />
                            <span className="truncate max-w-[180px]" title={file.name}>
                              {file.name}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-[11px] font-medium ${ft.className}`}>
                            {ft.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-[12px] text-muted-foreground">
                          {file.directoryName ?? "—"}
                        </TableCell>
                        <TableCell className="text-[12px] text-muted-foreground">
                          {Math.max(1, Math.round(file.size / 1024))} KB
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="size-8 text-muted-foreground/30" />
                <p className="mt-3 text-sm font-medium text-muted-foreground">
                  {hasActiveFilter ? "Nenhum arquivo encontrado" : "Nenhum arquivo no escopo"}
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground/70">
                  {hasActiveFilter
                    ? "Tente outros termos ou extensões."
                    : "Adicione pastas autorizadas no painel lateral."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security rules */}
        <Card className="shadow-sm border-border/60">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-sm">Regras de segurança</CardTitle>
            <CardDescription className="text-[11px]">
              Políticas em vigor neste release.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 p-5 pt-0">
            {[
              "Listagem recursiva apenas dentro dos diretórios autorizados.",
              "Filtros por nome e extensão em tempo real.",
              "Prévia obrigatória antes de mover, renomear ou criar pastas.",
              "Base preparada para duplicados, lixeira lógica e OCR futuro.",
            ].map((rule) => (
              <div
                key={rule}
                className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/20 p-3 transition-colors hover:bg-muted/40"
              >
                <Shield className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <p className="text-[12px] leading-relaxed text-muted-foreground">{rule}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};
