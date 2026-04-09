import React from 'react';
import { AnalysisResult, DICTIONARY } from '../../constants';
import { cn } from '../../lib/utils';

interface CurricularHeatmapProps {
  results: AnalysisResult[];
}

export const CurricularHeatmap: React.FC<CurricularHeatmapProps> = ({ results }) => {
  const domains = DICTIONARY.map(d => d.grupo);
  const shortDomains = domains.map(d => d.replace('Segurança de ', '').replace('Segurança ', ''));

  // Função para determinar a cor com base no valor (0-15)
  // Escala de cinza/azul para alto contraste
  const getCellColor = (value: number) => {
    if (value === 0) return 'bg-zinc-100 dark:bg-zinc-900 text-zinc-400';
    if (value < 5) return 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300';
    if (value < 10) return 'bg-orange-300 dark:bg-orange-700/50 text-orange-900 dark:text-orange-100';
    if (value < 13) return 'bg-orange-500 text-white';
    return 'bg-orange-700 text-white font-bold';
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden flex flex-col h-[500px]">
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
        <h4 className="text-lg font-bold">Mapa de Calor de Densidade Curricular</h4>
        <p className="text-xs text-zinc-500 mt-1">Intensidade de cobertura por domínio em cada instituição (0 a 15 pontos)</p>
      </div>

      <div className="flex-1 overflow-auto relative">
        <table className="w-full border-collapse min-w-[800px]">
          <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-800 shadow-sm">
            <tr>
              <th className="p-3 text-left text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-200 dark:border-zinc-700 sticky left-0 bg-zinc-50 dark:bg-zinc-800 z-20 w-[200px]">
                Instituição / Curso
              </th>
              {shortDomains.map((domain, i) => (
                <th key={i} className="p-3 text-center text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-200 dark:border-zinc-700 min-w-[100px]">
                  {domain}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((r, idx) => (
              <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <td className="p-3 border-b border-zinc-100 dark:border-zinc-800 sticky left-0 bg-white dark:bg-zinc-900 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                  <p className="font-bold text-xs truncate" title={r.ies}>{r.ies}</p>
                  <p className="text-[10px] text-zinc-500 truncate" title={r.curso}>{r.curso}</p>
                </td>
                {domains.map((domain, i) => {
                  const val = r.groupScores[domain] || 0;
                  return (
                    <td key={i} className="p-1 border-b border-zinc-100 dark:border-zinc-800">
                      <div className={cn(
                        "h-10 w-full flex items-center justify-center rounded-md text-xs transition-transform hover:scale-105 cursor-default",
                        getCellColor(val)
                      )}>
                        {val}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded" />
          <span className="text-[10px] text-zinc-500">0 (Nulo)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-orange-300 rounded" />
          <span className="text-[10px] text-zinc-500">Médio</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-orange-700 rounded" />
          <span className="text-[10px] text-zinc-500">15 (Máximo)</span>
        </div>
      </div>
    </div>
  );
};
