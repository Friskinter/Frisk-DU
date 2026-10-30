"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Carte } from "@/components/ui";
import { libelleElement, zones, type EntreeJournal } from "@/lib/journal";
import { MODE_TEST } from "@/lib/mode-test";
import { useSession } from "@/lib/stockage";
import { supabaseNavigateur } from "@/lib/supabase/client";
import type { Donnees } from "@/lib/types";

const verbes: Record<EntreeJournal["action"], string> = {
  ajout: "Ajout",
  modification: "Modification",
  suppression: "Suppression",
};

const dateHeure = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

// « Activité récente » du tableau de bord : les dernières entrées du journal de l'entreprise.
// La base ne renvoie que le journal de l'entreprise de l'utilisateur (règles d'accès).
export function ActiviteRecente({ donnees }: { donnees: Donnees }) {
  const { entrepriseId } = useSession();
  const [entrees, setEntrees] = useState<EntreeJournal[] | null>(null);

  useEffect(() => {
    if (MODE_TEST || !entrepriseId) return;
    let actif = true;
    supabaseNavigateur()
      .from("journal")
      .select("id, created_at, auteur, collection, element_id, action, avant, apres")
      .eq("entreprise_id", entrepriseId)
      .order("id", { ascending: false })
      .limit(8)
      .then(({ data, error }: { data: unknown[] | null; error: unknown }) => {
        if (actif) setEntrees(error ? [] : ((data ?? []) as EntreeJournal[]));
      });
    return () => {
      actif = false;
    };
  }, [entrepriseId]);

  if (!entrees?.length) return null;

  return (
    <Carte
      titre="Activité récente"
      className="mb-6"
      actions={
        <Link href="/journal" className="text-sm text-bronze-fonce underline">
          Tout le journal
        </Link>
      }
    >
      <ul className="divide-y divide-pierre/40 text-sm">
        {entrees.map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 py-2">
            <span className="w-28 shrink-0 text-xs text-gris">{dateHeure.format(new Date(e.created_at))}</span>
            <span className="min-w-0 flex-1">
              {verbes[e.action]} · <span className="font-medium">{libelleElement(e, donnees)}</span>
              <span className="text-gris"> · {zones[e.collection] ?? e.collection}</span>
            </span>
            <span className="text-xs text-ardoise">{e.auteur}</span>
          </li>
        ))}
      </ul>
    </Carte>
  );
}
