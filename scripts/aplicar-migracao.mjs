/**
 * Aplica um arquivo de supabase/migrations direto no Postgres do projeto, e
 * registra que aplicou.
 *
 * Existe porque esta máquina não tem `psql` e o projeto não está linkado ao
 * Supabase CLI (`supabase db push` precisaria de `supabase link` com o token de
 * acesso). Enquanto isso não existir, é por aqui.
 *
 * Tudo numa transação — migração que falha no meio não deixa metade aplicada —
 * e o REGISTRO entra na mesma transação: ou as duas coisas acontecem, ou
 * nenhuma. Gravar o registro depois do commit abriria a janela em que a
 * migração rodou e o banco não sabe.
 *
 * Uso:
 *   npm install pg --no-save
 *   PGPASSWORD='<senha>' npm run migrar supabase/migrations/0072_xxx.sql
 *   PGPASSWORD='<senha>' npm run migrar:status
 *   npm uninstall pg --no-save
 *
 * A senha nunca entra no arquivo: vem do ambiente, como o resto das chaves
 * (ver .env.local, que é gitignored).
 */
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import pg from "pg";

const HOST = "db.xptffsrjyrvemqvavzxg.supabase.co";
const PASTA = "supabase/migrations";

/** Valor semeado pela 0072 para as migrações aplicadas antes de existir registro. */
const SEM_CHECKSUM = "anterior-ao-registro";

/**
 * A chave é o NÚMERO, não o nome do arquivo.
 *
 * Renomear a descrição de uma migração já aplicada é inofensivo e acontece; o
 * número é o que de fato a identifica.
 */
function numeroDa(arquivo) {
  const m = path.basename(arquivo).match(/^(\d{4})/);
  return m ? m[1] : null;
}

function checksumDe(conteudo) {
  return createHash("sha256").update(conteudo).digest("hex");
}

function conectar() {
  if (!process.env.PGPASSWORD) {
    console.error("Defina PGPASSWORD com a senha do Postgres do projeto.");
    process.exit(1);
  }
  return new pg.Client({
    host: HOST,
    port: 5432,
    user: "postgres",
    password: process.env.PGPASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
}

/** Lista o que está no repositório × o que o banco diz ter aplicado. */
async function status() {
  const client = conectar();
  await client.connect();
  try {
    const { rows } = await client.query(
      "select nome, checksum, aplicada_em from schema_migracoes order by nome"
    );
    const aplicadas = new Map(rows.map((r) => [r.nome, r]));

    const arquivos = readdirSync(PASTA)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let pendentes = 0;
    let alteradas = 0;

    for (const arquivo of arquivos) {
      const numero = numeroDa(arquivo);
      const registro = numero ? aplicadas.get(numero) : null;

      if (!registro) {
        console.log(`PENDENTE   ${arquivo}`);
        pendentes++;
        continue;
      }

      const atual = checksumDe(readFileSync(path.join(PASTA, arquivo), "utf8"));
      if (registro.checksum !== SEM_CHECKSUM && registro.checksum !== atual) {
        console.log(`ALTERADA   ${arquivo}  (o arquivo mudou depois de aplicado)`);
        alteradas++;
      } else {
        console.log(`aplicada   ${arquivo}`);
      }
    }

    // Registro no banco sem arquivo no repositório: migração aplicada e depois
    // apagada, ou banco de outra origem.
    const numerosNoDisco = new Set(arquivos.map(numeroDa));
    for (const nome of aplicadas.keys()) {
      if (!numerosNoDisco.has(nome)) console.log(`SEM ARQUIVO  ${nome} (registrada no banco)`);
    }

    console.log(
      `\n${arquivos.length} no repositório · ${aplicadas.size} registradas · ${pendentes} pendente(s) · ${alteradas} alterada(s)`
    );
  } finally {
    await client.end();
  }
}

async function aplicar(arquivo, { forcar }) {
  const numero = numeroDa(arquivo);
  if (!numero) {
    console.error(`O nome do arquivo precisa começar com quatro dígitos: ${arquivo}`);
    process.exit(1);
  }

  const sql = readFileSync(arquivo, "utf8");
  const checksum = checksumDe(sql);

  const client = conectar();
  await client.connect();

  try {
    const { rows } = await client.query(
      "select checksum, aplicada_em from schema_migracoes where nome = $1",
      [numero]
    );
    const registro = rows[0];

    if (registro && !forcar) {
      const quando = new Date(registro.aplicada_em).toLocaleString("pt-BR");

      if (registro.checksum === checksum || registro.checksum === SEM_CHECKSUM) {
        console.log(`JÁ APLICADA: ${arquivo} (em ${quando}). Nada a fazer.`);
        return;
      }

      /*
       * Arquivo editado depois de aplicado.
       *
       * Rodar de novo não é o conserto: o banco já tem o conteúdo antigo, e a
       * maioria das migrações deste projeto não é idempotente — um
       * `create policy` ou um `alter table add column` sem `if not exists`
       * falharia, e um `insert` de semente duplicaria linha. O caminho é
       * escrever uma migração NOVA com a diferença.
       */
      console.error(
        `RECUSADA: ${arquivo} já foi aplicada em ${quando}, mas o arquivo MUDOU desde então.\n\n` +
          `Rodar de novo não desfaz o que já está no banco. Escreva uma migração nova com a\n` +
          `diferença, ou use --forcar se você tem certeza de que reaplicar é seguro.`
      );
      process.exitCode = 1;
      return;
    }

    await client.query("begin");
    await client.query(sql);
    // Mesma transação: ou a migração e o registro entram juntos, ou nenhum dos
    // dois. Registrar depois do commit abriria a janela em que a migração
    // rodou e o banco não sabe.
    await client.query(
      `insert into schema_migracoes (nome, checksum) values ($1, $2)
       on conflict (nome) do update set checksum = excluded.checksum, aplicada_em = now()`,
      [numero, checksum]
    );
    await client.query("commit");
    console.log("APLICADA:", arquivo);
  } catch (erro) {
    await client.query("rollback").catch(() => {});
    console.error("FALHOU (nada foi aplicado):", erro.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

const args = process.argv.slice(2);
const forcar = args.includes("--forcar");
const alvo = args.find((a) => !a.startsWith("--"));

if (alvo === "status" || args.includes("--status")) {
  await status();
} else if (alvo) {
  await aplicar(alvo, { forcar });
} else {
  console.error(
    "Uso:\n" +
      "  node scripts/aplicar-migracao.mjs supabase/migrations/XXXX_nome.sql\n" +
      "  node scripts/aplicar-migracao.mjs status"
  );
  process.exit(1);
}
