// Registre de sécurité : état des vérifications périodiques des équipements, au format PDF.

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formaterDate } from "@/lib/calculs";
import type { Donnees } from "@/lib/types";
import {
  derniereVerification,
  etatEquipement,
  etatsEquipement,
  familles,
  observationLevee,
  resultats,
  typeEquipement,
} from "@/lib/verifications";

const c = { encre: "#0c0b0a", ardoise: "#3a3530", gris: "#8a837a", bronze: "#b08d57", marbre: "#ece6dc", pierre: "#d9cfc1", ivoire: "#f7f4ef", rouge: "#b42318" };

const s = StyleSheet.create({
  // Pas d'interligne sur la page : il empêche la bibliothèque PDF d'afficher les pieds de page fixes.
  page: { paddingTop: 32, paddingBottom: 50, paddingHorizontal: 32, fontFamily: "Helvetica", fontSize: 9, color: c.encre },
  pied: { position: "absolute", bottom: 20, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: c.gris, borderTopWidth: 0.5, borderTopColor: c.pierre, paddingTop: 6 },
  table: { borderWidth: 0.5, borderColor: c.pierre, borderBottomWidth: 0 },
  ligne: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: c.pierre },
  entete: { flexDirection: "row", backgroundColor: c.marbre, borderBottomWidth: 0.5, borderBottomColor: c.pierre },
  th: { padding: 4, fontFamily: "Helvetica-Bold", fontSize: 7, textTransform: "uppercase", color: c.ardoise },
  td: { padding: 4, fontSize: 8.5, lineHeight: 1.35 },
});

const colonnes = [
  { titre: "Équipement", largeur: "24%" },
  { titre: "Périodicité", largeur: "8%" },
  { titre: "Dernière vérification", largeur: "17%" },
  { titre: "Résultat", largeur: "10%" },
  { titre: "Prochaine", largeur: "11%" },
  { titre: "Observations non levées", largeur: "30%" },
];

export function RegistreSecurite({ donnees, aujourdhui, logo }: { donnees: Donnees; aujourdhui: string; logo: string }) {
  return (
    <Document title={`Registre de sécurité - ${donnees.entreprise}`} author={donnees.entreprise} creator="Frisk DU" producer="Frisk DU" language="fr">
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <Text style={{ fontSize: 8, letterSpacing: 2, color: c.bronze, textTransform: "uppercase" }}>{donnees.entreprise}</Text>
            <Text style={{ fontFamily: "Times-Roman", fontSize: 20, lineHeight: 1.2, marginTop: 4 }}>Registre de sécurité · vérifications périodiques</Text>
            <Text style={{ fontSize: 8, color: c.ardoise, marginTop: 4 }}>
              Situation au {formaterDate(aujourdhui)}. Les rapports de vérification sont conservés dans Frisk DU et tenus à la disposition de
              l&apos;inspection du travail (art. D4711-3 du Code du travail).
            </Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF, sans attribut alt */}
          <Image src={logo} style={{ width: 40, height: 40, marginLeft: 16 }} />
        </View>

        {donnees.equipements.length === 0 && <Text style={{ marginTop: 18, color: c.gris }}>Aucun équipement suivi.</Text>}
        {familles.map((f) => {
          const equipements = donnees.equipements.filter((e) => typeEquipement(e.type).famille === f.valeur);
          if (!equipements.length) return null;
          return (
            <View key={f.valeur} style={{ marginTop: 14 }}>
              <Text style={{ fontFamily: "Times-Bold", fontSize: 12, marginBottom: 4 }}>{f.libelle}</Text>
              <View style={s.table}>
                <View style={s.entete} fixed>
                  {colonnes.map((col) => (
                    <Text key={col.titre} style={[s.th, { width: col.largeur }]}>{col.titre}</Text>
                  ))}
                </View>
                {equipements.map((e) => {
                  const v = derniereVerification(donnees.verifications, e.id);
                  const etat = etatEquipement(donnees.verifications, e, aujourdhui);
                  const ouvertes = (v?.observations ?? []).filter((o) => o.texte.trim() && !observationLevee(o, donnees.actions));
                  return (
                    <View key={e.id} style={s.ligne} wrap={false}>
                      <Text style={[s.td, { width: "24%" }]}>
                        {e.nom || typeEquipement(e.type).libelle}
                        {[e.localisation, e.reference].filter(Boolean).length ? `\n${[e.localisation, e.reference].filter(Boolean).join(" · ")}` : ""}
                      </Text>
                      <Text style={[s.td, { width: "8%" }]}>{e.periodicite} mois</Text>
                      <Text style={[s.td, { width: "17%" }]}>{v ? `${formaterDate(v.date)}${v.prestataire ? `\n${v.prestataire}` : ""}` : "Jamais vérifié"}</Text>
                      <Text style={[s.td, { width: "10%", color: v?.resultat === "non-conforme" ? c.rouge : c.encre }]}>
                        {v ? resultats.find((r) => r.valeur === v.resultat)?.libelle : "-"}
                      </Text>
                      <Text style={[s.td, { width: "11%", color: etat === "en-retard" || etat === "jamais" ? c.rouge : c.encre }]}>
                        {v?.prochaine ? formaterDate(v.prochaine) : "-"}
                        {etat === "en-retard" || etat === "jamais" ? `\n${etatsEquipement[etat].libelle}` : ""}
                      </Text>
                      <Text style={[s.td, { width: "30%" }]}>{ouvertes.map((o) => `• ${o.texte}`).join("\n") || "-"}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        <View style={s.pied} fixed>
          <Text>{donnees.entreprise} · Registre de sécurité · édité le {formaterDate(aujourdhui)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
