import { AutomationService } from "./automationService";
import { PermissionsService } from "./permissionsService";
import { PreferencesService } from "./preferencesService";
import { NotificationService } from "./notificationService";
import { ErrorLogService } from "./errorLogService";
import { syncAll } from "./connectorSyncService";

export class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private lastCheckedMinute: number | null = null;
  private lastSyncedHour: number | null = null;

  constructor(
    private readonly automationService: AutomationService,
    private readonly permissionsService: PermissionsService,
    private readonly preferencesService: PreferencesService,
    private readonly notificationService: NotificationService,
    private readonly errorLogService: ErrorLogService,
  ) {}

  start() {
    if (this.intervalId) return;
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

    // Sync connectors once per hour
    const currentHour = now.getHours();
    if (this.lastSyncedHour !== currentHour) {
      this.lastSyncedHour = currentHour;
      syncAll().then((results) => {
        const synced = results.filter((r) => r.success).length;
        if (synced > 0) {
          console.log(`[Scheduler] Conectores sincronizados: ${synced}/${results.length}`);
        }
      }).catch((err) => {
        this.errorLogService.log("scheduler", err, "connectors:sync:hourly");
      });
    }

    for (const automation of activeAutomations) {
      if (this.isDue(automation.schedule, now, currentTimeStr)) {
        console.log(`[Scheduler] DISPARANDO: ${automation.name}`);
        try {
          const directories = this.permissionsService.list();
          const preferences = this.preferencesService.get();
          const result = await this.automationService.run(
            automation.id,
            directories,
            preferences,
            automation.projectId,
          );

          this.notificationService.sendAutomationCompleted(automation.name, result.summary);
          console.log(`[Scheduler] Executada: ${automation.name} -> ${result.status}`);
        } catch (error) {
          this.errorLogService.log("scheduler", error, `automation:${automation.id}`);
          console.error(`[Scheduler] Erro em ${automation.name}:`, error);
        }
      }
    }
  }

  private isDue(schedule: string, now: Date, time: string): boolean {
    const weekDayRaw = now.toLocaleDateString("pt-BR", { weekday: "long" }).split("-")[0];
    const currentWeekDay = weekDayRaw.charAt(0).toUpperCase() + weekDayRaw.slice(1);
    const currentMonthDay = now.getDate();

    if (schedule.includes("Diariamente")) {
      const match = schedule.match(/às (\d{2}:\d{2})/);
      return match?.[1] === time;
    }
    if (schedule.includes("Semanalmente")) {
      const match = schedule.match(/·\s+(\w+)\s+às\s+(\d{2}:\d{2})/);
      return match?.[1] === currentWeekDay && match?.[2] === time;
    }
    if (schedule.includes("Mensalmente")) {
      const match = schedule.match(/Dia\s+(\d+)\s+às\s+(\d{2}:\d{2})/);
      return Number(match?.[1]) === currentMonthDay && match?.[2] === time;
    }
    return false;
  }
}
