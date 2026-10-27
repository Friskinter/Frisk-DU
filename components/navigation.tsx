"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDonnees } from "@/lib/stockage";

const liens = [
  { href: "/", label: "Tableau de bord", icone: "▦" },
  { href: "/duerp", label: "DUERP", icone: "☰" },
  { href: "/penibilite", label: "Pénibilité", icone: "⚠" },
  { href: "/epi", label: "EPI & stocks", icone: "⛑" },
  { href: "/bilans", label: "Bilans", icone: "▤" },
  { href: "/reglages", label: "Salariés & réglages", icone: "⚙" },
];

export function Navigation() {
  const chemin = usePathname();
  const donnees = useDonnees();

  return (
    <aside className="print:hidden border-b border-white/10 bg-encre text-pierre lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0">
      <div className="flex items-center gap-3 px-4 py-3 lg:px-5 lg:pt-6 lg:pb-5">
        <Image src="/logo-frisk.png" alt="" width={36} height={36} className="h-9 w-9 rounded-sm" priority />
        <div className="min-w-0">
          <p className="font-serif text-lg leading-none tracking-[0.2em] text-marbre">
            FRISK <span className="text-bronze-clair">DU</span>
          </p>
          <p className="mt-1 truncate text-xs text-gris">{donnees?.entreprise ?? "…"}</p>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-1 lg:flex-col lg:px-3">
        {liens.map((lien) => {
          const actif = chemin === lien.href;
          return (
            <Link
              key={lien.href}
              href={lien.href}
              className={`flex shrink-0 items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors ${
                actif ? "bg-bronze text-encre" : "hover:bg-white/5 hover:text-marbre"
              }`}
            >
              <span aria-hidden className="w-4 text-center">
                {lien.icone}
              </span>
              {lien.label}
            </Link>
          );
        })}
      </nav>
      <p className="hidden px-5 py-4 text-xs text-gris lg:block">Frisk DU · le document unique simplifié</p>
    </aside>
  );
}
