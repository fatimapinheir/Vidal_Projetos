import { requireRole } from "@/lib/auth/require-role";
import { AppShell, type NavEntry } from "@/components/layout/app-shell";
import { lerObraAtiva } from "@/lib/obra-ativa.server";
import { SECOES_OBRA } from "@/lib/obra-secoes";

/**
 * As seções da obra entram como descritor, não como link pronto.
 *
 * Quem monta o endereço final é o cliente, porque só ele sabe em que obra você
 * está agora — o cookie com a última obra é escrito pelo navegador depois que
 * a página monta, então aqui no servidor ele ainda pode estar uma obra
 * atrasado. Ver `resolverHref`.
 */
const navItems: NavEntry[] = [
  { href: "/dashboard", label: "Dashboard", icone: "dashboard" },

  { secao: "Obra" },
  ...SECOES_OBRA.map((secao) => ({
    label: secao.label,
    icone: secao.icone,
    obraSecao: { slug: secao.slug, segmento: secao.segmento },
  })),

  { secao: "Gerenciar" },
  {
    label: "Cadastros",
    icone: "cadastros",
    items: [
      { href: "/obras", label: "Obras", icone: "obras" },
      { href: "/clientes", label: "Clientes", icone: "clientes" },
      { href: "/trabalhadores", label: "Colaboradores e equipes", icone: "equipes" },
      { href: "/fornecedores", label: "Fornecedores", icone: "fornecedores" },
      { href: "/sinapi", label: "Tabela SINAPI", icone: "tabela" },
    ],
  },
];

export default async function EngenheiroLayout({ children }: { children: React.ReactNode }) {
  const [profile, obraLembrada] = await Promise.all([requireRole("engenheiro"), lerObraAtiva()]);

  return (
    <AppShell
      navItems={navItems}
      userName={profile.nome}
      userLabel="Engenheiro"
      obraLembrada={obraLembrada}
    >
      {children}
    </AppShell>
  );
}
