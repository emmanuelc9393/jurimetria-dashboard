// src/components/dashboard/TabJurimetria.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend, LineChart, Line, ScatterChart, Scatter } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { differenceInDays, format, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { loadJurimetriaData } from '@/app/actions';

// Componente Badge customizado para substituir o shadcn/ui
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

// Componente de Tooltip para explicações
const InfoTooltip = ({ children, description }: { children: React.ReactNode; description: string }) => (
  <div className="group relative">
    {children}
    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 w-64 text-center">
      {description}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
    </div>
  </div>
);

// Interfaces
interface Processo {
  Processo: string;
  Eventos: number;
  Procedimento: string;
  Classe: string;
  Assunto: string;
  'Tipo de Conclusão': string;
  'Dias Conclusos': number;
  Autuação: Date;
  'Dias em Tramitação': number;
  complexidade?: 'Baixa' | 'Média' | 'Alta';
  eficiencia?: number;
  categoria_tempo?: string;
  mes_autuacao?: string;
  ano_autuacao?: number;
  [key: string]: string | number | Date | undefined;
}

interface Alerta {
  id: string;
  processo: string;
  tipo: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAIXO';
  categoria: string;
  mensagem: string;
  valor: number | string;
  prazoLimite?: number;
  acoes?: string[];
}

// Função para gerar alertas automatizados
const gerarAlertas = (processos: Processo[]): Alerta[] => {
  const alertas: Alerta[] = [];

  processos.forEach(processo => {
    // 1. ALERTAS CRÍTICOS - Prioridade Máxima
    
    // Processos com mais de 5 anos em tramitação
    if (processo['Dias em Tramitação'] > 1825) {
      alertas.push({
        id: `critico-tempo-${processo.Processo}`,
        processo: processo.Processo,
        tipo: 'CRITICO',
        categoria: 'TEMPO_EXCESSIVO',
        mensagem: `Processo em tramitação há ${Math.round(processo['Dias em Tramitação'] / 365)} anos`,
        valor: processo['Dias em Tramitação'],
        prazoLimite: 1825,
        acoes: ['Verificar possibilidade de urgência', 'Revisar andamento', 'Contatar responsável']
      });
    }

    // Processos conclusos há mais de 4 meses sem movimentação
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

    // Processos com atividade anômala (muitos eventos para pouco tempo)
    const ratioEventos = processo.Eventos / (processo['Dias em Tramitação'] / 30);
    if (ratioEventos > 50) {
      alertas.push({
        id: `critico-atividade-${processo.Processo}`,
        processo: processo.Processo,
        tipo: 'CRITICO',
        categoria: 'ATIVIDADE_ANOMALA',
        mensagem: `Atividade anômala: ${processo.Eventos} eventos em ${Math.round(processo['Dias em Tramitação'] / 30)} meses`,
        valor: ratioEventos,
        acoes: ['Verificar qualidade dos lançamentos', 'Revisar histórico', 'Investigar inconsistências']
      });
    }

    // 2. ALERTAS DE ALTA PRIORIDADE
    
    // Processos de execução de alimentos parados
    if (processo.Procedimento === 'Execução Judicial' && 
        processo.Assunto.toLowerCase().includes('alimentos') && 
        processo['Dias Conclusos'] > 60) {
      alertas.push({
        id: `alto-alimentos-${processo.Processo}`,
        processo: processo.Processo,
        tipo: 'ALTO',
        categoria: 'EXECUCAO_ALIMENTOS',
        mensagem: `Execução de alimentos parada há ${processo['Dias Conclusos']} dias`,
        valor: processo['Dias Conclusos'],
        prazoLimite: 60,
        acoes: ['Verificar bloqueios', 'Contatar devedor', 'Avaliar outras medidas coercitivas']
      });
    }

    // Processos envolvendo menores com tempo excessivo
    if ((processo.Classe.toLowerCase().includes('guarda') || 
         processo.Assunto.toLowerCase().includes('visita') ||
         processo.Assunto.toLowerCase().includes('alienação parental')) && 
        processo['Dias em Tramitação'] > 365) {
      alertas.push({
        id: `alto-menor-${processo.Processo}`,
        processo: processo.Processo,
        tipo: 'ALTO',
        categoria: 'INTERESSE_MENOR',
        mensagem: `Processo envolvendo menor há ${Math.round(processo['Dias em Tramitação'] / 30)} meses`,
        valor: processo['Dias em Tramitação'],
        prazoLimite: 365,
        acoes: ['Priorizar tramitação', 'Agendar audiência', 'Verificar acompanhamento psicossocial']
      });
    }

    // Processos muito antigos (mais de 3 anos)
    if (processo['Dias em Tramitação'] > 1095 && processo['Dias em Tramitação'] <= 1825) {
      alertas.push({
        id: `alto-antigo-${processo.Processo}`,
        processo: processo.Processo,
        tipo: 'ALTO',
        categoria: 'PROCESSO_ANTIGO',
        mensagem: `Processo antigo: ${Math.round(processo['Dias em Tramitação'] / 365)} anos de tramitação`,
        valor: processo['Dias em Tramitação'],
        prazoLimite: 1095,
        acoes: ['Revisar andamento', 'Verificar possibilidade de julgamento', 'Priorizar pauta']
      });
    }

    // 3. ALERTAS DE MÉDIA PRIORIDADE
    
    // Processos conclusos entre 60-120 dias
    if (processo['Dias Conclusos'] >= 60 && processo['Dias Conclusos'] <= 120) {
      alertas.push({
        id: `medio-concluso-${processo.Processo}`,
        processo: processo.Processo,
        tipo: 'MEDIO',
        categoria: 'CONCLUSO_ATENCAO',
        mensagem: `Concluso há ${processo['Dias Conclusos']} dias - próximo ao limite`,
        valor: processo['Dias Conclusos'],
        prazoLimite: 60,
        acoes: ['Acompanhar prazo', 'Verificar complexidade', 'Preparar para decisão']
      });
    }

    // Processos de baixa atividade (poucos eventos para muito tempo)
    if (processo['Dias em Tramitação'] > 730 && processo.Eventos < 50) {
      alertas.push({
        id: `medio-inatividade-${processo.Processo}`,
        processo: processo.Processo,
        tipo: 'MEDIO',
        categoria: 'BAIXA_ATIVIDADE',
        mensagem: `Baixa atividade: ${processo.Eventos} eventos em ${Math.round(processo['Dias em Tramitação'] / 365)} anos`,
        valor: processo.Eventos,
        acoes: ['Verificar impulso processual', 'Intimar partes', 'Revisar necessidade de diligências']
      });
    }

    // Divórcios litigiosos com tempo excessivo
    if (processo.Classe === 'Divórcio Litigioso' && processo['Dias em Tramitação'] > 548) {
      alertas.push({
        id: `medio-divorcio-${processo.Processo}`,
        processo: processo.Processo,
        tipo: 'MEDIO',
        categoria: 'DIVORCIO_LENTO',
        mensagem: `Divórcio litigioso há ${Math.round(processo['Dias em Tramitação'] / 30)} meses`,
        valor: processo['Dias em Tramitação'],
        prazoLimite: 548,
        acoes: ['Agendar audiência de conciliação', 'Verificar documentação', 'Priorizar julgamento']
      });
    }

    // 4. ALERTAS DE BAIXA PRIORIDADE (Monitoramento)
    
    // Processos próximos de completar 2 anos
    if (processo['Dias em Tramitação'] > 600 && processo['Dias em Tramitação'] <= 730) {
      alertas.push({
        id: `baixo-aproximando-${processo.Processo}`,
        processo: processo.Processo,
        tipo: 'BAIXO',
        categoria: 'APROXIMANDO_LIMITE',
        mensagem: `Aproximando 2 anos de tramitação (${Math.round(processo['Dias em Tramitação'] / 30)} meses)`,
        valor: processo['Dias em Tramitação'],
        acoes: ['Monitorar andamento', 'Planejar próximas etapas']
      });
    }
  });

  return alertas.sort((a, b) => {
    const prioridades = { 'CRITICO': 4, 'ALTO': 3, 'MEDIO': 2, 'BAIXO': 1 };
    return prioridades[b.tipo] - prioridades[a.tipo];
  });
};

// Componente de Sistema de Alertas
const SistemaAlertas = ({ alertas }: { alertas: Alerta[] }) => {
  const [filtroTipo, setFiltroTipo] = useState<string>('TODOS');
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const alertasFiltrados = filtroTipo === 'TODOS' 
    ? alertas 
    : alertas.filter(a => a.tipo === filtroTipo);

  const contadores = alertas.reduce((acc, alerta) => {
    acc[alerta.tipo] = (acc[alerta.tipo] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number });

  const getCorAlerta = (tipo: string) => {
    switch (tipo) {
      case 'CRITICO': return 'border-red-500 bg-red-50';
      case 'ALTO': return 'border-orange-500 bg-orange-50';
      case 'MEDIO': return 'border-yellow-500 bg-yellow-50';
      case 'BAIXO': return 'border-blue-500 bg-blue-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  const getIconeAlerta = (tipo: string) => {
    switch (tipo) {
      case 'CRITICO': return '🚨';
      case 'ALTO': return '⚠️';
      case 'MEDIO': return '⚡';
      case 'BAIXO': return '📋';
      default: return '📌';
    }
  };

  const toggleExpansao = (alertaId: string) => {
    const novosExpandidos = new Set(expandidos);
    if (novosExpandidos.has(alertaId)) {
      novosExpandidos.delete(alertaId);
    } else {
      novosExpandidos.add(alertaId);
    }
    setExpandidos(novosExpandidos);
  };

  return (
    <div className="space-y-4">
      {/* Header com Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🚨</span>
            Sistema de Alertas Automatizado
          </CardTitle>
          <CardDescription>
            Identificação automática de processos que requerem atenção especial
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button 
              variant={filtroTipo === 'TODOS' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setFiltroTipo('TODOS')}
            >
              Todos ({alertas.length})
            </Button>
            <Button 
              variant={filtroTipo === 'CRITICO' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setFiltroTipo('CRITICO')}
              className="text-red-600"
            >
              🚨 Críticos ({contadores.CRITICO || 0})
            </Button>
            <Button 
              variant={filtroTipo === 'ALTO' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setFiltroTipo('ALTO')}
              className="text-orange-600"
            >
              ⚠️ Altos ({contadores.ALTO || 0})
            </Button>
            <Button 
              variant={filtroTipo === 'MEDIO' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setFiltroTipo('MEDIO')}
              className="text-yellow-600"
            >
              ⚡ Médios ({contadores.MEDIO || 0})
            </Button>
            <Button 
              variant={filtroTipo === 'BAIXO' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setFiltroTipo('BAIXO')}
              className="text-blue-600"
            >
              📋 Baixos ({contadores.BAIXO || 0})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Alertas */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {alertasFiltrados.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-500">Nenhum alerta encontrado para o filtro selecionado.</p>
            </CardContent>
          </Card>
        ) : (
          alertasFiltrados.map(alerta => (
            <Card 
              key={alerta.id} 
              className={`border-l-4 ${getCorAlerta(alerta.tipo)} cursor-pointer hover:shadow-md transition-shadow`}
              onClick={() => toggleExpansao(alerta.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{getIconeAlerta(alerta.tipo)}</span>
                      <Badge variant={
                        alerta.tipo === 'CRITICO' ? 'destructive' : 
                        alerta.tipo === 'ALTO' ? 'destructive' : 
                        alerta.tipo === 'MEDIO' ? 'default' : 'outline'
                      }>
                        {alerta.tipo}
                      </Badge>
                      <span className="text-sm font-medium text-gray-600">
                        {alerta.categoria.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="font-mono text-sm text-blue-600 mb-1">
                      Processo: {alerta.processo}
                    </div>
                    <div className="text-sm text-gray-800">
                      {alerta.mensagem}
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    {expandidos.has(alerta.id) ? '▼' : '▶'}
                  </div>
                </div>

                {/* Seção Expandida */}
                {expandidos.has(alerta.id) && alerta.acoes && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      Ações Recomendadas:
                    </div>
                    <ul className="space-y-1">
                      {alerta.acoes.map((acao, index) => (
                        <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="text-blue-500">•</span>
                          {acao}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Resumo Estatístico */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo dos Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{contadores.BAIXO || 0}</div>
              <div className="text-gray-600">Monitoramento</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Componente KpiCard
const KpiCard = ({ title, value, subtitle, icon, trend, description }: { 
  title: string; 
  value: string; 
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string; };
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
      {trend && (
        <div className="flex items-center pt-1">
          <Badge variant={trend.value > 0 ? "destructive" : "default"} className="text-xs">
            {trend.value > 0 ? "↑" : "↓"} {Math.abs(trend.value).toFixed(1)}% {trend.label}
          </Badge>
        </div>
      )}
    </CardContent>
  </Card>
);

// Componente Principal
export function TabJurimetria({ refreshKey = 0 }: { refreshKey?: number }) {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Função para calcular complexidade baseada em eventos e tempo
  const calcularComplexidade = (eventos: number, diasTramitacao: number): 'Baixa' | 'Média' | 'Alta' => {
    const score = (eventos * 0.6) + (diasTramitacao / 30 * 0.4);
    if (score < 25) return 'Baixa';
    if (score < 50) return 'Média';
    return 'Alta';
  };

  // Função para calcular eficiência (eventos por dia de tramitação)
  const calcularEficiencia = (eventos: number, diasTramitacao: number): number => {
    return diasTramitacao > 0 ? eventos / diasTramitacao : 0;
  };

  // Função para categorizar tempo de tramitação
  const categorizarTempo = (dias: number): string => {
    if (dias <= 90) return 'Rápido (≤3 meses)';
    if (dias <= 365) return 'Normal (3m-1ano)';
    if (dias <= 730) return 'Lento (1-2 anos)';
    return 'Muito Lento (>2 anos)';
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const dadosSalvos = await loadJurimetriaData();
      if (dadosSalvos && dadosSalvos.length > 0) {
        const dadosComDatas = dadosSalvos.map((p) => {
          const processo = {
            ...p,
            Autuação: new Date(p.Autuação as string),
          } as Processo;

          processo.complexidade = calcularComplexidade(processo.Eventos, processo['Dias em Tramitação']);
          processo.eficiencia = calcularEficiencia(processo.Eventos, processo['Dias em Tramitação']);
          processo.categoria_tempo = categorizarTempo(processo['Dias em Tramitação']);
          processo.mes_autuacao = format(processo.Autuação, 'yyyy-MM');
          processo.ano_autuacao = processo.Autuação.getFullYear();

          return processo;
        });
        setProcessos(dadosComDatas);
        if (refreshKey > 0) toast.success("Dados de processos atualizados!");
      }
      setIsLoading(false);
    };
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handlePrint = () => { window.print(); };

  // Gerar alertas
  const alertas = useMemo(() => {
    if (processos.length === 0) return [];
    return gerarAlertas(processos);
  }, [processos]);

  const stats = useMemo(() => {
    if (processos.length === 0) return null;

    const totalProcessos = processos.length;
    const mediaEventos = processos.reduce((sum, p) => sum + p.Eventos, 0) / totalProcessos;
    const conhecimentoCount = processos.filter(p => p.Procedimento === 'Conhecimento').length;
    const execucaoCount = processos.filter(p => p.Procedimento === 'Execução Judicial').length;
    const processoMaisAntigo = Math.max(...processos.map(p => p['Dias em Tramitação']));
    const mediaTramitacao = processos.reduce((sum, p) => sum + p['Dias em Tramitação'], 0) / totalProcessos;

    // Análise de tempo de conclusão
    const mediaTempoConcluso = processos.reduce((sum, p) => sum + p['Dias Conclusos'], 0) / totalProcessos;
    
    // Análise de complexidade
    const complexidadeCounts = processos.reduce((acc, p) => {
      acc[p.complexidade!] = (acc[p.complexidade!] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
    const complexidadeData = Object.entries(complexidadeCounts).map(([name, value]) => ({ name, value }));

    // Análise de eficiência
    const mediaEficiencia = processos.reduce((sum, p) => sum + p.eficiencia!, 0) / totalProcessos;
    const processoMaisEficiente = Math.max(...processos.map(p => p.eficiencia!));

    // Análise temporal
    const categoriasTempoData = Object.entries(
      processos.reduce((acc, p) => {
        acc[p.categoria_tempo!] = (acc[p.categoria_tempo!] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number })
    ).map(([name, value]) => ({ name, value }));

    // Tendência temporal (processos por mês)
    const tendenciaMensal = Object.entries(
      processos.reduce((acc, p) => {
        acc[p.mes_autuacao!] = (acc[p.mes_autuacao!] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number })
    ).sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, count]) => ({ mes, count, mesFormatado: format(new Date(mes + '-01'), 'MMM/yy') }));

    // Correlação eventos x tempo
    const correlacaoData = processos.map(p => ({
      eventos: p.Eventos,
      diasTramitacao: p['Dias em Tramitação'],
      classe: p.Classe
    }));

    // Análise de produtividade por classe
    const produtividadePorClasse = Object.entries(
      processos.reduce((acc, p) => {
        if (!acc[p.Classe]) {
          acc[p.Classe] = { totalEventos: 0, totalDias: 0, count: 0 };
        }
        acc[p.Classe].totalEventos += p.Eventos;
        acc[p.Classe].totalDias += p['Dias em Tramitação'];
        acc[p.Classe].count++;
        return acc;
      }, {} as { [key: string]: { totalEventos: number; totalDias: number; count: number } })
    ).map(([classe, data]) => ({
      classe,
      mediaEventos: data.totalEventos / data.count,
      mediaDias: data.totalDias / data.count,
      eficiencia: (data.totalEventos / data.count) / (data.totalDias / data.count),
      count: data.count
    })).sort((a, b) => b.eficiencia - a.eficiencia).slice(0, 10);

    // Identificação de outliers
    const quartis = {
      eventos: {
        q1: processos.sort((a, b) => a.Eventos - b.Eventos)[Math.floor(totalProcessos * 0.25)].Eventos,
        q3: processos.sort((a, b) => a.Eventos - b.Eventos)[Math.floor(totalProcessos * 0.75)].Eventos
      },
      dias: {
        q1: processos.sort((a, b) => a['Dias em Tramitação'] - b['Dias em Tramitação'])[Math.floor(totalProcessos * 0.25)]['Dias em Tramitação'],
        q3: processos.sort((a, b) => a['Dias em Tramitação'] - b['Dias em Tramitação'])[Math.floor(totalProcessos * 0.75)]['Dias em Tramitação']
      }
    };

    const outliers = processos.filter(p => 
      p.Eventos > quartis.eventos.q3 + 1.5 * (quartis.eventos.q3 - quartis.eventos.q1) ||
      p['Dias em Tramitação'] > quartis.dias.q3 + 1.5 * (quartis.dias.q3 - quartis.dias.q1)
    );

    // Dados existentes
    const conclusaoCounts = processos.reduce((acc, p) => {
      acc[p['Tipo de Conclusão']] = (acc[p['Tipo de Conclusão']] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
    const conclusaoData = Object.entries(conclusaoCounts).map(([name, value]) => ({ name, value }));

    const faixasPrazo = {
      '0-30 dias': processos.filter(p => p['Dias Conclusos'] <= 30).length,
      '31-60 dias': processos.filter(p => p['Dias Conclusos'] > 30 && p['Dias Conclusos'] <= 60).length,
      '61-90 dias': processos.filter(p => p['Dias Conclusos'] > 60 && p['Dias Conclusos'] <= 90).length,
      '91-120 dias': processos.filter(p => p['Dias Conclusos'] > 90 && p['Dias Conclusos'] <= 120).length,
      '120+ dias': processos.filter(p => p['Dias Conclusos'] > 120).length,
    };
    const faixasPrazoData = Object.entries(faixasPrazo).map(([name, value]) => ({ name, value }));

    const top5Classes = Object.entries(
      processos.reduce((acc, p) => {
        acc[p.Classe] = (acc[p.Classe] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number })
    ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));

    const top5Assuntos = Object.entries(
      processos.reduce((acc, p) => {
        acc[p.Assunto] = (acc[p.Assunto] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number })
    ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));

    return {
      totalProcessos,
      mediaEventos,
      conhecimentoCount,
      execucaoCount,
      processoMaisAntigo,
      mediaTramitacao,
      mediaTempoConcluso,
      mediaEficiencia,
      processoMaisEficiente,
      complexidadeData,
      categoriasTempoData,
      tendenciaMensal,
      correlacaoData,
      produtividadePorClasse,
      outliers: outliers.length,
      conclusaoData,
      faixasPrazoData,
      top5Classes,
      top5Assuntos
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
      
      {/* Card de Metodologia */}
      <Card className="no-print bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-800">Metodologia dos Cálculos Jurimetricos</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700 space-y-2">
          <div><strong>Complexidade:</strong> Score = (Eventos × 0.6) + (Dias/30 × 0.4). Baixa (&lt;25), Média (25-50), Alta (&gt;50)</div>
          <div><strong>Eficiência:</strong> Eventos por dia de tramitação (Eventos ÷ Dias em Tramitação)</div>
          <div><strong>Outliers:</strong> Método IQR - processos com valores além de Q3 + 1.5×(Q3-Q1) para eventos ou dias</div>
          <div><strong>Processos Conclusos:</strong> Todos os processos presentes na base têm conclusão registrada</div>
        </CardContent>
      </Card>

      <Card className="no-print">
        <CardHeader>
          <CardTitle>Exportar Relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={handlePrint} variant="outline" disabled={processos.length === 0}>
            Exportar Relatório (PDF)
          </Button>
        </CardContent>
      </Card>

      {processos.length === 0 ? (
        <Card className="flex items-center justify-center py-12">
          <p className="text-gray-500">Nenhum dado de processo carregado. Use o painel acima para começar.</p>
        </Card>
      ) : (
        stats && (
          <>
            {/* KPIs Principais com Explicações */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <KpiCard 
                title="Total de Processos Conclusos" 
                value={stats.totalProcessos.toString()} 
                subtitle="Todos com conclusão registrada"
                icon="📋"
                description="Número total de processos que já possuem algum tipo de conclusão (sentença, despacho ou decisão) registrada no sistema"
              />
              <KpiCard 
                title="Tempo Médio Tramitação" 
                value={`${Math.round(stats.mediaTramitacao)} dias`}
                subtitle={`${(stats.mediaTramitacao / 30).toFixed(1)} meses`}
                icon="⏱️"
                description="Tempo médio entre a data de autuação e a conclusão do processo. Calculado como a média aritmética de todos os 'Dias em Tramitação'"
              />
              <KpiCard 
                title="Tempo Médio Conclusão" 
                value={`${Math.round(stats.mediaTempoConcluso)} dias`}
                subtitle={`${(stats.mediaTempoConcluso / 30).toFixed(1)} meses`}
                icon="⚖️"
                description="Tempo médio que os processos ficaram conclusos para decisão. Refere-se ao campo 'Dias Conclusos' do sistema"
              />
              <KpiCard 
                title="Eficiência Média" 
                value={stats.mediaEficiencia.toFixed(3)}
                subtitle="eventos/dia"
                icon="⚡"
                description="Média de eventos processuais por dia de tramitação. Calculado como: Total de Eventos ÷ Dias em Tramitação. Indica a atividade processual"
              />
              <KpiCard 
                title="Outliers Detectados" 
                value={stats.outliers.toString()}
                subtitle={`${((stats.outliers / stats.totalProcessos) * 100).toFixed(1)}% do total`}
                icon="🎯"
                description="Processos com padrões atípicos identificados pelo método IQR (Intervalo Interquartil). Casos que excedem Q3 + 1.5×(Q3-Q1) em eventos ou tempo"
              />
            </div>

            {/* Cards de Distribuição por Procedimento e Conclusão */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Distribuição por Procedimento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Conhecimento:</span>
                      <Badge variant="default">{stats.conhecimentoCount} ({((stats.conhecimentoCount / stats.totalProcessos) * 100).toFixed(1)}%)</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Execução Judicial:</span>
                      <Badge variant="secondary">{stats.execucaoCount} ({((stats.execucaoCount / stats.totalProcessos) * 100).toFixed(1)}%)</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tipos de Conclusão</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats.conclusaoData.slice(0, 4).map((item, index) => (
                      <div key={item.name} className="flex justify-between items-center">
                        <span className="text-sm truncate">{item.name}:</span>
                        <Badge variant={index === 0 ? "default" : "outline"}>
                          {item.value} ({((item.value / stats.totalProcessos) * 100).toFixed(1)}%)
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Indicadores de Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Processo + Antigo:</span>
                      <Badge variant="destructive">{stats.processoMaisAntigo} dias</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Média Eventos:</span>
                      <Badge variant="default">{stats.mediaEventos.toFixed(1)}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Maior Eficiência:</span>
                      <Badge variant="default">{stats.processoMaisEficiente.toFixed(3)}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="visao-geral" className="space-y-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
                <TabsTrigger value="complexidade">Complexidade</TabsTrigger>
                <TabsTrigger value="tendencias">Tendências</TabsTrigger>
                <TabsTrigger value="produtividade">Produtividade</TabsTrigger>
                <TabsTrigger value="alertas">Alertas ({alertas.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="visao-geral" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Categorias de Tempo de Tramitação</CardTitle>
                      <CardDescription>Classificação baseada na duração total do processo</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={stats.categoriasTempoData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={(props) => {
                              if (props.percent === undefined) return '';
                              return `${props.name}: ${(props.percent * 100).toFixed(0)}%`;
                            }}
                          >
                            {stats.categoriasTempoData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042'][index % 4]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Correlação: Eventos x Dias de Tramitação</CardTitle>
                      <CardDescription>Relação entre atividade processual e tempo de duração</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <ScatterChart data={stats.correlacaoData.slice(0, 50)}>
                          <XAxis type="number" dataKey="eventos" name="eventos" />
                          <YAxis type="number" dataKey="diasTramitacao" name="dias" />
                          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                          <Scatter dataKey="eventos" fill="#8884d8" />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Top 5 Classes Processuais</CardTitle>
                      <CardDescription>Classes com maior volume de processos</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stats.top5Classes} layout="vertical" margin={{ left: 100 }}>
                          <XAxis type="number" />
                          <YAxis type="category" dataKey="name" width={100} interval={0} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#82ca9d" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Processos por Faixa de Prazo Concluso</CardTitle>
                      <CardDescription>Distribuição do tempo que ficaram conclusos</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={stats.faixasPrazoData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={(props) => {
                              if (props.percent === undefined) return '';
                              return `${props.name}: ${(props.percent * 100).toFixed(0)}%`;
                            }}
                          >
                            {stats.faixasPrazoData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#FF0000'][index % 5]} />
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

              <TabsContent value="complexidade" className="space-y-4">
                <Card className="mb-4">
                  <CardHeader>
                    <CardTitle>Metodologia de Cálculo de Complexidade</CardTitle>
                    <CardDescription>Como determinamos a complexidade dos processos</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <div><strong>Fórmula:</strong> Score = (Número de Eventos × 0.6) + (Dias de Tramitação ÷ 30 × 0.4)</div>
                    <div><strong>Classificação:</strong> Baixa (&lt;25 pontos), Média (25-50 pontos), Alta (&gt;50 pontos)</div>
                    <div><strong>Rationale:</strong> Eventos têm peso maior (60%) pois indicam atividade processual. Tempo tem peso menor (40%) para não penalizar processos que naturalmente demandam mais tempo.</div>
                  </CardContent>
                </Card>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Distribuição de Complexidade</CardTitle>
                      <CardDescription>Baseada no score calculado de eventos e tempo</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={stats.complexidadeData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={(props) => {
                              if (props.percent === undefined) return '';
                              return `${props.name}: ${(props.percent * 100).toFixed(0)}%`;
                            }}
                          >
                            {stats.complexidadeData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.name === 'Baixa' ? '#00C49F' : entry.name === 'Média' ? '#FFBB28' : '#FF8042'} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Ranking de Produtividade por Classe</CardTitle>
                      <CardDescription>Top 10 classes mais eficientes (eventos/dia)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stats.produtividadePorClasse} layout="vertical" margin={{ left: 120 }}>
                          <XAxis type="number" />
                          <YAxis type="category" dataKey="classe" width={120} interval={0} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(value) => [(value as number).toFixed(4), 'Eficiência']} />
                          <Bar dataKey="eficiencia" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="tendencias" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Tendência Temporal de Autuações</CardTitle>
                    <CardDescription>Distribuição de processos ao longo do tempo - identifica sazonalidades</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={stats.tendenciaMensal}>
                        <XAxis dataKey="mesFormatado" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Análise de Outliers</CardTitle>
                      <CardDescription>Processos com padrões atípicos detectados</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-orange-600">{stats.outliers}</div>
                          <div className="text-sm text-gray-600">Processos Atípicos</div>
                          <div className="text-xs text-gray-500 mt-2">
                            {((stats.outliers / stats.totalProcessos) * 100).toFixed(1)}% do total
                          </div>
                        </div>
                        <div className="text-xs text-gray-600">
                          <strong>Metodologia IQR:</strong> Processos que excedem Q3 + 1.5×(Q3-Q1) 
                          em número de eventos ou dias de tramitação são considerados outliers.
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Top 5 Assuntos Processuais</CardTitle>
                      <CardDescription>Assuntos com maior volume</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stats.top5Assuntos} layout="vertical" margin={{ left: 100 }}>
                          <XAxis type="number" />
                          <YAxis type="category" dataKey="name" width={100} interval={0} tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#ffc658" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="produtividade" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Análise Detalhada de Produtividade por Classe</CardTitle>
                    <CardDescription>Métricas de eficiência e performance por tipo de processo</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {stats.produtividadePorClasse.slice(0, 5).map((item, index) => (
                        <div key={item.classe} className="flex items-center justify-between p-3 border rounded">
                          <div className="flex-1">
                            <div className="font-medium">{item.classe}</div>
                            <div className="text-sm text-gray-500">
                              {item.count} processos • {item.mediaEventos.toFixed(1)} eventos/processo • {item.mediaDias.toFixed(0)} dias médios
                            </div>
                          </div>
                          <Badge variant={index < 2 ? "default" : index < 4 ? "secondary" : "outline"}>
                            {item.eficiencia.toFixed(4)} eventos/dia
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Distribuição de Eficiência</CardTitle>
                      <CardDescription>Como se distribui a produtividade</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span>Eficiência Média:</span>
                        <Badge variant="default">{stats.mediaEficiencia.toFixed(3)} eventos/dia</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Maior Eficiência:</span>
                        <Badge variant="default">{stats.processoMaisEficiente.toFixed(3)} eventos/dia</Badge>
                      </div>
                      <div className="text-xs text-gray-600 mt-4">
                        <strong>Interpretação:</strong> Valores maiores indicam mais atividade processual 
                        por dia de tramitação. Útil para identificar gargalos e boas práticas.
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Resumo Estatístico</CardTitle>
                      <CardDescription>Principais indicadores da base</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="font-medium">Conhecimento</div>
                          <div className="text-gray-600">{stats.conhecimentoCount} processos</div>
                        </div>
                        <div>
                          <div className="font-medium">Execução</div>
                          <div className="text-gray-600">{stats.execucaoCount} processos</div>
                        </div>
                        <div>
                          <div className="font-medium">Média Eventos</div>
                          <div className="text-gray-600">{stats.mediaEventos.toFixed(1)}</div>
                        </div>
                        <div>
                          <div className="font-medium">Mais Antigo</div>
                          <div className="text-gray-600">{stats.processoMaisAntigo} dias</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

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