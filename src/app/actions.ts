// src/app/actions.ts
'use server';

import { kv } from '@vercel/kv';

// Criamos um tipo para nossos dados para evitar o uso de 'any'
type DataRow = { [key: string]: string | number };

const updateTimestamp = async () => {
  await kv.set('last-updated', new Date().toISOString());
};

export async function loginAction(password: string) {
  const correctPassword = process.env.APP_PASSWORD;
  return password === correctPassword;
}

// --- AÇÕES PARA RELATÓRIO PADRÃO ---
export async function saveRelatorioData(data: DataRow[]) { // Usando nosso tipo
  try {
    await kv.set('relatorio-padrao-data', data);
    await updateTimestamp();
    return { success: true };
  } catch {
    return { success: false, error: "Falha ao salvar no KV." };
  }
}

export async function loadRelatorioData(): Promise<DataRow[]> { // Especificando o retorno
  try {
    const data = await kv.get('relatorio-padrao-data');
    return (data as DataRow[]) || [];
  } catch { return []; }
}

// --- AÇÕES PARA JURIMETRIA (ANÁLISE DE PROCESSOS) ---
export async function saveJurimetriaData(data: DataRow[]) { // Usando nosso tipo
  try {
    await kv.set('jurimetria-data', data);
    await updateTimestamp();
    return { success: true };
  } catch {
    return { success: false, error: "Falha ao salvar no KV." };
  }
}

export async function loadJurimetriaData(): Promise<DataRow[]> { // Especificando o retorno
  try {
    const data = await kv.get('jurimetria-data');
    return (data as DataRow[]) || [];
  } catch { return []; }
}

export async function getUpdateInfo() {
  try {
    const timestamp = await kv.get('last-updated') as string | null;
    const relatorioData = await kv.get('relatorio-padrao-data') as DataRow[] | null;
    let periodo = null;
    if (relatorioData && relatorioData.length > 0) {
      const primeiroMes = relatorioData[0]['Mês/Ano'];
      const ultimoMes = relatorioData[relatorioData.length - 1]['Mês/Ano'];
      periodo = `${primeiroMes} - ${ultimoMes}`;
    }
    return { timestamp, periodo };
  } catch { return { timestamp: null, periodo: null }; }
}