import { AutomationService } from "./automationService";
import { PermissionsService } from "./permissionsService";
import { PreferencesService } from "./preferencesService";

export class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private lastCheckedMinute: number | null = null;

  constructor(
    private readonly automationService: AutomationService,
    private readonly permissionsService: PermissionsService,
    private readonly preferencesService: PreferencesService,
  ) {}

  start() {
    if (this.intervalId) return;

    // Verifica a cada 10 segundos para precisão total
    this.intervalId = setInterval(() => this.checkAutomations(), 10000);
    console.log("[Scheduler] Iniciado e monitorando tarefas...");
    
    this.checkAutomations();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async checkAutomations() {
    const now = new Date();
    const currentMinute = now.getHours() * 60 + now.getMinutes();

    if (this.lastCheckedMinute === currentMinute) return;
    this.lastCheckedMinute = currentMinute;

    const automations = this.automationService.list();
    const activeAutomations = automations.filter((a) => a.enabled);

    const currentTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    
    for (const automation of activeAutomations) {
      if (this.isDue(automation.schedule, now, currentTimeStr)) {
        console.log(`[Scheduler] DISPARANDO TAREFA: ${automation.name} (${automation.schedule})`);
        try {
          const directories = this.permissionsService.list();
          const preferences = this.preferencesService.get();
          const result = await this.automationService.run(automation.id, directories, preferences);
          console.log(`[Scheduler] Executada com sucesso: ${automation.name} -> ${result.status}`);
        } catch (error) {
          console.error(`[Scheduler] Erro ao executar ${automation.name}:`, error);
        }
      }
    }
  }

  private isDue(schedule: string, now: Date, time: string): boolean {
    // Pega o dia da semana limpo (ex: "Sexta")
    const weekDayRaw = now.toLocaleDateString("pt-BR", { weekday: "long" }).split("-")[0];
    const currentWeekDay = weekDayRaw.charAt(0).toUpperCase() + weekDayRaw.slice(1);
    const currentMonthDay = now.getDate();

    // Debug opcional no log (remover se ficar muito ruidoso)
    // console.log(`[Scheduler] Check: ${time} ${currentWeekDay} (Schedule: ${schedule})`);

    // Diariamente às HH:mm
    if (schedule.includes("Diariamente")) {
      const match = schedule.match(/às (\d{2}:\d{2})/);
      return match?.[1] === time;
    }

    // Semanalmente · DiaSemana às HH:mm
    if (schedule.includes("Semanalmente")) {
      const match = schedule.match(/·\s+(\w+)\s+às\s+(\d{2}:\d{2})/);
      return match?.[1] === currentWeekDay && match?.[2] === time;
    }

    // Mensalmente · Dia X às HH:mm
    if (schedule.includes("Mensalmente")) {
      const match = schedule.match(/Dia\s+(\d+)\s+às\s+(\d{2}:\d{2})/);
      return Number(match?.[1]) === currentMonthDay && match?.[2] === time;
    }

    return false;
  }
}
