import https from "node:https";

export interface ConnectorIndexItem {
  remotePath: string;
  content: string | null;
  hash?: string;
}

// Text extensions worth indexing for RAG
const TEXT_EXTS = new Set([
  ".md", ".mdx", ".txt", ".rst", ".adoc",
  ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs",
  ".py", ".go", ".rs", ".java", ".rb", ".php", ".cs", ".cpp", ".c", ".h",
  ".json", ".yaml", ".yml", ".toml",
  ".sh", ".bash", ".zsh",
  ".html", ".css", ".scss",
  ".sql", ".graphql",
]);

const MAX_REPOS = 15;
const MAX_FILES_PER_REPO = 60;
const MAX_FILE_BYTES = 80_000; // 80 KB

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function githubGet(path: string, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.github.com",
        path,
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "Cowork-Local-AI",
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`GitHub API ${res.statusCode}: ${raw.slice(0, 200)}`));
            return;
          }
          try { resolve(JSON.parse(raw)); }
          catch { resolve(raw); }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function getExtension(path: string): string {
  const parts = path.split(".");
  return parts.length > 1 ? "." + parts.pop()!.toLowerCase() : "";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchGitHubContent(
  token: string,
  existingFiles: Map<string, string>,
  onProgress?: (msg: string) => void
): Promise<ConnectorIndexItem[]> {
  const log = (msg: string) => {
    console.log(`[GitHub Connector] ${msg}`);
    onProgress?.(msg);
  };

  // 1. List user repos (most recently updated first)
  log("Listando repositórios...");
  const repos: any[] = await githubGet(
    "/user/repos?per_page=50&sort=updated&affiliation=owner",
    token
  );

  if (!Array.isArray(repos)) {
    throw new Error("Token inválido ou sem acesso a repositórios.");
  }

  log(`${repos.length} repositórios encontrados. Indexando até ${MAX_REPOS}...`);

  const items: ConnectorIndexItem[] = [];

  for (const repo of repos.slice(0, MAX_REPOS)) {
    const repoId = `${repo.owner.login}/${repo.name}`;
    try {
      const repoUpdatedAt = repo.pushed_at || repo.updated_at;
      const repoMarker = `__repo__:${repoId}`;

      if (repoUpdatedAt && existingFiles.get(repoMarker) === repoUpdatedAt) {
        // log(`${repoId} sem mudanças (Pulo rápido)`);
        items.push({ remotePath: repoMarker, content: null, hash: repoUpdatedAt });

        // Maintain existing files for this repo so they don't get deleted
        for (const [existingPath, existingHash] of existingFiles.entries()) {
          if (existingPath.startsWith(`${repoId}/`)) {
            items.push({ remotePath: existingPath, content: null, hash: existingHash });
          }
        }
        continue;
      }

      log(`Indexando ${repoId}...`);

      // 2. Get file tree (recursive)
      const tree = await githubGet(
        `/repos/${repoId}/git/trees/${repo.default_branch}?recursive=1`,
        token
      );

      if (!tree.tree || !Array.isArray(tree.tree)) continue;

      // 3. Filter to text files within size limit
      const textFiles = tree.tree
        .filter((f: any) => f.type === "blob")
        .filter((f: any) => TEXT_EXTS.has(getExtension(f.path)))
        .filter((f: any) => (f.size ?? 0) <= MAX_FILE_BYTES)
        // Prioritize docs and config over code
        .sort((a: any, b: any) => {
          const score = (p: string) => {
            if (p.toLowerCase().includes("readme")) return 0;
            if (getExtension(p) === ".md") return 1;
            if (getExtension(p) === ".txt") return 2;
            return 3;
          };
          return score(a.path) - score(b.path);
        })
        .slice(0, MAX_FILES_PER_REPO);

      for (const file of textFiles) {
        try {
          const remotePath = `${repoId}/${file.path}`;
          if (existingFiles.get(remotePath) === file.sha) {
            items.push({ remotePath, content: null, hash: file.sha });
            continue;
          }

          const data = await githubGet(
            `/repos/${repoId}/contents/${encodeURIComponent(file.path)}`,
            token
          );
          if (data.encoding === "base64" && data.content) {
            const raw = Buffer.from(
              data.content.replace(/\n/g, ""),
              "base64"
            ).toString("utf-8");

            items.push({
              remotePath,
              content: `[GitHub: ${remotePath}]\n\n${raw}`,
              hash: file.sha
            });
          }
          // Respect rate limit: GitHub allows 5000 req/hour authenticated
          await wait(100);
        } catch {
          // Skip individual file errors silently
        }
      }

      // Add marker so we can skip next time
      if (repoUpdatedAt) {
        items.push({ remotePath: repoMarker, content: null, hash: repoUpdatedAt });
      }
    } catch (err: any) {
      log(`Erro ao indexar ${repoId}: ${err.message}`);
    }
  }

  log(`Indexação GitHub concluída. ${items.length} arquivos coletados.`);
  return items;
}

export async function validateGitHubToken(token: string): Promise<string> {
  const user = await githubGet("/user", token);
  if (!user.login) throw new Error("Token GitHub inválido");
  return user.login;
}
