import type { CommandPreview, ConversationMessage, ExecutionResult } from "@shared/types";
import { create } from "zustand";

type AssistantStore = {
  conversationId: string;
  messages: ConversationMessage[];
  lastResult: ExecutionResult | null;
  appendMessage: (message: ConversationMessage) => void;
  updateLastMessage: (updater: (msg: ConversationMessage) => ConversationMessage) => void;
  removeLoadingMessage: () => void;
  attachPreviewToLastAssistant: (preview: CommandPreview) => void;
  setResult: (result: ExecutionResult | null) => void;
  resetConversation: () => void;
};

const WELCOME: ConversationMessage = {
  id: crypto.randomUUID(),
  role: "assistant",
  text: "Olá! Sou seu assistente operacional. Posso listar arquivos, buscar duplicados, organizar pastas e muito mais. Com Gemini configurado nas Configurações, entendo linguagem natural e executo ferramentas automaticamente. O que posso fazer por você?",
  timestamp: new Date().toISOString(),
};

export const useAssistantStore = create<AssistantStore>((set) => ({
  conversationId: crypto.randomUUID(),
  messages: [WELCOME],
  lastResult: null,

  appendMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateLastMessage: (updater) =>
    set((state) => {
      const msgs = [...state.messages];
      if (msgs.length === 0) return state;
      msgs[msgs.length - 1] = updater(msgs[msgs.length - 1]);
      return { messages: msgs };
    }),

  removeLoadingMessage: () =>
    set((state) => ({
      messages: state.messages.filter((m) => !m.isLoading),
    })),

  attachPreviewToLastAssistant: (preview) =>
    set((state) => {
      const msgs = [...state.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") {
          msgs[i] = {
            ...msgs[i],
            pendingPreviews: [...(msgs[i].pendingPreviews ?? []), preview],
          };
          break;
        }
      }
      return { messages: msgs };
    }),

  setResult: (result) => set({ lastResult: result }),

  resetConversation: () =>
    set({
      conversationId: crypto.randomUUID(),
      messages: [{ ...WELCOME, id: crypto.randomUUID(), timestamp: new Date().toISOString() }],
      lastResult: null,
    }),
}));
