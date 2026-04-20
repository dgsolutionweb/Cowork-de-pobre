import type { ErrorLogEntry, ErrorSource } from "../../shared/types";
import { ErrorLogRepository } from "../repositories/errorLogRepository";
import { createId } from "../utils/id";

export class ErrorLogService {
  constructor(private readonly repository: ErrorLogRepository) {}

  log(source: ErrorSource, error: unknown, context?: string): void {
    const entry: ErrorLogEntry = {
      id: createId(),
      source,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
      createdAt: new Date().toISOString(),
    };
    this.repository.insert(entry);
    console.error(`[ErrorLog:${source}]`, entry.message);
  }

  list(): ErrorLogEntry[] {
    return this.repository.list();
  }

  clear(): void {
    this.repository.clear();
  }

  export(): string {
    const entries = this.repository.list();
    return entries
      .map(
        (e) =>
          `[${e.createdAt}] [${e.source}] ${e.message}${e.context ? `\nContext: ${e.context}` : ""}${e.stack ? `\n${e.stack}` : ""}`,
      )
      .join("\n\n---\n\n");
  }
}
