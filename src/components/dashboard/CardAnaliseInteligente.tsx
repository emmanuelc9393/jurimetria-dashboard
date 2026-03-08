// src/components/dashboard/CardAnaliseInteligente.tsx
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";

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

interface Insight {
  icon: string;
  texto: string;
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

function fmtPct(atual: number, ref: number): string {
  if (ref === 0) return '';
  const p = ((atual - ref) / ref) * 100;
  return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;
}

function exceedsPct(atual: number, ref: number, minPct: number): boolean {
  if (ref === 0) return false;
  return Math.abs((atual - ref) / ref) * 100 >= minPct;
}

// ─── Insight builder ──────────────────────────────────────────────────────────

function buildAllInsights(
  ult: Snapshot,
  med: Snapshot,
  ant: Snapshot | null,
): { alerts: Insight[]; positives: Insight[] } {
  const alerts: Insight[] = [];
  const positives: Insight[] = [];

  const push = (isAlert: boolean, icon: string, texto: string) =>
    (isAlert ? alerts : positives).push({ icon, texto });

  // 1. Conclusos vs média (higher = alert)
  if (exceedsPct(ult.conclusos, med.conclusos, 2)) {
    const p = fmtPct(ult.conclusos, med.conclusos);
    const diff = ult.conclusos - med.conclusos;
    push(diff > 0, diff > 0 ? '⚠️' : '✅',
      `Processos conclusos: ${ult.conclusos} (média histórica: ${med.conclusos}, ${p}) — ` +
      (diff > 0
        ? 'o gabinete está com mais processos aguardando decisão do que o habitual.'
        : 'carga abaixo da média — situação mais confortável que o habitual.')
    );
  }

  // 2. Tempo médio (mediaDias) — higher = alert
  if (exceedsPct(ult.mediaDias, med.mediaDias, 4)) {
    const p = fmtPct(ult.mediaDias, med.mediaDias);
    const diff = ult.mediaDias - med.mediaDias;
    push(diff > 0, diff > 0 ? '⏳' : '✅',
      `Tempo médio concluso: ${ult.mediaDias.toFixed(1)} dias (média: ${med.mediaDias.toFixed(1)} dias, ${p}) — ` +
      (diff > 0
        ? 'processos estão demorando mais para serem decididos.'
        : 'processos sendo decididos mais rapidamente que o histórico.')
    );
  }

  // 3. Execução — higher = alert
  if (exceedsPct(ult.execucao, med.execucao, 5)) {
    const p = fmtPct(ult.execucao, med.execucao);
    const diff = ult.execucao - med.execucao;
    push(diff > 0, diff > 0 ? '📈' : '📉',
      `Processos de execução: ${ult.execucao} (média: ${med.execucao}, ${p}) — ` +
      (diff > 0
        ? 'aumento nas demandas executivas — pode indicar crescimento de cumprimentos pendentes.'
        : 'redução de execuções conclusas em relação à média.')
    );
  }

  // 4. Conhecimento — higher = alert
  if (exceedsPct(ult.conhecimento, med.conhecimento, 5)) {
    const p = fmtPct(ult.conhecimento, med.conhecimento);
    const diff = ult.conhecimento - med.conhecimento;
    push(diff > 0, diff > 0 ? '📚' : '📉',
      `Processos de conhecimento: ${ult.conhecimento} (média: ${med.conhecimento}, ${p}) — ` +
      (diff > 0 ? 'aumento acima do habitual.' : 'redução em relação à média.')
    );
  }

  // 5. Faixa 91-120d — higher = alert (critical aging)
  if (exceedsPct(ult.dias91_120, med.dias91_120, 10)) {
    const diff = ult.dias91_120 - med.dias91_120;
    push(diff > 0, diff > 0 ? '🔴' : '🟢',
      `Processos na faixa 91-120 dias: ${ult.dias91_120} (média: ${med.dias91_120}) — ` +
      (diff > 0
        ? `sinal de envelhecimento do acervo — ${diff} processos a mais que a média nessa faixa crítica.`
        : `acervo mais jovem que o histórico — ${Math.abs(diff)} processos a menos nessa faixa.`)
    );
  }

  // 6. Faixa 61-90d — higher = alert
  if (exceedsPct(ult.dias61_90, med.dias61_90, 10)) {
    const diff = ult.dias61_90 - med.dias61_90;
    push(diff > 0, diff > 0 ? '⚠️' : '✅',
      `Faixa 61-90 dias: ${ult.dias61_90} (média: ${med.dias61_90}, ${fmtPct(ult.dias61_90, med.dias61_90)}) — ` +
      (diff > 0 ? 'aumento nessa faixa intermediária.' : 'redução favorável nessa faixa intermediária.')
    );
  }

  // 7. Faixa 31-60d — higher = alert
  if (exceedsPct(ult.dias31_60, med.dias31_60, 8)) {
    const diff = ult.dias31_60 - med.dias31_60;
    push(diff > 0, diff > 0 ? '⚠️' : '✅',
      `Faixa 31-60 dias: ${ult.dias31_60} (média: ${med.dias31_60}, ${fmtPct(ult.dias31_60, med.dias31_60)}) — ` +
      (diff > 0 ? 'mais processos em fase de atenção.' : 'menos processos nessa faixa — favorável.')
    );
  }

  // 8. Faixa 0-30d — higher = alert (more fresh conclusos = more incoming work)
  if (exceedsPct(ult.dias0_30, med.dias0_30, 5)) {
    const diff = ult.dias0_30 - med.dias0_30;
    push(diff > 0, diff > 0 ? '⚠️' : '✅',
      `Faixa 0-30 dias: ${ult.dias0_30} (média: ${med.dias0_30}, ${fmtPct(ult.dias0_30, med.dias0_30)}) — ` +
      (diff > 0
        ? 'volume acima da média de novos conclusos recentes.'
        : 'volume abaixo da média de novos conclusos recentes.')
    );
  }

  // 9. Complexidade (mediaEventos) — higher = alert
  if (exceedsPct(ult.mediaEventos, med.mediaEventos, 5)) {
    const p = fmtPct(ult.mediaEventos, med.mediaEventos);
    const diff = ult.mediaEventos - med.mediaEventos;
    push(diff > 0, diff > 0 ? '📑' : '📄',
      `Complexidade média: ${ult.mediaEventos.toFixed(1)} eventos/processo (média: ${med.mediaEventos.toFixed(1)}, ${p}) — ` +
      (diff > 0
        ? 'processos mais complexos que o histórico — podem exigir mais tempo por decisão.'
        : 'processos mais simples que o histórico — decisões tendem a ser mais ágeis.')
    );
  }

  // 10. Sentenças — lower = good (fewer awaiting sentence = better)
  if (exceedsPct(ult.sentenca, med.sentenca, 8)) {
    const p = fmtPct(ult.sentenca, med.sentenca);
    const diff = ult.sentenca - med.sentenca;
    push(diff > 0, diff > 0 ? '⚠️' : '✅',
      `Sentenças conclusas: ${ult.sentenca} (média: ${med.sentenca}, ${p}) — ` +
      (diff > 0
        ? 'mais processos aguardando prolação de sentença.'
        : 'menos processos aguardando sentença — queda favorável.')
    );
  }

  // 11. Despachos — lower = good
  if (exceedsPct(ult.despacho, med.despacho, 8)) {
    const p = fmtPct(ult.despacho, med.despacho);
    const diff = ult.despacho - med.despacho;
    push(diff > 0, diff > 0 ? '⚠️' : '✅',
      `Despachos conclusos: ${ult.despacho} (média: ${med.despacho}, ${p}) — ` +
      (diff > 0
        ? 'mais processos aguardando despacho.'
        : 'queda favorável nos processos aguardando despacho.')
    );
  }

  // 12. Decisões — lower = good
  if (exceedsPct(ult.decisao, med.decisao, 8)) {
    const p = fmtPct(ult.decisao, med.decisao);
    const diff = ult.decisao - med.decisao;
    push(diff > 0, diff > 0 ? '⚠️' : '✅',
      `Decisões conclusas: ${ult.decisao} (média: ${med.decisao}, ${p}) — ` +
      (diff > 0
        ? 'mais processos aguardando decisão interlocutória.'
        : 'queda favorável nos processos aguardando decisão.')
    );
  }

  // 13. Comparação com snapshot anterior
  if (ant) {
    const diff = ult.conclusos - ant.conclusos;
    if (diff !== 0) {
      const datAnt = ant.dataHora.split(' ')[0];
      push(diff > 0, diff < 0 ? '📉' : '📊',
        `Comparado ao snapshot anterior (${datAnt}): conclusos ` +
        (diff > 0
          ? `subiram em ${diff} processos (${ant.conclusos} → ${ult.conclusos}).`
          : `caíram em ${Math.abs(diff)} processos (${ant.conclusos} → ${ult.conclusos}).`)
      );
    }
  }

  return { alerts, positives };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CardAnaliseInteligente({ historicoRaw }: { historicoRaw: DataRow[] }) {
  const analysis = useMemo(() => {
    if (historicoRaw.length === 0) return null;

    const all = historicoRaw.map(toSnapshot);
    const media = all.find(s => s.isMediaHistorica) ?? null;
    const regulares = all.filter(s => !s.isMediaHistorica);
    regulares.sort((a, b) => parseDate(b.dataHora).getTime() - parseDate(a.dataHora).getTime());

    const ult = regulares[0] ?? null;
    const ant = regulares[1] ?? null;
    if (!ult || !media) return null;

    // Acervo trend: compare last snapshot vs previous one
    const deltaConc = ant ? ult.conclusos - ant.conclusos : null;

    const { alerts, positives } = buildAllInsights(ult, media, ant);

    return { ult, ant, media, alerts, positives, deltaConc, total: regulares.length };
  }, [historicoRaw]);

  if (!analysis) return null;

  const { ult, alerts, positives, deltaConc, total } = analysis;

  const trend = deltaConc === null
    ? null
    : deltaConc < 0
    ? { text: `acervo em queda (${deltaConc})`, color: 'text-green-600' }
    : deltaConc > 0
    ? { text: `acervo em alta (+${deltaConc})`, color: 'text-red-500' }
    : { text: 'acervo estável', color: 'text-gray-500' };

  return (
    <Card className="border border-blue-200 bg-white mb-4">
      <CardContent className="pt-3 pb-3">

        {/* Header */}
        <p className="text-sm text-gray-700 mb-1">
          <span className="font-semibold">🧠 {saudacao()}!</span>{' '}
          Conforme última atualização datada de <strong>{ult.dataHora}</strong>, aqui está a análise crítica do acervo
          {trend && (
            <> — <span className={`font-medium ${trend.color}`}>{trend.text}</span></>
          )}
          {'. '}
          <span className="text-gray-400 text-xs">{total} snapshots</span>
        </p>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0 mt-3">

          {/* Alerts column */}
          {alerts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1">⚠️ Atenção ({alerts.length})</p>
              <div className="space-y-1">
                {alerts.map((ins, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-gray-700 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
                    <span className="flex-shrink-0 mt-0.5">{ins.icon}</span>
                    <span>{ins.texto}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Positives column */}
          {positives.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-1">✅ Favoráveis ({positives.length})</p>
              <div className="space-y-1">
                {positives.map((ins, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-gray-700 bg-green-50 border border-green-100 rounded px-2 py-1.5">
                    <span className="flex-shrink-0 mt-0.5">{ins.icon}</span>
                    <span>{ins.texto}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {alerts.length === 0 && positives.length === 0 && (
          <p className="text-xs text-gray-400 mt-2">
            Importe o histórico de snapshots para ver a análise comparativa.
          </p>
        )}

      </CardContent>
    </Card>
  );
}
