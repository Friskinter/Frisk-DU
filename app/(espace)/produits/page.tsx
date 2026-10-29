"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Carte,
  Chargement,
  EnTetePage,
  Indicateur,
  Pastille,
  PastilleCriticite,
  classeBouton,
  classeBoutonSecondaire,
  classeChamp,
} from "@/components/ui";
import { deposerAttestation, ouvrirAttestation, supprimerAttestation, TYPES_ACCEPTES } from "@/lib/attestations";
import { dateDuJour, formaterDate, risqueResiduel, telechargerCsv } from "@/lib/calculs";
import { nouvelleLigne } from "@/lib/donnees";
import { telechargerInventaireProduits, telechargerNoticesDePoste } from "@/lib/pdf/telecharger";
import {
  classementCmr,
  estCmr,
  etatFds,
  etatsFds,
  libelleMention,
  lireMentions,
  nouveauProduit,
  pictogrammesDe,
} from "@/lib/produits";
import { modifier, peutModifier, useDonnees, useSession } from "@/lib/stockage";
import type { Donnees, Produit } from "@/lib/types";

const libelle = "mb-1 block text-xs font-medium text-ardoise";
const grilleLigne = "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_9rem_1.5rem]";

function majProduit(id: string, champs: Partial<Produit>) {
  modifier((d) => ({ ...d, produits: d.produits.map((p) => (p.id === id ? { ...p, ...champs } : p)) }));
}

export default function PageProduits() {
  const donnees = useDonnees();
  const { role, entrepriseId } = useSession();
  const [ouvert, setOuvert] = useState("");
  const [unite, setUnite] = useState("");
  const [cmrSeulement, setCmrSeulement] = useState(false);
  const [retires, setRetires] = useState(false);

  if (!donnees) return <Chargement />;
  const modifiable = peutModifier(role, "tout");
  const aujourdhui = dateDuJour();
  const actifs = donnees.produits.filter((p) => p.actif);
  const unites = [...new Set([...donnees.unites, ...donnees.duerp.map((l) => l.unite), ...donnees.produits.map((p) => p.unite)].filter(Boolean))];

  const liste = donnees.produits
    .filter((p) => (retires || p.actif) && (!unite || p.unite === unite) && (!cmrSeulement || classementCmr(p)))
    .sort((a, b) => Number(b.actif) - Number(a.actif) || Number(estCmr(b)) - Number(estCmr(a)) || a.nom.localeCompare(b.nom, "fr"));

  const ajouter = () => {
    const p = nouveauProduit({ unite });
    modifier((d) => ({ ...d, produits: [...d.produits, p] }));
    setRetires(false);
    setCmrSeulement(false);
    setOuvert(p.id);
  };

  const exporter = () =>
    telechargerCsv(`Produits chimiques - ${donnees.entreprise} - ${aujourdhui}.csv`, [
      ["Produit", "Fournisseur", "Référence", "Usage", "Unité de travail", "Stockage", "Quantité par an", "Mentions de danger", "Pictogrammes", "CMR", "Date de la FDS", "FDS jointe", "Protections", "Salariés exposés", "Utilisé"],
      ...donnees.produits.map((p) => {
        const cmr = classementCmr(p);
        return [
          p.nom, p.fournisseur, p.reference, p.usage, p.unite, p.stockage, p.quantite, p.mentionsH.join(" "),
          pictogrammesDe(p.mentionsH).map((x) => x.libelle).join(", "),
          cmr ? `Catégorie ${cmr.categorie} (${cmr.effets.join(", ")})` : "", formaterDate(p.fdsDate), p.fds ? "Oui" : "Non", p.epi,
          p.salariesExposes.map((id) => donnees.salaries.find((s) => s.id === id)?.nom ?? "").filter(Boolean).join(", "),
          p.actif ? "Oui" : "Non",
        ];
      }),
    ]);

  const fdsAJour = actifs.filter((p) => etatFds(p, aujourdhui) === "a-jour").length;

  return (
    <div>
      <EnTetePage
        titre="Produits chimiques"
        description="Inventaire des produits utilisés, avec leur fiche de données de sécurité (FDS). Frisk DU déduit les pictogrammes des mentions de danger, repère les produits cancérogènes, mutagènes ou toxiques pour la reproduction (CMR) et prépare les notices de poste."
        actions={
          <>
            <button type="button" className={classeBoutonSecondaire} onClick={() => telechargerInventaireProduits(donnees)}>
              Inventaire (PDF)
            </button>
            <button type="button" className={classeBoutonSecondaire} onClick={() => telechargerNoticesDePoste(donnees)} disabled={!actifs.length}>
              Notices de poste (PDF)
            </button>
            <button type="button" className={classeBoutonSecondaire} onClick={exporter}>
              Exporter (Excel)
            </button>
            {modifiable && (
              <button type="button" className={classeBouton} onClick={ajouter}>
                + Produit
              </button>
            )}
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicateur libelle="Produits utilisés" valeur={actifs.length} detail={`${actifs.filter((p) => p.mentionsH.length).length} classés dangereux`} />
        <Indicateur
          libelle="Produits CMR"
          valeur={actifs.filter(estCmr).length}
          detail={`${actifs.filter((p) => classementCmr(p)?.categorie === 2).length} autre(s) suspecté(s) (catégorie 2)`}
          alerte={actifs.some(estCmr)}
        />
        <Indicateur
          libelle="FDS à jour"
          valeur={actifs.length ? `${Math.round((fdsAJour / actifs.length) * 100)} %` : "—"}
          detail={`${actifs.filter((p) => etatFds(p, aujourdhui) === "manquante").length} manquante(s)`}
          alerte={actifs.some((p) => etatFds(p, aujourdhui) === "manquante")}
        />
        <Indicateur
          libelle="Non rattachés au DUERP"
          valeur={actifs.filter((p) => p.mentionsH.length && !donnees.duerp.some((l) => l.id === p.risqueId)).length}
          detail="produits dangereux à évaluer"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select aria-label="Filtrer par unité de travail" value={unite} onChange={(e) => setUnite(e.target.value)} className={`${classeChamp} max-w-60`}>
          <option value="">Toutes les unités de travail</option>
          {unites.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-ardoise">
          <input type="checkbox" className="accent-bronze" checked={cmrSeulement} onChange={(e) => setCmrSeulement(e.target.checked)} />
          CMR seulement
        </label>
        <label className="flex items-center gap-2 text-sm text-ardoise">
          <input type="checkbox" className="accent-bronze" checked={retires} onChange={(e) => setRetires(e.target.checked)} />
          Afficher les produits retirés
        </label>
      </div>

      {liste.length === 0 ? (
        <p className="rounded-sm border border-pierre/70 bg-white p-6 text-center text-sm text-gris">
          {donnees.produits.length
            ? "Aucun produit ne correspond à ces critères."
            : "Aucun produit enregistré. Faites le tour des ateliers et des locaux de stockage : chaque produit étiqueté avec un pictogramme de danger doit figurer ici, avec sa FDS."}
        </p>
      ) : (
        <div className="rounded-sm border border-pierre/70 bg-white">
          <div className={`${grilleLigne} hidden gap-x-3 border-b border-pierre/60 bg-marbre px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ardoise lg:grid`}>
            <span>Produit</span>
            <span>Unité et stockage</span>
            <span>Dangers</span>
            <span>Mentions H</span>
            <span>FDS</span>
            <span />
          </div>
          <ul>
            {liste.map((p) => (
              <li key={p.id} className="border-b border-pierre/60 last:border-b-0">
                <LigneProduit produit={p} aujourdhui={aujourdhui} ouvert={ouvert === p.id} onBasculer={() => setOuvert(ouvert === p.id ? "" : p.id)} />
                {ouvert === p.id && (
                  <div className="border-t border-pierre/60 bg-ivoire p-3 sm:p-4">
                    <FicheProduit
                      produit={p}
                      donnees={donnees}
                      unites={unites}
                      aujourdhui={aujourdhui}
                      modifiable={modifiable}
                      entrepriseId={entrepriseId}
                      onFermer={() => setOuvert("")}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Pictogrammes({ mentions }: { mentions: string[] }) {
  const liste = pictogrammesDe(mentions);
  if (!liste.length) return <span className="text-xs text-gris">Aucun pictogramme</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {liste.map((p) => (
        <span
          key={p.code}
          title={`${p.code} : ${p.libelle}`}
          className="flex h-7 w-7 rotate-45 items-center justify-center border-2 border-[#d03b3b] bg-white"
        >
          <span className="-rotate-45 text-xs leading-none" aria-label={p.libelle}>
            {p.symbole}
          </span>
        </span>
      ))}
    </span>
  );
}

function PastilleCmr({ produit }: { produit: Produit }) {
  const cmr = classementCmr(produit);
  if (!cmr) return null;
  return cmr.categorie === 1 ? (
    <Pastille couleur="#d03b3b" texte="#ffffff" icone="‼">CMR</Pastille>
  ) : (
    <Pastille couleur="#fab219" texte="#0b0b0b">CMR suspecté</Pastille>
  );
}

function LigneProduit({ produit: p, aujourdhui, ouvert, onBasculer }: { produit: Produit; aujourdhui: string; ouvert: boolean; onBasculer: () => void }) {
  const fds = etatsFds[etatFds(p, aujourdhui)];
  return (
    <button
      type="button"
      onClick={onBasculer}
      aria-expanded={ouvert}
      className={`${grilleLigne} grid w-full gap-x-3 gap-y-1.5 px-3 py-2.5 text-left text-sm hover:bg-marbre/40 ${ouvert ? "bg-marbre/40" : ""} ${p.actif ? "" : "opacity-60"}`}
    >
      <span className="block">
        <span className="block font-medium">
          {p.nom || "Produit sans nom"}
          {!p.actif && <span className="ml-2 text-xs font-normal text-gris">(retiré)</span>}
        </span>
        <span className="block text-xs text-gris">{[p.fournisseur, p.usage].filter(Boolean).join(" · ")}</span>
      </span>
      <span className="block">
        <span className="block">{p.unite || <span className="text-gris">Unité à préciser</span>}</span>
        {p.stockage && <span className="block text-xs text-gris">{p.stockage}</span>}
      </span>
      <span className="flex flex-wrap items-center gap-2 py-1">
        <Pictogrammes mentions={p.mentionsH} />
        <PastilleCmr produit={p} />
      </span>
      <span className="block text-xs text-ardoise">{p.mentionsH.join(", ") || <span className="text-gris">Non dangereux ou à compléter</span>}</span>
      <span className="block">
        <Pastille couleur={fds.couleur} texte={fds.texte}>{fds.libelle}</Pastille>
        {p.fdsDate && <span className="block text-xs text-gris">du {formaterDate(p.fdsDate)}</span>}
      </span>
      <span className="hidden text-right text-bronze-fonce lg:block">{ouvert ? "▲" : "▼"}</span>
    </button>
  );
}

function FicheProduit({
  produit: p,
  donnees,
  unites,
  aujourdhui,
  modifiable,
  entrepriseId,
  onFermer,
}: {
  produit: Produit;
  donnees: Donnees;
  unites: string[];
  aujourdhui: string;
  modifiable: boolean;
  entrepriseId: string;
  onFermer: () => void;
}) {
  const maj = (champs: Partial<Produit>) => majProduit(p.id, champs);
  const [mentionsSaisies, setMentionsSaisies] = useState(p.mentionsH.join(", "));
  const [envoi, setEnvoi] = useState("");
  const cmr = classementCmr(p);
  const risque = donnees.duerp.find((l) => l.id === p.risqueId);
  const risquesProposes = [...donnees.duerp].sort(
    (a, b) => Number(b.unite === p.unite) - Number(a.unite === p.unite) || Number(b.danger === "Produits chimiques") - Number(a.danger === "Produits chimiques"),
  );

  const deposerFds = async (fichier: File | undefined) => {
    if (!fichier) return;
    setEnvoi("en-cours");
    try {
      const fds = await deposerAttestation(entrepriseId, p.id, fichier);
      const ancienne = p.fds?.chemin;
      maj({ fds });
      if (ancienne) void supprimerAttestation(ancienne);
      setEnvoi("");
    } catch (erreur) {
      setEnvoi(erreur instanceof Error ? erreur.message : "L'envoi du fichier a échoué.");
    }
  };
  const retirerFds = () => {
    if (!p.fds || !confirm("Retirer la FDS jointe ?")) return;
    const chemin = p.fds.chemin;
    maj({ fds: undefined });
    void supprimerAttestation(chemin);
  };
  const supprimer = () => {
    if (!confirm(`Supprimer « ${p.nom || "ce produit"} » de l'inventaire ? Pour garder une trace d'un produit qui n'est plus utilisé, décochez plutôt « Produit encore utilisé ».`)) return;
    modifier((d) => ({ ...d, produits: d.produits.filter((x) => x.id !== p.id) }));
    if (p.fds) void supprimerAttestation(p.fds.chemin);
    onFermer();
  };
  // Le risque chimique n'est pas encore dans le DUERP : on crée la ligne, à coter ensuite.
  const creerRisque = () => {
    const ligne = nouvelleLigne(p.unite || donnees.unites[0] || "", {
      activite: p.usage,
      danger: "Produits chimiques",
      risque: cmr ? "Cancer, atteinte génétique ou de la reproduction" : "Intoxication, irritation, brûlure chimique",
      gravite: cmr?.categorie === 1 ? 4 : 2,
      penibilite: "chimique",
      seuilPenibilite: "a-evaluer",
    });
    modifier((d) => ({
      ...d,
      duerp: [...d.duerp, ligne],
      produits: d.produits.map((x) => (x.id === p.id ? { ...x, risqueId: ligne.id } : x)),
    }));
  };
  const basculerExpose = (id: string) =>
    maj({ salariesExposes: p.salariesExposes.includes(id) ? p.salariesExposes.filter((x) => x !== id) : [...p.salariesExposes, id] });

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Carte titre="Identification">
        <fieldset disabled={!modifiable} className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={libelle}>Nom commercial</span>
            <input value={p.nom} onChange={(x) => maj({ nom: x.target.value })} className={classeChamp} />
          </label>
          <label>
            <span className={libelle}>Fournisseur</span>
            <input value={p.fournisseur} onChange={(x) => maj({ fournisseur: x.target.value })} className={classeChamp} />
          </label>
          <label>
            <span className={libelle}>Référence</span>
            <input value={p.reference} onChange={(x) => maj({ reference: x.target.value })} className={classeChamp} />
          </label>
          <label className="sm:col-span-2">
            <span className={libelle}>Usage</span>
            <input value={p.usage} placeholder="À quoi il sert et comment il est utilisé (pinceau, pulvérisation…)" onChange={(x) => maj({ usage: x.target.value })} className={classeChamp} />
          </label>
          <label>
            <span className={libelle}>Unité de travail</span>
            <select value={p.unite} onChange={(x) => maj({ unite: x.target.value })} className={classeChamp}>
              <option value="">À préciser</option>
              {unites.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
          <label>
            <span className={libelle}>Quantité utilisée par an</span>
            <input value={p.quantite} placeholder="40 L, 25 kg…" onChange={(x) => maj({ quantite: x.target.value })} className={classeChamp} />
          </label>
          <label className="sm:col-span-2">
            <span className={libelle}>Lieu de stockage</span>
            <input value={p.stockage} placeholder="Armoire ventilée de l'atelier…" onChange={(x) => maj({ stockage: x.target.value })} className={classeChamp} />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="accent-bronze" checked={p.actif} onChange={(x) => maj({ actif: x.target.checked })} />
            Produit encore utilisé (décochez pour le garder pour mémoire)
          </label>
        </fieldset>
      </Carte>

      <Carte titre="Dangers et fiche de données de sécurité">
        <fieldset disabled={!modifiable} className="min-w-0">
          <label className="block">
            <span className={libelle}>Mentions de danger (rubrique 2 de la FDS)</span>
            <input
              value={mentionsSaisies}
              placeholder="H225, H319, H336…"
              onChange={(x) => {
                setMentionsSaisies(x.target.value);
                maj({ mentionsH: lireMentions(x.target.value) });
              }}
              className={classeChamp}
            />
          </label>
        </fieldset>
        {p.mentionsH.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-ardoise">
            {p.mentionsH.map((m) => (
              <li key={m}>{libelleMention(m)}</li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Pictogrammes mentions={p.mentionsH} />
          <span className="text-xs text-gris">{pictogrammesDe(p.mentionsH).map((x) => x.libelle).join(" · ")}</span>
        </div>
        {cmr && (
          <div className={`mt-3 rounded-sm border p-3 text-xs ${cmr.categorie === 1 ? "border-[#d03b3b] bg-[#d03b3b]/10 text-[#8a1c12]" : "border-[#fab219] bg-[#fab219]/10 text-ardoise"}`}>
            <p className="font-semibold">
              {cmr.categorie === 1 ? "Produit CMR" : "CMR suspecté (catégorie 2)"} : {cmr.effets.join(", ")}.
            </p>
            {cmr.categorie === 1 ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>Remplacer le produit dès que c&apos;est techniquement possible, et noter les recherches faites (art. R4412-66).</li>
                <li>Travailler en système clos ou, à défaut, réduire l&apos;exposition au plus bas niveau possible.</li>
                <li>Suivi individuel renforcé par le médecin du travail pour les salariés exposés (art. R4624-23).</li>
                <li>Informer et former les salariés. Travaux interdits aux jeunes de moins de 18 ans (sauf dérogation) et, pour certains produits, aux femmes enceintes ou allaitantes.</li>
              </ul>
            ) : (
              <p className="mt-1">Cherchez un produit de remplacement et limitez l&apos;exposition ; parlez-en au médecin du travail.</p>
            )}
          </div>
        )}

        <div className="mt-4 border-t border-pierre/60 pt-3">
          <fieldset disabled={!modifiable} className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label>
              <span className={libelle}>Date de révision de la FDS</span>
              <input type="date" value={p.fdsDate} max={aujourdhui} onChange={(x) => maj({ fdsDate: x.target.value })} className={classeChamp} />
            </label>
          </fieldset>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-xs font-medium text-ardoise">FDS :</span>
            {p.fds ? (
              // Un lien plutôt qu'un bouton : il reste utilisable en lecture seule.
              <a
                href="#"
                onClick={(x) => {
                  x.preventDefault();
                  void ouvrirAttestation(p.fds!.chemin);
                }}
                className="text-bronze-fonce underline"
              >
                📎 {p.fds.nom}
              </a>
            ) : (
              <span className="text-xs text-gris">non jointe</span>
            )}
            {modifiable && (
              <>
                <label className="cursor-pointer text-xs text-ardoise underline">
                  {p.fds ? "Remplacer" : "Joindre la FDS (PDF)"}
                  <input
                    type="file"
                    accept={TYPES_ACCEPTES.join(",")}
                    className="sr-only"
                    onChange={(x) => {
                      void deposerFds(x.target.files?.[0]);
                      x.target.value = "";
                    }}
                  />
                </label>
                {p.fds && (
                  <button type="button" onClick={retirerFds} className="text-xs text-ardoise underline">
                    Retirer
                  </button>
                )}
              </>
            )}
            {envoi === "en-cours" && <span className="text-xs text-gris">Envoi…</span>}
            {envoi && envoi !== "en-cours" && <span className="text-xs text-[#b42318]">{envoi}</span>}
          </div>
          <p className="mt-2 text-xs text-gris">
            Le fournisseur doit vous remettre gratuitement la FDS en français, et sa mise à jour quand elle change. Demandez-la si elle manque.
          </p>
        </div>
      </Carte>

      <Carte titre="Prévention et notice de poste">
        <fieldset disabled={!modifiable} className="grid min-w-0 gap-3">
          <label>
            <span className={libelle}>Protections à porter</span>
            <input value={p.epi} placeholder="Gants nitrile, lunettes, masque A2…" onChange={(x) => maj({ epi: x.target.value })} className={classeChamp} />
          </label>
          <label>
            <span className={libelle}>Consignes d&apos;utilisation et en cas d&apos;accident</span>
            <textarea
              rows={3}
              value={p.consignes}
              placeholder="Utiliser sous aspiration, refermer après usage. En cas de contact avec les yeux : rincer 15 minutes et appeler le 15."
              onChange={(x) => maj({ consignes: x.target.value })}
              className={`${classeChamp} resize-y`}
            />
          </label>
          <label>
            <span className={libelle}>
              Recherche d&apos;un produit moins dangereux{cmr?.categorie === 1 ? " (obligatoire pour un CMR)" : ""}
            </span>
            <textarea
              rows={2}
              value={p.substitution}
              placeholder="Produits étudiés, essais, raisons pour lesquelles la substitution n'est pas encore possible…"
              onChange={(x) => maj({ substitution: x.target.value })}
              className={`${classeChamp} resize-y ${cmr?.categorie === 1 && !p.substitution.trim() ? "border-[#d03b3b]" : ""}`}
            />
          </label>
        </fieldset>
        <p className="mt-2 text-xs text-gris">
          Ces informations alimentent la notice de poste à afficher près du lieu d&apos;utilisation (art. R4412-39).
        </p>
      </Carte>

      <Carte titre="Évaluation et salariés exposés">
        <fieldset disabled={!modifiable} className="min-w-0">
          <label className="block">
            <span className={libelle}>Risque du DUERP</span>
            <select value={risque ? p.risqueId : ""} onChange={(x) => maj({ risqueId: x.target.value })} className={classeChamp}>
              <option value="">À rattacher</option>
              {risquesProposes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.unite} · {l.danger || l.activite || "Risque sans titre"}{l.risque ? ` (${l.risque})` : ""}
                </option>
              ))}
            </select>
          </label>
          {risque ? (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ardoise">
              Risque résiduel : <PastilleCriticite score={risqueResiduel(risque)} />
              {risque.penibilite !== "chimique" && (
                <button
                  type="button"
                  onClick={() => modifier((d) => ({ ...d, duerp: d.duerp.map((l) => (l.id === risque.id ? { ...l, penibilite: "chimique", seuilPenibilite: l.seuilPenibilite === "non" ? "a-evaluer" : l.seuilPenibilite } : l)) }))}
                  className="text-bronze-fonce underline disabled:hidden"
                >
                  Signaler le facteur de pénibilité « agents chimiques »
                </button>
              )}
              <Link href="/duerp" className="underline">Ouvrir le DUERP</Link>
            </p>
          ) : (
            <p className="mt-2 text-xs text-ardoise">
              Le risque chimique doit être évalué dans le DUERP (art. R4412-5).{" "}
              <button type="button" onClick={creerRisque} className="text-bronze-fonce underline disabled:text-gris disabled:no-underline">
                Créer la ligne dans le DUERP
              </button>
            </p>
          )}

          <p className={`${libelle} mt-4`}>Salariés exposés {cmr?.categorie === 1 && <span className="text-[#b42318]">(à transmettre au médecin du travail)</span>}</p>
          {donnees.salaries.length === 0 ? (
            <p className="text-xs text-gris">Ajoutez les salariés dans « Salariés &amp; réglages ».</p>
          ) : (
            <ul className="grid max-h-48 gap-1 overflow-y-auto rounded-sm border border-pierre/70 bg-white p-2 sm:grid-cols-2">
              {[...donnees.salaries]
                .sort((a, b) => Number(b.service === p.unite) - Number(a.service === p.unite) || a.nom.localeCompare(b.nom, "fr"))
                .map((s) => (
                  <li key={s.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-bronze" checked={p.salariesExposes.includes(s.id)} onChange={() => basculerExpose(s.id)} />
                      {s.nom || "Salarié sans nom"} <span className="text-xs text-gris">{s.poste}</span>
                    </label>
                  </li>
                ))}
            </ul>
          )}
        </fieldset>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {modifiable && (
            <button type="button" onClick={supprimer} className={`${classeBoutonSecondaire} hover:text-[#b42318]`}>
              Supprimer
            </button>
          )}
          <button type="button" onClick={onFermer} className={classeBoutonSecondaire}>
            Fermer
          </button>
        </div>
      </Carte>
    </div>
  );
}
