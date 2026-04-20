import path from "node:path";
import type {
  AppPreferences,
  AuthorizedDirectory,
  CommandPreview,
  ExecutionResult,
  FileItem,
  HistoryEntry,
  PreviewAction,
} from "../../shared/types";
import { createId } from "../utils/id";
import { FileService } from "./fileService";
import { CommandParserService } from "./commandParserService";
import { HistoryService } from "./historyService";

type DraftContext = {
  preview: CommandPreview;
  targetDirectory?: AuthorizedDirectory;
};

export class TaskExecutionService {
  private readonly drafts = new Map<string, DraftContext>();

  constructor(
    private readonly parser: CommandParserService,
    private readonly fileService: FileService,
    private readonly historyService: HistoryService,
  ) {}

  async previewCommand(
    commandText: string,
    directories: AuthorizedDirectory[],
    preferences: AppPreferences,
  ): Promise<CommandPreview> {
    const parsed = await this.parser.parse(commandText, { directories, preferences });
    const createdAt = new Date().toISOString();
    const draftId = createId();
    const targetDirectory = this.resolveTargetDirectory(parsed, directories);

    const preview = await this.buildPreview(
      draftId,
      commandText,
      parsed,
      directories,
      targetDirectory,
      createdAt,
    );

    this.drafts.set(draftId, { preview, targetDirectory });
    return preview;
  }

  cancelDraft(draftId: string) {
    this.drafts.delete(draftId);
  }

  async executeDraft(
    draftId: string,
    directories: AuthorizedDirectory[],
    projectId?: string,
  ): Promise<ExecutionResult> {
    const draft = this.drafts.get(draftId);

    if (!draft) {
      throw new Error("Prévia não encontrada. Gere uma nova análise antes de executar.");
    }

    const allowedPaths = directories.map((directory) => directory.path);
    const executedAt = new Date().toISOString();
    const historyId = createId();

    try {
      const { affectedFiles, logs, summary } = await this.performExecution(
        draft.preview,
        draft.targetDirectory,
        allowedPaths,
        directories,
      );

      const result: ExecutionResult = {
        historyId,
        status: "completed",
        summary,
        affectedFiles,
        logs,
        executedAt,
      };

      const historyEntry: HistoryEntry = {
        id: historyId,
        projectId,
        commandText: draft.preview.commandText,
        intent: draft.preview.parsed.intent,
        status: result.status,
        confirmed: true,
        summary: result.summary,
        affectedFiles: result.affectedFiles,
        createdAt: draft.preview.createdAt,
        executedAt,
      };

      this.historyService.save(historyEntry);
      this.drafts.delete(draftId);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      const failure: ExecutionResult = {
        historyId,
        status: "failed",
        summary: "A execução falhou antes de concluir todas as ações.",
        affectedFiles: [],
        logs: [message],
        errorMessage: message,
        executedAt,
      };

      this.historyService.save({
        id: historyId,
        projectId,
        commandText: draft.preview.commandText,
        intent: draft.preview.parsed.intent,
        status: failure.status,
        confirmed: true,
        summary: failure.summary,
        affectedFiles: [],
        createdAt: draft.preview.createdAt,
        executedAt,
        errorMessage: message,
      });

      this.drafts.delete(draftId);
      return failure;
    }
  }

  private resolveTargetDirectory(
    parsed: CommandPreview["parsed"],
    directories: AuthorizedDirectory[],
  ) {
    const targetDirectoryHint = typeof parsed.parameters.targetDirectoryHint === "string"
      ? parsed.parameters.targetDirectoryHint
      : undefined;

    if (targetDirectoryHint) {
      const normalizedHint = targetDirectoryHint.toLowerCase();
      const hintedDirectory = directories.find((directory) =>
        directory.name.toLowerCase() === normalizedHint ||
        directory.name.toLowerCase().includes(normalizedHint) ||
        normalizedHint.includes(directory.name.toLowerCase())
      );

      if (hintedDirectory) {
        return hintedDirectory;
      }
    }

    const findByName = (name: string) =>
      directories.find((directory) =>
        directory.name.toLowerCase().includes(name.toLowerCase())
      );

    if (parsed.intent === "organize_downloads" || parsed.intent === "move_images") {
      return findByName("downloads") ?? directories[0];
    }

    if (parsed.intent === "create_client_folder" || parsed.intent === "rename_files") {
      return findByName("documents") ?? directories[0];
    }

    return directories[0];
  }

  private async buildPreview(
    draftId: string,
    commandText: string,
    parsed: CommandPreview["parsed"],
    directories: AuthorizedDirectory[],
    targetDirectory: AuthorizedDirectory | undefined,
    createdAt: string,
  ): Promise<CommandPreview> {
    if (directories.length === 0) {
      return {
        draftId,
        commandText,
        parsed,
        headline: "Nenhuma pasta autorizada configurada",
        explanation:
          "Adicione pelo menos uma pasta autorizada para começar a operar com segurança.",
        risks: ["Sem diretórios autorizados não é possível executar ações locais."],
        actions: [],
        files: [],
        createdAt,
        requiresConfirmation: false,
      };
    }

    switch (parsed.intent) {
      case "organize_downloads":
        return this.previewOrganizeDownloads(
          draftId,
          commandText,
          parsed,
          targetDirectory,
          createdAt,
        );
      case "list_pdfs":
        return this.previewListPdfs(draftId, commandText, parsed, directories, createdAt);
      case "move_images":
        return this.previewMoveImages(
          draftId,
          commandText,
          parsed,
          targetDirectory,
          createdAt,
        );
      case "rename_files":
        return this.previewRenameFiles(
          draftId,
          commandText,
          parsed,
          targetDirectory,
          createdAt,
        );
      case "create_client_folder":
        return this.previewCreateClientFolder(
          draftId,
          commandText,
          parsed,
          targetDirectory,
          createdAt,
        );
      case "find_duplicates":
        return this.previewDuplicates(draftId, commandText, parsed, directories, createdAt);
      case "show_recent_files":
        return this.previewRecentFiles(draftId, commandText, parsed, directories, createdAt);
      default:
        return {
          draftId,
          commandText,
          parsed,
          headline: "Comando ainda não suportado com execução automática",
          explanation:
            "A arquitetura já está pronta para expandir intenções futuras e integrar modelos externos.",
          risks: ["Nada será executado até que a intenção seja refinada."],
          actions: [
            {
              id: createId(),
              type: "analyze",
              label: "Registrar intenção como análise sem efeitos colaterais.",
              risk: "baixo",
              fileCount: 0,
            },
          ],
          files: [],
          createdAt,
          requiresConfirmation: false,
        };
    }
  }

  private async previewOrganizeDownloads(
    draftId: string,
    commandText: string,
    parsed: CommandPreview["parsed"],
    targetDirectory: AuthorizedDirectory | undefined,
    createdAt: string,
  ): Promise<CommandPreview> {
    if (!targetDirectory) {
      throw new Error("Nenhuma pasta alvo disponível para organizar.");
    }

    const categorized = await this.fileService.categorizeTopLevelFiles(targetDirectory);
    const files = categorized.map((entry) => ({
      ...entry.file,
      previewLabel: `Mover para ${path.basename(entry.destinationDirectory)}`,
    }));

    const actionsMap = new Map<string, PreviewAction>();

    for (const entry of categorized) {
      const key = entry.destinationDirectory;
      const current = actionsMap.get(key);
      actionsMap.set(key, {
        id: current?.id ?? createId(),
        type: "move",
        label: `Agrupar arquivos em ${path.basename(entry.destinationDirectory)}`,
        source: targetDirectory.path,
        destination: entry.destinationDirectory,
        risk: "Arquivos serão movidos para subpastas categorizadas.",
        fileCount: (current?.fileCount ?? 0) + 1,
      });
    }

    return {
      draftId,
      commandText,
      parsed,
      headline: `Organizar ${targetDirectory.name} por tipo`,
      explanation:
        "Vou mover arquivos soltos da raiz para pastas dedicadas como PDFs, Imagens e Documentos.",
      risks: [
        "Arquivos sairão da raiz da pasta alvo.",
        "Se já existir um nome idêntico no destino, será criado um sufixo incremental.",
      ],
      actions: Array.from(actionsMap.values()),
      files,
      createdAt,
      requiresConfirmation: true,
    };
  }

  private async previewListPdfs(
    draftId: string,
    commandText: string,
    parsed: CommandPreview["parsed"],
    directories: AuthorizedDirectory[],
    createdAt: string,
  ): Promise<CommandPreview> {
    const files = await this.fileService.getFilesByExtension(directories, [".pdf"], 24);
    return {
      draftId,
      commandText,
      parsed,
      headline: `Encontrei ${files.length} PDFs nas pastas autorizadas`,
      explanation:
        "A operação é apenas analítica e não altera nenhum arquivo.",
      risks: ["Nenhuma ação destrutiva será executada."],
      actions: [
        {
          id: createId(),
          type: "analyze",
          label: "Listar PDFs com nome, pasta e data de modificação.",
          risk: "baixo",
          fileCount: files.length,
        },
      ],
      files,
      createdAt,
      requiresConfirmation: false,
    };
  }

  private async previewMoveImages(
    draftId: string,
    commandText: string,
    parsed: CommandPreview["parsed"],
    targetDirectory: AuthorizedDirectory | undefined,
    createdAt: string,
  ): Promise<CommandPreview> {
    if (!targetDirectory) {
      throw new Error("Nenhuma pasta alvo disponível para mover imagens.");
    }

    const files = (await this.fileService.getTopLevelFiles(targetDirectory, 120)).filter((file) =>
      [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(file.extension)
    );

    return {
      draftId,
      commandText,
      parsed,
      headline: `Mover imagens de ${targetDirectory.name}`,
      explanation:
        "As imagens serão centralizadas em uma subpasta Imagens dentro da pasta autorizada.",
      risks: ["Os arquivos mudarão de local, mas continuarão dentro da área autorizada."],
      actions: [
        {
          id: createId(),
          type: "move",
          label: "Mover imagens para a subpasta Imagens.",
          source: targetDirectory.path,
          destination: path.join(targetDirectory.path, "Imagens"),
          risk: "Mudança física de localização dos arquivos de imagem.",
          fileCount: files.length,
        },
      ],
      files: files.map((file) => ({
        ...file,
        previewLabel: "Mover para Imagens",
      })),
      createdAt,
      requiresConfirmation: true,
    };
  }

  private async previewRenameFiles(
    draftId: string,
    commandText: string,
    parsed: CommandPreview["parsed"],
    targetDirectory: AuthorizedDirectory | undefined,
    createdAt: string,
  ): Promise<CommandPreview> {
    if (!targetDirectory) {
      throw new Error("Nenhuma pasta alvo disponível para renomear arquivos.");
    }

    const files = (await this.fileService.getTopLevelFiles(targetDirectory, 24)).filter((file) =>
      !file.name.startsWith(".")
    );

    return {
      draftId,
      commandText,
      parsed,
      headline: `Padronizar nomes em ${targetDirectory.name}`,
      explanation:
        "Vou aplicar um padrão com data e sequência para os arquivos da raiz da pasta alvo.",
      risks: ["Aplicar novos nomes pode impactar referências externas a esses arquivos."],
      actions: [
        {
          id: createId(),
          type: "rename",
          label: "Renomear arquivos com data + item sequencial.",
          source: targetDirectory.path,
          risk: "Os nomes originais serão substituídos por um padrão consistente.",
          fileCount: files.length,
        },
      ],
      files: files.map((file, index) => ({
        ...file,
        previewLabel: `Novo nome sugerido: item-${String(index + 1).padStart(2, "0")}${file.extension}`,
      })),
      createdAt,
      requiresConfirmation: true,
    };
  }

  private async previewCreateClientFolder(
    draftId: string,
    commandText: string,
    parsed: CommandPreview["parsed"],
    targetDirectory: AuthorizedDirectory | undefined,
    createdAt: string,
  ): Promise<CommandPreview> {
    if (!targetDirectory) {
      throw new Error("Nenhuma pasta autorizada disponível para criar pasta de cliente.");
    }

    const clientName = String(parsed.parameters.clientName ?? "Novo Cliente");
    const destination = path.join(targetDirectory.path, clientName);

    return {
      draftId,
      commandText,
      parsed,
      headline: `Criar pasta do cliente ${clientName}`,
      explanation:
        "A estrutura inicial será criada dentro da pasta autorizada escolhida para documentos/clientes.",
      risks: ["Uma nova pasta será adicionada ao diretório autorizado."],
      actions: [
        {
          id: createId(),
          type: "create-folder",
          label: `Criar a pasta ${clientName}.`,
          destination,
          risk: "Criação de uma nova estrutura de diretório.",
          fileCount: 0,
        },
      ],
      files: [],
      createdAt,
      requiresConfirmation: true,
    };
  }

  private async previewDuplicates(
    draftId: string,
    commandText: string,
    parsed: CommandPreview["parsed"],
    directories: AuthorizedDirectory[],
    createdAt: string,
  ): Promise<CommandPreview> {
    const duplicates = await this.fileService.detectDuplicates(directories, 12);
    const files = duplicates.flatMap((entry) =>
      entry.files.map((file) => ({
        ...file,
        previewLabel: `Hash duplicado: ${entry.hash.slice(0, 10)}`,
      }))
    );

    return {
      draftId,
      commandText,
      parsed,
      headline: `Foram encontrados ${duplicates.length} grupos de duplicados`,
      explanation:
        "Nada será excluído automaticamente. A lista serve para revisão antes de qualquer ação.",
      risks: ["Arquivos apenas serão exibidos nesta etapa."],
      actions: [
        {
          id: createId(),
          type: "analyze",
          label: "Agrupar duplicados por hash para revisão manual.",
          risk: "baixo",
          fileCount: files.length,
        },
      ],
      files,
      createdAt,
      requiresConfirmation: false,
    };
  }

  private async previewRecentFiles(
    draftId: string,
    commandText: string,
    parsed: CommandPreview["parsed"],
    directories: AuthorizedDirectory[],
    createdAt: string,
  ): Promise<CommandPreview> {
    const files = await this.fileService.getRecentFiles(directories, 20);

    return {
      draftId,
      commandText,
      parsed,
      headline: "Arquivos recentes prontos para inspeção",
      explanation:
        "A lista destaca os itens mais novos ou recentemente alterados nas áreas autorizadas.",
      risks: ["Consulta sem alterações no disco."],
      actions: [
        {
          id: createId(),
          type: "analyze",
          label: "Listar arquivos recentes por data de modificação.",
          risk: "baixo",
          fileCount: files.length,
        },
      ],
      files,
      createdAt,
      requiresConfirmation: false,
    };
  }

  private async performExecution(
    preview: CommandPreview,
    targetDirectory: AuthorizedDirectory | undefined,
    allowedPaths: string[],
    _directories: AuthorizedDirectory[],
  ) {
    switch (preview.parsed.intent) {
      case "organize_downloads": {
        if (!targetDirectory) {
          throw new Error("Diretório de Downloads indisponível.");
        }

        const categorized = await this.fileService.categorizeTopLevelFiles(targetDirectory);
        const moved: FileItem[] = [];
        for (const group of preview.actions) {
          const files = categorized
            .filter((entry) => entry.destinationDirectory === group.destination)
            .map((entry) => entry.file);
          const result = await this.fileService.moveFiles(
            files,
            group.destination ?? targetDirectory.path,
            allowedPaths,
          );
          moved.push(...result);
        }

        return {
          affectedFiles: moved,
          logs: [`${moved.length} arquivos movidos em ${targetDirectory.name}.`],
          summary: `${moved.length} arquivos foram organizados em subpastas temáticas.`,
        };
      }
      case "move_images": {
        if (!targetDirectory || preview.actions.length === 0) {
          throw new Error("Prévia de imagens inválida.");
        }

        const topLevelFiles = await this.fileService.getTopLevelFiles(targetDirectory, 120);
        const images = topLevelFiles.filter((file) =>
          [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(file.extension)
        );
        const destination = preview.actions[0].destination ?? targetDirectory.path;
        const moved = await this.fileService.moveFiles(images, destination, allowedPaths);

        return {
          affectedFiles: moved,
          logs: [`${moved.length} imagens movidas para ${path.basename(destination)}.`],
          summary: `${moved.length} imagens foram organizadas em uma pasta dedicada.`,
        };
      }
      case "rename_files": {
        if (!targetDirectory) {
          throw new Error("Diretório para renomeação indisponível.");
        }

        const files = await this.fileService.getTopLevelFiles(targetDirectory, 24);
        const renamed = await this.fileService.renameFiles(files, allowedPaths, "arquivo");

        return {
          affectedFiles: renamed,
          logs: [`${renamed.length} arquivos receberam nomes padronizados.`],
          summary: `${renamed.length} arquivos foram renomeados com padrão profissional.`,
        };
      }
      case "create_client_folder": {
        if (!targetDirectory || preview.actions.length === 0) {
          throw new Error("Destino da pasta de cliente não encontrado.");
        }

        const createdPath = await this.fileService.createDirectory(
          preview.actions[0].destination ?? targetDirectory.path,
          allowedPaths,
        );

        return {
          affectedFiles: [],
          logs: [`Pasta criada em ${createdPath}.`],
          summary: `A pasta do cliente foi criada em ${targetDirectory.name}.`,
        };
      }
      case "list_pdfs":
      case "find_duplicates":
      case "show_recent_files":
      case "unknown":
      default:
        return {
          affectedFiles: preview.files,
          logs: ["Operação analítica concluída sem mudanças no disco."],
          summary: preview.headline,
        };
    }
  }
}
