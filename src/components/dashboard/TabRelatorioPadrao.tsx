// src/components/dashboard/TabRelatorioPadrao.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, 
  ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell, AreaChart, Area,
  ScatterChart, Scatter, ComposedChart
} from 'recharts';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { loadRelatorioData, saveRelatorioData } from '@/app/actions';
import { 
  Calendar, Palette, Filter, Trash2, Sigma, TrendingUp, 
  PieChart as PieChartIcon, BarChart3, Download 
} from 'lucide-react';
import { format, subMonths, subYears, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLUNAS_ESPERADAS = [
  'Mês/Ano', 'Acervo total', 'Acervo em andamento', 'Conclusos', 'Conclusos - 100 dias', 
  'Conclusos + 365', 'Entradas - Casos novos', 'Entradas - Outras', 'Entrada - Total', 
  'Enviados Conclusos', 'Produtividade', 'Baixados'
];

interface DadosLinha { 
  'Mês/Ano': string; 
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

const KpiCard = ({ title, value }: { title: string, value: string }) => (
  <Card>
    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

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
            ${['Conclusos', 'Produtividade', 'Entrada - Total', 'Baixados', 'Acervo total']
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
              <th>Mês/Ano</th>
              <th>Conclusos</th>
              <th>Produtividade</th>
              <th>Entrada Total</th>
              <th>Baixados</th>
              <th>Acervo Total</th>
            </tr>
          </thead>
          <tbody>
            ${dadosParaRelatorio.map(linha => `
              <tr>
                <td><strong>${linha['Mês/Ano']}</strong></td>
                <td>${linha['Conclusos'] || 0}</td>
                <td>${linha['Produtividade'] || 0}</td>
                <td>${linha['Entrada - Total'] || 0}</td>
                <td>${linha['Baixados'] || 0}</td>
                <td>${linha['Acervo total'] || 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="footer">
        <p>Relatório gerado automaticamente pelo Sistema de Análise de Produtividade Judicial</p>
        <p>Para imprimir este relatório como PDF, use Ctrl+P (Cmd+P no Mac) e selecione "Salvar como PDF"</p>
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

export function TabRelatorioPadrao() {
  const [dados, setDados] = useState<DadosLinha[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [colunasNumericas, setColunasNumericas] = useState<string[]>([]);
  const [metricasSelecionadas, setMetricasSelecionadas] = useState<string[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([
    { data: new Date('2024-10-01T00:00:00'), desc: 'Nova Gestão' },
    { data: new Date('2025-01-27T00:00:00'), desc: 'HomeOffice' }
  ]);
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>('');
  const [filtroDataFim, setFiltroDataFim] = useState<string>('');
  const [pastedData, setPastedData] = useState<string>('');
  const [cores, setCores] = useState<{ [key: string]: string }>({
    'Acervo total': '#8884d8', 'Produtividade': '#82ca9d', 'Baixados': '#ffc658', 'Conclusos': '#ff8042', 'Entrada - Total': '#0088FE',
    'Acervo em andamento': '#AB63FA', 'Conclusos - 100 dias': '#FFA500', 'Conclusos + 365': '#EF553B', 'Entradas - Casos novos': '#19D3F3', 'Entradas - Outras': '#FF6692', 'Enviados Conclusos': '#4CAF50'
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const dadosSalvos = await loadRelatorioData();
      if (dadosSalvos && dadosSalvos.length > 0) {
        processarDadosCarregados(dadosSalvos);
        toast.success("Dados carregados do banco de dados!");
      }
      // Definir filtro padrão para últimos 2 anos
      const today = new Date();
      const twoYearsAgo = subYears(today, 2);
      setFiltroDataInicio(format(twoYearsAgo, 'yyyy-MM-dd'));
      setFiltroDataFim(format(today, 'yyyy-MM-dd'));
      
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const processarDadosCarregados = (dadosParaProcessar: { [key: string]: string | number }[]) => {
    if (!dadosParaProcessar || dadosParaProcessar.length === 0) {
      toast.warning("Nenhum dado válido encontrado para processar.");
      return;
    }
    const numericas = COLUNAS_ESPERADAS.filter(c => c !== 'Mês/Ano');
    setColunasNumericas(numericas);
    setMetricasSelecionadas(['Conclusos', 'Produtividade']);
    const mesesMap: { [key: string]: string } = { 'jan': '0', 'fev': '1', 'mar': '2', 'abr': '3', 'mai': '4', 'jun': '5', 'jul': '6', 'ago': '7', 'set': '8', 'out': '9', 'nov': '10', 'dez': '11' };
    
    const dadosFormatados = dadosParaProcessar.map(linha => {
      try {
        const mesAnoStr = String(linha['Mês/Ano']).toLowerCase().trim();
        const [mesStr, anoStrFull] = mesAnoStr.split('/');
        if (!mesesMap[mesStr]) return null;
        const anoStr = anoStrFull.length === 2 ? `20${anoStrFull}` : anoStrFull;
        const dataCompleta = new Date(parseInt(anoStr), parseInt(mesesMap[mesStr]), 1);
        if (isNaN(dataCompleta.getTime())) return null;
        
        const linhaProcessada: DadosLinha = { 
          'Mês/Ano': String(linha['Mês/Ano']), 
          Data: dataCompleta 
        };
        
        numericas.forEach(col => {
          const valor = linha[col];
          linhaProcessada[col] = typeof valor === 'string' ? Number(valor.replace(/[^0-9.,-]+/g, "").replace(",", ".")) || 0 : Number(valor) || 0;
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
      toast.error("Nenhuma linha pôde ser processada.", { description: "Verifique se a coluna 'Mês/Ano' está no formato correto (ex: jan/21)." });
    }
  };
  
  const handleFileChangeXLSX = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; 
    if (!file) return; 
    const reader = new FileReader();
    reader.onload = (e) => {
      try { 
        const data = new Uint8Array(e.target?.result as ArrayBuffer); 
        const workbook = XLSX.read(data, { type: 'array' }); 
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as { [key: string]: string | number }[]; 
        processarDadosCarregados(json); 
      } catch { 
        toast.error("Erro ao ler o arquivo XLSX."); 
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
  const handleProcessPastedData = () => {
    if (!pastedData) return; 
    const linhas = pastedData.trim().split('\n'); 
    const cabecalho = linhas[0].split('\t'); 
    const dadosJson = linhas.slice(1).map(linha => { 
      const valores = linha.split('\t'); 
      const obj: { [key: string]: string } = {}; 
      cabecalho.forEach((key, index) => { 
        obj[key.trim()] = valores[index]; 
      }); 
      return obj; 
    }); 
    processarDadosCarregados(dadosJson);
  };

  const handleSave = async () => {
    const dadosParaSalvar = dados.map((linha) => {
      const dadosLimpos: { [key: string]: string | number } = {};
      Object.entries(linha).forEach(([key, value]) => {
        if (key !== 'Data' && (typeof value === 'string' || typeof value === 'number')) {
          dadosLimpos[key] = value;
        }
      });
      return dadosLimpos;
    }); 
    
    const result = await saveRelatorioData(dadosParaSalvar); 
    if (result.success) toast.success("Dados salvos no banco de dados!"); 
    else toast.error("Falha ao salvar os dados.", { description: result.error });
  };

  const handleExportReport = () => {
    exportToHTML(dadosFiltrados, analytics, filtroDataInicio, filtroDataFim);
  };

  const handleRowChange = (index: number, field: string, value: string) => {
    const novosDados = dados.map((linha, idx) => { 
      if (idx !== index) return linha; 
      const updatedLine: DadosLinha = { ...linha };
      if (field === 'Mês/Ano') {
        updatedLine[field] = value;
      } else {
        updatedLine[field] = Number(value) || 0;
      }
      return updatedLine;
    }); 
    setDados(novosDados);
  };

  const handleAddRow = () => {
    const novaLinha: DadosLinha = {
      'Mês/Ano': 'novo/ano',
      Data: new Date()
    };
    
    COLUNAS_ESPERADAS.forEach(col => { 
      if (col !== 'Mês/Ano') {
        novaLinha[col] = 0;
      }
    }); 
    
    setDados([...dados, novaLinha]);
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
    const currentMonth = Number(ultimoMes['Produtividade']) || 0;
    
    const totalProdutividade = dadosFiltrados.reduce((sum, d) => sum + (Number(d['Produtividade']) || 0), 0);
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
      entradas: dadosFiltrados.reduce((sum, d) => sum + (Number(d['Entrada - Total']) || 0), 0),
      baixados: dadosFiltrados.reduce((sum, d) => sum + (Number(d['Baixados']) || 0), 0)
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
      { 
        name: 'Em Andamento', 
        value: Number(ultimoPeriodo['Acervo em andamento']) || 0, 
        fill: '#8884d8' 
      },
      { 
        name: 'Conclusos', 
        value: Number(ultimoPeriodo['Conclusos']) || 0, 
        fill: '#82ca9d' 
      },
      {
        name: 'Conclusos -100 dias',
        value: Number(ultimoPeriodo['Conclusos - 100 dias']) || 0,
        fill: '#ffc658'
      },
      {
        name: 'Conclusos +365 dias',
        value: Number(ultimoPeriodo['Conclusos + 365']) || 0,
        fill: '#ff8042'
      }
    ].filter(item => item.value > 0);
  }, [dadosFiltrados]);

  // Dados para heatmap
  const heatmapData = useMemo((): HeatmapData[] => {
    if (dadosFiltrados.length === 0) return [];
    
    const metricas = ['Acervo total', 'Acervo em andamento', 'Conclusos', 'Conclusos - 100 dias', 'Conclusos + 365', 'Entradas - Casos novos', 'Entradas - Outras', 'Entrada - Total', 'Enviados Conclusos', 'Produtividade', 'Baixados'];
    const data: HeatmapData[] = [];
    
    const maxValues: { [key: string]: number } = {};
    metricas.forEach(metrica => {
      maxValues[metrica] = Math.max(...dadosFiltrados.map(d => Number(d[metrica]) || 0));
    });
    
    dadosFiltrados.forEach(periodo => {
      metricas.forEach(metrica => {
        const value = Number(periodo[metrica]) || 0;
        data.push({
          month: periodo['Mês/Ano'],
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
    
    const kpiMetrics = ['Conclusos', 'Entrada - Total', 'Enviados Conclusos', 'Produtividade', 'Acervo total', 'Baixados'];
    const kpiAverages: KpiData[] = kpiMetrics.map(metrica => {
        const total = dadosFiltrados.reduce((sum, d) => sum + (Number(d[metrica]) || 0), 0);
        return {
          name: metrica,
          value: (total / dadosFiltrados.length).toFixed(1)
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
  <div className="flex flex-col lg:flex-row gap-6">
    <aside className="w-full lg:w-80 bg-white p-6 border rounded-lg h-fit sticky top-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Controles</h2>
          <div className="flex gap-2">
            <Button onClick={handleSave} size="sm">Salvar</Button>
            <Button onClick={handleExportReport} variant="outline" size="sm">
              <Download size={16} className="mr-1"/>
              PDF
            </Button>
          </div>
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
    
    <main className="flex-1 space-y-6">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger>Gerenciamento e Entrada de Dados</AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardHeader>
                <CardTitle>Entrada de Dados do Relatório Padrão</CardTitle>
                <CardDescription>Escolha um método para carregar ou editar os dados. Clique em 'Salvar' na sidebar para persistir.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="xlsx-upload" className="font-semibold">Opção 1: Carregar Arquivo XLSX</Label>
                  <Input id="xlsx-upload" type="file" accept=".xlsx, .xls" onChange={handleFileChangeXLSX} />
                </div>
                <div>
                  <Label htmlFor="paste-area" className="font-semibold">Opção 2: Colar Dados do Excel (com cabeçalho)</Label>
                  <Textarea 
                    id="paste-area" 
                    placeholder="Copie as células do Excel (incluindo a linha de cabeçalho) e cole aqui..." 
                    value={pastedData} 
                    onChange={(e) => setPastedData(e.target.value)} 
                    rows={5} 
                  />
                  <Button onClick={handleProcessPastedData} className="mt-2">Processar Dados Colados</Button>
                </div>
                <div>
                  <Label className="font-semibold">Opção 3: Edição Manual</Label>
                  <div className="border rounded-md overflow-auto max-h-[40vh]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-secondary z-10">
                        <TableRow>
                          {COLUNAS_ESPERADAS.map(col => 
                            <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dados.map((linha, rowIndex) => (
                          <TableRow key={rowIndex}>
                            {COLUNAS_ESPERADAS.map(col => (
                              <TableCell key={col} className="p-1">
                                <Input 
                                  className="w-28" 
                                  value={linha[col] === undefined ? '' : String(linha[col])} 
                                  onChange={(e) => handleRowChange(rowIndex, col, e.target.value)} 
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Button onClick={handleAddRow} className="mt-2">Adicionar Linha Manualmente</Button>
                </div>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      {analytics && productivityComparison ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {analytics.kpiAverages.map(kpi => (
              <KpiCard key={kpi.name} title={`Média de ${kpi.name}`} value={kpi.value} />
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp size={20}/> Comparativo de Produtividade
              </CardTitle>
              <CardDescription>
                Compara a produtividade do último mês ({dadosFiltrados[dadosFiltrados.length - 1]['Mês/Ano']}) com a média do período filtrado. 
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
                Distribuição baseada no último período disponível ({dadosFiltrados[dadosFiltrados.length - 1]['Mês/Ano']}). 
                Mostra como o acervo total está dividido entre processos em diferentes estágios de tramitação.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: PieLabelProps) => `${name || 'N/A'}: ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry) => (
                      <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
  
            </CardContent>
          </Card>

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
                  <XAxis dataKey="Mês/Ano" />
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
                  <XAxis dataKey="Mês/Ano" />
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
                  <XAxis dataKey="Mês/Ano" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="Entradas - Casos novos" 
                    stackId="1" 
                    stroke="#19D3F3" 
                    fill="#19D3F3" 
                    fillOpacity={0.7}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="Entradas - Outras" 
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
              <CardDescription>Produtividade (barras) vs Enviados Conclusos (linha) com tendência</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={dadosFiltrados}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="Mês/Ano" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="Produtividade" fill="#82ca9d" name="Produtividade" />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="Enviados Conclusos" 
                    stroke="#8884d8" 
                    strokeWidth={3}
                    name="Enviados Conclusos"
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
                    {['Acervo total', 'Acervo em andamento', 'Conclusos', 'Conclusos - 100 dias', 'Conclusos + 365', 'Entradas - Casos novos', 'Entradas - Outras', 'Entrada - Total', 'Enviados Conclusos', 'Produtividade', 'Baixados'].map(metrica => (
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