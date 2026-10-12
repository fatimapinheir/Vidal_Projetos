import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { formatarEndereco } from "@/lib/obra-cadastro";
import { carregarVisaoGeral } from "@/lib/obras/visao-geral";
import { carregarExtraCliente, saudacao, primeiroNome } from "@/lib/obras/visao-cliente";
import { assinarImagensObra } from "@/lib/obras/imagens";
import { VisaoGeralCliente } from "@/components/obras/visao-geral/visao-geral-cliente";

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

  const { data: obra } = await supabase.from("obras").select("*").eq("id", obraId).single();
  if (!obra) notFound();

  const [dados, extra, imagens] = await Promise.all([
    carregarVisaoGeral(supabase, obraId),
    carregarExtraCliente(supabase, obraId),
    // A policy do bucket deixa o cliente ler as fotos da obra dele; a URL é
    // assinada aqui, com validade de uma hora.
    assinarImagensObra(supabase, obra),
  ]);

  return (
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
  );
}
