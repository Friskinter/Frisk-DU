// Plan de prévention d'une entreprise extérieure (art. R4512-6 à R4512-12 du Code du travail), au format PDF.

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { formaterDate } from "@/lib/calculs";
import { charges, planEcritObligatoire, raisonObligation, travauxDangereux } from "@/lib/interventions";
import type { Donnees, Intervention, Signature } from "@/lib/types";

export const c = { encre: "#0c0b0a", ardoise: "#3a3530", gris: "#6b645b", bronze: "#7f6235", marbre: "#ece6dc", pierre: "#d9cfc1", ivoire: "#f7f4ef", rouge: "#b42318" };

export const s = StyleSheet.create({
  page: { paddingTop: 32, paddingBottom: 50, paddingHorizontal: 36, fontFamily: "Helvetica", fontSize: 9, color: c.encre },
  pied: { position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: c.gris, borderTopWidth: 0.5, borderTopColor: c.pierre, paddingTop: 6 },
  titreSection: { fontFamily: "Times-Bold", fontSize: 12, marginTop: 14, marginBottom: 5 },
  champ: { flexDirection: "row", marginBottom: 4 },
  cle: { width: 138, paddingRight: 8, color: c.gris },
  valeur: { flex: 1 },
  table: { borderWidth: 0.5, borderColor: c.pierre, borderBottomWidth: 0 },
  ligne: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: c.pierre },
  entete: { flexDirection: "row", backgroundColor: c.marbre, borderBottomWidth: 0.5, borderBottomColor: c.pierre },
  th: { padding: 4, fontFamily: "Helvetica-Bold", fontSize: 7, textTransform: "uppercase", color: c.ardoise },
  td: { padding: 4, fontSize: 8.5, lineHeight: 1.35 },
  paragraphe: { marginBottom: 1.5 },
});

const colonnes = [
  { titre: "Phase ou situation", largeur: "24%" },
  { titre: "Risque d'interférence", largeur: "26%" },
  { titre: "Mesures de prévention", largeur: "38%" },
  { titre: "À la charge de", largeur: "12%" },
];

export function Champ({ cle, children }: { cle: string; children: ReactNode }) {
  return (
    <View style={s.champ}>
      <Text style={s.cle}>{cle}</Text>
      <Text style={s.valeur}>{children || "-"}</Text>
    </View>
  );
}

export function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <View>
      <Text style={s.titreSection} minPresenceAhead={40}>{titre}</Text>
      {children}
    </View>
  );
}

export function CadreSignature({ titre, nom, signature }: { titre: string; nom: string; signature?: Signature }) {
  return (
    <View style={{ flex: 1, borderWidth: 0.5, borderColor: c.pierre, padding: 8, minHeight: 90 }}>
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>{titre}</Text>
      <Text style={{ marginTop: 3, color: c.ardoise }}>{signature?.nom || nom || "Nom et qualité :"}</Text>
      {signature ? (
        <>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF, sans attribut alt */}
          <Image src={signature.image} style={{ height: 40, width: 125, marginTop: 4 }} />
          <Text style={{ fontSize: 7.5, color: c.gris }}>Signé le {formaterDate(signature.date)}</Text>
        </>
      ) : (
        <Text style={{ marginTop: 30, fontSize: 7.5, color: c.gris }}>Date et signature :</Text>
      )}
    </View>
  );
}

export function PlanPrevention({ donnees, intervention: i, aujourdhui, logo }: { donnees: Donnees; intervention: Intervention; aujourdhui: string; logo: string }) {
  const fiche = donnees.fiche;
  const obligatoire = planEcritObligatoire(i);
  const dangereux = travauxDangereux.filter((t) => i.travauxDangereux.includes(t.code));
  const risques = i.risques.filter((r) => r.phase || r.risque || r.mesures);
  const suivi = [...i.suivi].filter((x) => x.date || x.observations).sort((a, b) => a.date.localeCompare(b.date));
  return (
    <Document title={`Plan de prévention - ${i.entreprise}`} author={donnees.entreprise} creator="Frisk DU" producer="Frisk DU" language="fr">
      <Page size="A4" style={s.page}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8, letterSpacing: 2, color: c.bronze, textTransform: "uppercase" }}>{donnees.entreprise}</Text>
            <Text style={{ fontFamily: "Times-Roman", fontSize: 20, lineHeight: 1.2, marginTop: 4 }}>Plan de prévention</Text>
            <Text style={{ fontSize: 10, marginTop: 2 }}>{i.entreprise || "Entreprise extérieure"}{i.objet ? ` · ${i.objet}` : ""}</Text>
            <Text style={{ fontSize: 8, color: c.ardoise, marginTop: 4 }}>
              Établi en application des articles R4512-6 à R4512-12 du Code du travail. {obligatoire ? `Plan écrit obligatoire : ${raisonObligation(i)}.` : "Plan établi par écrit à l'initiative des entreprises."}
            </Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF, sans attribut alt */}
          <Image src={logo} style={{ width: 40, height: 40, marginLeft: 16 }} />
        </View>

        <Section titre="1. Les entreprises">
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>Entreprise utilisatrice</Text>
              <Text style={s.paragraphe}>{donnees.entreprise}</Text>
              {fiche?.adresse && <Text style={s.paragraphe}>{fiche.adresse}</Text>}
              {fiche?.siret && <Text style={s.paragraphe}>SIRET {fiche.siret}</Text>}
              <Text style={[s.paragraphe, { marginTop: 3 }]}>Représentant : {i.coordinateur || fiche?.responsable || "-"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>Entreprise extérieure</Text>
              <Text style={s.paragraphe}>{i.entreprise || "-"}</Text>
              {i.siret && <Text style={s.paragraphe}>SIRET {i.siret}</Text>}
              <Text style={[s.paragraphe, { marginTop: 3 }]}>Représentant : {i.responsable || "-"}</Text>
              {(i.telephone || i.email) && <Text style={s.paragraphe}>{[i.telephone, i.email].filter(Boolean).join(" · ")}</Text>}
              {i.sousTraitants && <Text style={[s.paragraphe, { marginTop: 3 }]}>Sous-traitants : {i.sousTraitants}</Text>}
            </View>
          </View>
        </Section>

        <Section titre="2. L'intervention">
          <Champ cle="Nature des travaux">{i.objet}</Champ>
          <Champ cle="Lieux concernés">{i.lieux}</Champ>
          <Champ cle="Dates">
            {i.debut ? `Du ${formaterDate(i.debut)}${i.fin ? ` au ${formaterDate(i.fin)}` : ""}` : ""}
          </Champ>
          <Champ cle="Durée prévisible">{i.heures ? `${i.heures} heures` : ""}</Champ>
          <Champ cle="Effectif prévisible">{i.effectif ? `${i.effectif} intervenant(s)` : ""}</Champ>
          <Champ cle="Travaux dangereux">{dangereux.length ? dangereux.map((t) => `• ${t.libelle}`).join("\n") : "Aucun (arrêté du 19 mars 1993)"}</Champ>
          {i.travauxDangereux.includes("points-chauds") && (
            <Text style={{ marginTop: 3, color: c.rouge }}>Travaux par points chauds : un permis de feu est délivré avant chaque intervention.</Text>
          )}
        </Section>

        <Section titre="3. Inspection commune préalable">
          <Champ cle="Date">{i.inspectionLe ? formaterDate(i.inspectionLe) : ""}</Champ>
          <Champ cle="Participants">{i.inspectionPar}</Champ>
        </Section>

        <Section titre="4. Risques liés à l'interférence des activités et mesures de prévention">
          {risques.length === 0 ? (
            <Text style={{ color: c.gris }}>Aucun risque d&apos;interférence renseigné.</Text>
          ) : (
            <View style={s.table}>
              <View style={s.entete} fixed>
                {colonnes.map((col) => (
                  <Text key={col.titre} style={[s.th, { width: col.largeur }]}>{col.titre}</Text>
                ))}
              </View>
              {risques.map((r) => (
                <View key={r.id} style={s.ligne} wrap={false}>
                  <Text style={[s.td, { width: "24%" }]}>{r.phase}</Text>
                  <Text style={[s.td, { width: "26%" }]}>{r.risque}</Text>
                  <Text style={[s.td, { width: "38%" }]}>{r.mesures}</Text>
                  <Text style={[s.td, { width: "12%" }]}>{charges.find((x) => x.valeur === r.charge)?.court}</Text>
                </View>
              ))}
            </View>
          )}
        </Section>

        <Section titre="5. Consignes et organisation">
          <Champ cle="Instructions aux intervenants">{i.consignes}</Champ>
          <Champ cle="Matériels et installations">{i.materiels}</Champ>
          <Champ cle="Premiers secours et alerte">{i.secours}</Champ>
          {i.notes && <Champ cle="Remarques">{i.notes}</Champ>}
        </Section>

        {suivi.length > 0 && (
          <Section titre="6. Inspections et réunions de coordination">
            {suivi.map((x) => (
              <Champ key={x.id} cle={`${x.type === "inspection" ? "Inspection" : "Réunion"} du ${formaterDate(x.date)}`}>{x.observations}</Champ>
            ))}
          </Section>
        )}

        <View wrap={false}>
          <Text style={s.titreSection}>{suivi.length > 0 ? "7" : "6"}. Signatures</Text>
          <Text style={{ fontSize: 8, color: c.ardoise, marginBottom: 6 }}>
            Les deux entreprises arrêtent d&apos;un commun accord les mesures ci-dessus. Chaque chef d&apos;entreprise les porte à la connaissance de ses
            travailleurs avant le début des travaux. Le plan est tenu à la disposition de l&apos;inspection du travail, des services de prévention et des
            représentants du personnel.
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <CadreSignature titre="Pour l'entreprise utilisatrice" nom={i.coordinateur || fiche?.responsable || ""} signature={i.signatureEu ? donnees.signatures?.[i.signatureEu] : undefined} />
            <CadreSignature titre="Pour l'entreprise extérieure" nom={i.responsable} signature={i.signatureEe ? donnees.signatures?.[i.signatureEe] : undefined} />
          </View>
        </View>

        <View style={s.pied} fixed>
          <Text>{donnees.entreprise} · Plan de prévention {i.entreprise} · édité le {formaterDate(aujourdhui)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
