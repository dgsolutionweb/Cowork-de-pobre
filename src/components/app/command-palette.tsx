import { useEffect, useRef, useState } from "react";
import type { GlobalSearchHit } from "@shared/types";
import {
  AlertCircle,
  Bot,
  Clock3,
  File,
  FolderTree,
  FolderKanban,
  Hash,
  LayoutDashboard,
  Loader2,
  Search,
  Settings2,
  Trash2,
  Workflow,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { desktop } from "@/services/desktop";

const KIND_ICONS: Record<string, typeof Search> = {
  page: LayoutDashboard,
  file: File,
  history: Clock3,
  automation: Workflow,
  project: FolderTree,
};

const PAGE_ICONS: Record<string, typeof Search> = {
  "/": LayoutDashboard,
  "/projects": FolderTree,
  "/assistant": Bot,
  "/files": FolderKanban,
  "/tasks": Workflow,
  "/history": Clock3,
  "/vault": Trash2,
  "/logs": AlertCircle,
  "/settings": Settings2,
};

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CommandPalette = ({ open, onOpenChange }: CommandPaletteProps) => {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GlobalSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
      // load defaults
      desktop()
        .search.global("")
        .then((r) => setHits(r.hits))
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const result = await desktop().search.global(query);
        setHits(result.hits);
        setSelected(0);
      } catch {}
      finally { setLoading(false); }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open]);

  const selectHit = (hit: GlobalSearchHit) => {
    if (hit.kind === "page" && hit.payload?.href) {
      navigate(hit.payload.href);
    } else if (hit.kind === "automation" && hit.payload?.id) {
      navigate("/tasks");
    } else if (hit.kind === "project") {
      navigate("/projects");
    } else if (hit.kind === "history") {
      navigate("/history");
    }
    onOpenChange(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onOpenChange(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, hits.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && hits[selected]) { selectHit(hits[selected]); }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
          {loading ? (
            <Loader2 className="size-4 shrink-0 text-muted-foreground animate-spin" />
          ) : (
            <Search className="size-4 shrink-0 text-muted-foreground" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Buscar arquivos, páginas, histórico..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
          <kbd className="rounded border border-border/50 bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {hits.length === 0 && (
            <div className="flex flex-col items-center py-8 text-center">
              <Hash className="size-6 text-muted-foreground/30" />
              <p className="mt-2 text-[12px] text-muted-foreground">Nenhum resultado encontrado.</p>
            </div>
          )}
          {hits.map((hit, i) => {
            const PageIcon =
              hit.kind === "page" && hit.payload?.href
                ? (PAGE_ICONS[hit.payload.href] ?? LayoutDashboard)
                : KIND_ICONS[hit.kind] ?? File;

            return (
              <button
                key={`${hit.kind}-${hit.id}`}
                type="button"
                onClick={() => selectHit(hit)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === selected ? "bg-accent" : "hover:bg-accent/50"
                }`}
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/40">
                  <PageIcon className="size-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">{hit.title}</p>
                  {hit.subtitle && (
                    <p className="truncate text-[11px] text-muted-foreground">{hit.subtitle}</p>
                  )}
                </div>
                {hit.hint && (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    {hit.hint}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="border-t border-border/40 px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground/60">
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>ESC fechar</span>
          <span className="ml-auto">⌘K para abrir</span>
        </div>
      </div>
    </div>
  );
};
