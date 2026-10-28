// Points à traiter : calculés à partir des données de l'entreprise.
// Utilisé dans l'application (tableau de bord) et pour le récapitulatif hebdomadaire par e-mail.

import { actionEnRetard, actionsDe } from "./actions";
import { calculerStocks, decalerJours, formaterDate, niveauDe, risqueResiduel } from "./calculs";
import { analyseFaite, declarationEnRetard, echeanceDeclaration, estAccident } from "./evenements";
import { etatFormation, formationsEnVigueur, formationsManquantes, libelleFormation, typeFormation } from "./formations";
import { typesEvenement } from "./referentiel";
import { derniereVerification, etatEquipement, observationsOuvertes } from "./verifications";
import type { Donnees } from "./types";

export type Alerte = {
  id: string;
  gravite: "critique" | "importante" | "info";
  categorie: "DUERP" | "Accidents" | "Formations" | "Vérifications" | "EPI" | "Pénibilité";
  titre: string;
  detail: string;
  lien: string; // page de l'application où traiter l'alerte
};

const liste = (elements: string[], max = 3) =>
  elements.slice(0, max).join(", ") + (elements.length > max ? ` et ${elements.length - max} autre(s)` : "");

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

// `derniereVersion` : date (AAAA-MM-JJ) de la dernière version figée, null s'il n'y en a aucune,
// undefined si l'information n'est pas disponible (on ne crée alors pas d'alerte de mise à jour).
export function calculerAlertes(donnees: Donnees, aujourdhui: string, derniereVersion?: string | null): Alerte[] {
  const alertes: Alerte[] = [];
  const risques = donnees.duerp;

  // Mise à jour annuelle du document unique
  if (derniereVersion === null && risques.length) {
    alertes.push({
      id: "version-aucune", gravite: "importante", categorie: "DUERP", lien: "/duerp",
      titre: "Aucune version du DUERP n'a été figée",
      detail: "Figez une version datée : c'est elle qui fait foi et qui doit être conservée 40 ans.",
    });
  } else if (derniereVersion) {
    const echeance = decalerJours(derniereVersion, 365);
    if (echeance < aujourdhui) {
      alertes.push({
        id: "version-depassee", gravite: "critique", categorie: "DUERP", lien: "/duerp",
        titre: "Mise à jour annuelle du DUERP dépassée",
        detail: `La dernière version date du ${formaterDate(derniereVersion)} ; la mise à jour était due le ${formaterDate(echeance)}.`,
      });
    } else if (echeance < decalerJours(aujourdhui, 60)) {
      alertes.push({
        id: "version-proche", gravite: "info", categorie: "DUERP", lien: "/duerp",
        titre: "Mise à jour annuelle du DUERP à prévoir",
        detail: `À faire avant le ${formaterDate(echeance)}.`,
      });
    }
  }

  // Actions de prévention
  const actions = actionsDe(donnees);
  const enRetard = actions.filter((a) => actionEnRetard(a, aujourdhui));
  if (enRetard.length) {
    alertes.push({
      id: "actions-retard", gravite: "critique", categorie: "DUERP", lien: "/actions",
      titre: `${pluriel(enRetard.length, "action")} de prévention en retard`,
      detail: liste(enRetard.map((a) => `${a.intitule || "Action sans intitulé"} (${formaterDate(a.echeance)})`)),
    });
  }
  const bientot = actions.filter(
    (a) => a.statut !== "fait" && a.echeance && a.echeance >= aujourdhui && a.echeance <= decalerJours(aujourdhui, 15),
  );
  if (bientot.length) {
    alertes.push({
      id: "actions-bientot", gravite: "importante", categorie: "DUERP", lien: "/actions",
      titre: `${pluriel(bientot.length, "action")} à échéance dans les 15 jours`,
      detail: liste(bientot.map((a) => `${a.intitule || "Action sans intitulé"} (${formaterDate(a.echeance)})`)),
    });
  }
  const prioritaires = risques.filter((l) => ["important", "critique"].includes(niveauDe(risqueResiduel(l)).code));
  const critiquesSansAction = prioritaires.filter(
    (l) => niveauDe(risqueResiduel(l)).code === "critique" && !actions.some((a) => a.risqueId === l.id),
  );
  if (critiquesSansAction.length) {
    alertes.push({
      id: "critiques-sans-action", gravite: "critique", categorie: "DUERP", lien: "/duerp",
      titre: `${pluriel(critiquesSansAction.length, "risque")} critique${critiquesSansAction.length > 1 ? "s" : ""} sans action prévue`,
      detail: liste(critiquesSansAction.map((l) => `${l.danger || l.activite} (${l.unite})`)),
    });
  }
  // Les EPI ne doivent venir qu'en complément de mesures collectives ou d'organisation.
  const seulementEpi = prioritaires.filter((l) => {
    const principes = actions.filter((a) => a.risqueId === l.id && a.principe).map((a) => a.principe);
    return principes.length > 0 && principes.every((p) => p === "epi");
  });
  if (seulementEpi.length) {
    alertes.push({
      id: "seulement-epi", gravite: "importante", categorie: "DUERP", lien: "/actions",
      titre: `${pluriel(seulementEpi.length, "risque")} prioritaire${seulementEpi.length > 1 ? "s" : ""} traité${seulementEpi.length > 1 ? "s" : ""} uniquement par des EPI`,
      detail: `Prévoir une mesure de suppression, de protection collective ou d'organisation : ${liste(seulementEpi.map((l) => `${l.danger || l.activite} (${l.unite})`))}.`,
    });
  }
  const aVerifier = actions.filter((a) => a.statut === "fait" && a.efficacite === "non-evaluee" && a.realiseeLe && a.realiseeLe <= decalerJours(aujourdhui, -30));
  if (aVerifier.length) {
    alertes.push({
      id: "efficacite-a-verifier", gravite: "info", categorie: "DUERP", lien: "/actions",
      titre: `${pluriel(aVerifier.length, "action")} réalisée${aVerifier.length > 1 ? "s" : ""} dont l'efficacité reste à vérifier`,
      detail: liste(aVerifier.map((a) => a.intitule || "Action sans intitulé")),
    });
  }

  // Accidents et presque-accidents (sans nom de victime : le récapitulatif part aussi par e-mail).
  const evenements = (donnees.evenements ?? []).filter((e) => e.date && e.date <= aujourdhui);
  const nomEvenement = (e: (typeof evenements)[number]) =>
    `${typesEvenement.find((t) => t.valeur === e.type)?.libelle ?? "Événement"} du ${formaterDate(e.date)}${e.lieu ? ` (${e.lieu})` : ""}`;
  const lienEvenement = (liste: typeof evenements) => (liste.length === 1 ? `/accidents?evenement=${liste[0].id}` : "/accidents");

  const aDeclarer = evenements.filter((e) => e.declaration === "a-faire");
  if (aDeclarer.length) {
    const retard = aDeclarer.filter((e) => declarationEnRetard(e, aujourdhui));
    alertes.push({
      id: "accidents-a-declarer", gravite: "critique", categorie: "Accidents", lien: lienEvenement(aDeclarer),
      titre: `${pluriel(aDeclarer.length, "accident")} à déclarer à la CPAM${retard.length ? ` (dont ${retard.length} hors délai)` : ""}`,
      detail: `Déclaration dans les 48 heures : ${liste(aDeclarer.map((e) => `${nomEvenement(e)}, avant le ${formaterDate(echeanceDeclaration(e))}`))}.`,
    });
  }
  const accidentsNonAnalyses = evenements.filter((e) => estAccident(e) && !analyseFaite(e) && e.date <= decalerJours(aujourdhui, -7));
  if (accidentsNonAnalyses.length) {
    alertes.push({
      id: "accidents-a-analyser", gravite: "importante", categorie: "Accidents", lien: lienEvenement(accidentsNonAnalyses),
      titre: `${pluriel(accidentsNonAnalyses.length, "accident")} dont les causes restent à analyser`,
      detail: liste(accidentsNonAnalyses.map(nomEvenement)),
    });
  }
  const signalementsNonAnalyses = evenements.filter((e) => !estAccident(e) && !analyseFaite(e) && e.date <= decalerJours(aujourdhui, -30));
  if (signalementsNonAnalyses.length) {
    alertes.push({
      id: "presque-accidents-a-analyser", gravite: "info", categorie: "Accidents", lien: lienEvenement(signalementsNonAnalyses),
      titre: `${pluriel(signalementsNonAnalyses.length, "presque-accident")} ou situation${signalementsNonAnalyses.length > 1 ? "s" : ""} dangereuse${signalementsNonAnalyses.length > 1 ? "s" : ""} à analyser`,
      detail: liste(signalementsNonAnalyses.map(nomEvenement)),
    });
  }
  const aRapprocher = evenements.filter((e) => (!e.risqueId || !e.reevalueLe) && e.date <= decalerJours(aujourdhui, -7));
  if (aRapprocher.length) {
    alertes.push({
      id: "accidents-duerp", gravite: "importante", categorie: "Accidents", lien: lienEvenement(aRapprocher),
      titre: `${pluriel(aRapprocher.length, "événement")} à reporter dans le DUERP`,
      detail: `Rattachez chaque événement à un risque et revoyez sa cotation (art. R4121-2) : ${liste(aRapprocher.map(nomEvenement))}.`,
    });
  }

  // Formations et habilitations
  const nomSalarie = new Map(donnees.salaries.map((s) => [s.id, s.nom || "Salarié sans nom"]));
  const manquantes = formationsManquantes({ ...donnees, formations: donnees.formations ?? [], exigences: donnees.exigences ?? [] }, aujourdhui);
  if (manquantes.length) {
    alertes.push({
      id: "formations-manquantes", gravite: "critique", categorie: "Formations", lien: "/formations",
      titre: `${pluriel(manquantes.length, "formation")} exigée${manquantes.length > 1 ? "s" : ""} pour le poste manquante${manquantes.length > 1 ? "s" : ""} ou expirée${manquantes.length > 1 ? "s" : ""}`,
      detail: liste(manquantes.map((m) => `${m.salarie.nom || "Salarié sans nom"} : ${typeFormation(m.type).court}${m.expiree ? " (expirée)" : ""}`)),
    });
  }
  const enVigueur = formationsEnVigueur(donnees.formations ?? []).filter((f) => nomSalarie.has(f.salarieId));
  const nomFormation = (f: (typeof enVigueur)[number]) =>
    `${nomSalarie.get(f.salarieId)} : ${f.type === "autre" ? libelleFormation(f) : typeFormation(f.type).court} (${formaterDate(f.expireLe)})`;
  const expirees = enVigueur.filter(
    (f) => etatFormation(f, aujourdhui) === "expiree" && !manquantes.some((m) => m.salarie.id === f.salarieId && m.type === f.type),
  );
  if (expirees.length) {
    alertes.push({
      id: "formations-expirees", gravite: "importante", categorie: "Formations", lien: "/formations",
      titre: `${pluriel(expirees.length, "formation")} ou habilitation${expirees.length > 1 ? "s" : ""} expirée${expirees.length > 1 ? "s" : ""}`,
      detail: `À renouveler si le salarié en a toujours besoin : ${liste(expirees.map(nomFormation))}.`,
    });
  }
  const aRenouveler = enVigueur.filter((f) => etatFormation(f, aujourdhui) === "a-renouveler");
  const dansLeMois = aRenouveler.filter((f) => f.expireLe <= decalerJours(aujourdhui, 30));
  if (dansLeMois.length) {
    alertes.push({
      id: "formations-30j", gravite: "importante", categorie: "Formations", lien: "/formations",
      titre: `${pluriel(dansLeMois.length, "formation")} expire${dansLeMois.length > 1 ? "nt" : ""} dans moins d'un mois`,
      detail: liste(dansLeMois.map(nomFormation)),
    });
  }
  const aPlanifier = aRenouveler.filter((f) => f.expireLe > decalerJours(aujourdhui, 30));
  if (aPlanifier.length) {
    alertes.push({
      id: "formations-90j", gravite: "info", categorie: "Formations", lien: "/formations",
      titre: `${pluriel(aPlanifier.length, "recyclage")} à planifier dans les 3 mois`,
      detail: liste(aPlanifier.map(nomFormation)),
    });
  }

  // Vérifications périodiques
  const equipements = donnees.equipements ?? [];
  const verifications = donnees.verifications ?? [];
  const nomEquipement = (e: (typeof equipements)[number]) => e.nom || "Équipement sans nom";
  const nonConformes = equipements.filter((e) => derniereVerification(verifications, e.id)?.resultat === "non-conforme");
  if (nonConformes.length) {
    alertes.push({
      id: "verifications-non-conformes", gravite: "critique", categorie: "Vérifications", lien: "/verifications",
      titre: `${pluriel(nonConformes.length, "équipement")} non conforme${nonConformes.length > 1 ? "s" : ""} lors de la dernière vérification`,
      detail: `Remettre en conformité ou retirer du service : ${liste(nonConformes.map(nomEquipement))}.`,
    });
  }
  const enRetardVerif = equipements.filter((e) => etatEquipement(verifications, e, aujourdhui) === "en-retard");
  if (enRetardVerif.length) {
    alertes.push({
      id: "verifications-retard", gravite: "critique", categorie: "Vérifications", lien: "/verifications",
      titre: `${pluriel(enRetardVerif.length, "vérification")} périodique${enRetardVerif.length > 1 ? "s" : ""} en retard`,
      detail: liste(enRetardVerif.map((e) => `${nomEquipement(e)} (${formaterDate(derniereVerification(verifications, e.id)!.prochaine)})`)),
    });
  }
  const jamais = equipements.filter((e) => etatEquipement(verifications, e, aujourdhui) === "jamais");
  if (jamais.length) {
    alertes.push({
      id: "verifications-jamais", gravite: "importante", categorie: "Vérifications", lien: "/verifications",
      titre: `${pluriel(jamais.length, "équipement")} sans vérification enregistrée`,
      detail: `Saisissez la dernière vérification (date et rapport) : ${liste(jamais.map(nomEquipement))}.`,
    });
  }
  const bientotVerif = equipements.filter((e) => {
    const prochaine = derniereVerification(verifications, e.id)?.prochaine;
    return prochaine && prochaine >= aujourdhui && prochaine <= decalerJours(aujourdhui, 30);
  });
  if (bientotVerif.length) {
    alertes.push({
      id: "verifications-bientot", gravite: "importante", categorie: "Vérifications", lien: "/verifications",
      titre: `${pluriel(bientotVerif.length, "vérification")} à faire dans les 30 jours`,
      detail: liste(bientotVerif.map((e) => `${nomEquipement(e)} (${formaterDate(derniereVerification(verifications, e.id)!.prochaine)})`)),
    });
  }
  const ouvertes = observationsOuvertes(equipements, verifications, donnees.actions ?? []).filter(
    (o) => o.verification.date <= decalerJours(aujourdhui, -30),
  );
  if (ouvertes.length) {
    alertes.push({
      id: "observations-a-lever", gravite: "importante", categorie: "Vérifications", lien: "/verifications",
      titre: `${pluriel(ouvertes.length, "observation")} de vérification non levée${ouvertes.length > 1 ? "s" : ""} depuis plus d'un mois`,
      detail: liste(ouvertes.map((o) => `${nomEquipement(o.equipement)} : ${o.observation.texte}`)),
    });
  }

  // Stocks d'EPI
  const stocks = calculerStocks(donnees, aujourdhui);
  const ruptures = stocks.filter((s) => s.etat === "rupture");
  if (ruptures.length) {
    alertes.push({
      id: "stocks-rupture", gravite: "critique", categorie: "EPI", lien: "/epi",
      titre: `${pluriel(ruptures.length, "référence")} d'EPI en rupture`,
      detail: liste(ruptures.map((s) => `${s.article.nom} (${s.taille})`)),
    });
  }
  const sousTampon = stocks.filter((s) => s.etat === "sous-tampon");
  if (sousTampon.length) {
    alertes.push({
      id: "stocks-tampon", gravite: "importante", categorie: "EPI", lien: "/epi",
      titre: `${pluriel(sousTampon.length, "référence")} d'EPI sous le stock tampon`,
      detail: `À commander : ${liste(sousTampon.map((s) => `${s.aCommander} ${s.article.nom} (${s.taille})`))}`,
    });
  }
  const nonSignees = donnees.mouvements.filter(
    (m) => m.type === "sortie" && !m.signatureId && m.date >= decalerJours(aujourdhui, -90) && m.date <= decalerJours(aujourdhui, -7),
  );
  if (nonSignees.length) {
    const salaries = new Set(nonSignees.map((m) => m.salarieId)).size;
    alertes.push({
      id: "epi-non-signes", gravite: "info", categorie: "EPI", lien: "/epi",
      titre: `${pluriel(nonSignees.length, "remise")} d'EPI non signée${nonSignees.length > 1 ? "s" : ""}`,
      detail: `Sur les 3 derniers mois, pour ${pluriel(salaries, "salarié")}. À faire signer depuis « Fiches salariés ».`,
    });
  }

  // Pénibilité
  const aEvaluer = risques.filter((l) => l.penibilite && l.seuilPenibilite === "a-evaluer");
  if (aEvaluer.length) {
    alertes.push({
      id: "penibilite-a-evaluer", gravite: "info", categorie: "Pénibilité", lien: "/penibilite",
      titre: `${pluriel(aEvaluer.length, "exposition")} à la pénibilité à évaluer`,
      detail: liste(aEvaluer.map((l) => `${l.unite} : ${l.activite}`)),
    });
  }

  const ordre = { critique: 0, importante: 1, info: 2 };
  return alertes.sort((a, b) => ordre[a.gravite] - ordre[b.gravite]);
}
