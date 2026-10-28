"use client";

import Link from "next/link";
import { decalerJours, formaterDate } from "@/lib/calculs";
import { useSession } from "@/lib/stockage";
import { useVersions } from "@/lib/versions";

// Rappelle la date de la dernière version figée et l'échéance de la mise à jour annuelle.
export function RappelVersion({ aujourdhui }: { aujourdhui: string }) {
  const session = useSession();
  const { versions, chargement, erreur } = useVersions(session.entrepriseId);
  if (chargement || erreur) return null;

  const derniere = versions[0];
  const echeance = derniere ? decalerJours(derniere.created_at.slice(0, 10), 365) : "";
  const depassee = !derniere || echeance < aujourdhui;
  const proche = !depassee && echeance < decalerJours(aujourdhui, 60);

  return (
    <div
      className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border p-4 text-sm ${
        depassee ? "border-[#d03b3b] bg-[#d03b3b]/10" : proche ? "border-[#fab219] bg-[#fab219]/10" : "border-pierre/70 bg-white"
      }`}
    >
      <p>
        {derniere ? (
          <>
            <strong>{depassee ? "⚠ Mise à jour annuelle dépassée. " : proche ? "Mise à jour annuelle à prévoir. " : "✓ "}</strong>
            Dernière version figée : n° {derniere.numero} du {formaterDate(derniere.created_at.slice(0, 10))}. Prochaine mise
            à jour avant le {formaterDate(echeance)}.
          </>
        ) : (
          <>
            <strong>⚠ Aucune version figée.</strong> Une fois le DUERP complété, figez une version datée : c&apos;est elle
            qui fait foi et qui doit être conservée.
          </>
        )}
      </p>
      <Link href="/duerp" className="text-bronze underline">
        Gérer les versions
      </Link>
    </div>
  );
}
