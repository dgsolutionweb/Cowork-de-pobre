import https from "node:https";
import http from "node:http";
import { shell } from "electron";
import { connectorService } from "./connectorService";
import type { ConnectorConfig } from "../../shared/types";

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function httpsPost(url: string, body: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = Buffer.from(body);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": data.byteLength,
          Accept: "application/json",
          "User-Agent": "Cowork-Local-AI",
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try { resolve(JSON.parse(raw)); }
          catch { resolve(raw); }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

const SUCCESS_PAGE = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;text-align:center;padding:60px;background:#0f1117;color:#e2e8f0">
  <div style="font-size:48px;margin-bottom:16px">✅</div>
  <h2 style="margin:0 0 8px">Autorizado com sucesso!</h2>
  <p style="color:#94a3b8;margin:0">Pode fechar esta aba e voltar ao Cowork.</p>
  <script>setTimeout(()=>window.close(),2000)</script>
</body></html>`;

// ─── Generic loopback OAuth server ───────────────────────────────────────────

function createLoopbackServer(
  state: string,
  onCode: (code: string, redirectUri: string) => Promise<ConnectorConfig>,
  onReady: (redirectUri: string) => void
): Promise<ConnectorConfig> {
  return new Promise((resolve, reject) => {
    let redirectUri = "";
    let settled = false;

    const finish = (err?: Error, connector?: ConnectorConfig) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(connector!);
    };

    const server = http.createServer(async (req, res) => {
      const reqUrl = new URL(req.url!, "http://localhost");
      const code = reqUrl.searchParams.get("code");
      const returnedState = reqUrl.searchParams.get("state");

      // Ignore requests without code (e.g. favicon, preflight)
      if (!code) {
        res.writeHead(204); res.end(); return;
      }

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(SUCCESS_PAGE);
      server.close();

      if (returnedState !== state) {
        finish(new Error("Falha de segurança: state inválido"));
        return;
      }

      try {
        const connector = await onCode(code, redirectUri);
        finish(undefined, connector);
      } catch (err: any) {
        finish(new Error(err.message || "Erro ao trocar código por token"));
      }
    });

    // Listen on 0.0.0.0 so both localhost and 127.0.0.1 reach the server
    server.listen(0, "0.0.0.0", () => {
      const addr = server.address() as { port: number };
      // Use localhost (not 127.0.0.1) — GitHub registered callback is http://localhost
      redirectUri = `http://localhost:${addr.port}`;
      onReady(redirectUri);
    });

    server.on("error", (err) => finish(err));

    setTimeout(() => {
      server.close();
      finish(new Error("Tempo esgotado: a autorização expirou após 5 minutos"));
    }, 5 * 60 * 1000);
  });
}

// ─── GitHub OAuth (web flow, loopback redirect) ───────────────────────────────
//
// GitHub OAuth App settings:
//   Authorization callback URL → http://localhost
//   Enable Device Flow         → unchecked (not needed)
//
// GitHub allows any port on loopback at runtime even if only "http://localhost"
// is registered as the callback URL.

export function startGitHubOAuth(
  clientId: string,
  clientSecret: string,
  connectorName: string
): Promise<ConnectorConfig> {
  const state = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

  return createLoopbackServer(
    state,
    async (code, redirectUri) => {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }).toString();

      const token = await httpsPost("https://github.com/login/oauth/access_token", body);

      if (token.error) {
        throw new Error(token.error_description || token.error);
      }

      return connectorService.create({
        type: "github",
        name: connectorName,
        config: {
          token: token.access_token,
          scope: token.scope,
          tokenType: token.token_type,
        },
      });
    },
    (redirectUri) => {
      const authUrl =
        "https://github.com/login/oauth/authorize?" +
        new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          scope: "repo read:user",
          state,
        }).toString();
      shell.openExternal(authUrl);
    }
  );
}

// ─── Google Drive OAuth (loopback redirect) ───────────────────────────────────
//
// Google Cloud Console → Credentials → OAuth 2.0 Client → Desktop App
// Authorized redirect URIs: http://localhost (or add http://127.0.0.1)
// Enable: Google Drive API

export function startGoogleOAuth(
  clientId: string,
  clientSecret: string,
  connectorName: string
): Promise<ConnectorConfig> {
  const state = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const scope = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
  ].join(" ");

  return createLoopbackServer(
    state,
    async (code, redirectUri) => {
      const body = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString();

      const token = await httpsPost("https://oauth2.googleapis.com/token", body);

      if (token.error) {
        throw new Error(token.error_description || token.error);
      }

      return connectorService.create({
        type: "google_drive",
        name: connectorName,
        config: {
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiresIn: token.expires_in,
          tokenType: token.token_type,
          scope: token.scope,
          clientId,
          clientSecret,
        },
      });
    },
    (redirectUri) => {
      const authUrl =
        "https://accounts.google.com/o/oauth2/v2/auth?" +
        new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          scope,
          access_type: "offline",
          prompt: "consent",
          state,
        }).toString();
      shell.openExternal(authUrl);
    }
  );
}
