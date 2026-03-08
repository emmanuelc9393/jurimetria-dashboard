// src/components/dashboard/TabComparativo.tsx
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

const GRUPOS: { label: string; cols: string[] }[] = [
  { label: 'Acervo',     cols: ['Acervo Início', 'Acervo Final'] },
  { label: 'Distribuição', cols: ['Conclusos Gab.', 'And. Cartório', 'Concl. +120', 'Concl. +365', 'And. Final'] },
  { label: 'Produção',   cols: ['Produção', '% Julg. Acervo', '% Julg. Entrada', '1ª Baixa CNJ'] },
  { label: 'Fluxo',      cols: ['Entradas Novos', 'Outras Entradas', 'Baixados Def.', 'Outras Baixas'] },
  { label: 'Índices',    cols: ['IAD (%)', 'Taxa Congest. (%)', 'Taxa Demanda', 'Taxa Redução'] },
];

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseComparativo(raw: string): { headers: string[]; rows: ComparativoRow[] } {
  const lines = raw.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split('\t').map(h => h.trim());
  const colHeaders = headers.slice(2); // skip Mês/Ano and Vara

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

    // A linha de destaque é identificada pelos arrows OU pelo nome da vara
    const hasArrows = Object.values(colunas).some(c => c.tendencia !== 'neutral');
    const isDestaque = hasArrows || vara.includes(VARA_DESTAQUE_FRAGMENT);

    return { mesAno, vara, isDestaque, colunas };
  });

  return { headers: colHeaders, rows };
}

// ─── Cell renderer ────────────────────────────────────────────────────────────

function CelulaValor({ celula, isDestaqueRow }: { celula: Celula; isDestaqueRow: boolean }) {
  if (!isDestaqueRow || celula.tendencia === 'neutral') {
    return <span className="text-gray-700">{celula.display}</span>;
  }
  return (
    <span className={`font-semibold ${celula.tendencia === 'up' ? 'text-green-600' : 'text-red-500'}`}>
      {celula.tendencia === 'up' ? '↑ ' : '↓ '}
      {celula.display}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TabComparativo({ rawData }: { rawData: string }) {
  const { rows, allCols } = useMemo(() => {
    const { rows } = parseComparativo(rawData);
    // Ordered columns following GRUPOS definition
    const ordered = GRUPOS.flatMap(g => g.cols);
    const allCols = ordered;
    return { rows, allCols };
  }, [rawData]);

  if (!rawData.trim() || rows.length === 0) {
    return (
      <Card>
        <CardContent className="pt-8 pb-8 text-center text-gray-500">
          <p className="text-sm">Nenhum dado de comparativo disponível.</p>
          <p className="text-xs mt-1">Cole e salve os dados na aba Gerenciamento e Entrada de Dados.</p>
        </CardContent>
      </Card>
    );
  }

  const destaque = rows.find(r => r.isDestaque);
  const periodo = rows[0]?.mesAno ?? '';

  return (
    <div className="space-y-6">

      {/* Header card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            🏛️ Comparativo Entre Unidades — {periodo}
          </CardTitle>
          <CardDescription>
            {destaque
              ? <>Unidade em destaque: <strong>{destaque.vara}</strong></>
              : 'Comparativo de indicadores das varas de família da Grande Florianópolis.'
            }
            {' '}Valores em <span className="text-green-600 font-medium">verde ↑</span> indicam
            resultado acima da média do grupo; em <span className="text-red-500 font-medium">vermelho ↓</span>, abaixo.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* KPI summary for destaque unit */}
      {destaque && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">📊 Resumo da Unidade em Destaque</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['Acervo Final', 'And. Final', 'Conclusos Gab.', 'Produção'] as const).map(col => {
                const cel = destaque.colunas[col];
                if (!cel) return null;
                return (
                  <div key={col} className={`p-3 rounded-lg border text-center ${
                    cel.tendencia === 'up' ? 'bg-green-50 border-green-200' :
                    cel.tendencia === 'down' ? 'bg-red-50 border-red-200' :
                    'bg-gray-50 border-gray-200'
                  }`}>
                    <div className={`text-xl font-bold ${
                      cel.tendencia === 'up' ? 'text-green-700' :
                      cel.tendencia === 'down' ? 'text-red-600' : 'text-gray-700'
                    }`}>
                      {cel.tendencia === 'up' ? '↑ ' : cel.tendencia === 'down' ? '↓ ' : ''}
                      {cel.display}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{col}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full comparison table — one card per group */}
      {GRUPOS.map(grupo => {
        const cols = grupo.cols.filter(c => allCols.includes(c));
        if (cols.length === 0) return null;
        return (
          <Card key={grupo.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{grupo.label}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[220px] sticky left-0 bg-gray-100">
                      Unidade
                    </th>
                    {cols.map(col => (
                      <th key={col} className="px-3 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b transition-colors ${
                        row.isDestaque
                          ? 'bg-blue-50 border-blue-200 font-medium'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className={`px-3 py-2 sticky left-0 ${
                        row.isDestaque ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
                      }`}>
                        <div className="flex items-center gap-2">
                          {row.isDestaque && (
                            <Badge variant="default" className="text-xs px-1 py-0 shrink-0">
                              ★
                            </Badge>
                          )}
                          <span className={`${row.isDestaque ? 'text-blue-800 font-semibold' : 'text-gray-700'} leading-tight`}>
                            {row.vara}
                          </span>
                        </div>
                      </td>
                      {cols.map(col => {
                        const cel = row.colunas[col] ?? { display: '—', tendencia: 'neutral' as Tendencia };
                        return (
                          <td key={col} className="px-3 py-2 text-right">
                            <CelulaValor celula={cel} isDestaqueRow={row.isDestaque} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
