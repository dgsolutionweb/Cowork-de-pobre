# Cowork Local AI

Cowork Local AI e um app desktop de produtividade com inteligencia artificial, feito com Electron, React, TypeScript e SQLite local. O objetivo e dar ao usuario um workspace local para conversar com IA, organizar arquivos, pesquisar documentos, criar automacoes e trabalhar por projetos com memoria, RAG e conectores.

## Visao geral

O app roda localmente no computador e usa IPC do Electron para conectar a interface React com servicos Node.js. Os dados ficam em SQLite no `userData` do sistema operacional. A IA usa Gemini configurado pelo usuario dentro do app.

## Funcionalidades

- Dashboard com metricas, atividades recentes, automacoes e diretorios autorizados.
- Projects com pasta raiz, projeto ativo, instrucoes, contexto, memorias, policy e eventos sensiveis.
- Assistente com chat, historico de conversas, tools locais e acoes pendentes com confirmacao.
- Controle de acesso a arquivos por pastas autorizadas.
- Busca, preview, mover, renomear, excluir e operacoes em lote de arquivos.
- Vault para exclusoes protegidas e restauracao.
- Automacoes agendadas com templates, execucao manual e historico.
- Pesquisa com RAG em arquivos do projeto.
- Pesquisa profunda multi-step com Gemini e Google Search.
- Exportacao de relatorios de pesquisa como artifact local.
- Connectors para GitHub, Google Drive, MCP e plugins locais.
- Sincronizacao de conectores para indexacao de conteudo externo.
- Leitura de `.md`, `.txt`, `.docx`, `.pdf`, `.xlsx`, `.xls` e `.csv`.
- Criacao de relatorios em `.md`, `.docx` e `.pdf`.
- Criacao de planilhas `.xlsx` com formulas.
- Logs de erro, notificacoes e command palette com `Cmd+K` ou `Ctrl+K`.

## Stack

- Electron
- React 18
- TypeScript
- Vite
- Tailwind CSS
- SQLite via `better-sqlite3`
- Gemini API
- electron-builder

## Requisitos

- Node.js 20 ou superior recomendado
- npm
- macOS, Windows ou Linux para desenvolvimento desktop
- Chave Gemini API para usar recursos de IA

Para builds nativos, use preferencialmente o mesmo sistema operacional do alvo:

- macOS gera `.dmg`
- Windows gera `.exe` via NSIS e portable
- Linux gera `.AppImage` e `.deb`

Cross-build pode exigir dependencias extras como Wine, Docker, ferramentas de assinatura ou bibliotecas do sistema.

## Instalacao

```bash
npm install
```

O `postinstall` executa:

```bash
electron-builder install-app-deps
```

Isso prepara dependencias nativas como `better-sqlite3`.

## Executar em desenvolvimento

```bash
npm run dev
```

Esse comando sobe:

- Vite para a interface React
- build watch do Electron com esbuild
- Electron apontando para o servidor local do Vite

## Build de producao

Build sem empacotar instalador:

```bash
npm run build
```

Saidas principais:

- `dist/`
- `dist-electron/`

Executar o app ja buildado:

```bash
npm run start
```

## Gerar instaladores

### macOS

```bash
npm run dist:mac
```

Saida:

```text
release/Cowork-<versao>-arm64.dmg
release/Cowork-<versao>-x64.dmg
```

O script usa assinatura ad-hoc quando nao ha certificado Apple configurado. Para distribuir publicamente fora da maquina local, configure assinatura Developer ID e notarizacao.

### Windows

```bash
npm run dist:win
```

Saidas esperadas:

```text
release/*.exe
```

Targets configurados:

- `nsis`
- `portable`

Recomendado gerar esse build em Windows. Em macOS/Linux, o build Windows pode exigir Wine.

### Linux

```bash
npm run dist:linux
```

Saidas esperadas:

```text
release/*.AppImage
release/*.deb
```

Targets configurados:

- `AppImage`
- `deb`

Recomendado gerar esse build em Linux ou em CI Linux.

### Todos os targets

```bash
npm run dist:all
```

Use esse comando apenas em ambiente preparado para cross-build.

## Build para iOS

Este projeto e um app Electron desktop. Electron nao gera build iOS nativo.

Para ter iOS, o caminho correto e criar um alvo separado:

- extrair a interface React reutilizavel
- mover regras de negocio desktop-only para uma camada API/sync
- criar app iOS com Capacitor, React Native ou Swift
- substituir IPC do Electron por APIs compativeis com mobile
- trocar acesso direto ao filesystem por APIs sandboxed do iOS

Status atual:

- macOS: suportado
- Windows: configurado para build desktop
- Linux: configurado para build desktop
- iOS: nao suportado neste repositorio Electron

## Configuracao da IA

No app, abra `Configuracoes` e informe:

- Gemini API Key
- Modelo Gemini
- Prompt customizado opcional

Modelo padrao:

```text
gemini-2.5-flash
```

Sem chave Gemini, o app continua abrindo, mas recursos de chat, pesquisa profunda e tools de IA ficam limitados.

## Estrutura do projeto

```text
electron/
  db/                 SQLite e schema local
  ipc/                handlers IPC
  repositories/       acesso a dados
  services/           regras de negocio desktop
  utils/              helpers de path, hash e id

src/
  components/         UI compartilhada
  hooks/              hooks React
  layouts/            shell principal
  pages/              telas do app
  services/           ponte renderer -> preload
  store/              estado client-side

shared/
  types.ts            contrato compartilhado Electron/React

build/
  icon.icns
  entitlements.mac.plist

release/
  instaladores gerados
```

## Dados locais

O banco principal e criado em:

```text
<Electron userData>/cowork-local-ai.sqlite
```

Durante execucao fora do Electron pronto, o fallback e:

```text
.cowork-data/cowork-local-ai.sqlite
```

Tabelas principais:

- `authorized_directories`
- `projects`
- `project_instructions`
- `project_context_items`
- `project_memories`
- `project_file_index`
- `project_chunks`
- `project_connectors`
- `conversations`
- `automations`
- `task_history`
- `vault_entries`
- `approval_events`
- `error_logs`

## Seguranca e permissoes

O app trabalha com escopo local autorizado:

- arquivos so devem ser operados dentro de pastas autorizadas
- projects registram `fileRoots`
- policies armazenam allowlist de dominios
- acoes destrutivas podem ser controladas por policy
- eventos sensiveis sao registrados em `approval_events`
- exclusoes podem ir para o Vault, dependendo da preferencia do usuario

Ainda nao e uma sandbox completa. Para uso com agentes mais autonomos, o roadmap do projeto inclui enforcement forte de egress, approvals antes de execucao e runtime isolado.

## Comandos uteis

```bash
npm install
npm run dev
npm run build
npm run start
npm run dist:mac
npm run dist:win
npm run dist:linux
```

## Troubleshooting

Se `better-sqlite3` falhar depois de trocar versao de Electron:

```bash
npm run postinstall
```

Se o build macOS falhar por cache do `electron-builder`, limpe o cache ou rode novamente com permissao para escrever em:

```text
~/Library/Caches/electron-builder
```

Se o macOS bloquear o app gerado sem notarizacao, abra por:

```text
System Settings > Privacy & Security > Open Anyway
```

Para distribuicao publica em macOS, configure assinatura e notarizacao Apple.

## Roadmap

Prioridades atuais:

1. Projects + instructions + memory + RAG
2. Research + citations
3. Connectors / MCP / plugin system
4. Sandbox / VM + permission / egress model
5. XLSX / PPTX + artifact workspace

Docs internos:

- `docs/cowork-next-roadmap.md`
- `docs/cowork-status-e-proximos-passos.md`
