import { useEffect, useState } from "react";
import type { VaultEntry } from "@shared/types";
import {
  ArchiveRestore,
  FileX2,
  Loader2,
  ShieldCheck,
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const VaultPage = () => {
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [purgingAll, setPurgingAll] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setEntries(await desktop().vault.list());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRestore = async (entry: VaultEntry) => {
    setBusyId(entry.id);
    try {
      await desktop().vault.restore(entry.id);
      toast.success(`"${entry.originalName}" restaurado.`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao restaurar.");
    } finally {
      setBusyId(null);
    }
  };

  const handlePurge = async (entry: VaultEntry) => {
    setBusyId(entry.id);
    try {
      await desktop().vault.purge(entry.id);
      toast.success(`"${entry.originalName}" excluído permanentemente.`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir.");
    } finally {
      setBusyId(null);
    }
  };

  const handlePurgeAll = async () => {
    setPurgingAll(true);
    try {
      const result = await desktop().vault.purgeAll();
      toast.success(`${result.purged} arquivo(s) excluídos permanentemente.`);
      load();
    } catch {
      toast.error("Erro ao limpar vault.");
    } finally {
      setPurgingAll(false);
    }
  };

  const totalSize = entries.reduce((acc, e) => acc + e.size, 0);

  return (
    <AppShell
      title="Vault"
      subtitle="Arquivos movidos para exclusão segura. Restaure ou elimine permanentemente."
      inspector={
        <div className="flex h-full flex-col gap-4">
          <div>
            <Badge variant="outline" className="bg-card text-[9px] px-1.5 py-0">Lixeira lógica</Badge>
            <h3 className="mt-2.5 text-sm font-semibold tracking-tight text-foreground">Exclusão segura</h3>
            <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
              Arquivos aqui não foram permanentemente removidos. Você pode restaurar ou purgar.
            </p>
          </div>

          <Card className="border-border/50 shadow-sm">
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">Itens no vault</span>
                <span className="font-semibold text-foreground">{entries.length}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">Espaço ocupado</span>
                <span className="font-semibold text-foreground">{formatBytes(totalSize)}</span>
              </div>
            </CardContent>
          </Card>

          {entries.length > 0 && (
            <Button
              variant="destructive"
              onClick={handlePurgeAll}
              disabled={purgingAll}
              className="w-full gap-2 h-9"
            >
              {purgingAll ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Purgar tudo
            </Button>
          )}

          <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <ShieldCheck className="size-3.5 text-primary" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Privacidade</p>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Os arquivos no vault ficam na pasta local do app — nenhum dado sai da máquina.
            </p>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-card shadow-sm">
            <ShieldCheck className="size-6 text-muted-foreground/50" />
          </div>
          <p className="mt-4 text-base font-medium text-foreground">Vault vazio</p>
          <p className="mt-1.5 max-w-[280px] text-[13px] text-muted-foreground leading-relaxed">
            Arquivos excluídos com modo de exclusão segura aparecerão aqui.
          </p>
        </div>
      ) : (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-sm">Arquivos no vault</CardTitle>
            <CardDescription className="text-[11px]">{entries.length} item(s) — {formatBytes(totalSize)} total</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="flex flex-col divide-y divide-border/40">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/30">
                    <FileX2 className="size-4 text-muted-foreground/60" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{entry.originalName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{entry.originalPath}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                      {format(new Date(entry.deletedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · {formatBytes(entry.size)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(entry)}
                      disabled={busyId === entry.id}
                      className="h-7 gap-1.5 text-[11px]"
                    >
                      {busyId === entry.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <ArchiveRestore className="size-3" />
                      )}
                      Restaurar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePurge(entry)}
                      disabled={busyId === entry.id}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title="Excluir permanentemente"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
};
