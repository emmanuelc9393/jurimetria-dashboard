// src/components/dashboard/DashboardLayout.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabRelatorioPadrao } from './TabRelatorioPadrao';
import { TabJurimetria } from './TabJurimetria';
import { getUpdateInfo } from '@/app/actions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function DashboardLayout() {
  const [updateInfo, setUpdateInfo] = useState<string>('Carregando informações...');

  useEffect(() => {
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
    fetchUpdateInfo();
  }, []);

  return (
    <div className="bg-gray-50 min-h-screen p-8">
<header className="mb-8">
<h1 className="text-3xl font-bold text-gray-800 text-center">Relatório Jurimétrico</h1>
    <h2 className="text-lg font-medium text-gray-600 text-center">2ª Vara da Família e Órfãos da Comarca da Capital - Fórum Eduardo Luz - Florianópolis/SC</h2>
    <p className="text-sm text-gray-500 text-center">Criado por Emmanuel Araújo da Costa - v. 1.19</p>
    <p className="text-sm text-gray-500 mt-2 text-">{updateInfo}</p>
</header>
      
      <Tabs defaultValue="relatorio-padrao" className="w-full">
        <TabsList>
          <TabsTrigger value="relatorio-padrao">📄 Relatório Padrão</TabsTrigger>
          <TabsTrigger value="jurimetria">📊 Análise de Processos</TabsTrigger>
        </TabsList>
        
        <TabsContent value="relatorio-padrao" className="mt-4">
          <TabRelatorioPadrao />
        </TabsContent>
        
        <TabsContent value="jurimetria" className="mt-4">
          <TabJurimetria />
        </TabsContent>
      </Tabs>
    </div>
  );
}