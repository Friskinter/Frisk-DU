// Points à traiter : calculés à partir des données de l'entreprise.
// Utilisé dans l'application (tableau de bord) et pour le récapitulatif hebdomadaire par e-mail.

import { actionEnRetard, actionsDe } from "./actions";
import { calculerStocks, decalerJours, formaterDate, niveauDe, risqueResiduel } from "./calculs";
import { analyseFaite, declarationEnRetard, echeanceDeclaration, estAccident } from "./evenements";
import { etatFormation, formationsEnVigueur, formationsManquantes, libelleFormation, typeFormation } from "./formations";
import { dernierSuivi, enCoursOuProche, etatIntervention, planEcritObligatoire } from "./interventions";
import { classementCmr, estCmr, etatFds } from "./produits";
import { actifOuProche, dejaRenouvele, etatProtocole } from "./protocoles";
import { derniereVisite, sansAction } from "./visites";
import { accueilsEnRetard, derniereCauserie, etatAccueil, formationRenforcee, nomArrivant } from "./accueils";
import { typesEvenement } from "./referentiel";
import { derniereVerification, etatEquipement, observationsOuvertes } from "./verifications";
import type { Donnees } from "./types";

export type Alerte = {
  id: string;
  gravite: "critique" | "importante" | "info";
  categorie: "DUERP" | "Accidents" | "Formations" | "Vérifications" | "Produits chimiques" | "Entreprises extérieures" | "Visites" | "Accueil et causeries" | "EPI" | "Pénibilité";
  titre: string;
  detail: string;
  lien: string; // page de l'application où traiter l'alerte
  // Date concernée (la plus ancienne en retard, ou la plus proche à venir), quand l'alerte en a une :
  // à niveau égal, les alertes sont classées par cette date.
  date?: string;
  // Éléments concernés (identifiants), pour repérer une urgence nouvelle d'un jour à l'autre (lib/urgences.ts).
  elements?: string[];
};

// Lien vers l'élément lui-même quand l'alerte n'en concerne qu'un (la page le met en évidence),
// sinon vers la page du module.
const lienUnique = (page: string, parametre: string, ids: string[]) =>
  new Set(ids).size === 1 ? `${page}?${parametre}=${ids[0]}` : page;

// Plus petite date d'une liste (AAAA-MM-JJ), ou undefined.
const plusTot = (dates: (string | undefined)[]) => dates.filter((d): d is string => !!d).sort()[0];

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
        id: "version-depassee", gravite: "critique", elements: [derniereVersion], categorie: "DUERP", lien: "/duerp",
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
      id: "actions-retard", gravite: "critique", elements: enRetard.map((a) => a.id), categorie: "DUERP", lien: lienUnique("/actions", "action", enRetard.map((a) => a.id)), date: plusTot(enRetard.map((a) => a.echeance)),
      titre: `${pluriel(enRetard.length, "action")} de prévention en retard`,
      detail: liste(enRetard.map((a) => `${a.intitule || "Action sans intitulé"} (${formaterDate(a.echeance)})`)),
    });
  }
  const bientot = actions.filter(
    (a) => a.statut !== "fait" && a.echeance && a.echeance >= aujourdhui && a.echeance <= decalerJours(aujourdhui, 15),
  );
  if (bientot.length) {
    alertes.push({
      id: "actions-bientot", gravite: "importante", categorie: "DUERP", lien: lienUnique("/actions", "action", bientot.map((a) => a.id)), date: plusTot(bientot.map((a) => a.echeance)),
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
      id: "critiques-sans-action", gravite: "critique", elements: critiquesSansAction.map((l) => l.id), categorie: "DUERP", lien: "/duerp",
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
      id: "accidents-a-declarer", gravite: "critique", elements: aDeclarer.map((e) => e.id), categorie: "Accidents", lien: lienEvenement(aDeclarer),
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
  // Signalés par les salariés (QR code) et pas encore analysés : à prendre en compte sans attendre.
  const signalesTerrain = evenements.filter((e) => e.signalement && !analyseFaite(e) && e.date > decalerJours(aujourdhui, -30));
  if (signalesTerrain.length) {
    alertes.push({
      id: "signalements-terrain", gravite: "importante", categorie: "Accidents", lien: lienEvenement(signalesTerrain),
      titre: `${pluriel(signalesTerrain.length, "signalement")} reçu${signalesTerrain.length > 1 ? "s" : ""} du terrain`,
      detail: `À examiner et à analyser : ${liste(signalesTerrain.map(nomEvenement))}.`,
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
      id: "formations-manquantes", gravite: "critique", elements: manquantes.map((m) => `${m.salarie.id}:${m.type}`), categorie: "Formations", lien: "/formations",
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
      id: "formations-expirees", gravite: "importante", categorie: "Formations", lien: lienUnique("/formations", "formation", expirees.map((f) => f.id)), date: plusTot(expirees.map((f) => f.expireLe)),
      titre: `${pluriel(expirees.length, "formation")} ou habilitation${expirees.length > 1 ? "s" : ""} expirée${expirees.length > 1 ? "s" : ""}`,
      detail: `À renouveler si le salarié en a toujours besoin : ${liste(expirees.map(nomFormation))}.`,
    });
  }
  const aRenouveler = enVigueur.filter((f) => etatFormation(f, aujourdhui) === "a-renouveler");
  const dansLeMois = aRenouveler.filter((f) => f.expireLe <= decalerJours(aujourdhui, 30));
  if (dansLeMois.length) {
    alertes.push({
      id: "formations-30j", gravite: "importante", categorie: "Formations", lien: lienUnique("/formations", "formation", dansLeMois.map((f) => f.id)), date: plusTot(dansLeMois.map((f) => f.expireLe)),
      titre: `${pluriel(dansLeMois.length, "formation")} expire${dansLeMois.length > 1 ? "nt" : ""} dans moins d'un mois`,
      detail: liste(dansLeMois.map(nomFormation)),
    });
  }
  const aPlanifier = aRenouveler.filter((f) => f.expireLe > decalerJours(aujourdhui, 30));
  if (aPlanifier.length) {
    alertes.push({
      id: "formations-90j", gravite: "info", categorie: "Formations", lien: lienUnique("/formations", "formation", aPlanifier.map((f) => f.id)), date: plusTot(aPlanifier.map((f) => f.expireLe)),
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
      id: "verifications-non-conformes", gravite: "critique", elements: nonConformes.map((e) => `${e.id}:${derniereVerification(verifications, e.id)?.date}`), categorie: "Vérifications", lien: lienUnique("/verifications", "equipement", nonConformes.map((e) => e.id)),
      titre: `${pluriel(nonConformes.length, "équipement")} non conforme${nonConformes.length > 1 ? "s" : ""} lors de la dernière vérification`,
      detail: `Remettre en conformité ou retirer du service : ${liste(nonConformes.map(nomEquipement))}.`,
    });
  }
  const enRetardVerif = equipements.filter((e) => etatEquipement(verifications, e, aujourdhui) === "en-retard");
  if (enRetardVerif.length) {
    alertes.push({
      id: "verifications-retard", gravite: "critique", elements: enRetardVerif.map((e) => `${e.id}:${derniereVerification(verifications, e.id)?.prochaine}`), categorie: "Vérifications", lien: lienUnique("/verifications", "equipement", enRetardVerif.map((e) => e.id)),
      date: plusTot(enRetardVerif.map((e) => derniereVerification(verifications, e.id)?.prochaine)),
      titre: `${pluriel(enRetardVerif.length, "vérification")} périodique${enRetardVerif.length > 1 ? "s" : ""} en retard`,
      detail: liste(enRetardVerif.map((e) => `${nomEquipement(e)} (${formaterDate(derniereVerification(verifications, e.id)!.prochaine)})`)),
    });
  }
  const jamais = equipements.filter((e) => etatEquipement(verifications, e, aujourdhui) === "jamais");
  if (jamais.length) {
    alertes.push({
      id: "verifications-jamais", gravite: "importante", categorie: "Vérifications", lien: lienUnique("/verifications", "equipement", jamais.map((e) => e.id)),
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
      id: "verifications-bientot", gravite: "importante", categorie: "Vérifications", lien: lienUnique("/verifications", "equipement", bientotVerif.map((e) => e.id)),
      date: plusTot(bientotVerif.map((e) => derniereVerification(verifications, e.id)?.prochaine)),
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

  // Produits chimiques (seuls les produits encore utilisés)
  const produits = (donnees.produits ?? []).filter((p) => p.actif);
  const nomProduit = (p: (typeof produits)[number]) => p.nom || "Produit sans nom";
  const cmrADocumenter = produits.filter((p) => estCmr(p) && (!p.substitution.trim() || !p.salariesExposes.length));
  if (cmrADocumenter.length) {
    alertes.push({
      id: "chimie-cmr", gravite: "critique", elements: cmrADocumenter.map((p) => p.id), categorie: "Produits chimiques", lien: lienUnique("/produits", "produit", cmrADocumenter.map((p) => p.id)),
      titre: `${pluriel(cmrADocumenter.length, "produit")} CMR à documenter`,
      detail: `Recherche de substitution et liste des salariés exposés (suivi médical renforcé) : ${liste(cmrADocumenter.map(nomProduit))}.`,
    });
  }
  const sansFds = produits.filter((p) => etatFds(p, aujourdhui) === "manquante");
  if (sansFds.length) {
    alertes.push({
      id: "chimie-fds-manquante", gravite: "importante", categorie: "Produits chimiques", lien: lienUnique("/produits", "produit", sansFds.map((p) => p.id)),
      titre: `${pluriel(sansFds.length, "produit")} sans fiche de données de sécurité`,
      detail: `Demandez la FDS au fournisseur (elle est gratuite et obligatoire) : ${liste(sansFds.map(nomProduit))}.`,
    });
  }
  const fdsAnciennes = produits.filter((p) => etatFds(p, aujourdhui) === "ancienne");
  if (fdsAnciennes.length) {
    alertes.push({
      id: "chimie-fds-ancienne", gravite: "info", categorie: "Produits chimiques", lien: lienUnique("/produits", "produit", fdsAnciennes.map((p) => p.id)),
      titre: `${pluriel(fdsAnciennes.length, "FDS")} de plus de 3 ans`,
      detail: `Vérifiez auprès du fournisseur qu'il n'existe pas de version plus récente : ${liste(fdsAnciennes.map(nomProduit))}.`,
    });
  }
  const horsDuerp = produits.filter((p) => (p.mentionsH.length || classementCmr(p)) && !risques.some((l) => l.id === p.risqueId));
  if (horsDuerp.length) {
    alertes.push({
      id: "chimie-duerp", gravite: "info", categorie: "Produits chimiques", lien: "/produits",
      titre: `${pluriel(horsDuerp.length, "produit")} dangereux non rattaché${horsDuerp.length > 1 ? "s" : ""} au DUERP`,
      detail: `Le risque chimique doit être évalué dans le document unique (art. R4412-5) : ${liste(horsDuerp.map(nomProduit))}.`,
    });
  }

  // Entreprises extérieures
  const interventions = donnees.interventions ?? [];
  const nonPrete = (i: (typeof interventions)[number]) => ["a-preparer", "a-signer"].includes(etatIntervention(i, donnees.signatures, aujourdhui));
  const nomEE = (i: (typeof interventions)[number]) => i.entreprise || "entreprise sans nom";
  const lienIntervention = (liste: typeof interventions) =>
    liste.length === 1 ? `/entreprises-exterieures?intervention=${liste[0].id}` : "/entreprises-exterieures";
  const enCours = interventions.filter((i) => enCoursOuProche(i, aujourdhui) && nonPrete(i));
  const enCoursObligatoires = enCours.filter(planEcritObligatoire);
  if (enCoursObligatoires.length) {
    alertes.push({
      id: "interventions-sans-plan", gravite: "critique", elements: enCoursObligatoires.map((i) => i.id), categorie: "Entreprises extérieures", lien: lienIntervention(enCoursObligatoires),
      titre: `${pluriel(enCoursObligatoires.length, "intervention")} en cours sans plan de prévention signé`,
      detail: `Plan écrit obligatoire (400 heures ou travaux dangereux, art. R4512-7) : ${liste(enCoursObligatoires.map(nomEE))}.`,
    });
  }
  const enCoursAutres = enCours.filter((i) => !planEcritObligatoire(i));
  if (enCoursAutres.length) {
    alertes.push({
      id: "interventions-a-completer", gravite: "importante", categorie: "Entreprises extérieures", lien: lienIntervention(enCoursAutres),
      titre: `${pluriel(enCoursAutres.length, "intervention")} en cours à compléter`,
      detail: `Inspection commune et analyse des risques d'interférence à faire, même sans plan écrit (art. R4512-2 et R4512-6) : ${liste(enCoursAutres.map(nomEE))}.`,
    });
  }
  const prochaines = interventions.filter((i) => i.debut > aujourdhui && enCoursOuProche(i, aujourdhui, 15) && nonPrete(i));
  if (prochaines.length) {
    alertes.push({
      id: "interventions-a-preparer", gravite: "importante", categorie: "Entreprises extérieures", lien: lienIntervention(prochaines),
      titre: `${pluriel(prochaines.length, "plan")} de prévention à préparer avant l'intervention`,
      detail: liste(prochaines.map((i) => `${nomEE(i)} (début le ${formaterDate(i.debut)})`)),
    });
  }
  const sansSuivi = interventions.filter(
    (i) => enCoursOuProche(i, aujourdhui) && !nonPrete(i) && i.travauxDangereux.length > 0 && dernierSuivi(i) < decalerJours(aujourdhui, -90),
  );
  if (sansSuivi.length) {
    alertes.push({
      id: "interventions-suivi", gravite: "info", categorie: "Entreprises extérieures", lien: lienIntervention(sansSuivi),
      titre: `${pluriel(sansSuivi.length, "intervention")} sans inspection ni réunion de coordination depuis 3 mois`,
      detail: `Travaux dangereux : prévoyez des inspections et réunions périodiques de coordination : ${liste(sansSuivi.map(nomEE))}.`,
    });
  }

  // Protocoles de sécurité (chargement et déchargement)
  const protocoles = donnees.protocoles ?? [];
  const etatP = (p: (typeof protocoles)[number]) => etatProtocole(p, donnees.signatures, aujourdhui);
  const nomT = (p: (typeof protocoles)[number]) => p.transporteur || "transporteur sans nom";
  const lienProtocole = (liste: typeof protocoles) =>
    liste.length === 1 ? `/entreprises-exterieures?protocole=${liste[0].id}` : "/entreprises-exterieures?onglet=protocoles";
  const nonPret = (p: (typeof protocoles)[number]) => ["a-completer", "a-signer"].includes(etatP(p));
  const protocolesActifs = protocoles.filter((p) => actifOuProche(p, aujourdhui) && nonPret(p));
  if (protocolesActifs.length) {
    alertes.push({
      id: "protocoles-non-signes", gravite: "critique", elements: protocolesActifs.map((p) => p.id), categorie: "Entreprises extérieures", lien: lienProtocole(protocolesActifs),
      titre: `${pluriel(protocolesActifs.length, "protocole")} de sécurité non signé${protocolesActifs.length > 1 ? "s" : ""} pour des opérations en cours`,
      detail: `Chargements et déchargements sans protocole écrit et signé (art. R4515-4) : ${liste(protocolesActifs.map(nomT))}.`,
    });
  }
  const protocolesProches = protocoles.filter((p) => p.debut > aujourdhui && actifOuProche(p, aujourdhui, 15) && nonPret(p));
  if (protocolesProches.length) {
    alertes.push({
      id: "protocoles-a-preparer", gravite: "importante", categorie: "Entreprises extérieures", lien: lienProtocole(protocolesProches),
      titre: `${pluriel(protocolesProches.length, "protocole")} de sécurité à finaliser avant l'opération`,
      detail: liste(protocolesProches.map((p) => `${nomT(p)} (le ${formaterDate(p.debut)})`)),
    });
  }
  const protocolesARenouveler = protocoles.filter((p) => etatP(p) === "a-renouveler" && !dejaRenouvele(p, protocoles));
  if (protocolesARenouveler.length) {
    alertes.push({
      id: "protocoles-a-renouveler", gravite: "importante", categorie: "Entreprises extérieures", lien: lienProtocole(protocolesARenouveler),
      titre: `${pluriel(protocolesARenouveler.length, "protocole")} de sécurité à renouveler`,
      detail: liste(protocolesARenouveler.map((p) => `${nomT(p)} (fin le ${formaterDate(p.fin)})`)),
    });
  }

  // Visites et audits terrain
  const visites = donnees.visites ?? [];
  const lienVisite = (liste: typeof visites) => (liste.length === 1 ? `/visites?visite=${liste[0].id}` : "/visites");
  const ncSansAction = sansAction(visites, actions);
  if (ncSansAction.length) {
    const concernees = [...new Map(ncSansAction.map((x) => [x.visite.id, x.visite])).values()];
    alertes.push({
      id: "visites-sans-action", gravite: "importante", categorie: "Visites", lien: lienVisite(concernees),
      titre: `${pluriel(ncSansAction.length, "non-conformité")} relevée${ncSansAction.length > 1 ? "s" : ""} en visite sans action`,
      detail: liste(ncSansAction.map((x) => x.reponse.question)),
    });
  }
  const visitesOuvertes = visites.filter((v) => !v.clotureeLe && v.date && v.date < decalerJours(aujourdhui, -7));
  if (visitesOuvertes.length) {
    alertes.push({
      id: "visites-a-cloturer", gravite: "info", categorie: "Visites", lien: lienVisite(visitesOuvertes),
      titre: `${pluriel(visitesOuvertes.length, "visite")} commencée${visitesOuvertes.length > 1 ? "s" : ""} il y a plus d'une semaine`,
      detail: `Terminez-la et clôturez-la : ${liste(visitesOuvertes.map((v) => `${v.grille} du ${formaterDate(v.date)}`))}.`,
    });
  }
  const derniere = derniereVisite(visites);
  if (derniere && derniere.date < decalerJours(aujourdhui, -90)) {
    alertes.push({
      id: "visites-anciennes", gravite: "info", categorie: "Visites", lien: "/visites",
      titre: "Aucune visite de sécurité depuis plus de 3 mois",
      detail: `Dernière visite le ${formaterDate(derniere.date)}. Une visite régulière du terrain repère les dangers avant l'accident.`,
    });
  }

  // Accueil sécurité et causeries
  const accueils = donnees.accueils ?? [];
  const lienAccueil = (liste: typeof accueils) => (liste.length === 1 ? `/accueil?accueil=${liste[0].id}` : "/accueil");
  const nonAccueillis = accueilsEnRetard(accueils, aujourdhui);
  if (nonAccueillis.length) {
    const renforces = nonAccueillis.filter(formationRenforcee);
    alertes.push({
      id: "accueils-a-faire", gravite: "critique", elements: nonAccueillis.map((a) => a.id), categorie: "Accueil et causeries", lien: lienAccueil(nonAccueillis),
      titre: `${nonAccueillis.length} ${nonAccueillis.length > 1 ? "nouveaux arrivants" : "nouvel arrivant"} sans accueil sécurité`,
      detail:
        `À faire avant la prise de poste (art. R4141-2) : ${liste(nonAccueillis.map((a) => nomArrivant(a, donnees)))}.` +
        (renforces.length ? ` Formation renforcée requise sur poste à risques (art. L4154-2) : ${liste(renforces.map((a) => nomArrivant(a, donnees)))}.` : ""),
    });
  }
  const nonSignes = accueils.filter((a) => etatAccueil(a, donnees.signatures, aujourdhui) === "a-signer");
  if (nonSignes.length) {
    alertes.push({
      id: "accueils-a-signer", gravite: "info", categorie: "Accueil et causeries", lien: lienAccueil(nonSignes),
      titre: `${pluriel(nonSignes.length, "accueil")} sécurité à faire signer`,
      detail: `La signature prouve que l'accueil a eu lieu : ${liste(nonSignes.map((a) => nomArrivant(a, donnees)))}.`,
    });
  }
  const causeries = donnees.causeries ?? [];
  const derniereC = derniereCauserie(causeries);
  if (derniereC && derniereC.date < decalerJours(aujourdhui, -90)) {
    alertes.push({
      id: "causeries-anciennes", gravite: "info", categorie: "Accueil et causeries", lien: "/accueil?onglet=causeries",
      titre: "Aucune causerie sécurité depuis plus de 3 mois",
      detail: `Dernière causerie le ${formaterDate(derniereC.date)}. Quinze minutes suffisent pour faire passer un message de prévention.`,
    });
  }

  // Stocks d'EPI
  const stocks = calculerStocks(donnees, aujourdhui);
  const ruptures = stocks.filter((s) => s.etat === "rupture");
  if (ruptures.length) {
    alertes.push({
      id: "stocks-rupture", gravite: "critique", elements: ruptures.map((s) => `${s.article.id}:${s.taille}`), categorie: "EPI", lien: lienUnique("/epi", "article", ruptures.map((s) => s.article.id)),
      titre: `${pluriel(ruptures.length, "référence")} d'EPI en rupture`,
      detail: liste(ruptures.map((s) => `${s.article.nom} (${s.taille})`)),
    });
  }
  const sousTampon = stocks.filter((s) => s.etat === "sous-tampon");
  if (sousTampon.length) {
    alertes.push({
      id: "stocks-tampon", gravite: "importante", categorie: "EPI", lien: lienUnique("/epi", "article", sousTampon.map((s) => s.article.id)),
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
      id: "epi-non-signes", gravite: "info", categorie: "EPI", lien: "/epi?onglet=fiches",
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

  // Classement : niveau d'abord ; à niveau égal, la date concernée la plus ancienne (retard le plus long ou
  // échéance la plus proche) ; les alertes sans date gardent ensuite l'ordre des règles.
  const ordre = { critique: 0, importante: 1, info: 2 };
  return alertes.sort((a, b) => ordre[a.gravite] - ordre[b.gravite] || (a.date ?? "9999").localeCompare(b.date ?? "9999"));
}
