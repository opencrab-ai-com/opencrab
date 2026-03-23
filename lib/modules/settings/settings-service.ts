import { getSnapshot, updateSettings as updateStoredSettings } from "@/lib/resources/local-store";
import type { AppSnapshot } from "@/lib/resources/opencrab-api-types";
import type { AppSettings } from "@/lib/seed-data";

export type SettingsRepository = {
  getSnapshot: () => AppSnapshot;
  updateSettings: (patch: Partial<AppSettings>) => AppSnapshot;
};

type SettingsServiceDependencies = {
  repository?: SettingsRepository;
};

export function createSettingsService(dependencies: SettingsServiceDependencies = {}) {
  const repository = dependencies.repository ?? localSettingsRepository;

  return {
    getSettings() {
      return structuredClone(repository.getSnapshot().settings);
    },
    updateSettings(patch: Partial<AppSettings>) {
      return repository.updateSettings(patch);
    },
  };
}

const localSettingsRepository: SettingsRepository = {
  getSnapshot,
  updateSettings: updateStoredSettings,
};

export const settingsService = createSettingsService();
