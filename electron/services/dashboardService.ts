import type { DashboardData } from "../../shared/types";
import { AutomationsRepository } from "../repositories/automationsRepository";
import { AuthorizedDirectoriesRepository } from "../repositories/authorizedDirectoriesRepository";
import { HistoryRepository } from "../repositories/historyRepository";

export class DashboardService {
  constructor(
    private readonly historyRepository: HistoryRepository,
    private readonly directoriesRepository: AuthorizedDirectoriesRepository,
    private readonly automationsRepository: AutomationsRepository,
  ) {}

  getOverview(projectId?: string): DashboardData {
    const allHistory = this.historyRepository.list(projectId);
    const recentHistory = allHistory.slice(0, 10);
    const recentDirectories = this.directoriesRepository.list().slice(0, 4);
    const allAutomations = this.automationsRepository.list(projectId);
    const recentAutomations = allAutomations.slice(0, 4);

    // 7-day activity series
    const now = Date.now();
    const activitySeries = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now - (6 - i) * 86_400_000);
      const label = d.toISOString().slice(0, 10);
      const count = allHistory.filter((h) => h.createdAt.startsWith(label)).length;
      return { date: label, count };
    });

    // File type distribution from affected files
    const extCount: Record<string, number> = {};
    for (const entry of allHistory) {
      for (const f of entry.affectedFiles) {
        const ext = f.extension || "outros";
        extCount[ext] = (extCount[ext] ?? 0) + 1;
      }
    }
    const typeDistribution = Object.entries(extCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, count]) => ({ label, count }));

    // Top automations by run count (from lastRunAt presence as proxy)
    const topAutomations = allAutomations
      .filter((a) => a.lastRunAt)
      .slice(0, 5)
      .map((a) => ({ id: a.id, name: a.name, runs: 1 }));

    return {
      metrics: {
        organizedFilesCount: allHistory.reduce(
          (accumulator, entry) => accumulator + entry.affectedFiles.length,
          0,
        ),
        executedTasksCount: allHistory.length,
        activeAutomationsCount: allAutomations.filter((item) => item.enabled).length,
        authorizedDirectoriesCount: this.directoriesRepository.list().length,
      },
      recentHistory,
      recentDirectories,
      recentAutomations,
      activitySeries,
      typeDistribution,
      topAutomations,
    };
  }
}
