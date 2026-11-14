// Fiche officielle d'une entreprise (répertoire de l'INSEE et registre national des entreprises), lue
// par l'API publique « Recherche d'entreprises » de l'État (recherche-entreprises.api.gouv.fr, sans
// clé) : elle remplit la fiche de l'entreprise (page de garde du document unique) en un clic.

export type FicheOfficielle = {
  raisonSociale: string;
  siren: string;
  siret: string;
  adresse: string;
  activite: string; // libellé de la division NAF et code, ex. « Entreposage et services auxiliaires des transports (52.10B) »
  effectif: string; // tranche de l'INSEE, ex. « 10 à 19 salariés (INSEE, 2023) »
  responsable: string; // premier dirigeant personne physique, ex. « Marie Dupont, Présidente »
  ville: string;
};

// Réponse de l'API, réduite à ce qui sert ici.
export type ResultatApi = {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string | null;
  activite_principale?: string | null;
  tranche_effectif_salarie?: string | null;
  annee_tranche_effectif_salarie?: string | null;
  etat_administratif?: string;
  siege?: { siret?: string; adresse?: string; libelle_commune?: string | null } | null;
  dirigeants?: { type_dirigeant?: string; nom?: string | null; prenoms?: string | null; qualite?: string | null; denomination?: string | null }[];
};

// Tranches d'effectif salarié de l'INSEE.
export const tranchesEffectif: Record<string, string> = {
  "00": "0 salarié",
  "01": "1 ou 2 salariés",
  "02": "3 à 5 salariés",
  "03": "6 à 9 salariés",
  "11": "10 à 19 salariés",
  "12": "20 à 49 salariés",
  "21": "50 à 99 salariés",
  "22": "100 à 199 salariés",
  "31": "200 à 249 salariés",
  "32": "250 à 499 salariés",
  "41": "500 à 999 salariés",
  "42": "1 000 à 1 999 salariés",
  "51": "2 000 à 4 999 salariés",
  "52": "5 000 à 9 999 salariés",
  "53": "10 000 salariés et plus",
};

// Divisions de la nomenclature d'activités française (NAF rév. 2) : les deux premiers chiffres du code.
export const divisionsNaf: Record<string, string> = {
  "01": "Culture et production animale, chasse et services annexes",
  "02": "Sylviculture et exploitation forestière",
  "03": "Pêche et aquaculture",
  "05": "Extraction de houille et de lignite",
  "06": "Extraction d'hydrocarbures",
  "07": "Extraction de minerais métalliques",
  "08": "Autres industries extractives",
  "09": "Services de soutien aux industries extractives",
  "10": "Industries alimentaires",
  "11": "Fabrication de boissons",
  "12": "Fabrication de produits à base de tabac",
  "13": "Fabrication de textiles",
  "14": "Industrie de l'habillement",
  "15": "Industrie du cuir et de la chaussure",
  "16": "Travail du bois et fabrication d'articles en bois",
  "17": "Industrie du papier et du carton",
  "18": "Imprimerie et reproduction d'enregistrements",
  "19": "Cokéfaction et raffinage",
  "20": "Industrie chimique",
  "21": "Industrie pharmaceutique",
  "22": "Fabrication de produits en caoutchouc et en plastique",
  "23": "Fabrication d'autres produits minéraux non métalliques",
  "24": "Métallurgie",
  "25": "Fabrication de produits métalliques, à l'exception des machines et des équipements",
  "26": "Fabrication de produits informatiques, électroniques et optiques",
  "27": "Fabrication d'équipements électriques",
  "28": "Fabrication de machines et équipements",
  "29": "Industrie automobile",
  "30": "Fabrication d'autres matériels de transport",
  "31": "Fabrication de meubles",
  "32": "Autres industries manufacturières",
  "33": "Réparation et installation de machines et d'équipements",
  "35": "Production et distribution d'électricité, de gaz, de vapeur et d'air conditionné",
  "36": "Captage, traitement et distribution d'eau",
  "37": "Collecte et traitement des eaux usées",
  "38": "Collecte, traitement et élimination des déchets ; récupération",
  "39": "Dépollution et autres services de gestion des déchets",
  "41": "Construction de bâtiments",
  "42": "Génie civil",
  "43": "Travaux de construction spécialisés",
  "45": "Commerce et réparation d'automobiles et de motocycles",
  "46": "Commerce de gros",
  "47": "Commerce de détail",
  "49": "Transports terrestres et transport par conduites",
  "50": "Transports par eau",
  "51": "Transports aériens",
  "52": "Entreposage et services auxiliaires des transports",
  "53": "Activités de poste et de courrier",
  "55": "Hébergement",
  "56": "Restauration",
  "58": "Édition",
  "59": "Production audiovisuelle, enregistrement sonore et édition musicale",
  "60": "Programmation et diffusion",
  "61": "Télécommunications",
  "62": "Programmation, conseil et autres activités informatiques",
  "63": "Services d'information",
  "64": "Activités des services financiers, hors assurance et caisses de retraite",
  "65": "Assurance",
  "66": "Activités auxiliaires de services financiers et d'assurance",
  "68": "Activités immobilières",
  "69": "Activités juridiques et comptables",
  "70": "Activités des sièges sociaux ; conseil de gestion",
  "71": "Activités d'architecture et d'ingénierie ; contrôle et analyses techniques",
  "72": "Recherche-développement scientifique",
  "73": "Publicité et études de marché",
  "74": "Autres activités spécialisées, scientifiques et techniques",
  "75": "Activités vétérinaires",
  "77": "Activités de location et location-bail",
  "78": "Activités liées à l'emploi",
  "79": "Agences de voyage, voyagistes et services de réservation",
  "80": "Enquêtes et sécurité",
  "81": "Services relatifs aux bâtiments et aménagement paysager",
  "82": "Activités administratives et autres activités de soutien aux entreprises",
  "84": "Administration publique et défense ; sécurité sociale obligatoire",
  "85": "Enseignement",
  "86": "Activités pour la santé humaine",
  "87": "Hébergement médico-social et social",
  "88": "Action sociale sans hébergement",
  "90": "Activités créatives, artistiques et de spectacle",
  "91": "Bibliothèques, archives, musées et autres activités culturelles",
  "92": "Organisation de jeux de hasard et d'argent",
  "93": "Activités sportives, récréatives et de loisirs",
  "94": "Activités des organisations associatives",
  "95": "Réparation d'ordinateurs et de biens personnels et domestiques",
  "96": "Autres services personnels",
  "97": "Activités des ménages en tant qu'employeurs de personnel domestique",
  "98": "Activités indifférenciées des ménages pour usage propre",
  "99": "Activités des organisations et organismes extraterritoriaux",
};

// Recherche saisie : un SIRET ou un SIREN (espaces acceptés), ou un nom. null si trop courte ou trop longue.
export function lireRecherche(saisie: string): string | null {
  const x = saisie.trim();
  const chiffres = x.replace(/[\s.]/g, "");
  if (/^\d{9}$|^\d{14}$/.test(chiffres)) return chiffres;
  if (/^\d+$/.test(chiffres)) return null; // un numéro incomplet ne donnerait que des résultats au hasard
  return x.length >= 3 && x.length <= 100 ? x : null;
}

// « MARIE-CLAIRE » → « Marie-Claire », « DE LA FONTAINE » → « De La Fontaine ».
const nomPropre = (x: string) => x.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toUpperCase());

const formaterSiret = (s: string) => (/^\d{14}$/.test(s) ? `${s.slice(0, 3)} ${s.slice(3, 6)} ${s.slice(6, 9)} ${s.slice(9)}` : s);

export function activiteDe(code: string | null | undefined) {
  if (!code) return "";
  const libelle = divisionsNaf[code.slice(0, 2)];
  return libelle ? `${libelle} (${code})` : code;
}

export function effectifDe(tranche: string | null | undefined, annee: string | null | undefined) {
  const libelle = tranche ? tranchesEffectif[tranche] : undefined;
  if (!libelle) return "";
  return `${libelle} (INSEE${annee ? `, ${annee}` : ""})`;
}

export function responsableDe(dirigeants: ResultatApi["dirigeants"]) {
  const d = dirigeants?.find((x) => x.type_dirigeant === "personne physique" && x.nom);
  if (!d) return "";
  // Le premier prénom seulement : l'état civil complet n'a pas sa place sur le document unique.
  const prenom = d.prenoms?.trim().split(/\s+/)[0] ?? "";
  const nom = nomPropre([prenom, d.nom].filter(Boolean).join(" "));
  const qualite = d.qualite && d.qualite !== "Autre" ? d.qualite : "";
  return qualite ? `${nom}, ${qualite}` : nom;
}

export function ficheDepuisResultat(r: ResultatApi): FicheOfficielle {
  return {
    raisonSociale: (r.nom_raison_sociale || r.nom_complet || "").trim(),
    siren: r.siren ?? "",
    siret: formaterSiret(r.siege?.siret ?? ""),
    adresse: (r.siege?.adresse ?? "").trim(),
    activite: activiteDe(r.activite_principale),
    effectif: effectifDe(r.tranche_effectif_salarie, r.annee_tranche_effectif_salarie),
    responsable: responsableDe(r.dirigeants),
    ville: r.siege?.libelle_commune ?? "",
  };
}
