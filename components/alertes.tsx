"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { alertesAffichees, calculerAlertes, type Alerte } from "@/lib/alertes";
import { alertesNouvelles, empreinte, vuesDepuis } from "@/lib/alertes-vues";
import { formaterDate } from "@/lib/calculs";
import { CLE_ALERTES_VUES_TEST, MODE_TEST } from "@/lib/mode-test";
import { useSession } from "@/lib/stockage";
import { supabaseNavigateur } from "@/lib/supabase/client";
import type { Donnees } from "@/lib/types";
import { useVersions } from "@/lib/versions";

const styles: Record<Alerte["gravite"], { couleur: string; texte: string; icone: string; libelle: string }> = {
  critique: { couleur: "#d03b3b", texte: "#ffffff", icone: "‼", libelle: "Urgent" },
  importante: { couleur: "#ec835a", texte: "#0b0b0b", icone: "!", libelle: "À traiter" },
  info: { couleur: "#fab219", texte: "#0b0b0b", icone: "i", libelle: "À surveiller" },
};

// Encart « À traiter » du tableau de bord.
export function Alertes({ donnees, aujourdhui }: { donnees: Donnees; aujourdhui: string }) {
  const session = useSession();
  const { versions, chargement, erreur } = useVersions(session.entrepriseId);
  // Tant que les versions ne sont pas connues, on n'affiche pas d'alerte de mise à jour annuelle.
  const derniere = chargement || erreur ? undefined : versions[0] ? versions[0].created_at.slice(0, 10) : null;
  const alertes = calculerAlertes(donnees, aujourdhui, derniere);
  // Les alertes de mise à jour annuelle dépendent du chargement des versions : elles ne sont pas suivies.
  const nouvelles = useAlertesNouvelles(session.entrepriseId, session.admin, alertes.filter((a) => !a.id.startsWith("version-")));
  const [categorie, setCategorie] = useState("");
  const [tout, setTout] = useState(false);

  if (!alertes.length) {
    // Entreprise qui démarre : rien à dire tant qu'aucun risque n'est évalué (l'assistant guide).
    if (!donnees.duerp.length) return null;
    return (
      <div className="mb-6 rounded-sm border border-[#0ca30c] bg-[#0ca30c]/10 p-4 text-sm">
        <strong>✓ Rien d&apos;urgent.</strong> Aucune action en retard, aucun stock en rupture, DUERP à jour.
      </div>
    );
  }

  const urgentes = alertes.filter((a) => a.gravite === "critique").length;
  const categories = [...new Set(alertes.map((a) => a.categorie))].sort((a, b) => a.localeCompare(b, "fr"));
  const affichees = alertesAffichees(alertes, nouvelles, categorie, tout);
  const masquees = alertes.length - affichees.length;

  return (
    <section className="mb-6 rounded-sm border border-pierre/70 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-pierre/60 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ardoise">
          À traiter ({alertes.length})
          {urgentes > 0 && <span className="ml-1 normal-case tracking-normal text-[#b42318]">dont {urgentes} urgent{urgentes > 1 ? "s" : ""}</span>}
          {nouvelles.size > 0 && (
            <span className="ml-2 rounded-full bg-encre px-2 py-0.5 text-xs font-medium normal-case tracking-normal text-marbre">
              {nouvelles.size} nouvelle{nouvelles.size > 1 ? "s" : ""} depuis votre dernière visite
            </span>
          )}
        </h2>
        {categories.length > 1 && (
          <select
            aria-label="Filtrer les points à traiter par module"
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
            className="rounded-sm border border-pierre bg-white px-2 py-1 text-sm"
          >
            <option value="">Tous les modules</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c} ({alertes.filter((a) => a.categorie === c).length})
              </option>
            ))}
          </select>
        )}
      </div>
      <ul className="divide-y divide-pierre/40">
        {affichees.map((a) => {
          const st = styles[a.gravite];
          return (
            <li key={a.id}>
              <Link href={a.lien} className="flex items-start gap-3 px-4 py-3 text-sm hover:bg-ivoire">
                <span
                  className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ background: st.couleur, color: st.texte }}
                >
                  <span aria-hidden>{st.icone}</span>
                  {st.libelle}
                </span>
                <span className="min-w-0 flex-1">
                  {nouvelles.has(a.id) && (
                    <span className="mr-1.5 rounded-sm bg-encre px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-marbre">Nouveau</span>
                  )}
                  <span className="font-medium">{a.titre}</span>
                  <span className="text-gris"> · {a.categorie}</span>
                  <span className="mt-0.5 block text-ardoise">{a.detail}</span>
                  {a.date && (
                    <span className={`mt-0.5 block text-xs ${a.date < aujourdhui ? "text-[#b42318]" : "text-gris"}`}>
                      {a.date < aujourdhui ? `En retard depuis le ${formaterDate(a.date)}` : `Prochaine échéance le ${formaterDate(a.date)}`}
                    </span>
                  )}
                </span>
                <span aria-hidden className="text-gris">→</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {!categorie && (masquees > 0 || tout) && (
        <button
          type="button"
          onClick={() => setTout(!tout)}
          className="block w-full border-t border-pierre/60 px-4 py-2.5 text-left text-sm text-bronze-fonce underline hover:bg-ivoire"
        >
          {tout ? "Afficher seulement l'essentiel" : `Voir les ${masquees} autre${masquees > 1 ? "s" : ""} point${masquees > 1 ? "s" : ""} à traiter`}
        </button>
      )}
      <details className="border-t border-pierre/60 px-4 py-3 text-sm">
        <summary className="cursor-pointer text-ardoise">Comment sont classées les priorités ?</summary>
        <div className="mt-2 space-y-2 text-ardoise">
          <p>
            <strong>Urgent</strong> : une obligation n&apos;est pas respectée ou un danger n&apos;est pas maîtrisé (action en
            retard, vérification dépassée, équipement non conforme, risque critique sans action, accident à déclarer,
            formation exigée manquante, produit cancérogène sans mesures, intervention sans plan de prévention…).
          </p>
          <p>
            <strong>À traiter</strong> : une échéance approche ou une information manque (action dans les 15 jours,
            vérification dans les 30 jours, formation qui expire, fiche de sécurité absente, stock d&apos;EPI sous le seuil…).
          </p>
          <p>
            <strong>À surveiller</strong> : un rappel ou une bonne pratique (recyclage à planifier dans les 3 mois, causerie à
            organiser, efficacité d&apos;une action à vérifier…).
          </p>
          <p>
            À niveau égal, le retard le plus ancien ou l&apos;échéance la plus proche passe en premier. Ces repères aident à
            s&apos;organiser : ils ne constituent pas une évaluation de conformité réglementaire.
          </p>
        </div>
      </details>
    </section>
  );
}

// Alertes nouvelles depuis la dernière visite de la personne connectée, puis enregistrement de
// celles qu'elle vient de voir. Le repère reste affiché pendant toute la visite.
function useAlertesNouvelles(entrepriseId: string, admin: boolean, alertes: Alerte[]) {
  const [nouvelles, setNouvelles] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Les administrateurs Frisk ne sont pas membres de l'entreprise : pas de suivi pour eux.
    if (admin) return;
    let actif = true;
    const vuesMaintenant = alertes.map(empreinte);
    const traiter = (lignes: { empreinte: string }[]) => {
      if (!actif) return;
      setNouvelles(alertesNouvelles(alertes, vuesDepuis(lignes)));
      if (MODE_TEST) {
        try {
          localStorage.setItem(CLE_ALERTES_VUES_TEST, JSON.stringify(["__visite__", ...vuesMaintenant]));
        } catch {
          // Sans stockage local, le test ne suit pas les visites.
        }
        return;
      }
      void supabaseNavigateur().rpc("marquer_alertes_vues", { p_entreprise: entrepriseId, p_empreintes: vuesMaintenant });
    };
    if (MODE_TEST) {
      let lues: string[] = [];
      try {
        lues = JSON.parse(localStorage.getItem(CLE_ALERTES_VUES_TEST) ?? "[]");
      } catch {
        lues = [];
      }
      traiter(lues.map((e) => ({ empreinte: e })));
    } else {
      supabaseNavigateur()
        .from("alertes_vues")
        .select("empreinte")
        .eq("entreprise_id", entrepriseId)
        .then(({ data }: { data: { empreinte: string }[] | null }) => traiter(data ?? []));
    }
    return () => {
      actif = false;
    };
    // Une seule lecture par visite : les alertes qui changent pendant la visite ne relancent rien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrepriseId, admin]);

  return nouvelles;
}
