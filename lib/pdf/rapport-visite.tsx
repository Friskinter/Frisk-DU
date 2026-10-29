// Rapport d'une visite ou d'un audit terrain, au format PDF.

import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { formaterDate } from "@/lib/calculs";
import { statutsAction } from "@/lib/referentiel";
import type { Donnees, Visite } from "@/lib/types";
import { bilanVisite, grouperParTheme, resultatsPoint } from "@/lib/visites";
import { Champ, Section, c, s } from "./plan-prevention";

const couleurResultat = { conforme: "#0b6b0b", "non-conforme": c.rouge, "sans-objet": c.gris, "": c.gris };

export function RapportVisite({ donnees, visite: v, aujourdhui, logo }: { donnees: Donnees; visite: Visite; aujourdhui: string; logo: string }) {
  const bilan = bilanVisite(v);
  const action = (id?: string) => (id ? donnees.actions.find((a) => a.id === id) : undefined);
  const nonConformes = v.reponses.filter((r) => r.resultat === "non-conforme");
  return (
    <Document title={`Visite - ${v.grille} - ${v.date}`} author={donnees.entreprise} creator="Frisk DU" producer="Frisk DU" language="fr">
      <Page size="A4" style={s.page}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8, letterSpacing: 2, color: c.bronze, textTransform: "uppercase" }}>{donnees.entreprise}</Text>
            <Text style={{ fontFamily: "Times-Roman", fontSize: 20, lineHeight: 1.2, marginTop: 4 }}>Rapport de visite</Text>
            <Text style={{ fontSize: 10, marginTop: 2 }}>{v.grille}{v.unite ? ` · ${v.unite}` : ""}</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF, sans attribut alt */}
          <Image src={logo} style={{ width: 40, height: 40, marginLeft: 16 }} />
        </View>

        <Section titre="1. La visite">
          <Champ cle="Date">{formaterDate(v.date)}{v.clotureeLe ? "" : " (visite en cours)"}</Champ>
          <Champ cle="Lieu">{v.unite}</Champ>
          <Champ cle="Réalisée par">{v.auditeur}</Champ>
          <Champ cle="Participants">{v.participants}</Champ>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
            {[
              { libelle: "Taux de conformité", valeur: bilan.taux === null ? "-" : `${bilan.taux} %` },
              { libelle: "Conformes", valeur: String(bilan.conformes) },
              { libelle: "Non conformes", valeur: String(bilan.nonConformes) },
              { libelle: "Sans objet", valeur: String(bilan.sansObjet) },
              ...(bilan.restants ? [{ libelle: "Non évalués", valeur: String(bilan.restants) }] : []),
            ].map((x) => (
              <View key={x.libelle} style={{ flex: 1, borderWidth: 0.5, borderColor: c.pierre, padding: 6 }}>
                <Text style={{ fontSize: 7, color: c.gris, textTransform: "uppercase" }}>{x.libelle}</Text>
                <Text style={{ fontSize: 14, marginTop: 2 }}>{x.valeur}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section titre="2. Points contrôlés">
          {grouperParTheme(v.reponses).map(({ theme, elements }) => (
            <View key={theme} style={{ marginBottom: 6 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 2 }} minPresenceAhead={30}>{theme}</Text>
              <View style={s.table}>
                {elements.map((r) => (
                  <View key={r.id} style={s.ligne} wrap={false}>
                    <Text style={[s.td, { width: "52%" }]}>{r.question}</Text>
                    <Text style={[s.td, { width: "14%", color: couleurResultat[r.resultat] }]}>
                      {resultatsPoint.find((x) => x.valeur === r.resultat)?.libelle ?? "Non évalué"}
                    </Text>
                    <Text style={[s.td, { width: "34%" }]}>{[r.commentaire, r.photo ? "(photo jointe)" : ""].filter(Boolean).join(" ") || "-"}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </Section>

        {nonConformes.length > 0 && (
          <View style={{ marginTop: 14 }}>
            {nonConformes.map((r, n) => {
              const a = action(r.actionId);
              const ligne = (
                <View style={s.ligne} wrap={false}>
                  <Text style={[s.td, { width: "30%" }]}>{r.question}{r.commentaire ? `\n${r.commentaire}` : ""}</Text>
                  <Text style={[s.td, { width: "30%", color: a ? c.encre : c.rouge }]}>{a?.intitule || "Aucune action"}</Text>
                  <Text style={[s.td, { width: "16%" }]}>{a?.responsable || "-"}</Text>
                  <Text style={[s.td, { width: "11%" }]}>{a?.echeance ? formaterDate(a.echeance) : "-"}</Text>
                  <Text style={[s.td, { width: "13%" }]}>{a ? statutsAction.find((x) => x.valeur === a.statut)?.libelle : "-"}</Text>
                </View>
              );
              // Le titre et l'en-tête du tableau restent sur la même page que la première ligne.
              return n === 0 ? (
                <View key={r.id} wrap={false}>
                  <Text style={[s.titreSection, { marginTop: 0 }]}>3. Non-conformités et actions</Text>
                  <View style={[s.entete, { borderWidth: 0.5, borderColor: c.pierre }]}>
                    {["Non-conformité", "Action", "Responsable", "Échéance", "Statut"].map((t, i) => (
                      <Text key={t} style={[s.th, { width: ["30%", "30%", "16%", "11%", "13%"][i] }]}>{t}</Text>
                    ))}
                  </View>
                  <View style={{ borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: c.pierre }}>{ligne}</View>
                </View>
              ) : (
                <View key={r.id} style={{ borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: c.pierre }}>{ligne}</View>
              );
            })}
          </View>
        )}

        <View wrap={false}>
          <Text style={s.titreSection}>{nonConformes.length ? "4" : "3"}. Synthèse</Text>
          <Text style={{ lineHeight: 1.4 }}>{v.synthese || "-"}</Text>
          <Text style={{ marginTop: 18, color: c.gris }}>Visa de la personne ayant réalisé la visite :</Text>
        </View>

        <View style={s.pied} fixed>
          <Text>{donnees.entreprise} · Rapport de visite du {formaterDate(v.date)} · édité le {formaterDate(aujourdhui)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
