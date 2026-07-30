import Link from "next/link";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";
import { MobileNav } from "./mobile-nav";

export type NavItem = { href: string; label: string };

export function AppShell({
  navItems,
  userName,
  userLabel,
  children,
}: {
  navItems: NavItem[];
  userName: string;
  userLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh w-full">
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-muted/20 md:flex">
        <div className="border-b px-4 py-4">
          <p className="font-heading text-sm font-semibold">Vidal Projetos</p>
          <p className="text-xs text-muted-foreground">Gestão de Obras</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-2">
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">{userLabel}</p>
          </div>
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start gap-2">
              <LogOut className="size-4" />
              Sair
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header só de telas estreitas — no desktop a sidebar cobre o papel dele. */}
        <header className="sticky top-0 z-40 flex items-center gap-2 border-b bg-background px-3 py-2 md:hidden">
          <MobileNav navItems={navItems} userName={userName} userLabel={userLabel} />
          <p className="flex-1 truncate font-heading text-sm font-semibold">Vidal Projetos</p>
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
