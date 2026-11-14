import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { formatarEndereco } from "@/lib/obra-cadastro";
import { carregarVisaoGeral } from "@/lib/obras/visao-geral";
import {
  carregarExtraCliente,
  saudacao,
  primeiroNome,
} from "@/lib/obras/visao-cliente";
import { assinarImagensObra } from "@/lib/obras/imagens";
import { VisaoGeralCliente } from "@/components/obras/visao-geral/visao-geral-cliente";
import { AvisoCotacaoPendente } from "@/components/cotacoes/aviso-cotacao-pendente";
import { cotacoesAguardandoCliente } from "@/lib/cotacoes/carregar";

const statusLabel: Record<string, string> = {
  planejamento: "Planejamento",
  em_andamento: "Em andamento",
  pausada: "Pausada",
  concluida: "Concluída",
};

/**
 * A obra pelos olhos de quem a contratou.
 *
 * Tem componente próprio, e não mais o do engenheiro com interruptores de
 * permissão: o que o cliente precisa ver divergiu do painel de controle da
 * obra. Aqui não entra nada sobre atraso — nem caminho crítico, nem tarefa
 * atrasada, nem parcela vencida.
 *
 * A faixa de identificação da obra não vem mais daqui: ela entrou na mesma
 * linha da saudação, dentro do componente. Eram duas barras empilhadas
 * dizendo a mesma coisa em dobro no topo da tela.
 */
export default async function PortalObraPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const perfil = await requireRole("cliente");
  const supabase = await createClient();

  /*
   * A obra entra no MESMO bloco do resto, e não numa espera antes dele.
   *
   * Estava sozinha na frente porque `assinarImagensObra` precisa das colunas
   * de imagem dela. Mas o resto não precisa: `carregarVisaoGeral`,
   * `carregarExtraCliente` e a contagem de cotações trabalham com o `obraId`,
   * que vem da URL. Esperar a obra para só então começar os outros custava uma
   * ida e volta inteira a São Paulo — 417 ms de mediana, medidos de dentro da
   * função, porque ela roda na Virgínia.
   *
   * A assinatura das imagens fica depois, e na maioria das obras não custa
   * nada: sem caminho de imagem gravado, ela não vai à rede.
   */
  const [{ data: obra }, dados, extra, cotacoesPendentes] = await Promise.all([
    supabase.from("obras").select("*").eq("id", obraId).single(),
    carregarVisaoGeral(supabase, obraId),
    carregarExtraCliente(supabase, obraId),
    // Contagem, e só: nenhum valor cotado entra nesta tela.
    cotacoesAguardandoCliente(supabase, obraId),
  ]);

  if (!obra) notFound();

  // A policy do bucket deixa o cliente ler as fotos da obra dele; a URL é
  // assinada aqui, com validade de uma hora.
  const imagens = await assinarImagensObra(supabase, obra);

  return (
    <div className="flex flex-col gap-4">
      {/* Acima de tudo: é a única coisa da tela que espera uma AÇÃO dele. */}
      <AvisoCotacaoPendente
        quantas={cotacoesPendentes}
        href={`/portal/obras/${obraId}/cotacoes`}
        lado="cliente"
      />

      <VisaoGeralCliente
        dados={dados}
        extra={extra}
        obraId={obraId}
        obra={{
          nome: obra.nome,
          detalhe: formatarEndereco(obra),
          status: statusLabel[obra.status] ?? obra.status,
          capaUrl: imagens.capa,
          rdoUrl: imagens.rdo,
        }}
        saudacao={saudacao()}
        nomeCliente={primeiroNome(perfil.nome)}
      />
    </div>
  );
}
