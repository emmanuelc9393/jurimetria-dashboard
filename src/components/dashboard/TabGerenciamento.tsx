// src/components/dashboard/TabGerenciamento.tsx
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { loginAction, saveRelatorioData, saveJurimetriaData, saveHistoricoData } from '@/app/actions';
import { Lock } from 'lucide-react';

// ─── Constants (shared with TabRelatorioPadrao) ───────────────────────────────

const COLUNAS_ESPERADAS = [
  'ID', 'Data/Hora', 'Vara', 'Período',
  'Acervo Início', 'Acervo Final', 'Conclusos Gab.', 'And. Cartório', 'Concl. +120',
  'Concl. +365', 'And. Final', 'Produção', '% Julg. Acervo', '% Julg. Entrada',
  '1ª Baixa CNJ', 'Entradas Novos', 'Outras Entradas', 'Baixados Def.', 'Outras Baixas',
  'IAD', 'Taxa Congest.', 'Taxa Demanda', 'Taxa Redução', 'Status'
];

const COLUNAS_NUMERICAS_ESPERADAS = [
  'Acervo Início', 'Acervo Final', 'Conclusos Gab.', 'And. Cartório', 'Concl. +120',
  'Concl. +365', 'And. Final', 'Produção', '% Julg. Acervo', '% Julg. Entrada',
  '1ª Baixa CNJ', 'Entradas Novos', 'Outras Entradas', 'Baixados Def.', 'Outras Baixas',
  'IAD', 'Taxa Congest.', 'Taxa Demanda', 'Taxa Redução'
];

const COLUNAS_OCULTAS_PADRAO = ['ID', 'Data/Hora', 'Vara', 'Status'];

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DadosLinha {
  'Período': string;
  Data: Date;
  [key: string]: string | number | Date;
}

interface Processo {
  Processo: string;
  Eventos: number;
  Procedimento: string;
  Classe: string;
  Assunto: string;
  'Tipo de Conclusão': string;
  'Dias Conclusos': number;
  'Dias em Tramitação': number;
  Autuação: string;
  Assessor: string;
  'Fase Processual': string;
  [key: string]: string | number | undefined;
}

interface HistoricoSnapshot {
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


// ─── Main Component ────────────────────────────────────────────────────────────

export function TabGerenciamento({ onDataSaved }: { onDataSaved: () => void }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // ── Relatorio Padrao state ──
  const [dados, setDados] = useState<DadosLinha[]>([]);
  const [pastedData, setPastedData] = useState('');
  const [colunasOcultas] = useState<string[]>(COLUNAS_OCULTAS_PADRAO);

  // ── Jurimetria state ──
  const [processos, setProcessos] = useState<Processo[]>([]);

  // ── Histórico state ──
  const [historicoPastedData, setHistoricoPastedData] = useState('');
  const [historico, setHistorico] = useState<HistoricoSnapshot[]>([]);

  // ── Auth ──────────────────────────────────────────────────────────────────

  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    const ok = await loginAction(password);
    if (ok) {
      setIsAuthenticated(true);
      toast.success('Acesso liberado!');
    } else {
      toast.error('Senha incorreta.');
    }
    setIsAuthLoading(false);
  };

  // ── Relatorio Padrao handlers ─────────────────────────────────────────────

  const parsePeriodo = (valor: string | number): { data: Date; label: string } | null => {
    const NOMES_MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    const mesesMap: { [key: string]: number } = {
      'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
      'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
    };

    const str = String(valor).trim();

    const matchRange = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+at[eé]\s+/i);
    if (matchRange) {
      const [, , mes, ano] = matchRange;
      const d = new Date(parseInt(ano), parseInt(mes) - 1, 1);
      if (!isNaN(d.getTime())) {
        const label = `${NOMES_MESES[d.getMonth()]}/${ano.slice(-2)}`;
        return { data: d, label };
      }
    }

    const strLower = str.toLowerCase();
    const partes = strLower.split('/');
    if (partes.length === 2 && mesesMap[partes[0]] !== undefined) {
      const anoStr = partes[1].length === 2 ? `20${partes[1]}` : partes[1];
      const d = new Date(parseInt(anoStr), mesesMap[partes[0]], 1);
      if (!isNaN(d.getTime())) return { data: d, label: strLower };
    }

    const d = new Date(valor as string);
    if (!isNaN(d.getTime())) {
      const NOMES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
      const label = `${NOMES[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
      return { data: d, label };
    }

    return null;
  };

  const processarDadosRelatorio = (dadosParaProcessar: { [key: string]: string | number }[]) => {
    if (!dadosParaProcessar || dadosParaProcessar.length === 0) {
      toast.warning("Nenhum dado válido encontrado para processar.");
      return;
    }

    const dadosFormatados = dadosParaProcessar.map(linha => {
      try {
        const periodoValor = linha['Período'];
        if (periodoValor === undefined || periodoValor === null || String(periodoValor).trim() === '') return null;
        const resultado = parsePeriodo(periodoValor);
        if (!resultado) return null;

        const linhaProcessada: DadosLinha = {
          'Período': resultado.label,
          Data: resultado.data
        };

        ['ID', 'Data/Hora', 'Vara', 'Status'].forEach(col => {
          if (linha[col] !== undefined) linhaProcessada[col] = String(linha[col]);
        });

        COLUNAS_NUMERICAS_ESPERADAS.forEach(col => {
          const valor = linha[col];
          linhaProcessada[col] = typeof valor === 'string'
            ? Number(valor.replace(/[^0-9.,-]+/g, "").replace(",", ".")) || 0
            : Number(valor) || 0;
        });
        return linhaProcessada;
      } catch {
        return null;
      }
    }).filter((item): item is DadosLinha => item !== null)
      .sort((a, b) => a.Data.getTime() - b.Data.getTime());

    if (dadosFormatados.length > 0) {
      setDados(dadosFormatados);
      toast.success(`${dadosFormatados.length} linhas de dados processadas com sucesso!`);
    } else {
      toast.error("Nenhuma linha pôde ser processada.", {
        description: "Verifique se a coluna 'Período' está no formato correto (ex: jan/25 ou 01/01/2025 até 31/01/2025)."
      });
    }
  };

  const handleFileChangeRelatorio = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as { [key: string]: string | number }[];
        processarDadosRelatorio(json);
      } catch {
        toast.error("Erro ao ler o arquivo XLSX.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleProcessPastedData = () => {
    if (!pastedData) return;
    const linhas = pastedData.trim().split('\n');
    const cabecalho = linhas[0].split('\t');
    const dadosJson = linhas.slice(1).map(linha => {
      const valores = linha.split('\t');
      const obj: { [key: string]: string } = {};
      cabecalho.forEach((key, index) => { obj[key.trim()] = valores[index]; });
      return obj;
    });
    processarDadosRelatorio(dadosJson);
  };

  const handleRowChange = (index: number, field: string, value: string) => {
    const novosDados = dados.map((linha, idx) => {
      if (idx !== index) return linha;
      const updatedLine: DadosLinha = { ...linha };
      const colsTexto = ['Período', 'ID', 'Data/Hora', 'Vara', 'Status'];
      if (colsTexto.includes(field)) {
        updatedLine[field] = value;
      } else {
        updatedLine[field] = Number(value) || 0;
      }
      return updatedLine;
    });
    setDados(novosDados);
  };

  const handleAddRow = () => {
    const novaLinha: DadosLinha = {
      'Período': 'jan/25',
      'ID': '',
      'Data/Hora': '',
      'Vara': '',
      'Status': '',
      Data: new Date()
    };
    COLUNAS_NUMERICAS_ESPERADAS.forEach(col => { novaLinha[col] = 0; });
    setDados([...dados, novaLinha]);
  };

  const handleSaveRelatorio = async () => {
    if (dados.length === 0) { toast.warning("Nenhum dado para salvar."); return; }
    const dadosParaSalvar = dados.map((linha) => {
      const dadosLimpos: { [key: string]: string | number } = {};
      Object.entries(linha).forEach(([key, value]) => {
        if (key !== 'Data' && (typeof value === 'string' || typeof value === 'number')) {
          dadosLimpos[key] = value;
        }
      });
      return dadosLimpos;
    });
    const result = await saveRelatorioData(dadosParaSalvar);
    if (result.success) {
      toast.success("Dados do Relatório Padrão salvos!");
      onDataSaved();
    } else {
      toast.error("Falha ao salvar os dados.", { description: result.error });
    }
  };

  // ── Jurimetria handlers ───────────────────────────────────────────────────

  const handleFileChangeJurimetria = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        // Converter coluna Processo como string para preservar os 20 dígitos
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
          raw: false, // força strings para todas as células
        }) as { [key: string]: string }[];

        const dadosProcessados: Processo[] = json
          .filter(p => p.Processo && String(p.Processo).trim() !== '')
          .map(p => ({
            Processo: String(p.Processo || '').trim(),
            Eventos: Number(p.Eventos) || 0,
            Procedimento: String(p.Procedimento || ''),
            Classe: String(p.Classe || ''),
            Assunto: String(p.Assunto || ''),
            'Tipo de Conclusão': String(p['Tipo de Conclusão'] || 'Não especificado'),
            'Dias Conclusos': Number(p['Dias Conclusos']) || 0,
            'Dias em Tramitação': Number(p['Dias em Tramitação']) || 0,
            Autuação: String(p['Autuação'] || ''),
            Assessor: String(p.Assessor || 'Não identificado'),
            'Fase Processual': String(p['Fase Processual'] || ''),
          }));

        setProcessos(dadosProcessados);
        toast.success(`${dadosProcessados.length} processos carregados do arquivo.`);
      } catch {
        toast.error("Erro ao ler o arquivo XLSX.", {
          description: "Verifique o formato e as colunas do arquivo."
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── Histórico handlers ────────────────────────────────────────────────────

  const parseMarkdownHistorico = (markdown: string): HistoricoSnapshot[] => {
    const lines = markdown.split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('|') && !l.match(/^\|\s*-{3}/));

    // lines[0] = cabeçalho de grupos, lines[1] = cabeçalho de colunas, lines[2+] = dados
    if (lines.length < 3) return [];

    const snapshots: HistoricoSnapshot[] = [];
    for (let i = 2; i < lines.length; i++) {
      const cells = lines[i].split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length < 3) continue;
      const dataHora = cells[1] || '';
      if (!dataHora) continue;
      const clean = (idx: number) => String(cells[idx] || '').replace(/[^0-9.-]/g, '');
      const n = (idx: number) => Number(clean(idx)) || 0;
      const f = (idx: number) => parseFloat(clean(idx)) || 0;
      snapshots.push({
        dataHora,
        isMediaHistorica: dataHora.toUpperCase().includes('MÉDIA'),
        conclusos: n(2),
        mediaDias: f(3),
        mediaEventos: f(4),
        decisao: n(5),
        despacho: n(6),
        sentenca: n(7),
        conhecimento: n(8),
        execucao: n(9),
        outros: n(10),
        dias0_30: n(11),
        dias31_60: n(12),
        dias61_90: n(13),
        dias91_120: n(14),
        eventos0_20: n(15),
        eventos21_50: n(16),
        eventos51_100: n(17),
        eventos101_200: n(18),
        eventos201plus: n(19),
      });
    }
    return snapshots;
  };

  const handleProcessHistorico = () => {
    if (!historicoPastedData.trim()) { toast.warning('Cole os dados do histórico primeiro.'); return; }
    const parsed = parseMarkdownHistorico(historicoPastedData);
    if (parsed.length === 0) {
      toast.error('Nenhum dado reconhecido. Verifique o formato da tabela markdown.');
      return;
    }
    setHistorico(parsed);
    toast.success(`${parsed.length} snapshots processados (incluindo média histórica se presente).`);
  };

  const handleSaveHistorico = async () => {
    if (historico.length === 0) { toast.warning('Nenhum dado de histórico para salvar.'); return; }
    const dadosParaSalvar = historico.map(s => ({
      dataHora: s.dataHora,
      isMediaHistorica: s.isMediaHistorica ? 1 : 0,
      conclusos: s.conclusos,
      mediaDias: s.mediaDias,
      mediaEventos: s.mediaEventos,
      decisao: s.decisao,
      despacho: s.despacho,
      sentenca: s.sentenca,
      conhecimento: s.conhecimento,
      execucao: s.execucao,
      outros: s.outros,
      dias0_30: s.dias0_30,
      dias31_60: s.dias31_60,
      dias61_90: s.dias61_90,
      dias91_120: s.dias91_120,
      eventos0_20: s.eventos0_20,
      eventos21_50: s.eventos21_50,
      eventos51_100: s.eventos51_100,
      eventos101_200: s.eventos101_200,
      eventos201plus: s.eventos201plus,
    }));
    const result = await saveHistoricoData(dadosParaSalvar);
    if (result.success) {
      toast.success('Histórico de snapshots salvo!');
      onDataSaved();
    } else {
      toast.error('Falha ao salvar histórico.', { description: result.error });
    }
  };

  const handleSaveJurimetria = async () => {
    if (processos.length === 0) { toast.warning("Nenhum dado para salvar."); return; }
    const result = await saveJurimetriaData(processos as { [key: string]: string | number }[]);
    if (result.success) {
      toast.success("Dados dos processos salvos!");
      onDataSaved();
    } else {
      toast.error("Falha ao salvar os dados.");
    }
  };

  // ── Render: password gate ────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div className="flex justify-center mt-12">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <Lock size={32} className="text-gray-500" />
            </div>
            <CardTitle>Gerenciamento e Entrada de Dados</CardTitle>
            <CardDescription>Digite a senha do sistema para acessar.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuthenticate} className="space-y-4">
              <Input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
              />
              <Button type="submit" className="w-full" disabled={isAuthLoading}>
                {isAuthLoading ? 'Verificando...' : 'Acessar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render: data entry ───────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* ── Relatório Padrão ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>📊 Entrada de Dados — Relatório Padrão</CardTitle>
          <CardDescription>
            Carregue ou edite os dados mensais do relatório padrão e clique em Salvar para persistir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="xlsx-upload-relatorio" className="font-semibold">
              Opção 1: Carregar Arquivo XLSX
            </Label>
            <Input
              id="xlsx-upload-relatorio"
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChangeRelatorio}
            />
          </div>

          <div>
            <Label htmlFor="paste-area" className="font-semibold">
              Opção 2: Colar Dados do Excel (com cabeçalho)
            </Label>
            <Textarea
              id="paste-area"
              placeholder="Copie as células do Excel (incluindo a linha de cabeçalho) e cole aqui..."
              value={pastedData}
              onChange={(e) => setPastedData(e.target.value)}
              rows={5}
            />
            <Button onClick={handleProcessPastedData} className="mt-2">Processar Dados Colados</Button>
          </div>

          <div>
            <Label className="font-semibold">Opção 3: Edição Manual</Label>
            <div className="border rounded-md overflow-auto max-h-[40vh]">
              <Table>
                <TableHeader className="sticky top-0 bg-secondary z-10">
                  <TableRow>
                    {COLUNAS_ESPERADAS.filter(col => !colunasOcultas.includes(col)).map(col =>
                      <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.map((linha, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {COLUNAS_ESPERADAS.filter(col => !colunasOcultas.includes(col)).map(col => (
                        <TableCell key={col} className="p-1">
                          <Input
                            className="w-28"
                            value={linha[col] === undefined ? '' : String(linha[col])}
                            onChange={(e) => handleRowChange(rowIndex, col, e.target.value)}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button onClick={handleAddRow} className="mt-2">Adicionar Linha Manualmente</Button>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveRelatorio} disabled={dados.length === 0}>
              Salvar Relatório Padrão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Análise de Processos ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>⚖️ Entrada de Dados — Análise de Processos</CardTitle>
          <CardDescription>
            Carregue o arquivo XLSX de processos conclusos e clique em Salvar para persistir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChangeJurimetria}
              className="max-w-xs"
            />
            <Button onClick={handleSaveJurimetria} disabled={processos.length === 0}>
              Salvar Análise de Processos
            </Button>
          </div>
          {processos.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {processos.length} processo(s) carregado(s) e prontos para salvar.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Histórico de Snapshots ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>📈 Entrada de Dados — Histórico de Snapshots</CardTitle>
          <CardDescription>
            Cole abaixo a tabela markdown exportada do eProc (formato com cabeçalho duplo). Cada linha representa uma observação diária dos processos conclusos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="historico-paste" className="font-semibold">Colar Tabela Markdown</Label>
            <Textarea
              id="historico-paste"
              placeholder="Cole aqui a tabela markdown do histórico (começando com | Nº | Métricas Básicas | ...)..."
              value={historicoPastedData}
              onChange={e => setHistoricoPastedData(e.target.value)}
              rows={6}
              className="font-mono text-xs"
            />
            <Button onClick={handleProcessHistorico} className="mt-2">Processar Histórico</Button>
          </div>

          {historico.length > 0 && (
            <>
              <div className="text-sm text-muted-foreground">
                {historico.length} snapshot(s) processado(s).
                {historico.filter(s => s.isMediaHistorica).length > 0 && ' Inclui linha de Média Histórica.'}
              </div>
              <div className="border rounded-md overflow-auto max-h-[40vh]">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left">Data/Hora</th>
                      <th className="px-2 py-1 text-right">Conclusos</th>
                      <th className="px-2 py-1 text-right">Média Dias</th>
                      <th className="px-2 py-1 text-right">Decisão</th>
                      <th className="px-2 py-1 text-right">Despacho</th>
                      <th className="px-2 py-1 text-right">Sentença</th>
                      <th className="px-2 py-1 text-right">Conhec.</th>
                      <th className="px-2 py-1 text-right">Execução</th>
                      <th className="px-2 py-1 text-right">0-30d</th>
                      <th className="px-2 py-1 text-right">31-60d</th>
                      <th className="px-2 py-1 text-right">61-90d</th>
                      <th className="px-2 py-1 text-right">91-120d</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map((s, i) => (
                      <tr key={i} className={`border-b ${s.isMediaHistorica ? 'bg-blue-50 font-semibold' : 'hover:bg-gray-50'}`}>
                        <td className="px-2 py-1">{s.dataHora}</td>
                        <td className="px-2 py-1 text-right">{s.conclusos}</td>
                        <td className="px-2 py-1 text-right">{s.mediaDias}</td>
                        <td className="px-2 py-1 text-right">{s.decisao}</td>
                        <td className="px-2 py-1 text-right">{s.despacho}</td>
                        <td className="px-2 py-1 text-right">{s.sentenca}</td>
                        <td className="px-2 py-1 text-right">{s.conhecimento}</td>
                        <td className="px-2 py-1 text-right">{s.execucao}</td>
                        <td className="px-2 py-1 text-right">{s.dias0_30}</td>
                        <td className="px-2 py-1 text-right">{s.dias31_60}</td>
                        <td className="px-2 py-1 text-right">{s.dias61_90}</td>
                        <td className="px-2 py-1 text-right">{s.dias91_120}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveHistorico}>Salvar Histórico</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
