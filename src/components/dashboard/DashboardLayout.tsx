// src/components/dashboard/DashboardLayout.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabRelatorioPadrao } from './TabRelatorioPadrao';
import { TabJurimetria } from './TabJurimetria';
import { TabGerenciamento } from './TabGerenciamento';
import { TabComparativo } from './TabComparativo';
import { CardAnaliseInteligente } from './CardAnaliseInteligente';
import { getUpdateInfo, loadHistoricoData, loadComparativoData } from '@/app/actions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function DashboardLayout() {
  const [updateInfo, setUpdateInfo] = useState<string>('Carregando informações...');
  const [refreshKey, setRefreshKey] = useState(0);
  const [historicoRaw, setHistoricoRaw] = useState<{ [key: string]: string | number | undefined }[]>([]);
  const [comparativoRaw, setComparativoRaw] = useState<string>('');

  const fetchUpdateInfo = async () => {
    const { timestamp, periodo } = await getUpdateInfo();
    if (timestamp) {
      const date = new Date(timestamp);
      const formattedDate = format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      const periodoInfo = periodo ? ` | Período: ${periodo}` : '';
      setUpdateInfo(`Dashboard atualizado em: ${formattedDate}${periodoInfo}`);
    } else {
      setUpdateInfo('Nenhum dado foi salvo ainda.');
    }
  };

  const refreshData = () => {
    fetchUpdateInfo();
    loadHistoricoData().then(data => setHistoricoRaw(data as { [key: string]: string | number | undefined }[]));
    loadComparativoData().then(data => setComparativoRaw(data));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refreshData(); }, []);

  const handleDataSaved = () => {
    setRefreshKey(k => k + 1);
    refreshData();
  };

  return (
    <div className="bg-gray-50 min-h-screen p-8">
<header className="mb-8">
<h1 className="text-3xl font-bold text-gray-800 text-center">Relatório Jurimétrico</h1>
    <h2 className="text-lg font-medium text-gray-600 text-center">2ª Vara da Família e Órfãos da Comarca da Capital - Fórum Eduardo Luz - Florianópolis/SC</h2>
    <p className="text-sm text-gray-500 text-center">Criado por Emmanuel Araújo da Costa - v. 1.19</p>
    <p className="text-sm text-gray-500 mt-2 text-">{updateInfo}</p>
</header>

      <CardAnaliseInteligente historicoRaw={historicoRaw} />

      <Tabs defaultValue="relatorio-padrao" className="w-full">
        <TabsList>
          <TabsTrigger value="relatorio-padrao">📄 Relatório Padrão</TabsTrigger>
          <TabsTrigger value="jurimetria">📊 Análise de Processos Conclusos</TabsTrigger>
          <TabsTrigger value="comparativo">🏛️ Comparativo Entre Unidades</TabsTrigger>
          <TabsTrigger value="gerenciamento">🗂️ Gerenciamento e Entrada de Dados</TabsTrigger>
        </TabsList>

        <TabsContent value="relatorio-padrao" className="mt-4">
          <TabRelatorioPadrao refreshKey={refreshKey} />
        </TabsContent>

        <TabsContent value="jurimetria" className="mt-4 print-break-before">
          <TabJurimetria refreshKey={refreshKey} />
        </TabsContent>

        <TabsContent value="comparativo" className="mt-4">
          <TabComparativo rawData={comparativoRaw} />
        </TabsContent>

        <TabsContent value="gerenciamento" className="mt-4 print-hide">
          <TabGerenciamento onDataSaved={handleDataSaved} />
        </TabsContent>
      </Tabs>
    </div>
  );
}