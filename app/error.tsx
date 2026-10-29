"use client";

import Link from "next/link";
import { useEffect } from "react";
import { signalerErreur } from "@/components/suivi-erreurs";

// Erreur inattendue dans une page : message clair, possibilité de réessayer, erreur transmise à Frisk.
export default function Erreur({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => signalerErreur(error), [error]);
  return (
    <div className="mx-auto mt-16 max-w-lg rounded-sm border border-pierre/70 bg-white p-8 text-center">
      <h1 className="font-serif text-2xl">Un problème est survenu</h1>
      <p className="mt-3 text-sm text-ardoise">
        Cette page n&apos;a pas pu s&apos;afficher. Vos données enregistrées ne sont pas perdues. L&apos;équipe Frisk a été prévenue.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="rounded-sm bg-bronze px-3.5 py-2 text-sm font-medium text-encre hover:bg-bronze-clair">
          Réessayer
        </button>
        <Link href="/" className="px-3.5 py-2 text-sm underline">Retour au tableau de bord</Link>
      </div>
    </div>
  );
}
