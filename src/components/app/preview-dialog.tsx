import type { CommandPreview } from "@shared/types";
import { AlertTriangle, FolderOutput, ListChecks } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type PreviewDialogProps = {
  preview: CommandPreview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting?: boolean;
};

export const PreviewDialog = ({
  preview,
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  isExecuting,
}: PreviewDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <Badge variant="outline">Prévia da tarefa</Badge>
        <DialogTitle>{preview?.headline ?? "Nenhuma prévia disponível"}</DialogTitle>
        <DialogDescription>{preview?.explanation}</DialogDescription>
      </DialogHeader>

      {preview ? (
        <div className="mt-6 grid gap-4">
          <Card className="bg-muted/30 border-border/50 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <ListChecks className="size-4 text-primary" />
                {preview.actions.length} ação(ões) preparadas
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {preview.actions.map((action) => (
                  <div
                    key={action.id}
                    className="rounded-xl border border-border/60 bg-background p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-foreground">{action.label}</p>
                      <Badge variant="secondary" className="shadow-sm">{action.fileCount} itens</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{action.risk}</p>
                    {(action.source || action.destination) && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <FolderOutput className="size-3.5" />
                        <span>{action.source ?? "N/A"}</span>
                        <span>→</span>
                        <span>{action.destination ?? "Sem destino físico"}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {preview.risks.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4 text-amber-600" />
                Riscos identificados
              </div>
              <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-amber-800/80">
                {preview.risks.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      <DialogFooter className="mt-6">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={onConfirm} disabled={!preview || isExecuting}>
          {isExecuting ? "Executando..." : "Executar agora"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
