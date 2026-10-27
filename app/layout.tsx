import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";
import { Navigation } from "@/components/navigation";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Frisk DU — Document unique, pénibilité et EPI",
    template: "%s | Frisk DU",
  },
  description:
    "Frisk DU : DUERP en tableau, pénibilité, suivi des EPI, stocks et bilans de consommation pour les TPE et PME.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${cinzel.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans lg:flex-row">
        <Navigation />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
