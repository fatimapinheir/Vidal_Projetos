/**
 * Carga do cronograma da CASA VIDAL ALPHA.
 *
 * Transcreve o plano de 15 etapas e 152 microetapas enviado pelo engenheiro.
 * Rode uma vez; rodar de novo duplicaria tudo (o script recusa se já houver
 * etapas na obra).
 *
 * Uso:
 *   npm install pg --no-save
 *   PGPASSWORD='<senha>' node --experimental-strip-types scripts/carga-cronograma-alpha.mts
 */
import pg from "pg";
import { calcularCPM } from "../lib/cronograma/cpm.ts";

/** Primeiro dia de obra. Toda tarefa "Início" é ancorada aqui. */
const INICIO_OBRA = "2026-09-08";

type Tarefa = {
  cod: string;
  nome: string;
  dias: number;
  /** Códigos das predecessoras. Vazio = tarefa âncora, presa ao início da obra. */
  dep?: string[];
  /** `inicio_inicio` para atividade que corre JUNTO com a predecessora. */
  tipo?: "termino_inicio" | "inicio_inicio";
  /** Duração que o plano deixou como "conforme projeto" — ver o relatório. */
  aDefinir?: boolean;
};

const ETAPAS: { nome: string; tarefas: Tarefa[] }[] = [
  {
    nome: "1.0 — Serviços preliminares",
    tarefas: [
      { cod: "1.1", nome: "Limpeza do terreno", dias: 2 },
      { cod: "1.2", nome: "Instalação provisória de água e energia", dias: 1, dep: ["1.1"] },
      { cod: "1.3", nome: "Instalação do canteiro e depósito", dias: 2, dep: ["1.1"] },
      { cod: "1.4", nome: "Conferência dos projetos e compatibilização", dias: 2 },
      { cod: "1.5", nome: "Conferência de níveis e referências topográficas", dias: 1, dep: ["1.1"] },
      { cod: "1.6", nome: "Locação da casa e dos eixos", dias: 2, dep: ["1.5"] },
      { cod: "1.7", nome: "Locação da piscina e do deck", dias: 1, dep: ["1.5"] },
      { cod: "1.8", nome: "Planejamento das compras e recebimento inicial", dias: 2 },
    ],
  },
  {
    nome: "2.0 — Fundação e infraestrutura",
    tarefas: [
      { cod: "2.1", nome: "Escavação das sapatas", dias: 3, dep: ["1.6"] },
      { cod: "2.2", nome: "Regularização do fundo das escavações", dias: 1, dep: ["2.1"] },
      { cod: "2.3", nome: "Montagem das armaduras das sapatas", dias: 2, dep: ["2.2"] },
      { cod: "2.4", nome: "Montagem das formas das sapatas, quando necessárias", dias: 1, dep: ["2.3"] },
      { cod: "2.5", nome: "Conferência e concretagem das sapatas", dias: 1, dep: ["2.3", "2.4"] },
      { cod: "2.6", nome: "Cura inicial e liberação das fundações", dias: 3, dep: ["2.5"] },
      { cod: "2.7", nome: "Escavação das vigas baldrame", dias: 2, dep: ["2.5"] },
      { cod: "2.8", nome: "Montagem das formas do baldrame", dias: 2, dep: ["2.7"] },
      { cod: "2.9", nome: "Montagem das armaduras do baldrame", dias: 2, dep: ["2.7"] },
      { cod: "2.10", nome: "Passagens hidráulicas sob o baldrame", dias: 1, dep: ["2.7"] },
      { cod: "2.11", nome: "Conferência e concretagem do baldrame", dias: 1, dep: ["2.8", "2.9", "2.10"] },
      { cod: "2.12", nome: "Desforma e impermeabilização do baldrame", dias: 3, dep: ["2.11"] },
      { cod: "2.13", nome: "Aterro interno e compactação em camadas", dias: 3, dep: ["2.12"] },
      { cod: "2.14", nome: "Instalação das tubulações enterradas", dias: 2, dep: ["2.13"] },
      { cod: "2.15", nome: "Testes das tubulações enterradas", dias: 1, dep: ["2.14"] },
      { cod: "2.16", nome: "Preparação do lastro e contrapiso inicial", dias: 2, dep: ["2.15"] },
    ],
  },
  {
    nome: "3.0 — Estrutura de concreto e lajes",
    tarefas: [
      { cod: "3.1", nome: "Montagem de pilares e arranques", dias: 2, dep: ["2.12"] },
      { cod: "3.2", nome: "Montagem de formas dos pilares", dias: 2, dep: ["3.1"] },
      { cod: "3.3", nome: "Concretagem dos pilares", dias: 1, dep: ["3.2"] },
      { cod: "3.4", nome: "Desforma e preparação dos pilares", dias: 2, dep: ["3.3"] },
      { cod: "3.5", nome: "Escoramento e formas da Laje 1", dias: 4, dep: ["3.4"] },
      { cod: "3.6", nome: "Montagem das armaduras da Laje 1", dias: 3, dep: ["3.5"] },
      { cod: "3.7", nome: "Passagens elétricas e hidráulicas na Laje 1", dias: 2, dep: ["3.5"] },
      { cod: "3.8", nome: "Conferência estrutural e concretagem da Laje 1", dias: 1, dep: ["3.6", "3.7"] },
      { cod: "3.9", nome: "Cura e manutenção da Laje 1", dias: 7, dep: ["3.8"], aDefinir: true },
      { cod: "3.10", nome: "Montagem de pilares e elementos do nível seguinte", dias: 3, dep: ["3.8", "3.9"] },
      { cod: "3.11", nome: "Formas e escoramento da Laje 2", dias: 4, dep: ["3.10"] },
      { cod: "3.12", nome: "Montagem das armaduras da Laje 2", dias: 3, dep: ["3.11"] },
      { cod: "3.13", nome: "Passagens de instalações na Laje 2", dias: 2, dep: ["3.11"] },
      { cod: "3.14", nome: "Conferência e concretagem da Laje 2", dias: 1, dep: ["3.12", "3.13"] },
      { cod: "3.15", nome: "Cura e manutenção da Laje 2", dias: 7, dep: ["3.14"], aDefinir: true },
      { cod: "3.16", nome: "Retirada programada de escoramentos", dias: 2, dep: ["3.15"], aDefinir: true },
    ],
  },
  {
    nome: "4.0 — Alvenaria e vedações",
    tarefas: [
      { cod: "4.1", nome: "Marcação das paredes", dias: 2, dep: ["2.16", "3.16"] },
      { cod: "4.2", nome: "Elevação da alvenaria externa", dias: 5, dep: ["4.1"] },
      { cod: "4.3", nome: "Elevação das paredes internas", dias: 6, dep: ["4.1"] },
      { cod: "4.4", nome: "Execução de vergas e contravergas", dias: 2, dep: ["4.2"], tipo: "inicio_inicio" },
      { cod: "4.5", nome: "Execução de shafts e fechamentos técnicos", dias: 2, dep: ["4.3"] },
      { cod: "4.6", nome: "Conferência de vãos de portas e janelas", dias: 1, dep: ["4.2", "4.3"] },
      { cod: "4.7", nome: "Encunhamento ou fechamento superior", dias: 2, dep: ["4.2", "4.3"] },
      { cod: "4.8", nome: "Correções e liberação para instalações", dias: 2, dep: ["4.4", "4.5", "4.6", "4.7"] },
    ],
  },
  {
    nome: "5.0 — Instalações elétricas, hidráulicas e complementares",
    tarefas: [
      { cod: "5.1", nome: "Marcação dos pontos elétricos", dias: 1, dep: ["4.8"] },
      { cod: "5.2", nome: "Abertura de rasgos e caixas elétricas", dias: 3, dep: ["5.1"] },
      { cod: "5.3", nome: "Eletrodutos e caixas embutidas", dias: 3, dep: ["5.2"] },
      { cod: "5.4", nome: "Tubulações de água fria e quente", dias: 4, dep: ["4.8"] },
      { cod: "5.5", nome: "Tubulações de esgoto e ventilação", dias: 3, dep: ["4.8"] },
      { cod: "5.6", nome: "Infraestrutura de ar-condicionado", dias: 2, dep: ["5.1"] },
      { cod: "5.7", nome: "Infraestrutura de dados, TV e automação", dias: 2, dep: ["5.1"] },
      { cod: "5.8", nome: "Teste das instalações hidráulicas", dias: 1, dep: ["5.4", "5.5"] },
      { cod: "5.9", nome: "Conferência das instalações elétricas embutidas", dias: 1, dep: ["5.3"] },
      { cod: "5.10", nome: "Fechamento dos rasgos e recomposição", dias: 2, dep: ["5.8", "5.9"] },
      { cod: "5.11", nome: "Instalações de gás, se previstas", dias: 2, dep: ["4.8"] },
      { cod: "5.12", nome: "Infraestrutura de iluminação e sancas", dias: 2, dep: ["5.1"] },
    ],
  },
  {
    nome: "6.0 — Reboco, regularização e impermeabilização",
    tarefas: [
      { cod: "6.1", nome: "Chapisco interno", dias: 3, dep: ["5.10"] },
      { cod: "6.2", nome: "Emboço/reboco interno", dias: 7, dep: ["6.1"] },
      { cod: "6.3", nome: "Chapisco externo", dias: 2, dep: ["4.2"] },
      { cod: "6.4", nome: "Reboco externo", dias: 5, dep: ["6.3"] },
      { cod: "6.5", nome: "Regularização de paredes de áreas molhadas", dias: 2, dep: ["6.2"] },
      { cod: "6.6", nome: "Impermeabilização de banheiros e áreas molhadas", dias: 3, dep: ["6.5"] },
      { cod: "6.7", nome: "Teste de estanqueidade da impermeabilização", dias: 2, dep: ["6.6"] },
      { cod: "6.8", nome: "Regularização de pisos internos", dias: 3, dep: ["2.16", "5.8", "5.9"] },
      { cod: "6.9", nome: "Contrapiso de áreas externas", dias: 3, dep: ["2.15"] },
      { cod: "6.10", nome: "Regularização de áreas de varanda e deck", dias: 2, dep: ["6.9"] },
      { cod: "6.11", nome: "Preparação de superfícies para revestimentos", dias: 2, dep: ["6.2", "6.7", "6.8", "6.10"] },
    ],
  },
  {
    nome: "7.0 — Piscina",
    tarefas: [
      { cod: "7.1", nome: "Locação e conferência dos níveis", dias: 1, dep: ["1.7"] },
      { cod: "7.2", nome: "Escavação da piscina", dias: 3, dep: ["7.1"] },
      { cod: "7.3", nome: "Regularização do fundo e preparação da base", dias: 2, dep: ["7.2"] },
      { cod: "7.4", nome: "Montagem das formas", dias: 2, dep: ["7.3"] },
      { cod: "7.5", nome: "Montagem das armaduras", dias: 3, dep: ["7.4"] },
      { cod: "7.6", nome: "Instalações hidráulicas e dispositivos embutidos", dias: 2, dep: ["7.4", "7.5"] },
      { cod: "7.7", nome: "Conferência e concretagem da estrutura", dias: 1, dep: ["7.5", "7.6"] },
      { cod: "7.8", nome: "Cura e liberação para serviços subsequentes", dias: 5, dep: ["7.7"], aDefinir: true },
      { cod: "7.9", nome: "Correções e preparação da superfície", dias: 2, dep: ["7.8"] },
      { cod: "7.10", nome: "Impermeabilização da piscina", dias: 3, dep: ["7.9"] },
      { cod: "7.11", nome: "Teste de estanqueidade", dias: 3, dep: ["7.10"] },
      { cod: "7.12", nome: "Assentamento do revestimento interno", dias: 5, dep: ["7.11"] },
      { cod: "7.13", nome: "Rejuntamento e acabamento dos detalhes", dias: 2, dep: ["7.12"] },
      { cod: "7.14", nome: "Instalação de bomba, filtro e equipamentos", dias: 2, dep: ["7.13"] },
      { cod: "7.15", nome: "Enchimento, testes e regulagem", dias: 2, dep: ["7.13", "7.14"] },
    ],
  },
  {
    nome: "8.0 — Deck e áreas externas",
    tarefas: [
      { cod: "8.1", nome: "Regularização do terreno do deck", dias: 2, dep: ["7.2"] },
      { cod: "8.2", nome: "Execução da base e compactação", dias: 3, dep: ["8.1"] },
      { cod: "8.3", nome: "Infraestrutura de drenagem", dias: 2, dep: ["8.1"] },
      { cod: "8.4", nome: "Execução da base de concreto, se prevista", dias: 3, dep: ["8.2", "8.3"] },
      { cod: "8.5", nome: "Impermeabilização, se necessária", dias: 2, dep: ["8.4"] },
      { cod: "8.6", nome: "Assentamento do revestimento do deck", dias: 4, dep: ["8.4", "8.5"] },
      { cod: "8.7", nome: "Rejuntamento e arremates", dias: 2, dep: ["8.6"] },
      { cod: "8.8", nome: "Rodapés, soleiras e encontros com a piscina", dias: 2, dep: ["8.6"] },
      { cod: "8.9", nome: "Limpeza e acabamento externo", dias: 1, dep: ["8.7", "8.8"] },
    ],
  },
  {
    nome: "9.0 — Forros, gesso e preparação para iluminação",
    tarefas: [
      { cod: "9.1", nome: "Conferência das instalações sobre o forro", dias: 1, dep: ["5.3", "5.6", "5.12"] },
      { cod: "9.2", nome: "Montagem da estrutura do forro", dias: 3, dep: ["9.1"] },
      { cod: "9.3", nome: "Fechamento com placas de gesso", dias: 4, dep: ["9.2"] },
      { cod: "9.4", nome: "Execução de sancas e cortineiros", dias: 3, dep: ["9.2"] },
      { cod: "9.5", nome: "Tratamento das juntas e parafusos", dias: 3, dep: ["9.3", "9.4"] },
      { cod: "9.6", nome: "Lixamento e preparação", dias: 2, dep: ["9.5"] },
      { cod: "9.7", nome: "Recortes e conferência dos pontos de iluminação", dias: 1, dep: ["9.3", "9.6"] },
    ],
  },
  {
    nome: "10.0 — Revestimentos de paredes e pisos",
    tarefas: [
      { cod: "10.1", nome: "Paginação dos revestimentos", dias: 2, dep: ["1.4"] },
      { cod: "10.2", nome: "Assentamento dos revestimentos dos banheiros", dias: 5, dep: ["6.7"] },
      { cod: "10.3", nome: "Assentamento dos revestimentos da cozinha e áreas de serviço", dias: 4, dep: ["6.7"] },
      { cod: "10.4", nome: "Revestimento de paredes decorativas", dias: 3, dep: ["6.11"] },
      { cod: "10.5", nome: "Assentamento do porcelanato interno 1 × 1 m", dias: 8, dep: ["6.8"] },
      { cod: "10.6", nome: "Assentamento do porcelanato de varandas", dias: 3, dep: ["6.9", "6.10"] },
      { cod: "10.7", nome: "Rejuntamento dos pisos e paredes", dias: 4, dep: ["10.2", "10.3", "10.5", "10.6"] },
      { cod: "10.8", nome: "Instalação de rodapés", dias: 3, dep: ["10.5"] },
      { cod: "10.9", nome: "Soleiras, peitoris e acabamentos de transição", dias: 2, dep: ["10.5"] },
      { cod: "10.10", nome: "Proteção dos revestimentos concluídos", dias: 1, dep: ["10.7"] },
      { cod: "10.11", nome: "Revisão de peças ocas, danificadas ou desniveladas", dias: 2, dep: ["10.7"] },
      { cod: "10.12", nome: "Limpeza técnica dos revestimentos", dias: 2, dep: ["10.11"] },
    ],
  },
  {
    nome: "11.0 — Pintura interna e externa",
    tarefas: [
      { cod: "11.1", nome: "Verificação de umidade e preparação das paredes", dias: 2, dep: ["6.2"] },
      { cod: "11.2", nome: "Correções e aplicação de massa interna", dias: 4, dep: ["11.1"] },
      { cod: "11.3", nome: "Lixamento e correções finais", dias: 3, dep: ["11.2"] },
      { cod: "11.4", nome: "Aplicação de selador ou fundo preparador", dias: 1, dep: ["11.3"] },
      { cod: "11.5", nome: "Primeira demão de pintura interna", dias: 2, dep: ["11.4"] },
      { cod: "11.6", nome: "Segunda demão e acabamento interno", dias: 2, dep: ["11.5"] },
      { cod: "11.7", nome: "Preparação da pintura externa", dias: 3, dep: ["6.4"] },
      { cod: "11.8", nome: "Pintura externa", dias: 4, dep: ["11.7"] },
      { cod: "11.9", nome: "Retoques e arremates", dias: 2, dep: ["13.9"] },
    ],
  },
  {
    nome: "12.0 — Esquadrias, portas e vidros",
    tarefas: [
      { cod: "12.1", nome: "Conferência das medidas finais das esquadrias", dias: 1, dep: ["4.6"] },
      { cod: "12.2", nome: "Instalação de contramarcos, se previstos", dias: 2, dep: ["4.8"] },
      { cod: "12.3", nome: "Instalação de janelas e esquadrias externas", dias: 3, dep: ["12.1", "12.2"] },
      { cod: "12.4", nome: "Instalação de portas internas", dias: 2, dep: ["10.5", "12.1"] },
      { cod: "12.5", nome: "Instalação de vidros e ferragens", dias: 2, dep: ["12.3"] },
      { cod: "12.6", nome: "Regulagem e vedação das esquadrias", dias: 2, dep: ["12.3", "12.4", "12.5"] },
    ],
  },
  {
    nome: "13.0 — Instalações finais e louças",
    tarefas: [
      { cod: "13.1", nome: "Instalação de tomadas e interruptores", dias: 2, dep: ["11.6"] },
      { cod: "13.2", nome: "Instalação de luminárias e perfis de LED", dias: 3, dep: ["9.7", "11.6"] },
      { cod: "13.3", nome: "Instalação de quadros e dispositivos elétricos", dias: 2, dep: ["5.9"] },
      { cod: "13.4", nome: "Instalação de vasos sanitários", dias: 1, dep: ["10.7"] },
      { cod: "13.6", nome: "Instalação de bancadas e tampos", dias: 3, dep: ["10.7"] },
      { cod: "13.5", nome: "Instalação de cubas, torneiras e metais", dias: 2, dep: ["13.6"] },
      { cod: "13.7", nome: "Instalação de chuveiros e acessórios", dias: 2, dep: ["10.7"] },
      { cod: "13.8", nome: "Instalação de equipamentos hidráulicos", dias: 2, dep: ["5.10"] },
      { cod: "13.9", nome: "Testes finais de hidráulica e elétrica", dias: 2, dep: ["13.1", "13.3", "13.4", "13.5", "13.7", "13.8"] },
      { cod: "13.10", nome: "Instalação de equipamentos de climatização", dias: 2, dep: ["5.6", "11.6"] },
    ],
  },
  {
    nome: "14.0 — Fachada, paisagismo e complementos externos",
    tarefas: [
      { cod: "14.1", nome: "Execução de detalhes e revestimentos da fachada", dias: 4, dep: ["6.4"] },
      { cod: "14.2", nome: "Instalação de portões e ferragens externas", dias: 2, dep: ["14.1"] },
      { cod: "14.3", nome: "Execução de calçadas e acessos", dias: 3, dep: ["14.1"] },
      { cod: "14.4", nome: "Execução de drenagem superficial", dias: 2, dep: ["14.3"] },
      { cod: "14.5", nome: "Preparação do solo para paisagismo", dias: 2, dep: ["14.3", "14.4"] },
      { cod: "14.6", nome: "Plantio e instalação de elementos paisagísticos", dias: 3, dep: ["14.5"] },
      { cod: "14.7", nome: "Instalação de iluminação externa", dias: 2, dep: ["14.4", "11.8"] },
    ],
  },
  {
    nome: "15.0 — Limpeza, testes e entrega",
    tarefas: [
      { cod: "15.1", nome: "Retirada de sobras e resíduos da obra", dias: 2, dep: ["14.6"] },
      { cod: "15.2", nome: "Limpeza fina dos ambientes", dias: 2, dep: ["15.1"] },
      { cod: "15.3", nome: "Testes de funcionamento de equipamentos", dias: 2, dep: ["13.9", "13.10"] },
      { cod: "15.4", nome: "Vistoria de acabamento e lista de pendências", dias: 2, dep: ["15.2", "15.3"] },
      { cod: "15.5", nome: "Correção das pendências", dias: 3, dep: ["15.4"] },
      { cod: "15.6", nome: "Vistoria final e entrega", dias: 1, dep: ["15.5"] },
    ],
  },
];

const cliente = new pg.Client({
  host: "db.xptffsrjyrvemqvavzxg.supabase.co",
  user: "postgres",
  password: process.env.PGPASSWORD,
  database: "postgres",
  port: 5432,
  ssl: { rejectUnauthorized: false },
});
await cliente.connect();

const { rows: [obra] } = await cliente.query(
  `select id, nome from obras where nome ilike '%ALPHA%'`
);
if (!obra) throw new Error("obra CASA VIDAL ALPHA não encontrada");

const { rows: [existente] } = await cliente.query(
  `select count(*)::int n from cronograma_etapas where obra_id = $1`, [obra.id]
);
if (existente.n > 0) {
  console.error(`A obra já tem ${existente.n} etapa(s). Apague antes de carregar de novo.`);
  process.exit(1);
}

await cliente.query("begin");

const idPorCodigo = new Map<string, string>();
let totalTarefas = 0;

for (const [i, etapa] of ETAPAS.entries()) {
  const { rows: [linhaEtapa] } = await cliente.query(
    `insert into cronograma_etapas (obra_id, nome, ordem) values ($1,$2,$3) returning id`,
    [obra.id, etapa.nome, i + 1]
  );

  for (const [j, t] of etapa.tarefas.entries()) {
    const ancora = !t.dep?.length ? INICIO_OBRA : null;
    const { rows: [linha] } = await cliente.query(
      `insert into cronograma_tarefas
         (obra_id, etapa_id, nome, duracao_dias, restricao_inicio_nao_antes_de, ordem)
       values ($1,$2,$3,$4,$5,$6) returning id`,
      [obra.id, linhaEtapa.id, `${t.cod} ${t.nome}`, t.dias, ancora, j + 1]
    );
    idPorCodigo.set(t.cod, linha.id);
    totalTarefas++;
  }
}

let totalDeps = 0;
for (const etapa of ETAPAS) {
  for (const t of etapa.tarefas) {
    for (const codPred of t.dep ?? []) {
      const pred = idPorCodigo.get(codPred);
      if (!pred) throw new Error(`predecessora ${codPred} de ${t.cod} não existe`);
      await cliente.query(
        `insert into cronograma_dependencias
           (tarefa_predecessora_id, tarefa_sucessora_id, tipo, lag_dias)
         values ($1,$2,$3,0)`,
        [pred, idPorCodigo.get(t.cod), t.tipo ?? "termino_inicio"]
      );
      totalDeps++;
    }
  }
}

// --- Cálculo das datas, com o mesmo motor que o sistema usa ---
const tarefasCPM = ETAPAS.flatMap((e) =>
  e.tarefas.map((t) => ({
    id: idPorCodigo.get(t.cod)!,
    nome: t.nome,
    duracaoDias: t.dias,
    restricaoInicioNaoAntesDe: !t.dep?.length ? INICIO_OBRA : null,
    dataInicioReal: null,
    dataFimReal: null,
  }))
);
const depsCPM = ETAPAS.flatMap((e) =>
  e.tarefas.flatMap((t) =>
    (t.dep ?? []).map((c) => ({
      predecessoraId: idPorCodigo.get(c)!,
      sucessoraId: idPorCodigo.get(t.cod)!,
      tipo: (t.tipo ?? "termino_inicio") as "termino_inicio" | "inicio_inicio",
      lagDias: 0,
    }))
  )
);

const calculadas = calcularCPM(tarefasCPM, depsCPM, []);
for (const c of calculadas) {
  await cliente.query(
    `update cronograma_tarefas set
       data_inicio_cedo=$2, data_fim_cedo=$3,
       data_inicio_tarde=$4, data_fim_tarde=$5,
       folga_dias=$6, critica=$7
     where id=$1`,
    [c.id, c.dataInicioCedo, c.dataFimCedo, c.dataInicioTarde, c.dataFimTarde, c.folgaDias, c.critica]
  );
}

await cliente.query("commit");

const fins = calculadas.map((c) => c.dataFimCedo).sort();
const inicios = calculadas.map((c) => c.dataInicioCedo).sort();
console.log(`etapas:       ${ETAPAS.length}`);
console.log(`tarefas:      ${totalTarefas}`);
console.log(`dependências: ${totalDeps}`);
console.log(`âncoras:      ${tarefasCPM.filter((t) => t.restricaoInicioNaoAntesDe).length} (em ${INICIO_OBRA})`);
console.log(`\ninício da obra:    ${inicios[0]}`);
console.log(`término previsto:  ${fins.at(-1)}`);
console.log(`caminho crítico:   ${calculadas.filter((c) => c.critica).length} tarefas`);
console.log(`a definir (cura/escoramento): ${ETAPAS.flatMap((e) => e.tarefas).filter((t) => t.aDefinir).map((t) => t.cod).join(", ")}`);

await cliente.end();
