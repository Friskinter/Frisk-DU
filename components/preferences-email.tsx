"use client";

import { useEffect, useState } from "react";
import { Carte, classeBouton } from "@/components/ui";
import { MODE_TEST } from "@/lib/mode-test";
import { preferencesParDefaut, type PreferencesEmail } from "@/lib/preferences-email";
import { supabaseNavigateur } from "@/lib/supabase/client";

// Mon compte : les e-mails que la personne souhaite recevoir pour l'entreprise ouverte.
export function PreferencesEmailCompte({ entrepriseId, entreprise, recapitulatifEntreprise }: { entrepriseId: string; entreprise: string; recapitulatifEntreprise: boolean }) {
  const [enregistrees, setEnregistrees] = useState<PreferencesEmail | undefined>(MODE_TEST ? preferencesParDefaut : undefined);
  const [choix, setChoix] = useState<PreferencesEmail>(preferencesParDefaut);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<{ type: "erreur" | "info"; texte: string } | null>(null);

  useEffect(() => {
    if (MODE_TEST) return;
    let actif = true;
    supabaseNavigateur()
      .from("preferences_email")
      .select("recapitulatif, immediats")
      .eq("entreprise_id", entrepriseId)
      .maybeSingle()
      .then(({ data }: { data: PreferencesEmail | null }) => {
        if (!actif) return;
        const lues = data ?? preferencesParDefaut;
        setEnregistrees(lues);
        setChoix(lues);
      });
    return () => {
      actif = false;
    };
  }, [entrepriseId]);

  if (!enregistrees) return null;
  const modifie = choix.recapitulatif !== enregistrees.recapitulatif || choix.immediats !== enregistrees.immediats;

  const enregistrer = async () => {
    setEnvoi(true);
    setMessage(null);
    const { error } = MODE_TEST
      ? { error: null }
      : await supabaseNavigateur().rpc("changer_preferences_email", {
          p_entreprise: entrepriseId,
          p_recapitulatif: choix.recapitulatif,
          p_immediats: choix.immediats,
        });
    setEnvoi(false);
    if (error) return setMessage({ type: "erreur", texte: "Vos préférences n'ont pas pu être enregistrées. Réessayez dans quelques instants." });
    setEnregistrees(choix);
    setMessage({ type: "info", texte: "Préférences enregistrées." });
  };

  return (
    <Carte titre="E-mails que je reçois">
      <p className="mb-3 text-sm text-ardoise">
        Pour l&apos;entreprise <strong>{entreprise}</strong>. Ces choix ne concernent que vous ; chacun règle les siens.
      </p>
      <div className="space-y-3">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 accent-bronze"
            checked={choix.recapitulatif}
            onChange={(e) => setChoix({ ...choix, recapitulatif: e.target.checked })}
          />
          <span>
            Récapitulatif du lundi
            <span className="block text-xs text-gris">
              Les points à traiter de la semaine : actions en retard, formations et vérifications à prévoir, stocks d&apos;EPI…
              {!recapitulatifEntreprise && " Il est actuellement désactivé pour toute l'entreprise par un responsable (Salariés & réglages)."}
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 accent-bronze"
            checked={choix.immediats}
            onChange={(e) => setChoix({ ...choix, immediats: e.target.checked })}
          />
          <span>
            E-mails immédiats
            <span className="block text-xs text-gris">Envoyés sur le moment, par exemple lorsqu&apos;un salarié signale un accident ou un danger avec le QR code.</span>
          </span>
        </label>
      </div>
      {message && (
        <p role="status" className={`mt-3 text-sm ${message.type === "erreur" ? "text-[#b42318]" : "text-ardoise"}`}>{message.texte}</p>
      )}
      <button type="button" className={`${classeBouton} mt-4 disabled:opacity-60`} disabled={!modifie || envoi} onClick={enregistrer}>
        {envoi ? "Enregistrement…" : "Enregistrer mes préférences"}
      </button>
    </Carte>
  );
}
