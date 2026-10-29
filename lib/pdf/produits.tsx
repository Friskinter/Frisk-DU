// Inventaire des produits chimiques et notices de poste, au format PDF.

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formaterDate } from "@/lib/calculs";
import { classementCmr, etatFds, etatsFds, libelleMention, pictogrammesDe } from "@/lib/produits";
import type { Donnees, Produit } from "@/lib/types";
import type { Marque } from "@/lib/identite";
import { LogoDocument, MentionFrisk } from "./marque";

const c = { encre: "#0c0b0a", ardoise: "#3a3530", gris: "#8a837a", bronze: "#b08d57", marbre: "#ece6dc", pierre: "#d9cfc1", ivoire: "#f7f4ef", rouge: "#b42318" };

const s = StyleSheet.create({
  // Pas d'interligne sur la page : il empêche la bibliothèque PDF d'afficher les pieds de page fixes.
  page: { paddingTop: 32, paddingBottom: 50, paddingHorizontal: 32, fontFamily: "Helvetica", fontSize: 9, color: c.encre },
  pied: { position: "absolute", bottom: 20, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: c.gris, borderTopWidth: 0.5, borderTopColor: c.pierre, paddingTop: 6 },
  table: { borderWidth: 0.5, borderColor: c.pierre, borderBottomWidth: 0 },
  ligne: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: c.pierre },
  entete: { flexDirection: "row", backgroundColor: c.marbre, borderBottomWidth: 0.5, borderBottomColor: c.pierre },
  th: { padding: 4, fontFamily: "Helvetica-Bold", fontSize: 7, textTransform: "uppercase", color: c.ardoise },
  td: { padding: 4, fontSize: 8, lineHeight: 1.35 },
  texte: { fontSize: 9, lineHeight: 1.4 },
});

function EnTete({ entreprise, titre, sousTitre, marque }: { entreprise: string; titre: string; sousTitre: string; marque: Marque }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 8, letterSpacing: 2, color: marque.accent, textTransform: "uppercase" }}>{entreprise}</Text>
        <Text style={{ fontFamily: "Times-Roman", fontSize: 20, lineHeight: 1.2, marginTop: 4 }}>{titre}</Text>
        <Text style={{ fontSize: 8, color: c.ardoise, marginTop: 4, lineHeight: 1.35 }}>{sousTitre}</Text>
      </View>
      <LogoDocument marque={marque} style={{ marginLeft: 16 }} />
    </View>
  );
}

const cmrTexte = (p: Produit) => {
  const cmr = classementCmr(p);
  return cmr ? `${cmr.categorie === 1 ? "CMR" : "CMR suspecté"} (${cmr.effets.join(", ")})` : "";
};

const colonnes = [
  { titre: "Produit", largeur: "20%" },
  { titre: "Unité · stockage", largeur: "15%" },
  { titre: "Qté / an", largeur: "7%" },
  { titre: "Dangers", largeur: "20%" },
  { titre: "Mentions H", largeur: "12%" },
  { titre: "FDS", largeur: "10%" },
  { titre: "Exposés", largeur: "16%" },
];

export function InventaireProduits({ donnees, aujourdhui, marque }: { donnees: Donnees; aujourdhui: string; marque: Marque }) {
  const produits = donnees.produits.filter((p) => p.actif).sort((a, b) => a.unite.localeCompare(b.unite, "fr") || a.nom.localeCompare(b.nom, "fr"));
  const nom = (id: string) => donnees.salaries.find((x) => x.id === id)?.nom ?? "";
  return (
    <Document title={`Inventaire des produits chimiques - ${donnees.entreprise}`} author={donnees.entreprise} creator="Frisk DU" producer="Frisk DU" language="fr">
      <Page size="A4" orientation="landscape" style={s.page}>
        <EnTete
          entreprise={donnees.entreprise}
          titre="Inventaire des produits chimiques"
          sousTitre={`Situation au ${formaterDate(aujourdhui)}. Évaluation du risque chimique : art. R4412-5 et suivants du Code du travail ; fiches de données de sécurité tenues à disposition des salariés.`}
          marque={marque}
        />
        <View style={[s.table, { marginTop: 14 }]}>
          <View style={s.entete} fixed>
            {colonnes.map((col) => (
              <Text key={col.titre} style={[s.th, { width: col.largeur }]}>{col.titre}</Text>
            ))}
          </View>
          {produits.length === 0 && <Text style={[s.td, { color: c.gris }]}>Aucun produit enregistré.</Text>}
          {produits.map((p) => {
            const fds = etatFds(p, aujourdhui);
            return (
              <View key={p.id} style={s.ligne} wrap={false}>
                <Text style={[s.td, { width: "20%" }]}>{p.nom}{p.fournisseur ? `\n${p.fournisseur}` : ""}</Text>
                <Text style={[s.td, { width: "15%" }]}>{[p.unite, p.stockage].filter(Boolean).join("\n")}</Text>
                <Text style={[s.td, { width: "7%" }]}>{p.quantite}</Text>
                <Text style={[s.td, { width: "20%" }]}>
                  {pictogrammesDe(p.mentionsH).map((x) => x.libelle).join(", ") || "-"}
                  {cmrTexte(p) ? `\n` : ""}
                  {cmrTexte(p) && <Text style={{ fontFamily: "Helvetica-Bold", color: c.rouge }}>{cmrTexte(p)}</Text>}
                </Text>
                <Text style={[s.td, { width: "12%" }]}>{p.mentionsH.join(" ") || "-"}</Text>
                <Text style={[s.td, { width: "10%", color: fds === "a-jour" ? c.encre : c.rouge }]}>
                  {p.fdsDate ? formaterDate(p.fdsDate) : etatsFds[fds].libelle}
                </Text>
                <Text style={[s.td, { width: "16%" }]}>{p.salariesExposes.map(nom).filter(Boolean).join(", ") || "-"}</Text>
              </View>
            );
          })}
        </View>
        <View style={s.pied} fixed>
          <Text>{donnees.entreprise} · Inventaire des produits chimiques · édité le {formaterDate(aujourdhui)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
        <MentionFrisk marque={marque} />
      </Page>
    </Document>
  );
}

// Une notice par unité de travail, à afficher près du lieu d'utilisation (art. R4412-39).
export function NoticesDePoste({ donnees, aujourdhui, marque }: { donnees: Donnees; aujourdhui: string; marque: Marque }) {
  const produits = donnees.produits.filter((p) => p.actif);
  const unites = [...new Set(produits.map((p) => p.unite || "Unité non précisée"))].sort((a, b) => a.localeCompare(b, "fr"));
  return (
    <Document title={`Notices de poste - ${donnees.entreprise}`} author={donnees.entreprise} creator="Frisk DU" producer="Frisk DU" language="fr">
      {unites.map((unite) => (
        <Page key={unite} size="A4" style={s.page}>
          <EnTete
            entreprise={donnees.entreprise}
            titre={`Notice de poste · ${unite}`}
            sousTitre="Produits chimiques utilisés à ce poste : dangers, protections et conduite à tenir. À afficher près du lieu d'utilisation."
            marque={marque}
          />
          {produits
            .filter((p) => (p.unite || "Unité non précisée") === unite)
            .map((p) => (
              <View key={p.id} wrap={false} style={{ marginTop: 12, borderWidth: 0.5, borderColor: c.pierre, padding: 10 }}>
                <Text style={{ fontFamily: "Times-Bold", fontSize: 13 }}>{p.nom || "Produit sans nom"}</Text>
                {p.usage ? <Text style={[s.texte, { color: c.ardoise }]}>{p.usage}</Text> : null}
                {cmrTexte(p) ? (
                  <Text style={[s.texte, { marginTop: 4, fontFamily: "Helvetica-Bold", color: c.rouge }]}>
                    {cmrTexte(p)} : exposition à réduire au minimum, suivi médical renforcé.
                  </Text>
                ) : null}
                <Text style={[s.texte, { marginTop: 6, fontFamily: "Helvetica-Bold" }]}>Dangers</Text>
                <Text style={s.texte}>
                  {p.mentionsH.length ? p.mentionsH.map(libelleMention).join("\n") : "Produit non classé dangereux (selon la FDS)."}
                </Text>
                <Text style={[s.texte, { marginTop: 6, fontFamily: "Helvetica-Bold" }]}>Protections obligatoires</Text>
                <Text style={s.texte}>{p.epi || "À préciser par le responsable."}</Text>
                {p.consignes ? (
                  <>
                    <Text style={[s.texte, { marginTop: 6, fontFamily: "Helvetica-Bold" }]}>Consignes</Text>
                    <Text style={s.texte}>{p.consignes}</Text>
                  </>
                ) : null}
                {p.stockage ? <Text style={[s.texte, { marginTop: 6, color: c.ardoise }]}>Stockage : {p.stockage}</Text> : null}
              </View>
            ))}
          <View wrap={false} style={{ marginTop: 14, backgroundColor: c.ivoire, padding: 10 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10 }}>En cas d&apos;accident</Text>
            <Text style={s.texte}>
              Éloigner la victime, prévenir le sauveteur secouriste du travail et appeler le 15 (SAMU) ou le 112. Projection dans les yeux :
              rincer 15 minutes à l&apos;eau claire. Présenter la fiche de données de sécurité aux secours. Centre antipoison : voir la rubrique 1
              de la FDS.
            </Text>
          </View>
          <View style={s.pied} fixed>
            <Text>{donnees.entreprise} · Notice de poste · {unite} · {formaterDate(aujourdhui)}</Text>
            <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
          </View>
          <MentionFrisk marque={marque} />
      </Page>
      ))}
    </Document>
  );
}
