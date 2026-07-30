import { requireRole } from "@/lib/auth/require-role";
import { AppShell, type NavItem } from "@/components/layout/app-shell";

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/obras", label: "Obras" },
  { href: "/fornecedores", label: "Fornecedores" },
  { href: "/trabalhadores", label: "Equipe" },
  { href: "/sinapi", label: "Tabela SINAPI" },
];

export default async function EngenheiroLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("engenheiro");

  return (
    <AppShell navItems={navItems} userName={profile.nome} userLabel="Engenheiro">
      {children}
    </AppShell>
  );
}
