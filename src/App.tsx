import { useEffect, useState } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import type { AppPreferences } from "@shared/types";
import { DashboardPage } from "@/pages/dashboard-page";
import { ProjectsPage } from "@/pages/projects-page";
import { AssistantPage } from "@/pages/assistant-page";
import { FilesPage } from "@/pages/files-page";
import { TasksPage } from "@/pages/tasks-page";
import { HistoryPage } from "@/pages/history-page";
import { SettingsPage } from "@/pages/settings-page";
import { VaultPage } from "@/pages/vault-page";
import { ErrorLogsPage } from "@/pages/error-logs-page";
import { ResearchPage } from "@/pages/research-page";
import { ConnectorsPage } from "@/pages/connectors-page";
import { OnboardingModal } from "@/components/app/onboarding-modal";
import { CommandPalette } from "@/components/app/command-palette";
import { desktop } from "@/services/desktop";
import { useTheme } from "@/hooks/useTheme";

function AppContent() {
  const [prefs, setPrefs] = useState<AppPreferences | null>(null);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);

  useTheme(prefs?.theme);

  useEffect(() => {
    desktop()
      .settings.getPreferences()
      .then(setPrefs)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleOnboardingComplete = async () => {
    const updated = await desktop().settings.updatePreferences({ onboardingCompleted: true });
    setPrefs(updated);
  };

  return (
    <>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage onPrefsChange={setPrefs} />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/files" element={<FilesPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/vault" element={<VaultPage />} />
        <Route path="/logs" element={<ErrorLogsPage />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/connectors" element={<ConnectorsPage />} />
        <Route path="/settings" element={<SettingsPage onPrefsChange={setPrefs} />} />
      </Routes>

      {prefs && !prefs.onboardingCompleted && (
        <OnboardingModal onComplete={handleOnboardingComplete} />
      )}

      <CommandPalette
        open={cmdPaletteOpen}
        onOpenChange={setCmdPaletteOpen}
      />

      <Toaster
        position="bottom-right"
        toastOptions={{ className: "text-[12px]" }}
      />
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}
