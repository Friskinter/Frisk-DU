"use client";

import Link from "next/link";
import { Carte, Chargement, EnTetePage, Pastille, classeBouton, classeChamp } from "@/components/ui";
import { domaines } from "@/lib/bibliotheque";
import { dateDuJour } from "@/lib/calculs";
import { useContexteParcours } from "@/lib/contexte-parcours";
import {
  calculerParcours,
  libellesGroupes,
  libellesReponses,
  questionsOuiNon,
  questionsSansReponse,
  tranches,
  type EtatEtape,
  type GroupeEtape,
} from "@/lib/parcours";
import { modifier, peutModifier, useDonnees, useSession } from "@/lib/stockage";
import type { ProfilEntreprise, ReponseProfil } from "@/lib/types";

const etats: Record<EtatEtape, { libelle: string; couleur: string; texte: string; icone: string }> = {
  fait: { libelle: "Fait", couleur: "#0ca30c", texte: "#0b0b0b", icone: "✓" },
  "en-cours": { libelle: "En cours", couleur: "#fab219", texte: "#0b0b0b", icone: "◐" },
  "a-faire": { libelle: "À faire", couleur: "#e9e4dc", texte: "#0b0b0b", icone: "○" },
};

const ficheVide = { siret: "", adresse: "", activite: "", effectif: "", responsable: "" };

function enregistrerProfil(champs: Partial<ProfilEntreprise>) {
  modifier((d) => ({ ...d, fiche: { ...ficheVide, ...d.fiche, profil: { ...d.fiche?.profil, ...champs } } }));
}

export default function PageParcours() {
  const donnees = useDonnees();
  const { role } = useSession();
  const contexte = useContexteParcours();
  if (!donnees) return <Chargement />;

  const modifiable = peutModifier(role, "tout");
  const parcours = calculerParcours(donnees, { aujourdhui: dateDuJour(), ...contexte });
  const profil = donnees.fiche?.profil ?? {};
  const restantes = questionsSansReponse(profil);
  const groupes = (["bases", "suivi", "duree"] as GroupeEtape[]).filter((g) => parcours.etapes.some((e) => e.groupe === g));

  return (
    <div>
      <EnTetePage
        titre="Mon parcours QHSE"
        description="Les étapes de votre démarche de prévention, adaptées à votre entreprise. Elles se cochent d'elles-mêmes au fil de vos saisies ; revenez-y quand vous voulez."
      />

      <Carte className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-3xl font-semibold tabular-nums">{parcours.pourcentage} %</p>
            <p className="text-sm text-ardoise">
              {parcours.faites} étape{parcours.faites > 1 ? "s" : ""} sur {parcours.total}
            </p>
          </div>
          {parcours.prochaine && (
            <div className="text-sm">
              <p className="text-gris">Prochaine étape</p>
              <Link href={parcours.prochaine.lien} className={`${classeBouton} mt-1`}>
                {parcours.prochaine.titre} →
              </Link>
            </div>
          )}
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-marbre" aria-hidden>
          <div className="h-full bg-bronze transition-all" style={{ width: `${parcours.pourcentage}%` }} />
        </div>
        <p className="mt-3 text-xs text-gris">
          Avancement de votre parcours dans Frisk Plateforme : un repère pour vous organiser, pas une mesure de conformité
          réglementaire.
        </p>
      </Carte>

      <section id="profil" className="mb-6 scroll-mt-6">
        <Carte titre="Votre entreprise">
          <p className="mb-4 text-sm text-ardoise">
            {restantes
              ? `Encore ${restantes} question${restantes > 1 ? "s" : ""} pour adapter votre parcours. `
              : "Votre parcours est adapté à ces réponses. "}
            Elles servent seulement à proposer les bonnes étapes ; modifiez-les à tout moment.
          </p>
          <fieldset disabled={!modifiable} className="grid min-w-0 gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                Secteur d&apos;activité
                <select
                  value={profil.secteur ?? ""}
                  onChange={(e) => enregistrerProfil({ secteur: e.target.value || undefined })}
                  className={`${classeChamp} mt-1`}
                >
                  <option value="">Choisir…</option>
                  {domaines.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nom}
                    </option>
                  ))}
                  <option value="autre">Autre activité</option>
                </select>
              </label>
              <label className="block text-sm">
                Effectif
                <select
                  value={profil.tranche ?? ""}
                  onChange={(e) => enregistrerProfil({ tranche: (e.target.value || undefined) as ProfilEntreprise["tranche"] })}
                  className={`${classeChamp} mt-1`}
                >
                  <option value="">Choisir…</option>
                  {tranches.map((t) => (
                    <option key={t.valeur} value={t.valeur}>
                      {t.libelle}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {questionsOuiNon.map((q) => (
              <fieldset key={q.cle}>
                <legend className="text-sm font-medium">{q.question}</legend>
                <p className="text-xs text-gris">{q.precision}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["oui", "non", "nsp"] as ReponseProfil[]).map((r) => (
                    <label
                      key={r}
                      className="cursor-pointer rounded-sm border border-pierre bg-white px-3 py-1.5 text-sm has-checked:border-bronze has-checked:bg-bronze/15 has-focus-visible:outline-2 has-focus-visible:outline-bronze"
                    >
                      <input
                        type="radio"
                        name={q.cle}
                        value={r}
                        checked={profil[q.cle] === r}
                        onChange={() => enregistrerProfil({ [q.cle]: r })}
                        className="sr-only"
                      />
                      {libellesReponses[r]}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </fieldset>
        </Carte>
      </section>

      {groupes.map((g) => (
        <Carte key={g} titre={libellesGroupes[g]} className="mb-6">
          <ol className="divide-y divide-pierre/40">
            {parcours.etapes
              .filter((e) => e.groupe === g)
              .map((e) => {
                const st = etats[e.etat];
                return (
                  <li key={e.code} className="flex flex-wrap items-start gap-3 py-3">
                    <Pastille couleur={st.couleur} texte={st.texte} icone={st.icone}>
                      {st.libelle}
                    </Pastille>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm font-medium ${e.etat === "fait" ? "text-gris" : ""}`}>{e.titre}</span>
                      <span className="block text-xs text-ardoise">{e.aide}</span>
                    </span>
                    {e.etat !== "fait" && (
                      <Link href={e.lien} className="text-sm text-bronze-fonce underline">
                        {e.bouton} →
                      </Link>
                    )}
                  </li>
                );
              })}
          </ol>
        </Carte>
      ))}

      {parcours.pistes.length > 0 && (
        <Carte titre="Autres pistes à vérifier" className="mb-6">
          <p className="mb-3 text-sm text-ardoise">
            D&apos;après vos réponses, ces sujets semblent moins vous concerner. Ils ne sont pas écartés : prenez un moment pour
            le vérifier.
          </p>
          <ul className="divide-y divide-pierre/40">
            {parcours.pistes.map((p) => (
              <li key={p.code} className="flex flex-wrap items-start gap-3 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{p.titre}</span>
                  <span className="block text-xs text-ardoise">{p.aide}</span>
                </span>
                <Link href={p.lien} className="text-bronze-fonce underline">
                  Voir →
                </Link>
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </div>
  );
}
