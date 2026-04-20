# Cowork Status e Proximos Passos

## Objetivo

Este documento registra:

- o que ja esta pronto no projeto
- o que foi iniciado da nova fase
- os proximos passos ate completar as 5 etapas priorizadas

## As 5 etapas priorizadas

1. Projects + instructions + memory + RAG
2. Research + citations
3. Connectors / MCP / plugin system
4. Sandbox / VM + permission / egress model
5. XLSX / PPTX + artifact workspace

## Resumo executivo

Base antiga ja pronta:

- app desktop `Electron + React + SQLite`
- assistente local com tools
- pastas autorizadas
- automacoes agendadas
- historico, logs e vault
- geracao/leitura de `md`, `docx` e `pdf`

Nova fase ja iniciada:

- `M0` foundation de policy/approval
- `M1` base de `Projects`

## O que esta pronto agora

### Foundation ja entregue

- estrutura de `projects` no banco local
- estrutura de `project_instructions`
- estrutura de `permission_policies`
- estrutura de `approval_events`
- suporte a `activeProjectId` nas preferencias

### Backend de Projects pronto

- listar projetos
- criar projeto a partir de pasta existente
- criar projeto a partir de pasta pai com nova subpasta
- obter detalhes do projeto
- ativar projeto
- arquivar projeto
- salvar instrucao de projeto
- salvar policy basica do projeto
- associar `fileRoots` do projeto
- autorizar automaticamente pasta raiz do projeto

### Foundation de seguranca pronta

- policy por projeto
- `domainAllowlist`
- flag `allowDestructive`
- trilha inicial de approvals
- classificacao basica de risco
- log de acoes sensiveis como:
  - `delete`
  - `remove`
  - `archive`

### UI pronta

- pagina `Projects`
- criacao de projeto
- selecao de projeto ativo
- edicao de instructions
- edicao de policy
- painel com eventos sensiveis recentes
- integracao com sidebar
- integracao com command palette
- integracao com busca global para encontrar projetos

## O que esta parcial

### Etapa 1. Projects + instructions + memory + RAG

Pronto:

- `projects`
- `project instructions`
- projeto ativo
- policy inicial por projeto
- base para isolamento por workspace
- `project_context_items` (Pinned Context)
- `project_memories` foundation
- `activeProjectId` amarrado no fluxo do assistente, history e automações
- indexação de arquivos do projeto (local RAG foundation)
- chunking e retrieval lexical (FTS5)
- uso automático do contexto do projeto no assistente (RAG injection)
- vinculação de automações por projeto no fluxo de criação

Falta:

- embeddings opcionais (vetorial)

Status: `concluído core (M1+M2 foundation)`

### Etapa 2. Research + citations

Pronto:

- `project_runs` foundation
- `agente_pesquisa` tool no assistente (Web + Local context)
- citacoes básicas em modo pesquisa

Falta:

- modo `Research` dedicado na UI
- exportar artifact de pesquisa

Status: `em andamento (M3 foundation)`

### Etapas 2, 3 e 5

Ainda nao iniciadas de forma estrutural.

## Ordem de execucao daqui para frente

1. Fechar `M1` Projects core
2. Fechar `M2` Memory + Retrieval
3. Entrar em `M3` Research + Citations
4. Entrar em `M4` Connectors / MCP / Plugins
5. Fechar enforcement forte de `M0/M4` runtime security
6. Entrar em `M5` Artifacts + XLSX/PPTX

## Proximos passos imediatos

### Bloco A. Fechar Projects core

1. Adicionar `folder instructions`
2. Adicionar `project_context_items`
3. Amarrar `activeProjectId` no fluxo do assistente
4. Mostrar contexto do projeto ativo na tela do assistente
5. Associar automacoes e historico ao projeto ativo

Saida esperada:

- cada projeto vira workspace real
- contexto nao vaza entre projetos

### Bloco B. Entregar Memory + Retrieval

1. [x] Criar tabelas:
   - `project_memories`
   - `project_runs`
   - `project_file_index`
   - `project_chunks`
2. [x] Indexar arquivos do projeto
3. [x] Fazer chunking local
4. [x] Implementar busca lexical/BM25
5. [x] Injetar top chunks relevantes no contexto do assistente
6. [x] Persistir memorias automaticas:
   - fatos
   - decisoes
   - preferencias
   - resumos

Saida esperada:

- projeto com memoria persistente
- assistente recupera contexto sem usuario repetir tudo

### Bloco C. Research + Citations

1. [x] Criar modo `Research`
2. [x] Criar planner multi-step
3. [x] Executar buscas web + fontes locais
4. [ ] Registrar fontes usadas
5. [ ] Citar por `URL`, arquivo e trecho
6. [x] Exportar relatorio de pesquisa como artifact

Saida esperada:

- respostas com evidencia rastreavel
- pesquisa longa com sintese confiavel

### Bloco D. Connectors / MCP / Plugins

1. [x] Criar interface `ConnectorProvider`
2. [x] Criar tela de conectores
3. [x] Implementar primeiro conector real:
   - `GitHub` ou `Google Drive`
4. [ ] Implementar cliente MCP remoto
5. [ ] Criar manifest local de plugin
6. [ ] Criar plugin loader com permissoes por plugin

Saida esperada:

- sistema extensivel
- fontes externas entram sem acoplamento forte

### Bloco E. Runtime security forte

1. Interceptar chamadas de rede por policy
2. Validar dominio contra allowlist
3. Exigir approval para alto risco
4. Bloquear destrutivo por padrao
5. Rodar execucoes em sandbox real
6. Separar host app de runtime de agente

Saida esperada:

- autonomia sobe sem abrir risco demais

### Bloco F. Artifacts + XLSX/PPTX

1. Criar modulo `artifacts`
2. Versionar outputs por projeto
3. Reabrir artifact para iteracao
4. Adicionar geracao nativa de `xlsx`
5. Adicionar geracao nativa de `pptx`
6. Conectar pesquisa e assistente para salvar tudo como artifact

Saida esperada:

- entregaveis profissionais editaveis
- fluxo completo de producao dentro do app

## Definicao de pronto por etapa

### Etapa 1 concluida quando

- projeto tem raiz, instructions, context, memory e retrieval
- assistente trabalha usando projeto ativo automaticamente
- automacoes podem pertencer a um projeto

### Etapa 2 concluida quando

- existe modo research dedicado
- respostas importantes saem com citacoes
- relatorios podem ser salvos como artifacts

### Etapa 3 concluida quando

- existe catalogo de conectores
- existe pelo menos 1 conector nativo
- MCP remoto funciona
- plugins locais podem registrar capabilities

### Etapa 4 concluida quando

- runtime respeita policy antes de executar
- rede sai so para dominios permitidos
- acoes sensiveis exigem approval
- execucao acontece em ambiente isolado

### Etapa 5 concluida quando

- artifacts existem por projeto
- outputs sao versionados
- app cria e reabre `xlsx` e `pptx`

## Recomendacao de implementacao agora

Foco imediato:

1. terminar `Projects core`
2. entrar direto em `Memory + Retrieval`

Motivo:

- sem isso, `Research`, `Connectors` e `Artifacts` nascem sem espinha dorsal
- contexto persistente do projeto e a base do produto
