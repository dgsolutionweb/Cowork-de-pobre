import type {
  AuthorizedDirectory,
  FileItem,
  GlobalSearchHit,
  GlobalSearchResult,
  HistoryEntry,
  Automation,
  ProjectSummary,
} from "../../shared/types";

const PAGES: GlobalSearchHit[] = [
  { kind: "page", id: "/", title: "Dashboard", subtitle: "Painel operacional", payload: { href: "/" } },
  { kind: "page", id: "/projects", title: "Projects", subtitle: "Workspaces e instruções", payload: { href: "/projects" } },
  { kind: "page", id: "/assistant", title: "Assistente", subtitle: "Chat com IA", payload: { href: "/assistant" } },
  { kind: "page", id: "/files", title: "Arquivos", subtitle: "Explorar arquivos locais", payload: { href: "/files" } },
  { kind: "page", id: "/tasks", title: "Tarefas", subtitle: "Automações e rotinas", payload: { href: "/tasks" } },
  { kind: "page", id: "/history", title: "Histórico", subtitle: "Execuções registradas", payload: { href: "/history" } },
  { kind: "page", id: "/vault", title: "Vault", subtitle: "Arquivos excluídos", payload: { href: "/vault" } },
  { kind: "page", id: "/logs", title: "Logs de Erro", subtitle: "Diagnóstico do sistema", payload: { href: "/logs" } },
  { kind: "page", id: "/settings", title: "Configurações", subtitle: "API key, pastas, tema", payload: { href: "/settings" } },
];

export class SearchService {
  search(
    query: string,
    opts: {
      files: FileItem[];
      directories: AuthorizedDirectory[];
      history: HistoryEntry[];
      automations: Automation[];
      projects: ProjectSummary[];
    },
  ): GlobalSearchResult {
    const q = query.toLowerCase().trim();

    if (!q) return { query, hits: PAGES.slice(0, 5) };

    const hits: GlobalSearchHit[] = [];

    for (const page of PAGES) {
      if (
        page.title.toLowerCase().includes(q) ||
        (page.subtitle ?? "").toLowerCase().includes(q)
      ) {
        hits.push(page);
      }
    }

    for (const file of opts.files.slice(0, 300)) {
      if (file.name.toLowerCase().includes(q)) {
        hits.push({
          kind: "file",
          id: file.path,
          title: file.name,
          subtitle: file.directoryName,
          hint: `${Math.round(file.size / 1024)} KB`,
          payload: { path: file.path },
        });
      }
    }

    for (const entry of opts.history) {
      if (
        entry.commandText.toLowerCase().includes(q) ||
        entry.summary.toLowerCase().includes(q)
      ) {
        hits.push({
          kind: "history",
          id: entry.id,
          title: entry.commandText,
          subtitle: entry.summary,
          hint: entry.status,
        });
      }
    }

    for (const automation of opts.automations) {
      if (
        automation.name.toLowerCase().includes(q) ||
        automation.commandText.toLowerCase().includes(q)
      ) {
        hits.push({
          kind: "automation",
          id: automation.id,
          title: automation.name,
          subtitle: automation.commandText,
          hint: automation.schedule,
          payload: { id: automation.id },
        });
      }
    }

    for (const project of opts.projects) {
      if (
        project.name.toLowerCase().includes(q) ||
        project.rootPath.toLowerCase().includes(q)
      ) {
        hits.push({
          kind: "project",
          id: project.id,
          title: project.name,
          subtitle: project.rootPath,
          hint: project.status,
          payload: { href: "/projects", id: project.id },
        });
      }
    }

    return { query, hits: hits.slice(0, 12) };
  }
}
