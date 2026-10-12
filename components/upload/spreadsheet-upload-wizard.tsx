"use client";

import { useMemo, useState, useTransition } from "react";
import { read, utils } from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { parseNumeroBR } from "@/lib/parse-numero-br";
import { enviarArquivoParaStorage, removerArquivosDoStorage } from "@/lib/storage/upload-direto";

import {
  detectarCabecalho,
  detectarColunaNumeracao,
  classificarLinhas,
  type CampoPlanilha,
} from "@/lib/orcamento/colunas-planilha";

export type CampoMapeavel = CampoPlanilha;

const todosCamposLabel: Record<CampoMapeavel, string> = {
  etapa: "Etapa (opcional)",
  codigo_sinapi: "Código (opcional)",
  descricao: "Descrição",
  unidade: "Unidade",
  quantidade: "Quantidade",
  preco_unitario: "Preço unitário",
};

/** Campos que a importação aceita em branco. */
const OPCIONAIS: CampoMapeavel[] = ["etapa", "codigo_sinapi"];

export type ItemPlanilha = {
  etapa?: string;
  codigo_sinapi?: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
};

export type MapeamentoSalvo = { linha_cabecalho: number; mapa_colunas: Record<string, number> } | null;

/**
 * Uma aba, lida de dois jeitos.
 *
 * `linhas` é o texto formatado da célula — é o que se mostra na tela e o que a
 * detecção de cabeçalho compara. `brutas` é o valor guardado, que para célula
 * numérica é um `number`.
 *
 * Os dois são necessários. Lendo só o formatado, " R$20,000.00 " tinha de ser
 * reinterpretado como texto, e a planilha do engenheiro (formatada em locale
 * americano) voltava com zero itens válidos. Lendo só o bruto, o cabeçalho e a
 * prévia perderiam o que o usuário vê na própria planilha.
 */
type Aba = { nome: string; linhas: string[][]; brutas: unknown[][] };

const CAMPOS_PADRAO: CampoMapeavel[] = [
  "etapa",
  "codigo_sinapi",
  "descricao",
  "unidade",
  "quantidade",
  "preco_unitario",
];

export function SpreadsheetUploadWizard({
  mapeamentoSalvo,
  mostrarMesReferencia = false,
  campos = CAMPOS_PADRAO,
  labelBase,
  bucket,
  prefixoPath,
  etapasOficiais,
  onConfirm,
}: {
  mapeamentoSalvo: MapeamentoSalvo;
  mostrarMesReferencia?: boolean;
  /** Campos a mapear/validar. Planilhas de catálogo (ex: SINAPI) não têm quantidade —
   * passe só os campos que existem na planilha de destino. */
  campos?: CampoMapeavel[];
  /** Texto do botão de confirmar (a contagem de itens é adicionada automaticamente). */
  labelBase: string;
  /** Bucket do Storage que recebe o arquivo original. */
  bucket: string;
  /** Pasta dentro do bucket. Quando há mês de referência, ele vira a pasta. */
  prefixoPath?: string;
  /**
   * Etapas oficiais do orçamento. Quando passadas, a importação deduz a etapa
   * de cada item pela estrutura da planilha (linha com descrição e sem valores
   * é cabeçalho de etapa) e casa o nome com esta lista. Planilha de catálogo
   * (SINAPI) não passa.
   */
  etapasOficiais?: readonly string[];
  /**
   * Recebe o **caminho** do arquivo já enviado, não o arquivo. O envio acontece
   * aqui no navegador, direto para o Storage — se o arquivo passasse pela
   * Server Action, uma planilha real estouraria o limite de payload da função
   * em produção (~4,5 MB depois do base64).
   */
  onConfirm: (params: {
    itens: ItemPlanilha[];
    mapeamento: { linha_cabecalho: number; mapa_colunas: Record<string, number> };
    arquivoPath: string;
    mesReferencia?: string;
  }) => Promise<{ error: string | null } | void>;
}) {
  const camposObrigatorios = campos.filter((c) => !OPCIONAIS.includes(c));
  const camposLabel = Object.fromEntries(
    campos.map((c) => [c, todosCamposLabel[c]])
  ) as Record<CampoMapeavel, string>;
  const incluiQuantidade = campos.includes("quantidade");
  const [file, setFile] = useState<File | null>(null);
  const [abas, setAbas] = useState<Aba[]>([]);
  const [abaAtiva, setAbaAtiva] = useState(0);
  const [detectado, setDetectado] = useState<string | null>(null);
  const [etapaPelaEstrutura, setEtapaPelaEstrutura] = useState(true);
  const [headerRow, setHeaderRow] = useState<number | null>(mapeamentoSalvo?.linha_cabecalho ?? null);
  const [mapping, setMapping] = useState<Partial<Record<CampoMapeavel, number>>>(
    (mapeamentoSalvo?.mapa_colunas as Partial<Record<CampoMapeavel, number>>) ?? {}
  );
  const [excluidas, setExcluidas] = useState<Set<number>>(new Set());
  const [mesReferencia, setMesReferencia] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /**
   * Lê TODAS as abas e escolhe a que parece ser o orçamento.
   *
   * Antes lia só `SheetNames[0]`. A planilha real do engenheiro tem 15 abas e
   * a primeira é um índice — o importador não achava coluna nenhuma, a prévia
   * ficava vazia e não aparecia erro: arquivo selecionado, nada acontecendo.
   *
   * O `try` existe pelo mesmo motivo. Qualquer exceção da leitura (arquivo
   * corrompido, protegido por senha, formato que o xlsx não abre) virava
   * rejeição de promessa não tratada, e a tela também não dizia nada.
   */
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setError(null);
    setDetectado(null);
    setAbas([]);
    setExcluidas(new Set());

    let lidas: Aba[];
    try {
      const buffer = await selected.arrayBuffer();
      const workbook = read(buffer, { type: "array" });
      /*
       * Aba oculta fica de fora.
       *
       * `SheetNames` traz tudo, inclusive o que o Excel não mostra na barra de
       * abas. Numa planilha real isso significou o engenheiro apagar as abas
       * que via, sobrar uma só na tela dele, e o importador ainda listar cinco
       * — quatro delas ocultas ("Parâmetros", "Planejamento Mês a Mês"...),
       * normalmente auxiliares de fórmula. Oferecer o que ele não enxerga só
       * confunde.
       *
       * `Hidden`: 0 visível, 1 oculta, 2 muito oculta. Se TODAS estiverem
       * ocultas, mostra todas — melhor uma lista estranha que nenhuma.
       */
      const visibilidade = new Map(
        (workbook.Workbook?.Sheets ?? []).map((aba) => [aba.name, aba.Hidden ?? 0])
      );
      const visiveis = workbook.SheetNames.filter((nome) => (visibilidade.get(nome) ?? 0) === 0);
      const nomes = visiveis.length ? visiveis : workbook.SheetNames;

      lidas = nomes.map((nome) => {
        const planilha = workbook.Sheets[nome];
        return {
          nome,
          linhas: utils
            .sheet_to_json<string[]>(planilha, { header: 1, raw: false, defval: "" })
            .map((row) => row.map((cell) => String(cell ?? ""))),
          brutas: utils.sheet_to_json<unknown[]>(planilha, {
            header: 1,
            raw: true,
            defval: "",
          }),
        };
      });
    } catch {
      return setError(
        "Não foi possível ler essa planilha. Salve como .xlsx sem senha e tente de novo."
      );
    }

    if (!lidas.length || lidas.every((a) => !a.linhas.length)) {
      return setError("A planilha está vazia.");
    }

    setAbas(lidas);

    // A aba escolhida é a que reconhece mais colunas de orçamento.
    let melhorAba = 0;
    let melhorAcertos = -1;
    let melhorCabecalho: ReturnType<typeof detectarCabecalho> = null;
    lidas.forEach((aba, i) => {
      const achou = detectarCabecalho(aba.linhas);
      const acertos = achou ? Object.keys(achou.colunas).length : 0;
      if (acertos > melhorAcertos) {
        melhorAcertos = acertos;
        melhorAba = i;
        melhorCabecalho = achou;
      }
    });

    setAbaAtiva(melhorAba);
    aplicarDeteccao(lidas[melhorAba], melhorCabecalho, lidas.length > 1 ? lidas[melhorAba].nome : null);
  }

  /** Põe na tela o cabeçalho e o mapeamento que a detecção encontrou. */
  function aplicarDeteccao(
    aba: Aba,
    achou: ReturnType<typeof detectarCabecalho>,
    nomeAba: string | null
  ) {
    if (!achou) {
      setHeaderRow(null);
      setDetectado(null);
      return;
    }
    setHeaderRow(achou.linha);
    setMapping(achou.colunas);
    const quantas = Object.keys(achou.colunas).length;
    setDetectado(
      `${nomeAba ? `Aba "${nomeAba}", ` : ""}cabeçalho na linha ${achou.linha + 1}, ${quantas} coluna(s) reconhecida(s). Confira abaixo.`
    );
  }

  function trocarAba(indice: number) {
    setAbaAtiva(indice);
    setExcluidas(new Set());
    setError(null);
    const aba = abas[indice];
    aplicarDeteccao(aba, detectarCabecalho(aba.linhas), null);
  }

  // Em `useMemo` porque o `?? []` criaria um array novo a cada render, e a
  // prévia dos itens (que depende de `rows`) seria recalculada sem motivo.
  const rows = useMemo(() => abas[abaAtiva]?.linhas ?? [], [abas, abaAtiva]);
  const brutas = useMemo(() => abas[abaAtiva]?.brutas ?? [], [abas, abaAtiva]);
  const colunasCabecalho = headerRow !== null ? rows[headerRow] ?? [] : [];

  /**
   * A etapa de cada linha, deduzida da estrutura quando não há coluna de etapa.
   *
   * Planilha de obra costuma marcar a etapa numa linha de cabeçalho — com
   * descrição e sem unidade, quantidade ou preço — e os itens dela vêm abaixo.
   * Sem isto, o orçamento importado entrava inteiro em "Sem etapa" e o
   * engenheiro reclassificava item por item.
   */
  const classificacao = useMemo(() => {
    if (headerRow === null || !etapasOficiais || !etapaPelaEstrutura) return null;
    if (mapping.descricao === undefined) return null;
    return classificarLinhas({
      linhas: rows,
      cabecalho: headerRow,
      colunas: mapping,
      colunaNumeracao: detectarColunaNumeracao(rows, headerRow + 1),
      etapasOficiais,
    });
  }, [rows, headerRow, mapping, etapasOficiais, etapaPelaEstrutura]);

  const etapasEncontradas = useMemo(() => {
    if (!classificacao) return [];
    const nomes = new Set<string>();
    for (const linha of classificacao.values()) {
      if (linha.tipo === "etapa") nomes.add(linha.nome);
    }
    return [...nomes];
  }, [classificacao]);

  const itensPreview = useMemo(() => {
    if (headerRow === null) return [];
    const camposPreenchidos = camposObrigatorios.every((c) => mapping[c] !== undefined);
    if (!camposPreenchidos) return [];

    return rows.slice(headerRow + 1).map((row, i) => {
      const rowIndex = headerRow + 1 + i;
      const bruta = brutas[rowIndex] ?? [];

      /**
       * Número vem da célula, não do texto que ela mostra.
       *
       * A planilha guarda 20000 e exibe " R$20,000.00 ". Lendo o texto, cada
       * formatação de moeda ou locale viraria um caso para o parser adivinhar —
       * e a importação real voltou vazia justamente por isso. O texto fica como
       * reserva, para a célula que guarda número como string.
       */
      const numero = (indice?: number) => {
        if (indice === undefined) return null;
        const doBruto = parseNumeroBR(bruta[indice]);
        return doBruto !== null ? doBruto : parseNumeroBR(row[indice]);
      };

      const descricao = mapping.descricao !== undefined ? row[mapping.descricao]?.trim() : "";
      const unidade = mapping.unidade !== undefined ? row[mapping.unidade]?.trim() : "";
      const quantidade = incluiQuantidade ? numero(mapping.quantidade) : 1;
      const precoUnitario = numero(mapping.preco_unitario);
      const codigoSinapi = mapping.codigo_sinapi !== undefined ? row[mapping.codigo_sinapi]?.trim() : "";
      // Coluna de etapa na planilha manda; sem ela, vale a deduzida da
      // estrutura.
      const daColuna = mapping.etapa !== undefined ? row[mapping.etapa]?.trim() : "";
      const classificada = classificacao?.get(rowIndex);
      const etapa =
        daColuna || (classificada?.tipo === "item" ? (classificada.etapa ?? "") : "");

      // Cabeçalho de etapa e linha de total não são itens.
      const estrutural = classificada && classificada.tipo !== "item";

      const valido =
        !estrutural && !!descricao && !!unidade && quantidade !== null && precoUnitario !== null;

      return { rowIndex, etapa, descricao, unidade, quantidade, precoUnitario, codigoSinapi, valido };
    });
  }, [rows, brutas, headerRow, mapping, camposObrigatorios, incluiQuantidade, classificacao]);

  const itensValidos = itensPreview.filter((item) => item.valido && !excluidas.has(item.rowIndex));

  function toggleExcluida(rowIndex: number) {
    setExcluidas((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  }

  function handleSubmit() {
    setError(null);
    if (!file) return setError("Selecione um arquivo.");
    if (mostrarMesReferencia && !mesReferencia) return setError("Selecione o mês de referência.");
    if (headerRow === null) return setError("Selecione a linha de cabeçalho.");
    if (!itensValidos.length) {
      return setError(
        "Nenhum item válido para importar. Confira se descrição, unidade, quantidade e preço estão mapeados para as colunas certas."
      );
    }

    startTransition(async () => {
      const prefixo = mostrarMesReferencia && mesReferencia ? mesReferencia : (prefixoPath ?? "geral");
      const envio = await enviarArquivoParaStorage(bucket, prefixo, file);
      if (envio.path === null) return setError(envio.error);

      const result = await onConfirm({
        itens: itensValidos.map((item) => ({
          etapa: item.etapa || undefined,
          codigo_sinapi: item.codigoSinapi || undefined,
          descricao: item.descricao,
          unidade: item.unidade,
          quantidade: item.quantidade as number,
          preco_unitario: item.precoUnitario as number,
        })),
        mapeamento: { linha_cabecalho: headerRow, mapa_colunas: mapping as Record<string, number> },
        arquivoPath: envio.path,
        mesReferencia: mostrarMesReferencia ? `${mesReferencia}-01` : undefined,
      });
      if (result?.error) {
        // A ação recusou (mês já ativo, versão não é rascunho...). O arquivo já
        // está no bucket e nada aponta para ele — desfaz, senão cada tentativa
        // deixa mais uma cópia da planilha ocupando espaço.
        await removerArquivosDoStorage(bucket, [envio.path]);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Arquivo{mostrarMesReferencia ? " e mês" : ""}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field orientation="responsive">
              {mostrarMesReferencia && (
                <div className="w-full">
                  <FieldLabel htmlFor="mes_referencia">Mês de referência</FieldLabel>
                  <Input
                    id="mes_referencia"
                    type="month"
                    value={mesReferencia}
                    onChange={(e) => setMesReferencia(e.target.value)}
                  />
                </div>
              )}
              <div className="w-full">
                <FieldLabel htmlFor="arquivo">Planilha (.xlsx)</FieldLabel>
                <input
                  id="arquivo"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="text-sm"
                />
              </div>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {detectado && (
        <p className="rounded-lg border border-sucesso/40 bg-sucesso/10 px-3 py-2 text-sm">
          {detectado}
        </p>
      )}

      {abas.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              2. Aba da planilha ({abas.length} encontradas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {abas.map((aba, i) => (
                <Button
                  key={aba.nome}
                  type="button"
                  size="sm"
                  variant={i === abaAtiva ? "default" : "outline"}
                  onClick={() => trocarAba(i)}
                >
                  {aba.nome}
                  <span className="text-xs opacity-70">({aba.linhas.length})</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {abas.length > 1 ? "3" : "2"}. Confirme a linha de cabeçalho
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-64 overflow-auto">
              <Table>
                <TableBody>
                  {rows.slice(0, 40).map((row, i) => (
                    <TableRow
                      key={i}
                      className={headerRow === i ? "bg-primary/10" : "cursor-pointer"}
                      onClick={() => setHeaderRow(i)}
                    >
                      <TableCell className="w-8">
                        <input type="radio" checked={headerRow === i} onChange={() => setHeaderRow(i)} />
                      </TableCell>
                      {row.slice(0, 8).map((cell, j) => (
                        <TableCell key={j} className="max-w-40 truncate text-xs">
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {headerRow !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {abas.length > 1 ? "4" : "3"}. Mapeie as colunas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(camposLabel) as CampoMapeavel[]).map((campo) => (
                <div key={campo}>
                  <FieldLabel htmlFor={`map_${campo}`}>{camposLabel[campo]}</FieldLabel>
                  <select
                    id={`map_${campo}`}
                    value={mapping[campo] ?? ""}
                    onChange={(e) =>
                      setMapping((prev) => ({
                        ...prev,
                        [campo]: e.target.value === "" ? undefined : Number(e.target.value),
                      }))
                    }
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  >
                    <option value="">Não mapear</option>
                    {colunasCabecalho.map((col, idx) => (
                      <option key={idx} value={idx}>
                        {col || `Coluna ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!!etapasOficiais && headerRow !== null && mapping.etapa === undefined && (
        <div className="flex flex-wrap items-start gap-3 rounded-xl border p-3">
          <div className="min-w-0 flex-1">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={etapaPelaEstrutura}
                onChange={(e) => setEtapaPelaEstrutura(e.target.checked)}
              />
              Deduzir a etapa pela estrutura da planilha
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              A planilha não tem coluna de etapa. O sistema trata como cabeçalho de etapa a linha
              que tem descrição e nenhum valor (sem unidade, quantidade nem preço) — com ou sem
              numeração — e aplica essa etapa aos itens abaixo dela.
            </p>
            {etapaPelaEstrutura && !!etapasEncontradas.length && (
              <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs">
                <span className="font-medium">
                  {etapasEncontradas.length} etapa(s) encontrada(s):
                </span>{" "}
                {etapasEncontradas.join(" · ")}
              </p>
            )}
            {etapaPelaEstrutura && !etapasEncontradas.length && (
              <p className="mt-2 text-xs text-atencao">
                Nenhum cabeçalho de etapa reconhecido nessa aba. Os itens entram sem etapa e você
                classifica depois.
              </p>
            )}
          </div>
        </div>
      )}

      {itensPreview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {abas.length > 1 ? "5" : "4"}. Confira os itens ({itensValidos.length} válidos de{" "}
              {itensPreview.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    {(mapping.etapa !== undefined || !!classificacao) && <TableHead>Etapa</TableHead>}
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Un.</TableHead>
                    {incluiQuantidade && <TableHead>Qtd.</TableHead>}
                    <TableHead>Preço unit.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensPreview.map((item) => (
                    <TableRow
                      key={item.rowIndex}
                      className={!item.valido || excluidas.has(item.rowIndex) ? "opacity-40" : ""}
                    >
                      <TableCell>
                        {item.valido && (
                          <input
                            type="checkbox"
                            checked={!excluidas.has(item.rowIndex)}
                            onChange={() => toggleExcluida(item.rowIndex)}
                          />
                        )}
                      </TableCell>
                      {(mapping.etapa !== undefined || !!classificacao) && (
                        <TableCell className="max-w-40 truncate text-xs">
                          {item.etapa || "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-xs">{item.codigoSinapi || "—"}</TableCell>
                      <TableCell className="max-w-64 truncate text-xs">
                        {item.descricao || <span className="text-destructive">(vazio)</span>}
                      </TableCell>
                      <TableCell className="text-xs">{item.unidade || "—"}</TableCell>
                      {incluiQuantidade && (
                        <TableCell className="text-xs">
                          {item.quantidade === null ? (
                            <span className="text-destructive">inválido</span>
                          ) : (
                            item.quantidade
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-xs">
                        {item.precoUnitario === null ? (
                          <span className="text-destructive">inválido</span>
                        ) : (
                          item.precoUnitario
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={handleSubmit} disabled={pending || !itensValidos.length} className="w-fit">
        {pending
          ? "Salvando..."
          : `${labelBase} (${itensValidos.length} ${itensValidos.length === 1 ? "item" : "itens"})`}
      </Button>
    </div>
  );
}
