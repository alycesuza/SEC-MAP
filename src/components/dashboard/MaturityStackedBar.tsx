import React, { useRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Download } from 'lucide-react';
import { toPng, toSvg } from 'html-to-image';
import { AnalysisResult } from '../../constants';

interface MaturityStackedBarProps {
  results: AnalysisResult[];
  onFilter: (classification: string) => void;
  isLoggedIn?: boolean;
}

export const MaturityStackedBar: React.FC<MaturityStackedBarProps> = ({ results, onFilter, isLoggedIn }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  // Agrupar por Ano
  const years = Array.from(new Set(results.map(r => r.ano))).sort();
  
  const data = years.map(year => {
    const yearResults = results.filter(r => r.ano === year);
    const total = yearResults.length;
    
    return {
      year,
      Crítico: (yearResults.filter(r => r.classification === 'Crítico').length / total) * 100,
      Parcial: (yearResults.filter(r => r.classification === 'Parcial').length / total) * 100,
      Adequado: (yearResults.filter(r => r.classification === 'Adequado').length / total) * 100,
      Excelente: (yearResults.filter(r => r.classification === 'Excelente').length / total) * 100,
    };
  });

  const handleClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const classification = data.activePayload[0].name;
      onFilter(classification);
    }
  };

  const exportChart = async (format: 'png' | 'svg') => {
    if (!chartRef.current) return;
    try {
      const options = { backgroundColor: null, style: { background: 'transparent' } };
      const dataUrl = format === 'png' ? await toPng(chartRef.current, options) : await toSvg(chartRef.current, options);
      const link = document.createElement('a');
      link.download = `maturity-chart-${Date.now()}.${format}`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erro ao exportar:', err);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl shadow-sm relative group">
      <div className="flex justify-between items-center mb-6">
        <h4 className="text-lg font-bold">Análise de Maturidade (100% Stacked)</h4>
        {isLoggedIn && (
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => exportChart('png')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500">
              <Download size={16} />
              <span className="text-[10px] ml-1">PNG</span>
            </button>
          </div>
        )}
      </div>
      <div ref={chartRef} className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            stackOffset="expand"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            onClick={handleClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis type="number" tickFormatter={(tick) => `${tick * 100}%`} stroke="#71717a" />
            <YAxis dataKey="year" type="category" stroke="#71717a" />
            <Tooltip 
              formatter={(value: number) => `${value.toFixed(1)}%`}
              contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff' }}
            />
            <Legend />
            <Bar dataKey="Crítico" stackId="a" fill="#ef4444" cursor="pointer" />
            <Bar dataKey="Parcial" stackId="a" fill="#f97316" cursor="pointer" />
            <Bar dataKey="Adequado" stackId="a" fill="#eab308" cursor="pointer" />
            <Bar dataKey="Excelente" stackId="a" fill="#22c55e" cursor="pointer" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-4 text-[10px] text-zinc-500 text-center italic">
        Clique em uma cor para filtrar a tabela de resultados por nível de maturidade.
      </p>
    </div>
  );
};
