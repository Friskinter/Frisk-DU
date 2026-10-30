"use client";

import Link from "next/link";
import { calculerAlertes, type Alerte } from "@/lib/alertes";
import { formaterDate } from "@/lib/calculs";
import { useSession } from "@/lib/stockage";
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

  if (!alertes.length) {
    // Entreprise qui démarre : rien à dire tant qu'aucun risque n'est évalué (l'assistant guide).
    if (!donnees.duerp.length) return null;
    return (
      <div className="mb-6 rounded-sm border border-[#0ca30c] bg-[#0ca30c]/10 p-4 text-sm">
        <strong>✓ Rien d&apos;urgent.</strong> Aucune action en retard, aucun stock en rupture, DUERP à jour.
      </div>
    );
  }

  return (
    <section className="mb-6 rounded-sm border border-pierre/70 bg-white">
      <h2 className="border-b border-pierre/60 px-4 py-3 text-sm font-semibold uppercase tracking-wider text-ardoise">
        À traiter ({alertes.length})
      </h2>
      <ul className="divide-y divide-pierre/40">
        {alertes.map((a) => {
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
