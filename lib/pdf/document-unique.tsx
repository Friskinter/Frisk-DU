// Document unique d'évaluation des risques professionnels au format PDF.
// Polices standard du PDF (Helvetica, Times) : pas de téléchargement de police nécessaire.

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { useContext, type ReactNode } from "react";
import { actionEnRetard, actionsDe, estPapripact } from "@/lib/actions";
import {
  criticiteBrute,
  formatEuros,
  formatNombre,
  formaterDate,
  niveauDe,
  risqueResiduel,
} from "@/lib/calculs";
import {
  efficacites,
  facteursPenibilite,
  grilleFrequence,
  grilleGravite,
  grilleMaitrise,
  niveauxCriticite,
  principesPrevention,
  seuilsPenibilite,
  statutsAction,
} from "@/lib/referentiel";
import type { Action, Donnees, LigneDuerp } from "@/lib/types";
import type { Marque } from "@/lib/identite";
import { BandeauCouleur, CouleurTitres, LogoDocument, MentionFrisk } from "./marque";

const c = {
  encre: "#0c0b0a",
  ardoise: "#3a3530",
  gris: "#8a837a",
  bronze: "#b08d57",
  marbre: "#ece6dc",
  pierre: "#d9cfc1",
  ivoire: "#f7f4ef",
};

const s = StyleSheet.create({
  // Pas d'interligne sur la page : il empêche la bibliothèque PDF d'afficher les pieds de page fixes.
  page: { paddingTop: 42, paddingBottom: 54, paddingHorizontal: 42, fontFamily: "Helvetica", fontSize: 9, color: c.encre },
  pied: { position: "absolute", bottom: 22, left: 42, right: 42, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: c.gris, borderTopWidth: 0.5, borderTopColor: c.pierre, paddingTop: 6 },
  surtitre: { fontSize: 8, letterSpacing: 2, color: c.bronze, textTransform: "uppercase" },
  h1: { fontFamily: "Times-Roman", fontSize: 20, lineHeight: 1.2, marginTop: 4, marginBottom: 14 },
  h2: { fontFamily: "Times-Bold", fontSize: 12.5, marginTop: 14, marginBottom: 6 },
  texte: { color: c.ardoise, marginBottom: 4, fontSize: 9, lineHeight: 1.35 },
  table: { borderWidth: 0.5, borderColor: c.pierre, borderBottomWidth: 0 },
  ligne: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: c.pierre },
  entete: { flexDirection: "row", backgroundColor: c.marbre, borderBottomWidth: 0.5, borderBottomColor: c.pierre },
  th: { padding: 4, fontFamily: "Helvetica-Bold", fontSize: 7, textTransform: "uppercase", color: c.ardoise },
  td: { padding: 4, fontSize: 8, lineHeight: 1.35 },
  pastille: { borderRadius: 6, paddingTop: 2.5, paddingBottom: 1.5, paddingHorizontal: 5, fontSize: 7, lineHeight: 1.2, fontFamily: "Helvetica-Bold", alignSelf: "flex-start" },
});

type Colonne = { titre: string; largeur: number | string };

function Entete({ colonnes, fixe = true }: { colonnes: Colonne[]; fixe?: boolean }) {
  return (
    <View style={s.entete} fixed={fixe}>
      {colonnes.map((col) => (
        <Text key={col.titre} style={[s.th, { width: col.largeur }]}>
          {col.titre}
        </Text>
      ))}
    </View>
  );
}

function Cellule({ largeur, children, gras }: { largeur: number | string; children: ReactNode; gras?: boolean }) {
  return (
    <View style={[s.td, { width: largeur }]}>
      {typeof children === "string" || typeof children === "number" ? (
        <Text style={gras ? { fontFamily: "Helvetica-Bold" } : undefined}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

function Niveau({ score }: { score: number }) {
  const n = niveauDe(score);
  return (
    <Text style={[s.pastille, { backgroundColor: n.couleur, color: n.texte }]}>
      {formatNombre.format(score)} {n.libelle}
    </Text>
  );
}

function LigneInventaire({ ligne: l }: { ligne: LigneDuerp }) {
  return (
    <View style={s.ligne} wrap={false}>
      <Cellule largeur="14%">{l.activite || "-"}</Cellule>
      <Cellule largeur="10%">{l.danger || "-"}</Cellule>
      <Cellule largeur="13%">{l.risque || "-"}</Cellule>
      <Cellule largeur="4%">{l.effectif}</Cellule>
      <Cellule largeur="3.5%">{l.gravite}</Cellule>
      <Cellule largeur="3.5%">{l.frequence}</Cellule>
      <Cellule largeur="8.5%"><Niveau score={criticiteBrute(l)} /></Cellule>
      <Cellule largeur="16%">{l.mesures || "-"}</Cellule>
      <Cellule largeur="7.5%">{libelleMaitrise(l)}</Cellule>
      <Cellule largeur="9.5%"><Niveau score={risqueResiduel(l)} /></Cellule>
      <Cellule largeur="10%">{l.penibilite ? libelleFacteur(l.penibilite) : "-"}</Cellule>
    </View>
  );
}

function Pied({ entreprise, version }: { entreprise: string; version: string }) {
  return (
    <View style={s.pied} fixed>
      <Text>{entreprise} · Document unique d&apos;évaluation des risques professionnels</Text>
      <Text render={({ pageNumber, totalPages }) => `${version} · Page ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function Titre({ numero, surtitre, titre, accent }: { numero: string; surtitre: string; titre: string; accent: string }) {
  const couleur = useContext(CouleurTitres);
  return (
    <View>
      <Text style={[s.surtitre, { color: accent }]}>
        {numero} · {surtitre}
      </Text>
      <Text style={[s.h1, { color: couleur }]}>{titre}</Text>
    </View>
  );
}

const libelleMaitrise = (l: LigneDuerp) => grilleMaitrise.find((m) => m.valeur === l.maitrise)?.libelle ?? "";
// Les espaces insécables du format français ne figurent pas dans la police standard du PDF.
const euros = (montant: number) => formatEuros.format(montant).replace(/[\u00a0\u202f]/g, " ");

const libelleStatut = (a: Action) => statutsAction.find((x) => x.valeur === a.statut)?.libelle ?? "";
const libellePrincipe = (a: Action) => principesPrevention.find((p) => p.valeur === a.principe)?.libelle.replace(/^\d\. /, "") ?? "-";
const libelleFacteur = (code: string) => facteursPenibilite.find((f) => f.code === code)?.libelle ?? "";

export type LigneHistorique = { numero: number; date: string; motif: string; auteur: string };

export function DocumentUnique({
  donnees,
  aujourdhui,
  marque,
  numero,
  historique = [],
}: {
  donnees: Pick<Donnees, "entreprise" | "fiche" | "duerp"> & { actions?: Action[] };
  aujourdhui: string; // date de la version (AAAA-MM-JJ)
  marque: Marque;
  numero?: number; // numéro de la version figée ; absent pour un document de travail
  historique?: LigneHistorique[]; // versions figées jusqu'à celle-ci incluse
}) {
  // Libellé de version repris sur la page de garde et en pied de page.
  const version = numero
    ? `Version n° ${numero} du ${formaterDate(aujourdhui)}`
    : `Document de travail du ${formaterDate(aujourdhui)}`;
  const fiche = donnees.fiche;
  const risques = donnees.duerp;
  const unites = [...new Set(risques.map((l) => l.unite || "Sans unité"))];
  // Actions classées par priorité du risque ; les versions figées à l'ancien format sont reconstituées.
  const risqueDe = new Map(risques.map((l) => [l.id, l]));
  const actions = actionsDe(donnees)
    .filter((a) => risqueDe.has(a.risqueId))
    .sort((a, b) => risqueResiduel(risqueDe.get(b.risqueId)!) - risqueResiduel(risqueDe.get(a.risqueId)!));
  const budget = actions.reduce((t, a) => t + (a.cout ?? 0), 0);
  const papripact = estPapripact(donnees);
  const penibles = risques.filter((l) => l.penibilite);

  const colonnesInventaire: Colonne[] = [
    { titre: "Activité / situation", largeur: "14%" },
    { titre: "Danger", largeur: "10%" },
    { titre: "Risque / dommage", largeur: "13%" },
    { titre: "Eff.", largeur: "4%" },
    { titre: "G", largeur: "3.5%" },
    { titre: "F", largeur: "3.5%" },
    { titre: "Brute", largeur: "8.5%" },
    { titre: "Mesures existantes", largeur: "16%" },
    { titre: "Maîtrise", largeur: "7.5%" },
    { titre: "Résiduel", largeur: "9.5%" },
    { titre: "Pénibilité", largeur: "10%" },
  ];

  const colonnesActions: Colonne[] = [
    { titre: "Priorité", largeur: "9%" },
    { titre: "Risque", largeur: "17%" },
    { titre: "Action de prévention", largeur: "23%" },
    { titre: "Type de mesure", largeur: "11%" },
    { titre: "Responsable", largeur: "11%" },
    { titre: "Échéance", largeur: "8%" },
    { titre: "Coût HT", largeur: "7%" },
    { titre: "Statut / efficacité", largeur: "14%" },
  ];

  return (
    <Document
      title={`Document unique - ${donnees.entreprise} - ${version}`}
      author={fiche?.responsable || donnees.entreprise}
      creator="Frisk DU"
      producer="Frisk DU"
      language="fr"
    >
      <CouleurTitres.Provider value={marque.titre}>
      {/* Page de garde */}
      <Page size="A4" style={[s.page, { paddingTop: 0, paddingHorizontal: 0 }]}>
        <View style={{ backgroundColor: marque.fond, paddingHorizontal: 42, paddingTop: 60, paddingBottom: 40 }}>
          {/* Le logo d'une entreprise est posé sur un cartouche blanc, lisible sur le fond noir. */}
          {marque.logoClient ? (
            <View style={{ alignSelf: "flex-start", backgroundColor: "#ffffff", padding: 6 }}>
              <LogoDocument marque={marque} hauteur={48} />
            </View>
          ) : (
            <LogoDocument marque={marque} hauteur={54} />
          )}
          <Text style={{ marginTop: 28, fontSize: 9, letterSpacing: 3, color: marque.clair, textTransform: "uppercase" }}>
            Document unique
          </Text>
          <Text style={{ marginTop: 8, fontFamily: "Times-Roman", fontSize: 28, color: c.marbre, lineHeight: 1.2 }}>
            Évaluation des risques professionnels
          </Text>
          <Text style={{ marginTop: 18, fontSize: 16, color: c.marbre }}>{donnees.entreprise}</Text>
        </View>

        <View style={{ paddingHorizontal: 42, paddingTop: 32 }}>
          <View style={s.table}>
            {[
              ["Raison sociale", donnees.entreprise],
              ["SIRET", fiche?.siret],
              ["Adresse", fiche?.adresse],
              ["Activité", fiche?.activite],
              ["Effectif", fiche?.effectif],
              ["Responsable du document", fiche?.responsable],
              ["Version", version],
            ].map(([libelle, valeur]) => (
              <View key={libelle} style={s.ligne}>
                <Text style={[s.td, { width: "32%", color: c.gris, backgroundColor: c.ivoire }]}>{libelle}</Text>
                <Text style={[s.td, { width: "68%", fontSize: 9.5 }]}>{valeur || "-"}</Text>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 26, flexDirection: "row", gap: 10 }}>
            {[
              [String(risques.length), "risques évalués"],
              [String(unites.length), "unités de travail"],
              [String(risques.filter((l) => ["important", "critique"].includes(niveauDe(risqueResiduel(l)).code)).length), "risques prioritaires"],
              [String(actions.filter((a) => a.statut !== "fait").length), "actions en cours ou à mener"],
            ].map(([valeur, libelle]) => (
              <View key={libelle} style={{ flex: 1, borderWidth: 0.5, borderColor: c.pierre, padding: 10 }}>
                <Text style={{ fontSize: 20, lineHeight: 1.2, fontFamily: "Helvetica-Bold" }}>{valeur}</Text>
                <Text style={{ fontSize: 8, color: c.gris, marginTop: 4 }}>{libelle}</Text>
              </View>
            ))}
          </View>

          <Text style={[s.texte, { marginTop: 26, fontSize: 8.5 }]}>
            Établi en application des articles L4121-1 à L4121-3 et R4121-1 à R4121-4 du Code du travail. Ce
            document est tenu à la disposition des salariés, des membres du CSE, du médecin du travail et de
            l&apos;inspection du travail.
          </Text>
        </View>
        <View style={[s.pied, { left: 42, right: 42 }]} fixed>
          <Text>{donnees.entreprise}</Text>
          <Text>{version}</Text>
        </View>
        <BandeauCouleur marque={marque} />
        <MentionFrisk marque={marque} />
      </Page>

      {/* Cadre et méthode */}
      <Page size="A4" style={s.page}>
        <Titre accent={marque.accent} numero="1" surtitre="Cadre" titre="Objet du document et méthode d'évaluation" />
        <Text style={[s.h2, { color: marque.titre }]}>Obligations de l&apos;employeur</Text>
        {[
          "L'employeur évalue les risques pour la santé et la sécurité des travailleurs et transcrit les résultats dans un document unique, qui comporte un inventaire des risques identifiés dans chaque unité de travail.",
          "Le document unique est mis à jour au moins chaque année dans les entreprises d'au moins 11 salariés, ainsi que lors de toute décision d'aménagement important modifiant les conditions de travail, et lorsqu'une information supplémentaire sur un risque est portée à la connaissance de l'employeur.",
          "Les versions successives du document unique sont conservées pendant au moins 40 ans.",
          "Les résultats de l'évaluation débouchent sur un programme annuel de prévention (entreprises d'au moins 50 salariés) ou sur une liste d'actions de prévention (moins de 50 salariés).",
        ].map((t) => (
          <Text key={t} style={s.texte}>
            • {t}
          </Text>
        ))}

        <Text style={[s.h2, { color: marque.titre }]}>Méthode de cotation</Text>
        <Text style={s.texte}>
          Chaque risque est coté selon sa gravité (G) et la fréquence d&apos;exposition (F), de 1 à 4. Leur produit
          donne la criticité brute (de 1 à 16), c&apos;est-à-dire le risque sans tenir compte des protections.
          Elle est ensuite multipliée par un coefficient de maîtrise, qui traduit l&apos;efficacité des mesures déjà en
          place, pour obtenir le risque résiduel. C&apos;est le risque résiduel qui fixe la priorité d&apos;action.
        </Text>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
          {[
            { titre: "Gravité (G)", grille: grilleGravite },
            { titre: "Fréquence (F)", grille: grilleFrequence },
          ].map(({ titre, grille }) => (
            <View key={titre} style={{ flex: 1 }} wrap={false}>
              <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 4 }}>{titre}</Text>
              <View style={s.table}>
                {grille.map((e) => (
                  <View key={e.valeur} style={s.ligne}>
                    <Text style={[s.td, { width: "12%", fontFamily: "Helvetica-Bold", color: marque.accent, fontSize: 10 }]}>{e.valeur}</Text>
                    <View style={[s.td, { width: "88%" }]}>
                      <Text style={{ fontFamily: "Helvetica-Bold" }}>{e.libelle}</Text>
                      <Text style={{ color: c.ardoise }}>{e.definition}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }} wrap={false}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 4 }}>Maîtrise du risque</Text>
            <View style={s.table}>
              {grilleMaitrise.map((m) => (
                <View key={m.valeur} style={s.ligne}>
                  <Text style={[s.td, { width: "16%", fontFamily: "Helvetica-Bold", color: marque.accent }]}>x {String(m.coefficient).replace(".", ",")}</Text>
                  <View style={[s.td, { width: "84%" }]}>
                    <Text style={{ fontFamily: "Helvetica-Bold" }}>{m.libelle}</Text>
                    <Text style={{ color: c.ardoise }}>{m.definition}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 4 }}>Niveaux de risque et délais d&apos;action</Text>
            <View style={s.table}>
              {niveauxCriticite.map((n, i) => (
                <View key={n.code} style={s.ligne}>
                  <View style={[s.td, { width: "30%" }]}>
                    <Text style={[s.pastille, { backgroundColor: n.couleur, color: n.texte }]}>{n.libelle}</Text>
                    <Text style={{ fontSize: 7, color: c.gris, marginTop: 2 }}>
                      {niveauxCriticite[i + 1] ? `${n.min} à moins de ${niveauxCriticite[i + 1].min}` : `${n.min} à 16`}
                    </Text>
                  </View>
                  <View style={[s.td, { width: "70%" }]}>
                    <Text style={{ fontFamily: "Helvetica-Bold" }}>{n.delai}</Text>
                    <Text style={{ color: c.ardoise }}>{n.definition}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
        <Pied entreprise={donnees.entreprise} version={version} />
        <BandeauCouleur marque={marque} />
        <MentionFrisk marque={marque} />
      </Page>

      {/* Synthèse */}
      <Page size="A4" style={s.page}>
        <Titre accent={marque.accent} numero="2" surtitre="Synthèse" titre="Vue d'ensemble des risques" />
        <View style={{ flexDirection: "row", gap: 16 }} wrap={false}>
          <View style={{ flex: 1 }}>
            <Text style={[s.h2, { color: marque.titre }]}>Matrice des risques (criticité brute)</Text>
            <Text style={[s.texte, { fontSize: 7.5 }]}>Nombre de risques dans chaque case Gravité x Fréquence.</Text>
            <View style={{ flexDirection: "row", marginTop: 4 }}>
              <View style={{ width: 52 }} />
              {grilleFrequence.map((f) => (
                <Text key={f.valeur} style={{ flex: 1, textAlign: "center", fontSize: 7, color: c.gris }}>F{f.valeur}</Text>
              ))}
            </View>
            {[...grilleGravite].reverse().map((g) => (
              <View key={g.valeur} style={{ flexDirection: "row", marginTop: 2 }}>
                <Text style={{ width: 52, fontSize: 7, color: c.gris, paddingTop: 7 }}>G{g.valeur} {g.libelle}</Text>
                {grilleFrequence.map((f) => {
                  const n = niveauDe(g.valeur * f.valeur);
                  const nb = risques.filter((l) => l.gravite === g.valeur && l.frequence === f.valeur).length;
                  return (
                    <Text
                      key={f.valeur}
                      style={{ flex: 1, marginLeft: 2, paddingVertical: 7, textAlign: "center", fontFamily: "Helvetica-Bold", backgroundColor: n.couleur, color: n.texte, opacity: nb ? 1 : 0.25 }}
                    >
                      {nb || " "}
                    </Text>
                  );
                })}
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.h2, { color: marque.titre }]}>Répartition par niveau (risque résiduel)</Text>
            <View style={s.table}>
              {niveauxCriticite.map((n) => {
                const nb = risques.filter((l) => niveauDe(risqueResiduel(l)).code === n.code).length;
                return (
                  <View key={n.code} style={s.ligne}>
                    <View style={[s.td, { width: "40%" }]}>
                      <Text style={[s.pastille, { backgroundColor: n.couleur, color: n.texte }]}>{n.libelle}</Text>
                    </View>
                    <Text style={[s.td, { width: "30%", fontFamily: "Helvetica-Bold", fontSize: 10 }]}>{nb}</Text>
                    <Text style={[s.td, { width: "30%", color: c.gris }]}>{n.delai}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <Text style={[s.h2, { color: marque.titre }]}>Risques par unité de travail</Text>
        <View style={s.table}>
          <Entete
            colonnes={[
              { titre: "Unité de travail", largeur: "34%" },
              { titre: "Risques", largeur: "13%" },
              { titre: "Salariés exposés (max.)", largeur: "20%" },
              { titre: "Risque résiduel le plus élevé", largeur: "33%" },
            ]}
          />
          {unites.map((u) => {
            const lignes = risques.filter((l) => (l.unite || "Sans unité") === u);
            return (
              <View key={u} style={s.ligne} wrap={false}>
                <Cellule largeur="34%" gras>{u}</Cellule>
                <Cellule largeur="13%">{lignes.length}</Cellule>
                <Cellule largeur="20%">{Math.max(...lignes.map((l) => l.effectif))}</Cellule>
                <Cellule largeur="33%"><Niveau score={Math.max(...lignes.map(risqueResiduel))} /></Cellule>
              </View>
            );
          })}
        </View>
        <Pied entreprise={donnees.entreprise} version={version} />
        <BandeauCouleur marque={marque} />
        <MentionFrisk marque={marque} />
      </Page>

      {/* Inventaire des risques */}
      <Page size="A4" orientation="landscape" style={s.page}>
        <Titre accent={marque.accent} numero="3" surtitre="Inventaire" titre="Évaluation des risques par unité de travail" />
        {unites.length === 0 && <Text style={s.texte}>Aucun risque n&apos;a encore été évalué.</Text>}
        {unites.map((u) => {
          const [premiere, ...suite] = risques.filter((l) => (l.unite || "Sans unité") === u);
          return (
            <View key={u} style={{ marginBottom: 12 }}>
              {/* Titre, en-tête et première ligne restent ensemble pour ne jamais finir seuls en bas de page. */}
              <View wrap={false}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10.5, marginBottom: 4 }}>{u}</Text>
                <View style={s.table}>
                  <Entete colonnes={colonnesInventaire} fixe={false} />
                  <LigneInventaire ligne={premiere} />
                </View>
              </View>
              {suite.length > 0 && (
                <View style={[s.table, { borderTopWidth: 0 }]}>
                  {suite.map((l) => (
                    <LigneInventaire key={l.id} ligne={l} />
                  ))}
                </View>
              )}
            </View>
          );
        })}
        <Pied entreprise={donnees.entreprise} version={version} />
        <BandeauCouleur marque={marque} />
        <MentionFrisk marque={marque} />
      </Page>

      {/* Plan d'actions */}
      <Page size="A4" orientation="landscape" style={s.page}>
        <Titre accent={marque.accent}
          numero="4"
          surtitre="Prévention"
          titre={papripact ? "Programme annuel de prévention des risques professionnels" : "Liste des actions de prévention"}
        />
        <Text style={s.texte}>
          {papripact
            ? "Programme établi en application de l'article L4121-3-1 du Code du travail (entreprises d'au moins 50 salariés) : mesures de prévention, conditions d'exécution, indicateurs, coût estimé et calendrier."
            : "Liste des actions de prévention établie en application de l'article L4121-3-1 du Code du travail (entreprises de moins de 50 salariés)."}{" "}
          Actions classées par priorité, du risque résiduel le plus élevé au plus faible ; les mesures sont choisies en
          privilégiant la suppression du risque et la protection collective (principes généraux de prévention, article
          L4121-2). Les actions dont l&apos;échéance est dépassée sont signalées.
          {budget > 0 && ` Coût total estimé : ${euros(budget)} HT.`}
        </Text>
        {actions.length === 0 ? (
          <Text style={s.texte}>Aucune action de prévention n&apos;est planifiée.</Text>
        ) : (
          <View style={[s.table, { marginTop: 6 }]}>
            <Entete colonnes={colonnesActions} />
            {actions.map((a) => {
              const l = risqueDe.get(a.risqueId)!;
              const efficacite = efficacites.find((e) => e.valeur === a.efficacite);
              return (
                <View key={a.id} style={s.ligne} wrap={false}>
                  <Cellule largeur="9%"><Niveau score={risqueResiduel(l)} /></Cellule>
                  <Cellule largeur="17%">{[l.unite, l.danger || l.risque].filter(Boolean).join(" : ") || "-"}</Cellule>
                  <View style={[s.td, { width: "23%" }]}>
                    <Text>{a.intitule || "-"}</Text>
                    {a.indicateur ? <Text style={{ color: c.gris, fontSize: 7 }}>Indicateur : {a.indicateur}</Text> : null}
                    {a.ressources ? <Text style={{ color: c.gris, fontSize: 7 }}>Moyens : {a.ressources}</Text> : null}
                  </View>
                  <Cellule largeur="11%">{libellePrincipe(a)}</Cellule>
                  <Cellule largeur="11%">{a.responsable || "-"}</Cellule>
                  <View style={[s.td, { width: "8%" }]}>
                    <Text>{a.echeance ? formaterDate(a.echeance) : "-"}</Text>
                    {actionEnRetard(a, aujourdhui) && <Text style={{ color: "#b42318", fontSize: 7, fontFamily: "Helvetica-Bold" }}>En retard</Text>}
                  </View>
                  <Cellule largeur="7%">{a.cout != null ? euros(a.cout) : "-"}</Cellule>
                  <View style={[s.td, { width: "14%" }]}>
                    <Text>{libelleStatut(a)}{a.statut === "fait" && a.realiseeLe ? ` le ${formaterDate(a.realiseeLe)}` : ""}</Text>
                    {a.statut === "fait" && efficacite ? <Text style={{ color: c.gris, fontSize: 7 }}>{efficacite.libelle}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
        <Pied entreprise={donnees.entreprise} version={version} />
        <BandeauCouleur marque={marque} />
        <MentionFrisk marque={marque} />
      </Page>

      {/* Pénibilité et validation */}
      <Page size="A4" style={s.page}>
        <Titre accent={marque.accent} numero="5" surtitre="Pénibilité" titre="Exposition aux facteurs de risques professionnels" />
        <Text style={s.texte}>
          Situations exposant les salariés à l&apos;un des 10 facteurs de risques professionnels (article L4161-1
          du Code du travail), appréciées après prise en compte des protections collectives et individuelles.
        </Text>
        {penibles.length === 0 ? (
          <Text style={s.texte}>Aucune exposition à un facteur de risques professionnels n&apos;a été identifiée.</Text>
        ) : (
          <View style={[s.table, { marginTop: 6 }]}>
            <Entete
              colonnes={[
                { titre: "Facteur", largeur: "26%" },
                { titre: "Unité / situation", largeur: "36%" },
                { titre: "Salariés", largeur: "12%" },
                { titre: "Seuil réglementaire", largeur: "26%" },
              ]}
            />
            {penibles.map((l) => (
              <View key={l.id} style={s.ligne} wrap={false}>
                <Cellule largeur="26%" gras>{libelleFacteur(l.penibilite)}</Cellule>
                <Cellule largeur="36%">{`${l.unite} : ${l.activite}`}</Cellule>
                <Cellule largeur="12%">{l.effectif}</Cellule>
                <Cellule largeur="26%">{seuilsPenibilite.find((x) => x.valeur === l.seuilPenibilite)?.libelle ?? ""}</Cellule>
              </View>
            ))}
          </View>
        )}

        <View wrap={false}>
          <Text style={[s.h2, { marginTop: 24, color: marque.titre }]}>6 · Validation et suivi des mises à jour</Text>
          <View style={s.table}>
            <Entete
              colonnes={[
                { titre: "Version", largeur: "18%" },
                { titre: "Motif de la mise à jour", largeur: "42%" },
                { titre: "Établi par", largeur: "22%" },
                { titre: "Visa", largeur: "18%" },
              ]}
            />
            {(historique.length
              ? [...historique].sort((a, b) => a.numero - b.numero).map((h) => ({ v: `n° ${h.numero} du ${formaterDate(h.date)}`, motif: h.motif, auteur: h.auteur }))
              : [{ v: formaterDate(aujourdhui), motif: "Document de travail (version non figée)", auteur: fiche?.responsable ?? "" }]
            )
              .concat([{ v: "", motif: "", auteur: "" }, { v: "", motif: "", auteur: "" }])
              .map((ligne, i) => (
                <View key={i} style={[s.ligne, { minHeight: 22 }]} wrap={false}>
                  <Cellule largeur="18%">{ligne.v}</Cellule>
                  <Cellule largeur="42%">{ligne.motif}</Cellule>
                  <Cellule largeur="22%">{ligne.auteur}</Cellule>
                  <Cellule largeur="18%">{""}</Cellule>
                </View>
              ))}
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 18 }}>
            {["L'employeur", "Consultation du CSE (le cas échéant)", "Transmis au service de prévention et de santé au travail"].map((t) => (
              <View key={t} style={{ flex: 1, borderWidth: 0.5, borderColor: c.pierre, padding: 8, height: 92 }}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>{t}</Text>
                <Text style={{ marginTop: 6, fontSize: 7.5, color: c.gris }}>Date :</Text>
                <Text style={{ marginTop: 6, fontSize: 7.5, color: c.gris }}>Nom et signature :</Text>
              </View>
            ))}
          </View>
        </View>
        <Pied entreprise={donnees.entreprise} version={version} />
        <BandeauCouleur marque={marque} />
        <MentionFrisk marque={marque} />
      </Page>
      </CouleurTitres.Provider>
    </Document>
  );
}
