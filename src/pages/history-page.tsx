import { useEffect, useMemo, useState } from "react";
import type { HistoryEntry, TaskStatus } from "@shared/types";
import {
  CheckCircle2,
  Clock,
  Filter,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppShell } from "@/layouts/app-shell";
import { desktop } from "@/services/desktop";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// ─── Intent labels ────────────────────────────────────────────────────────────

const INTENT_LABELS: Record<string, string> = {
  organize_downloads: "Organizar downloads",
  list_pdfs: "Listar PDFs",
  move_images: "Mover imagens",
  rename_files: "Renomear arquivos",
  create_client_folder: "Criar pasta cliente",
  find_duplicates: "Buscar duplicados",
  show_recent_files: "Arquivos recentes",
  unknown: "Desconhecido",
};

// ─── Status styles ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<
  string,
  { label: string; icon: typeof CheckCircle2; dot: string; text: string }
> = {
  completed: {
    label: "Concluída",
    icon: CheckCircle2,
    dot: "bg-emerald-500",
    text: "text-emerald-600",
  },
  failed: {
    label: "Falhou",
    icon: XCircle,
    dot: "bg-rose-500",
    text: "text-rose-500",
  },
  cancelled: {
    label: "Cancelada",
    icon: XCircle,
    dot: "bg-muted-foreground/40",
    text: "text-muted-foreground",
  },
};

// ─── Filter chips ─────────────────────────────────────────────────────────────

const STATUS_FILTERS: Array<{ label: string; value: TaskStatus | "all" }> = [
  { label: "Todos", value: "all" },
  { label: "Concluídas", value: "completed" },
  { label: "Falhas", value: "failed" },
  { label: "Canceladas", value: "cancelled" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const HistoryPage = () => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");

  useEffect(() => {
    desktop().history.list().then(setEntries);
  }, []);

  const filtered = useMemo(
    () => (statusFilter === "all" ? entries : entries.filter((e) => e.status === statusFilter)),
    [entries, statusFilter],
  );

  const counts = useMemo(
    () => ({
      completed: entries.filter((e) => e.status === "completed").length,
      failed: entries.filter((e) => e.status === "failed").length,
      cancelled: entries.filter((e) => e.status === "cancelled").length,
    }),
    [entries],
  );

  return (
    <AppShell
      title="Histórico e Auditoria"
      subtitle="Todas as execuções confirmadas, registradas localmente com intenção, status e arquivos afetados."
      inspector={
        <div className="flex h-full flex-col gap-4">
          <div>
            <Badge variant="outline" className="bg-white text-[9px] px-1.5 py-0">
              SQLite local
            </Badge>
            <h3 className="mt-2.5 text-sm font-semibold tracking-tight text-foreground">
              Rastreabilidade
            </h3>
            <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
              Cada tarefa gera um registro auditável e pronto para reexecução futura.
            </p>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Total", value: entries.length, color: "text-foreground" },
              { label: "Concluídas", value: counts.completed, color: "text-emerald-600" },
              { label: "Falhas", value: counts.failed, color: "text-rose-500" },
              { label: "Canceladas", value: counts.cancelled, color: "text-muted-foreground" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-lg border border-border/50 bg-white p-2.5 text-center shadow-sm"
              >
                <p className={`text-lg font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          <Card className="shadow-sm border-border/50">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs">Campos auditados</CardTitle>
              <CardDescription className="text-[10px]">
                O que é persistido neste release.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 p-3 pt-0 text-[11px] text-muted-foreground">
              {[
                "Comando original digitado pelo usuário.",
                "Intenção detectada pelo parser ou Gemini.",
                "Status, horário e resultado resumido.",
                "Lista dos arquivos impactados (serializada).",
              ].map((item) => (
                <p key={item} className="leading-relaxed">
                  · {item}
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
      }
    >
      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="size-3.5 text-muted-foreground" />
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
              statusFilter === f.value
                ? "border-foreground bg-foreground text-background"
                : "border-border/60 bg-white text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            }`}
          >
            {f.label}
            {f.value !== "all" && (
              <span className="ml-1.5 opacity-60">
                {f.value === "completed"
                  ? counts.completed
                  : f.value === "failed"
                    ? counts.failed
                    : counts.cancelled}
              </span>
            )}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {filtered.length} evento(s)
        </span>
      </div>

      {/* Table */}
      <Card className="mt-3 shadow-sm border-border/60">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-sm">Eventos registrados</CardTitle>
          <CardDescription className="text-[11px]">
            Ações e análises capturadas com confirmação do usuário.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {filtered.length ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Comando
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Intenção
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Itens
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Executado em
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => {
                  const st = STATUS_STYLES[entry.status] ?? STATUS_STYLES.completed;
                  const StatusIcon = st.icon;
                  return (
                    <TableRow
                      key={entry.id}
                      className="border-border/40 transition-colors hover:bg-muted/30"
                    >
                      <TableCell className="max-w-[200px]">
                        <span
                          className="block truncate text-[12px] font-medium text-foreground"
                          title={entry.commandText}
                        >
                          {entry.commandText}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {INTENT_LABELS[entry.intent] ?? entry.intent}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`flex items-center gap-1.5 text-[11px] font-medium ${st.text}`}>
                          <span className={`size-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-[12px] text-muted-foreground">
                        {entry.affectedFiles.length}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {entry.executedAt
                          ? format(new Date(entry.executedAt), "dd MMM yyyy • HH:mm", {
                              locale: ptBR,
                            })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="size-10 text-muted-foreground/30" />
              <p className="mt-4 text-sm font-medium text-muted-foreground">
                {statusFilter === "all"
                  ? "Nenhuma execução registrada"
                  : `Nenhuma execução com status "${STATUS_FILTERS.find((f) => f.value === statusFilter)?.label}"`}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground/70">
                Use o Assistente para executar tarefas com confirmação.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
};
