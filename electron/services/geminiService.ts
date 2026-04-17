import type {
  AppPreferences,
  AuthorizedDirectory,
  CommandIntent,
  ParsedCommand,
} from "../../shared/types";

type GeminiParseContext = {
  input: string;
  preferences: AppPreferences;
  directories: AuthorizedDirectory[];
};

type GeminiParseResult = {
  intent: CommandIntent;
  confidence: number;
  summary: string;
  requiresConfirmation: boolean;
  parameters?: {
    clientName?: string;
    targetDirectoryHint?: string;
  };
};

type GenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiService {
  async parseCommand(context: GeminiParseContext): Promise<ParsedCommand | null> {
    const apiKey = context.preferences.geminiApiKey.trim();

    if (!apiKey) {
      return null;
    }

    const model = context.preferences.geminiModel.trim() || DEFAULT_GEMINI_MODEL;
    const response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: this.buildPrompt(context.input, context.directories),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            properties: {
              intent: {
                type: "string",
                enum: [
                  "organize_downloads",
                  "list_pdfs",
                  "move_images",
                  "rename_files",
                  "create_client_folder",
                  "find_duplicates",
                  "show_recent_files",
                  "unknown",
                ],
              },
              confidence: {
                type: "number",
              },
              summary: {
                type: "string",
              },
              requiresConfirmation: {
                type: "boolean",
              },
              parameters: {
                type: "object",
                properties: {
                  clientName: { type: "string" },
                  targetDirectoryHint: { type: "string" },
                },
                additionalProperties: false,
              },
            },
            required: ["intent", "confidence", "summary", "requiresConfirmation"],
            additionalProperties: false,
          },
        },
      }),
      signal: AbortSignal.timeout(12000),
    });

    const payload = await response.json() as GenerateContentResponse;

    if (!response.ok) {
      const message = payload.error?.message ?? `Gemini request failed with status ${response.status}`;
      throw new Error(message);
    }

    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      return null;
    }

    const parsed = JSON.parse(text) as GeminiParseResult;
    return this.normalize(parsed);
  }

  private buildPrompt(input: string, directories: AuthorizedDirectory[]) {
    const directoryNames = directories.map((directory) => directory.name);

    return [
      "Classifique o comando do usuario para um assistente local de organizacao de arquivos.",
      "Responda apenas com JSON valido obedecendo ao schema.",
      "Use apenas uma destas intents: organize_downloads, list_pdfs, move_images, rename_files, create_client_folder, find_duplicates, show_recent_files, unknown.",
      "Use targetDirectoryHint apenas quando houver indicio claro e prefira um destes nomes autorizados exatamente como escritos:",
      directoryNames.length > 0 ? directoryNames.join(", ") : "nenhum diretorio autorizado informado",
      "Use clientName apenas quando o usuario pedir uma pasta de cliente.",
      "Comandos analiticos sem alteracao devem ter requiresConfirmation=false. Comandos que movem, renomeiam ou criam pasta devem ter requiresConfirmation=true.",
      `Comando do usuario: ${input}`,
    ].join("\n");
  }

  private normalize(result: GeminiParseResult): ParsedCommand {
    return {
      intent: result.intent,
      confidence: Math.min(Math.max(result.confidence ?? 0, 0), 1),
      summary: result.summary?.trim() ||
        "Comando interpretado pelo Gemini para gerar a previsualizacao local.",
      requiresConfirmation: Boolean(result.requiresConfirmation),
      parameters: {
        clientName: result.parameters?.clientName?.trim() || undefined,
        targetDirectoryHint: result.parameters?.targetDirectoryHint?.trim() || undefined,
      },
    };
  }
}
