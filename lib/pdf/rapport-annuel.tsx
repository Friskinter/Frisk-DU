// Rapport annuel santé, sécurité et conditions de travail, au format PDF, à présenter au CSE.

import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { formatNombre, formaterDate } from "@/lib/calculs";
import { actionLibelle, evolution, type Rapport } from "@/lib/rapport";
import type { Donnees } from "@/lib/types";
import { Champ, Section, c, s } from "./plan-prevention";
import type { Marque } from "@/lib/identite";
import { BandeauCouleur, CouleurTitres, LogoDocument, MentionFrisk } from "./marque";

// Les polices standard du PDF n'ont pas l'espace insécable fine des nombres français (« 4 900 € »).
const espaces = (t: string) => t.replace(/[\u202f\u00a0]/g, " ");
const formatEuros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const euros = { format: (n: number) => espaces(formatEuros.format(n)) };
const nombre = (n: number) => espaces(formatNombre.format(n));
const taux = (t: number | null) => (t === null ? "-" : nombre(t));

function Tuiles({ tuiles }: { tuiles: { libelle: string; valeur: string; detail?: string }[] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
      {tuiles.map((t) => (
        <View key={t.libelle} style={{ width: "23.8%", borderWidth: 0.5, borderColor: c.pierre, padding: 6 }} wrap={false}>
          <Text style={{ fontSize: 6.5, color: c.gris, textTransform: "uppercase" }}>{t.libelle}</Text>
          <Text style={{ fontSize: 15, marginTop: 2 }}>{t.valeur}</Text>
          {t.detail && <Text style={{ fontSize: 7, color: c.ardoise, marginTop: 1 }}>{t.detail}</Text>}
        </View>
      ))}
    </View>
  );
}

function Tableau({ colonnes, lignes, vide }: { colonnes: { titre: string; largeur: string }[]; lignes: ReactNode[][]; vide: string }) {
  if (!lignes.length) return <Text style={{ color: c.gris }}>{vide}</Text>;
  return (
    <View style={s.table}>
      <View style={s.entete} minPresenceAhead={30}>
        {colonnes.map((col) => (
          <Text key={col.titre} style={[s.th, { width: col.largeur }]}>{col.titre}</Text>
        ))}
      </View>
      {lignes.map((ligne, n) => (
        <View key={n} style={s.ligne} wrap={false}>
          {ligne.map((cellule, i) => (
            <Text key={i} style={[s.td, { width: colonnes[i].largeur }]}>{cellule}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function RapportAnnuel({ donnees, rapport: r, synthese, aujourdhui, marque }: { donnees: Donnees; rapport: Rapport; synthese: string; aujourdhui: string; marque: Marque }) {
  const a = r.accidents;
  const enCours = r.reference < `${r.annee}-12-31`;
  return (
    <Document title={`Rapport annuel SST ${r.annee} - ${donnees.entreprise}`} author={donnees.entreprise} creator="Frisk DU" producer="Frisk DU" language="fr">
      <CouleurTitres.Provider value={marque.titre}>
      <Page size="A4" style={s.page}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8, letterSpacing: 2, color: marque.accent, textTransform: "uppercase" }}>{donnees.entreprise}</Text>
            <Text style={{ fontFamily: "Times-Roman", fontSize: 20, lineHeight: 1.2, marginTop: 4, color: marque.titre }}>Rapport annuel santé, sécurité et conditions de travail</Text>
            <Text style={{ fontSize: 12, marginTop: 2 }}>Année {r.annee}{enCours ? ` (situation au ${formaterDate(r.reference)})` : ""}</Text>
            <Text style={{ fontSize: 8, color: c.ardoise, marginTop: 4 }}>
              {r.papripact
                ? "Bilan de la situation générale de la santé, de la sécurité et des conditions de travail et programme annuel de prévention, présentés au comité social et économique (art. L2312-27 du Code du travail)."
                : "Bilan de l'année en santé et sécurité au travail, à partager avec le comité social et économique et les salariés."}
            </Text>
          </View>
          <LogoDocument marque={marque} style={{ marginLeft: 16 }} />
        </View>

        <Section titre="1. Chiffres clés">
          <Tuiles
            tuiles={[
              { libelle: "Accidents avec arrêt", valeur: String(a.avecArret), detail: `${evolution(a.avecArret, a.precedent.avecArret)} par rapport à ${r.annee - 1}` },
              { libelle: "Jours d'arrêt", valeur: String(a.joursArret), detail: `${a.precedent.joursArret} en ${r.annee - 1}` },
              { libelle: "Taux de fréquence", valeur: taux(a.tauxFrequence), detail: a.heuresEstimees ? "heures estimées" : "par million d'heures" },
              { libelle: "Taux de gravité", valeur: taux(a.tauxGravite), detail: "jours pour 1 000 heures" },
              { libelle: "Presque-accidents signalés", valeur: String(a.presqueAccidents), detail: `dont ${a.signalesTerrain} par QR code` },
              { libelle: "Actions réalisées", valeur: String(r.actions.realisees), detail: euros.format(r.actions.budgetRealise) },
              { libelle: "Formations suivies", valeur: String(r.formations.sessions), detail: `${r.formations.salariesFormes} salarié(s)` },
              { libelle: "Visites et causeries", valeur: `${r.terrain.visites} · ${r.terrain.causeries}`, detail: `${r.terrain.accueils} accueil(s) sécurité` },
            ]}
          />
          <View style={{ marginTop: 6 }}>
            <Champ cle="Effectif">{[r.entreprise.effectif, `${r.entreprise.salaries} salarié(s) suivi(s) dans Frisk DU`].filter(Boolean).join(" · ")}</Champ>
            <Champ cle="Heures travaillées">
              {r.entreprise.heures ? `${nombre(r.entreprise.heures.heures)}${r.entreprise.heures.estimation ? " (estimées d'après l'effectif)" : ""}` : "à renseigner"}
            </Champ>
          </View>
        </Section>

        <Section titre="2. Accidents du travail et presque-accidents">
          <Tableau
            colonnes={[{ titre: "", largeur: "52%" }, { titre: String(r.annee), largeur: "24%" }, { titre: String(r.annee - 1), largeur: "24%" }]}
            lignes={[
              ["Accidents du travail avec arrêt", a.avecArret, a.precedent.avecArret],
              ["Jours d'arrêt", a.joursArret, a.precedent.joursArret],
              ["Taux de fréquence", taux(a.tauxFrequence), taux(a.precedent.tauxFrequence)],
              ["Presque-accidents et situations dangereuses", a.presqueAccidents, a.precedent.presqueAccidents],
            ]}
            vide=""
          />
          <Text style={{ marginTop: 4, color: c.ardoise }}>
            {a.accidentsTravail} accident(s) du travail dont {a.sansArret} sans arrêt, {a.trajet} accident(s) de trajet. {a.analyses} événement(s) sur{" "}
            {a.evenements.length} analysé(s).
          </Text>
          <View style={{ marginTop: 6 }}>
            <Tableau
              colonnes={[{ titre: "Date", largeur: "12%" }, { titre: "Type", largeur: "18%" }, { titre: "Lieu", largeur: "18%" }, { titre: "Circonstances", largeur: "42%" }, { titre: "Arrêt", largeur: "10%" }]}
              lignes={a.liste.map((x) => [formaterDate(x.date), x.type, x.lieu || "-", x.circonstances || "-", x.joursArret ? `${x.joursArret} j` : "-"])}
              vide="Aucun accident du travail ou de trajet enregistré cette année."
            />
          </View>
        </Section>

        <Section titre="3. Évaluation des risques" insecable>
          <Text>{r.duerp.risques} risque(s) évalué(s) dans le document unique. Répartition par niveau de risque résiduel :</Text>
          <Text style={{ marginTop: 3 }}>{r.duerp.parNiveau.map((n) => `${n.libelle} : ${n.nombre}`).join(" · ")}</Text>
        </Section>

        <Section titre="4. Actions de prévention" insecable>
          <Text>
            {r.actions.realisees} action(s) réalisée(s) dans l&apos;année pour {euros.format(r.actions.budgetRealise)} HT. {r.actions.enCours} action(s) en cours ou à faire, dont{" "}
            {r.actions.enRetard} en retard au {formaterDate(r.reference)}.
          </Text>
          {r.actions.parPrincipe.length > 0 && (
            <Text style={{ marginTop: 3, color: c.ardoise }}>Par type de mesure : {r.actions.parPrincipe.map((p) => `${p.libelle} (${p.nombre})`).join(", ")}.</Text>
          )}
        </Section>

        <Section titre="5. Formation à la sécurité">
          <Text>
            {r.formations.sessions} formation(s) suivie(s) par {r.formations.salariesFormes} salarié(s). Au {formaterDate(r.reference)} : {r.formations.manquantes} formation(s) exigée(s)
            manquante(s), {r.formations.expirees} expirée(s).
          </Text>
          <View style={{ marginTop: 4 }}>
            <Tableau
              colonnes={[{ titre: "Formation", largeur: "80%" }, { titre: "Sessions", largeur: "20%" }]}
              lignes={r.formations.parFormation.map((f) => [f.libelle, f.nombre])}
              vide="Aucune formation enregistrée cette année."
            />
          </View>
        </Section>

        <Section titre="6. Vérifications périodiques" insecable>
          <Text>
            {r.verifications.realisees} vérification(s) réalisée(s), dont {r.verifications.nonConformes} non conforme(s). {r.verifications.observations} observation(s) relevée(s),{" "}
            {r.verifications.observationsLevees} levée(s) ; {r.verifications.observationsOuvertes} observation(s) restant à lever.
          </Text>
        </Section>

        <Section titre="7. Prévention sur le terrain" insecable>
          <Champ cle="Visites et audits">
            {r.terrain.visites} visite(s){r.terrain.conformiteMoyenne === null ? "" : `, conformité moyenne ${r.terrain.conformiteMoyenne} %`} ; {r.terrain.nonConformites} non-conformité(s) relevée(s),{" "}
            {r.terrain.nonConformitesOuvertes} encore ouverte(s)
          </Champ>
          <Champ cle="Causeries sécurité">
            {r.terrain.causeries} causerie(s), {r.terrain.participations} participation(s){r.terrain.themes.length ? ` : ${r.terrain.themes.join(", ")}` : ""}
          </Champ>
          <Champ cle="Accueils sécurité">
            {r.terrain.accueils} nouvel(s) arrivant(s) accueilli(s){r.terrain.accueilsRenforces ? `, dont ${r.terrain.accueilsRenforces} avec formation renforcée` : ""}
          </Champ>
          <Champ cle="Entreprises extérieures">{r.exterieures.plans} plan(s) de prévention, {r.exterieures.protocoles} protocole(s) de sécurité</Champ>
          <Champ cle="Produits chimiques">{r.chimie.produits} produit(s) utilisé(s), dont {r.chimie.cmr} CMR ; {r.chimie.fdsManquantes} fiche(s) de données de sécurité manquante(s)</Champ>
          <Champ cle="EPI remis">{r.epi.remises} article(s), pour {euros.format(r.epi.cout)} HT</Champ>
        </Section>

        <Section titre={`8. ${r.papripact ? "Programme annuel de prévention" : "Actions prévues"} ${r.annee + 1}`}>
          <Tableau
            colonnes={[{ titre: "Action", largeur: "36%" }, { titre: "Risque", largeur: "26%" }, { titre: "Responsable", largeur: "15%" }, { titre: "Échéance", largeur: "11%" }, { titre: "Coût HT", largeur: "12%" }]}
            lignes={r.actions.programme.map((x) => {
              const l = actionLibelle(x, donnees);
              return [l.intitule, l.risque || "-", x.responsable || "-", x.echeance ? formaterDate(x.echeance) : "-", x.cout ? euros.format(x.cout) : "-"];
            })}
            vide="Aucune action prévue : complétez le plan d'actions."
          />
          <Text style={{ marginTop: 3, color: c.ardoise }}>Actions non réalisées au {formaterDate(r.reference)}, à mener d&apos;ici la fin de {r.annee + 1}.</Text>
          {r.actions.programme.length > 0 && <Text style={{ marginTop: 1, color: c.ardoise }}>Budget prévu : {euros.format(r.actions.budgetProgramme)} HT.</Text>}
        </Section>

        <View wrap={false}>
          <Text style={[s.titreSection, { color: marque.titre }]}>9. Synthèse de l&apos;employeur</Text>
          <Text style={{ lineHeight: 1.4 }}>{synthese || "-"}</Text>
          <Text style={[s.titreSection, { color: marque.titre }]}>10. Avis du comité social et économique</Text>
          <View style={{ borderWidth: 0.5, borderColor: c.pierre, height: 90 }} />
          <Text style={{ marginTop: 4, fontSize: 7.5, color: c.gris }}>Date de présentation au CSE : ............................</Text>
        </View>

        <View style={s.pied} fixed>
          <Text>{donnees.entreprise} · Rapport annuel SST {r.annee} · édité le {formaterDate(aujourdhui)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
        <BandeauCouleur marque={marque} />
        <MentionFrisk marque={marque} />
      </Page>
      </CouleurTitres.Provider>
    </Document>
  );
}
