// src/app/actions.ts
'use server';

import { kv } from '@vercel/kv';

// Função auxiliar para atualizar o timestamp sempre que algo for salvo
const updateTimestamp = async () => {
  await kv.set('last-updated', new Date().toISOString());
};

// --- AÇÃO DE LOGIN ---
export async function loginAction(password: string) {
  const correctPassword = process.env.APP_PASSWORD;
  return password === correctPassword;
}

// --- AÇÕES PARA RELATÓRIO PADRÃO ---
export async function saveRelatorioData(data: any[]) {
  try {
    await kv.set('relatorio-padrao-data', data);
    await updateTimestamp();
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function loadRelatorioData() {
  try {
    const data = await kv.get('relatorio-padrao-data');
    return data || [];
  } catch (error) { return []; }
}

// --- AÇÕES PARA JURIMETRIA (ANÁLISE DE PROCESSOS) ---
export async function saveJurimetriaData(data: any[]) {
  try {
    await kv.set('jurimetria-data', data);
    await updateTimestamp();
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function loadJurimetriaData() {
  try {
    const data = await kv.get('jurimetria-data');
    return data || [];
  } catch (error) { return []; }
}

// --- AÇÃO PARA OBTER A ÚLTIMA ATUALIZAÇÃO E PERÍODO ---
export async function getUpdateInfo() {
  try {
    const timestamp = await kv.get('last-updated') as string | null;
    const relatorioData = await kv.get('relatorio-padrao-data') as any[] | null;
    
    let periodo = null;
    if (relatorioData && relatorioData.length > 0) {
      const primeiroMes = relatorioData[0]['Mês/Ano'];
      const ultimoMes = relatorioData[relatorioData.length - 1]['Mês/Ano'];
      periodo = `${primeiroMes} - ${ultimoMes}`;
    }

    return { timestamp, periodo };
  } catch { return { timestamp: null, periodo: null }; }
}