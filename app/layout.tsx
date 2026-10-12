import type { Metadata } from "next";
import { Dancing_Script, Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AuthHashHandler } from "@/components/auth/auth-hash-handler";
import { TemaScript } from "@/components/theme/tema-script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/*
 * Fonte manuscrita, só para a assinatura "Sua obra em boas mãos" na faixa de
 * saudação do portal.
 *
 * `latin-ext` e não `latin`: a frase tem "mãos", e o til sobre o "a" vive no
 * subconjunto estendido. Com `latin` o navegador cairia numa fonte de reserva
 * justamente nessa letra, e a palavra sairia com uma letra de outro desenho.
 *
 * Um peso só. É uma linha de texto decorativa numa tela do sistema inteiro —
 * carregar a família completa custaria mais do que a frase vale.
 */
const dancingScript = Dancing_Script({
  variable: "--font-dancing-script",
  subsets: ["latin-ext"],
  weight: ["600"],
  display: "swap",
});

/*
 * O nome que aparece é Ankora. Pasta, repositório, banco e variável continuam
 * "Vidal Projetos" — renomear aquilo custaria uma migração inteira e não muda
 * nada para quem usa o sistema.
 */
export const metadata: Metadata = {
  title: "Ankora — Gestão de Obras",
  description: "Acompanhe sua obra: diário, cronograma, orçamento e financeiro.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      // Sem classe de tema fixa: quem decide é o `TemaScript` abaixo, que roda
      // antes da primeira pintura e põe `dark` no <html> se for o caso.
      // suppressHydrationWarning porque esse script altera o <html> antes do
      // React assumir — sem ele, o React reclama da classe que "apareceu".
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${dancingScript.variable} h-full antialiased`}
    >
      <head>
        <TemaScript />
      </head>
      <body className="flex min-h-full flex-col">
        <AuthHashHandler />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
