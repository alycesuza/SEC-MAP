import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { AnalysisResult, DICTIONARY } from '../../constants';
import { cn } from '../../lib/utils';

interface ScientificRankingTableProps {
  results: AnalysisResult[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}

type SortKey = 'ies' | 'ano' | 'rawPoints' | 'score' | 'classification';

export const ScientificRankingTable: React.FC<ScientificRankingTableProps> = ({ 
  results, 
  onSelect,
  selectedId 
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const sortedResults = [...results].sort((a, b) => {
    let valA: any = a[sortKey as keyof AnalysisResult] || 0;
    let valB: any = b[sortKey as keyof AnalysisResult] || 0;

    // Caso especial para pontos brutos (soma dos groupScores)
    if (sortKey === 'rawPoints') {
      valA = Object.values(a.groupScores).reduce((sum, val) => (sum as number) + (val as number), 0);
      valB = Object.values(b.groupScores).reduce((sum, val) => (sum as number) + (val as number), 0);
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <div className="w-4 h-4" />;
    return sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="bg-white dark:bg-zinc-950 p-8 rounded-3xl shadow-sm overflow-x-auto">
      <h4 className="text-lg font-bold mb-6">Ranking de Instituições (Padrão Científico)</h4>
      <table className="w-full text-sm border-t border-b border-zinc-900 dark:border-zinc-100">
        <thead>
          <tr className="border-b border-zinc-300 dark:border-zinc-700">
            <th 
              className="p-4 text-left cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              onClick={() => handleSort('ies')}
            >
              <div className="flex items-center gap-1">
                Instituição / Curso <SortIcon column="ies" />
              </div>
            </th>
            <th 
              className="p-4 text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              onClick={() => handleSort('ano')}
            >
              <div className="flex items-center justify-center gap-1">
                Ano <SortIcon column="ano" />
              </div>
            </th>
            <th 
              className="p-4 text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              onClick={() => handleSort('rawPoints')}
            >
              <div className="flex items-center justify-center gap-1">
                Pontos Brutos <SortIcon column="rawPoints" />
              </div>
            </th>
            <th 
              className="p-4 text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              onClick={() => handleSort('score')}
            >
              <div className="flex items-center justify-center gap-1">
                Índice IIS <SortIcon column="score" />
              </div>
            </th>
            <th 
              className="p-4 text-right cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              onClick={() => handleSort('classification')}
            >
              <div className="flex items-center justify-end gap-1">
                Classificação <SortIcon column="classification" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedResults.map((r) => {
            const rawPoints = Object.values(r.groupScores).reduce((sum, val) => (sum as number) + (val as number), 0);
            return (
              <tr 
                key={r.id} 
                onClick={() => onSelect(r.id)}
                className={cn(
                  "border-b border-zinc-100 dark:border-zinc-800 transition-colors cursor-pointer",
                  selectedId === r.id ? "bg-orange-50 dark:bg-orange-900/10" : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                )}
              >
                <td className="p-4">
                  <p className="font-bold">{r.ies}</p>
                  <p className="text-xs text-zinc-500">{r.curso}</p>
                </td>
                <td className="p-4 text-center text-zinc-600 dark:text-zinc-400">{r.ano}</td>
                <td className="p-4 text-center font-mono">{rawPoints}</td>
                <td className="p-4 text-center font-black text-orange-600 dark:text-orange-500">{r.score.toFixed(1)}</td>
                <td className="p-4 text-right">
                  <span className={cn(
                    "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                    r.classification === 'Excelente' ? "text-green-600 bg-green-50 dark:bg-green-900/20" :
                    r.classification === 'Adequado' ? "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20" :
                    r.classification === 'Parcial' ? "text-orange-600 bg-orange-50 dark:bg-orange-900/20" :
                    "text-red-600 bg-red-50 dark:bg-red-900/20"
                  )}>
                    {r.classification}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} className="p-4 text-[10px] text-zinc-400 italic text-center">
              Fonte: Dados extraídos via Sec-Map Mining Engine. Tabela formatada seguindo diretrizes APA/IEEE.
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
