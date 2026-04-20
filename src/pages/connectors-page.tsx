import { useEffect, useState } from "react";
import {
  Plug, Plus, Github, HardDrive, Cpu, TerminalSquare,
  AlertCircle, RefreshCw, Trash2, X, ExternalLink, Loader2,
} from "lucide-react";
import { AppShell } from "@/layouts/app-shell";
import { desktop } from "@/services/desktop";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { ConnectorConfig } from "@shared/types";

// ─── Connector catalogue ──────────────────────────────────────────────────────

const CONNECTOR_TYPES = [
  {
    id: "github" as const,
    name: "GitHub",
    description: "Autorize via OAuth para acessar repositórios sem expor tokens manualmente.",
    icon: Github,
    color: "bg-neutral-800 text-white",
    oauth: true,
  },
  {
    id: "google_drive" as const,
    name: "Google Drive",
    description: "Autorize via OAuth para sincronizar documentos do seu Google Drive.",
    icon: HardDrive,
    color: "bg-blue-600 text-white",
    oauth: true,
  },
  {
    id: "mcp" as const,
    name: "MCP Client",
    description: "Conecte a Model Context Protocol Servers locais ou remotos.",
    icon: Cpu,
    color: "bg-primary text-primary-foreground",
    oauth: false,
  },
  {
    id: "local_plugin" as const,
    name: "Local Plugin",
    description: "Carregue extensões Node.js isoladas para expandir capacidades do Cowork.",
    icon: TerminalSquare,
    color: "bg-emerald-600 text-white",
    oauth: false,
  },
] as const;

type ConnectorId = (typeof CONNECTOR_TYPES)[number]["id"];
type Step = "idle" | "config" | "waiting";

// ─── OAuth config per provider ────────────────────────────────────────────────

const OAUTH_META: Record<
  "github" | "google_drive",
  {
    label: string;
    clientIdPlaceholder: string;
    clientSecretPlaceholder: string;
    helpText: React.ReactNode;
    buttonLabel: string;
    buttonClass: string;
  }
> = {
  github: {
    label: "GitHub OAuth",
    clientIdPlaceholder: "Ov23li...",
    clientSecretPlaceholder: "ghsec_...",
    helpText: (
      <>
        Crie em{" "}
        <a
          href="#"
          className="text-primary underline"
          onClick={(e) => {
            e.preventDefault();
            window.open("https://github.com/settings/developers", "_blank", "noopener");
          }}
        >
          github.com/settings/developers
        </a>{" "}
        → OAuth Apps. Use <code className="bg-muted px-1 rounded text-[9px]">http://localhost</code> como
        Authorization callback URL.
      </>
    ),
    buttonLabel: "Autorizar com GitHub",
    buttonClass: "bg-neutral-800 hover:bg-neutral-700 text-white",
  },
  google_drive: {
    label: "Google OAuth",
    clientIdPlaceholder: "123456789-abc...apps.googleusercontent.com",
    clientSecretPlaceholder: "GOCSPX-...",
    helpText: (
      <>
        Crie credenciais tipo{" "}
        <strong>Desktop App</strong> em{" "}
        <a
          href="#"
          className="text-primary underline"
          onClick={(e) => {
            e.preventDefault();
            window.open("https://console.cloud.google.com/apis/credentials", "_blank", "noopener");
          }}
        >
          console.cloud.google.com
        </a>{" "}
        e ative a Google Drive API.
      </>
    ),
    buttonLabel: "Autorizar com Google",
    buttonClass: "bg-blue-600 hover:bg-blue-700 text-white",
  },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; className: string }> = {
  connected:    { label: "Conectado",    className: "text-emerald-600 border-emerald-500/30 bg-emerald-500/5" },
  disconnected: { label: "Desconectado", className: "text-muted-foreground border-border/40 bg-muted/10" },
  error:        { label: "Erro",         className: "text-rose-500 border-rose-500/30 bg-rose-500/5" },
};

function formatSyncTime(iso?: string): string {
  if (!iso) return "Nunca sincronizado";
  const d = new Date(iso);
  return `Último sync: ${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export const ConnectorsPage = () => {
  const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("idle");
  const [activeId, setActiveId] = useState<ConnectorId | null>(null);

  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [busy, setBusy] = useState(false);

  const loadConnectors = async () => {
    try {
      setLoading(true);
      setConnectors(await desktop().connectors.list());
    } catch {
      toast.error("Erro ao listar conexões ativas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConnectors(); }, []);

  const reset = () => {
    setStep("idle");
    setActiveId(null);
    setName("");
    setClientId("");
    setClientSecret("");
    setBusy(false);
  };

  const handleAdd = (id: ConnectorId) => {
    setActiveId(id);
    setName("");
    setClientId("");
    setClientSecret("");
    setStep("config");
  };

  const handleAuthorize = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error("Preencha Client ID e Client Secret.");
      return;
    }
    setBusy(true);
    setStep("waiting");
    try {
      let connector: ConnectorConfig;
      if (activeId === "github") {
        connector = await desktop().connectors.oauth.githubStart(
          clientId.trim(), clientSecret.trim(), name || "GitHub"
        );
      } else {
        connector = await desktop().connectors.oauth.googleStart(
          clientId.trim(), clientSecret.trim(), name || "Google Drive"
        );
      }
      toast.success(`${connector.name} conectado com sucesso!`);
      reset();
      loadConnectors();
    } catch (e: any) {
      toast.error(e.message || "Erro ao conectar. Verifique as credenciais.");
      setStep("config");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await desktop().connectors.delete(id);
      toast.success("Conector removido.");
      loadConnectors();
    } catch {
      toast.error("Erro ao remover conector.");
    }
  };

  const handleSync = async (id: string, name: string) => {
    setSyncingId(id);
    try {
      const results = await desktop().connectors.sync(id);
      const r = results[0];
      if (r?.success) {
        toast.success(`${name}: ${r.itemsIndexed} itens indexados.`);
      } else {
        toast.error(`${name}: ${r?.error || "Erro ao sincronizar."}`);
      }
      loadConnectors();
    } catch (e: any) {
      toast.error(e.message || "Erro ao sincronizar.");
    } finally {
      setSyncingId(null);
    }
  };

  // ─── Inspector ──────────────────────────────────────────────────────────────

  const oauthMeta = activeId === "github" || activeId === "google_drive"
    ? OAUTH_META[activeId]
    : null;

  const renderInspector = () => {
    // OAuth config form
    if (step === "config" && oauthMeta) {
      return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="icon" onClick={reset} className="h-8 w-8 rounded-full -ml-2 text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </Button>
            <Badge variant="outline" className="text-[9px] px-2 py-0.5 rounded-full border-border/50">
              {oauthMeta.label}
            </Badge>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground block font-medium">Nome da Conexão</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={activeId === "github" ? "Meu GitHub" : "Meu Google Drive"}
              className="bg-card text-sm h-10 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground block font-medium">Client ID</label>
            <Input
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              placeholder={oauthMeta.clientIdPlaceholder}
              className="bg-card text-xs h-10 rounded-xl font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground block font-medium">Client Secret</label>
            <Input
              type="password"
              value={clientSecret}
              onChange={e => setClientSecret(e.target.value)}
              placeholder={oauthMeta.clientSecretPlaceholder}
              className="bg-card text-sm h-10 rounded-xl font-mono"
            />
            <p className="text-[10px] text-muted-foreground leading-relaxed">{oauthMeta.helpText}</p>
          </div>

          <Button
            onClick={handleAuthorize}
            disabled={busy}
            className={`w-full h-10 rounded-full shadow-sm ${oauthMeta.buttonClass}`}
          >
            {busy
              ? <Loader2 className="size-4 animate-spin mr-2" />
              : <ExternalLink className="size-4 mr-2" />
            }
            {oauthMeta.buttonLabel}
          </Button>
        </div>
      );
    }

    // Waiting for browser authorization
    if (step === "waiting" && oauthMeta) {
      return (
        <div className="animate-in fade-in duration-300 space-y-5">
          <Badge variant="outline" className="text-[9px] px-2 py-0.5 rounded-full border-border/50 mb-4">
            {oauthMeta.label}
          </Badge>

          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">Aguardando autorização no navegador</p>
            <p className="text-xs text-muted-foreground max-w-[220px]">
              Conclua a autorização na janela que foi aberta. Esta tela atualizará automaticamente.
            </p>
          </div>

          <Button variant="outline" onClick={reset} className="w-full h-10 rounded-full">
            Cancelar
          </Button>
        </div>
      );
    }

    // Default
    return (
      <div className="animate-in fade-in duration-500">
        <Badge variant="outline" className="bg-card text-[9px] px-2 py-0.5 rounded-full border-border/60 mb-2 w-fit">
          Extension Engine
        </Badge>
        <h3 className="mt-2.5 text-sm font-semibold tracking-tight text-foreground">
          Ecossistema de Conectores
        </h3>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed mb-6">
          Autorize serviços externos diretamente pelo navegador. Credenciais ficam armazenadas localmente, nunca em telemetria.
        </p>

        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-border/40 bg-muted/10 p-3.5">
            <Plug className="mt-0.5 size-4 text-primary shrink-0" />
            <div>
              <p className="text-[12px] font-medium text-foreground">OAuth Web Flow</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Clique em Adicionar → informe as credenciais do OAuth App → navegador abre para autorizar → conexão estabelecida automaticamente.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5">
            <AlertCircle className="mt-0.5 size-4 text-rose-500 shrink-0" />
            <div>
              <p className="text-[12px] font-medium text-foreground">Atenção a Custos e Rates</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Conectores online realizam pull ativo para indexação RAG, consumindo limites da API externa.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <AppShell
      title="Conectores de Dados"
      subtitle="Expanda o horizonte da sua IA adicionando fontes e ferramentas externas ao ecossistema local."
      inspector={
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
          {renderInspector()}
        </div>
      }
    >
      <div className="flex flex-col gap-8 pb-8">

        {/* Catálogo */}
        <div>
          <h2 className="text-sm font-medium text-foreground mb-4">Adicionar Nova Integração</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {CONNECTOR_TYPES.map((type) => (
              <div
                key={type.id}
                className="group relative rounded-2xl border border-border/40 bg-card p-5 hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <div className={`p-2.5 rounded-xl w-fit ${type.color}`}>
                  <type.icon className="size-5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mt-4">{type.name}</h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed min-h-[48px]">
                  {type.description}
                </p>
                {type.oauth && (
                  <Badge variant="outline" className="mt-2 text-[9px] px-1.5 py-0 text-emerald-600 border-emerald-500/30 bg-emerald-500/5">
                    OAuth
                  </Badge>
                )}
                <Button
                  onClick={() => handleAdd(type.id)}
                  variant="outline"
                  className="w-full mt-4 h-9 rounded-full bg-background group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all shadow-sm"
                >
                  <Plus className="size-3.5 mr-1.5" /> Adicionar
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Instâncias ativas */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-foreground">Conectores Instalados</h2>
            {loading && <RefreshCw className="size-3.5 text-muted-foreground animate-spin" />}
          </div>

          <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
            {connectors.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground flex flex-col items-center">
                <div className="h-12 w-12 rounded-full border border-dashed border-border/60 bg-muted/20 flex items-center justify-center mb-3">
                  <Plug className="size-5 opacity-40" />
                </div>
                <p className="text-sm">Nenhum conector instalado</p>
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {connectors.map((c) => {
                  const def = CONNECTOR_TYPES.find(t => t.id === c.type);
                  const Icon = def?.icon || Plug;
                  const statusMeta = STATUS_META[c.status] ?? STATUS_META.disconnected;
                  const isSyncing = syncingId === c.id;
                  const supportsSync = c.type === "github" || c.type === "google_drive";
                  return (
                    <div key={c.id} className="flex items-center gap-4 p-4 hover:bg-muted/10 transition-colors">
                      <div className={`p-2 rounded-lg ${def?.color || "bg-muted text-muted-foreground"}`}>
                        <Icon className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
                          {c.name}
                          <Badge variant="outline" className={`text-[9px] font-mono py-0 ${statusMeta.className}`}>
                            {statusMeta.label}
                          </Badge>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {c.syncError
                            ? <span className="text-rose-500">{c.syncError}</span>
                            : formatSyncTime(c.lastSyncedAt)
                          }
                        </p>
                      </div>
                      {supportsSync && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSync(c.id, c.name)}
                          disabled={isSyncing}
                          className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                          title="Sincronizar agora"
                        >
                          <RefreshCw className={`size-4 ${isSyncing ? "animate-spin" : ""}`} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(c.id)}
                        className="text-muted-foreground hover:text-destructive hover:bg-rose-50 rounded-full"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </AppShell>
  );
};
