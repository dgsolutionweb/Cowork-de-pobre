# Prompt — Cowork Local AI com Electron + React

Crie um aplicativo desktop completo chamado **Cowork Local AI**, inspirado no conceito de um assistente operacional de desktop inteligente, com foco em **organização de arquivos, automação local, produtividade e execução de tarefas por linguagem natural**, utilizando:

- **Electron** para desktop
- **React + Vite** no frontend
- **Node.js** no processo principal
- **TypeScript** em todo o projeto
- **SQLite** para armazenamento local
- **Tailwind CSS** para interface
- **shadcn/ui** para componentes modernos
- arquitetura limpa, modular e escalável

O sistema deve ser pensado como um **assistente local de trabalho**, que conversa com o usuário em linguagem natural e executa ações reais no computador com segurança, principalmente em **pastas autorizadas**, como Desktop, Downloads, Documentos e pastas de clientes.

---

## Objetivo do sistema

O app deve funcionar como um “coworker digital” local. O usuário digita comandos como:

- “Organize minha pasta Downloads”
- “Separe os PDFs por cliente”
- “Renomeie esses arquivos com padrão profissional”
- “Crie uma pasta para o cliente Fera e mova tudo relacionado para lá”
- “Encontre arquivos duplicados e me mostre antes de excluir”
- “Liste todos os contratos em PDF desta semana”
- “Faça um resumo dos documentos da pasta X”

O sistema deve interpretar os comandos e executar ações com **pré-visualização, confirmação e histórico**, sem agir de forma perigosa.

---

## Requisitos principais

### 1. Interface principal
Criar uma interface desktop moderna, profissional e responsiva, com visual premium e corporativo.

A interface deve ter:

- **sidebar lateral**
  - Dashboard
  - Assistente
  - Arquivos
  - Tarefas
  - Histórico
  - Configurações
- **área principal com chat**
  - input de linguagem natural
  - mensagens do usuário e do sistema
  - respostas com sugestões e ações
- **painel lateral opcional**
  - detalhes da tarefa atual
  - prévia dos arquivos encontrados
  - logs da execução
- **cards no dashboard**
  - total de arquivos organizados
  - total de tarefas executadas
  - últimos clientes/pastas
  - últimas automações
- **tabela de ações recentes**
- **tema escuro elegante**, com design de app premium desktop

Use **shadcn/ui**, cards arredondados, tabelas bonitas, badges de status, modais de confirmação, toasts e loaders.

---

### 2. Estrutura de permissões locais
O app não deve ter acesso irrestrito ao disco inteiro por padrão.

Criar sistema de **pastas autorizadas**, onde o usuário poderá selecionar quais diretórios o app pode acessar, por exemplo:

- Desktop
- Downloads
- Documentos
- Pastas de clientes

O sistema deve:

- listar apenas arquivos de diretórios autorizados
- impedir acesso fora das rotas aprovadas
- mostrar claramente quais pastas estão liberadas
- permitir adicionar e remover permissões nas configurações

---

### 3. Funcionalidades de arquivos
Criar um módulo completo de gerenciamento local de arquivos com:

- listar arquivos e pastas
- visualizar metadados
- mover arquivos
- copiar arquivos
- renomear arquivos
- criar pastas
- excluir com envio para “lixeira lógica” ou área de segurança
- detectar duplicados por nome/tamanho/hash
- filtrar por extensão, data e pasta
- busca local por nome e conteúdo quando possível

Também criar recursos de organização inteligente:

- agrupar por tipo
- agrupar por cliente
- agrupar por data
- agrupar por nome semelhante
- sugerir nomes padronizados

---

### 4. Assistente com linguagem natural
Criar um motor de comandos que transforme instruções em ações.

Exemplos:

- “Organize meus PDFs por cliente”
- “Separe imagens em outra pasta”
- “Crie uma estrutura de pastas para cliente novo”
- “Renomeie arquivos com data + nome do cliente”
- “Mostre tudo que foi baixado hoje”
- “Procure arquivos relacionados à marca Compton”

Mesmo que inicialmente o sistema não dependa diretamente de API externa, a arquitetura deve ser preparada para integrar futuramente OpenAI ou outro modelo.

Criar uma camada de interpretação com:

- intenção detectada
- parâmetros extraídos
- plano de ação
- confirmação antes de executar
- resposta amigável ao usuário

Exemplo de fluxo:
1. usuário envia comando
2. sistema interpreta intenção
3. sistema mostra “Entendi que você quer fazer X”
4. sistema exibe prévia das ações
5. usuário confirma
6. sistema executa
7. sistema salva no histórico

---

### 5. Prévia antes de executar
Toda ação sensível deve ter uma etapa de confirmação.

Exibir:

- o que será movido
- origem e destino
- arquivos afetados
- riscos
- opção de cancelar
- opção de executar

Criar modal de confirmação bonito e claro.

---

### 6. Histórico e auditoria
Criar sistema de histórico local em SQLite com:

- comando digitado
- intenção detectada
- data/hora
- arquivos afetados
- resultado da tarefa
- erros encontrados
- usuário confirmou ou não
- opção de reexecutar tarefa semelhante

Criar tela de histórico com filtros e detalhes.

---

### 7. Tarefas automatizadas
Criar módulo de automações onde o usuário possa salvar ações recorrentes, por exemplo:

- organizar Downloads diariamente
- mover PDFs fiscais para uma pasta específica
- renomear imagens de determinada pasta
- separar arquivos por extensão

Permitir:

- criar rotina
- ativar/desativar
- executar manualmente
- ver último resultado

---

### 8. Banco local
Usar **SQLite** para armazenar:

- configurações
- diretórios autorizados
- histórico de tarefas
- automações
- logs
- preferências visuais

Criar camada de acesso desacoplada com serviços e repositories.

---

### 9. IPC seguro entre Electron e React
Usar boas práticas de Electron:

- `contextIsolation: true`
- `nodeIntegration: false`
- `preload.ts` expondo APIs seguras
- comunicação via IPC bem definida
- sem expor `fs` diretamente no frontend

Criar uma arquitetura segura entre renderer e main process.

---

### 10. Estrutura técnica do projeto
Organizar o projeto em estrutura profissional, por exemplo:

- `electron/`
  - `main/`
  - `preload/`
  - `services/`
  - `ipc/`
  - `db/`
  - `utils/`
- `src/`
  - `components/`
  - `pages/`
  - `layouts/`
  - `hooks/`
  - `services/`
  - `store/`
  - `types/`
  - `lib/`

Criar separação clara entre:

- UI
- lógica de domínio
- operações de arquivo
- persistência
- interpretação de comandos
- automações

---

### 11. Telas que devem existir
Criar pelo menos estas páginas:

#### Dashboard
- resumo geral
- últimas tarefas
- métricas locais
- atalhos rápidos

#### Assistente
- interface de chat
- respostas
- sugestões de comando
- status da tarefa

#### Arquivos
- explorador simplificado
- lista de diretórios autorizados
- filtros por tipo
- ações rápidas

#### Tarefas
- automações salvas
- botão de executar
- status de cada rotina

#### Histórico
- lista de ações já executadas
- detalhes por tarefa

#### Configurações
- diretórios permitidos
- tema
- segurança
- comportamento de exclusão
- futuras integrações de IA

---

### 12. UX esperada
O app deve passar sensação de:

- ferramenta premium
- app de produtividade real
- simples de usar
- segura
- confiável
- moderna
- pronta para crescer como produto SaaS/local híbrido no futuro

A interface precisa parecer um produto profissional de mercado, não um painel genérico.

---

### 13. Funcionalidades futuras já preparadas
Deixar arquitetura preparada para futuras integrações:

- OpenAI API / Responses API
- embeddings e busca semântica
- leitura e resumo de PDF
- classificação automática por IA
- OCR
- automação visual
- multi-workspaces por cliente
- sincronização com nuvem
- agentes por projeto
- observador de pastas em tempo real

Mesmo que não implemente tudo agora, deixar pontos de extensão bem definidos.

---

### 14. Regras de desenvolvimento
Quero que você:

- gere um projeto completo e funcional
- use código limpo e bem comentado
- siga boas práticas de TypeScript
- evite qualquer implementação gambiarra
- use componentes reutilizáveis
- crie tipagens fortes
- trate erros
- crie dados mock quando necessário
- deixe tudo rodando com boa experiência de desenvolvimento

---

### 15. Entrega esperada
Gere:

1. estrutura completa do projeto  
2. todos os arquivos principais  
3. telas iniciais funcionais  
4. sistema IPC básico funcional  
5. banco SQLite inicial  
6. CRUD de diretórios autorizados  
7. chat com interpretação de comandos mockada  
8. fluxo de prévia + confirmação + execução simulada  
9. histórico salvo no banco  
10. layout bonito e profissional

---

### 16. Comandos iniciais que o sistema deve entender
Implemente interpretação mockada para estes comandos:

- organizar downloads
- listar pdfs
- mover imagens
- renomear arquivos
- criar pasta cliente
- buscar duplicados
- mostrar arquivos recentes

---

### 17. Diferencial importante
Quero que o app seja desenvolvido com mentalidade de produto real, pronto para evoluir para algo como um **Cowork Local AI comercializável**, e não apenas um protótipo simples.

---

## Extra: peça para o gerador entregar assim

No final, entregue em etapas:

1. visão geral da arquitetura  
2. estrutura de pastas  
3. dependências necessárias  
4. arquivos base do Electron  
5. frontend React completo  
6. integração com SQLite  
7. serviços de arquivos  
8. parser de comandos  
9. telas finais  
10. instruções para rodar localmente  

Se necessário, gere o projeto em múltiplas partes, mas mantendo consistência total entre os arquivos.
