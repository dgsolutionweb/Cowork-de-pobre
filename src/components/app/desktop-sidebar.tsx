import {
  Bot,
  Clock3,
  FolderKanban,
  LayoutDashboard,
  Settings2,
  Sparkles,
  Workflow,
  PanelLeftClose,
  ShieldCheck,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const navigationItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, end: true },
  { label: "Assistente", href: "/assistant", icon: Bot },
  { label: "Arquivos", href: "/files", icon: FolderKanban },
  { label: "Tarefas", href: "/tasks", icon: Workflow },
  { label: "Histórico", href: "/history", icon: Clock3 },
  { label: "Configurações", href: "/settings", icon: Settings2 },
];

export const DesktopSidebar = ({ onClose }: { onClose?: () => void }) => (
  <aside className="flex h-full w-full flex-col bg-background px-3 py-4">
    {/* Branding */}
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

    {/* Navigation */}
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
                ? "bg-white text-foreground shadow-sm ring-1 ring-border/50"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon
                className={cn(
                  "size-3.5 shrink-0",
                  isActive ? "text-foreground" : "text-muted-foreground/60 group-hover:text-muted-foreground",
                )}
              />
              <span>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>

    {/* Footer */}
    <div className="mt-4 space-y-2">
      <div className="rounded-xl border border-border/60 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="size-3 text-primary" />
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Privacidade local
          </p>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          Nenhum dado sai da máquina. Apenas diretórios autorizados são acessados.
        </p>
      </div>
      <p className="px-1 text-center text-[9px] text-muted-foreground/40">
        Cowork v0.1 · SQLite · IPC
      </p>
    </div>
  </aside>
);
