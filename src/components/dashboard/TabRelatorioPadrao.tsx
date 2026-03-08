// src/components/dashboard/TabRelatorioPadrao.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, 
  ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell, AreaChart, Area,
  ComposedChart
} from 'recharts';
import { toast } from 'sonner';
import { loadRelatorioData, loadHistoricoData } from '@/app/actions';
import { 
  Calendar, Palette, Filter, Trash2, Sigma, TrendingUp, 
  PieChart as PieChartIcon, BarChart3, Download 
} from 'lucide-react';
import { format, subMonths, subYears, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';


const COLUNAS_NUMERICAS_ESPERADAS = [
  'Acervo Início', 'Acervo Final', 'Conclusos Gab.', 'And. Cartório', 'Concl. +120',
  'Concl. +365', 'And. Final', 'Produção', '% Julg. Acervo', '% Julg. Entrada',
  '1ª Baixa CNJ', 'Entradas Novos', 'Outras Entradas', 'Baixados Def.', 'Outras Baixas',
  'IAD', 'Taxa Congest.', 'Taxa Demanda', 'Taxa Redução'
];


interface DadosLinha {
  'Período': string;
  Data: Date;
  [key: string]: string | number | Date;
}

interface Milestone { 
  data: Date; 
  desc: string; 
}

interface KpiData {
  name: string;
  value: string;
  recent: string;
}

interface StatsData {
  metrica: string;
  media: number;
  mediana: number;
  max: number;
  min: number;
}

interface AnalyticsData {
  kpiAverages: KpiData[];
  statsTable: StatsData[];
}

interface HeatmapData {
  month: string;
  metric: string;
  value: number;
  normalizedValue: number;
}

interface PieLabelProps {
  name?: string;
  percent?: number;
}

interface ProductivityComparison {
  currentMonth: number;
  averagePeriod: number;
  percentageVsAverage: number;
  performance: 'excellent' | 'good' | 'attention' | 'intervention';
}

const METRICAS_INVERTIDAS = ['Conclusos Gab.', 'Acervo Final', 'Entradas Novos', 'Outras Entradas'];

const KpiCard = ({ title, value, recent }: { title: string, value: string, recent: string }) => {
  const avg = parseFloat(value);
  const rec = parseFloat(recent);
  const diff = avg !== 0 ? ((rec - avg) / avg) * 100 : 0;
  const isInverted = METRICAS_INVERTIDAS.includes(title);
  const isPositive = isInverted ? diff <= 0 : diff >= 0;
  const diffColor = isPositive ? 'text-green-600' : 'text-red-500';
  const diffLabel = diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-muted-foreground">Média</span>
          <span className="text-xl font-bold">{value}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-muted-foreground">Mês atual</span>
          <span className="text-xl font-semibold">{recent}</span>
          <span className={`text-xs font-medium ${diffColor}`}>{diffLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
};

// Componente para Gráfico de Gauge melhorado
const GaugeChart = ({ 
  currentValue, 
  averageValue, 
  title, 
  comparison 
}: { 
  currentValue: number;
  averageValue: number;
  title: string;
  comparison: ProductivityComparison;
}) => {
  const percentage = Math.min(Math.abs(comparison.percentageVsAverage), 200);
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${(percentage / 200) * circumference} ${circumference}`;
  
  const getColor = (performance: string) => {
    switch (performance) {
      case 'excellent': return '#4CAF50';
      case 'good': return '#FFC107';
      case 'attention': return '#FF9800';
      case 'intervention': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getPerformanceText = (performance: string) => {
    switch (performance) {
      case 'excellent': return 'Excelente';
      case 'good': return 'Bom';
      case 'attention': return 'Atenção';
      case 'intervention': return 'Intervenção';
      default: return 'N/A';
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
          <circle
            cx="100"
            cy="100"
            r={radius}
            stroke="#e5e7eb"
            strokeWidth="20"
            fill="none"
          />
          <circle
            cx="100"
            cy="100"
            r={radius}
            stroke={getColor(comparison.performance)}
            strokeWidth="20"
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{currentValue.toFixed(1)}</span>
          <span className="text-xs text-gray-600">vs {averageValue.toFixed(1)}</span>
          <span className="text-sm font-medium text-center">
            {comparison.percentageVsAverage > 0 ? '+' : ''}{comparison.percentageVsAverage.toFixed(1)}%
          </span>
        </div>
      </div>
      <span className="mt-2 text-sm font-medium text-center">{title}</span>
      <span className="text-xs text-center" style={{ color: getColor(comparison.performance) }}>
        {getPerformanceText(comparison.performance)}
      </span>
    </div>
  );
};

// Componente para Heatmap
const HeatmapCell = ({ data, maxValue }: { data: HeatmapData, maxValue: number }) => {
  const intensity = data.value / maxValue;
  const opacity = Math.max(0.1, intensity);
  
  return (
    <div
      className="w-8 h-8 border border-gray-200 flex items-center justify-center text-xs font-medium rounded"
      style={{
        backgroundColor: `rgba(34, 197, 94, ${opacity})`,
        color: intensity > 0.5 ? 'white' : 'black'
      }}
      title={`${data.month} - ${data.metric}: ${data.value}`}
    >
      {data.value.toFixed(0)}
    </div>
  );
};

// Função para exportar relatório como HTML/Print
const exportToHTML = (dados: DadosLinha[], analytics: AnalyticsData | null, filtroDataInicio: string, filtroDataFim: string) => {
  const periodo = filtroDataInicio && filtroDataFim 
    ? `${format(new Date(filtroDataInicio), 'dd/MM/yyyy')} a ${format(new Date(filtroDataFim), 'dd/MM/yyyy')}`
    : `Todo o histórico (${dados.length} registros)`;
    
  const dadosParaRelatorio = dados.slice(-12);
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Relatório de Produtividade Judicial</title>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #007bff; padding-bottom: 20px; }
        .title { font-size: 24px; font-weight: bold; color: #007bff; margin-bottom: 10px; }
        .subtitle { font-size: 14px; color: #666; }
        .section { margin: 25px 0; }
        .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #007bff; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .kpi-card { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff; }
        .kpi-title { font-size: 12px; color: #666; margin-bottom: 5px; }
        .kpi-value { font-size: 20px; font-weight: bold; color: #333; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; color: #007bff; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .data-table th, .data-table td { text-align: center; font-size: 11px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px; }
        @media print {
          body { margin: 10px; }
          .no-print { display: none; }
          .section { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">Relatório de Produtividade Judicial</div>
        <div class="subtitle">Período: ${periodo}</div>
        <div class="subtitle">Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
      </div>

      ${analytics ? `
      <div class="section">
        <div class="section-title">Indicadores Principais (Médias do Período)</div>
        <div class="kpi-grid">
          ${analytics.kpiAverages.map(kpi => `
            <div class="kpi-card">
              <div class="kpi-title">${kpi.name}</div>
              <div class="kpi-value">${kpi.value}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="section">
        <div class="section-title">Resumo Estatístico (Top 5 Métricas)</div>
        <table>
          <thead>
            <tr>
              <th>Métrica</th>
              <th>Média</th>
              <th>Mediana</th>
              <th>Mínimo</th>
              <th>Máximo</th>
            </tr>
          </thead>
          <tbody>
            ${['Conclusos Gab.', 'Produção', 'Acervo Final', 'Baixados Def.', 'IAD']
              .map(metrica => {
                const stat = analytics.statsTable.find(s => s.metrica === metrica);
                return stat ? `
                  <tr>
                    <td><strong>${stat.metrica}</strong></td>
                    <td>${stat.media.toFixed(1)}</td>
                    <td>${stat.mediana.toFixed(1)}</td>
                    <td>${stat.min}</td>
                    <td>${stat.max}</td>
                  </tr>
                ` : '';
              }).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      <div class="section">
        <div class="section-title">Dados Mensais Detalhados (Últimos 12 Períodos)</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Período</th>
              <th>Conclusos Gab.</th>
              <th>Produção</th>
              <th>Entradas Total</th>
              <th>Baixados</th>
              <th>Acervo Total</th>
            </tr>
          </thead>
          <tbody>
            ${dadosParaRelatorio.map(linha => `
              <tr>
                <td><strong>${linha['Período']}</strong></td>
                <td>${linha['Conclusos Gab.'] || 0}</td>
                <td>${linha['Produção'] || 0}</td>
                <td>${(Number(linha['Entradas Novos'] || 0) + Number(linha['Outras Entradas'] || 0)).toFixed(0)}</td>
                <td>${linha['Baixados Def.'] || 0}</td>
                <td>${linha['Acervo Final'] || 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="footer">
        <p>Relatório gerado automaticamente pelo Sistema de Análise de Produtividade Judicial</p>
        <p>Para imprimir este relatório como PDF, use Ctrl+P (Cmd+P no Mac) e selecione &quot;Salvar como PDF&quot;</p>
      </div>

      <script>
        // Auto-print quando a página carregar (opcional)
        // window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  // Criar e abrir nova janela com o relatório
  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(htmlContent);
    newWindow.document.close();
    toast.success('Relatório gerado! Use Ctrl+P para imprimir/salvar como PDF');
  } else {
    // Fallback: download como arquivo HTML
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-produtividade-${format(new Date(), 'yyyy-MM-dd-HHmm')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Relatório baixado como HTML! Abra o arquivo e use Ctrl+P para salvar como PDF');
  }
};

interface HistoricoSnapshot {
  dataHora: string;
  isMediaHistorica: number;
  conclusos: number;
  mediaDias: number;
  [key: string]: string | number;
}

export function TabRelatorioPadrao({ refreshKey = 0 }: { refreshKey?: number }) {
  const [dados, setDados] = useState<DadosLinha[]>([]);
  const [historico, setHistorico] = useState<HistoricoSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [colunasNumericas, setColunasNumericas] = useState<string[]>([]);
  const [metricasSelecionadas, setMetricasSelecionadas] = useState<string[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([
    { data: new Date('2024-10-01T00:00:00'), desc: 'Nova Gestão' },
    { data: new Date('2025-01-27T00:00:00'), desc: 'HomeOffice' }
  ]);
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>('');
  const [filtroDataFim, setFiltroDataFim] = useState<string>('');
  const [cores, setCores] = useState<{ [key: string]: string }>({
    'Acervo Início': '#8884d8', 'Acervo Final': '#AB63FA', 'Conclusos Gab.': '#ff8042',
    'And. Cartório': '#FFA500', 'Concl. +120': '#EF553B', 'Concl. +365': '#FF6692',
    'And. Final': '#9b59b6', 'Produção': '#82ca9d', '% Julg. Acervo': '#0088FE',
    '% Julg. Entrada': '#19D3F3', '1ª Baixa CNJ': '#4CAF50', 'Entradas Novos': '#ffc658',
    'Outras Entradas': '#f39c12', 'Baixados Def.': '#e74c3c', 'Outras Baixas': '#c0392b',
    'IAD': '#1abc9c', 'Taxa Congest.': '#3498db', 'Taxa Demanda': '#2ecc71', 'Taxa Redução': '#e67e22'
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const [dadosSalvos, historicoDados] = await Promise.all([
        loadRelatorioData(),
        loadHistoricoData(),
      ]);
      if (dadosSalvos && dadosSalvos.length > 0) {
        processarDadosCarregados(dadosSalvos);
        if (refreshKey > 0) toast.success("Dados atualizados!");
      }
      if (historicoDados && historicoDados.length > 0) {
        setHistorico(historicoDados as HistoricoSnapshot[]);
      }
      // Definir filtro padrão para últimos 2 anos
      const today = new Date();
      const twoYearsAgo = subYears(today, 2);
      setFiltroDataInicio(format(twoYearsAgo, 'yyyy-MM-dd'));
      setFiltroDataFim(format(today, 'yyyy-MM-dd'));

      setIsLoading(false);
    };
    fetchData();
  }, [refreshKey]);

  const processarDadosCarregados = (dadosParaProcessar: { [key: string]: string | number }[]) => {
    if (!dadosParaProcessar || dadosParaProcessar.length === 0) {
      toast.warning("Nenhum dado válido encontrado para processar.");
      return;
    }
    setColunasNumericas(COLUNAS_NUMERICAS_ESPERADAS);
    setMetricasSelecionadas(['Conclusos Gab.', 'Produção']);

    const NOMES_MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    const mesesMap: { [key: string]: number } = { 'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5, 'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11 };

    const parsePeriodo = (valor: string | number): { data: Date; label: string } | null => {
      const str = String(valor).trim();

      // formato "01/02/2026 até 28/02/2026" ou "01/02/2026 ate 28/02/2026"
      const matchRange = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+at[eé]\s+/i);
      if (matchRange) {
        const [, , mes, ano] = matchRange;
        const d = new Date(parseInt(ano), parseInt(mes) - 1, 1);
        if (!isNaN(d.getTime())) {
          const label = `${NOMES_MESES[d.getMonth()]}/${ano.slice(-2)}`;
          return { data: d, label };
        }
      }

      // formato jan/25 ou jan/2025
      const strLower = str.toLowerCase();
      const partes = strLower.split('/');
      if (partes.length === 2 && mesesMap[partes[0]] !== undefined) {
        const anoStr = partes[1].length === 2 ? `20${partes[1]}` : partes[1];
        const d = new Date(parseInt(anoStr), mesesMap[partes[0]], 1);
        if (!isNaN(d.getTime())) return { data: d, label: strLower };
      }

      // formato ISO ou outros
      const d = new Date(valor as string);
      if (!isNaN(d.getTime())) {
        const label = `${NOMES_MESES[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
        return { data: d, label };
      }

      return null;
    };

    const dadosFormatados = dadosParaProcessar.map(linha => {
      try {
        const periodoValor = linha['Período'];
        if (periodoValor === undefined || periodoValor === null || String(periodoValor).trim() === '') return null;
        const resultado = parsePeriodo(periodoValor);
        if (!resultado) return null;

        const linhaProcessada: DadosLinha = {
          'Período': resultado.label,
          Data: resultado.data
        };

        // Colunas de texto não-numéricas (mantidas como string)
        ['ID', 'Data/Hora', 'Vara', 'Status'].forEach(col => {
          if (linha[col] !== undefined) linhaProcessada[col] = String(linha[col]);
        });

        COLUNAS_NUMERICAS_ESPERADAS.forEach(col => {
          const valor = linha[col];
          linhaProcessada[col] = typeof valor === 'string'
            ? Number(valor.replace(/[^0-9.,-]+/g, "").replace(",", ".")) || 0
            : Number(valor) || 0;
        });
        return linhaProcessada;
      } catch {
        return null;
      }
    }).filter((item): item is DadosLinha => item !== null).sort((a,b) => a.Data.getTime() - b.Data.getTime());

    if (dadosFormatados.length > 0) {
      setDados(dadosFormatados);
      toast.success(`${dadosFormatados.length} linhas de dados processadas com sucesso!`);
    } else {
      toast.error("Nenhuma linha pôde ser processada.", { description: "Verifique se a coluna 'Período' está no formato correto (ex: jan/25 ou 01/01/2025 até 31/01/2025)." });
    }
  };
  

  const handleExportReport = () => {
    exportToHTML(dadosFiltrados, analytics, filtroDataInicio, filtroDataFim);
  };


  const dadosFiltrados = useMemo(() => {
    if (!dados) return []; 
    const inicio = filtroDataInicio ? new Date(filtroDataInicio + "T00:00:00") : null; 
    const fim = filtroDataFim ? new Date(filtroDataFim + "T00:00:00") : null; 
    return dados.filter(d => { 
      if (inicio && d.Data < inicio) return false; 
      if (fim && d.Data > fim) return false; 
      return true; 
    });
  }, [dados, filtroDataInicio, filtroDataFim]);

  // Cálculo da comparação de produtividade melhorado
  const productivityComparison = useMemo((): ProductivityComparison | null => {
    if (dadosFiltrados.length === 0) return null;

    const ultimoMes = dadosFiltrados[dadosFiltrados.length - 1];
    const currentMonth = Number(ultimoMes['Produção']) || 0;

    const totalProdutividade = dadosFiltrados.reduce((sum, d) => sum + (Number(d['Produção']) || 0), 0);
    const averagePeriod = totalProdutividade / dadosFiltrados.length;
    
    const percentageVsAverage = averagePeriod > 0 ? ((currentMonth - averagePeriod) / averagePeriod) * 100 : 0;
    
    let performance: 'excellent' | 'good' | 'attention' | 'intervention';
    if (percentageVsAverage >= 20) performance = 'excellent';
    else if (percentageVsAverage >= 0) performance = 'good';
    else if (percentageVsAverage >= -20) performance = 'attention';
    else performance = 'intervention';
    
    return {
      currentMonth,
      averagePeriod,
      percentageVsAverage,
      performance
    };
  }, [dadosFiltrados]);

  // Dados para análise simplificada - apenas entradas vs baixados
  const flowData = useMemo(() => {
    if (dadosFiltrados.length === 0) return null;

    const totals = {
      entradas: dadosFiltrados.reduce((sum, d) => sum + (Number(d['Entradas Novos']) || 0) + (Number(d['Outras Entradas']) || 0), 0),
      baixados: dadosFiltrados.reduce((sum, d) => sum + (Number(d['Baixados Def.']) || 0) + (Number(d['Outras Baixas']) || 0), 0)
    };

    return {
      entradas: totals.entradas,
      baixados: totals.baixados,
      saldoLiquido: totals.entradas - totals.baixados,
      taxaResolucao: totals.entradas > 0 ? (totals.baixados / totals.entradas * 100) : 0
    };
  }, [dadosFiltrados]);

  // Dados para gráfico de pizza - Composição do Acervo
  const pieData = useMemo(() => {
    if (dadosFiltrados.length === 0) return [];

    const ultimoPeriodo = dadosFiltrados[dadosFiltrados.length - 1];
    return [
      { name: 'And. Final', value: Number(ultimoPeriodo['And. Final']) || 0, fill: '#8884d8' },
      { name: 'And. Cartório', value: Number(ultimoPeriodo['And. Cartório']) || 0, fill: '#AB63FA' },
      { name: 'Conclusos Gab.', value: Number(ultimoPeriodo['Conclusos Gab.']) || 0, fill: '#82ca9d' },
      { name: 'Concl. +120', value: Number(ultimoPeriodo['Concl. +120']) || 0, fill: '#ffc658' },
      { name: 'Concl. +365', value: Number(ultimoPeriodo['Concl. +365']) || 0, fill: '#ff8042' },
    ].filter(item => item.value > 0);
  }, [dadosFiltrados]);

  // Estatísticas do acervo para o card reformulado
  const acervoStats = useMemo(() => {
    if (dadosFiltrados.length === 0) return { total: 0, emAndamento: 0, cartorio: 0, gabinete: 0, pctCartorio: 0, pctGabinete: 0 };
    const ultimoPeriodo = dadosFiltrados[dadosFiltrados.length - 1];
    const total = Number(ultimoPeriodo['Acervo Final']) || 0;
    const emAndamento = Number(ultimoPeriodo['And. Final']) || 0;
    const cartorio = Number(ultimoPeriodo['And. Cartório']) || 0;
    const gabinete = Number(ultimoPeriodo['Conclusos Gab.']) || 0;
    const totalDistribuicao = cartorio + gabinete;
    return {
      total,
      emAndamento,
      cartorio,
      gabinete,
      pctCartorio: totalDistribuicao > 0 ? (cartorio / totalDistribuicao) * 100 : 0,
      pctGabinete: totalDistribuicao > 0 ? (gabinete / totalDistribuicao) * 100 : 0,
    };
  }, [dadosFiltrados]);

  const acervoComposicaoData = useMemo(() => [
    { name: 'And. Cartório', value: acervoStats.cartorio, fill: '#6366f1' },
    { name: 'Conclusos Gab.', value: acervoStats.gabinete, fill: '#22c55e' },
  ].filter(item => item.value > 0), [acervoStats]);

  // Dados para heatmap
  const heatmapData = useMemo((): HeatmapData[] => {
    if (dadosFiltrados.length === 0) return [];

    const metricas = COLUNAS_NUMERICAS_ESPERADAS;
    const data: HeatmapData[] = [];
    
    const maxValues: { [key: string]: number } = {};
    metricas.forEach(metrica => {
      maxValues[metrica] = Math.max(...dadosFiltrados.map(d => Number(d[metrica]) || 0));
    });
    
    dadosFiltrados.forEach(periodo => {
      metricas.forEach(metrica => {
        const value = Number(periodo[metrica]) || 0;
        data.push({
          month: periodo['Período'],
          metric: metrica,
          value,
          normalizedValue: maxValues[metrica] > 0 ? value / maxValues[metrica] : 0
        });
      });
    });
    
    return data;
  }, [dadosFiltrados]);

  const analytics = useMemo((): AnalyticsData | null => {
    if (dadosFiltrados.length === 0) return null;
    
    const kpiMetrics = ['Conclusos Gab.', 'Acervo Final', 'Entradas Novos', 'Outras Entradas', 'Baixados Def.', 'Outras Baixas'];
    const ultimoMes = dadosFiltrados[dadosFiltrados.length - 1];
    const kpiAverages: KpiData[] = kpiMetrics.map(metrica => {
        const total = dadosFiltrados.reduce((sum, d) => sum + (Number(d[metrica]) || 0), 0);
        return {
          name: metrica,
          value: (total / dadosFiltrados.length).toFixed(1),
          recent: Number(ultimoMes?.[metrica] || 0).toFixed(1),
      };
  });

  const statsTable: StatsData[] = colunasNumericas.map(metrica => {
    const values = dadosFiltrados.map(d => Number(d[metrica]) || 0).filter(v => !isNaN(v)); 
    if (values.length === 0) return { metrica, media: 0, mediana: 0, max: 0, min: 0 }; 
    values.sort((a, b) => a - b); 
    const sum = values.reduce((a, b) => a + b, 0); 
    const mid = Math.floor(values.length / 2); 
    const median = values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid]; 
    return { 
      metrica, 
      media: sum / values.length, 
      mediana: median, 
      max: Math.max(...values), 
      min: Math.min(...values) 
    };
  });
  
  return { kpiAverages, statsTable };
}, [dadosFiltrados, colunasNumericas]);

const handleAddMilestone = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault(); 
  const formData = new FormData(e.currentTarget); 
  const desc = formData.get('desc') as string; 
  const dataStr = formData.get('data') as string; 
  if (desc && dataStr) { 
    const data = new Date(dataStr + "T00:00:00"); 
    setMilestones([...milestones, { data, desc }]); 
    e.currentTarget.reset(); 
  }
};

const handleDeleteMilestone = (index: number) => setMilestones(milestones.filter((_, i) => i !== index));

const handleSetPeriod = (period: string) => {
  const today = new Date(); 
  let start: Date; 
  let end: Date = today;
  switch (period) { 
    case 'last_month': 
      start = startOfMonth(subMonths(today, 1)); 
      end = endOfMonth(subMonths(today, 1)); 
      break; 
    case 'last_quarter': 
      start = startOfMonth(subMonths(today, 3)); 
      break; 
    case 'last_semester': 
      start = startOfMonth(subMonths(today, 6)); 
      break; 
    case 'last_year': 
      start = subYears(today, 1); 
      break; 
    case 'last_2_years': 
      start = subYears(today, 2); 
      break;
    case 'last_3_years': 
      start = subYears(today, 3); 
      break; 
    case 'all': 
      if (dados.length === 0) return; 
      start = dados[0].Data; 
      end = dados[dados.length - 1].Data; 
      break; 
    default: 
      start = today; 
  }
  setFiltroDataInicio(format(start, 'yyyy-MM-dd')); 
  setFiltroDataFim(format(end, 'yyyy-MM-dd'));
};

if (isLoading) return <div>Carregando dados...</div>;

return (
  <div className="flex flex-col lg:flex-row gap-6 overflow-x-hidden">
    <aside className="no-print w-full lg:w-80 flex-shrink-0 bg-white p-6 border rounded-lg sticky top-4 self-start max-h-[calc(100vh-2rem)] overflow-y-auto">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Controles</h2>
          <Button onClick={() => window.print()} variant="outline" size="sm">
            <Download size={16} className="mr-1"/>
            PDF
          </Button>
        </div>
        
        <div>
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <Calendar size={16}/> Filtrar Período
          </h3>
          <div className="space-y-2">
            <Label htmlFor="data-inicio">De:</Label>
            <Input id="data-inicio" type="date" className="w-35" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} />
            <Label htmlFor="data-fim">Até:</Label>
            <Input id="data-fim" type="date" className="w-35" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Button size="sm" variant="outline" onClick={() => handleSetPeriod('last_month')}>Mês Passado</Button>
            <Button size="sm" variant="outline" onClick={() => handleSetPeriod('last_quarter')}>Últ. 3 meses</Button>
            <Button size="sm" variant="outline" onClick={() => handleSetPeriod('last_semester')}>Últ. 6 meses</Button>
            <Button size="sm" variant="outline" onClick={() => handleSetPeriod('last_year')}>Últ. Ano</Button>
            <Button size="sm" variant="outline" onClick={() => handleSetPeriod('last_2_years')}>Últ. 2 Anos</Button>
            <Button size="sm" variant="outline" onClick={() => handleSetPeriod('last_3_years')}>Últ. 3 Anos</Button>
            <Button size="sm" variant="outline" onClick={() => handleSetPeriod('all')}>Todo Período</Button>
        </div>
        </div>
        

        <div>
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <Filter size={16}/> Comparar Métricas (Gráficos)
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
            {colunasNumericas.map(col => (
              <div key={col} className="flex items-center gap-2">
                <Checkbox 
                  id={`check-${col}`} 
                  checked={metricasSelecionadas.includes(col)} 
                  onCheckedChange={(checked) => {
                    setMetricasSelecionadas(checked ? [...metricasSelecionadas, col] : metricasSelecionadas.filter(m => m !== col));
                  }}
                />
                <Label htmlFor={`check-${col}`}>{col}</Label>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <Palette size={16}/> Cores
          </h3>
          {metricasSelecionadas.map(metrica => (
            <div key={metrica} className="flex items-center justify-between mt-1">
              <Label htmlFor={`color-${metrica}`}>{metrica}</Label>
              <Input 
                id={`color-${metrica}`} 
                type="color" 
                className="w-12 h-8 p-1" 
                value={cores[metrica] || '#000000'} 
                onChange={e => setCores({ ...cores, [metrica]: e.target.value })}
              />
            </div>
          ))}
        </div>
        
        <div>
          <h3 className="font-semibold mb-3">Marcos Temporais</h3>
          <form onSubmit={handleAddMilestone} className="space-y-2">
            <Input name="desc" placeholder="Descrição do evento" required/>
            <Input name="data" type="date" required/>
            <Button type="submit" className="w-full">Adicionar Marco</Button>
          </form>
          <div className="mt-2 space-y-1 text-sm">
            {milestones.map((m, i) => (
              <div key={i} className="flex justify-between items-center">
                <span>{m.desc} ({format(m.data, 'dd/MM/yy')})</span>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteMilestone(i)}>
                  <Trash2 className="h-4 w-4"/>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
    
    <main className="flex-1 min-w-0 space-y-6 overflow-x-hidden">

      {analytics && productivityComparison ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {analytics.kpiAverages.map(kpi => (
              <KpiCard key={kpi.name} title={kpi.name} value={kpi.value} recent={kpi.recent} />
            ))}
          </div>

          {historico.filter(s => !s.isMediaHistorica).length > 1 && (() => {
            const parseTS = (ts: string): Date => {
              const [date, time] = ts.split(' ');
              if (!date) return new Date(0);
              const [d, m, y] = date.split('/').map(Number);
              const [hh, mm, ss] = (time || '0:0:0').split(':').map(Number);
              return new Date(y, m - 1, d, hh, mm, ss);
            };
            const chartData = [...historico]
              .filter(s => !s.isMediaHistorica)
              .sort((a, b) => parseTS(a.dataHora).getTime() - parseTS(b.dataHora).getTime())
              .map(s => ({
                label: s.dataHora.split(' ')[0],
                conclusos: s.conclusos,
                mediaDias: s.mediaDias,
              }));
            const mediaHistorica = historico.find(s => s.isMediaHistorica);
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp size={20}/> Histórico de Snapshots — Conclusos ao Longo do Tempo
                  </CardTitle>
                  <CardDescription>
                    Evolução do número de processos conclusos e média de dias conclusos por observação.
                    {mediaHistorica && <> Média histórica: <strong>{mediaHistorica.conclusos} conclusos</strong>, <strong>{mediaHistorica.mediaDias} dias</strong>.</>}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={chartData} margin={{ top: 10, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis yAxisId="left" label={{ value: 'Conclusos', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
                      <YAxis yAxisId="right" orientation="right" label={{ value: 'Média Dias', angle: 90, position: 'insideRight', style: { fontSize: 10 } }} />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="conclusos" fill="#82ca9d" name="Conclusos" opacity={0.7} />
                      <Line yAxisId="right" type="monotone" dataKey="mediaDias" stroke="#ff8042" strokeWidth={2} name="Média Dias" dot={false} />
                      {mediaHistorica && (
                        <ReferenceLine yAxisId="left" y={mediaHistorica.conclusos} stroke="#82ca9d" strokeDasharray="5 5" label={{ value: `Média: ${mediaHistorica.conclusos}`, fill: '#82ca9d', fontSize: 10 }} />
                      )}
                      {mediaHistorica && (
                        <ReferenceLine yAxisId="right" y={mediaHistorica.mediaDias} stroke="#ff8042" strokeDasharray="5 5" label={{ value: `Média dias: ${mediaHistorica.mediaDias}`, fill: '#ff8042', fontSize: 10 }} />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            );
          })()}

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp size={20}/> Comparativo de Produtividade
                </CardTitle>
                <CardDescription>
                  Compara a produção do último período ({dadosFiltrados[dadosFiltrados.length - 1]['Período']}) com a média do período filtrado.
                  A porcentagem mostra se o último mês está acima (+) ou abaixo (-) da média.
                  <strong> Excelente</strong> (≥+20%): muito acima da média;
                  <strong> Bom</strong> (0% a +19%): acima da média;
                  <strong> Atenção</strong> (-1% a -19%): abaixo da média;
                  <strong> Intervenção</strong> (≤-20%): muito abaixo da média.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <GaugeChart
                  currentValue={productivityComparison.currentMonth}
                  averageValue={productivityComparison.averagePeriod}
                  title="Último Mês vs Média do Período"
                  comparison={productivityComparison}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon size={20}/> Composição do Acervo Atual
                </CardTitle>
                <CardDescription>
                  Este painel mostra o tamanho do acervo da unidade judicial e como os processos em andamento
                  estão distribuídos entre cartório e gabinete, permitindo identificar onde está concentrada
                  a carga de trabalho.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">

                {/* Seção 1 — Estoque total */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">📦 1. Estoque total</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Este indicador mostra quantos processos existem na unidade ao final do período analisado.
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="text-2xl font-bold text-purple-700">
                        {acervoStats.total.toLocaleString('pt-BR')}
                      </div>
                      <div className="text-xs font-medium text-purple-900 mt-1">Acervo Total</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-2xl font-bold text-blue-700">
                        {acervoStats.emAndamento.toLocaleString('pt-BR')}
                      </div>
                      <div className="text-xs font-medium text-blue-900 mt-1">Em Andamento</div>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-700 space-y-2">
                    <p>O <strong>acervo total final</strong> representa a soma de todos os processos existentes ao
                    final do período analisado, <strong>independentemente da sua situação processual</strong>.</p>
                    <p>Já o <strong>acervo em andamento final</strong> corresponde apenas aos processos que
                    <strong> ainda estão tramitando</strong>, ou seja, que não foram concluídos ou baixados.</p>
                    <p>A diferença entre os dois indicadores mostra que <strong>parte do acervo total já não está
                    mais em tramitação ativa</strong>, embora ainda conste no sistema por questões administrativas
                    ou processuais.</p>
                  </div>
                </div>

                {/* Seção 2 — Composição do andamento */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">⚙️ 2. Onde estão os processos (Composição do andamento)</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    O gráfico abaixo mostra como os processos que ainda estão em andamento se distribuem entre
                    cartório e gabinete.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={acervoComposicaoData}
                          cx="50%"
                          cy="50%"
                          outerRadius={75}
                          dataKey="value"
                        >
                          {acervoComposicaoData.map((entry) => (
                            <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR')} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col justify-center gap-3">
                      <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                        <span className="text-xl">📂</span>
                        <div>
                          <div className="text-lg font-bold text-indigo-700">
                            {acervoStats.cartorio.toLocaleString('pt-BR')}
                          </div>
                          <div className="text-xs text-indigo-900">
                            Andamento em Cartório ({acervoStats.pctCartorio.toFixed(2)}%)
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                        <span className="text-xl">⚖️</span>
                        <div>
                          <div className="text-lg font-bold text-green-700">
                            {acervoStats.gabinete.toLocaleString('pt-BR')}
                          </div>
                          <div className="text-xs text-green-900">
                            Conclusos ao Gabinete ({acervoStats.pctGabinete.toFixed(2)}%)
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Frase de diagnóstico automática */}
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-800">
                      💡{' '}
                      {acervoStats.pctCartorio >= acervoStats.pctGabinete
                        ? `A maior parte do acervo em andamento (${acervoStats.pctCartorio.toFixed(0)}%) encontra-se atualmente no cartório.`
                        : `A maior parte do acervo em andamento (${acervoStats.pctGabinete.toFixed(0)}%) encontra-se atualmente conclusa ao gabinete.`
                      }
                    </p>
                  </div>
                </div>

              </CardContent>
            </Card>
          </div>

          <Card>
            {/* Card simples: Fluxo Entradas vs Baixados */}
{flowData && (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <BarChart3 size={20}/> Fluxo do Período: Entradas vs Baixados
      </CardTitle>
      <CardDescription>
        Comparativo simples entre processos que entraram e saíram do acervo no período filtrado
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{flowData.entradas}</div>
          <div className="text-sm text-blue-800">Entradas Totais</div>
          <div className="text-xs text-gray-600 mt-1">Processos que ingressaram</div>
        </div>
        
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{flowData.baixados}</div>
          <div className="text-sm text-green-800">Baixados</div>
          <div className="text-xs text-gray-600 mt-1">Processos finalizados</div>
        </div>
        
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-700">{flowData.taxaResolucao.toFixed(1)}%</div>
          <div className="text-sm text-gray-800">Taxa de Resolução</div>
          <div className="text-xs text-gray-600 mt-1">Baixados ÷ Entradas</div>
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
        <p className="text-xs text-amber-800">
          <strong>Saldo líquido:</strong> {flowData.saldoLiquido > 0 ? '+' : ''}{flowData.saldoLiquido} processos 
          {flowData.saldoLiquido > 0 
            ? ' (mais entradas que baixados - acervo cresceu)' 
            : flowData.saldoLiquido < 0 
              ? ' (mais baixados que entradas - acervo diminuiu)'
              : ' (entradas = baixados - acervo estável)'
          }
        </p>
      </div>
    </CardContent>
  </Card>
)}
            <CardHeader><CardTitle>Comparativo em Linhas</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={dadosFiltrados} margin={{ top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="Período" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {metricasSelecionadas.map(metrica => 
                    <Line key={metrica} type="monotone" dataKey={metrica} stroke={cores[metrica] || '#000000'} strokeWidth={2} />
                  )}
                  {milestones.map((m, milestoneIndex) =>
                    <ReferenceLine
                      key={milestoneIndex}
                      x={format(m.data, 'MMM/yy', { locale: ptBR }).toLowerCase()}
                      stroke="red"
                      label={{ value: m.desc, position: 'top', fill: 'red' }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle>Comparativo em Barras</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dadosFiltrados}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="Período" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {metricasSelecionadas.map(metrica => 
                    <Bar key={metrica} dataKey={metrica} fill={cores[metrica] || '#000000'} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Análise de Entradas (Área Empilhada)</CardTitle>
              <CardDescription>Visualização da contribuição de casos novos vs outras entradas</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dadosFiltrados}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="Período" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="Entradas Novos"
                    stackId="1"
                    stroke="#19D3F3"
                    fill="#19D3F3"
                    fillOpacity={0.7}
                  />
                  <Area
                    type="monotone"
                    dataKey="Outras Entradas"
                    stackId="1"
                    stroke="#FF6692"
                    fill="#FF6692"
                    fillOpacity={0.7}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Análise com Linha de Tendência</CardTitle>
              <CardDescription>Produção (barras) vs Conclusos Gab. (linha) com tendência</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={dadosFiltrados}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="Período" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="Produção" fill="#82ca9d" name="Produção" />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="Conclusos Gab."
                    stroke="#8884d8"
                    strokeWidth={3}
                    name="Conclusos Gab."
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mapa de Calor - Intensidade das Métricas</CardTitle>
              <CardDescription>Visualização da intensidade de diferentes métricas ao longo do tempo</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="inline-block min-w-full">
                  <div className="grid grid-cols-1 gap-4">
                    {COLUNAS_NUMERICAS_ESPERADAS.map(metrica => (
                      <div key={metrica} className="space-y-2">
                        <h4 className="font-medium text-sm">{metrica}</h4>
                        <div className="flex gap-1 flex-wrap">
                          {heatmapData
                            .filter(d => d.metric === metrica)
                            .map((data, heatmapIndex) => (
                              <HeatmapCell key={heatmapIndex} data={data} maxValue={Math.max(...heatmapData.filter(d => d.metric === metrica).map(d => d.value))} />
                            ))
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-gray-600">
                    <span>Baixa intensidade</span>
                    <div className="w-4 h-4 bg-green-100 border border-gray-200 rounded"></div>
                    <div className="w-4 h-4 bg-green-300 border border-gray-200 rounded"></div>
                    <div className="w-4 h-4 bg-green-500 border border-gray-200 rounded"></div>
                    <div className="w-4 h-4 bg-green-700 border border-gray-200 rounded"></div>
                    <span>Alta intensidade</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sigma size={20}/> Resumo Estatístico
              </CardTitle>
              <CardDescription>Cálculos baseados no período filtrado para TODAS as métricas do arquivo.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Métrica</TableHead>
                    <TableHead>Média</TableHead>
                    <TableHead>Mediana</TableHead>
                    <TableHead>Mínimo</TableHead>
                    <TableHead>Máximo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.statsTable.map(s => (
                    <TableRow key={s.metrica}>
                      <TableCell className="font-medium">{s.metrica}</TableCell>
                      <TableCell>{s.media.toFixed(2)}</TableCell>
                      <TableCell>{s.mediana.toFixed(2)}</TableCell>
                      <TableCell>{s.min}</TableCell>
                      <TableCell>{s.max}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="flex items-center justify-center py-12"> 
          <p className="text-gray-500">Nenhum dado para analisar. Carregue um arquivo, cole dados ou adicione linhas na seção acima.</p> 
        </Card>
      )}
    </main>
  </div>
);
}