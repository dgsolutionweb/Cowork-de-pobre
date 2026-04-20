import fs from "node:fs/promises";
import path from "node:path";
import { dialog, type BrowserWindow } from "electron";
import type {
  CreateProjectInput,
  PermissionPolicy,
  ProjectContextItem,
  ProjectDetail,
  ProjectInstruction,
  ProjectInstructionScope,
  ProjectMemory,
  ProjectSummary,
} from "../../shared/types";
import { createId } from "../utils/id";
import { normalizePath } from "../utils/pathSafety";
import { ProjectsRepository } from "../repositories/projectsRepository";
import { ProjectInstructionsRepository } from "../repositories/projectInstructionsRepository";
import { PermissionPoliciesRepository } from "../repositories/permissionPoliciesRepository";
import { ProjectContextItemsRepository } from "../repositories/projectContextItemsRepository";
import { ProjectMemoriesRepository } from "../repositories/projectMemoriesRepository";
import { PermissionsService } from "./permissionsService";
import { PreferencesService } from "./preferencesService";

const sanitizeProjectFolderName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();

export class ProjectsService {
  constructor(
    private readonly projectsRepository: ProjectsRepository,
    private readonly instructionsRepository: ProjectInstructionsRepository,
    private readonly policiesRepository: PermissionPoliciesRepository,
    private readonly contextItemsRepository: ProjectContextItemsRepository,
    private readonly memoriesRepository: ProjectMemoriesRepository,
    private readonly permissionsService: PermissionsService,
    private readonly preferencesService: PreferencesService,
  ) {}

  list(): ProjectSummary[] {
    return this.projectsRepository.list();
  }

  get(id: string): ProjectDetail | null {
    const project = this.projectsRepository.get(id);
    if (!project) return null;

    return {
      project,
      instructions: this.instructionsRepository.listByProject(id),
      policy: this.getOrCreatePolicy(project),
      contextItems: this.contextItemsRepository.listByProject(id),
      memories: this.memoriesRepository.listByProject(id),
    };
  }

  async create(input: CreateProjectInput): Promise<ProjectDetail> {
    const projectName = input.name.trim();
    if (!projectName) throw new Error("Nome do projeto obrigatório.");

    const rootPath = await this.resolveRootPath(input);
    await this.ensureDirectory(rootPath);

    const now = new Date().toISOString();
    const project: ProjectSummary = {
      id: createId(),
      name: projectName,
      rootPath,
      status: "active",
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    };

    this.projectsRepository.insert(project);
    this.permissionsService.add(rootPath, projectName);
    const policy = this.getOrCreatePolicy(project);

    const instructions: ProjectInstruction[] = [];
    if (input.instructions?.trim()) {
      instructions.push(
        this.instructionsRepository.upsert({
          id: createId(),
          projectId: project.id,
          scope: "project",
          content: input.instructions.trim(),
          updatedAt: now,
        }),
      );
    }

    this.preferencesService.update({ activeProjectId: project.id });

    return {
      project,
      instructions,
      policy,
      contextItems: [],
      memories: [],
    };
  }

  setActive(id: string): ProjectSummary {
    const project = this.projectsRepository.get(id);
    if (!project) throw new Error("Projeto não encontrado.");
    const now = new Date().toISOString();
    this.projectsRepository.touchOpenedAt(id, now);
    this.preferencesService.update({ activeProjectId: id });
    return this.projectsRepository.get(id)!;
  }

  archive(id: string): ProjectSummary {
    const project = this.projectsRepository.get(id);
    if (!project) throw new Error("Projeto não encontrado.");
    const updatedAt = new Date().toISOString();
    this.projectsRepository.updateStatus(id, "archived", updatedAt);

    const prefs = this.preferencesService.get();
    if (prefs.activeProjectId === id) {
      this.preferencesService.update({ activeProjectId: "" });
    }

    return this.projectsRepository.get(id)!;
  }

  delete(id: string): void {
    const project = this.projectsRepository.get(id);
    if (!project) throw new Error("Projeto não encontrado.");
    
    this.projectsRepository.delete(id);

    const prefs = this.preferencesService.get();
    if (prefs.activeProjectId === id) {
      this.preferencesService.update({ activeProjectId: "" });
    }
  }

  updateInstruction(
    projectId: string,
    input: { scope: ProjectInstructionScope; path?: string; content: string },
  ): ProjectInstruction {
    const project = this.projectsRepository.get(projectId);
    if (!project) throw new Error("Projeto não encontrado.");

    return this.instructionsRepository.upsert({
      id: createId(),
      projectId,
      scope: input.scope,
      path: input.path ? normalizePath(input.path) : undefined,
      content: input.content.trim(),
      updatedAt: new Date().toISOString(),
    });
  }

  updatePolicy(
    projectId: string,
    partial: Partial<Pick<PermissionPolicy, "domainAllowlist" | "allowDestructive" | "fileRoots">>,
  ): PermissionPolicy {
    const project = this.projectsRepository.get(projectId);
    if (!project) throw new Error("Projeto não encontrado.");

    const current = this.getOrCreatePolicy(project);
    const next: PermissionPolicy = {
      ...current,
      fileRoots: partial.fileRoots?.map(normalizePath) ?? current.fileRoots,
      domainAllowlist:
        partial.domainAllowlist?.map((entry) => entry.trim()).filter(Boolean) ??
        current.domainAllowlist,
      allowDestructive: partial.allowDestructive ?? current.allowDestructive,
      updatedAt: new Date().toISOString(),
    };

    return this.policiesRepository.upsert(next);
  }

  addContextItem(
    projectId: string,
    input: { type: ProjectContextItem["type"]; value: string; metadata?: any },
  ): ProjectContextItem {
    const project = this.projectsRepository.get(projectId);
    if (!project) throw new Error("Projeto não encontrado.");

    return this.contextItemsRepository.insert({
      id: createId(),
      projectId,
      type: input.type,
      value: input.value,
      metadata: input.metadata,
      createdAt: new Date().toISOString(),
    });
  }

  removeContextItem(projectId: string, itemId: string): void {
    const item = this.contextItemsRepository.listByProject(projectId).find((i) => i.id === itemId);
    if (!item) throw new Error("Item de contexto não encontrado ou não pertence a este projeto.");
    this.contextItemsRepository.delete(itemId);
  }

  saveMemory(
    projectId: string,
    input: { key: string; value: string; category: ProjectMemory["category"] },
  ): ProjectMemory {
    const now = new Date().toISOString();
    return this.memoriesRepository.upsert({
      id: createId(),
      projectId,
      key: input.key,
      value: input.value,
      category: input.category,
      createdAt: now,
      updatedAt: now,
    });
  }

  listMemories(projectId: string): ProjectMemory[] {
    return this.memoriesRepository.listByProject(projectId);
  }

  async pickRootFolder(window: BrowserWindow) {
    return this.pickFolder(window, "Selecionar pasta raiz do projeto");
  }

  async pickParentFolder(window: BrowserWindow) {
    return this.pickFolder(window, "Selecionar pasta pai do projeto");
  }

  private async resolveRootPath(input: CreateProjectInput) {
    if (input.mode === "existing") {
      if (!input.rootPath?.trim()) throw new Error("Selecione uma pasta existente.");
      return normalizePath(input.rootPath);
    }

    if (!input.parentPath?.trim()) throw new Error("Selecione a pasta pai do projeto.");
    const folderName = sanitizeProjectFolderName(input.name);
    if (!folderName) throw new Error("Nome do projeto inválido.");
    return normalizePath(path.join(input.parentPath, folderName));
  }

  private async ensureDirectory(rootPath: string) {
    await fs.mkdir(rootPath, { recursive: true });
    const stats = await fs.stat(rootPath);
    if (!stats.isDirectory()) throw new Error("Caminho de projeto inválido.");
  }

  private getOrCreatePolicy(project: ProjectSummary): PermissionPolicy {
    const existing = this.policiesRepository.getByProject(project.id);
    if (existing) return existing;

    const now = new Date().toISOString();
    return this.policiesRepository.upsert({
      id: createId(),
      projectId: project.id,
      fileRoots: [project.rootPath],
      domainAllowlist: [],
      allowDestructive: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  private async pickFolder(window: BrowserWindow, title: string) {
    const result = await dialog.showOpenDialog(window, {
      title,
      properties: ["openDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return normalizePath(result.filePaths[0]);
  }
}
