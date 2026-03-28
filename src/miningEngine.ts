import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { DICTIONARY, Match, AnalysisResult } from './constants';
import { normalizeText } from './lib/utils';

// Configuração do worker do PDF.js para processamento em segundo plano
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Extrai o texto de um arquivo PDF.
 * @param file O arquivo PDF enviado pelo usuário.
 * @param onProgress Callback para atualizar a barra de progresso.
 * @returns Uma string contendo todo o texto extraído do PDF.
 */
export async function extractTextFromPDF(file: File, onProgress: (percent: number) => void): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  // Itera por todas as páginas do PDF
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    // Junta os itens de texto da página em uma única string
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
    // Atualiza o progresso baseado na página atual
    onProgress(Math.round((i / pdf.numPages) * 100));
  }

  // Verifica se o texto extraído está vazio (comum em PDFs que são apenas imagens)
  if (!fullText.trim()) {
    throw new Error('PDF parece ser uma imagem ou está vazio (sem OCR).');
  }

  return fullText;
}

/**
 * Calcula o Índice de Inclusão de Segurança (IIS) baseado nos termos encontrados.
 * @param matches Lista de ocorrências encontradas no texto.
 * @returns Objeto com o score final, scores por grupo e classificação.
 */
export function calculateIIS(matches: Match[]): { score: number, groupScores: Record<string, number>, classification: AnalysisResult['classification'] } {
  // Filtra apenas os matches que não foram marcados como Falso Positivo
  const activeMatches = matches.filter(m => !m.isIgnored);
  const groupScores: Record<string, number> = {};
  
  // Inicializa a pontuação de todos os grupos definidos no dicionário com zero
  DICTIONARY.forEach(g => {
    groupScores[g.grupo] = 0;
  });

  // Cálculo de presença binária por conceito:
  // Se um conceito (ex: "Secure Coding") for encontrado uma ou mais vezes, 
  // ele soma seu peso ao grupo correspondente apenas uma vez.
  const foundConceptIds = new Set<string>();
  activeMatches.forEach(m => {
    if (!foundConceptIds.has(m.conceptId)) {
      foundConceptIds.add(m.conceptId);
      groupScores[m.group] += m.weight;
    }
  });

  // Aplica o teto por grupo (Máximo de 15 pontos por categoria conforme o referencial)
  let totalSum = 0;
  Object.keys(groupScores).forEach(group => {
    groupScores[group] = Math.min(groupScores[group], 15);
    totalSum += groupScores[group];
  });

  // Normalização do Score Final (Baseado em um máximo teórico de 75 pontos -> 100%)
  const score = Math.min(Math.round((totalSum / 75) * 100), 100);

  // Define a classificação qualitativa baseada no score numérico
  let classification: AnalysisResult['classification'] = 'Crítico';
  if (score >= 75) classification = 'Excelente';
  else if (score >= 50) classification = 'Adequado';
  else if (score >= 25) classification = 'Parcial';

  return { score, groupScores, classification };
}

/**
 * Realiza a mineração de conceitos no texto extraído.
 * @param text O texto completo do PPC.
 * @returns Uma lista de Match contendo as ocorrências e seus contextos.
 */
export function mineConcepts(text: string): Match[] {
  // Normaliza o texto (remove acentos e caracteres especiais para busca)
  const normalizedText = normalizeText(text);
  const matches: Match[] = [];

  // Percorre o dicionário de competências
  DICTIONARY.forEach(group => {
    group.conceitos.forEach(concept => {
      concept.tokens.forEach(token => {
        const normalizedToken = normalizeText(token);
        // Utiliza Regex com \b (word boundaries) para garantir que buscamos a palavra exata
        const regex = new RegExp(`\\b${normalizedToken}\\b`, 'gi');
        let match;
        
        // Busca todas as ocorrências do token no texto
        while ((match = regex.exec(normalizedText)) !== null) {
          // Captura um snippet (trecho) de contexto ao redor da palavra encontrada
          const contextSize = 180; // Aproximadamente 3-4 linhas de contexto
          let start = Math.max(0, match.index - contextSize);
          let end = Math.min(normalizedText.length, match.index + normalizedToken.length + contextSize);
          
          let snippet = normalizedText.substring(start, end);
          
          // Refinamento do snippet: tenta não cortar palavras no início e no fim
          if (start > 0) {
            const firstSpace = snippet.indexOf(' ');
            if (firstSpace !== -1 && firstSpace < 20) {
              snippet = snippet.substring(firstSpace + 1);
            }
          }
          if (end < normalizedText.length) {
            const lastSpace = snippet.lastIndexOf(' ');
            if (lastSpace !== -1 && (snippet.length - lastSpace) < 20) {
              snippet = snippet.substring(0, lastSpace);
            }
          }

          // Adiciona a ocorrência à lista de resultados
          matches.push({
            id: crypto.randomUUID(),
            conceptId: concept.id,
            conceptName: concept.nome,
            group: group.grupo,
            weight: concept.peso,
            token: token,
            snippet: `...${snippet.trim()}...`,
            isIgnored: false
          });
        }
      });
    });
  });

  return matches;
}
