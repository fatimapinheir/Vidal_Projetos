import Link from "next/link";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";
import { Logo } from "@/components/marca/logo";
import { TemaToggle } from "@/components/theme/tema-toggle";
import type { NomeDeIcone } from "./nav-icones";
import { MobileNav } from "./mobile-nav";
import { NavEntries } from "./nav-entries";
import { Trilha } from "./trilha";
import { LateralColapsavel } from "./lateral-colapsavel";
import { LogoEmpresa } from "@/components/marca/logo-empresa";

export type NavItem = {
  label: string;
  icone?: NomeDeIcone;
  /** Destino fixo. */
  href?: string;
  /**
   * Destino que depende da obra em foco — resolvido no cliente, que é quem
   * conhece a URL atual. Ver `resolverHref`.
   */
  obraSecao?: {
    slug: string;
    segmento: string;
    /** Raiz das rotas de obra: `/obras` no engenheiro, `/portal/obras` no cliente. */
    prefixo?: string;
  };
};
/** Um grupo encaixota itens num cartão que abre e fecha. */
export type NavGroup = { label: string; items: NavItem[]; icone?: NomeDeIcone };
/** Rótulo de seção: só separa visualmente, não clica e não esconde nada. */
export type NavSecao = { secao: string };
export type NavEntry = NavItem | NavGroup | NavSecao;

/** Iniciais para o avatar — no máximo duas, senão vira sopa de letra. */
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

function Avatar({ nome, className }: { nome: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground " +
        (className ?? "")
      }
    >
      {iniciais(nome)}
    </span>
  );
}

/**
 * O pé da lateral: quem fez o sistema.
 *
 * Era a frase da marca da Ankora. Virou a assinatura dela porque o topo da
 * coluna passou a ser da construtora — e as duas marcas no mesmo lugar
 * disputariam. Em cima, de quem é a obra; embaixo, de quem é a ferramenta.
 *
 * Continua fechando a coluna: sem nada aqui a lista de links termina no vazio
 * e a lateral parece cortada.
 */
function PeDaMarca() {
  return (
    // Some quando a lateral está recolhida: numa régua de 68px a assinatura
    // sairia menor que o legível.
    <div className="flex flex-col gap-2.5 px-5 pt-5 pb-6 group-data-[recolhida]/lateral:hidden">
      <div className="h-px bg-sidebar-border" />
      <p className="text-[11px] tracking-wide text-sidebar-suave/70">desenvolvido com</p>
      <Logo className="h-5 opacity-90" />
    </div>
  );
}

export function AppShell({
  navItems,
  userName,
  userLabel,
  obraLembrada = null,
  lateralRecolhida = false,
  logoEmpresaUrl = null,
  logoEmpresaNome = null,
  children,
}: {
  navItems: NavEntry[];
  userName: string;
  userLabel: string;
  /** Última obra aberta, do cookie. Serve de palpite quando a URL não diz. */
  obraLembrada?: string | null;
  /** Preferência vinda do cookie — ver `lib/lateral`. */
  lateralRecolhida?: boolean;
  /** Logo da construtora, do perfil do engenheiro. Sem ela, cai na Ankora. */
  logoEmpresaUrl?: string | null;
  logoEmpresaNome?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh w-full bg-sidebar">
      {/*
        Lateral navy, nos dois temas — ver a nota dos tokens `--sidebar`.
        Ela é a moldura da marca, e o logotipo da Ankora nasceu branco sobre
        navy.
      */}
      {/* `sticky` + `h-svh`: a coluna acompanha a rolagem em vez de subir com
          a página. Numa visão geral de 2000px, o menu saía de vista no
          primeiro rolar e voltar ao topo virava pré-requisito para navegar. */}
      <LateralColapsavel recolhidaInicial={lateralRecolhida}>
        {/* A marca da construtora, não a do sistema. Recolhida, ela encolhe e
            centraliza em vez de sumir: é o unico ponto da régua que diz de
            quem é aquilo. */}
        <div className="flex justify-center px-5 py-6 group-data-[recolhida]/lateral:px-0 group-data-[recolhida]/lateral:py-4">
          <LogoEmpresa
            url={logoEmpresaUrl}
            nome={logoEmpresaNome}
            className="group-data-[recolhida]/lateral:h-8"
          />
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3 group-data-[recolhida]/lateral:px-2">
          <NavEntries entradas={navItems} obraLembrada={obraLembrada} />
        </nav>

        <PeDaMarca />
      </LateralColapsavel>

      {/*
        O corpo ocupa o resto da tela, rente às bordas.
        
        Sem borda vertical separando do navy: o degrau de luminosidade entre a
        lateral escura e a chapa clara já é a divisão mais forte da tela, e uma
        linha em cima disso só marcaria duas vezes a mesma coisa.
      */}
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <header className="flex items-center gap-2 px-3 pt-3 md:px-6 md:pt-4">
          {/* A gaveta só existe no celular — no desktop a lateral cobre o papel. */}
          <div className="md:hidden">
            <MobileNav
              navItems={navItems}
              userName={userName}
              userLabel={userLabel}
              obraLembrada={obraLembrada}
              logoEmpresaUrl={logoEmpresaUrl}
              logoEmpresaNome={logoEmpresaNome}
            />
          </div>

          <div className="min-w-0 flex-1">
            {/* No celular, a marca; no desktop, onde o usuário está. A lateral
                já mostra a marca lá, repetir aqui seria ruído. */}
            {/* No celular a lateral não existe, então é aqui que a marca da
                construtora aparece. Sobre fundo claro — por isso o contêiner
                escuro atrás dela: a logo enviada é clara, para funcionar no
                navy do menu. */}
            <span className="inline-flex items-center rounded-lg bg-sidebar px-2 py-1 md:hidden">
              <LogoEmpresa url={logoEmpresaUrl} nome={logoEmpresaNome} className="h-6" />
            </span>
            <span className="hidden md:block">
              <Trilha entradas={navItems} obraLembrada={obraLembrada} />
            </span>
          </div>

          <TemaToggle />

          <Link
            href="/perfil"
            title={`${userName} — ${userLabel}`}
            className="rounded-full transition-opacity hover:opacity-85"
          >
            <Avatar nome={userName} />
            <span className="sr-only">
              {userName} — {userLabel}
            </span>
          </Link>

          <form action={logout}>
            <Button type="submit" variant="ghost" size="icon-sm" aria-label="Sair">
              <LogOut className="size-4" />
            </Button>
          </form>
        </header>

        <main className="flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
