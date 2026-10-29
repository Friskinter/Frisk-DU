"use client";

import Link from "next/link";
import { Carte, Chargement, EnTetePage, Indicateur, Pastille } from "@/components/ui";
import { facteursPenibilite } from "@/lib/referentiel";
import { useDonnees } from "@/lib/stockage";
import type { SeuilPenibilite } from "@/lib/types";

const styleSeuil: Record<SeuilPenibilite, { libelle: string; couleur: string; texte: string; icone: string }> = {
  oui: { libelle: "Seuil dépassé", couleur: "#d03b3b", texte: "#ffffff", icone: "!" },
  "a-evaluer": { libelle: "À évaluer", couleur: "#fab219", texte: "#0b0b0b", icone: "?" },
  non: { libelle: "Sous le seuil", couleur: "#0ca30c", texte: "#0b0b0b", icone: "✓" },
};

export default function PagePenibilite() {
  const donnees = useDonnees();
  if (!donnees) return <Chargement />;

  const lignes = donnees.duerp.filter((l) => l.penibilite);
  const depasses = lignes.filter((l) => l.seuilPenibilite === "oui");
  const aEvaluer = lignes.filter((l) => l.seuilPenibilite === "a-evaluer");
  const familles = [...new Set(facteursPenibilite.map((f) => f.famille))];

  return (
    <div>
      <EnTetePage
        titre="Pénibilité"
        description="Les 10 facteurs de risques professionnels du Code du travail, leurs seuils expliqués simplement, et les situations de votre DUERP qui y exposent vos salariés."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicateur
          libelle="Facteurs identifiés"
          valeur={`${new Set(lignes.map((l) => l.penibilite)).size} / 10`}
          detail="présents dans le DUERP"
        />
        <Indicateur
          libelle="Situations au-delà du seuil"
          valeur={depasses.length}
          detail={`${depasses.reduce((s, l) => s + l.effectif, 0)} salariés exposés (cumul)`}
          alerte={depasses.length > 0}
        />
        <Indicateur libelle="À évaluer" valeur={aEvaluer.length} detail="mesure ou estimation à faire" />
        <Indicateur
          libelle="Ouvrant droit au C2P"
          valeur={depasses.filter((l) => facteursPenibilite.find((f) => f.code === l.penibilite)?.c2p).length}
          detail="situations à déclarer en DSN"
        />
      </div>

      <Carte titre="Comprendre la pénibilité" className="mb-6">
        <div className="grid gap-4 text-sm text-ardoise md:grid-cols-3">
          <p>
            Un salarié est exposé à la pénibilité lorsqu&apos;il subit, <strong>au-delà de certains seuils</strong>, un
            des 10 facteurs ci-dessous, pouvant laisser des traces durables sur sa santé. Ces seuils s&apos;apprécient
            <strong> après prise en compte des protections</strong> collectives et individuelles.
          </p>
          <p>
            Pour <strong>6 facteurs</strong> (marqués C2P), l&apos;employeur déclare l&apos;exposition chaque année dans la
            DSN : le salarié cumule des points sur son compte professionnel de prévention (formation, temps partiel,
            départ anticipé à la retraite).
          </p>
          <p>
            Les <strong>4 autres facteurs</strong> n&apos;ouvrent pas de points mais doivent figurer dans le DUERP et faire
            l&apos;objet d&apos;actions de prévention. Les seuils sont rappelés à titre indicatif : vérifiez-les avec les textes en
            vigueur.
          </p>
        </div>
      </Carte>

      {familles.map((famille) => (
        <section key={famille} className="mb-8">
          <h2 className="mb-3 font-serif text-xl">{famille}</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {facteursPenibilite
              .filter((f) => f.famille === famille)
              .map((f) => {
                const situations = lignes.filter((l) => l.penibilite === f.code);
                return (
                  <article key={f.code} className="rounded-sm border border-pierre/70 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-medium">{f.libelle}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          f.c2p ? "bg-encre text-marbre" : "border border-pierre text-ardoise"
                        }`}
                      >
                        {f.c2p ? "C2P" : "Hors C2P"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-ardoise">
                      <span className="font-medium text-encre">Seuil : </span>
                      {f.seuil}
                    </p>
                    <div className="mt-4 border-t border-pierre/60 pt-3">
                      {situations.length === 0 ? (
                        <p className="text-sm text-gris">Aucune situation repérée dans le DUERP.</p>
                      ) : (
                        <ul className="space-y-2">
                          {situations.map((l) => {
                            const s = styleSeuil[l.seuilPenibilite];
                            return (
                              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <span>
                                  <span className="font-medium">{l.unite}</span>
                                  <span className="text-ardoise"> — {l.activite}</span>
                                  <span className="text-gris"> · {l.effectif} salarié{l.effectif > 1 ? "s" : ""}</span>
                                </span>
                                <Pastille couleur={s.couleur} texte={s.texte} icone={s.icone}>
                                  {s.libelle}
                                </Pastille>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </article>
                );
              })}
          </div>
        </section>
      ))}

      <p className="text-sm text-ardoise">
        Pour rattacher une situation à un facteur, renseignez les colonnes « Pénibilité » et « Seuil » du{" "}
        <Link href="/duerp" className="text-bronze-fonce underline">
          tableau DUERP
        </Link>
        .
      </p>
    </div>
  );
}
