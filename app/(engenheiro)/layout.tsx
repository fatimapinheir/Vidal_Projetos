import { requireRole } from "@/lib/auth/require-role";
import { AppShell, type NavEntry } from "@/components/layout/app-shell";
import { lerObraAtiva } from "@/lib/obra-ativa.server";
import { lerLateralRecolhida } from "@/lib/lateral.server";
import { buscarLogoEmpresa } from "@/lib/obras/logo-empresa";
import { createClient } from "@/lib/supabase/server";
import { entradasDaObra } from "@/lib/obra-secoes";
import { papeisDoUsuario } from "@/lib/auth/papeis";

/**
 * As seções da obra entram como descritor, não como link pronto.
 *
 * Quem monta o endereço final é o cliente, porque só ele sabe em que obra você
 * está agora — o cookie com a última obra é escrito pelo navegador depois que
 * a página monta, então aqui no servidor ele ainda pode estar uma obra
 * atrasado. Ver `resolverHref`.
 */
const navItems: NavEntry[] = [
  /*
   * "Dashboard" está FORA do menu por enquanto, a pedido.
   *
   * A rota continua existindo e sendo alcançável — é para onde `requireRole`
   * manda quem erra o lado, e onde o engenheiro sem obra padrão cai depois do
   * login. Só não ocupa mais uma linha da coluna. Para trazer de volta:
   *   { href: "/dashboard", label: "Dashboard", icone: "dashboard" },
   */

  { secao: "Obra" },
  ...entradasDaObra(),

  /*
   * Sem rótulo de seção antes de Cadastros.
   *
   * Era "GERENCIAR", e com o cartão RH logo acima ficaram dois cartões
   * separados por um texto que não dizia nada além de "daqui para baixo é
   * outra coisa" — que os próprios cartões já dizem, por serem cartões. Os
   * dois agora fecham a coluna juntos, no fim da lista.
   */
  {
    label: "Cadastros",
    icone: "cadastros",
    items: [
      { href: "/obras", label: "Obras", icone: "obras" },
      { href: "/clientes", label: "Clientes", icone: "clientes" },
      { href: "/trabalhadores", label: "Colaboradores e equipes", icone: "equipes" },
      { href: "/fornecedores", label: "Fornecedores", icone: "fornecedores" },
      { href: "/insumos", label: "Insumos", icone: "insumos" },
      { href: "/sinapi", label: "Tabela SINAPI", icone: "tabela" },
    ],
  },
];

export default async function EngenheiroLayout({ children }: { children: React.ReactNode }) {
  /*
   * A logo entra no mesmo Promise.all, e não numa espera própria depois dele.
   *
   * Estava solta embaixo, e por ser `await` em sequência custava uma ida e
   * volta inteira ao Supabase — em TODA página do engenheiro, inclusive nas
   * que o `router.refresh()` de uma ação dispara. Ela não depende de nada que
   * o bloco acima devolve; estar fora era descuido, não necessidade.
   */
  const supabase = await createClient();
  const [profile, obraLembrada, lateralRecolhida, logo] = await Promise.all([
    requireRole("engenheiro"),
    lerObraAtiva(),
    lerLateralRecolhida(),
    buscarLogoEmpresa(supabase),
  ]);

  /*
   * Os papéis vêm do banco, e só podiam ser buscados depois de saber QUEM está
   * logado — daí estar fora do `Promise.all` acima. É uma ida a mais, e é o
   * preço de `papeis` não viajar no token: colocá-lo lá criaria uma segunda
   * cópia para sair de sincronia, já que quem concede o papel é o engenheiro
   * por SQL. Ver `lib/auth/papeis`.
   */
  const conta = await papeisDoUsuario(supabase, profile.id);

  return (
    <AppShell
      navItems={navItems}
      userName={profile.nome}
      userLabel="Engenheiro"
      userRole={profile.role}
      papeis={conta?.papeis ?? [profile.role]}
      obraPadraoId={conta?.obraPadraoId ?? null}
      papelNoBanco={conta?.role ?? null}
      obraLembrada={obraLembrada}
      lateralRecolhida={lateralRecolhida}
      logoEmpresaUrl={logo.url}
      logoEmpresaNome={logo.nome}
    >
      {children}
    </AppShell>
  );
}
