// src/components/dashboard/TabComparativo.tsx
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tendencia = 'up' | 'down' | 'neutral';

interface Celula {
  display: string;
  tendencia: Tendencia;
}

interface ComparativoRow {
  mesAno: string;
  vara: string;
  isDestaque: boolean;
  colunas: Record<string, Celula>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VARA_DESTAQUE_FRAGMENT = '2ª Vara da Família e Órfãos da Comarca da Capital';

const COL_ORDER = [
  'Acervo Início', 'Acervo Final',
  'Conclusos Gab.', 'And. Cartório', 'Concl. +120', 'Concl. +365', 'And. Final',
  'Produção', '% Julg. Acervo', '% Julg. Entrada', '1ª Baixa CNJ',
  'Entradas Novos', 'Outras Entradas', 'Baixados Def.', 'Outras Baixas',
  'IAD (%)', 'Taxa Congest. (%)', 'Taxa Demanda', 'Taxa Redução',
];

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseComparativo(raw: string): { colHeaders: string[]; rows: ComparativoRow[] } {
  const lines = raw.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return { colHeaders: [], rows: [] };

  const headerCells = lines[0].split('\t').map(h => h.trim());
  const colHeaders = headerCells.slice(2);

  const rows: ComparativoRow[] = lines.slice(1).map(line => {
    const cells = line.split('\t').map(c => c.trim());
    const mesAno = cells[0] ?? '';
    const vara = cells[1] ?? '';

    const colunas: Record<string, Celula> = {};
    colHeaders.forEach((col, i) => {
      const raw = cells[i + 2] ?? '';
      let tendencia: Tendencia = 'neutral';
      let display = raw;
      if (raw.startsWith('↑')) { tendencia = 'up';   display = raw.replace(/^↑\s*/, ''); }
      else if (raw.startsWith('↓')) { tendencia = 'down'; display = raw.replace(/^↓\s*/, ''); }
      colunas[col] = { display, tendencia };
    });

    const hasArrows = Object.values(colunas).some(c => c.tendencia !== 'neutral');
    const isDestaque = hasArrows || vara.includes(VARA_DESTAQUE_FRAGMENT);
    return { mesAno, vara, isDestaque, colunas };
  });

  return { colHeaders, rows };
}

// ─── Average row computation ──────────────────────────────────────────────────

function computeAverage(rows: ComparativoRow[], colHeaders: string[]): Record<string, string> {
  const avg: Record<string, string> = {};
  for (const col of colHeaders) {
    const nums: number[] = rows
      .map(r => parseFloat((r.colunas[col]?.display ?? '').replace('%', '').replace(',', '.')))
      .filter(n => !isNaN(n));

    if (nums.length === 0) { avg[col] = '—'; continue; }
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    const sample = rows.find(r => r.colunas[col]?.display)?.colunas[col]?.display ?? '';
    const isPercent = sample.includes('%');
    const hasDecimal = !isPercent && sample.includes('.');
    avg[col] = isPercent ? mean.toFixed(1) + '%' : hasDecimal ? mean.toFixed(1) : Math.round(mean).toString();
  }
  return avg;
}

// ─── Cell ─────────────────────────────────────────────────────────────────────

function Cel({ celula, isDestaqueRow }: { celula: Celula; isDestaqueRow: boolean }) {
  if (!isDestaqueRow || celula.tendencia === 'neutral') {
    return <span>{celula.display || '—'}</span>;
  }
  return (
    <span className={`font-bold ${celula.tendencia === 'up' ? 'text-green-600' : 'text-red-500'}`}>
      {celula.tendencia === 'up' ? '↑' : '↓'}{celula.display}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TabComparativo({ rawData }: { rawData: string }) {
  const { rows, colHeaders, avgRow, periodo } = useMemo(() => {
    const { colHeaders, rows } = parseComparativo(rawData);
    const displayCols = COL_ORDER.filter(c => colHeaders.includes(c));
    // also include any cols from data not in COL_ORDER
    const extraCols = colHeaders.filter(c => !COL_ORDER.includes(c));
    const allDisplayCols = [...displayCols, ...extraCols];
    const avgRow = computeAverage(rows, allDisplayCols);
    const periodo = rows[0]?.mesAno ?? '';
    return { rows, colHeaders: allDisplayCols, avgRow, periodo };
  }, [rawData]);

  if (!rawData.trim() || rows.length === 0) {
    return (
      <Card>
        <CardContent className="pt-10 pb-10 text-center text-gray-500 space-y-1">
          <p className="text-sm font-medium">Nenhum dado de comparativo disponível.</p>
          <p className="text-xs">Cole e salve os dados na aba Gerenciamento e Entrada de Dados.</p>
        </CardContent>
      </Card>
    );
  }

  const destaque = rows.find(r => r.isDestaque);

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">
            🏛️ Comparativo Entre Unidades — {periodo}
          </h2>
          {destaque && (
            <p className="text-xs text-gray-500 mt-0.5">
              Unidade em destaque:{' '}
              <span className="font-medium text-yellow-700">{destaque.vara}</span>
              {' '}·{' '}
              <span className="text-green-600 font-medium">↑ acima da média do grupo</span>
              {' | '}
              <span className="text-red-500 font-medium">↓ abaixo da média do grupo</span>
            </p>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">

            {/* Header */}
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-2 py-2 text-center font-semibold w-6 sticky left-0 bg-slate-800 z-20">#</th>
                <th className="px-2 py-2 text-center font-semibold whitespace-nowrap sticky left-6 bg-slate-800 z-20 min-w-[70px]">Mês/Ano</th>
                <th className="px-3 py-2 text-left font-semibold min-w-[200px] max-w-[280px]">Vara</th>
                {colHeaders.map(col => (
                  <th key={col} className="px-2 py-2 text-right font-semibold whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* Σ Average row */}
              <tr className="bg-amber-100 border-b-2 border-amber-400 font-semibold">
                <td className="px-2 py-2 text-center text-amber-800 font-bold sticky left-0 bg-amber-100 z-10">Σ</td>
                <td className="px-2 py-2 text-center text-amber-800 whitespace-nowrap sticky left-6 bg-amber-100 z-10">MÉDIA</td>
                <td className="px-3 py-2 text-amber-900 font-bold">TODAS</td>
                {colHeaders.map(col => (
                  <td key={col} className="px-2 py-2 text-right text-amber-900">
                    {avgRow[col] ?? '—'}
                  </td>
                ))}
              </tr>

              {/* Data rows */}
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b transition-colors ${
                    row.isDestaque
                      ? 'bg-yellow-50 border-yellow-300'
                      : i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <td className={`px-2 py-2 text-center font-medium sticky left-0 z-10 ${
                    row.isDestaque ? 'bg-yellow-50 text-yellow-800' : i % 2 === 0 ? 'bg-white text-gray-500' : 'bg-gray-50 text-gray-500'
                  }`}>
                    {i + 1}
                  </td>
                  <td className={`px-2 py-2 text-center whitespace-nowrap sticky left-6 z-10 ${
                    row.isDestaque ? 'bg-yellow-50 text-yellow-800 font-semibold' : i % 2 === 0 ? 'bg-white text-gray-600' : 'bg-gray-50 text-gray-600'
                  }`}>
                    {row.mesAno}
                  </td>
                  <td className={`px-3 py-2 ${
                    row.isDestaque ? 'text-yellow-900 font-bold' : 'text-gray-700'
                  }`}>
                    {row.vara}
                  </td>
                  {colHeaders.map(col => {
                    const cel = row.colunas[col] ?? { display: '—', tendencia: 'neutral' as Tendencia };
                    return (
                      <td key={col} className="px-2 py-2 text-right">
                        <Cel celula={cel} isDestaqueRow={row.isDestaque} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        * Linha Σ calculada como média aritmética de todas as unidades listadas.
      </p>
    </div>
  );
}
