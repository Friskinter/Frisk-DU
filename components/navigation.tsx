"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { calculerAlertes } from "@/lib/alertes";
import { dateDuJour } from "@/lib/calculs";
import { deconnecter, useSession, type Enregistrement } from "@/lib/stockage";

const liens = [
  { href: "/", label: "Tableau de bord", icone: "▦" },
  { href: "/duerp", label: "DUERP", icone: "☰" },
  { href: "/penibilite", label: "Pénibilité", icone: "⚠" },
  { href: "/epi", label: "EPI & stocks", icone: "⛑" },
  { href: "/bilans", label: "Bilans", icone: "▤" },
  { href: "/journal", label: "Journal", icone: "◷" },
  { href: "/reglages", label: "Salariés & réglages", icone: "⚙" },
];

const etatsEnregistrement: Record<Enregistrement, { texte: string; classe: string }> = {
  enregistre: { texte: "✓ Enregistré", classe: "text-gris" },
  "en-cours": { texte: "Enregistrement…", classe: "text-bronze-clair" },
  erreur: { texte: "⚠ Hors connexion, nouvel essai…", classe: "text-[#ec835a]" },
  refuse: { texte: "⚠ Modification refusée", classe: "text-[#ec835a]" },
};

export function Navigation() {
  const chemin = usePathname();
  const session = useSession();
  const enregistrement = etatsEnregistrement[session.enregistrement];
  const urgentes = session.donnees
    ? calculerAlertes(session.donnees, dateDuJour()).filter((a) => a.gravite === "critique").length
    : 0;

  return (
    <aside className="print:hidden border-b border-white/10 bg-encre text-pierre lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0">
      <div className="flex items-center gap-3 px-4 py-3 lg:px-5 lg:pt-6 lg:pb-5">
        <Image src="/logo-frisk.png" alt="" width={36} height={36} className="h-9 w-9 rounded-sm" priority />
        <div className="min-w-0">
          <p className="font-serif text-lg leading-none tracking-[0.2em] text-marbre">
            FRISK <span className="text-bronze-clair">DU</span>
          </p>
          <p className="mt-1 truncate text-xs text-gris">{session.donnees?.entreprise ?? "…"}</p>
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
              {lien.href === "/" && urgentes > 0 && (
                <span
                  className="ml-auto rounded-full bg-[#d03b3b] px-1.5 text-xs font-semibold text-white"
                  title={`${urgentes} point(s) urgent(s) à traiter`}
                >
                  {urgentes}
                </span>
              )}
            </Link>
          );
        })}
        {session.admin && (
          <Link
            href="/console"
            className="flex shrink-0 items-center gap-3 rounded-sm px-3 py-2 text-sm text-bronze-clair hover:bg-white/5 lg:mt-4"
          >
            <span aria-hidden className="w-4 text-center">★</span>
            Console Frisk
          </Link>
        )}
      </nav>
      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-2 text-xs lg:block lg:px-5 lg:py-4">
        {session.statut === "pret" && <p className={enregistrement.classe}>{enregistrement.texte}</p>}
        <p className="hidden truncate text-gris lg:mt-2 lg:block">{session.email}</p>
        <button type="button" onClick={deconnecter} className="text-pierre underline hover:text-marbre lg:mt-1">
          Se déconnecter
        </button>
      </div>
    </aside>
  );
}
