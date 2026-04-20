import { useState } from "react";
import { CheckCircle2, FolderPlus, KeyRound, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { desktop } from "@/services/desktop";

type Step = "welcome" | "apikey" | "folders" | "done";

const STEPS: Step[] = ["welcome", "apikey", "folders", "done"];

interface OnboardingModalProps {
  onComplete: () => void;
}

export const OnboardingModal = ({ onComplete }: OnboardingModalProps) => {
  const [step, setStep] = useState<Step>("welcome");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirAdded, setDirAdded] = useState(false);

  const stepIndex = STEPS.indexOf(step);

  const next = () => setStep(STEPS[stepIndex + 1]);

  const saveApiKey = async () => {
    if (!apiKey.trim()) { next(); return; }
    setSaving(true);
    try {
      await desktop().settings.updatePreferences({ geminiApiKey: apiKey.trim() });
      toast.success("Chave salva com sucesso.");
      next();
    } catch {
      toast.error("Erro ao salvar chave.");
    } finally {
      setSaving(false);
    }
  };

  const pickFolder = async () => {
    const dir = await desktop().files.pickAuthorizedDirectory();
    if (dir) {
      toast.success(`Pasta "${dir.name}" adicionada.`);
      setDirAdded(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-8">
          {step === "welcome" && (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background shadow-lg">
                <Sparkles className="size-7" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Bem-vindo ao Cowork</h2>
                <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">
                  Seu assistente local de produtividade com IA. Organiza arquivos, cria relatórios
                  e automatiza rotinas — tudo dentro do seu computador.
                </p>
              </div>
              <div className="mt-2 flex flex-col gap-2 w-full">
                {[
                  "Organiza pastas por tipo automaticamente",
                  "Cria relatórios com IA (Gemini)",
                  "Automatiza rotinas com agendamento",
                  "100% local — nenhum dado sai da máquina",
                ].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                    {f}
                  </div>
                ))}
              </div>
              <Button onClick={next} className="mt-2 w-full">
                Começar configuração
              </Button>
            </div>
          )}

          {step === "apikey" && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <KeyRound className="size-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Conectar Gemini</h2>
                  <p className="text-[12px] text-muted-foreground">Passo 2 de 3 — opcional</p>
                </div>
              </div>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Para usar o assistente com IA, adicione sua chave da API Gemini. Sem ela, o app
                funciona com parser local apenas.
              </p>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza..."
                autoComplete="off"
                className="h-10"
              />
              <p className="text-[11px] text-muted-foreground">
                Obtenha sua chave em{" "}
                <span className="text-primary font-mono">aistudio.google.com</span>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={next} className="flex-1">
                  Pular
                </Button>
                <Button onClick={saveApiKey} disabled={saving} className="flex-1">
                  {saving ? "Salvando..." : "Salvar e continuar"}
                </Button>
              </div>
            </div>
          )}

          {step === "folders" && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <FolderPlus className="size-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Pastas autorizadas</h2>
                  <p className="text-[12px] text-muted-foreground">Passo 3 de 3</p>
                </div>
              </div>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Desktop, Downloads e Documentos já foram adicionados automaticamente. Deseja
                adicionar mais alguma pasta?
              </p>
              <Button variant="outline" onClick={pickFolder} className="gap-2">
                <FolderPlus className="size-4" />
                {dirAdded ? "Adicionar outra pasta" : "Adicionar pasta"}
              </Button>
              {dirAdded && (
                <div className="flex items-center gap-2 text-[12px] text-emerald-600">
                  <CheckCircle2 className="size-3.5" />
                  Pasta adicionada com sucesso.
                </div>
              )}
              <Button onClick={next} className="w-full">
                Continuar
              </Button>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 shadow-lg">
                <Zap className="size-7 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Pronto para começar!</h2>
                <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">
                  Seu workspace está configurado. Use{" "}
                  <kbd className="rounded bg-muted px-1 font-mono text-[11px]">⌘K</kbd> para
                  busca rápida a qualquer momento.
                </p>
              </div>
              <Button onClick={onComplete} className="mt-2 w-full">
                Abrir Cowork
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
