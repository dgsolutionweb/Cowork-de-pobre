import { useState, type ReactNode } from "react";
import { DesktopSidebar } from "@/components/app/desktop-sidebar";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type AppShellProps = {
  title: string;
  subtitle: string;
  inspector?: ReactNode;
  children: ReactNode;
};

export const AppShell = ({ title, subtitle, inspector, children }: AppShellProps) => {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div 
        className={cn(
          "transition-[width,opacity] duration-300 ease-in-out overflow-hidden flex-shrink-0 flex",
          leftOpen ? "w-[220px] opacity-100" : "w-0 opacity-0"
        )}
      >
        <div className="w-[220px] flex-shrink-0">
          <DesktopSidebar onClose={() => setLeftOpen(false)} />
        </div>
      </div>

      <main className="flex flex-1 flex-col overflow-hidden bg-white shadow-sm sm:rounded-tl-2xl sm:border-t sm:border-l sm:border-border/60 relative transition-all duration-300">
        <div className="flex h-full w-full overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 md:px-8">
            <div className="mx-auto flex max-w-4xl flex-col">
              <div className="mb-6 flex flex-col gap-1 border-b border-border/40 pb-4">
                <div className="flex items-center gap-2">
                  {!leftOpen && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setLeftOpen(true)} 
                      className="h-6 w-6 text-muted-foreground hover:bg-muted/50 -ml-1.5"
                      title="Abrir menu lateral"
                    >
                      <PanelLeftOpen className="size-3.5" />
                    </Button>
                  )}
                  <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Workspace Local
                  </span>
                </div>
                
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-foreground">{title}</h2>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="hidden rounded-md border border-border/60 bg-muted/20 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground sm:block">
                      Seguro • SQLite • IPC
                    </div>
                    {inspector && !rightOpen && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setRightOpen(true)} 
                        className="h-6 w-6 text-muted-foreground hover:bg-muted/50"
                        title="Abrir painel direito"
                      >
                        <PanelRightOpen className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 pb-10">{children}</div>
            </div>
          </div>

          {inspector && (
            <div
              className={cn(
                "transition-[width,opacity] duration-300 ease-in-out overflow-hidden flex-shrink-0 flex border-l border-border/50 bg-white/[0.98]",
                rightOpen ? "w-[240px] lg:w-[280px] opacity-100" : "w-0 opacity-0 border-l-0"
              )}
            >
              <aside className="w-[240px] lg:w-[280px] shrink-0 overflow-y-auto p-4">
                <div className="mb-2 flex justify-end">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setRightOpen(false)} 
                    className="h-6 w-6 text-muted-foreground hover:bg-muted/50 -mr-1.5"
                    title="Fechar painel direito"
                  >
                    <PanelRightClose className="size-3.5" />
                  </Button>
                </div>
                {inspector}
              </aside>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
