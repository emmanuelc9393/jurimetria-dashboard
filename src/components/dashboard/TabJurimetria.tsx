// src/components/dashboard/TabJurimetria.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from 'sonner';
import { loadJurimetriaData } from '@/app/actions';

// ─── Badge ────────────────────────────────────────────────────────────────────
const Badge = ({ children, variant = "default", className = "" }: {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
}) => {
  const variants = {
    default: "bg-blue-100 text-blue-800 border-blue-200",
    secondary: "bg-gray-100 text-gray-800 border-gray-200",
    destructive: "bg-red-100 text-red-800 border-red-200",
    outline: "bg-transparent text-gray-600 border-gray-300"
  };
  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

// ─── InfoTooltip ──────────────────────────────────────────────────────────────
const InfoTooltip = ({ children, description }: { children: React.ReactNode; description: string }) => (
  <div className="group relative">
    {children}
    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 w-64 text-center">
      {description}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
    </div>
  </div>
);

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Processo {
  Processo: string;
  Eventos: number;
  Procedimento: string;
  Classe: string;
  Assunto: string;
  'Tipo de Conclusão': string;
  'Dias Conclusos': number;
  Assessor: string;
  'Fase Processual': string;
  [key: string]: string | number | undefined;
}


// ─── KpiCard ──────────────────────────────────────────────────────────────────
const KpiCard = ({ title, value, subtitle, icon, description }: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  description?: string;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <InfoTooltip description={description || ""}>
        <CardTitle className="text-sm font-medium cursor-help border-b border-dotted border-gray-400">
          {title}
        </CardTitle>
      </InfoTooltip>
      <span className="text-gray-500">{icon}</span>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </CardContent>
  </Card>
);

// ─── Componente Principal ─────────────────────────────────────────────────────
export function TabJurimetria({ refreshKey = 0 }: { refreshKey?: number }) {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const dadosSalvos = await loadJurimetriaData();
      if (dadosSalvos && dadosSalvos.length > 0) {
        const dados = dadosSalvos.map((p) => ({
          ...p,
          // Garantir que Processo seja sempre string (evitar perda de dígitos)
          Processo: String(p.Processo || ''),
          Eventos: Number(p.Eventos) || 0,
          'Dias Conclusos': Number(p['Dias Conclusos']) || 0,
          Assessor: String(p.Assessor || 'Não identificado'),
          'Fase Processual': String(p['Fase Processual'] || ''),
          Procedimento: String(p.Procedimento || ''),
          Classe: String(p.Classe || ''),
          Assunto: String(p.Assunto || ''),
          'Tipo de Conclusão': String(p['Tipo de Conclusão'] || 'Não especificado'),
        })) as Processo[];
        setProcessos(dados);
        if (refreshKey > 0) toast.success("Dados de processos atualizados!");
        else toast.success("Dados de processos carregados.");
      }
      setIsLoading(false);
    };
    fetchData();
  }, [refreshKey]);

  const handlePrint = () => { window.print(); };

  const stats = useMemo(() => {
    if (processos.length === 0) return null;

    const total = processos.length;

    // Média de Dias Conclusos
    const mediaDias = processos.reduce((s, p) => s + p['Dias Conclusos'], 0) / total;

    // Média de Eventos
    const mediaEventos = processos.reduce((s, p) => s + p.Eventos, 0) / total;

    // Distribuição por procedimento (substring case-insensitive)
    let conhecimentoCount = 0, execucaoCount = 0;
    for (const p of processos) {
      const proc = p.Procedimento.toLowerCase();
      if (proc.includes('conhecimento')) conhecimentoCount++;
      else if (proc.includes('execução') || proc.includes('execucao')) execucaoCount++;
    }
    const outrosCount = total - conhecimentoCount - execucaoCount;

    // Aging (faixas de Dias Conclusos)
    const agingDist = { '0-30 dias': 0, '31-60 dias': 0, '61-90 dias': 0, '91-120 dias': 0, '121+ dias': 0 };
    for (const p of processos) {
      const d = p['Dias Conclusos'];
      if (d <= 30) agingDist['0-30 dias']++;
      else if (d <= 60) agingDist['31-60 dias']++;
      else if (d <= 90) agingDist['61-90 dias']++;
      else if (d <= 120) agingDist['91-120 dias']++;
      else agingDist['121+ dias']++;
    }
    const agingData = Object.entries(agingDist).map(([name, value]) => ({ name, value }));

    // Faixas críticas
    const criticalRanges = {
      '70-100 dias': processos.filter(p => p['Dias Conclusos'] >= 70 && p['Dias Conclusos'] < 100).length,
      '100-120 dias': processos.filter(p => p['Dias Conclusos'] >= 100 && p['Dias Conclusos'] <= 120).length,
      '120+ dias': processos.filter(p => p['Dias Conclusos'] > 120).length,
    };

    // Distribuição por faixa de eventos
    const eventsDist = { '0-20': 0, '21-50': 0, '51-100': 0, '101-200': 0, '201+': 0 };
    for (const p of processos) {
      const e = p.Eventos;
      if (e <= 20) eventsDist['0-20']++;
      else if (e <= 50) eventsDist['21-50']++;
      else if (e <= 100) eventsDist['51-100']++;
      else if (e <= 200) eventsDist['101-200']++;
      else eventsDist['201+']++;
    }
    const eventsData = Object.entries(eventsDist).map(([name, value]) => ({ name, value }));

    // Distribuição por tipo de conclusão
    const conclusaoCounts: Record<string, number> = {};
    for (const p of processos) {
      const tipo = p['Tipo de Conclusão'] || 'Não especificado';
      conclusaoCounts[tipo] = (conclusaoCounts[tipo] || 0) + 1;
    }
    const conclusaoData = Object.entries(conclusaoCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    // Top 5 Assuntos
    const assuntoCounts: Record<string, number> = {};
    for (const p of processos) { assuntoCounts[p.Assunto] = (assuntoCounts[p.Assunto] || 0) + 1; }
    const top5Assuntos = Object.entries(assuntoCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));

    // Top 30 processos com mais dias conclusos
    const top30MaisAntigos = [...processos]
      .sort((a, b) => b['Dias Conclusos'] - a['Dias Conclusos'])
      .slice(0, 30);

    return {
      total, mediaDias, mediaEventos,
      conhecimentoCount, execucaoCount, outrosCount,
      agingData, criticalRanges, eventsData,
      conclusaoData, top5Assuntos, top30MaisAntigos
    };
  }, [processos]);

  const PrintStyles = () => (
    <style jsx global>{`
      @media print {
        .no-print { display: none !important; }
        main { padding: 0 !important; }
      }
    `}</style>
  );

  if (isLoading) return <div>Carregando dados dos processos...</div>;

  return (
    <div className="space-y-6">
      <PrintStyles />

      <Card className="no-print">
        <CardHeader><CardTitle>Exportar Relatório</CardTitle></CardHeader>
        <CardContent>
          <Button onClick={handlePrint} variant="outline" disabled={processos.length === 0}>
            Exportar Relatório (PDF)
          </Button>
        </CardContent>
      </Card>

      {processos.length === 0 ? (
        <Card className="flex items-center justify-center py-12">
          <p className="text-gray-500">
            Nenhum dado de processo carregado. Acesse a aba &quot;Gerenciamento e Entrada de Dados&quot; para importar.
          </p>
        </Card>
      ) : (
        stats && (
          <>
            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <KpiCard
                title="Total de Processos Conclusos"
                value={stats.total.toString()}
                subtitle="Todos com conclusão registrada"
                icon="📋"
                description="Número total de processos com algum tipo de conclusão registrada no sistema."
              />
              <KpiCard
                title="Média Dias Conclusos"
                value={stats.mediaDias.toFixed(1)}
                subtitle={`${(stats.mediaDias / 30).toFixed(1)} meses`}
                icon="⏱️"
                description="Média aritmética do campo 'Dias Conclusos' de todos os processos. Indica quanto tempo os processos ficam aguardando decisão."
              />
              <KpiCard
                title="Média de Eventos"
                value={stats.mediaEventos.toFixed(1)}
                subtitle="por processo"
                icon="📑"
                description="Média de eventos processuais por processo. Processos com mais eventos tendem a ser mais complexos."
              />
              <KpiCard
                title="Processos 70-120 dias"
                value={(stats.criticalRanges['70-100 dias'] + stats.criticalRanges['100-120 dias']).toString()}
                subtitle={`${(((stats.criticalRanges['70-100 dias'] + stats.criticalRanges['100-120 dias']) / stats.total) * 100).toFixed(1)}% do total`}
                icon="⚠️"
                description="Processos na faixa de atenção (70 a 120 dias conclusos). Merecem acompanhamento para não entrar em situação crítica."
              />
              <KpiCard
                title="Processos 120+ dias"
                value={stats.criticalRanges['120+ dias'].toString()}
                subtitle={`${((stats.criticalRanges['120+ dias'] / stats.total) * 100).toFixed(1)}% do total`}
                icon="🚨"
                description="Processos conclusos há mais de 120 dias (4 meses). Situação crítica — requerem atenção imediata."
              />
            </div>

            {/* Cards rápidos de distribuição */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader><CardTitle>Distribuição por Procedimento</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Conhecimento:</span>
                      <Badge variant="default">{stats.conhecimentoCount} ({((stats.conhecimentoCount / stats.total) * 100).toFixed(1)}%)</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Execução:</span>
                      <Badge variant="secondary">{stats.execucaoCount} ({((stats.execucaoCount / stats.total) * 100).toFixed(1)}%)</Badge>
                    </div>
                    {stats.outrosCount > 0 && (
                      <div className="flex justify-between items-center">
                        <span>Outros:</span>
                        <Badge variant="outline">{stats.outrosCount} ({((stats.outrosCount / stats.total) * 100).toFixed(1)}%)</Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Tipos de Conclusão</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats.conclusaoData.slice(0, 4).map((item, index) => (
                      <div key={item.name} className="flex justify-between items-center">
                        <span className="text-sm truncate">{item.name}:</span>
                        <Badge variant={index === 0 ? "default" : "outline"}>
                          {item.value} ({((item.value / stats.total) * 100).toFixed(1)}%)
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Faixas Críticas</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(stats.criticalRanges).map(([faixa, count]) => (
                      <div key={faixa} className="flex justify-between items-center">
                        <span className="text-sm">{faixa}:</span>
                        <Badge variant={faixa === '120+ dias' ? "destructive" : "secondary"}>
                          {count} ({((count / stats.total) * 100).toFixed(1)}%)
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Gráficos */}
            <Tabs defaultValue="aging" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="aging">Dias Conclusos</TabsTrigger>
                <TabsTrigger value="eventos">Eventos &amp; Tipos</TabsTrigger>
              </TabsList>

              {/* Tab: Dias Conclusos */}
              <TabsContent value="aging" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Distribuição por Faixa de Dias Conclusos</CardTitle>
                      <CardDescription>Aging — quantos processos estão em cada faixa</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stats.agingData}>
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" name="Processos">
                            {stats.agingData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={['#00C49F', '#FFBB28', '#FF8042', '#FF4444', '#CC0000'][index % 5]}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Tipos de Conclusão</CardTitle>
                      <CardDescription>Decisão, Despacho, Sentença</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={stats.conclusaoData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%" cy="50%"
                            outerRadius={100}
                            label={(props) => props.percent !== undefined ? `${props.name}: ${(props.percent * 100).toFixed(0)}%` : ''}
                          >
                            {stats.conclusaoData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042'][index % 4]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab: Eventos & Tipos */}
              <TabsContent value="eventos" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Distribuição por Faixa de Eventos</CardTitle>
                      <CardDescription>Quantidade de processos em cada faixa de eventos</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stats.eventsData}>
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="#82ca9d" name="Processos" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Distribuição por Procedimento</CardTitle>
                      <CardDescription>Conhecimento vs Execução vs Outros</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Conhecimento', value: stats.conhecimentoCount },
                              { name: 'Execução', value: stats.execucaoCount },
                              ...(stats.outrosCount > 0 ? [{ name: 'Outros', value: stats.outrosCount }] : [])
                            ]}
                            dataKey="value"
                            nameKey="name"
                            cx="50%" cy="50%"
                            outerRadius={100}
                            label={(props) => props.percent !== undefined ? `${props.name}: ${(props.percent * 100).toFixed(0)}%` : ''}
                          >
                            <Cell fill="#0088FE" />
                            <Cell fill="#00C49F" />
                            <Cell fill="#FFBB28" />
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Top 5 Assuntos</CardTitle>
                    <CardDescription>Assuntos com maior volume de processos conclusos</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={stats.top5Assuntos} layout="vertical" margin={{ left: 120 }}>
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={120} interval={0} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#ffc658" name="Processos" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Top 30 processos com mais dias conclusos */}
            <Card>
              <CardHeader>
                <CardTitle>Top 30 — Processos com Maior Tempo Concluso</CardTitle>
                <CardDescription>
                  Processos ordenados pelo maior número de dias conclusos (aguardando decisão há mais tempo)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left">
                        <th className="px-3 py-2 font-semibold">#</th>
                        <th className="px-3 py-2 font-semibold">Processo</th>
                        <th className="px-3 py-2 font-semibold text-right">Dias Conclusos</th>
                        <th className="px-3 py-2 font-semibold">Tipo de Conclusão</th>
                        <th className="px-3 py-2 font-semibold">Classe</th>
                        <th className="px-3 py-2 font-semibold">Assessor</th>
                        <th className="px-3 py-2 font-semibold">Eventos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.top30MaisAntigos.map((p, i) => {
                        const dias = p['Dias Conclusos'];
                        const critico = dias > 120;
                        const atencao = dias >= 70 && dias <= 120;
                        return (
                          <tr key={p.Processo} className={`border-b hover:bg-gray-50 ${critico ? 'bg-red-50' : atencao ? 'bg-yellow-50' : ''}`}>
                            <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                            <td className="px-3 py-2 font-mono text-xs">{p.Processo}</td>
                            <td className="px-3 py-2 text-right">
                              <span className={`font-bold ${critico ? 'text-red-600' : atencao ? 'text-orange-500' : 'text-gray-700'}`}>
                                {dias}
                              </span>
                              <span className="text-gray-400 text-xs ml-1">({(dias / 30).toFixed(1)}m)</span>
                            </td>
                            <td className="px-3 py-2 text-gray-700">{p['Tipo de Conclusão']}</td>
                            <td className="px-3 py-2 text-gray-700 max-w-[160px] truncate">{p.Classe}</td>
                            <td className="px-3 py-2 text-gray-700">{p.Assessor}</td>
                            <td className="px-3 py-2 text-gray-700 text-right">{p.Eventos}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )
      )}
    </div>
  );
}
