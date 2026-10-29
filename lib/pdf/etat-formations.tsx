// État des formations et habilitations par salarié, au format PDF (utile lors d'un contrôle).

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formaterDate } from "@/lib/calculs";
import { etatFormation, etatsFormation, formationsEnVigueur, formationsManquantes, libelleFormation, typeFormation } from "@/lib/formations";
import type { Donnees } from "@/lib/types";
import type { Marque } from "@/lib/identite";
import { BandeauCouleur, CouleurTitres, LogoDocument, MentionFrisk } from "./marque";

const c = { encre: "#0c0b0a", ardoise: "#3a3530", gris: "#8a837a", bronze: "#b08d57", marbre: "#ece6dc", pierre: "#d9cfc1", ivoire: "#f7f4ef", rouge: "#b42318" };

const s = StyleSheet.create({
  // Pas d'interligne sur la page : il empêche la bibliothèque PDF d'afficher les pieds de page fixes.
  page: { paddingTop: 40, paddingBottom: 54, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9, color: c.encre },
  pied: { position: "absolute", bottom: 22, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: c.gris, borderTopWidth: 0.5, borderTopColor: c.pierre, paddingTop: 6 },
  table: { borderWidth: 0.5, borderColor: c.pierre, borderBottomWidth: 0 },
  ligne: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: c.pierre },
  entete: { flexDirection: "row", backgroundColor: c.marbre, borderBottomWidth: 0.5, borderBottomColor: c.pierre },
  th: { padding: 4, fontFamily: "Helvetica-Bold", fontSize: 7, textTransform: "uppercase", color: c.ardoise },
  td: { padding: 4, fontSize: 8.5, lineHeight: 1.35 },
});

const colonnes = [
  { titre: "Formation", largeur: "38%" },
  { titre: "Obtenue le", largeur: "13%" },
  { titre: "Expire le", largeur: "13%" },
  { titre: "État", largeur: "14%" },
  { titre: "Organisme", largeur: "22%" },
];

export function EtatFormations({ donnees, aujourdhui, marque }: { donnees: Donnees; aujourdhui: string; marque: Marque }) {
  const enVigueur = formationsEnVigueur(donnees.formations);
  const manquantes = formationsManquantes(donnees, aujourdhui).filter((m) => !m.expiree);
  const salaries = [...donnees.salaries]
    .sort((a, b) => a.service.localeCompare(b.service, "fr") || a.nom.localeCompare(b.nom, "fr"))
    .map((salarie) => ({
      salarie,
      formations: enVigueur.filter((f) => f.salarieId === salarie.id).sort((a, b) => libelleFormation(a).localeCompare(libelleFormation(b), "fr")),
      manquantes: manquantes.filter((m) => m.salarie.id === salarie.id),
    }))
    .filter((x) => x.formations.length || x.manquantes.length);

  return (
    <Document title={`Formations et habilitations - ${donnees.entreprise}`} author={donnees.entreprise} creator="Frisk Plateforme" producer="Frisk Plateforme" language="fr">
      <CouleurTitres.Provider value={marque.titre}>
      <Page size="A4" style={s.page}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <Text style={{ fontSize: 8, letterSpacing: 2, color: marque.accent, textTransform: "uppercase" }}>{donnees.entreprise}</Text>
            <Text style={{ fontFamily: "Times-Roman", fontSize: 20, lineHeight: 1.2, marginTop: 4, color: marque.titre }}>État des formations et habilitations</Text>
            <Text style={{ fontSize: 8, color: c.ardoise, marginTop: 4 }}>Situation au {formaterDate(aujourdhui)} · dernière session suivie pour chaque formation</Text>
          </View>
          <LogoDocument marque={marque} style={{ marginLeft: 16 }} />
        </View>

        {salaries.length === 0 && <Text style={{ marginTop: 18, color: c.gris }}>Aucune formation enregistrée.</Text>}
        {salaries.map(({ salarie, formations, manquantes: aFaire }) => (
          <View key={salarie.id} style={{ marginTop: 14 }} wrap={false}>
            <Text style={{ fontFamily: "Times-Bold", fontSize: 12, marginBottom: 4 , color: marque.titre }}>
              {salarie.nom || "Salarié sans nom"}
              <Text style={{ fontFamily: "Helvetica", fontSize: 8, color: c.gris }}>
                {"  "}
                {[salarie.service, salarie.poste].filter(Boolean).join(" · ")}
              </Text>
            </Text>
            <View style={s.table}>
              <View style={s.entete}>
                {colonnes.map((col) => (
                  <Text key={col.titre} style={[s.th, { width: col.largeur }]}>{col.titre}</Text>
                ))}
              </View>
              {formations.map((f) => {
                const etat = etatFormation(f, aujourdhui);
                return (
                  <View key={f.id} style={s.ligne}>
                    <Text style={[s.td, { width: "38%" }]}>
                      {libelleFormation(f)}
                      {f.type !== "autre" && f.intitule ? ` (${f.intitule})` : ""}
                    </Text>
                    <Text style={[s.td, { width: "13%" }]}>{formaterDate(f.obtenueLe)}</Text>
                    <Text style={[s.td, { width: "13%" }]}>{formaterDate(f.expireLe) || "-"}</Text>
                    <Text style={[s.td, { width: "14%", color: etat === "expiree" ? c.rouge : c.encre }]}>{etatsFormation[etat].libelle}</Text>
                    <Text style={[s.td, { width: "22%" }]}>{f.organisme}</Text>
                  </View>
                );
              })}
              {aFaire.map((m) => (
                <View key={m.type} style={s.ligne}>
                  <Text style={[s.td, { width: "38%" }]}>{typeFormation(m.type).libelle}</Text>
                  <Text style={[s.td, { width: "62%", color: c.rouge }]}>Exigée pour le poste, non suivie</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={s.pied} fixed>
          <Text>{donnees.entreprise} · Formations et habilitations · édité le {formaterDate(aujourdhui)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
        <BandeauCouleur marque={marque} />
        <MentionFrisk marque={marque} />
      </Page>
      </CouleurTitres.Provider>
    </Document>
  );
}
