import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AuthHashHandler } from "@/components/auth/auth-hash-handler";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vidal Projetos — Gestão de Obras",
  description: "Sistema de gestão de obras, equipes, compras e orçamento",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      // `dark` fixo: o sistema é preto por identidade, não por preferência do
      // sistema operacional. Sem isso o tema escuro nunca entra em cena.
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthHashHandler />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
