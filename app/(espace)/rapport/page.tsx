"use client";

import Link from "next/link";
import { useState } from "react";
import { Carte, Chargement, EnTetePage, Indicateur, classeBouton, classeChamp } from "@/components/ui";
import { dateDuJour, formatNombre, formaterDate } from "@/lib/calculs";
import { telechargerRapportAnnuel } from "@/lib/pdf/telecharger";
import { anneesDisponibles, calculerRapport, evolution } from "@/lib/rapport";
import { modifier, peutModifier, useDonnees, useSession } from "@/lib/stockage";

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const taux = (t: number | null) => (t === null ? "—" : formatNombre.format(t));

export default function PageRapport() {
  const donnees = useDonnees();
  const { role } = useSession();
  const [choix, setAnnee] = useState<number | null>(null);
  const [enCours, setEnCours] = useState(false);

  if (!donnees) return <Chargement />;
  const aujourdhui = dateDuJour();
  const annee = choix ?? Number(aujourdhui.slice(0, 4));
  const modifiable = peutModifier(role, "tout");
  const annees = anneesDisponibles(donnees, aujourdhui);
  const r = calculerRapport(donnees, annee, aujourdhui);
  const a = r.accidents;
  const synthese = donnees.preferences?.syntheses?.[annee] ?? "";

  const changerSynthese = (texte: string) =>
    modifier((d) => ({ ...d, preferences: { ...d.preferences, syntheses: { ...d.preferences?.syntheses, [annee]: texte } } }));

  const telecharger = async () => {
    setEnCours(true);
    try {
      await telechargerRapportAnnuel(donnees, annee);
    } finally {
      setEnCours(false);
    }
  };

  const lignes: { titre: string; lien: string; texte: string }[] = [
    {
      titre: "Accidents et presque-accidents",
      lien: "/accidents",
      texte: `${a.accidentsTravail} accident(s) du travail (${a.avecArret} avec arrêt, ${a.joursArret} jours), ${a.trajet} de trajet, ${a.presqueAccidents} presque-accident(s) ou situation(s) dangereuse(s) dont ${a.signalesTerrain} signalé(s) par QR code.`,
    },
    {
      titre: "Évaluation des risques",
      lien: "/duerp",
      texte: `${r.duerp.risques} risque(s) au document unique : ${r.duerp.parNiveau.map((n) => `${n.nombre} ${n.libelle.toLowerCase()}`).join(", ")}.`,
    },
    {
      titre: "Actions de prévention",
      lien: "/actions",
      texte: `${r.actions.realisees} réalisée(s) pour ${euros.format(r.actions.budgetRealise)} HT ; ${r.actions.enCours} en cours ou à faire, dont ${r.actions.enRetard} en retard.`,
    },
    {
      titre: "Formation",
      lien: "/formations",
      texte: `${r.formations.sessions} formation(s) suivie(s) par ${r.formations.salariesFormes} salarié(s) ; ${r.formations.manquantes} manquante(s), ${r.formations.expirees} expirée(s).`,
    },
    {
      titre: "Vérifications périodiques",
      lien: "/verifications",
      texte: `${r.verifications.realisees} vérification(s), ${r.verifications.nonConformes} non conforme(s) ; ${r.verifications.observationsOuvertes} observation(s) à lever.`,
    },
    {
      titre: "Terrain",
      lien: "/visites",
      texte: `${r.terrain.visites} visite(s)${r.terrain.conformiteMoyenne === null ? "" : ` (${r.terrain.conformiteMoyenne} % de conformité)`}, ${r.terrain.causeries} causerie(s), ${r.terrain.accueils} accueil(s) sécurité.`,
    },
    {
      titre: "Entreprises extérieures, chimie, EPI",
      lien: "/entreprises-exterieures",
      texte: `${r.exterieures.plans} plan(s) de prévention et ${r.exterieures.protocoles} protocole(s) ; ${r.chimie.produits} produit(s) chimique(s) dont ${r.chimie.cmr} CMR ; ${r.epi.remises} EPI remis.`,
    },
    {
      titre: `${r.papripact ? "Programme annuel de prévention" : "Actions prévues"} ${annee + 1}`,
      lien: "/actions",
      texte: `${r.actions.programme.length} action(s) à mener, pour ${euros.format(r.actions.budgetProgramme)} HT.`,
    },
  ];

  return (
    <div>
      <EnTetePage
        titre="Rapport annuel"
        description={
          r.papripact
            ? "Le bilan de l'année en santé, sécurité et conditions de travail et le programme de prévention de l'année suivante, à présenter au CSE (art. L2312-27 du Code du travail). Tout est calculé à partir de vos données."
            : "Le bilan de l'année en santé et sécurité au travail, calculé à partir de vos données, à présenter au CSE et à partager avec l'équipe."
        }
        actions={
          <button type="button" className={`${classeBouton} disabled:opacity-60`} disabled={enCours} onClick={telecharger}>
            {enCours ? "Préparation du PDF…" : `⬇ Rapport annuel ${annee} (PDF)`}
          </button>
        }
      />

      <label className="mb-4 block max-w-48">
        <span className="mb-1 block text-xs font-medium text-ardoise">Année</span>
        <select value={annee} onChange={(e) => setAnnee(Number(e.target.value))} className={classeChamp}>
          {annees.map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
      </label>
      {r.reference < `${annee}-12-31` && (
        <p className="mb-4 text-sm text-ardoise">Année en cours : les chiffres sont arrêtés au {formaterDate(r.reference)}.</p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicateur
          libelle="Accidents avec arrêt"
          valeur={a.avecArret}
          detail={`${evolution(a.avecArret, a.precedent.avecArret)} par rapport à ${annee - 1}`}
          alerte={a.avecArret > a.precedent.avecArret}
        />
        <Indicateur
          libelle="Taux de fréquence · gravité"
          valeur={`${taux(a.tauxFrequence)} · ${taux(a.tauxGravite)}`}
          detail={a.tauxFrequence === null ? "renseignez l'effectif ou les heures dans les réglages" : a.heuresEstimees ? "heures estimées d'après l'effectif" : "d'après les heures travaillées"}
        />
        <Indicateur libelle="Actions réalisées" valeur={r.actions.realisees} detail={`${euros.format(r.actions.budgetRealise)} HT`} />
        <Indicateur libelle="Presque-accidents signalés" valeur={a.presqueAccidents} detail="plus on en signale, mieux on prévient" />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Carte titre="Contenu du rapport">
          <ul className="divide-y divide-pierre/60">
            {lignes.map((l) => (
              <li key={l.titre} className="py-2.5 text-sm">
                <Link href={l.lien} className="font-medium underline decoration-pierre hover:decoration-bronze">
                  {l.titre}
                </Link>
                <p className="text-ardoise">{l.texte}</p>
              </li>
            ))}
          </ul>
        </Carte>
        <Carte titre="Synthèse de l'employeur">
          <p className="mb-2 text-xs text-gris">
            Faits marquants, progrès, difficultés et priorités pour {annee + 1}. Ce texte figure dans le rapport ; une zone reste libre pour l&apos;avis du CSE.
          </p>
          <textarea
            rows={10}
            aria-label={`Synthèse de l'employeur pour ${annee}`}
            disabled={!modifiable}
            value={synthese}
            placeholder="Exemple : baisse des accidents grâce aux barrières de quai ; priorité à la circulation dans l'entrepôt…"
            onChange={(e) => changerSynthese(e.target.value)}
            className={`${classeChamp} resize-y`}
          />
        </Carte>
      </div>
    </div>
  );
}
