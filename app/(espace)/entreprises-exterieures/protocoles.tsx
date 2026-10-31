"use client";

import { useState } from "react";
import { BlocSignature } from "@/components/signature";
import { Carte, Indicateur, Pastille, classeBouton, classeBoutonSecondaire, classeChamp } from "@/components/ui";
import { dateDuJour, formaterDate, nouvelId, telechargerCsv } from "@/lib/calculs";
import { ajouterMois } from "@/lib/formations";
import { telechargerProtocole } from "@/lib/pdf/telecharger";
import {
  VALIDITE_MOIS,
  dejaRenouvele,
  elementsManquants,
  estSigne,
  etatProtocole,
  etatsProtocole,
  nouveauProtocole,
  operations,
  renouveler,
} from "@/lib/protocoles";
import { modifier } from "@/lib/stockage";
import type { Donnees, Protocole, Signature } from "@/lib/types";

const libelle = "mb-1 block text-xs font-medium text-ardoise";
const grilleLigne = "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_9rem_1.5rem]";

function maj(id: string, champs: Partial<Protocole>) {
  modifier((d) => ({ ...d, protocoles: d.protocoles.map((p) => (p.id === id ? { ...p, ...champs } : p)) }));
}

function signer(id: string, cle: "signatureAccueil" | "signatureTransporteur", signature: Signature) {
  const signatureId = nouvelId();
  modifier((d) => ({
    ...d,
    signatures: { ...d.signatures, [signatureId]: signature },
    protocoles: d.protocoles.map((p) => (p.id === id ? { ...p, [cle]: signatureId } : p)),
  }));
}

export function Protocoles({ donnees, modifiable, ouvertInitial }: { donnees: Donnees; modifiable: boolean; ouvertInitial: string }) {
  const [ouvert, setOuvert] = useState(ouvertInitial);
  const [expires, setExpires] = useState(false);
  const aujourdhui = dateDuJour();
  const { protocoles, signatures } = donnees;
  const etat = (p: Protocole) => etatProtocole(p, signatures, aujourdhui);
  const compter = (etats: string[]) => protocoles.filter((p) => etats.includes(etat(p))).length;

  const liste = protocoles
    .filter((p) => expires || etat(p) !== "expire" || p.id === ouvert)
    .sort((a, b) => a.transporteur.localeCompare(b.transporteur) || a.debut.localeCompare(b.debut));

  const ajouter = () => {
    const p = nouveauProtocole(protocoles, aujourdhui, { responsable: protocoles.at(-1)?.responsable || donnees.fiche?.responsable || "" });
    modifier((d) => ({ ...d, protocoles: [...d.protocoles, p] }));
    setOuvert(p.id);
  };

  const exporter = () =>
    telechargerCsv(`Protocoles de securite - ${donnees.entreprise} - ${aujourdhui}.csv`, [
      ["Transporteur", "SIRET", "Représentant", "Téléphone", "Opération", "Permanent", "Début", "Fin", "Lieu", "Marchandises", "Matières dangereuses", "Signé", "État"],
      ...protocoles.map((p) => [
        p.transporteur, p.siret, p.contact, p.telephone, operations.find((o) => o.valeur === p.operation)?.libelle ?? "", p.permanent ? "Oui" : "Non",
        formaterDate(p.debut), formaterDate(p.fin), p.lieu, p.marchandises, p.matieresDangereuses ? "Oui" : "Non", estSigne(p, signatures) ? "Oui" : "Non",
        etatsProtocole[etat(p)].libelle,
      ]),
    ]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-ardoise">
          Pour chaque transporteur qui charge ou décharge chez vous : un protocole écrit et signé, qui remplace le plan de prévention. Pour des livraisons
          régulières, un seul protocole suffit ; il est à revoir chaque année.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={classeBoutonSecondaire} onClick={exporter}>
            Exporter (Excel)
          </button>
          {modifiable && (
            <button type="button" className={classeBouton} onClick={ajouter}>
              + Protocole
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicateur libelle="Valides" valeur={compter(["valide", "a-renouveler"])} detail="protocoles signés en vigueur" />
        <Indicateur
          libelle="À compléter ou signer"
          valeur={compter(["a-completer", "a-signer"])}
          detail="informations ou signatures manquantes"
          alerte={compter(["a-completer", "a-signer"]) > 0}
        />
        <Indicateur
          libelle="À renouveler"
          valeur={protocoles.filter((p) => etat(p) === "a-renouveler" && !dejaRenouvele(p, protocoles)).length}
          detail="fin de validité dans les 30 jours"
        />
        <Indicateur
          libelle="Matières dangereuses"
          valeur={protocoles.filter((p) => etat(p) !== "expire" && p.matieresDangereuses).length}
          detail="transporteurs soumis à l'ADR"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-ardoise">
          <input type="checkbox" className="accent-bronze" checked={expires} onChange={(e) => setExpires(e.target.checked)} />
          Afficher les protocoles expirés
        </label>
      </div>

      {liste.length === 0 ? (
        <p className="rounded-sm border border-pierre/70 bg-white p-6 text-center text-sm text-gris">
          {protocoles.length
            ? "Aucun protocole en vigueur."
            : "Aucun protocole de sécurité. Ajoutez vos transporteurs réguliers : messagerie, fournisseurs, enlèvements de déchets…"}
        </p>
      ) : (
        <section className="rounded-sm border border-pierre/70 bg-white">
          <div className={`${grilleLigne} hidden gap-x-3 border-b border-pierre/60 bg-marbre px-3 py-1.5 text-xs text-ardoise lg:grid`}>
            <span>Transporteur et opération</span>
            <span>Validité</span>
            <span>Protocole</span>
            <span />
          </div>
          <ul>
            {liste.map((p) => {
              const e = etatsProtocole[etat(p)];
              return (
                <li key={p.id} className="border-b border-pierre/60 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOuvert(ouvert === p.id ? "" : p.id)}
                    aria-expanded={ouvert === p.id}
                    className={`${grilleLigne} grid w-full gap-x-3 gap-y-1.5 px-3 py-2.5 text-left text-sm hover:bg-marbre/40 ${ouvert === p.id ? "bg-marbre/40" : ""}`}
                  >
                    <span className="block min-w-0">
                      <span className="block font-medium">{p.transporteur || "Transporteur sans nom"}</span>
                      <span className="block truncate text-xs text-gris">
                        {[operations.find((o) => o.valeur === p.operation)?.libelle, p.permanent ? "opérations répétitives" : "opération ponctuelle", p.matieresDangereuses ? "matières dangereuses" : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="block tabular-nums text-ardoise">
                      {p.permanent ? `${formaterDate(p.debut)} → ${formaterDate(p.fin)}` : `Le ${formaterDate(p.debut)}`}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Pastille couleur={e.couleur} texte={e.texte}>{e.libelle}</Pastille>
                      {etat(p) === "a-renouveler" && dejaRenouvele(p, protocoles) && <span className="text-xs text-gris">renouvelé</span>}
                    </span>
                    <span className="hidden text-right text-bronze-fonce lg:block">{ouvert === p.id ? "▲" : "▼"}</span>
                  </button>
                  {ouvert === p.id && (
                    <div className="border-t border-pierre/60 bg-ivoire p-3 sm:p-4">
                      <FicheProtocole protocole={p} donnees={donnees} modifiable={modifiable} onOuvrir={setOuvert} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function FicheProtocole({
  protocole: p,
  donnees,
  modifiable,
  onOuvrir,
}: {
  protocole: Protocole;
  donnees: Donnees;
  modifiable: boolean;
  onOuvrir: (id: string) => void;
}) {
  const aujourdhui = dateDuJour();
  const manquants = elementsManquants(p, donnees.signatures);
  const signe = estSigne(p, donnees.signatures);
  // Dès la première signature, le contenu ne change plus sans nouvelles signatures.
  const verrouille = !!(p.signatureAccueil || p.signatureTransporteur);
  const deverrouiller = () => {
    if (!confirm("Modifier le protocole ? Les signatures actuelles seront retirées : il devra être signé à nouveau par les deux parties.")) return;
    maj(p.id, { signatureAccueil: undefined, signatureTransporteur: undefined });
  };
  const renouvele = dejaRenouvele(p, donnees.protocoles);

  const changerDebut = (debut: string) => maj(p.id, p.permanent ? { debut } : { debut, fin: debut });
  const changerPermanent = (permanent: boolean) =>
    maj(p.id, { permanent, fin: permanent ? ajouterMois(p.debut || aujourdhui, VALIDITE_MOIS) : p.debut });

  const nouvellePeriode = () => {
    const q = renouveler(p, aujourdhui);
    modifier((d) => ({ ...d, protocoles: [...d.protocoles, q] }));
    onOuvrir(q.id);
  };

  const supprimer = () => {
    if (!confirm(`Supprimer le protocole de sécurité de « ${p.transporteur || "ce transporteur"} » ?`)) return;
    modifier((d) => ({ ...d, protocoles: d.protocoles.filter((x) => x.id !== p.id) }));
    onOuvrir("");
  };

  const zone = (cle: keyof Protocole, titre: string, aide: string, lignes = 3) => (
    <label>
      <span className={libelle}>{titre}</span>
      <textarea
        rows={lignes}
        value={String(p[cle] ?? "")}
        placeholder={aide}
        onChange={(x) => maj(p.id, { [cle]: x.target.value })}
        className={`${classeChamp} field-sizing-content resize-y`}
      />
    </label>
  );

  return (
    <div className="space-y-3">
      {manquants.length > 0 ? (
        <p className="rounded-sm border border-[#fab219] bg-[#fab219]/10 p-3 text-sm">
          <span className="font-medium">Pour finaliser le protocole, il manque : </span>
          {manquants.join(", ")}.
        </p>
      ) : (
        <p className="rounded-sm border border-[#0ca30c] bg-[#0ca30c]/10 p-3 text-sm">
          Protocole complet et signé. Remettez-en un exemplaire au transporteur pour ses chauffeurs, et affichez les consignes à l&apos;accueil des quais.
        </p>
      )}

      {verrouille && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-pierre/70 bg-white p-3 text-sm">
          <span className="text-ardoise">
            Protocole {signe ? "signé" : "en cours de signature"} : son contenu est verrouillé pour rester conforme à ce qui a été signé.
          </span>
          {modifiable && (
            <button type="button" className={classeBoutonSecondaire} onClick={deverrouiller}>
              Modifier le protocole
            </button>
          )}
        </div>
      )}

      <fieldset disabled={!modifiable} className="min-w-0 space-y-3">
        <fieldset disabled={verrouille} className="min-w-0 space-y-3">
        <div className="grid gap-3 lg:grid-cols-2">
          <Carte titre="1. Transporteur">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className={libelle}>Raison sociale du transporteur</span>
                <input value={p.transporteur} onChange={(x) => maj(p.id, { transporteur: x.target.value })} className={classeChamp} />
              </label>
              <label>
                <span className={libelle}>SIRET</span>
                <input value={p.siret} onChange={(x) => maj(p.id, { siret: x.target.value })} className={classeChamp} />
              </label>
              <label>
                <span className={libelle}>Représentant (nom, fonction)</span>
                <input value={p.contact} onChange={(x) => maj(p.id, { contact: x.target.value })} className={classeChamp} />
              </label>
              <label>
                <span className={libelle}>Téléphone</span>
                <input type="tel" value={p.telephone} onChange={(x) => maj(p.id, { telephone: x.target.value })} className={classeChamp} />
              </label>
              <label>
                <span className={libelle}>E-mail</span>
                <input type="email" value={p.email} onChange={(x) => maj(p.id, { email: x.target.value })} className={classeChamp} />
              </label>
            </div>
          </Carte>

          <Carte titre="2. Opération">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className={libelle}>Type d&apos;opération</span>
                <select value={p.operation} onChange={(x) => maj(p.id, { operation: x.target.value as Protocole["operation"] })} className={classeChamp}>
                  {operations.map((o) => (
                    <option key={o.valeur} value={o.valeur}>{o.libelle}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-start gap-2 text-sm sm:col-span-2">
                <input type="checkbox" className="mt-0.5 accent-bronze" checked={p.permanent} onChange={(x) => changerPermanent(x.target.checked)} />
                <span>
                  Opérations répétitives (même transporteur, mêmes marchandises, mêmes véhicules)
                  <span className="block text-xs text-gris">Un seul protocole couvre toutes les livraisons de la période (art. R4515-8).</span>
                </span>
              </label>
              <label>
                <span className={libelle}>{p.permanent ? "Valable à partir du" : "Date de l'opération"}</span>
                <input type="date" value={p.debut} onChange={(x) => changerDebut(x.target.value)} className={classeChamp} />
              </label>
              {p.permanent && (
                <label>
                  <span className={libelle}>Jusqu&apos;au</span>
                  <input type="date" value={p.fin} min={p.debut || undefined} onChange={(x) => maj(p.id, { fin: x.target.value })} className={classeChamp} />
                </label>
              )}
            </div>
          </Carte>
        </div>

        <Carte titre="3. Informations de l'entreprise d'accueil">
          <p className="mb-3 text-xs text-gris">Reprises du dernier protocole créé : elles valent pour tous vos transporteurs, adaptez-les si besoin.</p>
          <div className="grid gap-3 lg:grid-cols-2">
            {zone("lieu", "Lieu de livraison ou de prise en charge", "Quai, zone de chargement…", 2)}
            <label>
              <span className={libelle}>Responsable désigné par votre entreprise</span>
              <input value={p.responsable} onChange={(x) => maj(p.id, { responsable: x.target.value })} className={classeChamp} />
            </label>
            {zone("acces", "Accès et stationnement", "Portail, horaires, accueil, attente…")}
            {zone("circulation", "Plan et consignes de circulation", "Sens de circulation, vitesse, zones piétonnes, marche arrière…")}
            {zone("materiels", "Matériels et engins utilisés", "Chariots, transpalettes, hayon : qui les utilise…")}
            {zone("consignes", "Consignes de sécurité de l'opération", "Cales de roues, EPI obligatoires, interdictions…")}
            {zone("secours", "Moyens de secours", "Sauveteurs secouristes, trousse, numéros d'urgence…")}
          </div>
        </Carte>

        <Carte titre="4. Informations du transporteur">
          <div className="grid gap-3 lg:grid-cols-2">
            {zone("vehicules", "Véhicules : caractéristiques, aménagement, équipements", "Porteur, semi-remorque, hayon, bâché…")}
            {zone("marchandises", "Nature et conditionnement des marchandises", "Palettes, fûts, vrac, poids…")}
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 accent-bronze" checked={p.matieresDangereuses} onChange={(x) => maj(p.id, { matieresDangereuses: x.target.checked })} />
            Transport de matières dangereuses (réglementation ADR)
          </label>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {zone("precautions", "Précautions particulières liées aux marchandises", p.matieresDangereuses ? "Consignes ADR, fiches de données de sécurité, équipements du véhicule…" : "Produits fragiles, instables, chauds…")}
            {zone("notes", "Remarques", "", 3)}
          </div>
        </Carte>

        </fieldset>

        <Carte titre="5. Signatures">
          <p className="mb-3 text-xs text-gris">
            {signe
              ? "Protocole signé. Si le lieu, les véhicules ou les marchandises changent, cliquez sur « Modifier le protocole » : il devra être signé à nouveau."
              : "Le protocole est établi lors d'un échange entre vous et le transporteur, puis signé par les deux. Une signature ne peut plus être modifiée."}
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <BlocSignature
              titre="Entreprise d'accueil"
              nomPropose={p.responsable}
              signature={p.signatureAccueil ? donnees.signatures?.[p.signatureAccueil] : undefined}
              onValider={(signature) => signer(p.id, "signatureAccueil", signature)}
            />
            <BlocSignature
              titre="Transporteur"
              nomPropose={p.contact}
              signature={p.signatureTransporteur ? donnees.signatures?.[p.signatureTransporteur] : undefined}
              onValider={(signature) => signer(p.id, "signatureTransporteur", signature)}
            />
          </div>
        </Carte>
      </fieldset>

      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={classeBouton} onClick={() => telechargerProtocole(donnees, p.id)}>
            ⬇ Protocole de sécurité (PDF)
          </button>
          {modifiable && p.permanent && signe && !renouvele && (
            <button type="button" className={classeBoutonSecondaire} onClick={nouvellePeriode}>
              Renouveler pour {VALIDITE_MOIS} mois
            </button>
          )}
        </div>
        {modifiable && (
          <button type="button" className={`${classeBoutonSecondaire} hover:text-[#b42318]`} onClick={supprimer}>
            Supprimer le protocole
          </button>
        )}
      </div>
    </div>
  );
}
