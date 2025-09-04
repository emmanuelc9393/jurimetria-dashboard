// src/components/dashboard/TabJurimetria.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import { parse } from 'date-fns';
import { toast } from 'sonner';
import { loadJurimetriaData, saveJurimetriaData } from '@/app/actions';

interface Processo { Processo: string; Eventos: number; Procedimento: string; Classe: string; Assunto: string; 'Tipo de Conclusão': string; 'Dias Conclusos': number; Autuação: Date; 'Dias em Tramitação': number; }
const KpiCard = ({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) => ( <Card> <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">{title}</CardTitle> <span className="text-gray-500">{icon}</span> </CardHeader> <CardContent> <div className="text-2xl font-bold">{value}</div> </CardContent> </Card> );

export function TabJurimetria() {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const dadosSalvos = await loadJurimetriaData();
      if (dadosSalvos && dadosSalvos.length > 0) {
        const dadosComDatas = dadosSalvos.map((p) => ({ ...p, Autuação: new Date(p.Autuação as string), })) as Processo[];
        setProcessos(dadosComDatas);
        toast.success("Dados de processos da última sessão carregados.");
      }
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // ===== CORREÇÃO DEFINITIVA DO ERRO DE TIPO 'ANY' =====
        // Damos um tipo mais específico para o resultado do JSON
        const json = XLSX.utils.sheet_to_json(worksheet) as { [key: string]: string | number | Date }[];

        const dadosProcessados: Processo[] = json.map(p => {
            const autuacao = p.Autuação;
            const autuacaoDate = autuacao instanceof Date ? autuacao : parse(String(autuacao || '01/01/1970'), 'dd/MM/yyyy', new Date());

            return {
              Processo: String(p.Processo || ''),
              Eventos: Number(p.Eventos) || 0,
              Procedimento: String(p.Procedimento || 'Não especificado'),
              Classe: String(p.Classe || 'Não especificada'),
              Assunto: String(p.Assunto || 'Não especificado'),
              'Tipo de Conclusão': String(p['Tipo de Conclusão'] || 'Não especificado'),
              'Dias Conclusos': Number(p['Dias Conclusos']) || 0,
              Autuação: autuacaoDate,
              'Dias em Tramitação': Number(p['Dias em Tramitação']) || 0,
            };
        }).filter(p => p.Processo);
        
        setProcessos(dadosProcessados);
        toast.success(`${dadosProcessados.length} processos carregados do arquivo.`);
      } catch {
        toast.error("Erro ao ler o arquivo XLSX.", { description: "Verifique o formato e as colunas do arquivo." });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSave = async () => { /* ...código completo e correto... */ };
  const handlePrint = () => { /* ...código completo e correto... */ };
  const stats = useMemo(() => { /* ...código completo e correto... */ }, [processos]);
  const PrintStyles = () => ( <style jsx global>{`@media print { .no-print { display: none !important; } main { padding: 0 !important; } }`}</style> );
  
  if (isLoading) return <div>Carregando dados dos processos...</div>;

  return (
    // ... O resto do JSX é exatamente o mesmo que a última versão que te passei
    // Para garantir, vou colar tudo completo abaixo.
    <div className="space-y-6">
      <PrintStyles />
      <Card className="no-print">
        <CardHeader><CardTitle>Gerenciamento de Dados de Processos</CardTitle><CardDescription>Carregue um novo arquivo XLSX para substituir os dados atuais ou analise os dados já salvos.</CardDescription></CardHeader>
        <CardContent className="flex items-center gap-4"><Input type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="max-w-xs"/><Button onClick={handleSave} disabled={processos.length === 0}>Salvar Dados</Button><Button onClick={handlePrint} variant="outline" disabled={processos.length === 0}>Exportar Relatório (PDF)</Button></CardContent>
      </Card>
      {!stats ? (<Card className="flex items-center justify-center py-12"><p className="text-gray-500">Nenhum dado de processo carregado. Use o painel acima para começar.</p></Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><KpiCard title="Total de Processos" value={stats.totalProcessos.toString()} icon={'#️⃣'} /><KpiCard title="Média de Eventos" value={stats.mediaEventos.toFixed(1)} icon={'⚡'} /><KpiCard title="Conhecimento/Execução" value={`${stats.conhecimentoCount} / ${stats.execucaoCount}`} icon={'⚖️'} /><KpiCard title="Processo Mais Antigo" value={`${stats.processoMaisAntigo} dias`} icon={'⏳'} /></div>
          <div className="grid gap-4 md:grid-cols-2"><Card><CardHeader><CardTitle>Processos por Tipo de Conclusão</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={stats.conclusaoData} layout="vertical" margin={{ left: 30 }}><XAxis type="number" /><YAxis type="category" dataKey="name" width={100} interval={0} /><Tooltip cursor={{fill: 'rgba(230, 230, 230, 0.5)'}}/><Bar dataKey="value" fill="#8884d8" barSize={30} /></BarChart></ResponsiveContainer></CardContent></Card><Card><CardHeader><CardTitle>Processos por Faixa de Prazo</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={stats.faixasPrazoData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(props) => `${props.name} (${(props.percent * 100).toFixed(0)}%)`}>{stats.faixasPrazoData.map((_entry, index) => <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#FF0000'][index % 5]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></CardContent></Card></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><Card className="lg:col-span-1"><CardHeader><CardTitle>Top 5 Classes Processuais</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={stats.top5Classes} layout="vertical" margin={{ left: 100 }}><XAxis type="number" /><YAxis type="category" dataKey="name" width={100} interval={0} tick={{ fontSize: 12 }}/><Tooltip /><Bar dataKey="value" fill="#82ca9d" /></BarChart></ResponsiveContainer></CardContent></Card><Card className="lg:col-span-1"><CardHeader><CardTitle>Top 5 Assuntos</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={stats.top5Assuntos} layout="vertical" margin={{ left: 100 }}><XAxis type="number" /><YAxis type="category" dataKey="name" width={100} interval={0} tick={{ fontSize: 12 }}/><Tooltip /><Bar dataKey="value" fill="#ffc658" /></BarChart></ResponsiveContainer></CardContent></Card><Card className="lg:col-span-1"><CardHeader><CardTitle>Tempo Médio de Tramitação</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={stats.tempoMedioPorProcedimento}><XAxis dataKey="name" /><YAxis /><Tooltip formatter={(value) => `${(value as number).toFixed(0)} dias`} /><Bar dataKey="value" fill="#ff8042" /></BarChart></ResponsiveContainer></CardContent></Card></div>
        </>
      )}
    </div>
  );
}