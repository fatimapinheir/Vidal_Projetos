import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Cloud,
  CloudRain,
  CloudSun,
  FileText,
  LineChart,
  HardHat,
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
import type { DiarioCondicao } from "@/lib/types/database.types";
import { TrilhaEtapas } from "./trilha-etapas";

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
          <p className="font-heading text-lg leading-tight font-semibold">RDO</p>
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

        {rdo ? (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-muted/70 p-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="size-4" aria-hidden />
                  <span className="text-xs">Pessoas na obra</span>
                </div>
                <p className="font-heading text-2xl font-semibold">{rdo.pessoasNaObra}</p>
                {rdo.pessoasPrevistas > 0 && (
                  <p className="text-xs text-muted-foreground">
                    de {rdo.pessoasPrevistas} na equipe
                  </p>
                )}
              </div>

              <div className="rounded-xl bg-muted/70 p-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Target className="size-4" aria-hidden />
                  <span className="text-xs">Frentes de serviço</span>
                </div>
                <p className="font-heading text-2xl font-semibold">{extra.frentesHoje}</p>
                <p className="text-xs text-muted-foreground">em andamento</p>
              </div>

              <div className="rounded-xl bg-muted/70 p-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="size-4" aria-hidden />
                  <span className="text-xs">Principais atividades</span>
                </div>
                {rdo.linhasDeAtividade.length ? (
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
                    Sem descrição no registro de hoje.
                  </p>
                )}
              </div>
            </div>

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
          </>
        ) : (
          <>
            <p className="text-sm">
              <span className="font-medium">Aguardando o envio.</span> O engenheiro ainda não
              enviou o diário de hoje.
            </p>
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
          </>
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
  const temOrcamento = d.orcado > 0;

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
  const pctMaterial = orcadoMaterial ? (d.materiais / orcadoMaterial) * 100 : 0;
  const pctMaoDeObra = orcadoMaoDeObra ? (d.custoMaoDeObra / orcadoMaoDeObra) * 100 : 0;
  const mediaPaga =
    orcadoMaterial || orcadoMaoDeObra ? (pctMaterial + pctMaoDeObra) / 2 : d.percentualFinanceiro;
  const avancoAdiantado = d.percentualFisico >= mediaPaga;

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

        <div className="flex items-start gap-3">
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

        <div className="flex items-center gap-3 rounded-2xl border bg-card p-2.5 pr-4 shadow-xs">
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
                <CardTitle className="text-base">Obra executada x valores pagos</CardTitle>
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

            {temOrcamento ? (
              <Leitura tom={avancoAdiantado ? "bom" : "neutro"}>
                {avancoAdiantado
                  ? "Ótimo! A obra avançou mais do que os valores pagos em mão de obra e materiais."
                  : "A obra segue em execução. Os valores pagos acompanham o que já foi contratado."}
              </Leitura>
            ) : (
              <p className="text-sm text-muted-foreground">
                As comparações aparecem assim que o orçamento da obra for ativado.
              </p>
            )}
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
              <CardTitle className="text-base">Financeiro</CardTitle>
              <p className="text-[13px] text-muted-foreground">
                Confira as contas e o andamento do seu investimento.
              </p>
            </div>
          </div>
          <CardAction>
            <Link
              href={`${base}/compras`}
              className="flex items-center gap-1 text-sm text-primary-texto underline-offset-4 hover:underline"
            >
              Ver todos
              <ArrowRight className="size-3.5" aria-hidden />
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
                <CardTitle className="text-base">Cronograma</CardTitle>
                <p className="text-[13px] text-muted-foreground">
                  Veja o andamento das etapas da sua obra.
                </p>
              </div>
            </div>
            <CardAction>
              <Link
                href={`${base}/cronograma`}
                className="flex items-center gap-1 text-sm text-primary-texto underline-offset-4 hover:underline"
              >
                Ver cronograma completo
                <ArrowRight className="size-3.5" aria-hidden />
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
            <CardTitle className="flex items-center gap-2 text-base">
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
                    {formatDateBR(entrega.data_entrega_prevista)}
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
function PainelContas({ dados, base }: { dados: DadosVisaoGeral; base: string }) {
  const contas = dados.parcelasPrioridade
    .filter((p) => p.data_vencimento >= dados.hoje)
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="size-4 text-primary-texto" aria-hidden />
          Contas a pagar
          <span className="font-normal text-muted-foreground">(próximos 30 dias)</span>
        </p>
        {!!contas.length && <Badge variant="outline">{contas.length} em aberto</Badge>}
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
          Nenhuma conta prevista para os próximos 30 dias.
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
      <p className="flex items-center gap-2 text-sm font-semibold">
        <PiggyBank className="size-4 text-primary-texto" aria-hidden />
        Orçamento x Gasto
      </p>

      {temOrcamento ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Orçamento total</p>
              <p className="font-heading text-xl font-semibold">{moeda(dados.orcado)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Já gasto</p>
              <p className="font-heading text-xl font-semibold">{moeda(dados.custoTotal)}</p>
              <p className="text-xs text-muted-foreground">
                ({dados.percentualFinanceiro.toFixed(1).replace(".", ",")}%)
              </p>
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-grafico-trilho">
            <div
              className="h-full rounded-full bg-chart-1"
              style={{ width: `${Math.min(100, dados.percentualFinanceiro)}%` }}
            />
          </div>

          <Leitura>
            Você já utilizou {porcento(dados.percentualFinanceiro)} do orçamento da sua obra.
            Continue acompanhando para manter o controle dos custos.
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
      <p className="flex items-center gap-2 text-sm font-semibold">
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
