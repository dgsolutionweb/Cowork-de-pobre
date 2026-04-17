import type { AppPreferences } from "../../shared/types";
import { PreferencesRepository } from "../repositories/preferencesRepository";

export class PreferencesService {
  constructor(private readonly repository: PreferencesRepository) {}

  get() {
    return this.repository.get();
  }

  update(partial: Partial<AppPreferences>) {
    const nextPartial: Partial<AppPreferences> = { ...partial };

    if (partial.geminiApiKey !== undefined) {
      nextPartial.geminiApiKey = partial.geminiApiKey.trim();
      nextPartial.geminiModel = partial.geminiModel?.trim() || "gemini-2.5-flash";
      nextPartial.aiReady = nextPartial.geminiApiKey.length > 0;
    }

    this.repository.update(nextPartial);
    return this.repository.get();
  }
}
