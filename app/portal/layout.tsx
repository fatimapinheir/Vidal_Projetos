import { requireRole } from "@/lib/auth/require-role";
import { AppShell, type NavItem } from "@/components/layout/app-shell";

const navItems: NavItem[] = [{ href: "/portal/dashboard", label: "Minhas obras" }];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("cliente");

  return (
    <AppShell navItems={navItems} userName={profile.nome} userLabel="Cliente">
      {children}
    </AppShell>
  );
}
