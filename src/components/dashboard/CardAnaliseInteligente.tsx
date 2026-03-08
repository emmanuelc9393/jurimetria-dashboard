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

interface CompactInsight {
  icon: string;
  label: string;
  current: string;
  delta: string;
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

function deltaPct(atual: number, ref: number): number {
  if (ref === 0) return 0;
  return ((atual - ref) / ref) * 100;
}

function fmtPct(p: number): string {
  return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;
}

// ─── Metric definitions ───────────────────────────────────────────────────────

interface MetricDef {
  get: (s: Snapshot) => number;
  label: string;
  icon: string;
  /** true → lower than average is GREEN; false → higher than average is GREEN */
  goodWhenLower: boolean;
  /** minimum absolute % deviation to show the insight */
  minPct: number;
  fmt: (v: number) => string;
}

const METRIC_DEFS: MetricDef[] = [
  { get: s => s.mediaDias,    label: 'Tempo médio',   icon: '⏳', goodWhenLower: true,  minPct: 4,  fmt: v => `${v.toFixed(1)}d` },
  { get: s => s.dias91_120,   label: 'Faixa 91-120d', icon: '📆', goodWhenLower: true,  minPct: 10, fmt: v => `${v}` },
  { get: s => s.dias61_90,    label: 'Faixa 61-90d',  icon: '📆', goodWhenLower: true,  minPct: 10, fmt: v => `${v}` },
  { get: s => s.dias31_60,    label: 'Faixa 31-60d',  icon: '📆', goodWhenLower: true,  minPct: 8,  fmt: v => `${v}` },
  { get: s => s.dias0_30,     label: 'Faixa 0-30d',   icon: '📆', goodWhenLower: true,  minPct: 5,  fmt: v => `${v}` },
  { get: s => s.execucao,     label: 'Execuções',     icon: '⚡', goodWhenLower: false, minPct: 8,  fmt: v => `${v}` },
  { get: s => s.conclusos,    label: 'Conclusos',     icon: '📋', goodWhenLower: false, minPct: 3,  fmt: v => `${v}` },
  { get: s => s.mediaEventos, label: 'Complexidade',  icon: '📑', goodWhenLower: false, minPct: 5,  fmt: v => `${v.toFixed(1)}/proc` },
  { get: s => s.sentenca,     label: 'Sentenças',     icon: '⚖️', goodWhenLower: false, minPct: 8,  fmt: v => `${v}` },
];

function buildSplitInsights(
  ult: Snapshot,
  med: Snapshot,
): { alerts: CompactInsight[]; positives: CompactInsight[] } {
  const alerts: CompactInsight[] = [];
  const positives: CompactInsight[] = [];

  for (const def of METRIC_DEFS) {
    const actual = def.get(ult);
    const ref = def.get(med);
    if (ref === 0) continue;
    const p = deltaPct(actual, ref);
    if (Math.abs(p) < def.minPct) continue;

    const isGood = def.goodWhenLower ? p < 0 : p > 0;
    const insight: CompactInsight = {
      icon: def.icon,
      label: def.label,
      current: def.fmt(actual),
      delta: fmtPct(p),
    };
    if (isGood) positives.push(insight);
    else alerts.push(insight);
  }

  return { alerts, positives };
}

/** Determine acervo trend using the last N snapshots */
function acervoTrend(regulares: Snapshot[]): 'declining' | 'growing' | 'stable' {
  if (regulares.length < 3) return 'stable';
  const last = regulares[0].conclusos;
  const prevAvg = regulares.slice(1, 6).reduce((s, x) => s + x.conclusos, 0) /
    Math.min(5, regulares.length - 1);
  const p = deltaPct(last, prevAvg);
  if (p <= -3) return 'declining';
  if (p >= 3) return 'growing';
  return 'stable';
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
    if (!ult) return null;

    const trend = acervoTrend(regulares);
    const split = media ? buildSplitInsights(ult, media) : { alerts: [], positives: [] };

    // Conclusos vs previous snapshot
    const deltaVsAnterior = ant ? ult.conclusos - ant.conclusos : null;

    return { ult, ant, media, trend, split, deltaVsAnterior, total: regulares.length };
  }, [historicoRaw]);

  if (!analysis) return null;

  const { ult, ant, trend, split, deltaVsAnterior, total } = analysis;

  const trendLabel = trend === 'declining'
    ? { text: 'conclusos em queda', color: 'text-green-600', icon: '↓' }
    : trend === 'growing'
    ? { text: 'conclusos em alta', color: 'text-red-500', icon: '↑' }
    : { text: 'conclusos estável', color: 'text-gray-500', icon: '→' };

  const dataShort = ult.dataHora.split(' ')[0];

  return (
    <Card className="border border-blue-200 bg-white mb-4">
      <CardContent className="pt-3 pb-3">

        {/* Header row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
          <span className="font-semibold text-sm text-gray-800">🧠 {saudacao()} · {dataShort}</span>
          <span className={`text-xs font-medium ${trendLabel.color}`}>
            {trendLabel.icon} Acervo: {trendLabel.text}
          </span>
          {deltaVsAnterior !== null && deltaVsAnterior !== 0 && ant && (
            <span className={`text-xs ${deltaVsAnterior < 0 ? 'text-green-600' : 'text-red-500'}`}>
              {deltaVsAnterior < 0 ? '↓' : '↑'} {Math.abs(deltaVsAnterior)} vs {ant.dataHora.split(' ')[0]}
            </span>
          )}
          <span className="text-xs text-gray-400 ml-auto">{total} snapshots</span>
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">

          {/* Alerts column */}
          <div>
            {split.alerts.length > 0 && (
              <>
                <p className="text-xs font-semibold text-amber-700 mb-1">
                  ⚠️ Atenção ({split.alerts.length})
                </p>
                <div className="space-y-1">
                  {split.alerts.map((ins, i) => (
                    <div key={i} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded px-2 py-1 text-xs">
                      <span>{ins.icon}</span>
                      <span className="text-gray-700 flex-1">{ins.label}</span>
                      <span className="font-medium text-gray-800">{ins.current}</span>
                      <span className="text-amber-700 font-semibold">{ins.delta}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Positives column */}
          <div>
            {split.positives.length > 0 && (
              <>
                <p className="text-xs font-semibold text-green-700 mb-1">
                  ✅ Favoráveis ({split.positives.length})
                </p>
                <div className="space-y-1">
                  {split.positives.map((ins, i) => (
                    <div key={i} className="flex items-center gap-2 bg-green-50 border border-green-200 rounded px-2 py-1 text-xs">
                      <span>{ins.icon}</span>
                      <span className="text-gray-700 flex-1">{ins.label}</span>
                      <span className="font-medium text-gray-800">{ins.current}</span>
                      <span className="text-green-700 font-semibold">{ins.delta}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

        </div>

        {split.alerts.length === 0 && split.positives.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">
            Importe o histórico de snapshots para ver a análise comparativa.
          </p>
        )}

      </CardContent>
    </Card>
  );
}
