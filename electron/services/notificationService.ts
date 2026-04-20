import { Notification } from "electron";

export class NotificationService {
  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  send(title: string, body: string): void {
    if (!this.enabled) return;
    if (!Notification.isSupported()) return;

    try {
      new Notification({
        title,
        body,
        silent: false,
      }).show();
    } catch {}
  }

  sendAutomationCompleted(name: string, summary: string): void {
    this.send(`Automação concluída: ${name}`, summary);
  }

  sendTaskCompleted(summary: string): void {
    this.send("Tarefa concluída", summary);
  }

  sendWatcherAlert(name: string, dirName: string): void {
    this.send("Novo arquivo detectado", `${name} em ${dirName}`);
  }

  test(): void {
    this.send("Notificações ativas", "Cowork está monitorando seus arquivos.");
  }
}
