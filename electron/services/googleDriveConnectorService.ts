import https from "node:https";
import type { ConnectorIndexItem } from "./githubConnectorService";

const MAX_FILES = 100;
const MAX_EXPORT_BYTES = 200_000; // 200 KB

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function driveRequest(
  path: string,
  token: string,
  method = "GET"
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "www.googleapis.com",
        path,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "Cowork-Local-AI",
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, body: raw }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function driveGetJson(path: string, token: string): Promise<any> {
  const { statusCode, body } = await driveRequest(path, token);
  if (statusCode >= 400) {
    throw new Error(`Google Drive API ${statusCode}: ${body.slice(0, 200)}`);
  }
  return JSON.parse(body);
}

async function driveGetText(path: string, token: string): Promise<string | null> {
  const { statusCode, body } = await driveRequest(path, token);
  if (statusCode === 403 || statusCode === 404) return null;
  if (statusCode >= 400) throw new Error(`Drive export ${statusCode}`);
  if (body.length > MAX_EXPORT_BYTES) return body.slice(0, MAX_EXPORT_BYTES) + "\n[truncated]";
  return body;
}

// ─── Token refresh ────────────────────────────────────────────────────────────

interface TokenResult {
  access_token: string;
  expires_in: number;
}

export async function refreshGoogleToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<TokenResult> {
  const body = Buffer.from(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString()
  );

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "oauth2.googleapis.com",
        path: "/token",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": body.byteLength,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(raw);
            if (parsed.error) reject(new Error(parsed.error_description || parsed.error));
            else resolve(parsed as TokenResult);
          } catch {
            reject(new Error("Falha ao analisar resposta do token refresh"));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ─── MIME type handling ────────────────────────────────────────────────────────

const GOOGLE_MIME_EXPORTS: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

const DIRECT_DOWNLOAD_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/json",
  "text/csv",
  "text/html",
]);

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchGoogleDriveContent(
  accessToken: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  existingFiles: Map<string, string>,
  onProgress?: (msg: string) => void
): Promise<{ items: ConnectorIndexItem[]; newAccessToken: string }> {
  const log = (msg: string) => {
    console.log(`[Google Drive Connector] ${msg}`);
    onProgress?.(msg);
  };

  let token = accessToken;

  // Always refresh token upfront to avoid mid-sync failures
  try {
    const refreshed = await refreshGoogleToken(clientId, clientSecret, refreshToken);
    token = refreshed.access_token;
    log("Token renovado com sucesso.");
  } catch (err: any) {
    log(`Aviso: não foi possível renovar token (${err.message}). Usando token atual.`);
  }

  // 1. List files
  log("Listando arquivos do Google Drive...");
  const query = encodeURIComponent(
    "trashed = false and (mimeType = 'application/vnd.google-apps.document' or " +
    "mimeType = 'application/vnd.google-apps.spreadsheet' or " +
    "mimeType = 'text/plain' or mimeType = 'text/markdown' or " +
    "mimeType = 'text/csv')"
  );

  const listPath =
    `/drive/v3/files?q=${query}` +
    `&fields=files(id,name,mimeType,modifiedTime)` +
    `&orderBy=modifiedTime+desc&pageSize=${MAX_FILES}`;

  const listResult = await driveGetJson(listPath, token);
  const files: any[] = listResult.files ?? [];

  log(`${files.length} arquivos encontrados. Baixando conteúdo...`);

  const items: ConnectorIndexItem[] = [];

  for (const file of files) {
    try {
      const remotePath = `drive/${file.id}/${file.name}`;
      const fileModifiedTime = file.modifiedTime ?? "";

      if (existingFiles.get(remotePath) === fileModifiedTime) {
        items.push({ remotePath, content: null, hash: fileModifiedTime });
        continue;
      }

      let content: string | null = null;

      if (GOOGLE_MIME_EXPORTS[file.mimeType]) {
        // Google Workspace doc → export
        const exportMime = encodeURIComponent(GOOGLE_MIME_EXPORTS[file.mimeType]);
        content = await driveGetText(
          `/drive/v3/files/${file.id}/export?mimeType=${exportMime}`,
          token
        );
      } else if (DIRECT_DOWNLOAD_MIMES.has(file.mimeType)) {
        // Plain file → direct download
        content = await driveGetText(
          `/drive/v3/files/${file.id}?alt=media`,
          token
        );
      }

      if (content && content.trim().length > 0) {
        items.push({
          remotePath,
          content: `[Google Drive: ${file.name}]\n\n${content}`,
          hash: fileModifiedTime
        });
      } else if (content === null) {
        // File type not supported by text export
        items.push({ remotePath, content: null, hash: fileModifiedTime });
      }

      await new Promise((r) => setTimeout(r, 80));
    } catch {
      // Skip individual file errors
    }
  }

  log(`Google Drive concluído. ${items.length} arquivos coletados.`);
  return { items, newAccessToken: token };
}

export async function validateGoogleToken(accessToken: string): Promise<string> {
  const result = await driveGetJson(
    "/drive/v3/about?fields=user",
    accessToken
  );
  if (!result.user?.emailAddress) throw new Error("Token Google inválido");
  return result.user.emailAddress;
}
