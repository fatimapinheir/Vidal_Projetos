import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { AppShell, type NavEntry } from "@/components/layout/app-shell";
import { lerLateralRecolhida } from "@/lib/lateral.server";
import { buscarLogoEmpresa } from "@/lib/obras/logo-empresa";
import { papeisDoUsuario } from "@/lib/auth/papeis";

/**
 * Seções da obra no portal do cliente.
 *
 * Entram como descritor, e não como link pronto, pelo mesmo motivo do lado do
 * engenheiro: só o cliente sabe em que obra o usuário está agora, porque é ele
 * quem conhece a URL. O `prefixo` é o que muda — o portal vive em
 * `/portal/obras/<id>`.
 *
 * Antes havia um item só, "Minhas obras". A lista de ordens de compra existia
 * como página e era inalcançável: o cliente só chegava numa compra clicando
 * numa parcela do bloco de pagamentos.
 */
const SECOES = [
  // "Início" e não "Visão geral": é a tela inicial do cliente, e é assim que
  // a referência da Ankora nomeia. "Visão geral" é vocabulário de painel.
  { label: "Início", icone: "visaoGeral" as const, segmento: "", slug: "visao-geral" },
  { label: "Orçamento", icone: "planejamento" as const, segmento: "orcamento", slug: "orcamento" },
  { label: "Cronograma", icone: "cronograma" as const, segmento: "cronograma", slug: "cronograma" },
  // Antes dos lançamentos: a cotação é a decisão que o cliente ainda vai
  // tomar, e o lançamento é o registro do que já saiu. Pendência primeiro.
  { label: "Cotações", icone: "cotacoes" as const, segmento: "cotacoes", slug: "cotacoes" },
  {
    label: "Lançamentos financeiros",
    icone: "compras" as const,
    segmento: "compras",
    slug: "compras",
  },
  { label: "Diário de obra", icone: "diario" as const, segmento: "diario", slug: "diario" },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  /*
   * Quatro esperas em fila viraram uma.
   *
   * Eram `await` um atrás do outro, e nenhum dependia do anterior: cada um
   * custava uma ida e volta inteira ao Supabase antes de o próximo começar —
   * em toda página do portal. Só o cliente precisa existir antes do resto, e
   * é ele que `requireRole` resolve.
   */
  const supabase = await createClient();
  const [profile, lateralRecolhida, logo, { count: quantasObras }] = await Promise.all([
    requireRole("cliente"),
    lerLateralRecolhida(),
    buscarLogoEmpresa(supabase),
    supabase.from("obra_clientes").select("obra_id", { count: "exact", head: true }),
  ]);

  // Ver a nota no layout do engenheiro: `papeis` é do banco, não do token.
  const conta = await papeisDoUsuario(supabase, profile.id);

  const navItems: NavEntry[] = [
    ...SECOES.map((secao) => ({
      label: secao.label,
      icone: secao.icone,
      obraSecao: { slug: secao.slug, segmento: secao.segmento, prefixo: "/portal/obras" },
    })),
  ];

  /*
   * "Minhas obras" só aparece para quem tem mais de uma.
   *
   * Com uma obra só, o dashboard redireciona direto para ela — o item ficava
   * no menu levando de volta à mesma tela em que o cliente já estava.
   */
  if ((quantasObras ?? 0) > 1) {
    navItems.unshift({ href: "/portal/dashboard", label: "Minhas obras", icone: "obras" });
  }

  return (
    <AppShell
      navItems={navItems}
      userName={profile.nome}
      userLabel="Cliente"
      userRole={profile.role}
      papeis={conta?.papeis ?? [profile.role]}
      obraPadraoId={conta?.obraPadraoId ?? null}
      lateralRecolhida={lateralRecolhida}
      logoEmpresaUrl={logo.url}
      logoEmpresaNome={logo.nome}
    >
      {children}
    </AppShell>
  );
}
