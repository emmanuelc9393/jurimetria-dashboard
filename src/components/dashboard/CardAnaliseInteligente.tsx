// src/components/dashboard/CardAnaliseInteligente.tsx
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────

type DataRow = { [key: string]: string | number | undefined };

interface Snapshot {
  dataHora: string;
  isMediaHistorica: boolean;
  conclusos: number;
  mediaDias: number;
  mediaEventos: number;
  decisao: number;
  despacho: number;
  sentenca: number;
  conhecimento: number;
  execucao: number;
  outros: number;
  dias0_30: number;
  dias31_60: number;
  dias61_90: number;
  dias91_120: number;
  eventos0_20: number;
  eventos21_50: number;
  eventos51_100: number;
  eventos101_200: number;
  eventos201plus: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSnapshot(row: DataRow): Snapshot {
  return {
    dataHora: String(row.dataHora ?? ''),
    isMediaHistorica: Number(row.isMediaHistorica) === 1,
    conclusos: Number(row.conclusos) || 0,
    mediaDias: Number(row.mediaDias) || 0,
    mediaEventos: Number(row.mediaEventos) || 0,
    decisao: Number(row.decisao) || 0,
    despacho: Number(row.despacho) || 0,
    sentenca: Number(row.sentenca) || 0,
    conhecimento: Number(row.conhecimento) || 0,
    execucao: Number(row.execucao) || 0,
    outros: Number(row.outros) || 0,
    dias0_30: Number(row.dias0_30) || 0,
    dias31_60: Number(row.dias31_60) || 0,
    dias61_90: Number(row.dias61_90) || 0,
    dias91_120: Number(row.dias91_120) || 0,
    eventos0_20: Number(row.eventos0_20) || 0,
    eventos21_50: Number(row.eventos21_50) || 0,
    eventos51_100: Number(row.eventos51_100) || 0,
    eventos101_200: Number(row.eventos101_200) || 0,
    eventos201plus: Number(row.eventos201plus) || 0,
  };
}

/** Parse "DD/MM/YYYY HH:mm:ss" → Date */
function parseDate(dh: string): Date {
  const [datePart, timePart] = dh.split(' ');
  if (!datePart) return new Date(0);
  const [d, m, y] = datePart.split('/');
  return new Date(`${y}-${m}-${d}T${timePart ?? '00:00:00'}`);
}

function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Returns +/- % as a formatted string, or "" if referencia is 0 */
function pct(atual: number, ref: number): string {
  if (ref === 0) return '';
  const p = ((atual - ref) / ref) * 100;
  return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;
}

function absDiff(a: number, b: number): number {
  return Math.abs(a - b);
}

// ─── Insight builders ─────────────────────────────────────────────────────────

interface Insight {
  icon: string;
  texto: string;
  variant: 'alert' | 'good' | 'info';
}

function buildInsights(ult: Snapshot, med: Snapshot | null, ant: Snapshot | null): Insight[] {
  const insights: Insight[] = [];

  if (!med) return insights;

  // 1. Conclusos vs média
  {
    const diff = ult.conclusos - med.conclusos;
    const p = pct(ult.conclusos, med.conclusos);
    insights.push({
      icon: diff > 0 ? '⚠️' : '✅',
      texto: `Processos conclusos: ${ult.conclusos} (média histórica: ${med.conclusos}). ` +
        `${diff > 0
          ? `Carga ${p} acima da média — o gabinete está com mais processos aguardando decisão do que o habitual.`
          : diff < 0
            ? `Carga ${p} abaixo da média — situação mais confortável que o habitual.`
            : 'Carga igual à média histórica.'}`,
      variant: diff > 0 ? 'alert' : 'good',
    });
  }

  // 2. Média de dias conclusos (tempo de espera — maior = pior)
  {
    const diff = ult.mediaDias - med.mediaDias;
    const p = pct(ult.mediaDias, med.mediaDias);
    insights.push({
      icon: diff > 0 ? '⏳' : '✅',
      texto: `Tempo médio concluso: ${ult.mediaDias.toFixed(1)} dias (média: ${med.mediaDias.toFixed(1)} dias, ${p}). ` +
        `${diff > 0
          ? 'Processos estão demorando mais para serem decididos — envelhecimento em curso.'
          : diff < 0
            ? 'Processos sendo decididos mais rapidamente que o histórico — boa produtividade.'
            : 'Tempo médio estável em relação à média histórica.'}`,
      variant: diff > 1 ? 'alert' : diff < -1 ? 'good' : 'info',
    });
  }

  // 3. Execução vs média
  {
    const diff = ult.execucao - med.execucao;
    if (absDiff(ult.execucao, med.execucao) > 0) {
      const p = pct(ult.execucao, med.execucao);
      insights.push({
        icon: diff > 0 ? '📈' : '📉',
        texto: `Processos de execução: ${ult.execucao} (média: ${med.execucao}, ${p}). ` +
          `${diff > 0
            ? 'Aumento nas demandas executivas — pode indicar crescimento de cumprimentos de sentença pendentes.'
            : 'Redução de execuções conclusas em relação à média.'}`,
        variant: diff > 10 ? 'alert' : 'info',
      });
    }
  }

  // 4. Envelhecimento: faixa 91-120 dias
  {
    const diff = ult.dias91_120 - med.dias91_120;
    if (absDiff(ult.dias91_120, med.dias91_120) > 0) {
      insights.push({
        icon: diff > 0 ? '🔴' : '🟢',
        texto: `Processos na faixa 91-120 dias: ${ult.dias91_120} (média: ${med.dias91_120}). ` +
          `${diff > 0
            ? `Sinal de envelhecimento do acervo — ${diff} processos a mais que a média nessa faixa crítica.`
            : `Acervo mais jovem que o histórico — ${Math.abs(diff)} processos a menos nessa faixa.`}`,
        variant: diff > 5 ? 'alert' : diff < -5 ? 'good' : 'info',
      });
    }
  }

  // 5. Média de eventos (complexidade)
  {
    const diff = ult.mediaEventos - med.mediaEventos;
    const p = pct(ult.mediaEventos, med.mediaEventos);
    if (Math.abs(diff) > 2) {
      insights.push({
        icon: diff > 0 ? '📑' : '📄',
        texto: `Complexidade média: ${ult.mediaEventos.toFixed(1)} eventos/processo (média: ${med.mediaEventos.toFixed(1)}, ${p}). ` +
          `${diff > 0
            ? 'Processos atuais são mais complexos que o histórico — podem exigir mais tempo por decisão.'
            : 'Processos mais simples que o histórico — decisões tendem a ser mais ágeis.'}`,
        variant: 'info',
      });
    }
  }

  // 6. Tipos de conclusão — predominância
  {
    const total = ult.decisao + ult.despacho + ult.sentenca;
    if (total > 0) {
      const pctSent = ((ult.sentenca / total) * 100).toFixed(1);
      const pctDecisao = ((ult.decisao / total) * 100).toFixed(1);
      const medPctSent = med.sentenca + med.decisao + med.despacho > 0
        ? ((med.sentenca / (med.sentenca + med.decisao + med.despacho)) * 100).toFixed(1)
        : '0';
      insights.push({
        icon: '⚖️',
        texto: `Composição dos conclusos: ${ult.decisao} decisões (${pctDecisao}%), ${ult.despacho} despachos, ${ult.sentenca} sentenças (${pctSent}%). ` +
          `Sentença representa ${pctSent}% vs média histórica de ${medPctSent}% — ` +
          `${Number(pctSent) > Number(medPctSent) ? 'maior resolução de mérito que o habitual.' : 'predominância de despachos/decisões interlocutórias.'}`,
        variant: 'info',
      });
    }
  }

  // 7. Comparação com snapshot anterior
  if (ant) {
    const diffConc = ult.conclusos - ant.conclusos;
    if (diffConc !== 0) {
      const datAnt = ant.dataHora.split(' ')[0];
      insights.push({
        icon: diffConc > 0 ? '📊' : '📉',
        texto: `Comparado ao snapshot anterior (${datAnt}): conclusos ${diffConc > 0 ? `subiram em ${diffConc}` : `caíram em ${Math.abs(diffConc)}`} processos ` +
          `(${ant.conclusos} → ${ult.conclusos}).`,
        variant: 'info',
      });
    }
  }

  return insights;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CardAnaliseInteligente({ historicoRaw }: { historicoRaw: DataRow[] }) {
  const { mediaHistorica, ultimoSnapshot, snapshotAnterior, totalSnapshots } = useMemo(() => {
    if (historicoRaw.length === 0) {
      return { mediaHistorica: null, ultimoSnapshot: null, snapshotAnterior: null, totalSnapshots: 0 };
    }

    const all = historicoRaw.map(toSnapshot);
    const media = all.find(s => s.isMediaHistorica) ?? null;
    const regulares = all.filter(s => !s.isMediaHistorica);

    // Sort descending by date (most recent first)
    regulares.sort((a, b) => parseDate(b.dataHora).getTime() - parseDate(a.dataHora).getTime());

    return {
      mediaHistorica: media,
      ultimoSnapshot: regulares[0] ?? null,
      snapshotAnterior: regulares[1] ?? null,
      totalSnapshots: regulares.length,
    };
  }, [historicoRaw]);

  if (!ultimoSnapshot) return null;

  const insights = buildInsights(ultimoSnapshot, mediaHistorica, snapshotAnterior);
  const dataFormatada = ultimoSnapshot.dataHora;

  const variantClasses: Record<string, string> = {
    alert: 'bg-amber-50 border-amber-200',
    good: 'bg-green-50 border-green-200',
    info: 'bg-white border-gray-100',
  };

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          🧠 Análise Inteligente do Acervo
        </CardTitle>
        <p className="text-sm text-gray-600">
          {saudacao()}! Conforme última atualização datada de{' '}
          <strong>{dataFormatada}</strong>, aqui está a análise crítica do acervo:
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {insights.map((ins, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 p-3 rounded-lg text-sm border ${variantClasses[ins.variant]}`}
            >
              <span className="text-base flex-shrink-0">{ins.icon}</span>
              <p className="text-gray-700">{ins.texto}</p>
            </div>
          ))}
          {insights.length === 0 && (
            <p className="text-sm text-gray-500">
              Dados insuficientes para gerar análise. Importe o histórico de snapshots na aba
              &quot;Gerenciamento e Entrada de Dados&quot;.
            </p>
          )}
        </div>
        {mediaHistorica && (
          <p className="text-xs text-gray-400 mt-4">
            * Comparações baseadas na média histórica calculada sobre {totalSnapshots} snapshots registrados.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
