import React, { useRef } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip
} from 'recharts';
import { Download } from 'lucide-react';
import { toPng, toSvg } from 'html-to-image';
import { AnalysisResult, DICTIONARY } from '../../constants';

interface RadarChartScientificProps {
  results: AnalysisResult[];
  selectedResult: AnalysisResult | null;
  isLoggedIn: boolean;
}

export const RadarChartScientific: React.FC<RadarChartScientificProps> = ({
  results,
  selectedResult,
  isLoggedIn
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const domains = DICTIONARY.map(d => d.grupo);

  // Calcular Média Nacional
  const nationalAverage = domains.map(domain => {
    const sum = results.reduce((acc, r) => acc + (r.groupScores[domain] || 0), 0);
    return results.length > 0 ? Number((sum / results.length).toFixed(2)) : 0;
  });

  // Encontrar o Melhor Curso (ou usar o selecionado)
  const bestResult = [...results].sort((a, b) => b.score - a.score)[0];
  const comparisonResult = selectedResult || bestResult;

  const data = domains.map((domain, index) => ({
    subject: domain.replace('Segurança de ', '').replace('Segurança ', ''),
    ideal: 15,
    average: nationalAverage[index],
    comparison: comparisonResult ? (comparisonResult.groupScores[domain] || 0) : 0,
    fullMark: 15,
  }));

  const exportChart = async (format: 'png' | 'svg') => {
    if (!chartRef.current) return;
    
    try {
      const options = {
        backgroundColor: null, // Fundo transparente
        style: {
          background: 'transparent',
        }
      };

      let dataUrl = '';
      if (format === 'png') {
        dataUrl = await toPng(chartRef.current, options);
      } else {
        dataUrl = await toSvg(chartRef.current, options);
      }

      const link = document.createElement('a');
      link.download = `radar-chart-${Date.now()}.${format}`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erro ao exportar gráfico:', err);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl shadow-sm relative group">
      <div className="flex justify-between items-center mb-6">
        <h4 className="text-lg font-bold flex items-center gap-2">
          <Radar size={20} className="text-orange-500" />
          Raio-X de Domínios (CSEC2017)
        </h4>
        {isLoggedIn && (
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => exportChart('png')}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500"
              title="Exportar PNG Transparente"
            >
              <Download size={16} />
              <span className="text-[10px] ml-1">PNG</span>
            </button>
            <button
              onClick={() => exportChart('svg')}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500"
              title="Exportar SVG Transparente"
            >
              <Download size={16} />
              <span className="text-[10px] ml-1">SVG</span>
            </button>
          </div>
        )}
      </div>

      <div ref={chartRef} className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid stroke="#3f3f46" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#71717a', fontSize: 10 }} />
            <PolarRadiusAxis angle={30} domain={[0, 15]} tick={{ fill: '#71717a' }} />
            
            {/* Camada Ideal */}
            <Radar
              name="Teto Ideal (15 pts)"
              dataKey="ideal"
              stroke="#22c55e"
              fill="#22c55e"
              fillOpacity={0.1}
            />
            
            {/* Camada Média Nacional */}
            <Radar
              name="Média Nacional"
              dataKey="average"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.3}
            />

            {/* Camada Comparação (Melhor ou Selecionado) */}
            <Radar
              name={selectedResult ? `Selecionado: ${selectedResult.curso}` : `Melhor: ${bestResult?.curso || 'N/A'}`}
              dataKey="comparison"
              stroke="#f97316"
              fill="#f97316"
              fillOpacity={0.5}
            />
            
            <Tooltip 
              contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff' }}
              itemStyle={{ color: '#fff' }}
            />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      
      <p className="mt-4 text-[10px] text-zinc-500 text-center italic">
        * Comparação visual entre o teto ideal, a média nacional e o curso {selectedResult ? 'selecionado' : 'de melhor desempenho'}.
      </p>
    </div>
  );
};
