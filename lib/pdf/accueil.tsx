// Fiche d'accueil sécurité d'un nouvel arrivant et feuille d'émargement d'une causerie, au format PDF.

import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { contrats, formationRenforcee, niveauRisque, nomArrivant, pointsAccueil, risquesDuPoste } from "@/lib/accueils";
import { formaterDate, risqueResiduel } from "@/lib/calculs";
import type { Accueil, Causerie, Donnees } from "@/lib/types";
import { CadreSignature, Champ, Section, c, s } from "./plan-prevention";
import type { Marque } from "@/lib/identite";
import { LogoDocument, MentionFrisk } from "./marque";

function EnTete({ donnees, titre, sousTitre, marque }: { donnees: Donnees; titre: string; sousTitre: string; marque: Marque }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 8, letterSpacing: 2, color: marque.accent, textTransform: "uppercase" }}>{donnees.entreprise}</Text>
        <Text style={{ fontFamily: "Times-Roman", fontSize: 20, lineHeight: 1.2, marginTop: 4 }}>{titre}</Text>
        <Text style={{ fontSize: 10, marginTop: 2 }}>{sousTitre}</Text>
      </View>
      <LogoDocument marque={marque} style={{ marginLeft: 16 }} />
    </View>
  );
}

function Pied({ texte }: { texte: string }) {
  return (
    <View style={s.pied} fixed>
      <Text>{texte}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

export function FicheAccueil({ donnees, accueil: a, aujourdhui, marque }: { donnees: Donnees; accueil: Accueil; aujourdhui: string; marque: Marque }) {
  const nom = nomArrivant(a, donnees);
  const risques = risquesDuPoste(donnees.duerp, a.unite);
  const signature = a.signatureId ? donnees.signatures?.[a.signatureId] : undefined;
  return (
    <Document title={`Accueil sécurité - ${nom}`} author={donnees.entreprise} creator="Frisk DU" producer="Frisk DU" language="fr">
      <Page size="A4" style={s.page}>
        <EnTete donnees={donnees} titre="Accueil sécurité" sousTitre={nom} marque={marque} />
        <Text style={{ fontSize: 8, color: c.ardoise, marginTop: 4 }}>
          Formation pratique et appropriée à la sécurité, à l&apos;arrivée dans l&apos;entreprise ou au changement de poste (art. R4141-1 et suivants du Code du travail).
        </Text>

        <Section titre="1. Le nouvel arrivant">
          <Champ cle="Nom">{nom}</Champ>
          <Champ cle="Contrat">{contrats.find((x) => x.valeur === a.contrat)?.libelle}</Champ>
          <Champ cle="Poste">{a.poste}</Champ>
          <Champ cle="Unité de travail">{a.unite}</Champ>
          <Champ cle="Arrivée">{a.arriveeLe ? formaterDate(a.arriveeLe) : ""}</Champ>
          <Champ cle="Accueil réalisé le">{a.accueilLe ? formaterDate(a.accueilLe) : ""}</Champ>
          <Champ cle="Par">{a.animateur}</Champ>
          {formationRenforcee(a) && (
            <Text style={{ marginTop: 3, color: c.rouge }}>
              Poste présentant des risques particuliers : formation renforcée à la sécurité requise (art. L4154-2), avec accueil et information adaptés.
            </Text>
          )}
        </Section>

        <Section titre="2. Points abordés">
          <View style={s.table}>
            {pointsAccueil.map((p) => {
              const aborde = a.points.includes(p.code);
              return (
                <View key={p.code} style={s.ligne} wrap={false}>
                  <Text style={[s.td, { width: "82%" }]}>{p.libelle}</Text>
                  <Text style={[s.td, { width: "18%", color: aborde ? "#0b6b0b" : c.gris }]}>{aborde ? "Abordé" : "Non abordé"}</Text>
                </View>
              );
            })}
          </View>
        </Section>

        {risques.length > 0 && (
          <Section titre="3. Risques du poste (extrait du document unique)">
            <View style={s.table}>
              <View style={s.entete}>
                {["Danger", "Risque", "Mesures de prévention", "Niveau"].map((t, n) => (
                  <Text key={t} style={[s.th, { width: ["22%", "26%", "38%", "14%"][n] }]}>{t}</Text>
                ))}
              </View>
              {risques.map((l) => (
                <View key={l.id} style={s.ligne} wrap={false}>
                  <Text style={[s.td, { width: "22%" }]}>{l.danger || l.activite}</Text>
                  <Text style={[s.td, { width: "26%" }]}>{l.risque}</Text>
                  <Text style={[s.td, { width: "38%" }]}>{l.mesures || "-"}</Text>
                  <Text style={[s.td, { width: "14%" }]}>{niveauRisque(l).libelle} ({risqueResiduel(l)})</Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        {a.complement && (
          <Section titre={risques.length ? "4. Compléments" : "3. Compléments"}>
            <Text style={{ lineHeight: 1.4 }}>{a.complement}</Text>
          </Section>
        )}

        <View wrap={false} style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 8, color: c.ardoise, marginBottom: 6 }}>
            Le nouvel arrivant atteste avoir reçu ces informations et pouvoir poser ses questions à tout moment à son responsable.
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <CadreSignature titre="Le nouvel arrivant" nom={nom} signature={signature ? { ...signature, nom } : undefined} />
            <CadreSignature titre="Pour l'entreprise" nom={a.animateur} />
          </View>
        </View>

        <Pied texte={`${donnees.entreprise} · Accueil sécurité de ${nom} · édité le ${formaterDate(aujourdhui)}`} />
        <MentionFrisk marque={marque} />
      </Page>
    </Document>
  );
}

export function FeuilleEmargement({ donnees, causerie: x, aujourdhui, marque }: { donnees: Donnees; causerie: Causerie; aujourdhui: string; marque: Marque }) {
  const nomParticipant = (p: Causerie["participants"][number]) => donnees.salaries.find((s) => s.id === p.salarieId)?.nom || p.nom || "Participant";
  return (
    <Document title={`Causerie - ${x.theme}`} author={donnees.entreprise} creator="Frisk DU" producer="Frisk DU" language="fr">
      <Page size="A4" style={s.page}>
        <EnTete donnees={donnees} titre="Causerie sécurité" sousTitre={x.theme || "Thème à préciser"} marque={marque} />

        <Section titre="1. La causerie">
          <Champ cle="Date">{x.date ? formaterDate(x.date) : ""}</Champ>
          <Champ cle="Animée par">{x.animateur}</Champ>
          <Champ cle="Durée">{x.duree ? `${x.duree} minutes` : ""}</Champ>
          <Champ cle="Messages clés">{x.messages}</Champ>
          {x.remarques && <Champ cle="Remontées des participants">{x.remarques}</Champ>}
        </Section>

        <Section titre={`2. Émargement (${x.participants.length} participant${x.participants.length > 1 ? "s" : ""})`}>
          <View style={s.table}>
            <View style={s.entete}>
              <Text style={[s.th, { width: "45%" }]}>Nom</Text>
              <Text style={[s.th, { width: "55%" }]}>Signature</Text>
            </View>
            {x.participants.map((p) => {
              const signature = p.signatureId ? donnees.signatures?.[p.signatureId] : undefined;
              return (
                <View key={p.id} style={[s.ligne, { minHeight: 34 }]} wrap={false}>
                  <Text style={[s.td, { width: "45%" }]}>{nomParticipant(p)}</Text>
                  <View style={[s.td, { width: "55%" }]}>
                    {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF, sans attribut alt */}
                    {signature && <Image src={signature.image} style={{ height: 24, width: 75 }} />}
                  </View>
                </View>
              );
            })}
          </View>
        </Section>

        <Pied texte={`${donnees.entreprise} · Causerie du ${x.date ? formaterDate(x.date) : "?"} · édité le ${formaterDate(aujourdhui)}`} />
        <MentionFrisk marque={marque} />
      </Page>
    </Document>
  );
}
