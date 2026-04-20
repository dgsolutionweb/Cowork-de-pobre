import { useEffect, useState } from "react";
import type { DashboardData, ProjectSummary, Connector } from "@shared/types";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  FolderOpenDot,
  History,
  Workflow,
  XCircle,
  Layers3,
  Link as LinkIcon,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
  const [connectorItems, setConnectorItems] = useState<{remotePath: string}[]>([]);

  useEffect(() => {
    desktop().dashboard.getOverview().then(setData);
    desktop().projects.list().then(setProjects);
    desktop().connectors.list().then(setConnectors).catch(() => {});
  }, []);

  const today = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <AppShell
      title="Painel Operacional"
      subtitle="Visão consolidada das rotinas locais, diretórios autorizados e histórico de execução."
      inspector={
        <div className="flex h-full flex-col gap-4">
          <div>
            <Badge variant="outline" className="bg-card text-[9px] px-1.5 py-0">
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
              { label: "Explorar arquivos", href: "/files", icon: FolderOpenDot },
              { label: "Acessar projetos", href: "/projects", icon: Layers3 },
              { label: "Gerir conectores", href: "/connectors", icon: LinkIcon },
            ].map(({ label, href, icon: Icon }) => (
              <Link key={href} to={href}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-card px-3 py-2 text-left shadow-sm transition-colors hover:bg-muted/40"
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

          {/* Active Connectors */}
          <Card className="shadow-sm border-border/50">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs">Fontes de Dados</CardTitle>
              <CardDescription className="text-[10px]">
                {connectors.filter((c) => c.status === "connected").length ?? 0} conectada(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 p-3 pt-0">
              {connectors.map((connector) => (
                <div
                  key={connector.id}
                  onClick={async () => {
                    setSelectedConnector(connector);
                    setConnectorItems([]);
                    if (connector.status === "connected") {
                      try {
                        const items = await desktop().connectors.items(connector.id);
                        setConnectorItems(items);
                      } catch {
                        // ignore
                      }
                    }
                  }}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 transition-colors hover:bg-muted/40 cursor-pointer"
                >
                  <p className="truncate text-[11px] font-medium text-foreground">
                    {connector.name}
                  </p>
                  <Badge
                    variant={connector.status === "connected" ? "success" : "secondary"}
                    className="shrink-0 text-[9px] px-1.5 py-0 h-4"
                  >
                    {connector.status === "connected" ? "Online" : "Pausado"}
                  </Badge>
                </div>
              ))}
              {!connectors.length && (
                <p className="text-[11px] text-muted-foreground">Nenhum conector ainda.</p>
              )}
            </CardContent>
          </Card>
        </div>
      }
    >
      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Projetos Ativos"
          value={String(projects.filter(p => p.status === 'active').length ?? 0)}
          hint="Workspaces RAG dedicados"
          icon={Layers3}
          accent="emerald"
        />
        <MetricCard
          label="Conectores de Nuvem"
          value={String(connectors.length ?? 0)}
          hint="Fontes de dados sincronizadas"
          icon={LinkIcon}
          accent="blue"
        />
        <MetricCard
          label="Pastas Autorizadas"
          value={String(data?.metrics.authorizedDirectoriesCount ?? 0)}
          hint="Escopo local liberado"
          icon={FolderOpenDot}
          accent="violet"
        />
        <MetricCard
          label="Ações de Assistente"
          value={String(data?.metrics.executedTasksCount ?? 0)}
          hint="Historico de atividades auditadas"
          icon={Activity}
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
                  <Badge variant="outline" className="shrink-0 bg-card text-[9px] px-1.5 py-0 h-4">
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

      {/* Stats row */}
      {data && (data.activitySeries.some((p) => p.count > 0) || data.typeDistribution.length > 0) && (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {/* Activity chart */}
          <Card className="shadow-sm border-border/60">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-sm">Atividade (7 dias)</CardTitle>
              <CardDescription className="text-[11px]">Execuções confirmadas por dia.</CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {data.activitySeries.some((p) => p.count > 0) ? (() => {
                const max = Math.max(...data.activitySeries.map((p) => p.count), 1);
                return (
                  <div className="flex items-end gap-1.5 h-20">
                    {data.activitySeries.map((point) => (
                      <div key={point.date} className="flex flex-1 flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t-sm bg-primary/70 transition-all"
                          style={{ height: `${Math.max(4, (point.count / max) * 64)}px` }}
                          title={`${point.count} execução(ões)`}
                        />
                        <span className="text-[9px] text-muted-foreground/60">
                          {new Date(point.date).toLocaleDateString("pt-BR", { weekday: "narrow" })}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })() : (
                <p className="py-8 text-center text-[12px] text-muted-foreground">Nenhuma execução nos últimos 7 dias.</p>
              )}
            </CardContent>
          </Card>

          {/* Type distribution */}
          <Card className="shadow-sm border-border/60">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-sm">Tipos afetados</CardTitle>
              <CardDescription className="text-[11px]">Distribuição por extensão.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 p-5 pt-0">
              {data.typeDistribution.length > 0 ? (() => {
                const max = Math.max(...data.typeDistribution.map((t) => t.count), 1);
                return data.typeDistribution.map((t) => (
                  <div key={t.label} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-[11px] font-medium text-muted-foreground">{t.label}</span>
                    <div className="flex-1 rounded-full bg-muted/40 h-2">
                      <div
                        className="h-2 rounded-full bg-primary/60"
                        style={{ width: `${(t.count / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 shrink-0 text-right text-[11px] text-muted-foreground">{t.count}</span>
                  </div>
                ));
              })() : (
                <p className="py-6 text-center text-[12px] text-muted-foreground">Sem dados de tipo ainda.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sync Items Dialog */}
      <Dialog open={!!selectedConnector} onOpenChange={(open) => !open && setSelectedConnector(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Itens Sincronizados</DialogTitle>
            <DialogDescription>
              Conteúdo indexado a partir da fonte ({selectedConnector?.name}). Copie ou arraste o nome do arquivo para o Assistente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2 mt-2">
            {connectorItems.length > 0 ? (
              connectorItems.map((item, idx) => (
                <div key={idx} className="text-xs p-2 rounded-md bg-muted/50 border border-border/50 text-foreground break-all select-all hover:bg-muted font-mono cursor-pointer" title={item.remotePath} onClick={() => {
                  navigator.clipboard.writeText(`@${item.remotePath}`);
                  alert("Nome do arquivo copiado! Cole no chat do Assistente para invocá-lo como contexto.");
                }}>
                  {item.remotePath}
                </div>
              ))
            ) : selectedConnector?.status !== "connected" ? (
              <p className="text-xs text-muted-foreground italic text-center py-4">Conector não está online.</p>
            ) : (
              <p className="text-xs text-muted-foreground italic text-center py-4">Carregando itens ou nenhum arquivo sincronizado...</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};
