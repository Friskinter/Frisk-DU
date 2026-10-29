// Fiche individuelle de remise des équipements de protection individuelle (EPI), au format PDF.

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formaterDate } from "@/lib/calculs";
import type { Donnees } from "@/lib/types";
import type { Marque } from "@/lib/identite";
import { BandeauCouleur, CouleurTitres, LogoDocument, MentionFrisk } from "./marque";

const c = { encre: "#0c0b0a", ardoise: "#3a3530", gris: "#8a837a", bronze: "#b08d57", marbre: "#ece6dc", pierre: "#d9cfc1", ivoire: "#f7f4ef" };

const s = StyleSheet.create({
  // Pas d'interligne sur la page : il empêche la bibliothèque PDF d'afficher les pieds de page fixes.
  page: { paddingTop: 40, paddingBottom: 54, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9, color: c.encre },
  pied: { position: "absolute", bottom: 22, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: c.gris, borderTopWidth: 0.5, borderTopColor: c.pierre, paddingTop: 6 },
  table: { borderWidth: 0.5, borderColor: c.pierre, borderBottomWidth: 0 },
  ligne: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: c.pierre, alignItems: "center" },
  entete: { flexDirection: "row", backgroundColor: c.marbre, borderBottomWidth: 0.5, borderBottomColor: c.pierre },
  th: { padding: 4, fontFamily: "Helvetica-Bold", fontSize: 7, textTransform: "uppercase", color: c.ardoise },
  td: { padding: 4, fontSize: 8.5, lineHeight: 1.35 },
});

const colonnes = [
  { titre: "Date", largeur: "12%" },
  { titre: "Équipement", largeur: "30%" },
  { titre: "Taille", largeur: "9%" },
  { titre: "Qté", largeur: "7%" },
  { titre: "Motif", largeur: "17%" },
  { titre: "Signature du salarié", largeur: "25%" },
];

export function FicheEpi({
  donnees,
  salarieId,
  aujourdhui,
  marque,
}: {
  donnees: Donnees;
  salarieId: string;
  aujourdhui: string;
  marque: Marque;
}) {
  const salarie = donnees.salaries.find((x) => x.id === salarieId)!;
  const remises = donnees.mouvements
    .filter((m) => m.type === "sortie" && m.salarieId === salarieId)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const nomArticle = (id: string) => donnees.articles.find((a) => a.id === id)?.nom ?? "Article supprimé";
  const tailles = Object.entries(salarie.tailles).filter(([, v]) => v);

  return (
    <Document title={`Fiche EPI - ${salarie.nom}`} author={donnees.entreprise} creator="Frisk Plateforme" producer="Frisk Plateforme" language="fr">
      <CouleurTitres.Provider value={marque.titre}>
      <Page size="A4" style={s.page}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <Text style={{ fontSize: 8, letterSpacing: 2, color: marque.accent, textTransform: "uppercase" }}>{donnees.entreprise}</Text>
            <Text style={{ fontFamily: "Times-Roman", fontSize: 20, lineHeight: 1.2, marginTop: 4, color: marque.titre }}>
              Fiche de remise des équipements de protection individuelle
            </Text>
          </View>
          <LogoDocument marque={marque} style={{ marginLeft: 16 }} />
        </View>

        <View style={[s.table, { marginTop: 18 }]}>
          {[
            ["Salarié", salarie.nom],
            ["Service / poste", [salarie.service, salarie.poste].filter(Boolean).join(" · ")],
            ["Tailles", tailles.map(([k, v]) => `${k} : ${v}`).join(" · ")],
            ["Fiche éditée le", formaterDate(aujourdhui)],
          ].map(([libelle, valeur]) => (
            <View key={libelle} style={s.ligne}>
              <Text style={[s.td, { width: "25%", color: c.gris, backgroundColor: c.ivoire }]}>{libelle}</Text>
              <Text style={[s.td, { width: "75%" }]}>{valeur || "-"}</Text>
            </View>
          ))}
        </View>

        <Text style={{ fontFamily: "Times-Bold", fontSize: 12.5, marginTop: 18, marginBottom: 6 , color: marque.titre }}>Équipements remis</Text>
        <View style={s.table}>
          <View style={s.entete} fixed>
            {colonnes.map((col) => (
              <Text key={col.titre} style={[s.th, { width: col.largeur }]}>{col.titre}</Text>
            ))}
          </View>
          {remises.map((m) => (
            <View key={m.id} style={[s.ligne, { minHeight: 30 }]} wrap={false}>
              <Text style={[s.td, { width: "12%" }]}>{formaterDate(m.date)}</Text>
              <Text style={[s.td, { width: "30%" }]}>{nomArticle(m.articleId)}</Text>
              <Text style={[s.td, { width: "9%" }]}>{m.taille}</Text>
              <Text style={[s.td, { width: "7%" }]}>{m.quantite}</Text>
              <Text style={[s.td, { width: "17%" }]}>{m.motif}</Text>
              <View style={[s.td, { width: "25%", flexDirection: "row", alignItems: "center" }]}>
                {m.signatureId && donnees.signatures?.[m.signatureId] ? (
                  <>
                    {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF, sans attribut alt */}
                    <Image src={donnees.signatures[m.signatureId].image} style={{ height: 22, width: 69 }} />
                    <Text style={{ fontSize: 7, color: c.gris, marginLeft: 4 }}>{formaterDate(donnees.signatures[m.signatureId].date)}</Text>
                  </>
                ) : (
                  <Text style={{ fontSize: 7, color: c.gris }}> </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <View wrap={false} style={{ marginTop: 18 }}>
          <Text style={{ fontFamily: "Times-Bold", fontSize: 12.5, marginBottom: 6 , color: marque.titre }}>Engagement du salarié</Text>
          <Text style={{ color: c.ardoise }}>
            Je reconnais avoir reçu les équipements de protection individuelle mentionnés ci-dessus, adaptés à mon poste et à
            ma taille, et avoir été informé(e) des risques contre lesquels ils me protègent ainsi que de leurs conditions
            d&apos;utilisation et d&apos;entretien. Je m&apos;engage à les porter lorsque mon activité l&apos;exige, à les
            maintenir en bon état et à signaler sans délai toute perte ou détérioration.
          </Text>
          <Text style={{ color: c.gris, fontSize: 7.5, marginTop: 6 }}>
            Mise à disposition des EPI par l&apos;employeur : articles R4323-91 et suivants du Code du travail.
          </Text>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
            {["Le salarié", "Pour l'employeur"].map((t) => (
              <View key={t} style={{ flex: 1, borderWidth: 0.5, borderColor: c.pierre, padding: 8, height: 80 }}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>{t}</Text>
                <Text style={{ marginTop: 6, fontSize: 7.5, color: c.gris }}>Date :</Text>
                <Text style={{ marginTop: 6, fontSize: 7.5, color: c.gris }}>Signature :</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.pied} fixed>
          <Text>{donnees.entreprise} · Fiche EPI · {salarie.nom}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
        <BandeauCouleur marque={marque} />
        <MentionFrisk marque={marque} />
      </Page>
      </CouleurTitres.Provider>
    </Document>
  );
}
