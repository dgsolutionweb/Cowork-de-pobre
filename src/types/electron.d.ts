import type { DesktopAPI } from "@shared/types";

declare global {
  interface Window {
    cowork?: DesktopAPI;
  }
}

export {};
