import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Download } from 'lucide-react';
import { toPng, toSvg } from 'html-to-image';
import { AnalysisResult } from '../../constants';

interface DistributionChartProps {
  results: AnalysisResult[];
  isLoggedIn?: boolean;
}

export const DistributionChart: React.FC<DistributionChartProps> = ({ results, isLoggedIn }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const exportChart = async (format: 'png' | 'svg') => {
    if (!chartRef.current) return;
    try {
      const options = { backgroundColor: null, style: { background: 'transparent' } };
      const dataUrl = format === 'png' ? await toPng(chartRef.current, options) : await toSvg(chartRef.current, options);
      const link = document.createElement('a');
      link.download = `distribution-chart-${Date.now()}.${format}`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erro ao exportar:', err);
    }
  };

  useEffect(() => {
    if (!svgRef.current || results.length === 0) return;

    const margin = { top: 40, right: 30, bottom: 50, left: 60 };
    const width = svgRef.current.clientWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    // Limpar SVG
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Preparar dados
    const data = results.map(r => ({
      group: r.tipo.includes('Pública') ? 'Pública' : 'Privada',
      value: r.score
    }));

    const groups = ['Pública', 'Privada'];

    // Eixos
    const x = d3.scaleBand()
      .range([0, width])
      .domain(groups)
      .padding(0.05);

    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("fill", "#71717a");

    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([height, 0]);

    svg.append("g")
      .call(d3.axisLeft(y))
      .selectAll("text")
      .style("fill", "#71717a");

    // Adicionar labels dos eixos
    svg.append("text")
      .attr("text-anchor", "end")
      .attr("x", width / 2 + 20)
      .attr("y", height + 40)
      .text("Categoria de Instituição")
      .style("fill", "#71717a")
      .style("font-size", "10px");

    svg.append("text")
      .attr("text-anchor", "end")
      .attr("transform", "rotate(-90)")
      .attr("y", -45)
      .attr("x", -height / 2 + 20)
      .text("Índice IIS (0-100)")
      .style("fill", "#71717a")
      .style("font-size", "10px");

    // Função para calcular densidade (para o Violino)
    function kernelDensityEstimator(kernel: any, X: any) {
      return function(V: any) {
        return X.map(function(x: any) {
          return [x, d3.mean(V, function(v: any) { return kernel(x - v); })];
        });
      };
    }

    function kernelEpanechnikov(k: any) {
      return function(v: any) {
        return Math.abs(v /= k) <= 1 ? 0.75 * (1 - v * v) / k : 0;
      };
    }

    // Calcular estatísticas por grupo
    groups.forEach(group => {
      const groupData = data.filter(d => d.group === group).map(d => d.value);
      if (groupData.length === 0) return;

      const sortedData = groupData.sort(d3.ascending);
      const q1 = d3.quantile(sortedData, 0.25) || 0;
      const median = d3.quantile(sortedData, 0.5) || 0;
      const q3 = d3.quantile(sortedData, 0.75) || 0;
      const min = sortedData[0];
      const max = sortedData[sortedData.length - 1];

      // Violino
      const kde = kernelDensityEstimator(kernelEpanechnikov(7), y.ticks(40));
      const density = kde(groupData);

      const xNum = d3.scaleLinear()
        .range([0, x.bandwidth() / 2])
        .domain([0, d3.max(density, d => d[1] as number) || 0]);

      svg.append("path")
        .datum(density)
        .attr("fill", group === 'Pública' ? "#3b82f6" : "#f97316")
        .attr("fill-opacity", 0.3)
        .attr("stroke", group === 'Pública' ? "#3b82f6" : "#f97316")
        .attr("stroke-width", 1)
        .attr("transform", `translate(${x(group)! + x.bandwidth() / 2},0)`)
        .attr("d", d3.area()
          .x0(d => -xNum(d[1]))
          .x1(d => xNum(d[1]))
          .y(d => y(d[0]))
          .curve(d3.curveCatmullRom)
        );

      // Boxplot (dentro do violino)
      const boxWidth = 4;
      svg.append("line")
        .attr("x1", x(group)! + x.bandwidth() / 2)
        .attr("x2", x(group)! + x.bandwidth() / 2)
        .attr("y1", y(min))
        .attr("y2", y(max))
        .attr("stroke", "#71717a")
        .attr("stroke-width", 1);

      svg.append("rect")
        .attr("x", x(group)! + x.bandwidth() / 2 - boxWidth / 2)
        .attr("y", y(q3))
        .attr("width", boxWidth)
        .attr("height", y(q1) - y(q3))
        .attr("fill", "#71717a");

      svg.append("circle")
        .attr("cx", x(group)! + x.bandwidth() / 2)
        .attr("cy", y(median))
        .attr("r", 3)
        .attr("fill", "#fff")
        .attr("stroke", "#71717a");

      // Tooltip invisível para detecção de hover (simplificado)
      svg.append("rect")
        .attr("x", x(group)!)
        .attr("y", 0)
        .attr("width", x.bandwidth())
        .attr("height", height)
        .attr("fill", "transparent")
        .on("mouseover", function(event) {
          d3.select("#tooltip")
            .style("opacity", 1)
            .html(`
              <div class="p-2 text-xs">
                <p class="font-bold border-b border-zinc-700 mb-1 pb-1">${group}</p>
                <p>Máximo: ${max.toFixed(1)}</p>
                <p>Q3: ${q3.toFixed(1)}</p>
                <p class="text-orange-500 font-bold">Mediana: ${median.toFixed(1)}</p>
                <p>Q1: ${q1.toFixed(1)}</p>
                <p>Mínimo: ${min.toFixed(1)}</p>
                <p class="mt-1 text-[10px] text-zinc-500">n = ${groupData.length}</p>
              </div>
            `);
        })
        .on("mousemove", function(event) {
          d3.select("#tooltip")
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
          d3.select("#tooltip").style("opacity", 0);
        });
    });

  }, [results]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl shadow-sm relative group">
      <div className="flex justify-between items-center mb-6">
        <h4 className="text-lg font-bold">Distribuição estatística (IIS)</h4>
        {isLoggedIn && (
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => exportChart('png')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500">
              <Download size={16} />
              <span className="text-[10px] ml-1">PNG</span>
            </button>
          </div>
        )}
      </div>
      <div ref={chartRef} className="h-[400px] w-full">
        <svg ref={svgRef} className="w-full h-full" />
      </div>
      <div 
        id="tooltip" 
        className="fixed opacity-0 pointer-events-none bg-zinc-900 text-white rounded-lg shadow-xl border border-zinc-800 z-[100] transition-opacity duration-200"
      />
      <p className="mt-4 text-[10px] text-zinc-500 text-center italic">
        Gráfico de Violino com Boxplot interno demonstrando a dispersão e densidade das notas por categoria.
      </p>
    </div>
  );
};
