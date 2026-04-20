# Cowork Next Roadmap

## Objetivo

Evoluir o `Cowork Local AI` atual para uma plataforma de trabalho agentic local, inspirada nas capacidades centrais do Claude Cowork, sem perder o foco em segurança local, auditabilidade e utilidade operacional.

As 5 frentes priorizadas para o produto são:

1. Projects + instructions + memory + RAG
2. Research + citations
3. Connectors/MCP/plugin system
4. Sandbox/VM + permission/egress model
5. XLSX/PPTX + artifact workspace

## Estado Atual

O projeto já possui base útil para expansão:

- Electron + React + SQLite local
- pastas autorizadas
- assistente com tools locais via Gemini
- automações agendadas
- histórico, logs e vault
- leitura e geração de `md`, `docx`, `pdf`

Isso reduz risco de bootstrap. O app já tem núcleo de desktop agent e storage local; falta transformar isso em um sistema de trabalho persistente, conectado e confiável.

## Prioridade vs Ordem de Entrega

Prioridade de produto permanece:

1. Projects + instructions + memory + RAG
2. Research + citations
3. Connectors/MCP/plugin system
4. Sandbox/VM + permission/egress model
5. XLSX/PPTX + artifact workspace

Ordem recomendada de implementação:

1. Foundation slice de segurança da prioridade 4
2. Prioridade 1 completa
3. Prioridade 2
4. Prioridade 3
5. Restante da prioridade 4
6. Prioridade 5

Motivo:

- `Sandbox/permission/egress` mínimo precisa existir antes de ampliar autonomia.
- `Projects/memory/RAG` vira espinha dorsal de contexto para pesquisa, conectores e artifacts.
- `Research/citations` depende fortemente de contexto bem estruturado.
- `Connectors/MCP/plugins` multiplicam superfície de risco; devem entrar depois da fundação de segurança.
- `XLSX/PPTX/artifacts` ficam muito mais úteis depois que projetos, memória e pesquisa já existem.

## Arquitetura Alvo

### Novos blocos de domínio

- `projects`
  - workspaces locais com instruções, contexto, tasks e memória
- `memory`
  - fatos, decisões, preferências e resumos persistentes por projeto
- `knowledge`
  - indexação local, chunking, embeddings e retrieval
- `research`
  - planner, executor de busca, síntese e citações
- `connectors`
  - integrações nativas e MCP remoto
- `plugins`
  - pacote de skills, conectores e subagentes
- `runtime`
  - execução em sandbox/VM, políticas e aprovação
- `artifacts`
  - outputs editáveis, versionados e reabertos

### Estrutura sugerida

```text
electron/
  db/
  ipc/
  repositories/
  services/
    projects/
    memory/
    knowledge/
    research/
    connectors/
    plugins/
    runtime/
    artifacts/
    documents/
    permissions/
  utils/
src/
  pages/
    projects-page.tsx
    research-page.tsx
    connectors-page.tsx
    artifacts-page.tsx
  components/
    projects/
    research/
    connectors/
    artifacts/
  store/
```

## Roadmap por Frente

### 1. Projects + Instructions + Memory + RAG

#### Objetivo

Criar workspaces locais persistentes com:

- diretório raiz do projeto
- instruções do projeto
- contexto anexado
- memória por projeto
- tasks agendadas por projeto
- knowledge retrieval para grandes volumes

#### Entregáveis MVP

- tela `Projects`
- criar projeto:
  - do zero
  - a partir de pasta local
- selecionar projeto ativo
- `project instructions`
- `folder instructions`
- memória automática por projeto
- busca/retrieval dentro do projeto
- associar automações a projeto

#### Banco proposto

Novas tabelas:

- `projects`
- `project_context_items`
- `project_instructions`
- `project_memories`
- `project_runs`
- `project_file_index`
- `project_chunks`

Campos mínimos:

```text
projects:
  id, name, root_path, status, created_at, updated_at

project_instructions:
  project_id, scope(global|project|folder), path, content, updated_at

project_memories:
  id, project_id, type(fact|decision|summary|preference), title, content, source_run_id, created_at

project_file_index:
  id, project_id, file_path, mime_type, size, modified_at, hash

project_chunks:
  id, project_id, file_index_id, chunk_index, text, metadata_json, embedding_json?
```

#### Notas técnicas

- fase 1 pode usar retrieval lexical + BM25 local
- embeddings entram na fase 1.2
- RAG deve funcionar com arquivos locais e documentos gerados

#### Critérios de aceite

- usuário cria projeto e vê contexto isolado
- projeto mantém suas instruções
- memória só vale dentro do projeto
- busca encontra conteúdo por relevância, não só por nome de arquivo

### 2. Research + Citations

#### Objetivo

Substituir “web search simples” por fluxo agentic de pesquisa:

- decomposição de pergunta
- múltiplas buscas
- consolidação por evidência
- resposta com citações verificáveis

#### Entregáveis MVP

- modo `Research`
- pesquisa web multi-step
- leitura de documentos locais + documentos do projeto
- citações por:
  - URL
  - arquivo local
  - trecho/chunk
- relatório final estruturado

#### Componentes

- `ResearchPlannerService`
- `ResearchExecutorService`
- `CitationFormatterService`
- `SourceRegistryService`

#### Critérios de aceite

- resposta final lista fontes usadas
- cada afirmação importante aponta para fonte/trecho
- relatório pode ser salvo como artifact

### 3. Connectors / MCP / Plugin System

#### Objetivo

Dar acesso a fontes e ações externas via conectores e MCP, com modelo extensível.

#### Entregáveis MVP

- catálogo de conectores
- configuração de conectores por credencial
- suporte a MCP remoto via HTTP
- plugin manifest local
- plugin loader local
- permissões por plugin/conector

#### Ordem sugerida

1. abstração de `ConnectorProvider`
2. GitHub connector
3. Google Drive connector
4. MCP remote client
5. plugin manifests

#### Interfaces alvo

```ts
interface ConnectorProvider {
  id: string;
  label: string;
  connect(): Promise<void>;
  listCapabilities(): Promise<string[]>;
  execute(action: string, input: unknown): Promise<unknown>;
}

interface CoworkPluginManifest {
  id: string;
  name: string;
  version: string;
  skills: string[];
  connectors: string[];
  subagents: string[];
  permissions: {
    files?: string[];
    network?: string[];
    apps?: string[];
  };
}
```

#### Critérios de aceite

- usuário instala plugin localmente
- plugin expõe capacidades no app
- conector/MCP só roda após consentimento e política válidos

### 4. Sandbox / VM + Permission / Egress Model

#### Objetivo

Trocar execução “direto no host” por runtime mais seguro e previsível.

#### Foundation slice

- política explícita de leitura/escrita por projeto
- allowlist de domínios
- classificação de ação:
  - segura
  - sensível
  - destrutiva
- gate de confirmação antes de ações destrutivas

#### Fase seguinte

- subprocess runner isolado
- file staging
- shell sandbox
- policy engine central
- base para VM

#### Banco proposto

- `permission_policies`
- `egress_policies`
- `approval_events`
- `runtime_sessions`

#### Critérios de aceite

- toda ação sensível gera evento auditável
- acesso de rede respeita política por projeto
- operações destrutivas pedem aprovação explícita

### 5. XLSX / PPTX + Artifact Workspace

#### Objetivo

Produzir entregáveis profissionais editáveis e persistentes.

#### Entregáveis MVP

- geração de `xlsx` com fórmulas
- geração de `pptx`
- workspace de artifacts
- versionamento simples
- abrir artifact, regenerar, exportar

#### Banco proposto

- `artifacts`
- `artifact_versions`
- `artifact_source_links`

#### Critérios de aceite

- um relatório de research pode virar:
  - documento
  - planilha
  - apresentação
- artifact fica reaberto no app para nova iteração

## Milestones

### M0. Foundation de Segurança

- policy engine inicial
- approval model
- egress allowlist por projeto
- auditoria de ações sensíveis

### M1. Projects Core

- CRUD de projetos
- projeto ativo
- instructions
- automações por projeto

### M2. Memory + Retrieval

- memória por projeto
- indexação local
- search semântico/lexical
- context assembly

### M3. Research

- planner
- multi-search
- source registry
- citations
- relatório salvo

### M4. Connectors + MCP

- provider abstraction
- GitHub
- Drive
- MCP remote
- permissões por conector

### M5. Artifacts + Professional Outputs

- artifact workspace
- xlsx
- pptx
- versionamento

### M6. Sandbox Avançado

- isolated runtime
- file staging
- policy enforcement completo
- computer/browser hooks futuros

## Backlog Inicial

### Epic A. Projects

- criar schema `projects`
- criar `ProjectsRepository`
- criar `ProjectsService`
- expor IPC de projetos
- criar `ProjectsPage`
- vincular `automations` a `project_id`

### Epic B. Memory/RAG

- criar schema `project_memories`
- criar indexador de arquivos do projeto
- criar chunker de texto/PDF/docx/xlsx
- implementar retrieval lexical
- implementar assembler de contexto

### Epic C. Research

- separar pesquisa web em serviço dedicado
- criar `ResearchSession`
- registrar fontes e trechos
- renderizar citações na UI

### Epic D. Connectors

- definir contrato `ConnectorProvider`
- tela de conectores
- credenciais seguras
- GitHub connector MVP
- MCP remote connector MVP

### Epic E. Runtime/Security

- definir action classifier
- approval modal unificado
- log de eventos de aprovação
- política de domínios

### Epic F. Artifacts

- schema `artifacts`
- artifact viewer
- export `xlsx`
- export `pptx`

## Dependências Críticas

- `Projects` depende de schema novo e roteamento novo
- `Memory/RAG` depende de `Projects`
- `Research` depende de `Memory/RAG` e `source registry`
- `Connectors/MCP` depende de `policy engine`
- `Artifacts` depende de `Research` e `DocumentService` expandido

## O que não fazer agora

- computer use completo antes de policy engine
- mobile dispatch antes de projects/memory
- muitos conectores ao mesmo tempo
- embeddings externos como requisito do primeiro corte

## Recomendação de execução imediata

Próximo ciclo de implementação:

1. M0 `policy + approvals`
2. M1 `projects core`
3. M2 `memory + retrieval lexical`

Isso cria a fundação certa. Depois:

4. M3 `research + citations`
5. M4 `connectors/MCP`
6. M5 `artifacts + xlsx/pptx`

## Definição de sucesso

Ao final dessas 5 frentes, o Cowork deverá:

- operar por workspace, não só por app global
- lembrar contexto útil por projeto
- pesquisar web e corpus local com fontes verificáveis
- conectar serviços externos via plugins/conectores/MCP
- executar ações em ambiente mais seguro
- gerar deliverables editáveis de nível profissional

