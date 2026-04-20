import type { ProjectDetail } from "../shared/types";
import { ProjectIndexingService } from "./projectIndexingService";
import type { GeminiChatService } from "./geminiChatService";

export interface ResearchPlan {
  objective: string;
  subQueries: string[];
}

export interface ResearchResult {
  markdownReport: string;
  sources: string[];
}

export class DeepResearchService {
  constructor(
    private readonly projectIndexingService: ProjectIndexingService,
    private readonly geminiEndpoint: string = "https://generativelanguage.googleapis.com/v1beta/models"
  ) {}

  async generatePlan(apiKey: string, model: string, objective: string, context?: ProjectDetail): Promise<ResearchPlan> {
    const prompt = `Você é um planejador de pesquisa.
Objetivo da pesquisa: "${objective}"
Contexto do Projeto Ativo: ${context ? context.project.name : 'Nenhum'}

Quebre este objetivo em no máximo 3 consultas menores (sub-queries) essenciais para buscar na internet ou em documentos locais.
Retorne APENAS um JSON no formato: {"subQueries": ["pergunta 1", "pergunta 2", "pergunta 3"]}`;

    const response = await fetch(`${this.geminiEndpoint}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) throw new Error("Falha ao gerar plano de pesquisa.");
    const payload = await response.json();
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Resposta de planejamento vazia.");

    try {
      const parsed = JSON.parse(text);
      return {
        objective,
        subQueries: parsed.subQueries || [objective],
      };
    } catch {
      return { objective, subQueries: [objective] };
    }
  }

  async executeResearch(
    apiKey: string,
    model: string,
    objective: string,
    project: ProjectDetail | null,
    onProgress?: (msg: string) => void
  ): Promise<ResearchResult> {
    onProgress?.("Gerando plano multi-step...");
    const plan = await this.generatePlan(apiKey, model, objective, project ?? undefined);
    
    const aggregatedResults: string[] = [];
    const sources: Set<string> = new Set();

    // 1. Local context
    if (project) {
      onProgress?.("Buscando no contexto local do projeto...");
      const localChunks = await this.projectIndexingService.search(project.project.id, objective, 5);
      if (localChunks.length > 0) {
        const localSynth = localChunks.map(c => {
          sources.add(`Local: ${c.filePath}`);
          return `[Arquivo: ${c.filePath}]\n${c.content}`;
        }).join("\n");
        aggregatedResults.push("--- DADOS LOCAIS DO PROJETO ---\n" + localSynth);
      }
    }

    // 2. Web search for each subquery
    for (let i = 0; i < plan.subQueries.length; i++) {
       const query = plan.subQueries[i];
       onProgress?.(`Pesquisando na web passo ${i + 1}/${plan.subQueries.length}: "${query}"...`);
       
       const webResult = await this.callGeminiSearch(apiKey, model, query);
       sources.add(`Google Search: ${query}`);
       aggregatedResults.push(`--- RESULTADOS WEB PARA: ${query} ---\n${webResult}`);
    }

    onProgress?.("Sintetizando relatório final...");
    const finalPrompt = `Redija um relatório executivo final, abrangente e detalhado, respondendo ao objetivo principal: "${objective}".
Utilize as seguintes evidências coletadas (locais e web):

${aggregatedResults.join("\n\n")}

Regras:
1. Use markdown bem formatado.
2. Cite as fontes no texto usando colchetes, ex: [Arquivo: relatorio.pdf] ou [Google Search: termo alvo].
3. Adicione uma seção de "Fontes Mapeadas" no final.`;

    const finalReport = await this.callGeminiText(apiKey, model, finalPrompt);
    
    onProgress?.("Relatório de pesquisa concluído.");
    return {
      markdownReport: finalReport,
      sources: Array.from(sources),
    };
  }

  private async callGeminiSearch(apiKey: string, model: string, query: string) {
    const response = await fetch(`${this.geminiEndpoint}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: "Você é um agente de pesquisa. Busque na web e retorne os pontos principais encontrados de forma super direta." }] },
        contents: [{ role: "user", parts: [{ text: query }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0.2 },
      }),
    });
    const payload = await response.json();
    return payload.candidates?.[0]?.content?.parts?.[0]?.text || "Sem informações para este tópico.";
  }

  private async callGeminiText(apiKey: string, model: string, prompt: string) {
    const response = await fetch(`${this.geminiEndpoint}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4 },
      }),
    });
    const payload = await response.json();
    return payload.candidates?.[0]?.content?.parts?.[0]?.text || "Falha na síntese do relatório.";
  }
}
