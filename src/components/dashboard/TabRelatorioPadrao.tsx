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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, ScatterChart, Scatter, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { loadRelatorioData, saveRelatorioData } from '@/app/actions';
import { Calendar, Palette, Filter, Trash2, TrendingUp, TrendingDown, Sigma, Dot } from 'lucide-react';
import { format, subMonths, subYears, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLUNAS_ESPERADAS = [
  'Mês/Ano', 'Acervo total', 'Acervo em andamento', 'Conclusos', 'Conclusos - 100 dias', 
  'Conclusos + 365', 'Entradas - Casos novos', 'Entradas - Outras', 'Entrada - Total', 
  'Enviados Conclusos', 'Produtividade', 'Baixados'
];
interface DadosLinha { 'Mês/Ano': string; Data: Date; [key: string]: any; }
interface Milestone { data: Date; desc: string; }
const KpiCard = ({ title, value, change, changeText }: { title: string, value: string, change?: number, changeText?: string }) => (
  <Card>
    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {change !== undefined && (
        <p className="text-xs text-muted-foreground flex items-center">
          <span className={`mr-1 flex items-center gap-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {change.toFixed(1)}%
          </span>
          {changeText}
        </p>
      )}
    </CardContent>
  </Card>
);

export function TabRelatorioPadrao() {
  const [dados, setDados] = useState<DadosLinha[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [colunasNumericas, setColunasNumericas] = useState<string[]>([]);
  const [metricasSelecionadas, setMetricasSelecionadas] = useState<string[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>('');
  const [filtroDataFim, setFiltroDataFim] = useState<string>('');
  const [scatterX, setScatterX] = useState<string>('');
  const [scatterY, setScatterY] = useState<string>('');
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

  const processarDadosCarregados = (dadosParaProcessar: any[]) => {
    if (!dadosParaProcessar || dadosParaProcessar.length === 0) {
      toast.warning("Nenhum dado válido encontrado para processar.");
      return;
    }
    const numericas = COLUNAS_ESPERADAS.filter(c => c !== 'Mês/Ano');
    setColunasNumericas(numericas);
    setMetricasSelecionadas(numericas.slice(0, 2));
    if (numericas.length >= 2) { setScatterX(numericas[0]); setScatterY(numericas[1]); }
    const mesesMap: { [key: string]: string } = { 'jan': '0', 'fev': '1', 'mar': '2', 'abr': '3', 'mai': '4', 'jun': '5', 'jul': '6', 'ago': '7', 'set': '8', 'out': '9', 'nov': '10', 'dez': '11' };
    const dadosFormatados = dadosParaProcessar.map(linha => {
      try {
        const mesAnoStr = String(linha['Mês/Ano']).toLowerCase().trim();
        const [mesStr, anoStrFull] = mesAnoStr.split('/');
        if (!mesesMap[mesStr]) return null;
        const anoStr = anoStrFull.length === 2 ? `20${anoStrFull}` : anoStrFull;
        const dataCompleta = new Date(parseInt(anoStr), parseInt(mesesMap[mesStr]), 1);
        if (isNaN(dataCompleta.getTime())) return null;
        const linhaProcessada: any = { 'Mês/Ano': linha['Mês/Ano'], Data: dataCompleta };
        numericas.forEach(col => {
          const valor = linha[col];
          linhaProcessada[col] = typeof valor === 'string' ? Number(valor.replace(/[^0-9.,-]+/g, "").replace(",", ".")) || 0 : Number(valor) || 0;
        });
        return linhaProcessada;
      } catch { return null; }
    }).filter(Boolean).sort((a,b) => a!.Data.getTime() - b!.Data.getTime());

    if (dadosFormatados.length > 0) {
      setDados(dadosFormatados as DadosLinha[]);
      toast.success(`${dadosFormatados.length} linhas de dados processadas com sucesso!`);
    } else {
      toast.error("Nenhuma linha pôde ser processada.", { description: "Verifique se a coluna 'Mês/Ano' está no formato correto (ex: jan/21)." });
    }
  };
  
  const handleFileChangeXLSX = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader();
    reader.onload = (e) => {
      try { const data = new Uint8Array(e.target?.result as ArrayBuffer); const workbook = XLSX.read(data, { type: 'array' }); const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[]; processarDadosCarregados(json); } catch (error) { toast.error("Erro ao ler o arquivo XLSX."); }
    };
    reader.readAsArrayBuffer(file);
  };
  
  const handleProcessPastedData = () => {
    if (!pastedData) return; const linhas = pastedData.trim().split('\n'); const cabecalho = linhas[0].split('\t'); const dadosJson = linhas.slice(1).map(linha => { const valores = linha.split('\t'); const obj: { [key: string]: any } = {}; cabecalho.forEach((key, index) => { obj[key.trim()] = valores[index]; }); return obj; }); processarDadosCarregados(dadosJson);
  };

  const handleSave = async () => {
    const dadosParaSalvar = dados.map(({ Data, ...resto }) => resto); const result = await saveRelatorioData(dadosParaSalvar); if (result.success) toast.success("Dados salvos no banco de dados!"); else toast.error("Falha ao salvar os dados.", { description: result.error });
  };

  const handleRowChange = (index: number, field: string, value: string) => {
    const novosDados = dados.map((linha, idx) => { if (idx !== index) return linha; return { ...linha, [field]: field === 'Mês/Ano' ? value : Number(value) || 0 }; }); setDados(novosDados);
  };

  const handleAddRow = () => {
    const novaLinha: { [key: string]: any } = {}; COLUNAS_ESPERADAS.forEach(col => { novaLinha[col] = col === 'Mês/Ano' ? 'novo/ano' : 0; }); novaLinha['Data'] = new Date(); setDados([...dados, novaLinha]);
  };

  const dadosFiltrados = useMemo(() => {
    if (!dados) return []; const inicio = filtroDataInicio ? new Date(filtroDataInicio + "T00:00:00") : null; const fim = filtroDataFim ? new Date(filtroDataFim + "T00:00:00") : null; return dados.filter(d => { if (inicio && d.Data < inicio) return false; if (fim && d.Data > fim) return false; return true; });
  }, [dados, filtroDataInicio, filtroDataFim]);

  const analytics = useMemo(() => {
    if (dadosFiltrados.length === 0) return null; const last = dadosFiltrados[dadosFiltrados.length - 1]; const first = dadosFiltrados[0]; const previous = dadosFiltrados.length > 1 ? dadosFiltrados[dadosFiltrados.length - 2] : null; const totalBaixados = dadosFiltrados.reduce((sum, d) => sum + (d['Baixados'] || 0), 0); const produtividadeMedia = dadosFiltrados.reduce((sum, d) => sum + (d['Produtividade'] || 0), 0) / dadosFiltrados.length; const variacaoAcervo = (last['Acervo total'] || 0) - (first['Acervo total'] || 0); const produtividadeChange = previous ? (((last['Produtividade'] || 0) - (previous['Produtividade'] || 0)) / (previous['Produtividade'] || 1)) * 100 : 0; const mesMaiorProdutividade = dadosFiltrados.reduce((max, d) => ((d['Produtividade'] || 0) > (max['Produtividade'] || 0) ? d : max), first); const statsTable = colunasNumericas.map(metrica => { const values = dadosFiltrados.map(d => d[metrica]).filter(v => typeof v === 'number'); if (values.length === 0) return { metrica, media: 0, mediana: 0, max: 0, min: 0 }; values.sort((a, b) => a - b); const sum = values.reduce((a, b) => a + b, 0); const mid = Math.floor(values.length / 2); const median = values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid]; return { metrica, media: sum / values.length, mediana: median, max: Math.max(...values), min: Math.min(...values) }; }); const acervoInicial = first['Acervo total'] || 0; return { totalBaixados, produtividadeMedia, variacaoAcervo, produtividadeChange, mesMaiorProdutividade, statsTable, acervoInicial };
  }, [dadosFiltrados, colunasNumericas]);

  const handleAddMilestone = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const formData = new FormData(e.currentTarget); const desc = formData.get('desc') as string; const dataStr = formData.get('data') as string; if (desc && dataStr) { const data = new Date(dataStr + "T00:00:00"); setMilestones([...milestones, { data, desc }]); e.currentTarget.reset(); }
  };
  const handleDeleteMilestone = (index: number) => setMilestones(milestones.filter((_, i) => i !== index));

  const handleSetPeriod = (period: string) => {
    const today = new Date(); let start: Date; let end: Date = today;
    switch (period) { case 'last_month': start = startOfMonth(subMonths(today, 1)); end = endOfMonth(subMonths(today, 1)); break; case 'last_quarter': start = startOfMonth(subMonths(today, 3)); break; case 'last_semester': start = startOfMonth(subMonths(today, 6)); break; case 'last_year': start = subYears(today, 1); break; case 'last_3_years': start = subYears(today, 3); break; case 'all': if (dados.length === 0) return; start = dados[0].Data; end = dados[dados.length - 1].Data; break; default: start = today; }
    setFiltroDataInicio(format(start, 'yyyy-MM-dd')); setFiltroDataFim(format(end, 'yyyy-MM-dd'));
  };
  
  if (isLoading) return <div>Carregando dados...</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="w-full lg:w-80 bg-white p-6 border rounded-lg h-fit sticky top-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Controles</h2><Button onClick={handleSave}>Salvar Dados</Button></div>
          <div><h3 className="font-semibold flex items-center gap-2 mb-3"><Calendar size={16}/> Filtrar Período</h3><div className="space-y-2"><Label htmlFor="data-inicio">De:</Label><Input id="data-inicio" type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} /><Label htmlFor="data-fim">Até:</Label><Input id="data-fim" type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} /></div>
            {/* ===== ÁREA CORRIGIDA COM CSS GRID ===== */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={() => handleSetPeriod('last_month')}>Mês Passado</Button>
              <Button size="sm" variant="outline" onClick={() => handleSetPeriod('last_quarter')}>Últ. 3 meses</Button>
              <Button size="sm" variant="outline" onClick={() => handleSetPeriod('last_semester')}>Últ. 6 meses</Button>
              <Button size="sm" variant="outline" onClick={() => handleSetPeriod('last_year')}>Últ. Ano</Button>
              <Button size="sm" variant="outline" onClick={() => handleSetPeriod('last_3_years')}>Últ. 3 Anos</Button>
              <Button size="sm" variant="outline" onClick={() => handleSetPeriod('all')}>Todo Período</Button>
            </div>
          </div>
          <div><h3 className="font-semibold flex items-center gap-2 mb-3"><Filter size={16}/> Comparar Métricas (Gráficos)</h3><div className="space-y-2 max-h-40 overflow-y-auto pr-2">{colunasNumericas.map(col => (<div key={col} className="flex items-center gap-2"><Checkbox id={`check-${col}`} checked={metricasSelecionadas.includes(col)} onCheckedChange={(checked) => {setMetricasSelecionadas(checked ? [...metricasSelecionadas, col] : metricasSelecionadas.filter(m => m !== col));}}/><Label htmlFor={`check-${col}`}>{col}</Label></div>))}</div></div>
          <div><h3 className="font-semibold flex items-center gap-2 mb-3"><Palette size={16}/> Cores</h3>{metricasSelecionadas.map(metrica => (<div key={metrica} className="flex items-center justify-between mt-1"><Label htmlFor={`color-${metrica}`}>{metrica}</Label><Input id={`color-${metrica}`} type="color" className="w-12 h-8 p-1" value={cores[metrica] || '#000000'} onChange={e => setCores({ ...cores, [metrica]: e.target.value })}/></div>))}</div>
          <div><h3 className="font-semibold flex items-center gap-2 mb-3"><Dot className="animate-pulse text-blue-500" /> Correlação</h3><div className="space-y-2"><Label>Eixo X</Label><Select value={scatterX} onValueChange={setScatterX}><SelectTrigger><SelectValue placeholder="Selecione métrica X" /></SelectTrigger><SelectContent>{colunasNumericas.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><Label>Eixo Y</Label><Select value={scatterY} onValueChange={setScatterY}><SelectTrigger><SelectValue placeholder="Selecione métrica Y" /></SelectTrigger><SelectContent>{colunasNumericas.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div></div>
          <div><h3 className="font-semibold mb-3">📍 Marcos Temporais</h3><form onSubmit={handleAddMilestone} className="space-y-2"><Input name="desc" placeholder="Descrição do evento" required/><Input name="data" type="date" required/><Button type="submit" className="w-full">Adicionar Marco</Button></form><div className="mt-2 space-y-1 text-sm">{milestones.map((m, i) => (<div key={i} className="flex justify-between items-center"><span>{m.desc} ({format(m.data, 'dd/MM/yy')})</span><Button variant="ghost" size="icon" onClick={() => handleDeleteMilestone(i)}><Trash2 className="h-4 w-4"/></Button></div>))}</div></div>
        </div>
      </aside>
      <main className="flex-1 space-y-6">
        {/* ===== ACCORDION COLAPSADO POR PADRÃO ===== */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>Gerenciamento e Entrada de Dados</AccordionTrigger>
            <AccordionContent>
              <Card>
                <CardHeader><CardTitle>Entrada de Dados do Relatório Padrão</CardTitle><CardDescription>Escolha um método para carregar ou editar os dados. Clique em "Salvar Dados" na sidebar para persistir.</CardDescription></CardHeader>
                <CardContent className="space-y-6">
                  <div><Label htmlFor="xlsx-upload" className="font-semibold">Opção 1: Carregar Arquivo XLSX</Label><Input id="xlsx-upload" type="file" accept=".xlsx, .xls" onChange={handleFileChangeXLSX} /></div>
                  <div><Label htmlFor="paste-area" className="font-semibold">Opção 2: Colar Dados do Excel (com cabeçalho)</Label><Textarea id="paste-area" placeholder="Copie as células do Excel (incluindo a linha de cabeçalho) e cole aqui..." value={pastedData} onChange={(e) => setPastedData(e.target.value)} rows={5} /><Button onClick={handleProcessPastedData} className="mt-2">Processar Dados Colados</Button></div>
                  <div><Label className="font-semibold">Opção 3: Edição Manual</Label><div className="border rounded-md overflow-auto max-h-[40vh]"><Table><TableHeader className="sticky top-0 bg-secondary z-10"><TableRow>{COLUNAS_ESPERADAS.map(col => <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>)}</TableRow></TableHeader><TableBody>{dados.map((linha, rowIndex) => (<TableRow key={rowIndex}>{COLUNAS_ESPERADAS.map(col => (<TableCell key={col} className="p-1"><Input className="w-28" value={linha[col] === undefined ? '' : linha[col]} onChange={(e) => handleRowChange(rowIndex, col, e.target.value)} /></TableCell>))}</TableRow>))}</TableBody></Table></div><Button onClick={handleAddRow} className="mt-2">Adicionar Linha Manualmente</Button></div>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        
        {analytics ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KpiCard title="Total de Baixados" value={(analytics.totalBaixados || 0).toLocaleString('pt-BR')} />
              <KpiCard title="Produtividade Média" value={(analytics.produtividadeMedia || 0).toFixed(1)} change={analytics.produtividadeChange} changeText="vs mês anterior" />
              <KpiCard title="Variação do Acervo" value={(analytics.variacaoAcervo || 0).toString()} change={(analytics.variacaoAcervo / (analytics.acervoInicial || 1)) * 100} changeText="no período"/>
              <KpiCard title="Pico de Produtividade" value={`${analytics.mesMaiorProdutividade?.Produtividade || 0} (${analytics.mesMaiorProdutividade?.['Mês/Ano'] || ''})`} />
            </div>
            <Card><CardHeader><CardTitle>Comparativo em Linhas</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={400}><LineChart data={dadosFiltrados} margin={{ top: 20 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="Mês/Ano" /><YAxis /><Tooltip /><Legend />{metricasSelecionadas.map(metrica => <Line key={metrica} type="monotone" dataKey={metrica} stroke={cores[metrica] || '#000000'} strokeWidth={2} />)}{milestones.map((m, i) => <ReferenceLine key={i} x={format(m.data, 'MMM/yy').toLowerCase()} stroke="red" label={{ value: m.desc, position: 'top', fill: 'red' }} />)}</LineChart></ResponsiveContainer></CardContent></Card>
            <div className="grid md:grid-cols-2 gap-6">
              <Card><CardHeader><CardTitle>Comparativo em Barras</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={dadosFiltrados}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="Mês/Ano" /><YAxis /><Tooltip /><Legend />{metricasSelecionadas.map(metrica => <Bar key={metrica} dataKey={metrica} fill={cores[metrica] || '#000000'} />)}</BarChart></ResponsiveContainer></CardContent></Card>
              <Card><CardHeader><CardTitle>Análise de Correlação</CardTitle><CardDescription>{`Relação entre ${scatterX} e ${scatterY}`}</CardDescription></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><ScatterChart><CartesianGrid /><XAxis type="number" dataKey={scatterX} name={scatterX} /><YAxis type="number" dataKey={scatterY} name={scatterY} /><Tooltip cursor={{ strokeDasharray: '3 3' }} /><Scatter name="Pontos" data={dadosFiltrados} fill="#8884d8" /></ScatterChart></ResponsiveContainer></CardContent></Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Sigma size={20}/> Resumo Estatístico</CardTitle><CardDescription>Cálculos baseados no período filtrado para TODAS as métricas do arquivo.</CardDescription></CardHeader>
              <CardContent><Table><TableHeader><TableRow><TableHead>Métrica</TableHead><TableHead>Média</TableHead><TableHead>Mediana</TableHead><TableHead>Mínimo</TableHead><TableHead>Máximo</TableHead></TableRow></TableHeader><TableBody>{analytics.statsTable.map(s => (<TableRow key={s.metrica}><TableCell className="font-medium">{s.metrica}</TableCell><TableCell>{s.media.toFixed(2)}</TableCell><TableCell>{s.mediana.toFixed(2)}</TableCell><TableCell>{s.min}</TableCell><TableCell>{s.max}</TableCell></TableRow>))}</TableBody></Table></CardContent>
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