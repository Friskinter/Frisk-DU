// Registre des accidents bénins (articles L441-4 et R441-3 du Code de la sécurité sociale), au format PDF.

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formaterDate } from "@/lib/calculs";
import { nomVictime } from "@/lib/evenements";
import type { Donnees } from "@/lib/types";

const c = { encre: "#0c0b0a", ardoise: "#3a3530", gris: "#8a837a", bronze: "#b08d57", marbre: "#ece6dc", pierre: "#d9cfc1", ivoire: "#f7f4ef" };

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
  { titre: "Date et heure", largeur: "9%" },
  { titre: "Victime", largeur: "12%" },
  { titre: "Lieu et circonstances", largeur: "27%" },
  { titre: "Nature et siège des lésions", largeur: "15%" },
  { titre: "Soins donnés par", largeur: "12%" },
  { titre: "Témoins", largeur: "11%" },
  { titre: "Signatures (soins, victime)", largeur: "14%" },
];

export function RegistreBenins({ donnees, aujourdhui, logo }: { donnees: Donnees; aujourdhui: string; logo: string }) {
  const benins = donnees.evenements
    .filter((e) => e.declaration === "registre")
    .sort((a, b) => `${a.date} ${a.heure}`.localeCompare(`${b.date} ${b.heure}`));

  return (
    <Document title={`Registre des accidents bénins - ${donnees.entreprise}`} author={donnees.entreprise} creator="Frisk DU" producer="Frisk DU" language="fr">
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <Text style={{ fontSize: 8, letterSpacing: 2, color: c.bronze, textTransform: "uppercase" }}>{donnees.entreprise}</Text>
            <Text style={{ fontFamily: "Times-Roman", fontSize: 20, lineHeight: 1.2, marginTop: 4 }}>Registre des accidents bénins</Text>
            <Text style={{ fontSize: 8, color: c.ardoise, marginTop: 4, lineHeight: 1.35 }}>
              {[donnees.fiche?.siret && `SIRET ${donnees.fiche.siret}`, donnees.fiche?.adresse].filter(Boolean).join(" · ")}
            </Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF, sans attribut alt */}
          <Image src={logo} style={{ width: 40, height: 40, marginLeft: 16 }} />
        </View>

        <Text style={{ fontSize: 7.5, color: c.gris, marginTop: 10, marginBottom: 10, lineHeight: 1.35 }}>
          Accidents du travail n&apos;ayant entraîné ni arrêt de travail ni soins médicaux (articles L441-4 et R441-3 du Code
          de la sécurité sociale). Si l&apos;accident entraîne ensuite un arrêt ou des soins médicaux, il doit être déclaré à
          la CPAM dans les 48 heures. Le registre est tenu à la disposition des agents de contrôle et de la CPAM.
        </Text>

        <View style={s.table}>
          <View style={s.entete} fixed>
            {colonnes.map((col) => (
              <Text key={col.titre} style={[s.th, { width: col.largeur }]}>{col.titre}</Text>
            ))}
          </View>
          {benins.map((e) => (
            <View key={e.id} style={[s.ligne, { minHeight: 34 }]} wrap={false}>
              <Text style={[s.td, { width: "9%" }]}>{formaterDate(e.date)}{e.heure ? `\n${e.heure}` : ""}</Text>
              <Text style={[s.td, { width: "12%" }]}>{nomVictime(e, donnees)}</Text>
              <Text style={[s.td, { width: "27%" }]}>{[e.lieu || e.unite, e.description].filter(Boolean).join(" : ")}</Text>
              <Text style={[s.td, { width: "15%" }]}>{e.lesions}</Text>
              <Text style={[s.td, { width: "12%" }]}>{e.secouriste}</Text>
              <Text style={[s.td, { width: "11%" }]}>{e.temoins}</Text>
              <Text style={[s.td, { width: "14%" }]}> </Text>
            </View>
          ))}
        </View>

        <View style={s.pied} fixed>
          <Text>{donnees.entreprise} · Registre des accidents bénins · édité le {formaterDate(aujourdhui)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
