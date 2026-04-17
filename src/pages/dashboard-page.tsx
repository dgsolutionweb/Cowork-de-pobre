import { useEffect, useState } from "react";
import type { DashboardData } from "@shared/types";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  FolderKanban,
  FolderOpenDot,
  History,
  Workflow,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { AppShell } from "@/layouts/app-shell";
import { desktop } from "@/services/desktop";
import { MetricCard } from "@/components/app/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_STYLES: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  completed: {
    label: "Concluída",
    icon: CheckCircle2,
    className: "text-emerald-600",
  },
  failed: {
    label: "Falhou",
    icon: XCircle,
    className: "text-rose-500",
  },
  cancelled: {
    label: "Cancelada",
    icon: XCircle,
    className: "text-muted-foreground",
  },
};

export const DashboardPage = () => {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    desktop().dashboard.getOverview().then(setData);
  }, []);

  const today = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <AppShell
      title="Painel Operacional"
      subtitle="Visão consolidada das rotinas locais, diretórios autorizados e histórico de execução."
      inspector={
        <div className="flex h-full flex-col gap-4">
          <div>
            <Badge variant="outline" className="bg-white text-[9px] px-1.5 py-0">
              Ambiente
            </Badge>
            <h3 className="mt-2.5 text-sm font-semibold tracking-tight text-foreground">
              Situação atual
            </h3>
            <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed capitalize">
              {today}
            </p>
          </div>

          {/* Quick actions */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
              Acesso rápido
            </p>
            {[
              { label: "Abrir assistente", href: "/assistant", icon: Bot },
              { label: "Explorar arquivos", href: "/files", icon: FolderKanban },
              { label: "Ver rotinas", href: "/tasks", icon: Workflow },
            ].map(({ label, href, icon: Icon }) => (
              <Link key={href} to={href}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-white px-3 py-2 text-left shadow-sm transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="size-3.5 text-muted-foreground" />
                    <span className="text-[12px] font-medium text-foreground">{label}</span>
                  </div>
                  <ArrowRight className="size-3 text-muted-foreground/50" />
                </button>
              </Link>
            ))}
          </div>

          {/* Recent automations */}
          <Card className="shadow-sm border-border/50">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs">Automações</CardTitle>
              <CardDescription className="text-[10px]">
                {data?.recentAutomations.filter((a) => a.enabled).length ?? 0} ativa(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 p-3 pt-0">
              {data?.recentAutomations.map((automation) => (
                <div
                  key={automation.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 transition-colors hover:bg-muted/40"
                >
                  <p className="truncate text-[11px] font-medium text-foreground">
                    {automation.name}
                  </p>
                  <Badge
                    variant={automation.enabled ? "success" : "secondary"}
                    className="shrink-0 text-[9px] px-1.5 py-0 h-4"
                  >
                    {automation.enabled ? "Ativa" : "Pausada"}
                  </Badge>
                </div>
              ))}
              {!data?.recentAutomations.length && (
                <p className="text-[11px] text-muted-foreground">Nenhuma automação ainda.</p>
              )}
            </CardContent>
          </Card>
        </div>
      }
    >
      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Arquivos organizados"
          value={String(data?.metrics.organizedFilesCount ?? 0)}
          hint="Movidos, renomeados ou categorizados"
          icon={FolderOpenDot}
          accent="emerald"
        />
        <MetricCard
          label="Tarefas executadas"
          value={String(data?.metrics.executedTasksCount ?? 0)}
          hint="Confirmadas e registradas em SQLite"
          icon={Activity}
          accent="blue"
        />
        <MetricCard
          label="Automações ativas"
          value={String(data?.metrics.activeAutomationsCount ?? 0)}
          hint="Prontas para execução recorrente"
          icon={Workflow}
          accent="violet"
        />
        <MetricCard
          label="Pastas autorizadas"
          value={String(data?.metrics.authorizedDirectoriesCount ?? 0)}
          hint="Escopo local liberado para acesso"
          icon={History}
          accent="amber"
        />
      </div>

      {/* Content grid */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        {/* Recent history */}
        <Card className="shadow-sm border-border/60">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm">Ações recentes</CardTitle>
                <CardDescription className="mt-0.5 text-[11px]">
                  Execuções confirmadas com status e volume afetado.
                </CardDescription>
              </div>
              <Link to="/history">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px] text-muted-foreground">
                  Ver todas
                  <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {data?.recentHistory.length ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Comando
                    </TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Itens
                    </TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Quando
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentHistory.map((entry) => {
                    const status = STATUS_STYLES[entry.status] ?? STATUS_STYLES.completed;
                    const StatusIcon = status.icon;
                    return (
                      <TableRow
                        key={entry.id}
                        className="border-border/40 transition-colors hover:bg-muted/30"
                      >
                        <TableCell className="max-w-[200px] truncate text-[12px] font-medium text-foreground">
                          {entry.commandText}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${status.className}`}>
                            <StatusIcon className="size-3" />
                            {status.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-[12px] text-muted-foreground">
                          {entry.affectedFiles.length}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">
                          {format(new Date(entry.createdAt), "dd MMM • HH:mm", {
                            locale: ptBR,
                          })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Clock className="size-8 text-muted-foreground/30" />
                <p className="mt-3 text-sm font-medium text-muted-foreground">
                  Nenhuma ação registrada
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground/70">
                  Use o Assistente para executar tarefas.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Authorized directories */}
        <Card className="shadow-sm border-border/60">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm">Escopo autorizado</CardTitle>
                <CardDescription className="mt-0.5 text-[11px]">
                  Diretórios liberados para leitura e escrita.
                </CardDescription>
              </div>
              <Link to="/files">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px] text-muted-foreground">
                  Gerir
                  <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 p-5 pt-0">
            {data?.recentDirectories.map((directory) => (
              <div
                key={directory.id}
                className="rounded-lg border border-border/60 bg-muted/20 p-2.5 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-medium text-foreground">{directory.name}</p>
                  <Badge variant="outline" className="shrink-0 bg-white text-[9px] px-1.5 py-0 h-4">
                    Ativa
                  </Badge>
                </div>
                <p
                  className="mt-0.5 truncate text-[10px] text-muted-foreground"
                  title={directory.path}
                >
                  {directory.path}
                </p>
              </div>
            ))}
            {!data?.recentDirectories.length && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <p className="text-[12px] text-muted-foreground">
                  Nenhum diretório autorizado.
                </p>
                <Link to="/settings">
                  <Button variant="outline" size="sm" className="mt-3 h-7 text-[11px]">
                    Adicionar pasta
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};
