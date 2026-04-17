import { HashRouter, Route, Routes } from "react-router-dom";
import { DashboardPage } from "@/pages/dashboard-page";
import { AssistantPage } from "@/pages/assistant-page";
import { FilesPage } from "@/pages/files-page";
import { TasksPage } from "@/pages/tasks-page";
import { HistoryPage } from "@/pages/history-page";
import { SettingsPage } from "@/pages/settings-page";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/files" element={<FilesPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </HashRouter>
  );
}
