import { useEffect, useRef, useState } from "react";
import type {
  AuthorizedDirectory,
  CommandPreview,
  FileItem,
  PendingFileOperation,
  ConversationMessage,
} from "@shared/types";
import {
  AlertTriangle,
  AtSign,
  Bot,
  CheckCircle2,
  ChevronRight,
  File,
  FileImage,
  FileText,
  Loader2,
  MoveRight,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  Wrench,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/layouts/app-shell";
import { desktop } from "@/services/desktop";
import { useAssistantStore } from "@/store/useAssistantStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PreviewDialog } from "@/components/app/preview-dialog";

// ─── Suggestions ───────────────────────────────────────────────────────────────

const QUICK_SUGGESTIONS = [
  { label: "Organizar Downloads", prompt: "Organize minha pasta Downloads por tipo de arquivo" },
  { label: "Listar PDFs", prompt: "Liste todos os PDFs que tenho" },
  { label: "Arquivos recentes", prompt: "Quais foram os arquivos modificados recentemente?" },
  { label: "Buscar duplicados", prompt: "Encontre arquivos duplicados nas minhas pastas" },
  { label: "Criar pasta cliente", prompt: "Crie uma pasta para o cliente Acme Corp" },
  { label: "Buscar contratos", prompt: "Busque arquivos com 'contrato' no nome" },
];

// ─── Markdown-lite renderer ────────────────────────────────────────────────────

function renderText(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const parts = line
      .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
      .map((part, j) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={j}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={j} className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      });

    return (
      <span key={i}>
        {parts}
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
}

// ─── Tool badge labels ─────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  listar_arquivos: "Listou arquivos",
  buscar_arquivos: "Buscou arquivos",
  abrir_arquivo: "Abriu arquivo",
  analisar_documento: "Analisou documento",
  reorganizar_documento: "Reorganizou documento",
  criar_relatorio: "Criou relatório",
  arquivos_recentes: "Verificou arquivos recentes",
  encontrar_duplicados: "Procurou duplicados",
  organizar_pasta: "Preparou organização",
  criar_pasta: "Preparou criação de pasta",
  renomear_arquivo: "Preparou renomeação",
  mover_arquivo: "Preparou movimentação",
  excluir_arquivo: "Preparou exclusão",
};

// ─── File icon helper ─────────────────────────────────────────────────────────

function FileIcon({ ext, className }: { ext: string; className?: string }) {
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(ext))
    return <FileImage className={className} />;
  if ([".pdf", ".doc", ".docx", ".txt", ".rtf"].includes(ext))
    return <FileText className={className} />;
  return <File className={className} />;
}

function isVisibleMentionFile(file: FileItem) {
  const normalizedName = file.name.trim().toLowerCase();
  return !file.isDirectory && !normalizedName.startsWith(".");
}

// ─── Pending file operation card (Gemini-initiated) ───────────────────────────

const PendingFileOpCard = ({ op }: { op: PendingFileOperation }) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);

  if (isDone) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
        <p className="text-[11px] text-emerald-700">{op.description} — concluído.</p>
      </div>
    );
  }

  if (isCancelled) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
        <XCircle className="size-3.5 shrink-0 text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground">Operação cancelada.</p>
      </div>
    );
  }

  const accentClass =
    op.type === "delete"
      ? "border-red-200 bg-red-50/60"
      : "border-primary/20 bg-primary/5";

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      if (op.type === "rename") await desktop().files.renameFile(op.filePath, op.newName!);
      else if (op.type === "move") await desktop().files.moveFile(op.filePath, op.destDirPath!);
      else if (op.type === "delete") await desktop().files.deleteFile(op.filePath);
      setIsDone(true);
      toast.success(op.description + " — concluído.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao executar operação.");
      setIsExecuting(false);
    }
  };

  return (
    <div className={`mt-3 rounded-xl border p-4 shadow-sm ${accentClass}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
        {op.type === "delete" ? "Exclusão pendente" : op.type === "rename" ? "Renomeação pendente" : "Movimentação pendente"}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{op.description}</p>

      {op.type === "rename" && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="font-mono bg-muted/50 rounded px-1.5 py-0.5">{op.fileName}</span>
          <MoveRight className="size-3" />
          <span className="font-mono bg-muted/50 rounded px-1.5 py-0.5">{op.newName}</span>
        </div>
      )}

      {op.type === "move" && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="font-mono bg-muted/50 rounded px-1.5 py-0.5">{op.fileName}</span>
          <MoveRight className="size-3" />
          <span className="font-mono bg-muted/50 rounded px-1.5 py-0.5">{op.destDirName}</span>
        </div>
      )}

      {op.type === "delete" && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <AlertTriangle className="size-3 shrink-0 text-red-500" />
          <p className="text-[11px] text-red-700">Esta ação é permanente e não pode ser desfeita.</p>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          onClick={handleExecute}
          disabled={isExecuting}
          variant={op.type === "delete" ? "destructive" : "default"}
          className="h-7 text-[11px] px-3"
        >
          {isExecuting ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
          Executar agora
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsCancelled(true)}
          disabled={isExecuting}
          className="h-7 text-[11px] px-3"
        >
          <XCircle className="size-3" />
          Cancelar
        </Button>
      </div>
    </div>
  );
};

// ─── Preview card (inline in chat) ────────────────────────────────────────────

const InlinePreviewCard = ({
  preview,
  onExecute,
  onCancel,
  isExecuting,
}: {
  preview: CommandPreview;
  onExecute: () => void;
  onCancel: () => void;
  isExecuting: boolean;
}) => (
  <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
          Prévia pendente
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground">{preview.headline}</p>
        <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
          {preview.explanation}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {preview.actions.map((action) => (
            <Badge key={action.id} variant="outline" className="bg-background text-[10px]">
              {action.label}
            </Badge>
          ))}
        </div>
        {preview.risks.length > 0 && (
          <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-500" />
            <p className="text-[11px] text-amber-700">{preview.risks[0]}</p>
          </div>
        )}
      </div>
    </div>
    <div className="mt-3 flex gap-2">
      <Button
        size="sm"
        onClick={onExecute}
        disabled={isExecuting}
        className="h-7 text-[11px] px-3"
      >
        {isExecuting ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <CheckCircle2 className="size-3" />
        )}
        Executar agora
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onCancel}
        disabled={isExecuting}
        className="h-7 text-[11px] px-3"
      >
        <XCircle className="size-3" />
        Cancelar
      </Button>
    </div>
  </div>
);

// ─── Message bubble ────────────────────────────────────────────────────────────

const MessageBubble = ({
  message,
  onExecutePreview,
  onCancelPreview,
  executingPreviewId,
}: {
  message: ConversationMessage;
  onExecutePreview: (preview: CommandPreview) => void;
  onCancelPreview: (preview: CommandPreview) => void;
  executingPreviewId: string | null;
}) => {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-[18px] rounded-br-[4px] bg-foreground px-4 py-3 shadow-sm">
          <p className="text-sm text-background leading-relaxed whitespace-pre-wrap">{message.text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
        <Bot className="size-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        {message.isLoading ? (
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            {message.text}
          </div>
        ) : (
          <>
            {message.toolsUsed && message.toolsUsed.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {message.toolsUsed.map((tool) => (
                  <span
                    key={tool}
                    className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    <Wrench className="size-2.5" />
                    {TOOL_LABELS[tool] ?? tool}
                  </span>
                ))}
              </div>
            )}
            <div className="rounded-[18px] rounded-bl-[4px] border border-border/50 bg-muted/20 px-4 py-3 shadow-sm">
              <p className="text-sm leading-relaxed text-foreground">
                {renderText(message.text)}
              </p>
            </div>
            {message.pendingPreviews?.map((preview) => (
              <InlinePreviewCard
                key={preview.draftId}
                preview={preview}
                onExecute={() => onExecutePreview(preview)}
                onCancel={() => onCancelPreview(preview)}
                isExecuting={executingPreviewId === preview.draftId}
              />
            ))}
            {message.pendingFileOps?.map((op) => (
              <PendingFileOpCard key={op.id} op={op} />
            ))}
          </>
        )}
        <p className="mt-1 text-[10px] text-muted-foreground/60">
          {new Date(message.timestamp).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
};

// ─── File chip (attached mention) ─────────────────────────────────────────────

const FileChip = ({
  file,
  onRemove,
  onRename,
  onMove,
  onDelete,
}: {
  file: FileItem;
  onRemove: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) => (
  <div className="group flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 pl-2 pr-1 py-1 text-[11px]">
    <FileIcon ext={file.extension} className="size-3 shrink-0 text-muted-foreground" />
    <span className="max-w-[120px] truncate font-medium text-foreground">{file.name}</span>
    <div className="ml-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      <button
        type="button"
        title="Renomear"
        onClick={onRename}
        className="flex size-4 items-center justify-center rounded-full hover:bg-blue-100 hover:text-blue-600 text-muted-foreground"
      >
        <Pencil className="size-2.5" />
      </button>
      <button
        type="button"
        title="Mover"
        onClick={onMove}
        className="flex size-4 items-center justify-center rounded-full hover:bg-violet-100 hover:text-violet-600 text-muted-foreground"
      >
        <MoveRight className="size-2.5" />
      </button>
      <button
        type="button"
        title="Excluir"
        onClick={onDelete}
        className="flex size-4 items-center justify-center rounded-full hover:bg-red-100 hover:text-red-600 text-muted-foreground"
      >
        <Trash2 className="size-2.5" />
      </button>
    </div>
    <button
      type="button"
      onClick={onRemove}
      className="ml-0.5 flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <XCircle className="size-3" />
    </button>
  </div>
);

// ─── @ Mention picker ─────────────────────────────────────────────────────────

const AtMentionPicker = ({
  query,
  files,
  highlightIndex,
  onSelect,
}: {
  query: string;
  files: FileItem[];
  highlightIndex: number;
  onSelect: (file: FileItem) => void;
}) => {
  const filtered = files
    .filter(
      (f) => isVisibleMentionFile(f) && f.name.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 8);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-50 rounded-xl border border-border/60 bg-popover shadow-lg overflow-hidden">
      <div className="px-3 py-1.5 border-b border-border/40">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          <AtSign className="size-2.5" />
          Mencionar arquivo
        </p>
      </div>
      <div className="max-h-52 overflow-y-auto py-1">
        {filtered.map((file, i) => (
          <button
            key={file.path}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(file);
            }}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
              i === highlightIndex ? "bg-accent" : "hover:bg-accent/50"
            }`}
          >
            <FileIcon ext={file.extension} className="size-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-foreground">{file.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">{file.directoryName}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Rename dialog ─────────────────────────────────────────────────────────────

const RenameDialog = ({
  file,
  onClose,
}: {
  file: FileItem;
  onClose: () => void;
}) => {
  const [newName, setNewName] = useState(file.name);
  const [isBusy, setIsBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newName === file.name) return;
    setIsBusy(true);
    try {
      await desktop().files.renameFile(file.path, newName.trim());
      toast.success(`Renomeado para "${newName.trim()}"`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao renomear.");
      setIsBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-background p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-foreground">Renomear arquivo</h3>
        <p className="mt-1 text-[11px] text-muted-foreground truncate">{file.path}</p>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Novo nome com extensão"
          />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isBusy} className="h-8 text-[12px]">
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isBusy || !newName.trim() || newName === file.name} className="h-8 text-[12px]">
              {isBusy ? <Loader2 className="size-3 animate-spin" /> : <Pencil className="size-3" />}
              Renomear
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Move dialog ──────────────────────────────────────────────────────────────

const MoveDialog = ({
  file,
  directories,
  onClose,
}: {
  file: FileItem;
  directories: AuthorizedDirectory[];
  onClose: () => void;
}) => {
  const [destId, setDestId] = useState(directories[0]?.id ?? "");
  const [isBusy, setIsBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dest = directories.find((d) => d.id === destId);
    if (!dest) return;
    setIsBusy(true);
    try {
      await desktop().files.moveFile(file.path, dest.path);
      toast.success(`"${file.name}" movido para "${dest.name}"`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao mover.");
      setIsBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-background p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-foreground">Mover arquivo</h3>
        <p className="mt-1 text-[11px] text-muted-foreground truncate">{file.name}</p>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Destino</label>
            <select
              value={destId}
              onChange={(e) => setDestId(e.target.value)}
              className="w-full rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {directories.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isBusy} className="h-8 text-[12px]">
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isBusy || !destId} className="h-8 text-[12px]">
              {isBusy ? <Loader2 className="size-3 animate-spin" /> : <MoveRight className="size-3" />}
              Mover
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Delete dialog ────────────────────────────────────────────────────────────

const DeleteDialog = ({
  file,
  onClose,
}: {
  file: FileItem;
  onClose: () => void;
}) => {
  const [isBusy, setIsBusy] = useState(false);

  const handleDelete = async () => {
    setIsBusy(true);
    try {
      await desktop().files.deleteFile(file.path);
      toast.success(`"${file.name}" excluído.`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir.");
      setIsBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-background p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-foreground">Excluir arquivo</h3>
        <p className="mt-2 text-[12px] text-muted-foreground leading-relaxed">
          Tem certeza que deseja excluir permanentemente{" "}
          <span className="font-semibold text-foreground">"{file.name}"</span>? Esta ação não pode ser desfeita.
        </p>
        <div className="mt-4 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <AlertTriangle className="size-3 shrink-0 text-amber-500" />
          <p className="text-[11px] text-amber-700">O arquivo será excluído permanentemente do disco.</p>
        </div>
        <div className="mt-4 flex gap-2 justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isBusy} className="h-8 text-[12px]">
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isBusy}
            className="h-8 text-[12px]"
          >
            {isBusy ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
            Excluir
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── @ detection helpers ──────────────────────────────────────────────────────

function getAtMention(
  value: string,
  cursorPos: number,
): { start: number; query: string } | null {
  const before = value.slice(0, cursorPos);
  const match = before.match(/@([^\s@]*)$/);
  if (!match) return null;
  return { start: before.length - match[0].length, query: match[1] };
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export const AssistantPage = () => {
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [executingPreviewId, setExecutingPreviewId] = useState<string | null>(null);
  const [legacyPreview, setLegacyPreview] = useState<CommandPreview | null>(null);
  const [legacyPreviewOpen, setLegacyPreviewOpen] = useState(false);
  const [isLegacyExecuting, setIsLegacyExecuting] = useState(false);

  // @ mention state
  const [atMentionQuery, setAtMentionQuery] = useState("");
  const [atMentionStart, setAtMentionStart] = useState(0);
  const [atMentionOpen, setAtMentionOpen] = useState(false);
  const [atPickerIndex, setAtPickerIndex] = useState(0);

  // File context state
  const [availableFiles, setAvailableFiles] = useState<FileItem[]>([]);
  const [availableDirs, setAvailableDirs] = useState<AuthorizedDirectory[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<FileItem[]>([]);

  // File action dialogs
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
  const [moveTarget, setMoveTarget] = useState<FileItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);

  const {
    conversationId,
    messages,
    lastResult,
    appendMessage,
    removeLoadingMessage,
    setResult,
    resetConversation,
  } = useAssistantStore();

  const fetchFiles = () => {
    desktop()
      .files.browse({ limit: 300 })
      .then((data) => {
        setAvailableFiles(data.files);
        setAvailableDirs(data.directories);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchFiles();
    window.addEventListener("focus", fetchFiles);
    return () => window.removeEventListener("focus", fetchFiles);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Filtered files for @ picker
  const filteredAtFiles = availableFiles
    .filter(
      (f) => isVisibleMentionFile(f) && f.name.toLowerCase().includes(atMentionQuery.toLowerCase()),
    )
    .slice(0, 8);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    const cursorPos = e.target.selectionStart ?? value.length;
    const atInfo = getAtMention(value, cursorPos);

    if (atInfo) {
      setAtMentionQuery(atInfo.query);
      setAtMentionStart(atInfo.start);
      setAtMentionOpen(true);
      setAtPickerIndex(0);
    } else {
      setAtMentionOpen(false);
    }

    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleFileSelect = (file: FileItem) => {
    const cursor = textareaRef.current?.selectionStart ?? input.length;
    const before = input.slice(0, atMentionStart);
    const after = input.slice(cursor);
    const newInput = `${before}@${file.name} ${after}`;
    setInput(newInput);

    setAttachedFiles((prev) =>
      prev.some((f) => f.path === file.path) ? prev : [...prev, file],
    );

    setAtMentionOpen(false);
    setAtMentionQuery("");

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const pos = before.length + 1 + file.name.length + 1;
        textareaRef.current.selectionStart = pos;
        textareaRef.current.selectionEnd = pos;
        textareaRef.current.focus();
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
      }
    });
  };

  const buildMessageWithContext = (text: string): string => {
    if (attachedFiles.length === 0) return text;
    const header = attachedFiles.map((f) => `- ${f.name}: ${f.path}`).join("\n");
    return `[Arquivos mencionados:\n${header}]\n\n${text}`;
  };

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setInput("");
    setIsSending(true);
    setAtMentionOpen(false);
    const filesForContext = [...attachedFiles];
    setAttachedFiles([]);

    const displayText = trimmed;
    const contextText =
      filesForContext.length > 0
        ? `[Arquivos mencionados:\n${filesForContext.map((f) => `- ${f.name}: ${f.path}`).join("\n")}]\n\n${trimmed}`
        : trimmed;

    appendMessage({
      id: crypto.randomUUID(),
      role: "user",
      text: displayText,
      timestamp: new Date().toISOString(),
    });

    appendMessage({
      id: crypto.randomUUID(),
      role: "assistant",
      text: "Pensando...",
      isLoading: true,
      timestamp: new Date().toISOString(),
    });

    try {
      const response = await desktop().assistant.chat(conversationId, contextText);

      removeLoadingMessage();

      appendMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        text: response.assistantText,
        toolsUsed: response.toolsUsed,
        pendingPreviews: response.pendingPreviews,
        pendingFileOps: response.pendingFileOps,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      removeLoadingMessage();
      const msg = error instanceof Error ? error.message : "Falha ao processar sua mensagem.";
      toast.error(msg);
      appendMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        text: `Ocorreu um erro: ${msg}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
      fetchFiles();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (atMentionOpen) {
      if (e.key === "Escape") {
        e.preventDefault();
        setAtMentionOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAtPickerIndex((i) => Math.min(i + 1, filteredAtFiles.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAtPickerIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && filteredAtFiles[atPickerIndex]) {
        e.preventDefault();
        handleFileSelect(filteredAtFiles[atPickerIndex]);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const handleExecutePreview = async (preview: CommandPreview) => {
    setExecutingPreviewId(preview.draftId);
    try {
      const result = await desktop().assistant.executeDraft(preview.draftId);
      setResult(result);
      toast.success(result.summary);
      appendMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        text: `Concluído: ${result.summary} (${result.affectedFiles.length} arquivo(s) afetado(s)).`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao executar.");
    } finally {
      setExecutingPreviewId(null);
    }
  };

  const handleCancelPreview = async (preview: CommandPreview) => {
    await desktop().assistant.cancelDraft(preview.draftId);
    appendMessage({
      id: crypto.randomUUID(),
      role: "assistant",
      text: "Ação cancelada pelo usuário.",
      timestamp: new Date().toISOString(),
    });
  };

  const handleLegacyExecute = async () => {
    if (!legacyPreview) return;
    setIsLegacyExecuting(true);
    try {
      const result = await desktop().assistant.executeDraft(legacyPreview.draftId);
      setResult(result);
      setLegacyPreview(null);
      setLegacyPreviewOpen(false);
      toast.success(result.summary);
      appendMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        text: `Concluído: ${result.summary}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao executar.");
    } finally {
      setIsLegacyExecuting(false);
    }
  };

  return (
    <>
      <AppShell
        title="Assistente Inteligente"
        subtitle="Converse em linguagem natural — use @ para mencionar arquivos e acionar edição, renomeação ou exclusão."
        inspector={
          <div className="flex h-full flex-col gap-4">
            <div>
              <Badge variant="outline" className="bg-white text-[9px] px-1.5 py-0">
                Motor IA
              </Badge>
              <h3 className="mt-2.5 text-sm font-semibold tracking-tight text-foreground">
                Gemini 2.5 Flash
              </h3>
              <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
                Function calling com ferramentas de arquivo. Use{" "}
                <span className="font-mono text-primary">@</span> para mencionar arquivos e acionar operações.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetConversation();
                setAttachedFiles([]);
              }}
              className="w-full h-8 text-[12px] gap-1.5"
            >
              <RefreshCw className="size-3" />
              Nova conversa
            </Button>

            {lastResult && (
              <Card className="shadow-sm border-border/50">
                <CardHeader className="p-3 pb-1.5">
                  <CardTitle className="text-xs">Última execução</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                    <Badge
                      variant={lastResult.status === "completed" ? "success" : "secondary"}
                      className="text-[9px]"
                    >
                      {lastResult.status}
                    </Badge>
                    <p className="mt-1.5 text-[11px] font-medium text-foreground">
                      {lastResult.summary}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {lastResult.affectedFiles.length} arquivo(s) afetado(s)
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="shadow-sm border-border/50">
              <CardHeader className="p-3 pb-1.5">
                <CardTitle className="text-xs">Sugestões rápidas</CardTitle>
                <CardDescription className="text-[10px]">
                  Clique para preencher o campo de mensagem.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5 p-3 pt-0">
                {QUICK_SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setInput(s.prompt)}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-left transition-colors hover:bg-muted/50"
                  >
                    <span className="text-[11px] font-medium text-foreground">{s.label}</span>
                    <ChevronRight className="size-3 text-muted-foreground" />
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        }
      >
        {/* Chat container */}
        <div className="flex flex-col" style={{ height: "calc(100vh - 185px)" }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="flex flex-col gap-5 py-2">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onExecutePreview={handleExecutePreview}
                  onCancelPreview={handleCancelPreview}
                  executingPreviewId={executingPreviewId}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Suggestion chips (first message only) */}
          {!input && messages.length <= 1 && (
            <div className="flex flex-wrap gap-1.5 py-2">
              {QUICK_SUGGESTIONS.slice(0, 3).map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => handleSend(s.prompt)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <Sparkles className="size-2.5" />
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="flex-shrink-0 pt-2 border-t border-border/40">
            {/* Attached file chips */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {attachedFiles.map((file) => (
                  <FileChip
                    key={file.path}
                    file={file}
                    onRemove={() =>
                      setAttachedFiles((prev) => prev.filter((f) => f.path !== file.path))
                    }
                    onRename={() => setRenameTarget(file)}
                    onMove={() => setMoveTarget(file)}
                    onDelete={() => setDeleteTarget(file)}
                  />
                ))}
              </div>
            )}

            {/* Input wrapper with @ picker */}
            <div className="relative" ref={inputWrapperRef}>
              {atMentionOpen && (
                <AtMentionPicker
                  query={atMentionQuery}
                  files={availableFiles}
                  highlightIndex={atPickerIndex}
                  onSelect={handleFileSelect}
                />
              )}

              <div className="flex items-end gap-2 rounded-2xl border border-border/60 bg-muted/20 p-2 shadow-sm focus-within:border-primary/40 focus-within:bg-background transition-colors">
                <button
                  type="button"
                  title="Mencionar arquivo (@)"
                  onClick={() => {
                    setInput((v) => v + "@");
                    setAtMentionQuery("");
                    setAtMentionStart(input.length);
                    setAtMentionOpen(true);
                    setAtPickerIndex(0);
                    textareaRef.current?.focus();
                  }}
                  className="mb-1 flex size-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <AtSign className="size-3.5" />
                </button>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Mensagem… (@ para mencionar arquivo, Enter para enviar)"
                  rows={1}
                  className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                  style={{ maxHeight: "120px", overflowY: "auto" }}
                  disabled={isSending}
                />
                <Button
                  onClick={() => handleSend(input)}
                  disabled={isSending || !input.trim()}
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-xl"
                >
                  {isSending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
              Ações sensíveis sempre exibem prévia antes de executar
            </p>
          </div>
        </div>
      </AppShell>

      {/* Legacy preview dialog */}
      <PreviewDialog
        preview={legacyPreview}
        open={legacyPreviewOpen}
        onOpenChange={setLegacyPreviewOpen}
        onConfirm={handleLegacyExecute}
        onCancel={() => {
          if (legacyPreview) desktop().assistant.cancelDraft(legacyPreview.draftId);
          setLegacyPreview(null);
          setLegacyPreviewOpen(false);
        }}
        isExecuting={isLegacyExecuting}
      />

      {/* File action dialogs */}
      {renameTarget && (
        <RenameDialog
          file={renameTarget}
          onClose={() => setRenameTarget(null)}
        />
      )}
      {moveTarget && (
        <MoveDialog
          file={moveTarget}
          directories={availableDirs}
          onClose={() => setMoveTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteDialog
          file={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};
