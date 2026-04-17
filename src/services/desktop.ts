import type { DesktopAPI } from "@shared/types";

export const desktop = (): DesktopAPI => {
  if (!window.cowork) {
    throw new Error("API do Electron indisponível no renderer.");
  }

  return window.cowork;
};
