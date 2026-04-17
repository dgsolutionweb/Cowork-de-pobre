import { useEffect, useState } from "react";
import type { AppPreferences, AuthorizedDirectory } from "@shared/types";
import { Eye, EyeOff, FolderPlus, KeyRound, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/layouts/app-shell";
import { desktop } from "@/services/desktop";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const SettingsPage = () => {
  const [preferences, setPreferences] = useState<AppPreferences | null>(null);
  const [directories, setDirectories] = useState<AuthorizedDirectory[]>([]);
  const [geminiApiKeyDraft, setGeminiApiKeyDraft] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingGemini, setSavingGemini] = useState(false);

  const load = async () => {
    const [nextPreferences, nextDirectories] = await Promise.all([
      desktop().settings.getPreferences(),
      desktop().files.getAuthorizedDirectories(),
    ]);

    setPreferences(nextPreferences);
    setDirectories(nextDirectories);
    setGeminiApiKeyDraft(nextPreferences.geminiApiKey ?? "");
  };

  useEffect(() => {
    load();
  }, []);

  const updatePreferences = async (
    partial: Partial<AppPreferences>,
    successMessage = "Preferências atualizadas.",
  ) => {
    const next = await desktop().settings.updatePreferences(partial);
    setPreferences(next);
    setGeminiApiKeyDraft(next.geminiApiKey ?? "");
    toast.success(successMessage);
  };

  const addDirectory = async () => {
    const directory = await desktop().files.pickAuthorizedDirectory();
    if (directory) {
      toast.success(`Pasta ${directory.name} adicionada.`);
      load();
    }
  };

  const removeDirectory = async (id: string) => {
    await desktop().files.removeAuthorizedDirectory(id);
    toast.success("Pasta removida do escopo autorizado.");
    load();
  };

  const saveGeminiSettings = async () => {
    setSavingGemini(true);

    try {
      await updatePreferences(
        {
          geminiApiKey: geminiApiKeyDraft,
          geminiModel: "gemini-2.5-flash",
        },
        geminiApiKeyDraft.trim().length > 0
          ? "Chave do Gemini salva."
          : "Chave do Gemini removida.",
      );
    } finally {
      setSavingGemini(false);
    }
  };

  return (
    <AppShell
      title="Configurações"
      subtitle="Controle o perímetro de segurança, preferências visuais e a integração local com Gemini 2.5 Flash."
      inspector={
        <div className="flex h-full flex-col gap-4">
          <div>
            <Badge variant="outline" className="bg-white text-[9px] px-1.5 py-0">Segurança</Badge>
            <h3 className="mt-2.5 text-sm font-semibold tracking-tight text-foreground">Guard rails locais</h3>
            <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
              As configurações são persistidas em banco local e usadas pelo processo principal do Electron.
            </p>
          </div>

          <Button variant="outline" onClick={addDirectory}>
            <FolderPlus className="size-4" />
            Adicionar diretório autorizado
          </Button>

          <Card className="shadow-sm border-border/50">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">Escopo atual</CardTitle>
              <CardDescription className="text-[11px]">{directories.length} diretórios liberados.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 p-4 pt-0">
              {directories.map((directory) => (
                <div
                  key={directory.id}
                  className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-2.5 text-[12px] transition-colors hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{directory.name}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground break-all">{directory.path}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeDirectory(directory.id)}
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="shadow-sm border-border/60">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base">Preferências visuais</CardTitle>
            <CardDescription className="text-[12px]">Tema e comportamento padrão do ambiente.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 p-5 pt-0">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-muted/30 p-3 shadow-sm">
              <div>
                <p className="text-[13px] font-medium text-foreground">Tema escuro premium</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                  Mantém a UI corporativa focada em contraste e leitura.
                </p>
              </div>
              <Switch
                className="scale-75"
                checked={preferences?.theme === "dark"}
                onCheckedChange={(checked) =>
                  updatePreferences({ theme: checked ? "dark" : "system" })
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-muted/30 p-3 shadow-sm">
              <div>
                <p className="text-[13px] font-medium text-foreground">Exclusão segura</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                  Mantém o modo preparado para lixeira lógica.
                </p>
              </div>
              <Switch
                className="scale-75"
                checked={preferences?.deletionMode === "vault"}
                onCheckedChange={(checked) =>
                  updatePreferences({ deletionMode: checked ? "vault" : "confirm" })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base">Gemini 2.5 Flash</CardTitle>
            <CardDescription className="text-[12px]">Configure a chave da API para interpretar comandos no assistente.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 p-5 pt-0">
            <div className="rounded-lg border border-primary/10 bg-primary/5 p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="size-3.5 text-primary" />
                <p className="text-[12px] font-medium text-foreground">Parser híbrido com fallback local</p>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                Quando houver chave salva, o processo principal consulta o Gemini antes de cair no parser.
              </p>
            </div>

            <div className="rounded-lg border border-border/50 bg-background p-3 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <KeyRound className="size-3.5 text-primary" />
                    <div>
                      <p className="text-[13px] font-medium text-foreground">API key do Gemini</p>
                    </div>
                  </div>
                </div>
                <Badge variant={preferences?.aiReady ? "default" : "secondary"} className="shadow-sm text-[9px] px-1.5 py-0 h-4">
                  {preferences?.aiReady ? "Configurado" : "Não configurado"}
                </Badge>
              </div>

              <div className="mt-3 flex gap-2">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={geminiApiKeyDraft}
                  onChange={(event) => setGeminiApiKeyDraft(event.target.value)}
                  placeholder="Cole sua chave da API do Gemini"
                  autoComplete="off"
                  spellCheck={false}
                  className="bg-white shadow-sm h-8 text-[12px]"
                />
                <Button
                  variant="outline"
                  onClick={() => setShowApiKey((current) => !current)}
                  aria-label={showApiKey ? "Ocultar chave" : "Mostrar chave"}
                  className="shadow-sm bg-white h-8 w-8 px-0"
                >
                  {showApiKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </Button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-muted/20 p-3">
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-foreground">Status</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                    {preferences?.aiReady
                      ? "O assistente já pode consultar o Gemini"
                      : "Sem chave salva, apenas parser local."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-3.5 text-primary" />
                  <Button onClick={saveGeminiSettings} disabled={savingGemini} className="shadow-sm h-7 text-[11px] px-3">
                    {savingGemini ? "Salvando..." : "Salvar chave"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};
