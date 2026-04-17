import path from "node:path";
import type {
  AppPreferences,
  AuthorizedDirectory,
  CommandPreview,
  FileItem,
  PendingFileOperation,
} from "../../shared/types";
import type {
  DocumentService,
  ReadDocumentResult,
  SupportedDocumentOutput,
} from "./documentService";
import type { FileService } from "./fileService";
import type { TaskExecutionService } from "./taskExecutionService";

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: { result: string } } };

type GeminiTurn = {
  role: "user" | "model";
  parts: GeminiPart[];
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { role?: string; parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  error?: { message?: string; code?: number };
};

type ResolvedFile =
  | { file: FileItem; error?: undefined }
  | { file?: undefined; error: string };

export type ChatResult = {
  assistantText: string;
  pendingPreviews: CommandPreview[];
  pendingFileOps: PendingFileOperation[];
  toolsUsed: string[];
  updatedHistory: GeminiTurn[];
};

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const SUPPORTED_OUTPUT_FORMATS = new Set<SupportedDocumentOutput>(["md", "docx", "pdf"]);

const TOOLS = {
  functionDeclarations: [
    {
      name: "abrir_arquivo",
      description:
        "Abre um arquivo autorizado no aplicativo padrão do sistema. Pode usar o caminho completo ou buscar por nome quando o usuário pedir para abrir um arquivo.",
      parameters: {
        type: "object",
        properties: {
          caminho_arquivo: {
            type: "string",
            description: "Caminho absoluto do arquivo a abrir, se já conhecido",
          },
          consulta: {
            type: "string",
            description: "Nome completo ou parcial do arquivo para localizar e abrir",
          },
          directorio: {
            type: "string",
            description: "Nome do diretório autorizado para limitar a busca (opcional)",
          },
        },
      },
    },
    {
      name: "analisar_documento",
      description:
        "Lê e resume o conteúdo estrutural de um documento ou planilha autorizada. Use para entender documentos .md, .txt, .docx, .pdf, .xlsx, .xls e .csv antes de responder ou reorganizar.",
      parameters: {
        type: "object",
        properties: {
          caminho_arquivo: {
            type: "string",
            description: "Caminho absoluto do arquivo a analisar",
          },
          consulta: {
            type: "string",
            description: "Nome completo ou parcial do arquivo para localizar",
          },
          directorio: {
            type: "string",
            description: "Nome do diretório autorizado para limitar a busca (opcional)",
          },
          objetivo: {
            type: "string",
            description: "O que deve ser observado na análise, ex: clareza, estrutura, inconsistências",
          },
        },
      },
    },
    {
      name: "reorganizar_documento",
      description:
        "Lê um documento autorizado, incluindo PDF, reorganiza o conteúdo conforme a instrução do usuário e cria uma nova versão em .md, .docx ou .pdf sem sobrescrever o original.",
      parameters: {
        type: "object",
        properties: {
          caminho_arquivo: {
            type: "string",
            description: "Caminho absoluto do arquivo a reorganizar",
          },
          consulta: {
            type: "string",
            description: "Nome completo ou parcial do arquivo para localizar",
          },
          directorio: {
            type: "string",
            description: "Nome do diretório autorizado para limitar a busca (opcional)",
          },
          instrucao: {
            type: "string",
            description: "Como o conteúdo deve ser reorganizado, ex: transformar em relatório executivo, limpar e padronizar seções, resumir",
          },
          formato_saida: {
            type: "string",
            description: "Formato de saída desejado: md, docx ou pdf",
          },
        },
        required: ["instrucao"],
      },
    },
    {
      name: "criar_relatorio",
      description:
        "Gera um relatório novo em .md, .docx e/ou .pdf com base em instruções do usuário e arquivos autorizados de referência.",
      parameters: {
        type: "object",
        properties: {
          titulo: {
            type: "string",
            description: "Título do relatório",
          },
          instrucao: {
            type: "string",
            description: "Briefing do relatório, com objetivo, tom e estrutura desejada",
          },
          arquivos_base: {
            type: "array",
            items: { type: "string" },
            description: "Lista de nomes ou caminhos de arquivos de referência",
          },
          directorio_destino: {
            type: "string",
            description: "Nome do diretório autorizado onde o relatório deve ser salvo",
          },
          formatos: {
            type: "array",
            items: { type: "string" },
            description: "Lista de formatos desejados: md, docx, pdf",
          },
        },
        required: ["titulo", "instrucao"],
      },
    },
    {
      name: "listar_arquivos",
      description:
        "Lista arquivos nos diretórios autorizados do usuário. Use para mostrar o conteúdo de uma pasta ou filtrar por tipo.",
      parameters: {
        type: "object",
        properties: {
          directorio: {
            type: "string",
            description: "Nome do diretório (opcional, lista todos se omitido)",
          },
          extensao: {
            type: "string",
            description: "Filtrar por extensão, ex: .pdf, .jpg, .docx",
          },
          limite: {
            type: "number",
            description: "Número máximo de arquivos a retornar (padrão: 30)",
          },
        },
      },
    },
    {
      name: "buscar_arquivos",
      description:
        "Busca arquivos por nome nos diretórios autorizados. Use para encontrar arquivos específicos.",
      parameters: {
        type: "object",
        properties: {
          consulta: {
            type: "string",
            description: "Texto para buscar no nome do arquivo",
          },
          directorio: {
            type: "string",
            description: "Diretório específico para limitar a busca (opcional)",
          },
        },
        required: ["consulta"],
      },
    },
    {
      name: "arquivos_recentes",
      description:
        "Lista os arquivos modificados mais recentemente em todas as pastas autorizadas.",
      parameters: {
        type: "object",
        properties: {
          limite: {
            type: "number",
            description: "Número de arquivos a retornar (padrão: 20)",
          },
        },
      },
    },
    {
      name: "encontrar_duplicados",
      description:
        "Encontra arquivos duplicados (mesmo nome e tamanho, verificado por hash) nas pastas autorizadas.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "organizar_pasta",
      description:
        "Prepara um plano para organizar uma pasta, criando subpastas por tipo (PDFs, Imagens, Documentos, Outros). Requer confirmação explícita do usuário antes de executar.",
      parameters: {
        type: "object",
        properties: {
          directorio: {
            type: "string",
            description: "Nome do diretório a organizar (ex: Downloads, Documents)",
          },
        },
        required: ["directorio"],
      },
    },
    {
      name: "criar_pasta",
      description:
        "Prepara um plano para criar uma nova pasta de cliente ou projeto em um diretório autorizado. Requer confirmação do usuário.",
      parameters: {
        type: "object",
        properties: {
          nome: {
            type: "string",
            description: "Nome da nova pasta ou cliente",
          },
          directorio_pai: {
            type: "string",
            description: "Nome do diretório pai onde a pasta será criada (opcional)",
          },
        },
        required: ["nome"],
      },
    },
    {
      name: "renomear_item",
      description:
        "Prepara uma prévia para renomear um arquivo ou pasta. Use o caminho completo obtido por listar_arquivos ou buscar_arquivos. Requer confirmação do usuário.",
      parameters: {
        type: "object",
        properties: {
          caminho_arquivo: {
            type: "string",
            description: "Caminho absoluto do arquivo ou pasta a renomear",
          },
          novo_nome: {
            type: "string",
            description: "Novo nome (incluindo extensão se for arquivo, ex: relatorio-final.pdf)",
          },
        },
        required: ["caminho_arquivo", "novo_nome"],
      },
    },
    {
      name: "mover_item",
      description:
        "Prepara uma prévia para mover um arquivo ou pasta para outro diretório autorizado. Use o caminho absoluto original. Requer confirmação do usuário.",
      parameters: {
        type: "object",
        properties: {
          caminho_arquivo: {
            type: "string",
            description: "Caminho absoluto do arquivo ou pasta a mover",
          },
          diretorio_destino: {
            type: "string",
            description: "Nome ou caminho do diretório de destino",
          },
        },
        required: ["caminho_arquivo", "diretorio_destino"],
      },
    },
    {
      name: "excluir_item",
      description:
        "Prepara uma prévia para excluir permanentemente um arquivo ou pasta. Use quando o usuário pedir para apagar ou deletar algo. Requer confirmação obrigatória.",
      parameters: {
        type: "object",
        properties: {
          caminho_arquivo: {
            type: "string",
            description: "Caminho absoluto do arquivo ou pasta a excluir",
          },
        },
        required: ["caminho_arquivo"],
      },
    },
    {
      name: "pesquisar_na_internet",
      description:
        "Faz uma busca minuciosa no Google para responder perguntas sobre o mundo exterior, notícias atuais, cotações, previsões ou dados que não estão nos arquivos locais do usuário.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "O texto da pesquisa (ex: 'Notícias sobre IA hoje', 'Preço do café')",
          },
          foco: {
            type: "string",
            description: "Foco específico da busca, ex: 'análise técnica', 'notícias recentes'",
          },
        },
        required: ["query"],
      },
    },
  ],
};

const TOOL_LABELS: Record<string, string> = {
  abrir_arquivo: "Abrindo arquivo",
  analisar_documento: "Analisando documento",
  reorganizar_documento: "Reorganizando documento",
  criar_relatorio: "Criando relatório",
  listar_arquivos: "Listando arquivos",
  buscar_arquivos: "Buscando arquivos",
  arquivos_recentes: "Verificando arquivos recentes",
  encontrar_duplicados: "Procurando duplicados",
  organizar_pasta: "Preparando organização",
  criar_pasta: "Preparando criação de pasta",
  renomear_item: "Preparando renomeação",
  mover_item: "Preparando movimentação",
  excluir_item: "Preparando exclusão",
  pesquisar_na_internet: "Pesquisando na internet",
};

export class GeminiChatService {
  async chat(
    history: GeminiTurn[],
    newMessage: string,
    context: { directories: AuthorizedDirectory[]; preferences: AppPreferences },
    fileService: FileService,
    documentService: DocumentService,
    taskExecutionService: TaskExecutionService,
  ): Promise<ChatResult> {
    const apiKey = context.preferences.geminiApiKey?.trim();

    if (!apiKey) {
      return {
        assistantText:
          "Configure sua chave da API Gemini nas **Configurações** para habilitar o assistente inteligente. Sem ela, apenas o parser local está disponível via sugestões rápidas.",
        pendingPreviews: [],
        pendingFileOps: [],
        toolsUsed: [],
        updatedHistory: history,
      };
    }

    const model = context.preferences.geminiModel?.trim() || "gemini-2.5-flash";
    const systemPrompt = this.buildSystemPrompt(context.directories);
    const pendingPreviews: CommandPreview[] = [];
    const pendingFileOps: PendingFileOperation[] = [];
    const toolsUsed: string[] = [];

    const loopContents: GeminiTurn[] = [
      ...history,
      { role: "user", parts: [{ text: newMessage }] },
    ];

    let finalText = "";
    let loopCount = 0;
    const MAX_LOOPS = 8;

    while (loopCount < MAX_LOOPS) {
      loopCount++;

      const response = await this.callGemini(apiKey, model, systemPrompt, loopContents);
      const candidate = response.candidates?.[0];

      if (!candidate?.content?.parts?.length) break;

      const parts = candidate.content.parts;
      const textParts = parts.filter(
        (p): p is { text: string } => "text" in p && typeof p.text === "string" && p.text.length > 0,
      );
      const functionCalls = parts.filter(
        (p): p is { functionCall: { name: string; args: Record<string, unknown> } } =>
          "functionCall" in p,
      );

      const textContent = textParts.map((p) => p.text).join("");
      if (textContent) {
        finalText = textContent;
      }

      if (functionCalls.length === 0) {
        loopContents.push({ role: "model", parts });
        break;
      }

      loopContents.push({ role: "model", parts });

      const functionResponses: GeminiPart[] = [];

      for (const fc of functionCalls) {
        const { name, args } = fc.functionCall;

        if (TOOL_LABELS[name] && !toolsUsed.includes(name)) {
          toolsUsed.push(name);
        }

        const result = await this.executeTool(
          name,
          args,
          context,
          fileService,
          documentService,
          taskExecutionService,
          pendingPreviews,
          pendingFileOps,
        );

        functionResponses.push({
          functionResponse: { name, response: { result } },
        });
      }

      loopContents.push({ role: "user", parts: functionResponses });
    }

    const updatedHistory: GeminiTurn[] = [
      ...history,
      { role: "user", parts: [{ text: newMessage }] },
      { role: "model", parts: [{ text: finalText || "Pronto." }] },
    ];

    return {
      assistantText: finalText || "Tarefa concluída.",
      pendingPreviews,
      pendingFileOps,
      toolsUsed,
      updatedHistory,
    };
  }

  private async executeTool(
    name: string,
    args: Record<string, unknown>,
    context: { directories: AuthorizedDirectory[]; preferences: AppPreferences },
    fileService: FileService,
    documentService: DocumentService,
    taskExecutionService: TaskExecutionService,
    pendingPreviews: CommandPreview[],
    pendingFileOps: PendingFileOperation[],
  ): Promise<string> {
    const { directories, preferences } = context;
    const allowedPaths = directories.map((directory) => directory.path);
    const apiKey = preferences.geminiApiKey?.trim() ?? "";
    const model = preferences.geminiModel?.trim() || "gemini-2.5-flash";

    try {
      switch (name) {
        case "abrir_arquivo": {
          const resolved = await this.resolveFileReference(args, directories, fileService);
          if (resolved.error) return resolved.error;

          await fileService.openFile(resolved.file.path, allowedPaths);
          return `Arquivo aberto com sucesso: ${resolved.file.path}`;
        }

        case "analisar_documento": {
          const resolved = await this.resolveFileReference(args, directories, fileService);
          if (resolved.error) return resolved.error;

          const objective = (args.objetivo as string | undefined)?.trim();
          const document = await documentService.readDocument(resolved.file.path, allowedPaths);
          const structuralSummary = this.describeDocument(document);
          const analysis = await this.callGeminiText(
            apiKey,
            model,
            "Você é um analista de documentos e planilhas. Resuma o estado do material, a estrutura, qualidade e oportunidades de reorganização. Responda em português do Brasil.",
            [
              objective
                ? `Objetivo da análise: ${objective}`
                : "Objetivo da análise: entender estrutura, clareza, lacunas e oportunidades de melhoria.",
              "",
              structuralSummary,
              "",
              "Conteúdo extraído:",
              this.buildDocumentExcerpt(document),
            ].join("\n"),
            1400,
          );

          return [
            `Documento analisado: ${document.name} — ${document.path}`,
            structuralSummary,
            "",
            "Análise:",
            analysis,
          ].join("\n");
        }

        case "reorganizar_documento": {
          const resolved = await this.resolveFileReference(args, directories, fileService);
          if (resolved.error) return resolved.error;

          const instruction = (args.instrucao as string | undefined)?.trim();
          if (!instruction) {
            return "Informe como o conteúdo deve ser reorganizado.";
          }

          const outputFormat = this.parseSingleFormat(args.formato_saida);
          const document = await documentService.readDocument(resolved.file.path, allowedPaths);

          const markdown = await this.callGeminiText(
            apiKey,
            model,
            "Você reorganiza documentos e planilhas. Sua saída deve ser apenas markdown puro, sem cercas de código, preservando o conteúdo essencial e melhorando a estrutura.",
            [
              `Arquivo de origem: ${document.name}`,
              `Formato original: ${document.extension}`,
              `Objetivo de reorganização: ${instruction}`,
              "",
              "Regras:",
              "- Produza um documento final limpo e pronto para entrega.",
              "- Preserve fatos, dados e nomes relevantes.",
              "- Reestruture títulos, seções, listas e tabelas quando isso melhorar a clareza.",
              "- Se a fonte for planilha, transforme o conteúdo em relatório bem organizado.",
              "- Comece com um título em markdown.",
              "",
              "Conteúdo extraído:",
              this.buildDocumentExcerpt(document),
            ].join("\n"),
            4096,
          );

          const title = `${document.title} reorganizado`;
          const saved = await documentService.saveReorganizedDocument(
            resolved.file.path,
            title,
            this.ensureMarkdownTitle(markdown, title),
            outputFormat,
            allowedPaths,
          );

          return [
            `Nova versão reorganizada criada com sucesso.`,
            `Origem: ${resolved.file.path}`,
            `Saída: ${saved.path}`,
            `Formato: ${saved.extension}`,
          ].join("\n");
        }

        case "criar_relatorio": {
          const title = (args.titulo as string | undefined)?.trim();
          const instruction = (args.instrucao as string | undefined)?.trim();
          const fileRefs = Array.isArray(args.arquivos_base)
            ? args.arquivos_base.filter((item): item is string => typeof item === "string")
            : [];

          if (!title || !instruction) {
            return "Informe pelo menos o título e a instrução do relatório.";
          }

          const baseDocuments: ReadDocumentResult[] = [];
          for (const ref of fileRefs) {
            const resolved = await this.resolveFileReference(
              this.fileRefToArgs(ref),
              directories,
              fileService,
            );
            if (resolved.error) {
              return `Não foi possível usar "${ref}" como base do relatório: ${resolved.error}`;
            }

            baseDocuments.push(
              await documentService.readDocument(resolved.file.path, allowedPaths),
            );
          }

          const formats = this.parseFormats(args.formatos);
          const outputDirectory = this.resolveOutputDirectory(
            (args.directorio_destino as string | undefined)?.trim(),
            directories,
            baseDocuments[0]?.path,
          );

          const reportMarkdown = await this.callGeminiText(
            apiKey,
            model,
            "Você cria relatórios profissionais. Sua saída deve ser apenas markdown puro, claro, bem estruturado e pronto para exportação.",
            [
              `Título do relatório: ${title}`,
              `Briefing: ${instruction}`,
              "",
              "Regras:",
              "- Produza um relatório final completo.",
              "- Organize com títulos, subtítulos, listas e tabelas quando fizer sentido.",
              "- Seja factual e consistente com os arquivos de base.",
              "- Se não houver arquivos base, produza um relatório-modelo a partir do briefing.",
              "",
              baseDocuments.length > 0
                ? [
                    "Arquivos de referência:",
                    ...baseDocuments.map((document, index) =>
                      [
                        `Documento ${index + 1}: ${document.name}`,
                        this.describeDocument(document),
                        this.buildDocumentExcerpt(document),
                      ].join("\n"),
                    ),
                  ].join("\n\n")
                : "Nenhum arquivo de referência foi informado.",
            ].join("\n"),
            4096,
          );

          const createdFiles = await documentService.saveGeneratedDocuments(
            outputDirectory,
            title,
            this.ensureMarkdownTitle(reportMarkdown, title),
            formats,
            allowedPaths,
          );

          return [
            `Relatório criado com sucesso em ${createdFiles.length} formato(s).`,
            ...createdFiles.map((file) => `- ${file.name} — ${file.path}`),
          ].join("\n");
        }

        case "listar_arquivos": {
          const dirHint = args.directorio as string | undefined;
          const ext = args.extensao as string | undefined;
          const limit = Math.min((args.limite as number | undefined) ?? 30, 60);
          const scoped = this.resolveScopedDirectories(directories, dirHint);

          const data = await fileService.browseAuthorizedFiles(scoped, { extension: ext, limit });

          if (data.files.length === 0) return "Nenhum arquivo encontrado.";

          const lines = data.files.map((file) => {
            const kb = Math.round(file.size / 1024);
            return `- ${file.name} (${file.directoryName ?? "?"}, ${kb}KB) — ${file.path}`;
          });

          return `${data.files.length} arquivo(s) encontrado(s):\n${lines.join("\n")}`;
        }

        case "buscar_arquivos": {
          const query = args.consulta as string;
          const dirHint = args.directorio as string | undefined;
          const scoped = this.resolveScopedDirectories(directories, dirHint);

          const data = await fileService.browseAuthorizedFiles(scoped, {
            query,
            limit: 30,
          });

          if (data.files.length === 0) {
            return `Nenhum arquivo encontrado para "${query}".`;
          }

          const lines = data.files.map(
            (file) => `- ${file.name} em ${file.directoryName ?? "?"} — ${file.path}`,
          );
          return `${data.files.length} arquivo(s) encontrado(s) para "${query}":\n${lines.join("\n")}`;
        }

        case "arquivos_recentes": {
          const limit = Math.min((args.limite as number | undefined) ?? 20, 40);
          const recent = await fileService.getRecentFiles(directories, limit);

          if (recent.length === 0) return "Nenhum arquivo encontrado.";

          const lines = recent.map((file) => {
            const date = new Date(file.modifiedAt).toLocaleDateString("pt-BR");
            return `- ${file.name} (${file.directoryName ?? "?"}, ${date})`;
          });

          return `${recent.length} arquivo(s) mais recentes:\n${lines.join("\n")}`;
        }

        case "encontrar_duplicados": {
          const groups = await fileService.detectDuplicates(directories);

          if (groups.length === 0) return "Nenhum arquivo duplicado encontrado.";

          const lines = groups.flatMap((group) =>
            group.files.map((file) => `- ${file.name} em ${file.directoryName ?? "?"}`),
          );

          return `${groups.length} grupo(s) de duplicados (${lines.length} arquivos total):\n${lines.join("\n")}`;
        }

        case "organizar_pasta": {
          const dirHint = args.directorio as string;
          const target = directories.find((directory) =>
            directory.name.toLowerCase().includes(dirHint.toLowerCase()),
          );

          if (!target) {
            return `Pasta "${dirHint}" não encontrada nas pastas autorizadas.`;
          }

          try {
            const preview = await taskExecutionService.previewCommand(
              `Organize minha pasta ${target.name}`,
              directories,
              preferences,
            );
            pendingPreviews.push(preview);
            return `Plano preparado para organizar "${target.name}" com ${preview.actions.length} ação(ões). Aguardando confirmação do usuário.`;
          } catch {
            return `Não foi possível gerar o plano para organizar "${dirHint}".`;
          }
        }

        case "criar_pasta": {
          const nome = args.nome as string;
          const pai = args.directorio_pai as string | undefined;
          const cmd = pai
            ? `Nova pasta para cliente ${nome} em ${pai}`
            : `Nova pasta para cliente ${nome}`;

          try {
            const preview = await taskExecutionService.previewCommand(
              cmd,
              directories,
              preferences,
            );
            pendingPreviews.push(preview);
            return `Plano preparado para criar a pasta "${nome}". Aguardando confirmação.`;
          } catch {
            return `Não foi possível preparar a criação da pasta "${nome}".`;
          }
        }

        case "renomear_item": {
          const caminho = args.caminho_arquivo as string;
          const novoNome = args.novo_nome as string;
          const fileName = path.basename(caminho);

          pendingFileOps.push({
            id: crypto.randomUUID(),
            type: "rename",
            filePath: caminho,
            fileName,
            newName: novoNome,
            description: `Renomear "${fileName}" para "${novoNome}"`,
          });

          return `Prévia de renomeação preparada: "${fileName}" → "${novoNome}". Aguardando confirmação.`;
        }

        case "mover_item": {
          const caminho = args.caminho_arquivo as string;
          const destHint = args.diretorio_destino as string;
          const fileName = path.basename(caminho);

          const destDir = directories.find(
            (directory) =>
              directory.name.toLowerCase().includes(destHint.toLowerCase()) ||
              directory.path.toLowerCase().includes(destHint.toLowerCase()),
          );

          if (!destDir) {
            return `Diretório destino "${destHint}" não encontrado nas pastas autorizadas.`;
          }

          pendingFileOps.push({
            id: crypto.randomUUID(),
            type: "move",
            filePath: caminho,
            fileName,
            destDirPath: destDir.path,
            destDirName: destDir.name,
            description: `Mover "${fileName}" para "${destDir.name}"`,
          });

          return `Prévia de movimentação preparada: "${fileName}" → "${destDir.name}". Aguardando confirmação.`;
        }

        case "excluir_item": {
          const caminho = args.caminho_arquivo as string;
          const fileName = path.basename(caminho);

          pendingFileOps.push({
            id: crypto.randomUUID(),
            type: "delete",
            filePath: caminho,
            fileName,
            description: `Excluir permanentemente "${fileName}"`,
          });

          return `Prévia de exclusão preparada para "${fileName}". Aguardando confirmação obrigatória do usuário.`;
        }

        case "pesquisar_na_internet": {
          const query = (args.query as string | undefined)?.trim();
          const foco = (args.foco as string | undefined)?.trim();
          if (!query) return "A busca na internet requer uma 'query'.";
          
          try {
            const searchResult = await this.callGeminiTextWithSearch(
              apiKey,
              model,
              "Você é um pesquisador experiente. Reúna detalhes cruciais sobre a solicitação usando a ferramenta do Google Search. Entregue um resumo completo, sem enrolação.",
              foco ? `Faça uma pesquisa sobre: "${query}"\nFoco da pesquisa: ${foco}` : `Pesquise minuciosamente: "${query}"`,
              2048
            );
            return `Resultados da Pesquisa Web:\n\n${searchResult}`;
          } catch (error) {
            return `Erro ao pesquisar na internet: ${error instanceof Error ? error.message : "Desconhecido"}`;
          }
        }

        default:
          return `Ferramenta "${name}" não reconhecida.`;
      }
    } catch (error) {
      return `Erro ao executar "${name}": ${error instanceof Error ? error.message : "Erro desconhecido"}`;
    }
  }

  private resolveScopedDirectories(
    directories: AuthorizedDirectory[],
    dirHint?: string,
  ) {
    if (!dirHint) return directories;

    const scoped = directories.filter((directory) =>
      directory.name.toLowerCase().includes(dirHint.toLowerCase()) ||
      directory.path.toLowerCase().includes(dirHint.toLowerCase()),
    );

    return scoped.length > 0 ? scoped : directories;
  }

  private async resolveFileReference(
    args: Record<string, unknown>,
    directories: AuthorizedDirectory[],
    fileService: FileService,
  ): Promise<ResolvedFile> {
    const caminho = (args.caminho_arquivo as string | undefined)?.trim();
    const consulta = (args.consulta as string | undefined)?.trim();
    const dirHint = (args.directorio as string | undefined)?.trim();

    if (caminho) {
      return {
        file: {
          name: path.basename(caminho),
          path: caminho,
          extension: path.extname(caminho).toLowerCase(),
          size: 0,
          modifiedAt: "",
          isDirectory: false,
          directoryName: path.basename(path.dirname(caminho)),
        },
      };
    }

    if (!consulta) {
      return {
        error: "Informe o caminho completo ou o nome do arquivo desejado.",
      };
    }

    const scoped = this.resolveScopedDirectories(directories, dirHint);
    const data = await fileService.browseAuthorizedFiles(scoped, {
      query: consulta,
      limit: 12,
    });

    if (data.files.length === 0) {
      return {
        error: `Nenhum arquivo encontrado para "${consulta}".`,
      };
    }

    const exactMatches = data.files.filter(
      (file) => file.name.toLowerCase() === consulta.toLowerCase(),
    );

    if (exactMatches.length === 1) {
      return { file: exactMatches[0] };
    }

    if (data.files.length === 1) {
      return { file: data.files[0] };
    }

    return {
      error: [
        `Encontrei mais de um arquivo para "${consulta}".`,
        "Seja mais específico ou use um destes caminhos:",
        ...data.files.map((file) => `- ${file.name} — ${file.path}`),
      ].join("\n"),
    };
  }

  private describeDocument(document: ReadDocumentResult) {
    const lines = [
      `Tipo: ${document.extension}`,
      `Título: ${document.title}`,
      `Modo de leitura: ${document.metadata.kind}`,
    ];

    if (document.metadata.sheetNames?.length) {
      lines.push(`Abas: ${document.metadata.sheetNames.join(", ")}`);
    }

    if (typeof document.metadata.totalRows === "number") {
      lines.push(`Linhas analisadas: ${document.metadata.totalRows}`);
    }

    if (typeof document.metadata.totalPages === "number") {
      lines.push(`Páginas analisadas: ${document.metadata.totalPages}`);
    }

    return lines.join("\n");
  }

  private buildDocumentExcerpt(document: ReadDocumentResult) {
    const content = document.markdownContent.trim();
    return content.length > 18_000
      ? `${content.slice(0, 18_000)}\n\n[conteudo truncado para análise]`
      : content;
  }

  private ensureMarkdownTitle(markdown: string, fallbackTitle: string) {
    const trimmed = markdown.trim();
    if (!trimmed) {
      return `# ${fallbackTitle}\n\nConteúdo não gerado.`;
    }

    if (trimmed.startsWith("#")) {
      return trimmed;
    }

    return `# ${fallbackTitle}\n\n${trimmed}`;
  }

  private parseSingleFormat(rawValue: unknown): SupportedDocumentOutput {
    if (typeof rawValue !== "string") return "md";

    const normalized = rawValue.trim().toLowerCase() as SupportedDocumentOutput;
    return SUPPORTED_OUTPUT_FORMATS.has(normalized) ? normalized : "md";
  }

  private parseFormats(rawValue: unknown): SupportedDocumentOutput[] {
    const sourceValues = Array.isArray(rawValue)
      ? rawValue
      : typeof rawValue === "string"
        ? rawValue.split(",")
        : ["md"];

    const formats = sourceValues
      .map((value) => String(value).trim().toLowerCase() as SupportedDocumentOutput)
      .filter((value) => SUPPORTED_OUTPUT_FORMATS.has(value));

    return formats.length > 0 ? Array.from(new Set(formats)) : ["md"];
  }

  private resolveOutputDirectory(
    dirHint: string | undefined,
    directories: AuthorizedDirectory[],
    fallbackFilePath?: string,
  ) {
    if (dirHint) {
      const match = directories.find(
        (directory) =>
          directory.name.toLowerCase().includes(dirHint.toLowerCase()) ||
          directory.path.toLowerCase().includes(dirHint.toLowerCase()),
      );

      if (match) return match.path;
    }

    if (fallbackFilePath) {
      return path.dirname(fallbackFilePath);
    }

    const documentsDirectory = directories.find((directory) =>
      directory.name.toLowerCase().includes("documents"),
    );

    return documentsDirectory?.path ?? directories[0]?.path ?? "";
  }

  private fileRefToArgs(value: string): Record<string, unknown> {
    return path.isAbsolute(value)
      ? { caminho_arquivo: value }
      : { consulta: value };
  }

  private buildSystemPrompt(directories: AuthorizedDirectory[]): string {
    const dirList =
      directories.length > 0
        ? directories.map((directory) => `  - ${directory.name}: ${directory.path}`).join("\n")
        : "  Nenhuma pasta autorizada configurada ainda.";

    const today = new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return [
      "Você é o assistente operacional do Cowork, um gerenciador de arquivos local inteligente.",
      `Data atual: ${today}`,
      "",
      "Pastas autorizadas:",
      dirList,
      "",
      "Diretrizes:",
      "- Responda sempre em português brasileiro, de forma concisa e direta",
      "- Use a ferramenta pesquisar_na_internet se o usuário fizer perguntas sobre o mundo exterior ou pedir um relatório cujos dados requerem internet (ex: 'Notícias de hoje', 'Cotação do dólar')",
      "- **Menção de Arquivos Locals (@):** Quando o usuário menciona arquivos (identificado no topo da mensagem como '[Arquivos mencionados: ...]') e pede um relatório, análise ou reorganização, você DEVE extrair esses caminhos de arquivo e passá-los para as ferramentas correspondentes (ex: usar 'arquivos_base' em 'criar_relatorio' ou 'caminho_arquivo' em 'analisar_documento')",
      "- Se houver arquivos marcados, priorize-os; se o tema for externo e não houver arquivos, use 'pesquisar_na_internet'",
      "- Use suas ferramentas de sistema de arquivos para interagir com o desktop",
      "- Quando o usuário pedir para abrir um arquivo, use a ferramenta abrir_arquivo",
      "- Quando o usuário quiser entender, revisar ou resumir um documento, use analisar_documento",
      "- Quando o usuário quiser reorganizar conteúdo de .md, .docx, .pdf ou planilhas, use reorganizar_documento",
      "- Quando o usuário pedir um relatório novo, use criar_relatorio",
      "- Ao reorganizar um documento existente, preserve o original e crie uma nova versão",
      "- Para ações destrutivas (excluir, mover, renomear arquivos/pastas), use as ferramentas de item adequadas e não as execute em bash",
      "- Quando listar arquivos, apresente-os de forma organizada e legível",
      "- Se não entender a solicitação, peça clarificação",
      "- Seja proativo: sugira ações relevantes com base no que encontrar",
    ].join("\n");
  }

  private async callGeminiText(
    apiKey: string,
    model: string,
    systemInstruction: string,
    prompt: string,
    maxOutputTokens = 2048,
  ) {
    const response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens,
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      const payload = (await response.json()) as GeminiResponse;
      throw new Error(
        payload.error?.message ?? `Gemini respondeu com status ${response.status}`,
      );
    }

    const payload = (await response.json()) as GeminiResponse;
    const text = payload.candidates?.[0]?.content?.parts
      ?.filter((part): part is { text: string } => "text" in part)
      .map((part) => part.text)
      .join("")
      .trim();

    if (!text) {
      throw new Error("O modelo não retornou conteúdo utilizável.");
    }

    return text;
  }

  private async callGeminiTextWithSearch(
    apiKey: string,
    model: string,
    systemInstruction: string,
    prompt: string,
    maxOutputTokens = 2048,
  ) {
    const response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: {
          temperature: 0.2, // Low temp for more factual search reporting
          maxOutputTokens,
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      const payload = (await response.json()) as GeminiResponse;
      throw new Error(
        payload.error?.message ?? `Gemini respondeu com status ${response.status}`,
      );
    }

    const payload = (await response.json()) as GeminiResponse;
    const text = payload.candidates?.[0]?.content?.parts
      ?.filter((part): part is { text: string } => "text" in part)
      .map((part) => part.text)
      .join("")
      .trim();

    if (!text) throw new Error("A pesquisa web falhou em retornar conteúdo.");
    return text;
  }

  private async callGemini(
    apiKey: string,
    model: string,
    systemInstruction: string,
    contents: GeminiTurn[],
  ): Promise<GeminiResponse> {
    const response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents,
        tools: [TOOLS],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const payload = (await response.json()) as GeminiResponse;
      throw new Error(
        payload.error?.message ?? `Gemini respondeu com status ${response.status}`,
      );
    }

    return response.json() as Promise<GeminiResponse>;
  }
}
