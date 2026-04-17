import type { HistoryEntry } from "../../shared/types";
import { HistoryRepository } from "../repositories/historyRepository";

export class HistoryService {
  constructor(private readonly repository: HistoryRepository) {}

  list() {
    return this.repository.list();
  }

  save(entry: HistoryEntry) {
    return this.repository.insert(entry);
  }
}
