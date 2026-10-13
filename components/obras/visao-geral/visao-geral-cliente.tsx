import Link from "next/link";
import Image from "next/image";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Cloud,
  CloudRain,
  CloudSun,
  FileText,
  HardHat,
  Hourglass,
  LineChart,
  Moon,
  NotebookPen,
  PackageCheck,
  PiggyBank,
  Sun,
  Target,
  Thermometer,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rosca } from "@/components/charts/rosca";
import { formatDateBR } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import type { DadosVisaoGeral } from "@/lib/obras/visao-geral";
import type { DadosClienteExtra, EtapaResumo } from "@/lib/obras/visao-cliente";
import {
  diagnosticarExecucao,
  type DiagnosticoExecucao,
} from "@/lib/obras/diagnostico-execucao";
import type { DiarioCondicao } from "@/lib/types/database.types";
import { TrilhaEtapas } from "./trilha-etapas";

/**
 * O traje dos títulos desta tela.
 *
 * Negrito sozinho não estava destacando: no corpo de 16px, a diferença entre
 * 600 e 400 some quando o título está cercado de cartões e números. Caixa
 * alta resolve pela forma, não pelo peso — a palavra muda de silhueta e o
 * olho encontra o começo de cada bloco antes de ler.
 *
 * Caixa alta por CSS e não no texto: o rótulo no DOM continua "Financeiro", e
 * é assim que o leitor de tela anuncia. Texto gravado em maiúsculas seria
 * lido letra por letra, como sigla.
 *
 * `tracking-wide` acompanha porque maiúscula sem respiro entre letras fecha a
 * palavra, e o tamanho cai um degrau porque caixa alta ocupa mais largura
 * para a mesma altura de letra.
 */
const TITULO = "text-[15px] font-bold tracking-wide uppercase";

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function porcento(valor: number) {
  return `${Math.round(valor)}%`;
}

const CLIMA: Record<DiarioCondicao, { rotulo: string; Icone: typeof Sun }> = {
  ensolarado: { rotulo: "Ensolarado", Icone: Sun },
  nublado: { rotulo: "Nublado", Icone: Cloud },
  chuvoso: { rotulo: "Chuvoso", Icone: CloudSun },
  chuva_forte: { rotulo: "Chuva forte", Icone: CloudRain },
};

const DIA_DA_SEMANA = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

function diaDaSemana(iso: string) {
  return DIA_DA_SEMANA[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

/** Barra rotulada: nome à esquerda, número à direita, trilho embaixo. */
function Barra({
  rotulo,
  percentual,
  cor,
}: {
  rotulo: string;
  percentual: number;
  cor: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted-foreground">{rotulo}</span>
        <span className="font-heading text-sm font-semibold tabular-nums">
          {porcento(percentual)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-grafico-trilho">
        <div
          className={cn("h-full rounded-full", cor)}
          style={{ width: `${Math.min(100, Math.max(0, percentual))}%` }}
        />
      </div>
    </div>
  );
}

/**
 * As quatro mensagens de "obra executada x valores pagos".
 *
 * Cada situação tem cor, ícone e texto próprios — e as cores não são enfeite:
 * verde é "siga", vermelho é "olhe isto", azul é "fique sabendo", âmbar é "o
 * sistema ainda não sabe". Quem lê de relance precisa saber se há algo a
 * fazer antes de ler a frase.
 *
 * Título em cor de texto normal e só o ícone colorido: parágrafo inteiro
 * colorido cansa e, no caso do vermelho, soa como erro de sistema em vez de
 * observação sobre a obra.
 */
const DIAGNOSTICO: Record<
  DiagnosticoExecucao,
  { Icone: typeof CheckCircle2; cor: string; chapa: string; titulo: string; corpo: string }
> = {
  positivo: {
    Icone: CheckCircle2,
    cor: "text-sucesso",
    chapa: "border-sucesso/25 bg-sucesso/10",
    titulo: "Ótimo! A obra está avançando conforme o esperado.",
    corpo:
      "O avanço da obra está à frente dos valores pagos em mão de obra e materiais, indicando um bom equilíbrio entre execução e gastos.",
  },
  mao_de_obra_adiantada: {
    Icone: AlertTriangle,
    cor: "text-destructive",
    chapa: "border-destructive/25 bg-destructive/10",
    titulo: "Atenção: os pagamentos de mão de obra estão adiantados.",
    corpo:
      "O percentual pago em mão de obra está acima do avanço físico da obra. É importante acompanhar a execução dos serviços para garantir que os pagamentos estejam compatíveis com o andamento.",
  },
  materiais_adiantados: {
    Icone: PackageCheck,
    cor: "text-primary-texto",
    chapa: "border-primary/25 bg-primary/10",
    titulo: "Informação: há mais materiais pagos do que serviços executados.",
    corpo:
      "Os gastos com materiais estão à frente do avanço físico da obra. Isso pode indicar a formação de estoque para as próximas etapas. Acompanhe se os materiais adquiridos estão disponíveis e armazenados adequadamente.",
  },
  sem_dados: {
    Icone: Hourglass,
    cor: "text-atencao",
    chapa: "border-atencao/25 bg-atencao/10",
    titulo: "Ainda não há dados suficientes para esta análise.",
    corpo:
      "A comparação aparece quando a obra tiver orçamento ativo e a primeira medição de avanço registrada pelo engenheiro.",
  },
};

function MensagemDiagnostico({ situacao }: { situacao: DiagnosticoExecucao }) {
  const { Icone, cor, chapa, titulo, corpo } = DIAGNOSTICO[situacao];
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-3", chapa)}>
      <Icone className={cn("mt-0.5 size-[18px] shrink-0", cor)} aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-sm leading-snug font-semibold">{titulo}</p>
        <p className="text-[13px] leading-snug text-muted-foreground">{corpo}</p>
      </div>
    </div>
  );
}

/** Faixa de leitura: um ícone e uma frase que interpreta os números acima. */
function Leitura({
  children,
  tom = "neutro",
}: {
  children: React.ReactNode;
  tom?: "neutro" | "bom";
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl p-3 text-sm",
        tom === "bom" ? "bg-sucesso/10 text-foreground" : "bg-accent/60 text-foreground"
      )}
    >
      <CheckCircle2
        className={cn("mt-0.5 size-4 shrink-0", tom === "bom" ? "text-sucesso" : "text-primary")}
        aria-hidden
      />
      <p className="leading-snug">{children}</p>
    </div>
  );
}

/**
 * O RDO de hoje, em chapa navy.
 *
 * É o único cartão escuro da tela, e isso é o que o põe em primeiro lugar sem
 * precisar de tamanho nem de cor de alerta. É também a primeira pergunta de
 * quem abre o portal pela manhã: o que aconteceu na obra hoje.
 *
 * A regra de acesso só entrega dia FECHADO, então a ausência do registro é
 * informação verdadeira — e dizê-la é melhor que deixar a tela muda.
 */
function CartaoRdo({
  extra,
  base,
  fotoUrl,
}: {
  extra: DadosClienteExtra;
  base: string;
  fotoUrl: string | null;
}) {
  const rdo = extra.rdoDeHoje;
  const clima = rdo?.clima ? CLIMA[rdo.clima] : null;
  const temperatura = rdo?.temperatura;
  /*
   * Condição e temperatura são campos separados no diário, e o engenheiro
   * preenche um sem o outro. O bloco aparece se QUALQUER um dos dois existir:
   * "39°C" sozinho já diz algo sobre o dia; esconder a linha inteira porque
   * faltou marcar "ensolarado" descartava a informação que existia.
   *
   * Sem condição, o ícone é o do termômetro — pôr um sol ao lado de um dia
   * que ninguém classificou seria inventar o tempo.
   */
  const temClima = !!clima || temperatura != null;
  const IconeClima = clima?.Icone ?? Thermometer;

  return (
    <Card className="gap-0 overflow-hidden border-0 bg-marca-navy p-0 text-white shadow-md">
      {/*
        Cabeçalho com a foto da obra ao fundo, quando houver.
        
        O véu por cima não é estética: o texto é branco e precisa de contraste
        contra QUALQUER foto que o engenheiro suba — inclusive um céu estourado
        de meio-dia. Ele vai de navy cheio na esquerda, onde mora o título, até
        quase transparente na direita, onde só a foto aparece. Sem foto, o véu
        é o próprio navy e o cabeçalho fica como era.
      */}
      <div className="relative isolate flex flex-wrap items-center gap-3 px-5 py-4">
        {fotoUrl && (
          <>
            <Image
              src={fotoUrl}
              alt=""
              fill
              unoptimized
              sizes="(min-width: 1024px) 40rem, 100vw"
              className="-z-20 object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-gradient-to-r from-marca-navy from-30% via-marca-navy/85 to-marca-navy/35"
            />
          </>
        )}
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/12">
          <FileText className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-lg leading-tight font-bold tracking-wide">RDO</p>
          <p className="text-[13px] text-white/65">Registro Diário de Obra</p>
        </div>
        {/*
          Com foto atrás, o selo ganha chapa própria.
          
          Ele fica na direita, que é justamente onde o véu do cabeçalho é mais
          fraco para deixar a imagem aparecer. Um `bg-sucesso/20` ali sumiria
          num céu estourado — a chapa navy translúcida devolve o piso de
          contraste sem tapar a foto em volta.
        */}
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            fotoUrl && "bg-marca-navy/75 ring-1 backdrop-blur-sm",
            rdo
              ? fotoUrl
                ? "text-sucesso ring-sucesso/35"
                : "bg-sucesso/20 text-sucesso"
              : fotoUrl
                ? "text-white/85 ring-white/25"
                : "bg-white/10 text-white/75"
          )}
        >
          <span
            aria-hidden
            className={cn("size-1.5 rounded-full", rdo ? "bg-sucesso" : "bg-white/60")}
          />
          {rdo ? "Atualizado hoje" : "Aguardando envio"}
        </span>
      </div>

      {/* Painel claro por dentro da chapa: é aqui que o dado mora, e dado se lê
          melhor sobre superfície clara. */}
      <div className="m-2 mt-0 flex flex-col gap-3 rounded-2xl bg-card p-4 text-card-foreground">
        {/*
          Data e clima na MESMA linha, e a data em corpo maior.
          
          Eram duas colunas, cada uma com rótulo ("Hoje", "Clima") sobre o
          valor — quatro linhas de texto para dizer duas coisas. A data é a
          âncora do documento e merecia o tamanho; o clima é o complemento
          dela, e complemento se lê ao lado, não numa coluna própria com
          título.
          
          O rótulo "Clima" sumiu junto: "Ensolarado" ao lado de um ícone de
          sol não precisa ser apresentado.
        */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div className="flex items-center gap-2.5">
            <CalendarDays className="size-[22px] shrink-0 text-primary" aria-hidden />
            <p className="font-heading text-lg leading-tight font-semibold">
              {formatDateBR(extra.hoje)}
              <span className="ml-1.5 text-base font-normal text-muted-foreground">
                ({diaDaSemana(extra.hoje)})
              </span>
            </p>
          </div>
          {temClima && (
            <div className="flex items-center gap-2">
              {/* O traço separa sem desenhar divisória: some quando a linha
                  quebra no celular e o clima vai para baixo da data. */}
              <span aria-hidden className="hidden h-5 w-px bg-border sm:block" />
              <IconeClima className="size-5 shrink-0 text-atencao" aria-hidden />
              <p className="text-base font-medium">
                {clima?.rotulo}
                {clima && temperatura != null && (
                  <span className="text-muted-foreground"> · </span>
                )}
                {temperatura != null && (
                  <span className={clima ? "font-normal" : undefined}>
                    {temperatura.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}°C
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/*
          Os três quadros aparecem SEMPRE, mesmo sem diário lançado.
          
          Antes o cartão trocava de forma: com RDO tinha três quadros e um
          botão azul; sem RDO encolhia para uma frase. A diferença de altura
          era grande o bastante para parecer defeito — e, pior, escondia um
          dado que existe mesmo sem diário: as frentes de serviço saem do
          cronograma, não do RDO.
          
          O que falta vira travessão, não zero. "0 pessoas na obra" é uma
          afirmação sobre o canteiro; o que o sistema sabe é só que o
          engenheiro ainda não lançou.
        */}
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-muted/70 p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="size-4" aria-hidden />
              <span className="text-xs">Pessoas na obra</span>
            </div>
            <p className="font-heading text-2xl font-semibold">
              {rdo ? rdo.pessoasNaObra : <span className="text-muted-foreground">—</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {rdo
                ? rdo.pessoasPrevistas > 0
                  ? `de ${rdo.pessoasPrevistas} na equipe`
                  : "confirmadas no dia"
                : "aguardando o diário"}
            </p>
          </div>

          {/*
            Sem diário, nenhum número aqui — nem o do cronograma.
            
            A contagem de frentes vem do cronograma e existe mesmo sem RDO,
            mas num cartão que anuncia "aguardando o envio" um número cheio no
            meio de dois travessões lê como se parte do diário tivesse
            chegado. O cartão é sobre o que o engenheiro registrou hoje: o que
            ele não registrou fica em branco, inclusive o que daria para
            deduzir de outro lugar.
          */}
          <div className="rounded-xl bg-muted/70 p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target className="size-4" aria-hidden />
              <span className="text-xs">Frentes de serviço</span>
            </div>
            <p className="font-heading text-2xl font-semibold">
              {rdo ? extra.frentesHoje : <span className="text-muted-foreground">—</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {rdo ? "em andamento" : "aguardando o diário"}
            </p>
          </div>

          <div className="rounded-xl bg-muted/70 p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="size-4" aria-hidden />
              <span className="text-xs">Principais atividades</span>
            </div>
            {rdo?.linhasDeAtividade.length ? (
              <ul className="mt-1 flex flex-col gap-0.5 text-[13px]">
                {rdo.linhasDeAtividade.slice(0, 3).map((linha, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span aria-hidden className="text-muted-foreground">
                      •
                    </span>
                    <span className="line-clamp-1">{linha}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[13px] text-muted-foreground">
                {rdo
                  ? "Sem descrição no registro de hoje."
                  : "Aparecem quando o diário for enviado."}
              </p>
            )}
          </div>
        </div>

        {/*
          O aviso em vermelho, a pedido.
          
          É a única coisa vermelha da área do cliente, e não contradiz a regra
          de não mostrar atraso: não julga o andamento da obra, avisa que um
          documento do dia ainda não chegou. Faixa com fundo, não só texto
          colorido — vermelho sobre branco no meio de outros parágrafos passa
          por engano de estilo; com a chapa, lê como aviso.
        */}
        {!rdo && (
          <p className="flex items-start gap-2.5 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">Aguardando o envio.</span> O engenheiro ainda não
              enviou o diário de hoje.
            </span>
          </p>
        )}

        {rdo ? (
          <Button
            nativeButton={false}
            className="h-11 w-full gap-2 text-sm"
            render={
              <Link href={`${base}/diario/${rdo.data}`}>
                <NotebookPen className="size-4" aria-hidden />
                <span className="font-semibold">CLIQUE AQUI</span>
                <span className="font-normal opacity-85">para ver o RDO completo</span>
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          />
        ) : (
          <Button
            variant="outline"
            nativeButton={false}
            className="h-11 w-full gap-2 text-sm"
            render={
              <Link href={`${base}/diario`}>
                Ver listagem de RDO
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          />
        )}
      </div>
    </Card>
  );
}

/**
 * A obra como o cliente quer ver.
 *
 * Separada da visão do engenheiro de propósito. As duas nasceram do mesmo
 * componente, com interruptores de permissão — e foram divergindo até o ponto
 * em que cada `visao === "cliente"` escondia mais do que mostrava.
 *
 * A regra que organiza esta tela: **nada de atraso**. Sem caminho crítico, sem
 * tarefa atrasada, sem parcela vencida, sem "o gasto está à frente da
 * execução". Isso é instrumento de quem conduz a obra; para quem a contratou,
 * vira ansiedade sem ação possível. O cliente vê o que está acontecendo, o que
 * vem pela frente e quanto custa.
 *
 * A ordem dos blocos é a ordem das perguntas: o que aconteceu hoje, a obra
 * está andando no ritmo do dinheiro, quanto já saiu e quanto falta, e onde a
 * obra está na linha do tempo.
 */
export function VisaoGeralCliente({
  dados,
  extra,
  obraId,
  obra,
  saudacao,
  nomeCliente,
}: {
  dados: DadosVisaoGeral;
  extra: DadosClienteExtra;
  obraId: string;
  /** Identificação da obra, para a faixa ao lado da saudação. */
  obra: {
    nome: string;
    detalhe: string | null;
    status: string;
    /** URLs assinadas das fotos. Ausentes, a tela cai no desenho sem imagem. */
    capaUrl: string | null;
    rdoUrl: string | null;
  };
  saudacao: string;
  nomeCliente: string;
}) {
  const d = dados;
  const base = `/portal/obras/${obraId}`;

  const SaudacaoIcone = saudacao === "Boa noite" ? Moon : Sun;

  /*
   * As três barras de "executado x pago".
   *
   * Cada uma é percentual do SEU orçado, não do orçamento inteiro — material
   * contra o material orçado, mão de obra contra a mão de obra orçada. Dividir
   * tudo pelo total faria as três barras dizerem a mesma coisa em escalas
   * diferentes, e a comparação que o cartão promete deixaria de existir.
   */
  const orcadoMaterial = extra.orcadoPorTipo.material + extra.orcadoPorTipo.servico;
  const orcadoMaoDeObra = extra.orcadoPorTipo.maoDeObra;
  /*
   * Numerador e denominador falam do mesmo tipo.
   *
   * O de materiais soma material E serviço porque é isso que `orcadoMaterial`
   * soma do outro lado — comparar gasto de dois tipos contra o orçado de um só
   * acusaria estouro onde não há.
   */
  const gastoMaterial = d.materiais + d.servicos;
  const pctMaterial = orcadoMaterial ? (gastoMaterial / orcadoMaterial) * 100 : 0;
  const pctMaoDeObra = orcadoMaoDeObra ? (d.custoMaoDeObra / orcadoMaoDeObra) * 100 : 0;
  const situacao = diagnosticarExecucao({
    percentualFisico: d.percentualFisico,
    percentualMaoDeObra: pctMaoDeObra,
    percentualMaterial: pctMaterial,
    temOrcamento: orcadoMaoDeObra > 0 || orcadoMaterial > 0,
    // Sem medição, 0% de avanço não quer dizer "obra parada": quer dizer que
    // ninguém mediu ainda. Comparar contra isso acusaria descompasso em toda
    // obra recém-cadastrada.
    temMedicao: d.ultimaMedicao != null,
  });

  // Ícone em toda fatia: a `Rosca` não comunica status só por cor, e a
  // legenda é onde essa promessa se cumpre.
  const custos = [
    {
      rotulo: "Materiais",
      valor: d.materiais,
      cor: "fill-chart-1",
      icone: <PackageCheck className="size-3.5" aria-hidden />,
    },
    {
      rotulo: "Serviços",
      valor: d.servicos,
      cor: "fill-grafico-enviado",
      icone: <Wrench className="size-3.5" aria-hidden />,
    },
    {
      rotulo: "Mão de obra",
      valor: d.custoMaoDeObra,
      cor: "fill-grafico-a-vencer",
      icone: <HardHat className="size-3.5" aria-hidden />,
    },
    {
      rotulo: "Equipamentos",
      valor: d.custoLocacoes,
      cor: "fill-grafico-pago",
      icone: <Wrench className="size-3.5" aria-hidden />,
    },
    {
      // Só aparece quando existe: uma fatia "sem classificação" num orçamento
      // todo classificado seria ruído. Quando existe, precisa aparecer — é
      // gasto real que não entra em comparação nenhuma.
      rotulo: "Sem classificação",
      valor: d.semClassificacao,
      cor: "fill-chart-5",
      icone: <CircleHelp className="size-3.5" aria-hidden />,
    },
  ].filter((c) => c.valor > 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Saudação à esquerda, obra à direita, foto da obra ao fundo.
          
          A saudação não é enfeite: é o que diz que esta tela é dele, e não um
          painel de controle que ele por acaso pode abrir. A faixa da obra fica
          na mesma linha porque responde à pergunta que a saudação abre — "a
          sua obra" precisa dizer qual.
          
          Com foto, a faixa vira um cartão e o texto ganha um véu por baixo.
          O véu usa a cor `card`, não branco: assim a mesma peça funciona nos
          dois temas, e o texto continua com o contraste que já tinha sobre
          superfície de cartão — contra qualquer foto que venha. */}
      <div
        className={cn(
          "relative isolate flex flex-wrap items-start justify-between gap-4",
          obra.capaUrl && "overflow-hidden rounded-2xl border p-5 shadow-xs sm:min-h-[184px]"
        )}
      >
        {obra.capaUrl && (
          <>
            <Image
              src={obra.capaUrl}
              alt=""
              fill
              unoptimized
              priority
              sizes="(min-width: 1024px) 72rem, 100vw"
              className="-z-20 object-cover"
            />
            {/*
              Dois véus somados. O primeiro é horizontal e abre espaço para a
              foto respirar na direita; o segundo é uma chapa fraca sobre tudo,
              que é o que salva a leitura no celular, onde o texto desce e passa
              por cima da parte "limpa" da imagem.
            */}
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-gradient-to-r from-card from-25% via-card/90 to-card/20"
            />
            <div aria-hidden className="absolute inset-0 -z-10 bg-card/45 sm:bg-transparent" />

            {/*
              A assinatura da marca, sobre a foto.
              
              É o único texto manuscrito do sistema, e isso é proposital: ele
              não informa nada, ele promete. Numa tela que o cliente abre para
              saber se a obra dele anda, uma frase dessas só se sustenta como
              nota de rodapé visual — por isso vive aqui, no canto, sobre a
              foto, e não ao lado dos números.
              
              O halo em volta das letras resolve o problema de contraste que o
              véu não resolve: a assinatura fica na direita, onde o véu é fraco
              de propósito para a foto aparecer. O halo usa a cor `card`, então
              acompanha o tema — claro no tema claro, escuro no escuro — e a
              frase se lê sobre qualquer fotografia.
              
              Some no celular: ali a faixa já está cheia de texto e a foto
              aparece em pedaço pequeno; mais uma camada por cima viraria
              sujeira.
            */}
            <p
              aria-hidden
              className="pointer-events-none absolute right-6 bottom-5 hidden -rotate-6 text-right font-manuscrita text-[26px] leading-[1.15] font-semibold text-foreground/85 [text-shadow:0_0_10px_var(--card),0_0_20px_var(--card),0_0_30px_var(--card)] lg:block"
            >
              Sua obra
              <br />
              em boas mãos
              {/* O traço embaixo é desenhado, não é sublinhado: sublinhado de
                  CSS corta as descidas das letras e endurece a escrita. */}
              <svg
                viewBox="0 0 180 14"
                className="mt-0.5 ml-auto block h-3 w-36 text-marca-ambar"
                fill="none"
              >
                <path
                  d="M3,9 C40,3 78,12 118,6 C140,2.5 160,5 177,8"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </p>
          </>
        )}

        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-atencao/12">
            <SaudacaoIcone className="size-5 text-atencao" aria-hidden />
          </span>
          <div>
            <h1 className="font-heading text-2xl leading-tight font-semibold">
              Olá, {nomeCliente}!
            </h1>
            <p className="font-heading text-lg leading-tight font-semibold text-primary-texto">
              {saudacao}!
            </p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Acompanhe abaixo um resumo da sua obra e fique por dentro de tudo o que está
              acontecendo.
            </p>
          </div>
        </div>

        {/*
          `min-w-0` é o que faz o `truncate` lá dentro funcionar.
          
          Item de flex tem `min-width: auto` por padrão: ele se recusa a
          encolher abaixo do conteúdo, então o endereço empurrava o cartão
          para fora da tela no celular em vez de virar reticências. O
          `max-w-full` fecha o caso em que a faixa inteira é o próprio cartão.
        */}
        <div className="flex min-w-0 max-w-full items-center gap-3 rounded-2xl border bg-card p-2.5 pr-4 shadow-xs sm:max-w-sm">
          {/* A miniatura reaproveita a capa. Uma foto a menos para o engenheiro
              subir, e as duas sempre combinam porque são a mesma. */}
          <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-accent">
            {obra.capaUrl ? (
              <Image
                src={obra.capaUrl}
                alt=""
                fill
                unoptimized
                sizes="44px"
                className="object-cover"
              />
            ) : (
              <span className="flex size-full items-center justify-center">
                <Building2 className="size-5 text-primary-texto" aria-hidden />
              </span>
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-heading text-sm font-semibold">{obra.nome}</p>
            <p className="truncate text-xs text-muted-foreground">
              {obra.detalhe ?? obra.status}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CartaoRdo extra={extra} base={base} fotoUrl={obra.rdoUrl} />
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent">
                <LineChart className="size-5 text-primary-texto" aria-hidden />
              </span>
              <div>
                <CardTitle className={TITULO}>Obra executada x valores pagos</CardTitle>
                <p className="text-[13px] text-muted-foreground">
                  Acompanhe se o avanço da obra está à frente dos gastos.
                </p>
              </div>
            </div>
            <CardAction>
              <TrendingUp className="size-4 text-muted-foreground" aria-hidden />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Barra
              rotulo="Avanço físico da obra"
              percentual={d.percentualFisico}
              cor="bg-chart-1"
            />
            {orcadoMaoDeObra > 0 && (
              <Barra
                rotulo="Mão de obra paga"
                percentual={pctMaoDeObra}
                cor="bg-grafico-a-vencer"
              />
            )}
            {orcadoMaterial > 0 && (
              <Barra rotulo="Materiais pagos" percentual={pctMaterial} cor="bg-grafico-pago" />
            )}

            <MensagemDiagnostico situacao={situacao} />
          </CardContent>
        </Card>
      </div>

      {/* Financeiro: três painéis num cartão só. Separados em três cartões, a
          linha vira uma fileira de caixas sem relação entre si — e a relação é
          justamente o assunto. */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent">
              <Wallet className="size-5 text-primary-texto" aria-hidden />
            </span>
            <div>
              <CardTitle className={TITULO}>Financeiro</CardTitle>
              <p className="text-[13px] text-muted-foreground">
                Confira as contas e o andamento do seu investimento.
              </p>
            </div>
          </div>
          <CardAction>
            <Link
              href={`${base}/compras`}
              className="flex items-center gap-1 whitespace-nowrap text-xs text-primary-texto underline-offset-4 hover:underline sm:text-sm"
            >
              Ver todos
              <ArrowRight className="size-3.5 shrink-0" aria-hidden />
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <PainelContas dados={d} base={base} />
          <PainelOrcamento dados={d} />
          <PainelCategorias custos={custos} total={d.custoTotal} />
        </CardContent>
      </Card>

      {!!extra.etapas.length && (
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent">
                <CalendarDays className="size-5 text-primary-texto" aria-hidden />
              </span>
              <div>
                <CardTitle className={TITULO}>Cronograma</CardTitle>
                <p className="text-[13px] text-muted-foreground">
                  Veja o andamento das etapas da sua obra.
                </p>
              </div>
            </div>
            {/*
              No celular o link desce para a própria linha, encostado à direita.
              
              O cabeçalho do cartão é uma grade de duas colunas, e "Ver
              cronograma completo" é longo: ao lado do título ele comia a
              largura da primeira coluna, que então quebrava "CRONOGRAMA" e a
              descrição em quatro linhas. Numa linha só abaixo, os dois cabem
              inteiros. A partir de `sm` ele volta para o canto do cabeçalho.
            */}
            <CardAction className="col-start-1 row-start-3 justify-self-end sm:col-start-2 sm:row-span-2 sm:row-start-1">
              <Link
                href={`${base}/cronograma`}
                className="flex items-center gap-1 whitespace-nowrap text-xs text-primary-texto underline-offset-4 hover:underline sm:text-sm"
              >
                Ver cronograma completo
                <ArrowRight className="size-3.5 shrink-0" aria-hidden />
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            <TrilhaEtapas etapas={extra.etapas} />
          </CardContent>
        </Card>
      )}

      {!!d.entregasPendentes.length && (
        <Card>
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2", TITULO)}>
              <Truck className="size-4 text-muted-foreground" aria-hidden />
              Entregas previstas
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {d.entregasPendentes.slice(0, 5).map((entrega) => {
              const compra = entrega.compras as unknown as { descricao: string } | null;
              return (
                <div
                  key={entrega.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">{compra?.descricao}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatDateBR(entrega.entrega_prevista_ordem)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Contas a pagar dos próximos dias.
 *
 * Só o que vence de hoje em diante, e ordenado por data. A lista de
 * prioridade que o sistema usa do lado do engenheiro põe o vencido na frente
 * — aqui ele nem entra, pela mesma regra do resto da área do cliente:
 * cobrança de fornecedor não é assunto dele.
 */
/** A janela que o título do painel promete. */
const DIAS_CONTAS = 30;

function PainelContas({ dados, base }: { dados: DadosVisaoGeral; base: string }) {
  /*
   * A janela tem FIM, e não tinha.
   *
   * O filtro era só "vence de hoje em diante", e o corte em quatro linhas
   * escondia o problema: numa obra com poucas parcelas, as quatro primeiras
   * podiam estar espalhadas por quatro meses, e o painel listava 25/10, 25/11,
   * 25/12 e 25/01 sob o título "próximos 30 dias". O título prometia uma coisa
   * e a lista entregava outra.
   *
   * Em UTC, como todo cálculo de data do projeto: somar dias em hora local
   * erra na virada do horário de verão.
   */
  const limite = new Date(
    new Date(`${dados.hoje}T00:00:00Z`).getTime() + DIAS_CONTAS * 86_400_000
  )
    .toISOString()
    .slice(0, 10);

  const naJanela = dados.parcelasPrioridade
    .filter((p) => p.data_vencimento >= dados.hoje && p.data_vencimento <= limite)
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));

  // O selo conta a janela inteira; a lista mostra as quatro primeiras. Contar
  // a lista cortada diria "4 em aberto" havendo doze, e o número viraria
  // enfeite do próprio limite de exibição.
  const contas = naJanela.slice(0, 4);

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn("flex flex-wrap items-center gap-x-2 text-sm", TITULO)}>
          <CalendarDays className="size-4 text-primary-texto" aria-hidden />
          Contas a pagar
          <span className="text-xs font-normal tracking-normal text-muted-foreground normal-case">
            (próximos {DIAS_CONTAS} dias)
          </span>
        </p>
        {!!naJanela.length && <Badge variant="outline">{naJanela.length} em aberto</Badge>}
      </div>

      {contas.length ? (
        <ul className="flex flex-col">
          {contas.map((parcela) => {
            const compra = parcela.compras as unknown as { descricao: string } | null;
            return (
              <li key={parcela.id}>
                <Link
                  href={`${base}/compras/${parcela.compra_id}`}
                  className="flex items-center gap-3 border-b py-2.5 text-sm transition-colors last:border-b-0 hover:text-primary-texto"
                >
                  <span className="w-12 shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatDateBR(parcela.data_vencimento)?.slice(0, 5)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{compra?.descricao}</span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {moeda(parcela.valor)}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhuma conta prevista para os próximos {DIAS_CONTAS} dias.
        </p>
      )}

      <Link
        href={`${base}/compras`}
        className="text-center text-sm text-primary-texto underline-offset-4 hover:underline"
      >
        Ver todas as contas →
      </Link>
    </div>
  );
}

/** Orçamento total contra o que já foi gasto. */
function PainelOrcamento({ dados }: { dados: DadosVisaoGeral }) {
  const temOrcamento = dados.orcado > 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <p className={cn("flex items-center gap-2 text-sm", TITULO)}>
        <PiggyBank className="size-4 text-primary-texto" aria-hidden />
        Orçamento x Gasto
      </p>

      {temOrcamento ? (
        <>
          {/*
            Os dois valores têm exatamente a mesma estrutura: rótulo em cima,
            número embaixo, e nada mais.
            
            O percentual morava sob o "Já gasto" e era uma linha a mais só de
            um lado — com `items-end`, essa linha extra empurrava o número da
            direita para baixo e os dois deixavam de se alinhar. Ele desceu
            para baixo da barra, que é de quem ele fala.
          */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Orçamento total</p>
              {/* Verde o que a obra tem, âmbar o que já saiu. */}
              <p className="font-heading text-xl font-semibold text-sucesso">
                {moeda(dados.orcado)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Já gasto</p>
              <p className="font-heading text-xl font-semibold text-atencao">
                {moeda(dados.custoTotal)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-grafico-trilho">
              {/* A barra é o gasto, então ela acompanha a cor do gasto. */}
              <div
                className="h-full rounded-full bg-grafico-a-vencer"
                style={{ width: `${Math.min(100, dados.percentualFinanceiro)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {dados.percentualFinanceiro.toFixed(1).replace(".", ",")}% do orçamento utilizado
            </p>
          </div>

          {/*
            A frase muda conforme exista gasto ou não.
            
            Com a obra sem nenhum pagamento, "Você já utilizou 0% do orçamento"
            é verdade e não serve para nada: anuncia um uso que não começou.
          */}
          <Leitura>
            {dados.custoTotal > 0 ? (
              <>
                Você já utilizou {porcento(dados.percentualFinanceiro)} do orçamento da sua obra.
                Continue acompanhando para manter o controle dos custos.
              </>
            ) : (
              <>
                Ainda não existem pagamentos na sua obra. Continue acompanhando para manter o
                controle dos custos.
              </>
            )}
          </Leitura>
        </>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          O orçamento desta obra ainda não foi ativado.
        </p>
      )}
    </div>
  );
}

/** Para onde foi o dinheiro — rosca com o total no centro. */
function PainelCategorias({
  custos,
  total,
}: {
  custos: React.ComponentProps<typeof Rosca>["fatias"];
  total: number;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <p className={cn("flex items-center gap-2 text-sm", TITULO)}>
        <Wallet className="size-4 text-primary-texto" aria-hidden />
        Gastos por categoria
      </p>
      {total > 0 ? (
        <Rosca valorCentral={moeda(total)} rotuloCentral="Total gasto" fatias={custos} />
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum gasto registrado ainda.
        </p>
      )}
    </div>
  );
}

export type { EtapaResumo };
