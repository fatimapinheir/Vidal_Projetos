/**
 * Aplica um arquivo de supabase/migrations direto no Postgres do projeto.
 *
 * Existe porque esta máquina não tem `psql` e o projeto não está linkado ao
 * Supabase CLI (`supabase db push` precisaria de `supabase link` com o token de
 * acesso). Enquanto isso não existir, é por aqui.
 *
 * Tudo numa transação: migração que falha no meio não deixa metade aplicada.
 *
 * Uso:
 *   npm install pg --no-save
 *   PGPASSWORD='<senha do Postgres>' node scripts/aplicar-migracao.mjs \
 *     supabase/migrations/0033_avanco_por_tarefa.sql
 *   npm uninstall pg --no-save
 *
 * A senha nunca entra no arquivo: vem do ambiente, como o resto das chaves
 * (ver .env.local).
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const HOST = "db.xptffsrjyrvemqvavzxg.supabase.co";

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("Informe o arquivo: node scripts/aplicar-migracao.mjs supabase/migrations/XXXX.sql");
  process.exit(1);
}
if (!process.env.PGPASSWORD) {
  console.error("Defina PGPASSWORD com a senha do Postgres do projeto.");
  process.exit(1);
}

const sql = readFileSync(arquivo, "utf8");

const client = new pg.Client({
  host: HOST,
  port: 5432,
  user: "postgres",
  password: process.env.PGPASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log("APLICADA:", arquivo);
} catch (erro) {
  await client.query("rollback");
  console.error("FALHOU (nada foi aplicado):", erro.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
