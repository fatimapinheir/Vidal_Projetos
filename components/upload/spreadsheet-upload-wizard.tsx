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

export type CampoMapeavel = "codigo_sinapi" | "descricao" | "unidade" | "quantidade" | "preco_unitario";

const todosCamposLabel: Record<CampoMapeavel, string> = {
  codigo_sinapi: "Código (opcional)",
  descricao: "Descrição",
  unidade: "Unidade",
  quantidade: "Quantidade",
  preco_unitario: "Preço unitário",
};

export type ItemPlanilha = {
  codigo_sinapi?: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
};

export type MapeamentoSalvo = { linha_cabecalho: number; mapa_colunas: Record<string, number> } | null;

const CAMPOS_PADRAO: CampoMapeavel[] = [
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
  const camposObrigatorios = campos.filter((c) => c !== "codigo_sinapi");
  const camposLabel = Object.fromEntries(
    campos.map((c) => [c, todosCamposLabel[c]])
  ) as Record<CampoMapeavel, string>;
  const incluiQuantidade = campos.includes("quantidade");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [headerRow, setHeaderRow] = useState<number | null>(mapeamentoSalvo?.linha_cabecalho ?? null);
  const [mapping, setMapping] = useState<Partial<Record<CampoMapeavel, number>>>(
    (mapeamentoSalvo?.mapa_colunas as Partial<Record<CampoMapeavel, number>>) ?? {}
  );
  const [excluidas, setExcluidas] = useState<Set<number>>(new Set());
  const [mesReferencia, setMesReferencia] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setError(null);

    const buffer = await selected.arrayBuffer();
    const workbook = read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
    setRows(data.map((row) => row.map((cell) => String(cell ?? ""))));
  }

  const colunasCabecalho = headerRow !== null ? rows[headerRow] ?? [] : [];

  const itensPreview = useMemo(() => {
    if (headerRow === null) return [];
    const camposPreenchidos = camposObrigatorios.every((c) => mapping[c] !== undefined);
    if (!camposPreenchidos) return [];

    return rows.slice(headerRow + 1).map((row, i) => {
      const rowIndex = headerRow + 1 + i;
      const descricao = mapping.descricao !== undefined ? row[mapping.descricao]?.trim() : "";
      const unidade = mapping.unidade !== undefined ? row[mapping.unidade]?.trim() : "";
      const quantidade = incluiQuantidade
        ? mapping.quantidade !== undefined
          ? parseNumeroBR(row[mapping.quantidade])
          : null
        : 1;
      const precoUnitario =
        mapping.preco_unitario !== undefined ? parseNumeroBR(row[mapping.preco_unitario]) : null;
      const codigoSinapi = mapping.codigo_sinapi !== undefined ? row[mapping.codigo_sinapi]?.trim() : "";

      const valido = !!descricao && !!unidade && quantidade !== null && precoUnitario !== null;

      return { rowIndex, descricao, unidade, quantidade, precoUnitario, codigoSinapi, valido };
    });
  }, [rows, headerRow, mapping]);

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
    if (!itensValidos.length) return setError("Nenhum item válido para importar.");

    startTransition(async () => {
      const prefixo = mostrarMesReferencia && mesReferencia ? mesReferencia : (prefixoPath ?? "geral");
      const envio = await enviarArquivoParaStorage(bucket, prefixo, file);
      if (envio.path === null) return setError(envio.error);

      const result = await onConfirm({
        itens: itensValidos.map((item) => ({
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

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Escolha a linha de cabeçalho</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-64 overflow-auto">
              <Table>
                <TableBody>
                  {rows.slice(0, 20).map((row, i) => (
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
            <CardTitle className="text-base">3. Mapeie as colunas</CardTitle>
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

      {itensPreview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              4. Confira os itens ({itensValidos.length} válidos de {itensPreview.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
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
