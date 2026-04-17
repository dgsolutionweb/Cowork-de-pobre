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

  getOverview(): DashboardData {
    const recentHistory = this.historyRepository.list();
    const recentDirectories = this.directoriesRepository.list().slice(0, 4);
    const recentAutomations = this.automationsRepository.list().slice(0, 4);

    return {
      metrics: {
        organizedFilesCount: recentHistory.reduce(
          (accumulator, entry) => accumulator + entry.affectedFiles.length,
          0,
        ),
        executedTasksCount: recentHistory.length,
        activeAutomationsCount: recentAutomations.filter((item) => item.enabled).length,
        authorizedDirectoriesCount: recentDirectories.length,
      },
      recentHistory,
      recentDirectories,
      recentAutomations,
    };
  }
}
