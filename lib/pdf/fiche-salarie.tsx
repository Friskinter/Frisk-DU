// Fiche individuelle d'un salarié au format PDF : à remettre au salarié ou à présenter lors d'un contrôle.

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { etatsAccueil } from "@/lib/accueils";
import { formaterDate, niveauDe, risqueResiduel } from "@/lib/calculs";
import { etatsFormation, libelleFormation, typeFormation } from "@/lib/formations";
import { facteursPenibilite, typesEvenement } from "@/lib/referentiel";
import type { FicheSalarie } from "@/lib/salarie";
import type { Marque } from "@/lib/identite";
import { BandeauCouleur, CouleurTitres, LogoDocument, MentionFrisk } from "./marque";

const c = { encre: "#0c0b0a", ardoise: "#3a3530", gris: "#8a837a", marbre: "#ece6dc", pierre: "#d9cfc1", ivoire: "#f7f4ef" };

const s = StyleSheet.create({
  // Pas d'interligne sur la page : il empêche la bibliothèque PDF d'afficher les pieds de page fixes.
  page: { paddingTop: 40, paddingBottom: 54, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9, color: c.encre },
  pied: { position: "absolute", bottom: 22, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: c.gris, borderTopWidth: 0.5, borderTopColor: c.pierre, paddingTop: 6 },
  table: { borderWidth: 0.5, borderColor: c.pierre, borderBottomWidth: 0 },
  ligne: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: c.pierre },
  entete: { flexDirection: "row", backgroundColor: c.marbre, borderBottomWidth: 0.5, borderBottomColor: c.pierre },
  th: { padding: 4, fontFamily: "Helvetica-Bold", fontSize: 7, textTransform: "uppercase", color: c.ardoise },
  td: { padding: 4, fontSize: 8.5, lineHeight: 1.35 },
  vide: { color: c.gris, fontSize: 8.5 },
});

type Colonne = { titre: string; largeur: string };

function Section({ titre, couleur, children }: { titre: string; couleur: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ fontFamily: "Times-Bold", fontSize: 12.5, marginBottom: 6, color: couleur }} minPresenceAhead={40}>
        {titre}
      </Text>
      {children}
    </View>
  );
}

function Tableau({ colonnes, lignes, vide }: { colonnes: Colonne[]; lignes: string[][]; vide: string }) {
  if (!lignes.length) return <Text style={s.vide}>{vide}</Text>;
  return (
    <View style={s.table}>
      <View style={s.entete} fixed>
        {colonnes.map((col) => (
          <Text key={col.titre} style={[s.th, { width: col.largeur }]}>{col.titre}</Text>
        ))}
      </View>
      {lignes.map((ligne, i) => (
        <View key={i} style={s.ligne} wrap={false}>
          {ligne.map((cellule, j) => (
            <Text key={j} style={[s.td, { width: colonnes[j].largeur }]}>{cellule || "-"}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function FicheSalariePdf({
  entreprise,
  fiche: f,
  aujourdhui,
  marque,
}: {
  entreprise: string;
  fiche: FicheSalarie;
  aujourdhui: string;
  marque: Marque;
}) {
  const { salarie } = f;
  const tailles = Object.entries(salarie.tailles).filter(([, v]) => v);
  const libelleType = (t: string) => typesEvenement.find((x) => x.valeur === t)?.libelle ?? t;
  const libelleFacteur = (code: string) => facteursPenibilite.find((x) => x.code === code)?.libelle ?? code;

  return (
    <Document title={`Fiche salarié - ${salarie.nom}`} author={entreprise} creator="Frisk Plateforme" producer="Frisk Plateforme" language="fr">
      <CouleurTitres.Provider value={marque.titre}>
        <Page size="A4" style={s.page}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View>
              <Text style={{ fontSize: 8, letterSpacing: 2, color: marque.accent, textTransform: "uppercase" }}>{entreprise}</Text>
              <Text style={{ fontFamily: "Times-Roman", fontSize: 20, lineHeight: 1.2, marginTop: 4, color: marque.titre }}>
                Fiche prévention du salarié
              </Text>
            </View>
            <LogoDocument marque={marque} style={{ marginLeft: 16 }} />
          </View>

          <View style={[s.table, { marginTop: 18 }]}>
            {[
              ["Salarié", salarie.nom],
              ["Service / poste", [salarie.service, salarie.poste].filter(Boolean).join(" · ")],
              ["Unité de travail", f.unite],
              ["Tailles", tailles.map(([k, v]) => `${k} : ${v}`).join(" · ")],
              ["Fiche éditée le", formaterDate(aujourdhui)],
            ].map(([libelle, valeur]) => (
              <View key={libelle} style={s.ligne}>
                <Text style={[s.td, { width: "25%", color: c.gris, backgroundColor: c.ivoire }]}>{libelle}</Text>
                <Text style={[s.td, { width: "75%" }]}>{valeur || "-"}</Text>
              </View>
            ))}
          </View>

          {f.pointsAttention.length > 0 && (
            <Section titre="Points d'attention" couleur={marque.titre}>
              {f.pointsAttention.map((p) => (
                <Text key={p} style={{ fontSize: 8.5, marginBottom: 2 }}>• {p}</Text>
              ))}
            </Section>
          )}

          <Section titre="Formations et habilitations" couleur={marque.titre}>
            <Tableau
              colonnes={[{ titre: "Formation", largeur: "40%" }, { titre: "Obtenue le", largeur: "15%" }, { titre: "Valable jusqu'au", largeur: "17%" }, { titre: "État", largeur: "28%" }]}
              lignes={[
                ...f.formations.map(({ formation: x, etat }) => [
                  [libelleFormation(x), x.type !== "autre" ? x.intitule : ""].filter(Boolean).join(" · "),
                  formaterDate(x.obtenueLe),
                  x.expireLe ? formaterDate(x.expireLe) : "Sans limite",
                  etatsFormation[etat].libelle,
                ]),
                ...f.manquantes.filter((m) => !m.expiree).map((m) => [typeFormation(m.type).libelle, "", "", "Exigée pour le poste, non suivie"]),
              ]}
              vide="Aucune formation enregistrée."
            />
          </Section>

          <Section titre="Équipements de protection individuelle remis" couleur={marque.titre}>
            <Tableau
              colonnes={[{ titre: "Date", largeur: "15%" }, { titre: "Équipement", largeur: "45%" }, { titre: "Taille", largeur: "10%" }, { titre: "Qté", largeur: "10%" }, { titre: "Signée", largeur: "20%" }]}
              lignes={f.remises.map((r) => [formaterDate(r.mouvement.date), r.article, r.mouvement.taille, String(r.mouvement.quantite), r.signee ? "Oui" : "Non"])}
              vide="Aucun équipement remis."
            />
          </Section>

          <Section titre="Accueil sécurité et causeries" couleur={marque.titre}>
            <Text style={{ fontSize: 8.5, marginBottom: 4 }}>
              Accueil sécurité :{" "}
              {f.accueil
                ? `${etatsAccueil[f.accueil.etat].libelle}${f.accueil.accueil.accueilLe ? `, le ${formaterDate(f.accueil.accueil.accueilLe)}` : ""}`
                : "non enregistré"}
            </Text>
            <Tableau
              colonnes={[{ titre: "Date", largeur: "15%" }, { titre: "Thème de la causerie", largeur: "60%" }, { titre: "Animée par", largeur: "25%" }]}
              lignes={f.causeries.map((x) => [formaterDate(x.date), x.theme, x.animateur])}
              vide="Aucune causerie suivie."
            />
          </Section>

          <Section titre="Expositions" couleur={marque.titre}>
            <Tableau
              colonnes={[{ titre: "Risque de son unité", largeur: "55%" }, { titre: "Niveau", largeur: "20%" }, { titre: "Pénibilité", largeur: "25%" }]}
              lignes={f.risques.map((l) => [
                [l.danger, l.risque].filter(Boolean).join(" : "),
                niveauDe(risqueResiduel(l)).libelle,
                l.penibilite && l.seuilPenibilite === "oui" ? `${libelleFacteur(l.penibilite)} (seuil dépassé)` : "",
              ])}
              vide={f.unite ? "Aucun risque enregistré pour son unité." : "Unité de travail inconnue : renseignez-la dans son accueil sécurité."}
            />
            {f.produits.length > 0 && (
              <Text style={{ fontSize: 8.5, marginTop: 6 }}>Produits chimiques utilisés : {f.produits.map((p) => p.nom).join(", ")}</Text>
            )}
          </Section>

          <Section titre="Accidents et presque-accidents" couleur={marque.titre}>
            <Tableau
              colonnes={[{ titre: "Date", largeur: "15%" }, { titre: "Type", largeur: "25%" }, { titre: "Circonstances", largeur: "45%" }, { titre: "Arrêt", largeur: "15%" }]}
              lignes={f.evenements.map((e) => [formaterDate(e.date), libelleType(e.type), e.description, e.joursArret ? `${e.joursArret} j` : ""])}
              vide="Aucun accident ni presque-accident."
            />
          </Section>

          <View style={s.pied} fixed>
            <Text>{entreprise} · Fiche salarié · {salarie.nom}</Text>
            <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
          </View>
          <BandeauCouleur marque={marque} />
          <MentionFrisk marque={marque} />
        </Page>
      </CouleurTitres.Provider>
    </Document>
  );
}
