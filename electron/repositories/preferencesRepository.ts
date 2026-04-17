import type Database from "better-sqlite3";
import type { AppPreferences } from "../../shared/types";

interface Row {
  key: keyof AppPreferences;
  value: string;
}

export class PreferencesRepository {
  constructor(private readonly db: Database.Database) {}

  get(): AppPreferences {
    const rows = this.db
      .prepare("SELECT key, value FROM app_settings")
      .all() as Row[];

    const values = Object.fromEntries(
      rows.map((row) => [row.key, row.value]),
    ) as Record<string, string>;

    return {
      theme: (values.theme as AppPreferences["theme"]) ?? "dark",
      deletionMode:
        (values.deletionMode as AppPreferences["deletionMode"]) ?? "vault",
      aiReady: values.geminiApiKey?.trim().length > 0 || values.aiReady === "true",
      geminiApiKey: values.geminiApiKey ?? "",
      geminiModel: values.geminiModel ?? "gemini-2.5-flash",
    };
  }

  update(partial: Partial<AppPreferences>) {
    const stmt = this.db.prepare(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    );

    for (const [key, value] of Object.entries(partial)) {
      if (value === undefined) {
        continue;
      }

      stmt.run(key, String(value));
    }
  }
}
