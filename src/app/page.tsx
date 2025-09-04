// src/app/page.tsx
'use client';

import React, { useState, useMemo } from 'react';
// Importando mais componentes do Recharts
import { 
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input"; // Para campos de texto
import { Label } from "@/components/ui/label"; // Para rótulos
import Papa from 'papaparse';
import { Download, Palette, Calendar, Filter } from 'lucide-react'; // Ícones!

// --- TIPOS DE DADOS (BOA PRÁTICA COM TYPESCRIPT) ---
interface DadosLinha {
  Data: Date;
  'Mês/Ano': string;
  [key: string]: any; // Permite outras colunas com qualquer nome
}

interface Milestone {
  data: Date;
  desc: string;
}

// --- COMPONENTE PRINCIPAL ---
export default function DashboardPage() {
  // --- ESTADOS (O "CÉREBRO" DA NOSSA APLICAÇÃO) ---
  const [dados, setDados] = useState<DadosLinha[] | null>(null);
  const [colunasNumericas, setColunasNumericas] = useState<string[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>('');
  const [filtroDataFim, setFiltroDataFim] = useState<string>('');
  
  // Estado para controlar as cores dos gráficos
  const [cores, setCores] = useState<{ [key: string]: string }>({
    'Acervo total': '#8884d8',
    'Produtividade': '#82ca9d',
    'Baixados': '#ffc658',
    'Conclusos': '#ff8042',
    'Entrada - Total': '#0088FE',
  });

  // Estado para controlar quais métricas o usuário selecionou para comparar
  const [metricasSelecionadas, setMetricasSelecionadas] = useState<string[]>(['Acervo total', 'Produtividade']);

  // --- LÓGICA DE PROCESSAMENTO E FILTRO ---

  // Função para processar o arquivo CSV
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const dadosBrutos = results.data as any[];
        
        // Descobrir quais colunas são numéricas automaticamente
        const colunasExcluidas = ['Mês/Ano', 'Data'];
        const primeirasColunas = Object.keys(dadosBrutos[0] || {});
        const numericas = primeirasColunas.filter(col => 
          !colunasExcluidas.includes(col) && !isNaN(parseFloat(dadosBrutos[0][col]))
        );
        setColunasNumericas(numericas);

        const mesesMap: { [key: string]: string } = { 'jan': '0', 'fev': '1', 'mar': '2', 'abr': '3', 'mai': '4', 'jun': '5', 'jul': '6', 'ago': '7', 'set': '8', 'out': '9', 'nov': '10', 'dez': '11' };
        const dadosProcessados = dadosBrutos.map((linha: any) => {
          try {
            const [mesStr, anoStr] = linha['Mês/Ano'].split('/');
            const dataCompleta = new Date(`20${anoStr}`, parseInt(mesesMap[mesStr.toLowerCase()]), 1);
            
            const linhaProcessada: any = { 'Mês/Ano': linha['Mês/Ano'], Data: dataCompleta };
            numericas.forEach(col => {
              linhaProcessada[col] = Number(linha[col]) || 0;
            });
            return linhaProcessada;
          } catch {
            return null; // Ignora linhas com formato de data inválido
          }
        }).filter(Boolean).sort((a, b) => a.Data.getTime() - b.Data.getTime());

        setDados(dadosProcessados as DadosLinha[]);
      },
    });
  };

  // Memoização: O cálculo do filtro só é refeito se os dados ou as datas do filtro mudarem.
  // Isso otimiza a performance!
  const dadosFiltrados = useMemo(() => {
    if (!dados) return [];
    
    const inicio = filtroDataInicio ? new Date(filtroDataInicio) : null;
    const fim = filtroDataFim ? new Date(filtroDataFim) : null;
    
    return dados.filter(d => {
      const dataItem = d.Data;
      if (inicio && dataItem < inicio) return false;
      if (fim && dataItem > fim) return false;
      return true;
    });
  }, [dados, filtroDataInicio, filtroDataFim]);

  // Função para adicionar um marco temporal (simples, sem formulário por enquanto)
  const adicionarMarco = () => {
    const desc = prompt("Descrição do marco:");
    const dataStr = prompt("Data do marco (AAAA-MM-DD):");
    if (desc && dataStr) {
      const data = new Date(dataStr + 'T00:00:00'); // Adiciona T00:00:00 para evitar problemas de fuso horário
      setMilestones([...milestones, { data, desc }]);
    }
  };

  // Função para gerar o "PDF" (na verdade, a impressão da página)
  const handlePrint = () => {
    window.print();
  };

  // --- RENDERIZAÇÃO (O QUE APARECE NA TELA) ---
  
  // Se não houver dados carregados, mostre a tela de upload
  if (!dados) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gray-100">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Carregar Dados</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <p>Selecione um arquivo CSV para gerar o dashboard.</p>
            <input type="file" id="file-upload" accept=".csv" onChange={handleFileChange} className="hidden"/>
            <label htmlFor="file-upload">
              <Button asChild>
                <span>📂 Escolher Arquivo</span>
              </Button>
            </label>
            <p className="text-xs text-gray-500">O arquivo deve ter uma coluna "Mês/Ano" (ex: jan/23).</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Se os dados estiverem carregados, mostre o dashboard completo
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Esconde a sidebar na hora de imprimir */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          main {
            padding: 0 !important;
          }
        }
      `}</style>

      <div className="flex">
        {/* --- BARRA LATERAL DE CONTROLES (SIDEBAR) --- */}
        <aside className="w-80 bg-white p-6 border-r no-print">
          <h2 className="text-xl font-semibold mb-6">Controles</h2>
          
          {/* Filtro de Período */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><Calendar size={16}/> Filtrar Período</h3>
            <div>
              <Label htmlFor="data-inicio">De:</Label>
              <Input id="data-inicio" type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="data-fim">Até:</Label>
              <Input id="data-fim" type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} />
            </div>
          </div>
          
          <hr className="my-6" />

          {/* Seletor de Métricas */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><Filter size={16}/> Comparar Métricas</h3>
            <div className="space-y-2">
              {colunasNumericas.map(col => (
                <div key={col} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`check-${col}`}
                    checked={metricasSelecionadas.includes(col)}
                    onChange={() => {
                      if (metricasSelecionadas.includes(col)) {
                        setMetricasSelecionadas(metricasSelecionadas.filter(m => m !== col));
                      } else {
                        setMetricasSelecionadas([...metricasSelecionadas, col]);
                      }
                    }}
                  />
                  <Label htmlFor={`check-${col}`}>{col}</Label>
                </div>
              ))}
            </div>
          </div>

          <hr className="my-6" />

          {/* Controle de Cores */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><Palette size={16}/> Cores das Métricas</h3>
            {metricasSelecionadas.map(metrica => (
              <div key={metrica} className="flex items-center justify-between">
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

          <hr className="my-6" />
          
          {/* Botões de Ação */}
          <div className="space-y-4">
            <Button onClick={adicionarMarco} className="w-full">📍 Adicionar Marco</Button>
            <Button onClick={handlePrint} className="w-full flex items-center gap-2">
              <Download size={16}/> Exportar para PDF
            </Button>
             <Button variant="outline" onClick={() => setDados(null)} className="w-full">
              Carregar Outro Arquivo
            </Button>
          </div>
        </aside>

        {/* --- CONTEÚDO PRINCIPAL (DASHBOARD) --- */}
        <main className="flex-1 p-8">
          <h1 className="text-3xl font-bold mb-8">Relatório Jurimétrico Profissional</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Gráfico de Linhas Comparativo */}
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader><CardTitle>Comparativo de Métricas (Linhas)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={dadosFiltrados}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="Mês/Ano" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {metricasSelecionadas.map(metrica => (
                      <Line key={metrica} type="monotone" dataKey={metrica} stroke={cores[metrica] || '#000000'} strokeWidth={2} />
                    ))}
                    {/* Renderiza os marcos temporais */}
                    {milestones.map((m, i) => (
                      <ReferenceLine key={i} x={m.data.toLocaleString('default', { month: 'short' }) + '/' + m.data.getFullYear().toString().substr(-2)} stroke="red" label={m.desc} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico de Barras Comparativo */}
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader><CardTitle>Comparativo de Métricas (Barras)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={dadosFiltrados}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="Mês/Ano" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {metricasSelecionadas.map(metrica => (
                      <Bar key={metrica} dataKey={metrica} fill={cores[metrica] || '#000000'} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico de Área (primeira métrica selecionada) */}
            <Card>
              <CardHeader><CardTitle>Análise de Área: {metricasSelecionadas[0]}</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dadosFiltrados}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="Mês/Ano" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey={metricasSelecionadas[0]} stroke={cores[metricasSelecionadas[0]]} fill={cores[metricasSelecionadas[0]]} fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico de Pizza (distribuição total) */}
            <Card>
              <CardHeader><CardTitle>Distribuição Total no Período</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={colunasNumericas.map(col => ({
                        name: col,
                        value: dadosFiltrados.reduce((sum, row) => sum + (row[col] || 0), 0)
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {colunasNumericas.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={cores[entry] || '#000000'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}