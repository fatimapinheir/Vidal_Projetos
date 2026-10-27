import {
  Building2,
  Calculator,
  CalendarOff,
  CalendarRange,
  Container,
  FolderCog,
  Gauge,
  HardHat,
  LayoutDashboard,
  NotebookPen,
  Package,
  ShoppingCart,
  Table2,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Registro de ícones da navegação, endereçado por nome.
 *
 * O menu é montado nos layouts, que são Server Components, e consumido pelo
 * `NavEntries`, que é cliente. Componente de ícone é função — não atravessa
 * essa fronteira ("Only plain objects can be passed to Client Components").
 * Então o servidor manda a string e quem resolve para o componente é o
 * cliente, deste mapa.
 */
export const navIcones = {
  dashboard: LayoutDashboard,

  // Seções da obra
  visaoGeral: Gauge,
  planejamento: Calculator,
  cronograma: CalendarRange,
  folgas: CalendarOff,
  diario: NotebookPen,
  avanco: TrendingUp,
  compras: ShoppingCart,
  locacoes: Container,
  presencas: UserCheck,
  fechamentos: Wallet,

  // Cadastros
  cadastros: FolderCog,
  obras: Building2,
  clientes: Users,
  equipes: HardHat,
  fornecedores: Truck,
  insumos: Package,
  tabela: Table2,
} satisfies Record<string, LucideIcon>;

export type NomeDeIcone = keyof typeof navIcones;
