"use client";

import { useEffect, useState } from "react";
import { Carte, classeBouton, classeChamp } from "@/components/ui";
import { AVIS_TEXTE_MAX, auteurPropose, erreurAvis, libellesStatutAvis, type Avis, type StatutAvis } from "@/lib/avis";
import { MODE_TEST } from "@/lib/mode-test";
import { supabaseNavigateur } from "@/lib/supabase/client";

type AvisEnregistre = Avis & { statut: StatutAvis };

// Avis du client sur Frisk Plateforme, publié sur le site vitrine Frisk après relecture (lib/avis.ts).
export function AvisClient({ entrepriseId, entreprise, email }: { entrepriseId: string; entreprise: string; email: string }) {
  const [enregistre, setEnregistre] = useState<AvisEnregistre | null | undefined>(MODE_TEST ? null : undefined);
  const [avis, setAvis] = useState<Avis>({ note: 0, texte: "", auteur: auteurPropose(email), fonction: "", entrepriseAffichee: "" });
  const [citerEntreprise, setCiterEntreprise] = useState(true);
  const [accord, setAccord] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<{ type: "erreur" | "info"; texte: string } | null>(null);

  useEffect(() => {
    if (MODE_TEST) return;
    let actif = true;
    supabaseNavigateur()
      .from("avis")
      .select("note, texte, auteur, fonction, entreprise_affichee, statut")
      .maybeSingle()
      .then(({ data }: { data: { note: number; texte: string; auteur: string; fonction: string; entreprise_affichee: string; statut: StatutAvis } | null }) => {
        if (!actif) return;
        if (!data) return setEnregistre(null);
        const lu = { note: data.note, texte: data.texte, auteur: data.auteur, fonction: data.fonction, entrepriseAffichee: data.entreprise_affichee };
        setEnregistre({ ...lu, statut: data.statut });
        setAvis(lu);
        setCiterEntreprise(data.entreprise_affichee !== "");
      });
    return () => {
      actif = false;
    };
  }, []);

  if (enregistre === undefined) return null;

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    const aEnvoyer = { ...avis, entrepriseAffichee: citerEntreprise ? entreprise : "" };
    const erreur = erreurAvis(aEnvoyer);
    if (erreur) return setMessage({ type: "erreur", texte: erreur });
    setEnvoi(true);
    setMessage(null);
    const { error } = MODE_TEST
      ? { error: null }
      : await supabaseNavigateur().rpc("deposer_avis", {
          p_entreprise: entrepriseId,
          p_note: aEnvoyer.note,
          p_texte: aEnvoyer.texte,
          p_auteur: aEnvoyer.auteur,
          p_fonction: aEnvoyer.fonction,
          p_entreprise_affichee: aEnvoyer.entrepriseAffichee,
        });
    setEnvoi(false);
    if (error) return setMessage({ type: "erreur", texte: "Votre avis n'a pas pu être envoyé. Réessayez dans quelques instants." });
    setEnregistre({ ...aEnvoyer, statut: "en_attente" });
    setAccord(false);
    setMessage({ type: "info", texte: "Merci ! Votre avis sera publié sur le site Frisk après relecture." });
  };

  return (
    <Carte titre="Votre avis sur Frisk Plateforme">
      <p className="text-sm text-ardoise">
        Votre retour aide d&apos;autres entreprises à choisir, et nous aide à améliorer Frisk Plateforme. Il est relu par Frisk puis publié sur
        le site Frisk, qu&apos;il soit positif ou négatif.
      </p>
      {enregistre && (
        <p className="mt-2 text-sm">
          État de votre avis : <strong>{libellesStatutAvis[enregistre.statut]}</strong>. Le modifier le renvoie en relecture.
        </p>
      )}

      <form onSubmit={envoyer} className="mt-4 space-y-4">
        <fieldset>
          <legend className="text-sm">Note</legend>
          <div className="mt-1 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer">
                <input
                  type="radio"
                  name="note"
                  value={n}
                  checked={avis.note === n}
                  onChange={() => setAvis({ ...avis, note: n })}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={`block text-2xl leading-none peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-bronze ${
                    n <= avis.note ? "text-bronze" : "text-pierre"
                  }`}
                >
                  ★
                </span>
                <span className="sr-only">{n} étoile{n > 1 ? "s" : ""} sur 5</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm">
          Votre avis
          <textarea
            rows={4}
            maxLength={AVIS_TEXTE_MAX}
            value={avis.texte}
            onChange={(e) => setAvis({ ...avis, texte: e.target.value })}
            placeholder="Ce qui vous a été utile, ce qui pourrait être amélioré…"
            className={`${classeChamp} mt-1`}
          />
          <span className="mt-1 block text-right text-xs text-gris">
            {avis.texte.trim().length} / {AVIS_TEXTE_MAX}
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            Nom affiché
            <input
              maxLength={80}
              value={avis.auteur}
              onChange={(e) => setAvis({ ...avis, auteur: e.target.value })}
              placeholder="Ex. Marie D."
              className={`${classeChamp} mt-1`}
            />
          </label>
          <label className="block text-sm">
            Fonction (facultatif)
            <input
              maxLength={80}
              value={avis.fonction}
              onChange={(e) => setAvis({ ...avis, fonction: e.target.value })}
              placeholder="Ex. Gérante"
              className={`${classeChamp} mt-1`}
            />
          </label>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 accent-bronze" checked={citerEntreprise} onChange={(e) => setCiterEntreprise(e.target.checked)} />
          <span>Citer le nom de mon entreprise ({entreprise})</span>
        </label>
        <label className="flex items-start gap-2 text-xs text-ardoise">
          <input type="checkbox" required className="mt-0.5 accent-bronze" checked={accord} onChange={(e) => setAccord(e.target.checked)} />
          <span>
            J&apos;accepte que cet avis soit publié sur le site Frisk avec le nom indiqué. Je peux le modifier à tout moment depuis cette
            page, ou demander son retrait à Frisk.
          </span>
        </label>

        {message && (
          <p role={message.type === "erreur" ? "alert" : "status"} className={`text-sm ${message.type === "erreur" ? "text-[#b42318]" : "text-[#006300]"}`}>
            {message.texte}
          </p>
        )}
        <button type="submit" disabled={envoi || !accord} className={`${classeBouton} disabled:opacity-60`}>
          {envoi ? "Envoi…" : enregistre ? "Mettre à jour mon avis" : "Envoyer mon avis"}
        </button>
      </form>
    </Carte>
  );
}
