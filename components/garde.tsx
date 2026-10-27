"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Chargement, classeBouton } from "@/components/ui";
import { deconnecter, enregistrementEnAttente, useSession } from "@/lib/stockage";

function Message({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="mx-auto mt-16 max-w-lg rounded-sm border border-pierre/70 bg-white p-8 text-center">
      <h1 className="font-serif text-2xl">{titre}</h1>
      <div className="mt-3 space-y-4 text-sm text-ardoise">{children}</div>
    </div>
  );
}

// Affiche l'espace de l'entreprise seulement quand ses données sont prêtes.
export function Garde({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session.statut === "mot-de-passe-provisoire") router.replace("/mot-de-passe");
  }, [session.statut, router]);

  // Prévient avant de quitter la page si une modification n'est pas encore enregistrée.
  useEffect(() => {
    const avertir = (e: BeforeUnloadEvent) => {
      if (enregistrementEnAttente()) e.preventDefault();
    };
    window.addEventListener("beforeunload", avertir);
    return () => window.removeEventListener("beforeunload", avertir);
  }, []);

  switch (session.statut) {
    case "chargement":
    case "mot-de-passe-provisoire":
      return <Chargement />;
    case "aucun-espace":
      return (
        <Message titre="Aucun espace entreprise">
          {session.admin ? (
            <>
              <p>Choisissez l&apos;entreprise à ouvrir depuis la console Frisk.</p>
              <Link href="/console" className={classeBouton}>Ouvrir la console</Link>
            </>
          ) : (
            <>
              <p>Votre compte n&apos;est rattaché à aucune entreprise. Contactez Frisk pour activer votre accès.</p>
              <button type="button" onClick={deconnecter} className="text-bronze underline">Se déconnecter</button>
            </>
          )}
        </Message>
      );
    case "suspendu":
      return (
        <Message titre="Accès suspendu">
          <p>L&apos;accès de votre entreprise à Frisk DU est suspendu. Contactez Frisk pour le réactiver.</p>
          <button type="button" onClick={deconnecter} className="text-bronze underline">Se déconnecter</button>
        </Message>
      );
    case "erreur":
      return (
        <Message titre="Connexion impossible">
          <p>Vos données n&apos;ont pas pu être chargées. Vérifiez votre connexion internet puis réessayez.</p>
          <button type="button" onClick={() => window.location.reload()} className={classeBouton}>Réessayer</button>
        </Message>
      );
    case "pret":
      return (
        <>
          {session.enregistrement === "conflit" && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[#d03b3b] bg-[#d03b3b]/10 p-3 text-sm">
              <span>
                <strong>⚠ Modifications non enregistrées.</strong> Un collègue a modifié les données en même temps que
                vous. Rechargez la page pour récupérer la dernière version.
              </span>
              <button type="button" onClick={() => window.location.reload()} className={classeBouton}>
                Recharger
              </button>
            </div>
          )}
          {children}
        </>
      );
  }
}
