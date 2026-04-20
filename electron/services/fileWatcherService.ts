import fs from "node:fs";
import type { BrowserWindow } from "electron";
import type { AuthorizedDirectory, FileWatchEvent } from "../../shared/types";
import { FileWatchEventsRepository } from "../repositories/fileWatchEventsRepository";
import { createId } from "../utils/id";

type FSWatcher = ReturnType<typeof fs.watch>;

export class FileWatcherService {
  private watchers = new Map<string, FSWatcher>();

  constructor(
    private readonly repository: FileWatchEventsRepository,
    private window: BrowserWindow | null = null,
  ) {}

  setWindow(window: BrowserWindow): void {
    this.window = window;
  }

  startWatching(directories: AuthorizedDirectory[]): void {
    this.stopAll();

    for (const dir of directories) {
      try {
        const watcher = fs.watch(
          dir.path,
          { persistent: false, recursive: false },
          (eventType, filename) => {
            if (!filename || filename.startsWith(".")) return;

            const type =
              eventType === "rename"
                ? "added"
                : "changed";

            const event: FileWatchEvent = {
              id: createId(),
              type,
              path: `${dir.path}/${filename}`,
              name: filename,
              directoryId: dir.id,
              directoryName: dir.name,
              detectedAt: new Date().toISOString(),
            };

            this.repository.insert(event);

            if (this.window && !this.window.isDestroyed()) {
              this.window.webContents.send("watcher:event", event);
            }
          },
        );

        this.watchers.set(dir.id, watcher);
      } catch {
        // dir may not exist — skip
      }
    }
  }

  stopAll(): void {
    for (const watcher of this.watchers.values()) {
      try { watcher.close(); } catch {}
    }
    this.watchers.clear();
  }

  recent(): FileWatchEvent[] {
    return this.repository.list();
  }

  markSeen(): void {
    this.repository.markAllSeen();
  }

  unseenCount(): number {
    return this.repository.unseenCount();
  }
}
