/**
 * Encontra (e opcionalmente apaga) objetos órfãos nos buckets de anexo de
 * compra: arquivos que subiram mas que nenhuma linha do banco referencia.
 *
 * Eles aparecem quando alguém anexa um arquivo e depois abandona o formulário
 * ou o salvamento falha: o upload já aconteceu, a linha nunca nasceu. O commit
 * 3dbae19 fez a tentativa seguinte reaproveitar o upload (cache por
 * nome+tamanho+data), o que estanca a multiplicação — mas não limpa o que já
 * tinha acumulado, nem o abandono em si.
 *
 * Apagar é pela API de Storage, não por `delete from storage.objects`: a tabela
 * é só o índice, e apagar a linha deixaria o arquivo no backend ocupando espaço
 * sem ninguém para achá-lo.
 *
 *   node --env-file=.env.local scripts/orfaos-storage.mjs            # lista
 *   node --env-file=.env.local scripts/orfaos-storage.mjs --apagar   # apaga
 *
 * ATENÇÃO: dev e produção dividem o mesmo Supabase. Apagar aqui apaga no ar.
 */
import { createClient } from "@supabase/supabase-js";

const BUCKETS = ["comprovantes-pagamento", "cotacoes"];
const APAGAR = process.argv.includes("--apagar");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY (rode com --env-file=.env.local).");
  process.exit(1);
}
const admin = createClient(url, chave, { auth: { persistSession: false } });

/** Lista todo o bucket, descendo nas pastas ({obra_id}/... é a convenção). */
async function listarTudo(bucket, prefixo = "") {
  const achados = [];
  const PAGINA = 100;
  for (let offset = 0; ; offset += PAGINA) {
    const { data, error } = await admin.storage
      .from(bucket)
      .list(prefixo, { limit: PAGINA, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list ${bucket}/${prefixo}: ${error.message}`);
    if (!data?.length) break;
    for (const item of data) {
      const caminho = prefixo ? `${prefixo}/${item.name}` : item.name;
      // pasta: o list devolve id nulo e sem metadata
      if (item.id === null) achados.push(...(await listarTudo(bucket, caminho)));
      else achados.push({ name: caminho, created_at: item.created_at, tamanho: item.metadata?.size ?? 0 });
    }
    if (data.length < PAGINA) break;
  }
  return achados;
}

/** Lê uma coluna inteira, paginando (o REST corta em 1000 por requisição). */
async function colunaInteira(tabela, colunas) {
  const linhas = [];
  const PAGINA = 1000;
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await admin.from(tabela).select(colunas).range(de, de + PAGINA - 1);
    if (error) throw new Error(`select ${tabela}: ${error.message}`);
    linhas.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGINA) break;
  }
  return linhas;
}

/**
 * Todo caminho que alguma linha referencia, por bucket.
 *
 * `compras.anexo_cotacao_path` entra aqui mesmo estando obsoleta desde a 0048:
 * a coluna foi mantida de propósito para não perder o caminho de linha antiga,
 * então ainda é referência viva no bucket `cotacoes`.
 */
async function referenciados() {
  const porBucket = new Map(BUCKETS.map((b) => [b, new Set()]));
  const anexos = await colunaInteira("compra_anexos", "bucket, path");
  for (const a of anexos) porBucket.get(a.bucket)?.add(a.path);

  const parcelas = await colunaInteira("compra_parcelas", "comprovante_pagamento_path");
  for (const p of parcelas) {
    if (p.comprovante_pagamento_path) porBucket.get("comprovantes-pagamento").add(p.comprovante_pagamento_path);
  }

  const compras = await colunaInteira("compras", "anexo_cotacao_path");
  for (const c of compras) {
    if (c.anexo_cotacao_path) porBucket.get("cotacoes").add(c.anexo_cotacao_path);
  }
  return porBucket;
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;

const refs = await referenciados();
let totalOrfaos = 0;
let totalBytes = 0;

for (const bucket of BUCKETS) {
  const objetos = await listarTudo(bucket);
  const usados = refs.get(bucket);
  const orfaos = objetos
    .filter((o) => !usados.has(o.name))
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

  console.log(`\n=== ${bucket} ===`);
  console.log(`objetos: ${objetos.length} | referenciados: ${usados.size} | órfãos: ${orfaos.length}`);
  for (const o of orfaos) {
    console.log(`  ${String(o.created_at).slice(0, 19).replace("T", " ")}  ${mb(o.tamanho).padStart(9)}  ${o.name}`);
  }
  const bytes = orfaos.reduce((s, o) => s + Number(o.tamanho), 0);
  if (orfaos.length) console.log(`  --- subtotal: ${orfaos.length} arquivo(s), ${mb(bytes)}`);
  totalOrfaos += orfaos.length;
  totalBytes += bytes;

  if (APAGAR && orfaos.length) {
    const caminhos = orfaos.map((o) => o.name);
    const { data, error } = await admin.storage.from(bucket).remove(caminhos);
    if (error) throw new Error(`remove ${bucket}: ${error.message}`);
    console.log(`  APAGADOS: ${data?.length ?? 0} de ${caminhos.length}`);
  }
}

console.log(`\ntotal: ${totalOrfaos} órfão(s), ${mb(totalBytes)}`);
if (!APAGAR && totalOrfaos) console.log("nada foi apagado (rode com --apagar para apagar).");
