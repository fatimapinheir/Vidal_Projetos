import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { AppShell, type NavEntry } from "@/components/layout/app-shell";
import { lerLateralRecolhida } from "@/lib/lateral.server";
import { buscarLogoEmpresa } from "@/lib/obras/logo-empresa";

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
  {
    label: "Lançamentos financeiros",
    icone: "compras" as const,
    segmento: "compras",
    slug: "compras",
  },
  { label: "Diário de obra", icone: "diario" as const, segmento: "diario", slug: "diario" },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("cliente");
  const lateralRecolhida = await lerLateralRecolhida();

  const supabase = await createClient();
  const logo = await buscarLogoEmpresa(supabase);
  const { count: quantasObras } = await supabase
    .from("obra_clientes")
    .select("obra_id", { count: "exact", head: true });

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
      lateralRecolhida={lateralRecolhida}
      logoEmpresaUrl={logo.url}
      logoEmpresaNome={logo.nome}
    >
      {children}
    </AppShell>
  );
}
