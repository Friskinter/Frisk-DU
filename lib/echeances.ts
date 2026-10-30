// Prochaines échéances de l'entreprise, toutes sources confondues (tableau de bord).
// Calculées à partir des données, comme les alertes : rien n'est stocké, une échéance traitée
// disparaît d'elle-même.

import { decalerJours } from "./calculs";
import { formationsEnVigueur, libelleFormation } from "./formations";
import { dejaRenouvele } from "./protocoles";
import { derniereVerification } from "./verifications";
import type { Donnees } from "./types";

export type TypeEcheance = "action" | "formation" | "verification" | "intervention" | "protocole";

export const libellesTypesEcheance: Record<TypeEcheance, string> = {
  action: "Actions de prévention",
  formation: "Formations et habilitations",
  verification: "Vérifications périodiques",
  intervention: "Entreprises extérieures",
  protocole: "Protocoles de sécurité",
};

export type Echeance = {
  id: string; // unique : type et identifiant de l'élément
  type: TypeEcheance;
  date: string; // AAAA-MM-JJ
  titre: string;
  detail: string;
  responsable: string; // "" si personne n'est désigné
  lien: string;
  enRetard: boolean;
};

export const HORIZON_ECHEANCES = 90; // jours

// Échéances dépassées (toutes) et à venir jusqu'à l'horizon, de la plus ancienne à la plus lointaine.
export function calculerEcheances(d: Donnees, aujourdhui: string, horizon = HORIZON_ECHEANCES): Echeance[] {
  const limite = decalerJours(aujourdhui, horizon);
  const echeances: Echeance[] = [];
  const ajouter = (e: Omit<Echeance, "enRetard">) => {
    if (e.date && e.date <= limite) echeances.push({ ...e, enRetard: e.date < aujourdhui });
  };

  // Actions de prévention non réalisées
  const risques = new Map(d.duerp.map((l) => [l.id, l]));
  for (const a of d.actions) {
    if (a.statut === "fait" || !a.echeance) continue;
    const risque = risques.get(a.risqueId);
    ajouter({
      id: `action-${a.id}`,
      type: "action",
      date: a.echeance,
      titre: a.intitule || "Action sans intitulé",
      detail: risque ? [risque.danger, risque.unite].filter(Boolean).join(" · ") : "",
      responsable: a.responsable,
      lien: `/actions?action=${a.id}`,
    });
  }

  // Formations et habilitations des salariés présents : expiration de la dernière en date
  const salaries = new Map(d.salaries.map((s) => [s.id, s]));
  for (const f of formationsEnVigueur(d.formations ?? [])) {
    const salarie = salaries.get(f.salarieId);
    if (!salarie || !f.expireLe) continue;
    ajouter({
      id: `formation-${f.id}`,
      type: "formation",
      date: f.expireLe,
      titre: `${libelleFormation(f)} à renouveler`,
      detail: salarie.nom || "Salarié sans nom",
      responsable: "",
      lien: `/formations?formation=${f.id}`,
    });
  }

  // Vérifications périodiques : prochaine date d'après la dernière vérification
  for (const e of d.equipements ?? []) {
    const prochaine = derniereVerification(d.verifications ?? [], e.id)?.prochaine;
    if (!prochaine) continue;
    ajouter({
      id: `verification-${e.id}`,
      type: "verification",
      date: prochaine,
      titre: `Vérification : ${e.nom || "équipement sans nom"}`,
      detail: [e.localisation, e.prestataire].filter(Boolean).join(" · "),
      responsable: "",
      lien: `/verifications?equipement=${e.id}`,
    });
  }

  // Interventions d'entreprises extérieures à venir : le plan de prévention doit être prêt au début
  for (const i of d.interventions ?? []) {
    if (!i.debut || i.debut < aujourdhui) continue;
    ajouter({
      id: `intervention-${i.id}`,
      type: "intervention",
      date: i.debut,
      titre: `Début de l'intervention : ${i.entreprise || "entreprise extérieure"}`,
      detail: i.objet,
      responsable: i.coordinateur,
      lien: `/entreprises-exterieures?intervention=${i.id}`,
    });
  }

  // Protocoles de sécurité : opération ponctuelle à venir, ou fin de validité d'un protocole permanent
  for (const p of d.protocoles ?? []) {
    if (p.permanent) {
      if (!p.fin || dejaRenouvele(p, d.protocoles ?? [])) continue;
      ajouter({
        id: `protocole-${p.id}`,
        type: "protocole",
        date: p.fin,
        titre: `Protocole à renouveler : ${p.transporteur || "transporteur"}`,
        detail: "Fin de validité du protocole permanent",
        responsable: p.responsable,
        lien: `/entreprises-exterieures?protocole=${p.id}`,
      });
    } else if (p.debut && p.debut >= aujourdhui) {
      ajouter({
        id: `protocole-${p.id}`,
        type: "protocole",
        date: p.debut,
        titre: `Opération de ${p.operation === "chargement" ? "chargement" : p.operation === "dechargement" ? "déchargement" : "chargement et déchargement"} : ${p.transporteur || "transporteur"}`,
        detail: "Le protocole doit être signé avant l'opération",
        responsable: p.responsable,
        lien: `/entreprises-exterieures?protocole=${p.id}`,
      });
    }
  }

  return echeances.sort((a, b) => a.date.localeCompare(b.date) || a.titre.localeCompare(b.titre));
}
