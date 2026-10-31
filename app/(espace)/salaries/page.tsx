"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { Carte, Chargement, EnTetePage, Pastille, PastilleCriticite, classeBouton, classeBoutonSecondaire, classeChamp } from "@/components/ui";
import { etatsAccueil } from "@/lib/accueils";
import { supprimerAttestation } from "@/lib/attestations";
import { dateDuJour, formaterDate, nouvelId, risqueResiduel } from "@/lib/calculs";
import { etatsFormation, libelleFormation, typeFormation } from "@/lib/formations";
import { telechargerFicheSalarie } from "@/lib/pdf/telecharger";
import { facteursPenibilite, typesEvenement } from "@/lib/referentiel";
import { ficheSalarie, type FicheSalarie } from "@/lib/salarie";
import { modifier, peutModifier, useDonnees, useSession } from "@/lib/stockage";
import type { Donnees, Salarie } from "@/lib/types";

const categoriesTailles = ["Mains", "Pieds", "Corps", "Haute visibilité"];

const lienFiche = (id: string) => `/salaries?salarie=${id}`;

export default function PageSalaries() {
  // useSearchParams doit être sous un Suspense avec le pré-rendu de Next.js.
  return (
    <Suspense fallback={<Chargement />}>
      <Salaries />
    </Suspense>
  );
}

function Salaries() {
  const donnees = useDonnees();
  const { role } = useSession();
  const salarieId = useSearchParams().get("salarie") ?? "";
  if (!donnees) return <Chargement />;
  const modifiable = peutModifier(role, "tout");
  const fiche = salarieId ? ficheSalarie(donnees, salarieId, dateDuJour()) : null;
  if (fiche) return <Fiche fiche={fiche} donnees={donnees} modifiable={modifiable} />;
  return <Liste donnees={donnees} modifiable={modifiable} introuvable={!!salarieId} />;
}

// Liste des salariés : un clic ouvre la fiche qui réunit tout ce qui concerne la personne.
function Liste({ donnees, modifiable, introuvable }: { donnees: Donnees; modifiable: boolean; introuvable: boolean }) {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const aujourdhui = dateDuJour();
  const terme = recherche.trim().toLowerCase();
  const salaries = donnees.salaries
    .filter((s) => !terme || `${s.nom} ${s.service} ${s.poste}`.toLowerCase().includes(terme))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  const ajouter = () => {
    const id = nouvelId();
    modifier((d) => ({ ...d, salaries: [...d.salaries, { id, nom: "", service: d.services[0] ?? "", poste: "", tailles: {} }] }));
    router.push(lienFiche(id));
  };

  return (
    <div>
      <EnTetePage
        titre="Salariés"
        description="Une fiche par salarié réunit ses formations, ses EPI, son accueil, ses causeries, ses expositions et ses accidents. Elle se télécharge en PDF, à remettre au salarié ou à montrer lors d'un contrôle."
        actions={
          modifiable && (
            <>
              <Link href="/import?type=salaries" className={classeBoutonSecondaire}>
                Importer depuis Excel
              </Link>
              <button type="button" onClick={ajouter} className={classeBouton}>
                + Ajouter un salarié
              </button>
            </>
          )
        }
      />
      {introuvable && <p className="mb-4 text-sm text-[#b42318]">Ce salarié n&apos;existe plus.</p>}

      {donnees.salaries.length ? (
        <Carte titre={`Salariés (${donnees.salaries.length})`}>
          <input
            type="search"
            aria-label="Rechercher un salarié"
            placeholder="Rechercher un salarié…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className={`${classeChamp} mb-3 max-w-sm`}
          />
          <ul className="divide-y divide-pierre/40">
            {salaries.map((s) => {
              const points = ficheSalarie(donnees, s.id, aujourdhui)?.pointsAttention.length ?? 0;
              return (
                <li key={s.id}>
                  <Link href={lienFiche(s.id)} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm hover:bg-ivoire">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{s.nom || "Salarié sans nom"}</span>
                      <span className="text-gris"> · {[s.service, s.poste].filter(Boolean).join(" · ") || "service et poste à renseigner"}</span>
                    </span>
                    {points > 0 ? (
                      <Pastille couleur="#fab219" texte="#0b0b0b" icone="!">
                        {points} point{points > 1 ? "s" : ""} d&apos;attention
                      </Pastille>
                    ) : (
                      <Pastille couleur="#0ca30c" texte="#0b0b0b" icone="✓">
                        À jour
                      </Pastille>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          {!salaries.length && <p className="text-sm text-gris">Aucun salarié ne correspond à la recherche.</p>}
        </Carte>
      ) : (
        <Carte>
          <p className="text-sm text-ardoise">
            Aucun salarié pour l&apos;instant. Ajoutez-les un par un, ou d&apos;un coup depuis un fichier Excel : ils servent aux
            EPI, aux formations, aux accueils et aux causeries.
          </p>
        </Carte>
      )}
    </div>
  );
}

function Fiche({ fiche: f, donnees, modifiable }: { fiche: FicheSalarie; donnees: Donnees; modifiable: boolean }) {
  const router = useRouter();
  const [pdf, setPdf] = useState<"pret" | "generation" | "erreur">("pret");
  const { salarie: s } = f;

  const maj = (champs: Partial<Salarie>) =>
    modifier((d) => ({ ...d, salaries: d.salaries.map((x) => (x.id === s.id ? { ...x, ...champs } : x)) }));

  const supprimer = () => {
    const formations = donnees.formations.filter((x) => x.salarieId === s.id);
    const avertissement = formations.length ? ` Ses ${formations.length} formation(s) et leurs attestations seront supprimées.` : "";
    if (!confirm(`Supprimer ${s.nom || "ce salarié"} ? Son historique d'EPI sera conservé.${avertissement}`)) return;
    modifier((d) => ({
      ...d,
      salaries: d.salaries.filter((x) => x.id !== s.id),
      formations: d.formations.filter((x) => x.salarieId !== s.id),
    }));
    formations.forEach((x) => x.attestation && void supprimerAttestation(x.attestation.chemin));
    router.push("/salaries");
  };

  const telecharger = async () => {
    setPdf("generation");
    try {
      await telechargerFicheSalarie(donnees, s.id);
      setPdf("pret");
    } catch {
      setPdf("erreur");
    }
  };

  const libelleFacteur = (code: string) => facteursPenibilite.find((x) => x.code === code)?.libelle ?? code;

  return (
    <div>
      <Link href="/salaries" className="mb-3 inline-block text-sm text-ardoise underline">
        ← Tous les salariés
      </Link>
      <EnTetePage
        titre={s.nom || "Nouveau salarié"}
        description={[s.service, s.poste].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <button type="button" onClick={telecharger} disabled={pdf === "generation"} className={classeBouton}>
              {pdf === "generation" ? "Préparation…" : "Télécharger la fiche (PDF)"}
            </button>
            {modifiable && (
              <button type="button" onClick={supprimer} className={`${classeBoutonSecondaire} hover:border-[#b42318] hover:text-[#b42318]`}>
                Supprimer
              </button>
            )}
          </>
        }
      />
      {pdf === "erreur" && <p className="mb-4 text-sm text-[#b42318]">Le PDF n&apos;a pas pu être préparé. Réessayez.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Carte titre="Identité" className="lg:col-span-2">
          <fieldset disabled={!modifiable} className="grid min-w-0 gap-3 sm:grid-cols-3">
            <Champ libelle="Nom">
              <input value={s.nom} onChange={(e) => maj({ nom: e.target.value })} className={classeChamp} />
            </Champ>
            <Champ libelle="Service">
              <select value={s.service} onChange={(e) => maj({ service: e.target.value })} className={classeChamp}>
                <option value="">—</option>
                {donnees.services.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Champ>
            <Champ libelle="Poste">
              <input value={s.poste} onChange={(e) => maj({ poste: e.target.value })} className={classeChamp} />
            </Champ>
            {categoriesTailles.map((c) => (
              <Champ key={c} libelle={`Taille ${c.toLowerCase()}`}>
                <input value={s.tailles[c] ?? ""} onChange={(e) => maj({ tailles: { ...s.tailles, [c]: e.target.value } })} className={classeChamp} />
              </Champ>
            ))}
          </fieldset>
          <p className="mt-2 text-xs text-gris">Les tailles sont proposées automatiquement lors de la remise d&apos;un EPI.</p>
        </Carte>

        {f.pointsAttention.length > 0 && (
          <Carte titre={`Points d'attention (${f.pointsAttention.length})`} className="border-[#ec835a] lg:col-span-2">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {f.pointsAttention.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Carte>
        )}

        <Carte titre={`Formations et habilitations (${f.formations.length})`}>
          <Liens
            vide="Aucune formation enregistrée."
            elements={[
              ...f.manquantes.map((m) => ({
                cle: `manque-${m.type}`,
                lien: "/formations",
                texte: typeFormation(m.type).libelle,
                detail: m.expiree ? "expirée, exigée pour son poste" : "exigée pour son poste, non suivie",
                pastille: <Pastille couleur="#d03b3b" texte="#ffffff">{m.expiree ? "Expirée" : "Manquante"}</Pastille>,
              })),
              ...f.formations
                .filter(({ formation: x }) => !f.manquantes.some((m) => m.expiree && m.type === x.type))
                .map(({ formation: x, etat }) => ({
                  cle: x.id,
                  lien: `/formations?formation=${x.id}`,
                  texte: libelleFormation(x),
                  detail: x.expireLe ? `jusqu'au ${formaterDate(x.expireLe)}` : `obtenue le ${formaterDate(x.obtenueLe)}`,
                  pastille: (
                    <Pastille couleur={etatsFormation[etat].couleur} texte={etatsFormation[etat].texte}>
                      {etatsFormation[etat].libelle}
                    </Pastille>
                  ),
                })),
            ]}
          />
        </Carte>

        <Carte titre={`EPI remis (${f.remises.length})`}>
          <Liens
            vide="Aucun équipement remis."
            elements={f.remises.slice(0, 8).map((r) => ({
              cle: r.mouvement.id,
              lien: "/epi?onglet=fiches",
              texte: r.article,
              detail: `${formaterDate(r.mouvement.date)}${r.mouvement.taille ? ` · taille ${r.mouvement.taille}` : ""}`,
              pastille: r.signee ? null : <Pastille couleur="#fab219" texte="#0b0b0b">À faire signer</Pastille>,
            }))}
          />
          {f.remises.length > 8 && (
            <Link href="/epi?onglet=fiches" className="mt-2 inline-block text-sm text-bronze-fonce underline">
              Voir les {f.remises.length} remises →
            </Link>
          )}
        </Carte>

        <Carte titre="Accueil sécurité et causeries">
          <p className="mb-3 text-sm">
            Accueil sécurité :{" "}
            {f.accueil ? (
              <Pastille couleur={etatsAccueil[f.accueil.etat].couleur} texte={etatsAccueil[f.accueil.etat].texte}>
                {etatsAccueil[f.accueil.etat].libelle}
                {f.accueil.accueil.accueilLe ? `, le ${formaterDate(f.accueil.accueil.accueilLe)}` : ""}
              </Pastille>
            ) : (
              <Link href="/accueil" className="text-bronze-fonce underline">
                non enregistré
              </Link>
            )}
          </p>
          <Liens
            vide="Aucune causerie suivie."
            elements={f.causeries.slice(0, 6).map((c) => ({
              cle: c.id,
              lien: `/accueil?causerie=${c.id}`,
              texte: c.theme || "Causerie",
              detail: formaterDate(c.date),
            }))}
          />
        </Carte>

        <Carte titre="Expositions">
          {f.unite ? (
            <p className="mb-2 text-sm text-ardoise">
              Risques de son unité de travail : <strong>{f.unite}</strong>
            </p>
          ) : (
            <p className="mb-2 text-sm text-gris">Unité de travail inconnue : renseignez-la dans son accueil sécurité.</p>
          )}
          <Liens
            vide={f.unite ? "Aucun risque enregistré pour cette unité." : ""}
            elements={f.risques.map((l) => ({
              cle: l.id,
              lien: `/duerp?fiche=${l.id}`,
              texte: l.danger || l.activite || "Risque",
              detail: l.penibilite && l.seuilPenibilite === "oui" ? `pénibilité : ${libelleFacteur(l.penibilite)}` : l.risque,
              pastille: <PastilleCriticite score={risqueResiduel(l)} />,
            }))}
          />
          {f.produits.length > 0 && (
            <div className="mt-3 text-sm">
              <p className="text-ardoise">Produits chimiques utilisés :</p>
              <ul className="mt-1 flex flex-wrap gap-2">
                {f.produits.map((p) => (
                  <li key={p.id}>
                    <Link href={`/produits?produit=${p.id}`} className="text-bronze-fonce underline">
                      {p.nom}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Carte>

        <Carte titre={`Accidents et presque-accidents (${f.evenements.length})`} className="lg:col-span-2">
          <Liens
            vide="Aucun accident ni presque-accident."
            elements={f.evenements.map((e) => {
              const type = typesEvenement.find((t) => t.valeur === e.type);
              return {
                cle: e.id,
                lien: `/accidents?evenement=${e.id}`,
                texte: e.description || type?.libelle || "Événement",
                detail: `${formaterDate(e.date)}${e.joursArret ? ` · ${e.joursArret} jours d'arrêt` : ""}`,
                pastille: type && <Pastille couleur={type.couleur} texte={type.texte}>{type.libelle}</Pastille>,
              };
            })}
          />
        </Carte>
      </div>
    </div>
  );
}

function Champ({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{libelle}</span>
      {children}
    </label>
  );
}

function Liens({
  elements,
  vide,
}: {
  elements: { cle: string; lien: string; texte: string; detail?: string; pastille?: ReactNode }[];
  vide: string;
}) {
  if (!elements.length) return vide ? <p className="text-sm text-gris">{vide}</p> : null;
  return (
    <ul className="divide-y divide-pierre/40">
      {elements.map((e) => (
        <li key={e.cle}>
          <Link href={e.lien} className="flex items-center gap-3 py-2 text-sm hover:bg-ivoire">
            <span className="min-w-0 flex-1">
              <span className="font-medium">{e.texte}</span>
              {e.detail && <span className="text-gris"> · {e.detail}</span>}
            </span>
            {e.pastille}
          </Link>
        </li>
      ))}
    </ul>
  );
}
