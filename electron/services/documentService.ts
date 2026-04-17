import fs from "node:fs";
import fsPromises from "node:fs/promises";
import type { Require } from "node:module";
import path from "node:path";
import mammoth from "mammoth";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import type { FileItem } from "../../shared/types";
import { ensureAllowedPath } from "../utils/pathSafety";

export type SupportedDocumentOutput = "md" | "docx" | "pdf";

export type ReadDocumentResult = {
  path: string;
  name: string;
  extension: string;
  title: string;
  textContent: string;
  markdownContent: string;
  metadata: {
    kind: "text" | "spreadsheet";
    sheetNames?: string[];
    totalRows?: number;
    totalPages?: number;
  };
};

const TEXT_DOCUMENT_EXTENSIONS = new Set([".md", ".txt", ".docx", ".pdf"]);
const SPREADSHEET_EXTENSIONS = new Set([".xlsx", ".xls", ".csv"]);

const headingMap: Record<number, HeadingLevel> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

type MarkdownLine =
  | { type: "heading"; level: number; text: string }
  | { type: "bullet"; text: string }
  | { type: "code"; text: string }
  | { type: "table"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "blank"; text: string };

const toFileItem = async (filePath: string): Promise<FileItem> => {
  const stats = await fsPromises.stat(filePath);
  return {
    name: path.basename(filePath),
    path: filePath,
    extension: path.extname(filePath).toLowerCase(),
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
    isDirectory: stats.isDirectory(),
    directoryName: path.basename(path.dirname(filePath)),
  };
};

const titleFromPath = (filePath: string) =>
  path.basename(filePath, path.extname(filePath)).replace(/[-_]+/g, " ").trim() ||
  path.basename(filePath);

const sanitizeBaseName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase() || "documento";

const stripInlineMarkdown = (value: string) =>
  value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .trim();

const splitMarkdownLines = (markdown: string): MarkdownLine[] =>
  markdown.split(/\r?\n/).map((rawLine) => {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      return { type: "blank", text: "" };
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      return {
        type: "heading",
        level: headingMatch[1].length,
        text: stripInlineMarkdown(headingMatch[2]),
      };
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      return { type: "bullet", text: stripInlineMarkdown(bulletMatch[1]) };
    }

    if (line.startsWith("```")) {
      return { type: "blank", text: "" };
    }

    if (line.startsWith("|")) {
      return { type: "table", text: line };
    }

    if (line.startsWith("    ")) {
      return { type: "code", text: line.trim() };
    }

    return { type: "paragraph", text: stripInlineMarkdown(line) };
  });

const truncateText = (value: string, limit = 24_000) =>
  value.length > limit ? `${value.slice(0, limit)}\n\n[conteudo truncado]` : value;

type PdfParseModule = {
  PDFParse: new (options: { data: Uint8Array }) => {
    getText: (options?: { pageJoiner?: string }) => Promise<{
      text: string;
      pages?: Array<{ text: string; num: number }>;
    }>;
    destroy: () => Promise<void>;
  };
};

let pdfParseModulePromise: Promise<PdfParseModule> | null = null;

class MinimalDOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  constructor(init?: number[]) {
    if (Array.isArray(init)) {
      this.a = init[0] ?? 1;
      this.b = init[1] ?? 0;
      this.c = init[2] ?? 0;
      this.d = init[3] ?? 1;
      this.e = init[4] ?? 0;
      this.f = init[5] ?? 0;
    }
  }

  multiplySelf(other: MinimalDOMMatrix) {
    const a = this.a * other.a + this.c * other.b;
    const b = this.b * other.a + this.d * other.b;
    const c = this.a * other.c + this.c * other.d;
    const d = this.b * other.c + this.d * other.d;
    const e = this.a * other.e + this.c * other.f + this.e;
    const f = this.b * other.e + this.d * other.f + this.f;

    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
    return this;
  }

  preMultiplySelf(other: MinimalDOMMatrix) {
    const clone = new MinimalDOMMatrix([this.a, this.b, this.c, this.d, this.e, this.f]);
    this.a = other.a;
    this.b = other.b;
    this.c = other.c;
    this.d = other.d;
    this.e = other.e;
    this.f = other.f;
    return this.multiplySelf(clone);
  }

  translate(x = 0, y = 0) {
    return this.multiplySelf(new MinimalDOMMatrix([1, 0, 0, 1, x, y]));
  }

  scale(scaleX = 1, scaleY = scaleX) {
    return this.multiplySelf(new MinimalDOMMatrix([scaleX, 0, 0, scaleY, 0, 0]));
  }

  invertSelf() {
    const determinant = this.a * this.d - this.b * this.c;
    if (!determinant) {
      this.a = NaN;
      this.b = NaN;
      this.c = NaN;
      this.d = NaN;
      this.e = NaN;
      this.f = NaN;
      return this;
    }

    const a = this.d / determinant;
    const b = -this.b / determinant;
    const c = -this.c / determinant;
    const d = this.a / determinant;
    const e = (this.c * this.f - this.d * this.e) / determinant;
    const f = (this.b * this.e - this.a * this.f) / determinant;

    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
    return this;
  }
}

const ensurePdfPolyfills = () => {
  if (typeof globalThis.DOMMatrix === "undefined") {
    globalThis.DOMMatrix = MinimalDOMMatrix as typeof DOMMatrix;
  }

  if (typeof globalThis.ImageData === "undefined") {
    globalThis.ImageData = class ImageDataPolyfill {
      data: Uint8ClampedArray;
      width: number;
      height: number;

      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
      }
    } as typeof ImageData;
  }

  if (typeof globalThis.Path2D === "undefined") {
    globalThis.Path2D = class Path2DPolyfill {
      addPath() {}
      moveTo() {}
      lineTo() {}
      closePath() {}
      rect() {}
    } as typeof Path2D;
  }
};

const loadPdfParseModule = async () => {
  if (!pdfParseModulePromise) {
    ensurePdfPolyfills();

    const pdfParse = require("pdf-parse");
    pdfParseModulePromise = Promise.resolve(pdfParse as PdfParseModule);
  }

  return pdfParseModulePromise;
};

export class DocumentService {
  async readDocument(filePath: string, allowedPaths: string[]): Promise<ReadDocumentResult> {
    ensureAllowedPath(filePath, allowedPaths, "Leitura de documento");

    const stats = await fsPromises.stat(filePath);
    if (!stats.isFile()) {
      throw new Error("O caminho informado não é um arquivo.");
    }

    const extension = path.extname(filePath).toLowerCase();
    if (TEXT_DOCUMENT_EXTENSIONS.has(extension)) {
      return this.readTextDocument(filePath, extension);
    }

    if (SPREADSHEET_EXTENSIONS.has(extension)) {
      return this.readSpreadsheetDocument(filePath, extension);
    }

    throw new Error(
      `Formato não suportado para análise inteligente: ${extension || "sem extensão"}.`,
    );
  }

  async saveGeneratedDocuments(
    outputDirectory: string,
    title: string,
    markdown: string,
    formats: SupportedDocumentOutput[],
    allowedPaths: string[],
  ): Promise<FileItem[]> {
    ensureAllowedPath(outputDirectory, allowedPaths, "Criação de documento");
    await fsPromises.mkdir(outputDirectory, { recursive: true });

    const createdFiles: FileItem[] = [];
    const baseName = sanitizeBaseName(title);

    for (const format of formats) {
      const filePath = await this.resolveUniquePath(
        path.join(outputDirectory, `${baseName}.${format}`),
      );

      await this.writeDocument(filePath, title, markdown, format, allowedPaths);
      createdFiles.push(await toFileItem(filePath));
    }

    return createdFiles;
  }

  async saveReorganizedDocument(
    sourcePath: string,
    title: string,
    markdown: string,
    format: SupportedDocumentOutput,
    allowedPaths: string[],
  ): Promise<FileItem> {
    const directoryPath = path.dirname(sourcePath);
    ensureAllowedPath(directoryPath, allowedPaths, "Criação de documento");

    const baseName = sanitizeBaseName(`${titleFromPath(sourcePath)}-reorganizado`);
    const filePath = await this.resolveUniquePath(
      path.join(directoryPath, `${baseName}.${format}`),
    );

    await this.writeDocument(filePath, title, markdown, format, allowedPaths);
    return toFileItem(filePath);
  }

  private async readTextDocument(
    filePath: string,
    extension: string,
  ): Promise<ReadDocumentResult> {
    const title = titleFromPath(filePath);

    if (extension === ".docx") {
      const result = await mammoth.extractRawText({ path: filePath });
      const textContent = result.value.trim();
      const markdownContent = `# ${title}\n\n${textContent || "Documento sem texto legível."}`;

      return {
        path: filePath,
        name: path.basename(filePath),
        extension,
        title,
        textContent,
        markdownContent,
        metadata: { kind: "text" },
      };
    }

    if (extension === ".pdf") {
      const { PDFParse } = await loadPdfParseModule();
      const parser = new PDFParse({ data: await fsPromises.readFile(filePath) });
      try {
        const result = await parser.getText({
          pageJoiner: "\n\n--- Página page_number de total_number ---",
        });
        const pages = result.pages ?? [];
        const textContent = result.text.trim();
        const markdownSections = [`# ${title}`];

        for (const page of pages) {
          const pageText = page.text.trim();
          if (!pageText) continue;

          markdownSections.push(
            `## Página ${page.num}`,
            pageText,
          );
        }

        const markdownContent = markdownSections.join("\n\n");

        return {
          path: filePath,
          name: path.basename(filePath),
          extension,
          title,
          textContent,
          markdownContent,
          metadata: {
            kind: "text",
            totalPages: pages.length,
          },
        };
      } finally {
        await parser.destroy();
      }
    }

    const rawText = await fsPromises.readFile(filePath, "utf8");
    const textContent = rawText.trim();
    const markdownContent =
      extension === ".md"
        ? rawText
        : `# ${title}\n\n${textContent || "Documento sem texto legível."}`;

    return {
      path: filePath,
      name: path.basename(filePath),
      extension,
      title,
      textContent,
      markdownContent,
      metadata: { kind: "text" },
    };
  }

  private async readSpreadsheetDocument(
    filePath: string,
    extension: string,
  ): Promise<ReadDocumentResult> {
    const workbook = XLSX.readFile(filePath, {
      cellDates: true,
      raw: false,
      dense: false,
    });
    const title = titleFromPath(filePath);
    const markdownSections: string[] = [`# ${title}`];
    const textSections: string[] = [];
    let totalRows = 0;

    for (const sheetName of workbook.SheetNames.slice(0, 6)) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const rows = (XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        blankrows: false,
        raw: false,
      }) as unknown[][]).filter((row) =>
        row.some((cell) => String(cell ?? "").trim().length > 0),
      );

      const visibleRows = rows.slice(0, 16).map((row) =>
        row.slice(0, 8).map((cell) => String(cell ?? "").trim()),
      );
      totalRows += rows.length;

      markdownSections.push(`## Aba: ${sheetName}`);
      markdownSections.push(`Linhas lidas: ${rows.length}`);

      if (visibleRows.length > 0) {
        const headerRow = visibleRows[0];
        const bodyRows = visibleRows.slice(1);

        markdownSections.push(
          `| ${headerRow.map((cell) => cell || "Coluna").join(" | ")} |`,
        );
        markdownSections.push(
          `| ${headerRow.map(() => "---").join(" | ")} |`,
        );

        for (const row of bodyRows) {
          markdownSections.push(`| ${row.map((cell) => cell || " ").join(" | ")} |`);
        }
      } else {
        markdownSections.push("Aba sem dados legíveis.");
      }

      textSections.push(
        [
          `Aba: ${sheetName}`,
          `Linhas: ${rows.length}`,
          ...visibleRows.map((row) => row.join(" | ")),
        ].join("\n"),
      );
    }

    return {
      path: filePath,
      name: path.basename(filePath),
      extension,
      title,
      textContent: truncateText(textSections.join("\n\n")),
      markdownContent: truncateText(markdownSections.join("\n\n")),
      metadata: {
        kind: "spreadsheet",
        sheetNames: workbook.SheetNames,
        totalRows,
      },
    };
  }

  private async writeDocument(
    filePath: string,
    title: string,
    markdown: string,
    format: SupportedDocumentOutput,
    allowedPaths: string[],
  ) {
    ensureAllowedPath(filePath, allowedPaths, "Criação de documento");

    switch (format) {
      case "md":
        await fsPromises.writeFile(filePath, markdown, "utf8");
        return;
      case "docx":
        await this.writeDocx(filePath, markdown);
        return;
      case "pdf":
        await this.writePdf(filePath, title, markdown);
        return;
      default:
        throw new Error(`Formato de saída não suportado: ${format}`);
    }
  }

  private async writeDocx(filePath: string, markdown: string) {
    const paragraphs = splitMarkdownLines(markdown).map((line) => {
      switch (line.type) {
        case "heading":
          return new Paragraph({
            text: line.text,
            heading: headingMap[line.level] ?? HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 },
          });
        case "bullet":
          return new Paragraph({
            children: [new TextRun(line.text)],
            bullet: { level: 0 },
            spacing: { after: 80 },
          });
        case "code":
        case "table":
          return new Paragraph({
            children: [new TextRun({ text: line.text, font: "Courier New", size: 20 })],
            spacing: { after: 60 },
          });
        case "blank":
          return new Paragraph({ text: "" });
        default:
          return new Paragraph({
            children: [new TextRun(line.text)],
            spacing: { after: 120 },
          });
      }
    });

    const document = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    const buffer = await Packer.toBuffer(document);
    await fsPromises.writeFile(filePath, buffer);
  }

  private async writePdf(filePath: string, title: string, markdown: string) {
    await new Promise<void>((resolve, reject) => {
      const stream = fs.createWriteStream(filePath);
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: { Title: title },
      });

      doc.pipe(stream);

      for (const line of splitMarkdownLines(markdown)) {
        switch (line.type) {
          case "heading":
            doc.moveDown(0.5);
            doc.font("Helvetica-Bold");
            doc.fontSize(Math.max(14, 24 - line.level * 2));
            doc.text(line.text);
            doc.moveDown(0.2);
            break;
          case "bullet":
            doc.font("Helvetica");
            doc.fontSize(11);
            doc.text(`• ${line.text}`, { indent: 14 });
            break;
          case "code":
          case "table":
            doc.font("Courier");
            doc.fontSize(9);
            doc.text(line.text);
            break;
          case "blank":
            doc.moveDown(0.4);
            break;
          default:
            doc.font("Helvetica");
            doc.fontSize(11);
            doc.text(line.text);
            doc.moveDown(0.2);
            break;
        }
      }

      doc.end();

      stream.on("finish", () => resolve());
      stream.on("error", reject);
      doc.on("error", reject);
    });
  }

  private async resolveUniquePath(candidatePath: string) {
    const directoryPath = path.dirname(candidatePath);
    const extension = path.extname(candidatePath);
    const baseName = path.basename(candidatePath, extension);

    let index = 1;
    let currentPath = candidatePath;

    while (true) {
      try {
        await fsPromises.access(currentPath);
        currentPath = path.join(
          directoryPath,
          `${baseName}-${String(index).padStart(2, "0")}${extension}`,
        );
        index += 1;
      } catch {
        return currentPath;
      }
    }
  }
}
