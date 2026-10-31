"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/identite-visuelle";
import { moduleAbonne } from "@/lib/abonnement";
import { calculerAlertes } from "@/lib/alertes";
import { variablesCouleur, variablesTheme } from "@/lib/identite";
import { documentsLegaux } from "@/lib/legal";
import { libellesRoles } from "@/lib/operations";
import { dateDuJour } from "@/lib/calculs";
import { deconnecter, etablissementsDuGroupe, ouvrirEntreprise, useSession, type Enregistrement } from "@/lib/stockage";

// Menu regroupé par usage ; le dernier groupe (sans titre) rassemble l'administration de l'espace.
const groupes: { titre: string; liens: { href: string; label: string; icone: string }[] }[] = [
  {
    titre: "Piloter",
    liens: [
      { href: "/", label: "Tableau de bord", icone: "▦" },
      { href: "/parcours", label: "Mon parcours", icone: "➚" },
      { href: "/bilans", label: "Bilans", icone: "▤" },
      { href: "/rapport", label: "Rapport annuel", icone: "▥" },
    ],
  },
  {
    titre: "Évaluer",
    liens: [
      { href: "/duerp", label: "DUERP", icone: "☰" },
      { href: "/actions", label: "Plan d'actions", icone: "✓" },
      { href: "/penibilite", label: "Pénibilité", icone: "⚠" },
      { href: "/produits", label: "Produits chimiques", icone: "⚗" },
    ],
  },
  {
    titre: "Suivre",
    liens: [
      { href: "/accidents", label: "Accidents", icone: "⚑" },
      { href: "/verifications", label: "Vérifications", icone: "◎" },
      { href: "/visites", label: "Visites et audits", icone: "☑" },
      { href: "/entreprises-exterieures", label: "Entreprises extérieures", icone: "⇄" },
    ],
  },
  {
    titre: "Salariés",
    liens: [
      { href: "/formations", label: "Formations", icone: "◆" },
      { href: "/accueil", label: "Accueil et causeries", icone: "✎" },
      { href: "/epi", label: "EPI & stocks", icone: "⛑" },
      { href: "/reglages", label: "Salariés & réglages", icone: "⚙" },
    ],
  },
  {
    titre: "",
    liens: [
      { href: "/journal", label: "Journal", icone: "◷" },
      { href: "/abonnement", label: "Abonnement", icone: "€" },
    ],
  },
];

// Couleur de l'entreprise : remplace les couleurs de Frisk dans toute la page (voir app/globals.css).
function useCouleurEntreprise(couleur: string | undefined) {
  useEffect(() => {
    const style = document.documentElement.style;
    const valeurs = variablesCouleur({ couleur });
    variablesTheme.forEach((v) => (valeurs ? style.setProperty(v, valeurs[v]) : style.removeProperty(v)));
    return () => variablesTheme.forEach((v) => style.removeProperty(v));
  }, [couleur]);
}

const etatsEnregistrement: Record<Enregistrement, { texte: string; classe: string }> = {
  enregistre: { texte: "✓ Enregistré", classe: "text-pierre/70" },
  "en-cours": { texte: "Enregistrement…", classe: "text-bronze-clair" },
  erreur: { texte: "⚠ Hors connexion, nouvel essai…", classe: "text-[#ec835a]" },
  refuse: { texte: "⚠ Modification refusée", classe: "text-[#ec835a]" },
};

export function Navigation() {
  const chemin = usePathname();
  const session = useSession();
  const enregistrement = etatsEnregistrement[session.enregistrement];
  const identite = session.donnees?.identite;
  const essai = session.abonnement.acces === "essai";
  useCouleurEntreprise(identite?.couleur);
  const urgentes = session.donnees
    ? calculerAlertes(session.donnees, dateDuJour()).filter((a) => a.gravite === "critique").length
    : 0;

  return (
    <aside className="print:hidden border-b border-white/10 bg-menu text-pierre lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0">
      <div className={`flex gap-3 px-4 py-3 lg:px-5 lg:pt-6 lg:pb-5 ${identite?.logo ? "items-center lg:flex-col lg:items-start lg:gap-2" : "items-center"}`}>
        {identite?.logo ? (
          <Logo identite={identite} grand />
        ) : (
          <Image src="/logo-frisk.png" alt="" width={36} height={36} className="h-9 w-9 rounded-sm" priority />
        )}
        <div className="min-w-0">
          {identite?.logo ? (
            <p className="sr-only">Frisk Plateforme</p>
          ) : (
            <p className="font-serif text-lg leading-none tracking-[0.2em] text-marbre">
              FRISK <span className="mt-1 block text-[0.6rem] tracking-[0.35em] text-bronze-clair">PLATEFORME</span>
            </p>
          )}
          {session.espaces.length > 1 ? (
            // Plusieurs établissements ou plusieurs clients : on passe de l'un à l'autre.
            <select
              value={session.entrepriseId}
              onChange={(e) => ouvrirEntreprise(e.target.value)}
              aria-label="Changer d'établissement"
              className="mt-1 w-full max-w-48 truncate rounded-sm border border-white/15 bg-menu px-1 py-0.5 text-xs text-pierre"
            >
              {session.espaces.map((e) => (
                <option key={e.id} value={e.id}>{e.nom}</option>
              ))}
            </select>
          ) : (
            <p className={identite?.logo ? "truncate text-sm text-marbre lg:whitespace-normal" : "mt-1 truncate text-xs text-pierre/70"}>{session.donnees?.entreprise ?? "…"}</p>
          )}
        </div>
      </div>
      {/* Sur ordinateur, le menu défile s'il dépasse la hauteur de l'écran (aucune entrée cachée). */}
      <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-0.5 lg:overflow-y-auto lg:px-3">
        {etablissementsDuGroupe(session).length > 1 && (
          <Link
            href="/groupe"
            className={`flex shrink-0 items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors ${
              chemin === "/groupe" ? "bg-bronze text-encre" : "text-bronze-clair hover:bg-white/5"
            }`}
          >
            <span aria-hidden className="w-4 text-center">⊞</span>
            Vue d&apos;ensemble
          </Link>
        )}
        {groupes.map((groupe) => (
          // Sur téléphone, le menu est une seule ligne qui défile : les titres de groupe ne s'affichent que sur ordinateur.
          <div key={groupe.titre || "administration"} className="contents lg:mt-3 lg:block lg:first:mt-0">
            {groupe.titre && (
              <p className="hidden px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-pierre lg:block">{groupe.titre}</p>
            )}
            {groupe.liens.filter((l) => l.href !== "/abonnement" || session.roleCompte === "responsable" || session.admin).map((lien) => {
              const actif = chemin === lien.href;
              return (
                <Link
                  key={lien.href}
                  href={lien.href}
                  className={`flex shrink-0 items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors lg:py-1.5 ${
                    actif ? "bg-bronze text-encre" : "hover:bg-white/5 hover:text-marbre"
                  }`}
                >
                  <span aria-hidden className="w-4 text-center">
                    {lien.icone}
                  </span>
                  {lien.label}
                  {essai && moduleAbonne(lien.href) && (
                    <span className="ml-auto text-xs" title="Inclus dans l'abonnement" aria-label="inclus dans l'abonnement">🔒</span>
                  )}
                  {lien.href === "/" && urgentes > 0 && (
                    <span
                      className="ml-auto rounded-full bg-[#d03b3b] px-1.5 text-xs font-semibold text-white"
                      title={`${urgentes} point${urgentes > 1 ? "s" : ""} urgent${urgentes > 1 ? "s" : ""} à traiter`}
                    >
                      {urgentes}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
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
        {/* Compte connecté : utile quand on passe d'un compte administrateur à un compte client. */}
        <div className="min-w-0 lg:mt-3">
          <p className="hidden text-[10px] uppercase tracking-wider text-pierre/70 lg:block">Connecté en tant que</p>
          <p className="hidden truncate text-pierre lg:block" title={session.email}>{session.email}</p>
          {session.statut === "pret" && (
            <Link href="/compte" className="mr-2 text-[10px] text-bronze-clair underline">Mon compte</Link>
          )}
          {(session.admin || session.statut === "pret") && (
          <span
            className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
              session.admin ? "bg-bronze text-encre" : "bg-white/10 text-pierre"
            }`}
          >
            {session.admin ? "Administrateur Frisk" : session.roleCompte !== "admin" ? libellesRoles[session.roleCompte].libelle : ""}
          </span>
          )}
        </div>
        <button type="button" onClick={deconnecter} className="text-pierre underline hover:text-marbre lg:mt-2">
          Se déconnecter
        </button>
        {identite?.logo && (
          <p className="hidden items-center gap-1.5 text-[10px] text-pierre/70 lg:mt-3 lg:flex">
            <Image src="/logo-frisk.png" alt="" width={14} height={14} className="h-3.5 w-3.5 rounded-[2px]" />
            Réalisé avec Frisk Plateforme
          </p>
        )}
        <p className="hidden flex-wrap gap-x-2 text-[10px] text-pierre/70 lg:mt-3 lg:flex">
          {documentsLegaux.filter((d) => ["/legal/mentions", "/legal/cgu", "/legal/confidentialite"].includes(d.href)).map((d) => (
            <Link key={d.href} href={d.href} className="hover:text-pierre hover:underline">{d.court}</Link>
          ))}
        </p>
      </div>
    </aside>
  );
}
