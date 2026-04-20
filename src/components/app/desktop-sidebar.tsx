import { useEffect, useState } from "react";
import {
  AlertCircle,
  Bot,
  Clock3,
  FolderKanban,
  FolderTree,
  LayoutDashboard,
  PanelLeftClose,
  Plug,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Workflow,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { desktop } from "@/services/desktop";

const navigationItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, end: true },
  { label: "Projects", href: "/projects", icon: FolderTree },
  { label: "Assistente", href: "/assistant", icon: Bot },
  { label: "Pesquisa", href: "/research", icon: Search },
  { label: "Arquivos", href: "/files", icon: FolderKanban },
  { label: "Tarefas", href: "/tasks", icon: Workflow },
  { label: "Histórico", href: "/history", icon: Clock3 },
  { label: "Connectors", href: "/connectors", icon: Plug },
  { label: "Vault", href: "/vault", icon: Trash2 },
  { label: "Logs", href: "/logs", icon: AlertCircle },
  { label: "Configurações", href: "/settings", icon: Settings2 },
];

export const DesktopSidebar = ({ onClose }: { onClose?: () => void }) => {
  const [unseenEvents, setUnseenEvents] = useState(0);

  useEffect(() => {
    desktop()
      .watcher.recent()
      .then((events) => {
        const unseen = events.filter((e) => {
          const ago = Date.now() - new Date(e.detectedAt).getTime();
          return ago < 1000 * 60 * 60;
        }).length;
        setUnseenEvents(unseen);
      })
      .catch(() => {});

    const off = desktop().watcher.onEvent(() => {
      setUnseenEvents((n) => n + 1);
    });

    return off;
  }, []);

  return (
    <aside className="flex h-full w-full flex-col bg-background px-3 py-4">
      <div className="flex items-center justify-between px-1 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-foreground text-background shadow-sm">
            <Sparkles className="size-3.5" />
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold tracking-tight text-foreground">Cowork</p>
            <p className="text-[10px] text-muted-foreground">Local AI Workspace</p>
          </div>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-6 w-6 text-muted-foreground hover:bg-muted/50"
          >
            <PanelLeftClose className="size-3.5" />
          </Button>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        <p className="mb-1.5 px-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
          Navegação
        </p>
        {navigationItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "size-3.5 shrink-0",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground/60 group-hover:text-muted-foreground",
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {item.href === "/files" && unseenEvents > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {unseenEvents > 9 ? "9+" : unseenEvents}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-4 space-y-2">
        <p className="px-1 text-center text-[9px] text-muted-foreground/40">
          Cowork v0.2 · SQLite · IPC · Cmd+K
        </p>
      </div>
    </aside>
  );
};
