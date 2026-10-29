// Protocole de sécurité des opérations de chargement et de déchargement (art. R4515-4 à R4515-11
// du Code du travail), au format PDF.

import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formaterDate } from "@/lib/calculs";
import { operations } from "@/lib/protocoles";
import type { Donnees, Protocole } from "@/lib/types";
import { CadreSignature, Champ, Section, c, s } from "./plan-prevention";
import type { Marque } from "@/lib/identite";
import { LogoDocument, MentionFrisk } from "./marque";

export function ProtocoleSecurite({ donnees, protocole: p, aujourdhui, marque }: { donnees: Donnees; protocole: Protocole; aujourdhui: string; marque: Marque }) {
  const fiche = donnees.fiche;
  const operation = operations.find((o) => o.valeur === p.operation)?.libelle ?? "";
  return (
    <Document title={`Protocole de sécurité - ${p.transporteur}`} author={donnees.entreprise} creator="Frisk DU" producer="Frisk DU" language="fr">
      <Page size="A4" style={s.page}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8, letterSpacing: 2, color: marque.accent, textTransform: "uppercase" }}>{donnees.entreprise}</Text>
            <Text style={{ fontFamily: "Times-Roman", fontSize: 20, lineHeight: 1.2, marginTop: 4 }}>Protocole de sécurité</Text>
            <Text style={{ fontSize: 10, marginTop: 2 }}>{operation} · {p.transporteur || "Transporteur"}</Text>
            <Text style={{ fontSize: 8, color: c.ardoise, marginTop: 4 }}>
              Établi en application des articles R4515-4 à R4515-11 du Code du travail, à la suite d&apos;un échange entre l&apos;entreprise d&apos;accueil et
              le transporteur. Il tient lieu de plan de prévention.
            </Text>
          </View>
          <LogoDocument marque={marque} style={{ marginLeft: 16 }} />
        </View>

        <Section titre="1. Les entreprises et la période">
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>Entreprise d&apos;accueil</Text>
              <Text style={s.paragraphe}>{donnees.entreprise}</Text>
              {fiche?.adresse && <Text style={s.paragraphe}>{fiche.adresse}</Text>}
              {fiche?.siret && <Text style={s.paragraphe}>SIRET {fiche.siret}</Text>}
              <Text style={[s.paragraphe, { marginTop: 3 }]}>Responsable désigné : {p.responsable || "-"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>Transporteur</Text>
              <Text style={s.paragraphe}>{p.transporteur || "-"}</Text>
              {p.siret && <Text style={s.paragraphe}>SIRET {p.siret}</Text>}
              <Text style={[s.paragraphe, { marginTop: 3 }]}>Représentant : {p.contact || "-"}</Text>
              {(p.telephone || p.email) && <Text style={s.paragraphe}>{[p.telephone, p.email].filter(Boolean).join(" · ")}</Text>}
            </View>
          </View>
          <Text style={{ marginTop: 6 }}>
            {p.permanent
              ? `Protocole valable pour les opérations répétitives du ${formaterDate(p.debut)} au ${formaterDate(p.fin)} (art. R4515-8).`
              : `Opération du ${formaterDate(p.debut)}.`}
          </Text>
        </Section>

        <Section titre="2. Informations de l'entreprise d'accueil">
          <Champ cle="Lieu de l'opération">{p.lieu}</Champ>
          <Champ cle="Accès et stationnement">{p.acces}</Champ>
          <Champ cle="Plan et consignes de circulation">{p.circulation}</Champ>
          <Champ cle="Matériels et engins utilisés">{p.materiels}</Champ>
          <Champ cle="Consignes de sécurité">{p.consignes}</Champ>
          <Champ cle="Moyens de secours">{p.secours}</Champ>
        </Section>

        <Section titre="3. Informations du transporteur">
          <Champ cle="Véhicules et équipements">{p.vehicules}</Champ>
          <Champ cle="Marchandises et conditionnement">{p.marchandises}</Champ>
          <Champ cle="Précautions particulières">{p.precautions}</Champ>
          {p.matieresDangereuses && (
            <Text style={{ marginTop: 3, color: c.rouge }}>
              Transport de matières dangereuses : les consignes de la réglementation du transport de marchandises dangereuses (ADR) s&apos;appliquent.
            </Text>
          )}
          {p.notes && <Champ cle="Remarques">{p.notes}</Champ>}
        </Section>

        <View wrap={false}>
          <Text style={s.titreSection}>4. Signatures</Text>
          <Text style={{ fontSize: 8, color: c.ardoise, marginBottom: 6 }}>
            Chaque entreprise porte ce protocole à la connaissance de ses salariés concernés ; le transporteur le remet à ses chauffeurs. Un exemplaire est
            conservé par chaque partie et tenu à la disposition de l&apos;inspection du travail et des représentants du personnel.
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <CadreSignature titre="Pour l'entreprise d'accueil" nom={p.responsable} signature={p.signatureAccueil ? donnees.signatures?.[p.signatureAccueil] : undefined} />
            <CadreSignature titre="Pour le transporteur" nom={p.contact} signature={p.signatureTransporteur ? donnees.signatures?.[p.signatureTransporteur] : undefined} />
          </View>
        </View>

        <View style={s.pied} fixed>
          <Text>{donnees.entreprise} · Protocole de sécurité {p.transporteur} · édité le {formaterDate(aujourdhui)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
        <MentionFrisk marque={marque} />
      </Page>
    </Document>
  );
}
