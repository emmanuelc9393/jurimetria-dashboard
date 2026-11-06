// src/lib/historicoParser.ts
// Leitura da tabela markdown "Histórico de Processos - eProc" (botão Copiar Markdown do eProc).
//
// As colunas são localizadas pelo nome do cabeçalho, então a mesma função aceita:
//   - o formato antigo, com a Faixa de Dias em 4 colunas (sem 121+d);
//   - o formato com 121+d;
//   - o formato atual, com o grupo "Ritmo de Conclusão" (9 colunas a mais no fim).
// Se o cabeçalho não for reconhecido, volta para a leitura por posição usada até aqui.

export interface HistoricoSnapshot {
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
  dias121plus: number;
  eventos0_20: number;
  eventos21_50: number;
  eventos51_100: number;
  eventos101_200: number;
  eventos201plus: number;
  // ── Ritmo de Conclusão (null quando a célula vem vazia, "–", "—" ou "em andamento") ──
  /** Decidir (d): média de dias entre a conclusão e a decisão seguinte (gabinete), 12 meses antes da run. */
  tempoDecidir: number | null;
  /** Concl./ano: quantas vezes, em média, cada processo chegou concluso nos 12 meses anteriores. */
  conclusoesAno: number | null;
  /** Cartório (d): média de dias entre a decisão e a conclusão seguinte do mesmo processo. */
  tempoCartorio: number | null;
  /** Eventos/30d: eventos entre uma conclusão e a seguinte, proporcional a 30 dias. */
  eventos30d: number | null;
  /** Novos conclusos: conclusões dos processos da run desde a run anterior até a véspera desta. */
  novosConclusos: number | null;
  /** Concl. no mês (até a run): relatório do e-Proc, do dia 1º do mês até a hora da run. */
  conclMesAteRun: number | null;
  /** Concl. mês cheio: o mês inteiro da run (null enquanto o mês está "em andamento"). */
  conclMesCheio: number | null;
  /** Petições no mês (até a run): "Juntada de Petição" do dia 1º até a hora da run. */
  peticoesMesAteRun: number | null;
  /** Petições mês cheio: "Juntada de Petição" no mês inteiro (null enquanto "em andamento"). */
  peticoesMesCheio: number | null;
  /** O eProc marcou o mês cheio como "em andamento" (mês ainda não fechado). */
  mesEmAndamento: boolean;
}

export type CampoRitmo =
  | 'tempoDecidir' | 'conclusoesAno' | 'tempoCartorio' | 'eventos30d' | 'novosConclusos'
  | 'conclMesAteRun' | 'conclMesCheio' | 'peticoesMesAteRun' | 'peticoesMesCheio';

type CampoBase = Exclude<keyof HistoricoSnapshot, CampoRitmo | 'dataHora' | 'isMediaHistorica' | 'mesEmAndamento'>;

/**
 * Como cada valor é escrito pelo eProc:
 *  - 'int': inteiro simples ("502 ↓");
 *  - 'dec': decimal com ponto ou vírgula ("36.2 ↑", "27,8 ↑");
 *  - 'milhar': inteiro com ponto de milhar ("2.648"), usado nas colunas do relatório do e-Proc.
 */
type Formato = 'int' | 'dec' | 'milhar';

const CAMPOS_BASE: { campo: CampoBase; cabecalho: string; formato: Formato }[] = [
  { campo: 'conclusos', cabecalho: 'Conclusos', formato: 'int' },
  { campo: 'mediaDias', cabecalho: 'Média Dias', formato: 'dec' },
  { campo: 'mediaEventos', cabecalho: 'Média Eventos', formato: 'dec' },
  { campo: 'decisao', cabecalho: 'Decisão', formato: 'int' },
  { campo: 'despacho', cabecalho: 'Despacho', formato: 'int' },
  { campo: 'sentenca', cabecalho: 'Sentença', formato: 'int' },
  { campo: 'conhecimento', cabecalho: 'Conhec.', formato: 'int' },
  { campo: 'execucao', cabecalho: 'Execução', formato: 'int' },
  { campo: 'outros', cabecalho: 'Outros', formato: 'int' },
  { campo: 'dias0_30', cabecalho: '0-30d', formato: 'int' },
  { campo: 'dias31_60', cabecalho: '31-60d', formato: 'int' },
  { campo: 'dias61_90', cabecalho: '61-90d', formato: 'int' },
  { campo: 'dias91_120', cabecalho: '91-120d', formato: 'int' },
  { campo: 'dias121plus', cabecalho: '121+d', formato: 'int' },
  { campo: 'eventos0_20', cabecalho: '0-20', formato: 'int' },
  { campo: 'eventos21_50', cabecalho: '21-50', formato: 'int' },
  { campo: 'eventos51_100', cabecalho: '51-100', formato: 'int' },
  { campo: 'eventos101_200', cabecalho: '101-200', formato: 'int' },
  { campo: 'eventos201plus', cabecalho: '201+', formato: 'int' },
];

/** Colunas do grupo "Ritmo de Conclusão", na ordem em que o eProc as exporta. */
export const CAMPOS_RITMO: {
  campo: CampoRitmo; cabecalho: string; formato: Formato; casas: number; descricao: string;
}[] = [
  {
    campo: 'tempoDecidir', cabecalho: 'Decidir (d)', formato: 'dec', casas: 1,
    descricao: 'Tempo para decidir (gabinete): média de dias entre a conclusão e a decisão seguinte, nos 12 meses anteriores à run.',
  },
  {
    campo: 'conclusoesAno', cabecalho: 'Concl./ano', formato: 'dec', casas: 1,
    descricao: 'Frequência: quantas vezes, em média, cada processo da run chegou concluso nos 12 meses anteriores.',
  },
  {
    campo: 'tempoCartorio', cabecalho: 'Cartório (d)', formato: 'dec', casas: 1,
    descricao: 'Tempo no cartório: média de dias entre a decisão e a conclusão seguinte do mesmo processo.',
  },
  {
    campo: 'eventos30d', cabecalho: 'Eventos/30d', formato: 'dec', casas: 1,
    descricao: 'Velocidade: eventos entre uma conclusão e a seguinte, proporcional a 30 dias.',
  },
  // Inteiro nas runs, mas a linha de média histórica vem com uma casa ("51.4").
  {
    campo: 'novosConclusos', cabecalho: 'Novos conclusos', formato: 'dec', casas: 0,
    descricao: 'Conclusões dos processos da run desde o dia da run anterior até a véspera desta.',
  },
  {
    campo: 'conclMesAteRun', cabecalho: 'Concl. no mês (até a run)', formato: 'milhar', casas: 0,
    descricao: 'Relatório do e-Proc: conclusos para decisão, despacho e julgamento do dia 1º do mês até a hora da run.',
  },
  {
    campo: 'conclMesCheio', cabecalho: 'Concl. mês cheio', formato: 'milhar', casas: 0,
    descricao: 'Conclusões no mês inteiro da run; "em andamento" até o mês fechar.',
  },
  {
    campo: 'peticoesMesAteRun', cabecalho: 'Petições no mês (até a run)', formato: 'milhar', casas: 0,
    descricao: 'Relatório do e-Proc: "Juntada de Petição" do dia 1º do mês até a hora da run.',
  },
  {
    campo: 'peticoesMesCheio', cabecalho: 'Petições mês cheio', formato: 'milhar', casas: 0,
    descricao: '"Juntada de Petição" no mês inteiro da run; "em andamento" até o mês fechar.',
  },
];

/** Minúsculas, sem acentos, sem espaços e sem o indicador de ordenação (▲ ▼) do eProc. */
const normalizar = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[▲▼\s]/g, '').toLowerCase();

/** Divide uma linha "| a | b |  | c |" preservando as células vazias do meio. */
const dividirLinha = (linha: string): string[] => {
  const celulas = linha.split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
  if (linha.startsWith('|')) celulas.shift();
  if (linha.endsWith('|') && !linha.endsWith('\\|')) celulas.pop();
  return celulas;
};

/** Converte a célula em número, ou null quando ela não traz número ("", "–", "—", "em andamento"). */
const lerNumero = (celula: string | undefined, formato: Formato): number | null => {
  const texto = String(celula ?? '').replace(/[↑↓\s]/g, '');
  if (!/\d/.test(texto)) return null;
  if (formato === 'milhar') {
    const n = Number(texto.replace(/[^0-9-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  let limpo = texto.replace(/[^0-9.,-]/g, '');
  if (limpo.includes(',')) {
    // "1.234,5" → 1234.5 ; "27,8" → 27.8
    limpo = limpo.replace(/\./g, '').replace(',', '.');
  }
  const n = formato === 'int' ? Number(limpo) : parseFloat(limpo);
  return Number.isFinite(n) ? n : null;
};

/**
 * Visão "Exibir por mês" do eProc: "Novembro/2026 · 2 runs (última 03/11 13:42)".
 * Converte para a data/hora da última run ("03/11/2026 13:42:00"), que é o que os gráficos usam.
 */
const dataHoraDaVisaoPorMes = (rotulo: string): string | null => {
  const m = rotulo.match(/\/(\d{4}).*?[uú]ltima\s+(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/i);
  if (!m) return null;
  const [, ano, dia, mes, hora, minuto] = m;
  return `${dia}/${mes}/${ano} ${hora}:${minuto}:00`;
};

export interface ResultadoHistorico {
  snapshots: HistoricoSnapshot[];
  /** A colagem trouxe o grupo "Ritmo de Conclusão". */
  temRitmo: boolean;
  /** A colagem veio da visão "Exibir por mês" (uma linha por mês). */
  visaoPorMes: boolean;
}

export function parseMarkdownHistorico(markdown: string): ResultadoHistorico {
  const linhas = markdown.split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('|') && !/^\|[\s|:-]*$/.test(l)); // descarta a linha separadora "| --- | --- |"

  const vazio: ResultadoHistorico = { snapshots: [], temRitmo: false, visaoPorMes: false };
  if (linhas.length < 2) return vazio;

  // Cabeçalho de colunas: a linha com "Data/Hora" (ou "Mês (última run)" na visão por mês).
  // A linha de grupos ("Métricas Básicas", "Ritmo de Conclusão"...) fica acima dela e é ignorada.
  let idxCabecalho = linhas.findIndex(l => {
    const celulas = dividirLinha(l).map(normalizar);
    return celulas.includes('data/hora') || celulas.some(c => c.startsWith('mes(ultimarun)'));
  });
  if (idxCabecalho === -1) idxCabecalho = 1; // formato inesperado: segue o padrão grupos + colunas
  if (linhas.length <= idxCabecalho + 1) return vazio;

  const cabecalho = dividirLinha(linhas[idxCabecalho]).map(normalizar);
  const indice = (nome: string) => cabecalho.indexOf(normalizar(nome));

  const idxConclusos = indice('Conclusos');
  const porNome = idxConclusos !== -1;
  const idxDataHora = porNome ? idxConclusos - 1 : 1;
  const visaoPorMes = cabecalho[idxDataHora]?.startsWith('mes(ultimarun)') ?? false;

  // Posição de cada coluna base: pelo nome, ou pelo layout antigo quando o cabeçalho não ajuda.
  const has121 = cabecalho.includes('121+d');
  const posicaoAntiga = (i: number) => {
    if (i <= 12) return i + 2;              // Conclusos..91-120d → células 2..14
    if (i === 13) return has121 ? 15 : -1;  // 121+d
    return i + (has121 ? 2 : 1);            // faixas de eventos
  };
  const posBase = CAMPOS_BASE.map((c, i) => (porNome ? indice(c.cabecalho) : posicaoAntiga(i)));
  const posRitmo = CAMPOS_RITMO.map(c => indice(c.cabecalho));
  const temRitmo = posRitmo.some(p => p !== -1);
  const idxConclCheio = indice('Concl. mês cheio');
  const idxPetCheio = indice('Petições mês cheio');

  const snapshots: HistoricoSnapshot[] = [];
  for (let i = idxCabecalho + 1; i < linhas.length; i++) {
    const celulas = dividirLinha(linhas[i]);
    if (celulas.length < 3) continue;
    const rotulo = celulas[idxDataHora] || '';
    if (!rotulo) continue;

    const isMediaHistorica = normalizar(rotulo).includes('media');
    const dataHora = !isMediaHistorica && visaoPorMes ? (dataHoraDaVisaoPorMes(rotulo) ?? rotulo) : rotulo;

    const emAndamento = [idxConclCheio, idxPetCheio]
      .some(p => p !== -1 && normalizar(celulas[p] || '').includes('andamento'));

    const snap = { dataHora, isMediaHistorica, mesEmAndamento: emAndamento } as HistoricoSnapshot;
    CAMPOS_BASE.forEach((c, k) => {
      const p = posBase[k];
      snap[c.campo] = p === -1 ? 0 : (lerNumero(celulas[p], c.formato) ?? 0);
    });
    CAMPOS_RITMO.forEach((c, k) => {
      const p = posRitmo[k];
      snap[c.campo] = p === -1 ? null : lerNumero(celulas[p], c.formato);
    });
    snapshots.push(snap);
  }

  return { snapshots, temRitmo, visaoPorMes };
}

/** Formato salvo no Vercel KV: só números e strings (os campos do ritmo sem valor ficam de fora). */
export function snapshotParaSalvar(s: HistoricoSnapshot): { [key: string]: string | number } {
  const linha: { [key: string]: string | number } = {
    dataHora: s.dataHora,
    isMediaHistorica: s.isMediaHistorica ? 1 : 0,
  };
  CAMPOS_BASE.forEach(c => { linha[c.campo] = s[c.campo]; });
  CAMPOS_RITMO.forEach(c => {
    const valor = s[c.campo];
    if (valor !== null) linha[c.campo] = valor;
  });
  if (s.mesEmAndamento) linha.mesEmAndamento = 1;
  return linha;
}

/**
 * Número no padrão brasileiro para as tabelas ("27,8", "2.648"). Colunas inteiras mostram até uma
 * casa quando o valor não é inteiro (a média histórica de "Novos conclusos", por exemplo).
 */
export const formatarRitmo = (valor: number | null, casas: number): string =>
  valor === null
    ? '—'
    : valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: Math.max(casas, 1) });
