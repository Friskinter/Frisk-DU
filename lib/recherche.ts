// Recherche dans toute l'application : salariés, risques, actions, accidents, formations, équipements,
// produits, entreprises extérieures, visites, accueils, causeries, EPI et pages du menu. Chaque
// résultat ouvre directement l'élément grâce aux liens directs des modules (?salarie=…, ?action=…).

import { formaterDate } from "./calculs";
import { nomVictime } from "./evenements";
import { libelleFormation } from "./formations";
import { typesEvenement } from "./referentiel";
import type { Donnees } from "./types";

export type Resultat = {
  id: string; // unique dans la liste des résultats
  categorie: string;
  titre: string;
  detail: string;
  lien: string;
};

// Pages de l'espace, trouvées par leur nom ou par des mots courants.
export const pagesRecherchables: { titre: string; lien: string; motsCles: string }[] = [
  { titre: "Tableau de bord", lien: "/", motsCles: "accueil alertes urgences" },
  { titre: "Mon parcours", lien: "/parcours", motsCles: "étapes progression qhse" },
  { titre: "Mes actions", lien: "/mes-actions", motsCles: "confiées tâches" },
  { titre: "Bilans", lien: "/bilans", motsCles: "statistiques indicateurs" },
  { titre: "Rapport annuel", lien: "/rapport", motsCles: "bilan année" },
  { titre: "DUERP", lien: "/duerp", motsCles: "document unique évaluation risques" },
  { titre: "Plan d'actions", lien: "/actions", motsCles: "prévention mesures papripact" },
  { titre: "Pénibilité", lien: "/penibilite", motsCles: "c2p facteurs seuils" },
  { titre: "Produits chimiques", lien: "/produits", motsCles: "fds cmr inventaire" },
  { titre: "Accidents", lien: "/accidents", motsCles: "presque-accidents registre bénins signalement" },
  { titre: "Vérifications", lien: "/verifications", motsCles: "équipements contrôles périodiques extincteurs" },
  { titre: "Visites et audits", lien: "/visites", motsCles: "terrain grilles inspection" },
  { titre: "Entreprises extérieures", lien: "/entreprises-exterieures", motsCles: "plan de prévention protocole sécurité transporteurs" },
  { titre: "Salariés", lien: "/salaries", motsCles: "personnel fiche" },
  { titre: "Formations", lien: "/formations", motsCles: "habilitations caces sst" },
  { titre: "Accueil et causeries", lien: "/accueil", motsCles: "nouvel arrivant quart d'heure sécurité" },
  { titre: "EPI & stocks", lien: "/epi", motsCles: "équipements de protection individuelle commandes" },
  { titre: "Réglages", lien: "/reglages", motsCles: "entreprise unités services logo identité sauvegarde" },
  { titre: "Journal", lien: "/journal", motsCles: "historique modifications" },
  { titre: "Mon compte", lien: "/compte", motsCles: "mot de passe e-mails préférences" },
];

// Minuscules, sans accents ni ponctuation : « Échafaudage » se trouve en tapant « echaf ».
export function normaliser(texte: string) {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type Candidat = Resultat & { texte: string };

function candidats(d: Donnees): Candidat[] {
  const liste: Candidat[] = [];
  // `plus` : texte cherché en plus du titre et du détail, sans être affiché.
  const ajouter = (r: Resultat, plus = "") => liste.push({ ...r, texte: normaliser(`${r.titre} ${r.detail} ${plus}`) });
  const nomSalarie = (id: string) => d.salaries.find((s) => s.id === id)?.nom ?? "";

  for (const p of pagesRecherchables) ajouter({ id: `page-${p.lien}`, categorie: "Pages", titre: p.titre, detail: "", lien: p.lien }, p.motsCles);
  for (const s of d.salaries) {
    ajouter({ id: s.id, categorie: "Salariés", titre: s.nom || "Salarié sans nom", detail: [s.service, s.poste].filter(Boolean).join(" · "), lien: `/salaries?salarie=${s.id}` });
  }
  for (const l of d.duerp) {
    ajouter(
      { id: l.id, categorie: "Risques du DUERP", titre: l.danger || l.activite || "Risque", detail: [l.unite, l.risque].filter(Boolean).join(" · "), lien: `/duerp?fiche=${l.id}` },
      `${l.activite} ${l.mesures}`,
    );
  }
  for (const a of d.actions) {
    ajouter(
      { id: a.id, categorie: "Actions", titre: a.intitule || "Action sans intitulé", detail: [a.responsable, a.echeance && `échéance ${formaterDate(a.echeance)}`].filter(Boolean).join(" · "), lien: `/actions?action=${a.id}` },
      a.responsableEmail ?? "",
    );
  }
  for (const e of d.evenements) {
    const type = typesEvenement.find((t) => t.valeur === e.type)?.libelle ?? "Événement";
    ajouter(
      { id: e.id, categorie: "Accidents", titre: `${type}${nomVictime(e, d) ? ` · ${nomVictime(e, d)}` : ""}`, detail: [formaterDate(e.date), e.description].filter(Boolean).join(" · "), lien: `/accidents?evenement=${e.id}` },
      `${e.lieu} ${e.unite} ${e.lesions}`,
    );
  }
  for (const f of d.formations) {
    ajouter(
      { id: f.id, categorie: "Formations", titre: `${libelleFormation(f)} · ${nomSalarie(f.salarieId) || "salarié supprimé"}`, detail: f.expireLe ? `valable jusqu'au ${formaterDate(f.expireLe)}` : "", lien: `/formations?formation=${f.id}` },
      `${f.intitule} ${f.organisme}`,
    );
  }
  for (const e of d.equipements) {
    ajouter({ id: e.id, categorie: "Équipements vérifiés", titre: e.nom || "Équipement", detail: [e.localisation, e.prestataire].filter(Boolean).join(" · "), lien: `/verifications?equipement=${e.id}` }, e.reference);
  }
  for (const p of d.produits) {
    ajouter(
      { id: p.id, categorie: "Produits chimiques", titre: p.nom || "Produit", detail: [p.fournisseur, p.actif ? "" : "retiré"].filter(Boolean).join(" · "), lien: `/produits?produit=${p.id}` },
      `${p.reference} ${p.usage} ${p.unite}`,
    );
  }
  for (const i of d.interventions) {
    ajouter({ id: i.id, categorie: "Entreprises extérieures", titre: i.entreprise || "Entreprise extérieure", detail: i.objet, lien: `/entreprises-exterieures?intervention=${i.id}` }, `${i.responsable} ${i.siret} ${i.lieux}`);
  }
  for (const p of d.protocoles) {
    ajouter({ id: p.id, categorie: "Entreprises extérieures", titre: p.transporteur || "Transporteur", detail: "Protocole de sécurité", lien: `/entreprises-exterieures?protocole=${p.id}` }, `${p.contact} ${p.siret}`);
  }
  for (const v of d.visites) {
    ajouter({ id: v.id, categorie: "Visites et audits", titre: v.grille || "Visite", detail: [formaterDate(v.date), v.unite].filter(Boolean).join(" · "), lien: `/visites?visite=${v.id}` }, `${v.auditeur} ${v.participants}`);
  }
  for (const a of d.accueils) {
    ajouter({ id: a.id, categorie: "Accueils", titre: `Accueil · ${nomSalarie(a.salarieId) || a.nom || "nouvel arrivant"}`, detail: [a.poste, a.unite].filter(Boolean).join(" · "), lien: `/accueil?accueil=${a.id}` });
  }
  for (const c of d.causeries) {
    ajouter({ id: c.id, categorie: "Causeries", titre: c.theme || "Causerie", detail: [formaterDate(c.date), c.animateur].filter(Boolean).join(" · "), lien: `/accueil?causerie=${c.id}` });
  }
  for (const a of d.articles) {
    ajouter({ id: a.id, categorie: "EPI", titre: a.nom || "Article", detail: a.categorie, lien: `/epi?article=${a.id}` });
  }

  return liste;
}

// Tous les mots tapés doivent se trouver dans l'élément. Les éléments dont le titre commence par la
// recherche passent en premier, puis ceux dont un mot du titre commence par elle.
export function rechercher(d: Donnees, recherche: string, limite = 30): Resultat[] {
  const mots = normaliser(recherche).split(" ").filter(Boolean);
  if (!mots.length) return [];
  const debut = mots.join(" ");
  return candidats(d)
    .filter((c) => mots.every((m) => c.texte.includes(m)))
    .map((c) => {
      const titre = normaliser(c.titre);
      const score = titre.startsWith(debut) ? 0 : mots.every((m) => ` ${titre}`.includes(` ${m}`)) ? 1 : 2;
      return { c, score };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, limite)
    .map(({ c }) => ({ id: c.id, categorie: c.categorie, titre: c.titre, detail: c.detail, lien: c.lien }));
}
