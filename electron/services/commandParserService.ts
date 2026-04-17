import type {
  AppPreferences,
  AuthorizedDirectory,
  CommandIntent,
  ParsedCommand,
} from "../../shared/types";
import { GeminiService } from "./geminiService";

type Matcher = {
  intent: CommandIntent;
  confidence: number;
  pattern: RegExp;
  summary: (input: string, match: RegExpExecArray) => ParsedCommand["summary"];
  params?: (match: RegExpExecArray) => ParsedCommand["parameters"];
};

const matchers: Matcher[] = [
  {
    intent: "organize_downloads",
    confidence: 0.95,
    pattern: /(organi[zs]e?|arrume|separe).*(downloads?)/i,
    summary: () => "Organizar a pasta Downloads por tipo de arquivo.",
  },
  {
    intent: "list_pdfs",
    confidence: 0.91,
    pattern: /(listar?|liste|mostre|encontre).*(pdfs?)/i,
    summary: () => "Listar PDFs encontrados nas pastas autorizadas.",
  },
  {
    intent: "move_images",
    confidence: 0.88,
    pattern: /(mover?|separe).*(imagens?|fotos?)/i,
    summary: () => "Mover imagens para uma pasta dedicada.",
  },
  {
    intent: "rename_files",
    confidence: 0.84,
    pattern: /(renomeie?|padronize).*(arquivos?)/i,
    summary: () => "Renomear arquivos com um padrão consistente.",
  },
  {
    intent: "create_client_folder",
    confidence: 0.9,
    pattern: /(crie|nova).*(pasta).*(cliente)\s+([a-z0-9 _-]+)/i,
    summary: (_input, match) =>
      `Criar uma pasta para o cliente ${match[4].trim()}.`,
    params: (match) => ({
      clientName: match[4].trim(),
    }),
  },
  {
    intent: "find_duplicates",
    confidence: 0.9,
    pattern: /(duplicad|duplicatas)/i,
    summary: () => "Buscar arquivos duplicados antes de qualquer exclusão.",
  },
  {
    intent: "show_recent_files",
    confidence: 0.86,
    pattern: /(recentes?|hoje|esta semana|últimos?).*(arquivos?|downloads?)/i,
    summary: () => "Mostrar os arquivos mais recentes nas pastas autorizadas.",
  },
];

export class CommandParserService {
  constructor(private readonly geminiService?: GeminiService) {}

  async parse(
    input: string,
    context?: {
      preferences?: AppPreferences;
      directories?: AuthorizedDirectory[];
    },
  ): Promise<ParsedCommand> {
    const normalizedInput = input.trim();
    const fallback = this.parseWithMatchers(normalizedInput);

    if (!context?.preferences || !this.geminiService) {
      return fallback;
    }

    try {
      const geminiResult = await this.geminiService.parseCommand({
        input: normalizedInput,
        preferences: context.preferences,
        directories: context.directories ?? [],
      });

      if (!geminiResult) {
        return fallback;
      }

      if (geminiResult.intent === "unknown" && fallback.intent !== "unknown") {
        return fallback;
      }

      if (geminiResult.confidence < 0.55 && fallback.intent !== "unknown") {
        return fallback;
      }

      return geminiResult;
    } catch {
      return fallback;
    }
  }

  private parseWithMatchers(normalizedInput: string): ParsedCommand {
    for (const matcher of matchers) {
      const match = matcher.pattern.exec(normalizedInput);

      if (!match) {
        continue;
      }

      return {
        intent: matcher.intent,
        confidence: matcher.confidence,
        parameters: matcher.params ? matcher.params(match) : {},
        summary: matcher.summary(normalizedInput, match),
        requiresConfirmation: matcher.intent !== "list_pdfs" &&
          matcher.intent !== "find_duplicates" &&
          matcher.intent !== "show_recent_files",
      };
    }

    return {
      intent: "unknown",
      confidence: 0.3,
      parameters: {},
      summary:
        "Ainda não reconheço esse comando com segurança. Posso mostrar uma prévia sem executar nada.",
      requiresConfirmation: true,
    };
  }
}
