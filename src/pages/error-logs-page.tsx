import { useEffect, useState } from "react";
import type { ErrorLogEntry, ErrorSource } from "@shared/types";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { AppShell } from "@/layouts/app-shell";
import { desktop } from "@/services/desktop";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SOURCE_COLORS: Record<ErrorSource, string> = {
  scheduler: "text-amber-500",
  automation: "text-orange-500",
  ipc: "text-blue-500",
  gemini: "text-violet-500",
  filesystem: "text-rose-500",
  vault: "text-emerald-500",
  watcher: "text-cyan-500",
  unknown: "text-muted-foreground",
};

const SOURCE_LABELS: Record<ErrorSource, string> = {
  scheduler: "Agendador",
  automation: "Automação",
  ipc: "IPC",
  gemini: "Gemini",
  filesystem: "Sistema de arquivos",
  vault: "Vault",
  watcher: "Watcher",
  unknown: "Desconhecido",
};

export const ErrorLogsPage = () => {
  const [logs, setLogs] = useState<ErrorLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setLogs(await desktop().errors.list());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleClear = async () => {
    setClearing(true);
    try {
      await desktop().errors.clear();
      toast.success("Logs limpos.");
      setLogs([]);
    } catch {
      toast.error("Erro ao limpar logs.");
    } finally {
      setClearing(false);
    }
  };

  const handleExport = async () => {
    try {
      const text = await desktop().errors.export();
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cowork-errors-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Log exportado.");
    } catch {
      toast.error("Erro ao exportar logs.");
    }
  };

  const bySources = logs.reduce<Record<string, number>>((acc, log) => {
    acc[log.source] = (acc[log.source] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AppShell
      title="Logs de Erro"
      subtitle="Rastreamento de erros internos categorizados por origem."
      inspector={
        <div className="flex h-full flex-col gap-4">
          <div>
            <Badge variant="outline" className="bg-card text-[9px] px-1.5 py-0">Diagnóstico</Badge>
            <h3 className="mt-2.5 text-sm font-semibold tracking-tight text-foreground">Erros registrados</h3>
            <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
              Erros são capturados automaticamente pelos serviços internos.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Button variant="outline" onClick={load} disabled={loading} className="gap-2 h-9">
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={logs.length === 0} className="gap-2 h-9">
              <Download className="size-3.5" />
              Exportar .txt
            </Button>
            <Button
              variant="destructive"
              onClick={handleClear}
              disabled={clearing || logs.length === 0}
              className="gap-2 h-9"
            >
              {clearing ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Limpar tudo
            </Button>
          </div>

          {Object.keys(bySources).length > 0 && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="p-3 pb-1.5">
                <CardTitle className="text-xs">Por origem</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5 p-3 pt-0">
                {Object.entries(bySources).map(([src, count]) => (
                  <div key={src} className="flex items-center justify-between text-[11px]">
                    <span className={SOURCE_COLORS[src as ErrorSource]}>
                      {SOURCE_LABELS[src as ErrorSource] ?? src}
                    </span>
                    <span className="font-semibold text-foreground">{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-card shadow-sm">
            <CheckCircle2 className="size-6 text-emerald-500" />
          </div>
          <p className="mt-4 text-base font-medium text-foreground">Nenhum erro registrado</p>
          <p className="mt-1.5 max-w-[280px] text-[13px] text-muted-foreground">
            O sistema está operando normalmente.
          </p>
        </div>
      ) : (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm">Erros recentes</CardTitle>
              <span className="text-[11px] text-muted-foreground">{logs.length} registro(s)</span>
            </div>
            <CardDescription className="text-[11px]">Clique em um item para ver detalhes.</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="flex flex-col divide-y divide-border/40">
              {logs.map((log) => (
                <div key={log.id} className="py-3 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                    className="flex w-full items-start gap-3 text-left"
                  >
                    <AlertCircle className={`mt-0.5 size-3.5 shrink-0 ${SOURCE_COLORS[log.source]}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${SOURCE_COLORS[log.source]}`}>
                          {SOURCE_LABELS[log.source]}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          {format(new Date(log.createdAt), "dd/MM HH:mm:ss", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12px] font-medium text-foreground">{log.message}</p>
                      {log.context && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{log.context}</p>
                      )}
                    </div>
                  </button>

                  {expanded === log.id && log.stack && (
                    <div className="mt-2 ml-6 rounded-lg border border-border/40 bg-muted/30 p-3">
                      <pre className="whitespace-pre-wrap text-[10px] text-muted-foreground font-mono leading-relaxed">
                        {log.stack}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
};
