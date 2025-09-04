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
import { Calendar, Palette, Filter, Trash2, Sigma, TrendingUp, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';
import { format, subMonths, subYears, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLUNAS_ESPERADAS = [
  'Mês/Ano', 'Acervo total', 'Acervo em andamento', 'Conclusos', 'Conclusos - 100 dias', 
  'Conclusos + 365', 'Entradas - Casos novos', 'Entradas - Outras', 'Entrada - Total', 
  'Enviados Conclusos', 'Produtividade', 'Baixados'
];

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#AB63FA', '#FFA500', '#EF553B', '#19D3F3', '#FF6692', '#4CAF50', '#FF9800'];

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

interface FunnelData {
  name: string;
  value: number;
  fill: string;
}

interface HeatmapData {
  month: string;
  metric: string;
  value: number;
  normalizedValue: number;
}

const KpiCard = ({ title, value }: { title: string, value: string }) => (
  <Card>
    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

// Componente para Gráfico de Gauge
const GaugeChart = ({ value, max, title }: { value: number, max: number, title: string }) => {
  const percentage = Math.min((value / max) * 100, 100);
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
  
  const getColor = (perc: number) => {
    if (perc >= 80) return '#4CAF50'; // Verde
    if (perc >= 60) return '#FFC107'; // Amarelo
    if (perc >= 40) return '#FF9800'; // Laranja
    return '#F44336'; // Vermelho
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
            stroke={getColor(percentage)}
            strokeWidth="20"
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold">{value.toFixed(1)}</span>
          <span className="text-sm text-gray-500">{percentage.toFixed(1)}%</span>
        </div>
      </div>
      <span className="mt-2 text-sm font-medium text-center">{title}</span>
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

export function TabRelatorioPadrao() {
  const [dados, setDados] = useState<DadosLinha[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [colunasNumericas, setColunasNumericas] = useState<string[]>([]);
  const [metricasSelecionadas, setMetricasSelecionadas] = useState<string[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
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
    setMetricasSelecionadas(numericas.slice(0, 2));
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

  // Dados para gráfico de funil
  const funnelData = useMemo((): FunnelData[] => {
    if (dadosFiltrados.length === 0) return [];
    
    const totals = {
      'Entrada Total': dadosFiltrados.reduce((sum, d) => sum + (Number(d['Entrada - Total']) || 0), 0),
      'Acervo Total': dadosFiltrados.reduce((sum, d) => sum + (Number(d['Acervo total']) || 0), 0) / dadosFiltrados.length,
      'Conclusos': dadosFiltrados.reduce((sum, d) => sum + (Number(d['Conclusos']) || 0), 0),
      'Baixados': dadosFiltrados.reduce((sum, d) => sum + (Number(d['Baixados']) || 0), 0)
    };

    return [
      { name: 'Entrada Total', value: totals['Entrada Total'], fill: '#0088FE' },
      { name: 'Acervo Total', value: totals['Acervo Total'], fill: '#00C49F' },
      { name: 'Conclusos', value: totals['Conclusos'], fill: '#FFBB28' },
      { name: 'Baixados', value: totals['Baixados'], fill: '#FF8042' }
    ];
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
    
    const metricas = ['Produtividade', 'Conclusos', 'Entrada - Total', 'Baixados'];
    const data: HeatmapData[] = [];
    
    // Calcular valores máximos para normalização
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

  // Dados para scatter plot
  const scatterData = useMemo(() => {
    return dadosFiltrados.map(d => ({
      x: Number(d['Entrada - Total']) || 0,
      y: Number(d['Produtividade']) || 0,
      z: Number(d['Conclusos']) || 0,
      name: d['Mês/Ano']
    }));
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
            <Button onClick={handleSave}>Salvar Dados</Button>
          </div>
          
          <div>
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <Calendar size={16}/> Filtrar Período
            </h3>
            <div className="space-y-2">
              <Label htmlFor="data-inicio">De:</Label>
              <Input id="data-inicio" type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} />
              <Label htmlFor="data-fim">Até:</Label>
              <Input id="data-fim" type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={() => handleSetPeriod('last_month')}>Mês Passado</Button>
              <Button size="sm" variant="outline" onClick={() => handleSetPeriod('last_quarter')}>Últ. 3 meses</Button>
              <Button size="sm" variant="outline" onClick={() => handleSetPeriod('last_semester')}>Últ. 6 meses</Button>
              <Button size="sm" variant="outline" onClick={() => handleSetPeriod('last_year')}>Últ. Ano</Button>
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
            <h3 className="font-semibold mb-3">📍 Marcos Temporais</h3>
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
                  <CardDescription>Escolha um método para carregar ou editar os dados. Clique em &apos;Salvar Dados&apos; na sidebar para persistir.</CardDescription>
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
        
        {analytics ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {analytics.kpiAverages.map(kpi => (
                <KpiCard key={kpi.name} title={`Média de ${kpi.name}`} value={kpi.value} />
              ))}
            </div>

            {/* Gráfico de Gauge para Produtividade */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp size={20}/> Indicador de Produtividade
                </CardTitle>
                <CardDescription>Meta baseada na média histórica dos dados</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                {analytics.kpiAverages.find(k => k.name === 'Produtividade') && (
                  <GaugeChart 
                    value={Number(analytics.kpiAverages.find(k => k.name === 'Produtividade')?.value || 0)}
                    max={Math.max(...dadosFiltrados.map(d => Number(d['Produtividade']) || 0)) * 1.2}
                    title="Produtividade Média"
                  />
                )}
              </CardContent>
            </Card>

            {/* Gráficos de Pizza e Funil lado a lado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico de Pizza - Composição do Acervo */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon size={20}/> Composição do Acervo Atual
                  </CardTitle>
                  <CardDescription>Distribuição baseada no último período disponível</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Gráfico de Funil */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 size={20}/> Funil de Processos
                  </CardTitle>
                  <CardDescription>Fluxo dos processos no período filtrado</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {funnelData.map((item, index) => (
                      <div key={item.name} className="relative">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium">{item.name}</span>
                          <span className="text-sm text-gray-600">{item.value.toFixed(0)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-8 relative overflow-hidden">
                          <div
                            className="h-8 rounded-full flex items-center justify-center text-white text-xs font-medium transition-all duration-1000"
                            style={{
                              backgroundColor: item.fill,
                              width: `${Math.max(10, (item.value / Math.max(...funnelData.map(d => d.value))) * 100)}%`
                            }}
                          >
                            {item.value.toFixed(0)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Heatmap */}
            <Card>
              <CardHeader>
                <CardTitle>🔥 Mapa de Calor - Intensidade das Métricas</CardTitle>
                <CardDescription>Visualização da intensidade de diferentes métricas ao longo do tempo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full">
                    <div className="grid grid-cols-1 gap-4">
                      {['Produtividade', 'Conclusos', 'Entrada - Total', 'Baixados'].map(metrica => (
                        <div key={metrica} className="space-y-2">
                          <h4 className="font-medium text-sm">{metrica}</h4>
                          <div className="flex gap-1 flex-wrap">
                            {heatmapData
                              .filter(d => d.metric === metrica)
                              .map((data, index) => (
                                <HeatmapCell key={index} data={data} maxValue={Math.max(...heatmapData.filter(d => d.metric === metrica).map(d => d.value))} />
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
                    {milestones.map((m, i) => 
                      <ReferenceLine 
                        key={i} 
                        x={format(m.data, 'MMM/yy', { locale: ptBR }).toLowerCase()} 
                        stroke="red" 
                        label={{ value: m.desc, position: 'top', fill: 'red' }} 
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico de Área Empilhada */}
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

            {/* Gráfico de Dispersão */}
            <Card>
              <CardHeader>
                <CardTitle>Correlação: Entradas vs Produtividade</CardTitle>
                <CardDescription>Análise da relação entre volume de entradas e produtividade</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart data={scatterData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" name="Entradas" />
                    <YAxis dataKey="y" name="Produtividade" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} 
                      formatter={(value, name) => [value, name === 'x' ? 'Entradas' : name === 'y' ? 'Produtividade' : 'Conclusos']}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.name || ''}
                    />
                    <Scatter dataKey="y" fill="#8884d8" />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico Composto com Tendência */}
            <Card>
              <CardHeader>
                <CardTitle>Análise com Linha de Tendência</CardTitle>
                <CardDescription>Produtividade (barras) vs Acervo Total (linha) com tendência</CardDescription>
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
                      dataKey="Acervo total" 
                      stroke="#8884d8" 
                      strokeWidth={3}
                      name="Acervo Total"
                    />
                  </ComposedChart>
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