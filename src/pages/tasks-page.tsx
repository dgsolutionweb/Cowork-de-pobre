import { useEffect, useState } from "react";
import type { Automation, CreateAutomationInput } from "@shared/types";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit2,
  Loader2,
  Plus,
  Play,
  Repeat2,
  SquareTerminal,
  Trash2,
  Zap,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { AppShell } from "@/layouts/app-shell";
import { desktop } from "@/services/desktop";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Schedule helpers ─────────────────────────────────────────────────────────

type ScheduleType = "manual" | "daily" | "weekly" | "monthly";

interface ScheduleConfig {
  type: ScheduleType;
  time: string;
  weekDay: string;
  monthDay: number;
}

const WEEK_DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  manual: "Manual",
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
};

function buildScheduleString(cfg: ScheduleConfig): string {
  switch (cfg.type) {
    case "manual":
      return "Manual sob demanda";
    case "daily":
      return `Diariamente às ${cfg.time}`;
    case "weekly":
      return `Semanalmente · ${cfg.weekDay} às ${cfg.time}`;
    case "monthly":
      return `Mensalmente · Dia ${cfg.monthDay} às ${cfg.time}`;
  }
}

function parseScheduleString(schedule: string): ScheduleConfig {
  const defaults: ScheduleConfig = { type: "manual", time: "09:00", weekDay: "Segunda", monthDay: 1 };
  if (schedule.startsWith("Diariamente")) {
    return { ...defaults, type: "daily", time: schedule.match(/(\d{2}:\d{2})/)?.[1] ?? "09:00" };
  }
  if (schedule.startsWith("Semanalmente")) {
    const m = schedule.match(/·\s+(\w+)\s+às\s+(\d{2}:\d{2})/);
    return { ...defaults, type: "weekly", weekDay: m?.[1] ?? "Segunda", time: m?.[2] ?? "09:00" };
  }
  if (schedule.startsWith("Mensalmente")) {
    const m = schedule.match(/Dia\s+(\d+)\s+às\s+(\d{2}:\d{2})/);
    return { ...defaults, type: "monthly", monthDay: Number(m?.[1]) || 1, time: m?.[2] ?? "09:00" };
  }
  // Legacy formats
  if (schedule.includes(":")) {
    const time = schedule.match(/(\d{2}:\d{2})/)?.[1] ?? "09:00";
    if (schedule.toLowerCase().includes("dia")) return { ...defaults, type: "daily", time };
  }
  return defaults;
}

// ─── Schedule editor component ────────────────────────────────────────────────

const ScheduleEditor = ({
  value,
  onChange,
}: {
  value: ScheduleConfig;
  onChange: (cfg: ScheduleConfig) => void;
}) => {
  const types: ScheduleType[] = ["manual", "daily", "weekly", "monthly"];

  return (
    <div className="flex flex-col gap-3">
      {/* Type selector */}
      <div className="grid grid-cols-4 gap-1.5 rounded-xl border border-border/60 bg-muted/20 p-1">
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange({ ...value, type: t })}
            className={`rounded-lg py-1.5 text-[11px] font-medium transition-all ${
              value.type === t
                ? "bg-white shadow-sm text-foreground ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {SCHEDULE_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Conditional fields */}
      {value.type === "manual" && (
        <p className="text-[12px] text-muted-foreground text-center py-1">
          Execução somente quando acionada manualmente.
        </p>
      )}

      {value.type === "daily" && (
        <div className="flex items-center gap-3">
          <label className="text-[12px] font-medium text-muted-foreground w-20">Horário</label>
          <Input
            type="time"
            value={value.time}
            onChange={(e) => onChange({ ...value, time: e.target.value })}
            className="w-36 h-9 text-[13px]"
          />
        </div>
      )}

      {value.type === "weekly" && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <label className="text-[12px] font-medium text-muted-foreground w-20">Dia</label>
            <div className="flex flex-wrap gap-1.5">
              {WEEK_DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => onChange({ ...value, weekDay: day })}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    value.weekDay === day
                      ? "border-foreground bg-foreground text-background"
                      : "border-border/60 text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-[12px] font-medium text-muted-foreground w-20">Horário</label>
            <Input
              type="time"
              value={value.time}
              onChange={(e) => onChange({ ...value, time: e.target.value })}
              className="w-36 h-9 text-[13px]"
            />
          </div>
        </div>
      )}

      {value.type === "monthly" && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <label className="text-[12px] font-medium text-muted-foreground w-20">Dia do mês</label>
            <div className="flex flex-wrap gap-1">
              {MONTH_DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onChange({ ...value, monthDay: d })}
                  className={`h-7 w-7 rounded-md border text-[11px] font-medium transition-colors ${
                    value.monthDay === d
                      ? "border-foreground bg-foreground text-background"
                      : "border-border/60 text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-[12px] font-medium text-muted-foreground w-20">Horário</label>
            <Input
              type="time"
              value={value.time}
              onChange={(e) => onChange({ ...value, time: e.target.value })}
              className="w-36 h-9 text-[13px]"
            />
          </div>
        </div>
      )}

      {/* Preview */}
      <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
        <CalendarClock className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-[12px] text-muted-foreground">
          {buildScheduleString(value)}
        </span>
      </div>
    </div>
  );
};

// ─── Create/Edit dialog ───────────────────────────────────────────────────────

interface FormState {
  name: string;
  description: string;
  commandText: string;
  enabled: boolean;
  schedule: ScheduleConfig;
}

const DEFAULT_FORM: FormState = {
  name: "",
  description: "",
  commandText: "",
  enabled: true,
  schedule: { type: "manual", time: "09:00", weekDay: "Segunda", monthDay: 1 },
};

const AutomationDialog = ({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Automation | null;
  onSaved: () => void;
}) => {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          name: editing.name,
          description: editing.description,
          commandText: editing.commandText,
          enabled: editing.enabled,
          schedule: parseScheduleString(editing.schedule),
        });
      } else {
        setForm(DEFAULT_FORM);
      }
    }
  }, [open, editing]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isValid = form.name.trim().length > 0 && form.commandText.trim().length > 0;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const input: CreateAutomationInput = {
        name: form.name.trim(),
        description: form.description.trim(),
        commandText: form.commandText.trim(),
        schedule: buildScheduleString(form.schedule),
        enabled: form.enabled,
      };

      if (editing) {
        await desktop().automations.update(editing.id, input);
        toast.success("Automação atualizada.");
      } else {
        await desktop().automations.create(input);
        toast.success("Automação criada.");
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(600px,92vw)]">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar automação" : "Nova automação"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Atualize os campos e salve para aplicar as mudanças."
              : "Configure a rotina e salve para adicioná-la à lista."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-foreground">
              Nome <span className="text-destructive">*</span>
            </label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex.: Organizar Downloads Diário"
              className="h-10"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-foreground">
              Descrição{" "}
              <span className="text-[11px] font-normal text-muted-foreground">(opcional)</span>
            </label>
            <Input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="O que esta rotina faz?"
              className="h-10"
            />
          </div>

          {/* Command */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-foreground">
              Comando <span className="text-destructive">*</span>
            </label>
            <textarea
              value={form.commandText}
              onChange={(e) => set("commandText", e.target.value)}
              placeholder="Ex.: Organize minha pasta Downloads por tipo de arquivo"
              rows={2}
              className="w-full resize-none rounded-xl border border-border/60 bg-muted/20 px-4 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:bg-background focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-muted-foreground">
              Linguagem natural — o mesmo texto que você usaria no Assistente.
            </p>
          </div>

          {/* Schedule */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-foreground">Recorrência</label>
            <ScheduleEditor
              value={form.schedule}
              onChange={(cfg) => set("schedule", cfg)}
            />
          </div>

          {/* Enabled */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
            <div>
              <p className="text-[13px] font-medium text-foreground">Ativar imediatamente</p>
              <p className="text-[11px] text-muted-foreground">
                A rotina ficará disponível para execução assim que salva.
              </p>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => set("enabled", v)}
              className="scale-90"
            />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!isValid || saving} className="min-w-[100px]">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : editing ? "Salvar alterações" : "Criar automação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Automation card ──────────────────────────────────────────────────────────

const AutomationCard = ({
  automation,
  onToggle,
  onRun,
  onEdit,
  onDelete,
  isRunning,
}: {
  automation: Automation;
  onToggle: (enabled: boolean) => void;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isRunning: boolean;
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Card className="shadow-sm border-border/60 transition-shadow hover:shadow-md">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm">{automation.name}</CardTitle>
            {automation.description && (
              <CardDescription className="mt-1 text-[12px]">
                {automation.description}
              </CardDescription>
            )}
          </div>
          <Badge
            variant={automation.enabled ? "success" : "secondary"}
            className="shrink-0 text-[9px] px-1.5 py-0 h-4"
          >
            {automation.enabled ? "Ativa" : "Pausada"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 p-5 pt-0">
        {/* Command */}
        <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <SquareTerminal className="size-3 text-muted-foreground/60" />
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              Comando
            </p>
          </div>
          <p className="text-[12px] font-medium text-foreground">{automation.commandText}</p>
        </div>

        {/* Schedule + last run */}
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarClock className="size-3.5 shrink-0" />
            {automation.schedule}
          </span>
          {automation.lastRunAt && (
            <span className="flex items-center gap-1.5 shrink-0">
              {automation.lastStatus === "completed" ? (
                <CheckCircle2 className="size-3.5 text-emerald-500" />
              ) : (
                <XCircle className="size-3.5 text-rose-400" />
              )}
              {format(new Date(automation.lastRunAt), "dd MMM • HH:mm", { locale: ptBR })}
            </span>
          )}
        </div>

        {/* Actions row */}
        <div className="flex items-center justify-between gap-2 border-t border-border/30 pt-3">
          {/* Toggle */}
          <div className="flex items-center gap-2">
            <Repeat2 className="size-3.5 text-muted-foreground/60" />
            <span className="text-[11px] font-medium text-muted-foreground">Ativa</span>
            <Switch
              className="scale-75 origin-left"
              checked={automation.enabled}
              onCheckedChange={onToggle}
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-1.5">
            {confirmDelete ? (
              <>
                <span className="text-[11px] text-rose-500 font-medium">Excluir?</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  className="h-7 px-2 text-[11px] text-muted-foreground"
                >
                  Não
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDelete}
                  className="h-7 px-2 text-[11px] text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                >
                  Sim
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConfirmDelete(true)}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  title="Excluir automação"
                >
                  <Trash2 className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onEdit}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Editar automação"
                >
                  <Edit2 className="size-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRun}
                  disabled={isRunning}
                  className="h-7 gap-1.5 text-[11px]"
                >
                  {isRunning ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Play className="size-3" />
                  )}
                  Executar
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const TasksPage = () => {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);

  const loadAutomations = async () => {
    setAutomations(await desktop().automations.list());
  };

  useEffect(() => {
    loadAutomations();
  }, []);

  const handleToggle = async (automation: Automation, enabled: boolean) => {
    await desktop().automations.toggle(automation.id, enabled);
    toast.success(`Automação ${enabled ? "ativada" : "pausada"}.`);
    loadAutomations();
  };

  const handleRun = async (automation: Automation) => {
    setRunningId(automation.id);
    try {
      const result = await desktop().automations.run(automation.id);
      toast.success(result.summary);
      loadAutomations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao executar.");
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (automation: Automation) => {
    await desktop().automations.delete(automation.id);
    toast.success(`"${automation.name}" removida.`);
    loadAutomations();
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (automation: Automation) => {
    setEditing(automation);
    setDialogOpen(true);
  };

  const activeCount = automations.filter((a) => a.enabled).length;

  return (
    <>
      <AppShell
        title="Tarefas e Rotinas"
        subtitle="Crie, edite e agende automações locais para repetição manual ou recorrente."
        inspector={
          <div className="flex h-full flex-col gap-4">
            <div>
              <Badge variant="outline" className="bg-white text-[9px] px-1.5 py-0">
                Automações
              </Badge>
              <h3 className="mt-2.5 text-sm font-semibold tracking-tight text-foreground">
                Plano recorrente
              </h3>
              <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
                {activeCount} de {automations.length} rotina(s) ativa(s).
              </p>
            </div>

            <Button onClick={openCreate} className="w-full gap-2 h-9">
              <Plus className="size-3.5" />
              Nova automação
            </Button>

            <Card className="shadow-sm border-border/50">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-xs">Recorrências disponíveis</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5 p-3 pt-0">
                {[
                  { icon: Clock, label: "Manual sob demanda" },
                  { icon: CalendarClock, label: "Diariamente (horário fixo)" },
                  { icon: Repeat2, label: "Semanalmente (dia + hora)" },
                  { icon: CalendarClock, label: "Mensalmente (dia + hora)" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Icon className="size-3.5 shrink-0 text-primary/60" />
                    {label}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/50">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-xs">Próximas evoluções</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5 p-3 pt-0">
                {[
                  "Agendador real com execução automática.",
                  "Templates por cliente ou projeto.",
                  "Histórico por automação com streak.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <Zap className="mt-0.5 size-3 shrink-0 text-primary/50" />
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        }
      >
        {/* Header with create button */}
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <p className="text-[12px] text-muted-foreground">
              {automations.length === 0
                ? "Nenhuma automação criada ainda."
                : `${automations.length} automação(ões) · ${activeCount} ativa(s)`}
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2 h-9">
            <Plus className="size-3.5" />
            Nova automação
          </Button>
        </div>

        {automations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-white shadow-sm">
              <Repeat2 className="size-6 text-muted-foreground/50" />
            </div>
            <p className="mt-4 text-base font-medium text-foreground">
              Nenhuma automação ainda
            </p>
            <p className="mt-1.5 max-w-[280px] text-[13px] text-muted-foreground leading-relaxed">
              Crie sua primeira rotina para automatizar tarefas recorrentes de arquivo.
            </p>
            <Button onClick={openCreate} className="mt-6 gap-2">
              <Plus className="size-4" />
              Criar primeira automação
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {automations.map((automation) => (
              <AutomationCard
                key={automation.id}
                automation={automation}
                onToggle={(enabled) => handleToggle(automation, enabled)}
                onRun={() => handleRun(automation)}
                onEdit={() => openEdit(automation)}
                onDelete={() => handleDelete(automation)}
                isRunning={runningId === automation.id}
              />
            ))}
          </div>
        )}
      </AppShell>

      <AutomationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={loadAutomations}
      />
    </>
  );
};
