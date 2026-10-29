"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { classeBouton } from "@/components/ui";
import { joursRestants, type modulesAbonnes } from "@/lib/abonnement";
import { formaterDate } from "@/lib/calculs";
import { useSession } from "@/lib/stockage";

// Bandeau en haut de l'espace : jours d'essai restants, essai terminé, paiement refusé.
export function BandeauAbonnement() {
  const { abonnement, roleCompte, admin } = useSession();
  if (admin && abonnement.statut === "actif") return null;
  const responsable = roleCompte === "responsable" || roleCompte === "admin";
  const lien = responsable && (
    <Link href="/abonnement" className="shrink-0 rounded-sm bg-encre px-3 py-1.5 text-sm font-medium text-marbre hover:bg-ardoise">
      {abonnement.statut === "impaye" ? "Mettre à jour le paiement" : "Choisir mon abonnement"}
    </Link>
  );

  let texte: ReactNode = null;
  if (abonnement.acces === "essai") {
    const jours = joursRestants(abonnement.essaiFin);
    texte = (
      <>
        <strong>Essai gratuit : {jours > 1 ? `il reste ${jours} jours` : "dernier jour"}.</strong> Document unique, plan d&apos;actions et
        salariés sont ouverts ; les autres modules se débloquent avec l&apos;abonnement.
      </>
    );
  } else if (abonnement.acces === "lecture") {
    texte = (
      <>
        <strong>{abonnement.statut === "essai" ? "Votre essai gratuit est terminé." : "Votre abonnement a pris fin."}</strong> L&apos;espace est
        en lecture seule : vos données sont conservées, consultables et exportables.{" "}
        {responsable ? "Abonnez-vous pour reprendre là où vous en étiez." : "Le responsable de votre entreprise peut réactiver l'abonnement."}
      </>
    );
  } else if (abonnement.statut === "impaye") {
    texte = (
      <>
        <strong>Le dernier paiement n&apos;a pas abouti.</strong> Votre accès est maintenu pour l&apos;instant ; mettez à jour votre moyen de
        paiement pour éviter l&apos;interruption.
      </>
    );
  }
  if (!texte) return null;
  return (
    <div
      role="status"
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border p-3 text-sm print:hidden ${
        abonnement.acces === "essai" ? "border-bronze/60 bg-bronze/15" : "border-[#d03b3b]/50 bg-[#d03b3b]/10"
      }`}
    >
      <p className="min-w-0 flex-1">{texte}</p>
      {lien}
    </div>
  );
}

// Module réservé aux abonnés, présenté pendant l'essai : ce qu'il fait, à quoi il ressemble.
export function Vitrine({ module: m }: { module: (typeof modulesAbonnes)[number] }) {
  const { roleCompte, abonnement } = useSession();
  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-bronze-fonce">Inclus dans l&apos;abonnement</p>
        <h1 className="font-serif text-2xl text-titre sm:text-3xl">{m.titre}</h1>
        <p className="mt-1 max-w-3xl text-sm text-ardoise">{m.accroche}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-4">
          <ul className="space-y-2 text-sm">
            {m.points.map((p) => (
              <li key={p} className="flex gap-2">
                <span aria-hidden className="text-bronze-fonce">✓</span>
                {p}
              </li>
            ))}
          </ul>
          {(roleCompte === "responsable" || roleCompte === "admin") && (
            <Link href="/abonnement" className={classeBouton}>Débloquer avec l&apos;abonnement</Link>
          )}
          {abonnement.essaiFin && (
            <p className="text-xs text-gris">Essai gratuit jusqu&apos;au {formaterDate(abonnement.essaiFin.slice(0, 10))}.</p>
          )}
        </div>
        <figure className="overflow-hidden rounded-sm border border-pierre/70 bg-white shadow-sm">
          <Image src={m.capture} alt={`Aperçu : ${m.titre}`} width={844} height={700} className="h-auto w-full" />
          <figcaption className="border-t border-pierre/70 px-3 py-2 text-xs text-gris">Exemple avec des données de démonstration.</figcaption>
        </figure>
      </div>
    </div>
  );
}
