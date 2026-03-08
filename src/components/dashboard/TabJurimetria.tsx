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

interface Alerta {
  id: string;
  processo: string;
  tipo: 'CRITICO' | 'ALTO' | 'MEDIO';
  categoria: string;
  mensagem: string;
  valor: number | string;
  prazoLimite?: number;
  acoes?: string[];
}

// ─── Alertas (baseados apenas em Dias Conclusos e campos disponíveis) ─────────
const gerarAlertas = (processos: Processo[]): Alerta[] => {
  const alertas: Alerta[] = [];

  processos.forEach(processo => {
    // CRITICO: Concluso há mais de 4 meses
    if (processo['Dias Conclusos'] > 120) {
      alertas.push({
        id: `critico-concluso-${processo.Processo}`,
        processo: processo.Processo,
        tipo: 'CRITICO',
        categoria: 'CONCLUSO_EXCESSIVO',
        mensagem: `Concluso há ${processo['Dias Conclusos']} dias (${Math.round(processo['Dias Conclusos'] / 30)} meses)`,
        valor: processo['Dias Conclusos'],
        prazoLimite: 120,
        acoes: ['Urgente: Verificar pendências', 'Contatar magistrado', 'Priorizar decisão']
      });
    }

    // ALTO: Execução de alimentos conclusa há mais de 60 dias
    const procLower = (processo.Procedimento || '').toLowerCase();
    if (procLower.includes('execução') && processo.Assunto.toLowerCase().includes('alimentos') && processo['Dias Conclusos'] > 60) {
      alertas.push({
        id: `alto-alimentos-${processo.Processo}`,
        processo: processo.Processo,
        tipo: 'ALTO',
        categoria: 'EXECUCAO_ALIMENTOS',
        mensagem: `Execução de alimentos conclusa há ${processo['Dias Conclusos']} dias`,
        valor: processo['Dias Conclusos'],
        prazoLimite: 60,
        acoes: ['Verificar bloqueios', 'Contatar devedor', 'Avaliar outras medidas coercitivas']
      });
    }

    // ALTO: Processo envolvendo menores concluso há mais de 30 dias
    if ((processo.Classe.toLowerCase().includes('guarda') ||
         processo.Assunto.toLowerCase().includes('visita') ||
         processo.Assunto.toLowerCase().includes('alienação parental')) &&
        processo['Dias Conclusos'] > 30) {
      alertas.push({
        id: `alto-menor-${processo.Processo}`,
        processo: processo.Processo,
        tipo: 'ALTO',
        categoria: 'INTERESSE_MENOR',
        mensagem: `Processo envolvendo menor concluso há ${processo['Dias Conclusos']} dias`,
        valor: processo['Dias Conclusos'],
        prazoLimite: 30,
        acoes: ['Priorizar decisão', 'Verificar acompanhamento psicossocial']
      });
    }

    // MEDIO: Concluso entre 60-120 dias
    if (processo['Dias Conclusos'] >= 60 && processo['Dias Conclusos'] <= 120) {
      alertas.push({
        id: `medio-concluso-${processo.Processo}`,
        processo: processo.Processo,
        tipo: 'MEDIO',
        categoria: 'CONCLUSO_ATENCAO',
        mensagem: `Concluso há ${processo['Dias Conclusos']} dias — próximo ao limite`,
        valor: processo['Dias Conclusos'],
        prazoLimite: 60,
        acoes: ['Acompanhar prazo', 'Preparar para decisão']
      });
    }

    // MEDIO: Divorcios com muitos eventos e concluso há mais de 45 dias
    if (processo.Classe.toLowerCase().includes('divórcio') && processo['Dias Conclusos'] > 45) {
      alertas.push({
        id: `medio-divorcio-${processo.Processo}`,
        processo: processo.Processo,
        tipo: 'MEDIO',
        categoria: 'DIVORCIO_PENDENTE',
        mensagem: `Divórcio concluso há ${processo['Dias Conclusos']} dias`,
        valor: processo['Dias Conclusos'],
        prazoLimite: 45,
        acoes: ['Verificar documentação', 'Priorizar julgamento']
      });
    }
  });

  return alertas.sort((a, b) => {
    const prioridades = { 'CRITICO': 3, 'ALTO': 2, 'MEDIO': 1 };
    return prioridades[b.tipo] - prioridades[a.tipo];
  });
};

// ─── SistemaAlertas ───────────────────────────────────────────────────────────
const SistemaAlertas = ({ alertas }: { alertas: Alerta[] }) => {
  const [filtroTipo, setFiltroTipo] = useState<string>('TODOS');
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const alertasFiltrados = filtroTipo === 'TODOS' ? alertas : alertas.filter(a => a.tipo === filtroTipo);

  const contadores = alertas.reduce((acc, alerta) => {
    acc[alerta.tipo] = (acc[alerta.tipo] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number });

  const getCorAlerta = (tipo: string) => {
    switch (tipo) {
      case 'CRITICO': return 'border-red-500 bg-red-50';
      case 'ALTO': return 'border-orange-500 bg-orange-50';
      case 'MEDIO': return 'border-yellow-500 bg-yellow-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  const getIconeAlerta = (tipo: string) => {
    switch (tipo) {
      case 'CRITICO': return '🚨';
      case 'ALTO': return '⚠️';
      case 'MEDIO': return '⚡';
      default: return '📌';
    }
  };

  const toggleExpansao = (alertaId: string) => {
    const novos = new Set(expandidos);
    if (novos.has(alertaId)) novos.delete(alertaId);
    else novos.add(alertaId);
    setExpandidos(novos);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {['TODOS', 'CRITICO', 'ALTO', 'MEDIO'].map(tipo => (
          <button
            key={tipo}
            onClick={() => setFiltroTipo(tipo)}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              filtroTipo === tipo ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {tipo === 'TODOS' ? `Todos (${alertas.length})` : `${getIconeAlerta(tipo)} ${tipo} (${contadores[tipo] || 0})`}
          </button>
        ))}
      </div>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
        {alertasFiltrados.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Nenhum alerta para este filtro.</p>
        ) : (
          alertasFiltrados.map(alerta => (
            <div key={alerta.id} className={`border-l-4 rounded-r-lg p-4 ${getCorAlerta(alerta.tipo)}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getIconeAlerta(alerta.tipo)}</span>
                  <div>
                    <div className="font-medium text-sm">{alerta.processo}</div>
                    <div className="text-xs text-gray-600">{alerta.categoria}</div>
                  </div>
                </div>
                <button onClick={() => toggleExpansao(alerta.id)} className="text-xs text-gray-500 hover:text-gray-800">
                  {expandidos.has(alerta.id) ? '▲ menos' : '▼ mais'}
                </button>
              </div>
              <p className="text-sm mt-2">{alerta.mensagem}</p>
              {expandidos.has(alerta.id) && alerta.acoes && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs font-medium text-gray-700 mb-1">Ações recomendadas:</div>
                  <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                    {alerta.acoes.map((acao, i) => <li key={i}>{acao}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Resumo dos Alertas</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{contadores.CRITICO || 0}</div>
              <div className="text-gray-600">Críticos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{contadores.ALTO || 0}</div>
              <div className="text-gray-600">Alta Prioridade</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{contadores.MEDIO || 0}</div>
              <div className="text-gray-600">Média Prioridade</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

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

  const alertas = useMemo(() => {
    if (processos.length === 0) return [];
    return gerarAlertas(processos);
  }, [processos]);

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

    // Distribuição por assessor
    const assessorCounts: Record<string, number> = {};
    for (const p of processos) {
      const a = p.Assessor || 'Não identificado';
      assessorCounts[a] = (assessorCounts[a] || 0) + 1;
    }
    const assessorData = Object.entries(assessorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));

    // Distribuição por fase processual
    const faseCounts: Record<string, number> = {};
    for (const p of processos) {
      const f = p['Fase Processual'] || 'Não informada';
      faseCounts[f] = (faseCounts[f] || 0) + 1;
    }
    const faseData = Object.entries(faseCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));

    // Top 5 Classes
    const classeCounts: Record<string, number> = {};
    for (const p of processos) { classeCounts[p.Classe] = (classeCounts[p.Classe] || 0) + 1; }
    const top5Classes = Object.entries(classeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));

    // Top 5 Assuntos
    const assuntoCounts: Record<string, number> = {};
    for (const p of processos) { assuntoCounts[p.Assunto] = (assuntoCounts[p.Assunto] || 0) + 1; }
    const top5Assuntos = Object.entries(assuntoCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));

    return {
      total, mediaDias, mediaEventos,
      conhecimentoCount, execucaoCount, outrosCount,
      agingData, criticalRanges, eventsData,
      conclusaoData, assessorData, faseData,
      top5Classes, top5Assuntos
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

            {/* Tabs com gráficos */}
            <Tabs defaultValue="aging" className="space-y-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="aging">Dias Conclusos</TabsTrigger>
                <TabsTrigger value="eventos">Eventos</TabsTrigger>
                <TabsTrigger value="assessores">Assessores</TabsTrigger>
                <TabsTrigger value="classes">Classes</TabsTrigger>
                <TabsTrigger value="alertas">Alertas ({alertas.length})</TabsTrigger>
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
                      <CardDescription>Distribuição por tipo: Decisão, Despacho, Sentença</CardDescription>
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

                <Card>
                  <CardHeader>
                    <CardTitle>Fases Processuais</CardTitle>
                    <CardDescription>Distribuição por fase processual</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={stats.faseData} layout="vertical" margin={{ left: 120 }}>
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={120} interval={0} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#8884d8" name="Processos" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab: Eventos */}
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

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Top 5 Assuntos</CardTitle>
                      <CardDescription>Assuntos com maior volume de processos</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={stats.top5Assuntos} layout="vertical" margin={{ left: 100 }}>
                          <XAxis type="number" />
                          <YAxis type="category" dataKey="name" width={100} interval={0} tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#ffc658" name="Processos" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Resumo Estatístico</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span>Total de processos:</span>
                        <Badge variant="default">{stats.total}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Média Dias Conclusos:</span>
                        <Badge variant="default">{stats.mediaDias.toFixed(1)} dias</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Média de Eventos:</span>
                        <Badge variant="default">{stats.mediaEventos.toFixed(1)}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Faixa crítica (120+):</span>
                        <Badge variant="destructive">{stats.criticalRanges['120+ dias']} processos</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Faixa atenção (70-120):</span>
                        <Badge variant="secondary">
                          {stats.criticalRanges['70-100 dias'] + stats.criticalRanges['100-120 dias']} processos
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab: Assessores */}
              <TabsContent value="assessores" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Distribuição por Assessor</CardTitle>
                    <CardDescription>Top 10 assessores por volume de processos conclusos</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={stats.assessorData} layout="vertical" margin={{ left: 140 }}>
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={140} interval={0} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#8884d8" name="Processos" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab: Classes */}
              <TabsContent value="classes" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Top 5 Classes Processuais</CardTitle>
                      <CardDescription>Classes com maior volume de processos</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stats.top5Classes} layout="vertical" margin={{ left: 120 }}>
                          <XAxis type="number" />
                          <YAxis type="category" dataKey="name" width={120} interval={0} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#82ca9d" name="Processos" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Faixas Críticas — Aging</CardTitle>
                      <CardDescription>Processos nas faixas de atenção e crítica</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      {Object.entries(stats.criticalRanges).map(([faixa, count]) => (
                        <div key={faixa}>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{faixa}</span>
                            <span className="font-medium">{count} ({((count / stats.total) * 100).toFixed(1)}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${faixa === '120+ dias' ? 'bg-red-500' : faixa === '100-120 dias' ? 'bg-orange-400' : 'bg-yellow-400'}`}
                              style={{ width: `${Math.min((count / stats.total) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab: Alertas */}
              <TabsContent value="alertas" className="space-y-4">
                <SistemaAlertas alertas={alertas} />
              </TabsContent>
            </Tabs>
          </>
        )
      )}
    </div>
  );
}
