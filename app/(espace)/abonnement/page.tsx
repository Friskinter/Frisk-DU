"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Carte, Chargement, EnTetePage, classeBouton } from "@/components/ui";
import { cleTarif, joursRestants, offreConseillee, offres, type CodeOffre, type Periodicite } from "@/lib/abonnement";
import { formaterDate } from "@/lib/calculs";
import { useDonnees, useSession } from "@/lib/stockage";

type Tarifs = { configure: boolean; tarifs: Record<string, { montant: number; devise: string; ht: boolean }> };

const prix = (montant: number, devise: string) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: devise.toUpperCase(), maximumFractionDigits: montant % 1 ? 2 : 0 }).format(montant);

const inclus = [
  "Document unique, plan d'actions et versions officielles datées",
  "Accidents, signalement par QR code et registre des accidents bénins",
  "Formations, vérifications périodiques, produits chimiques",
  "Visites et audits, accueil sécurité et causeries",
  "Entreprises extérieures, pénibilité, EPI et stocks, bilans",
  "Rapport annuel, alertes par e-mail, votre logo sur les documents",
];

export default function PageAbonnement() {
  return (
    <Suspense fallback={<Chargement />}>
      <Abonnement />
    </Suspense>
  );
}

function Abonnement() {
  const donnees = useDonnees();
  const session = useSession();
  const parametres = useSearchParams();
  const [tarifs, setTarifs] = useState<Tarifs | null>(null);
  const [periodicite, setPeriodicite] = useState<Periodicite>("an");
  const [choix, setChoix] = useState<CodeOffre | null>(null);
  const [cgv, setCgv] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    fetch("/api/abonnement/tarifs")
      .then((r) => r.json())
      .then(setTarifs)
      .catch(() => setTarifs({ configure: false, tarifs: {} }));
  }, []);

  // Retour du paiement : l'abonnement s'active à la réception de la confirmation de Stripe.
  const retourPaiement = parametres.get("paiement") === "ok";
  useEffect(() => {
    if (!retourPaiement || (session.abonnement.acces === "complet" && session.abonnement.stripe)) return;
    // Quelques nouvelles lectures au plus (une minute environ) ; ensuite, l'utilisateur recharge lui-même.
    let essais = 0;
    try {
      essais = Number(sessionStorage.getItem("frisk-retour-paiement") ?? 0);
      sessionStorage.setItem("frisk-retour-paiement", String(essais + 1));
    } catch {
      // Stockage indisponible : une seule nouvelle lecture.
      essais = 12;
    }
    if (essais > 11) return;
    const minuteur = setTimeout(() => window.location.reload(), 5000);
    return () => clearTimeout(minuteur);
  }, [retourPaiement, session.abonnement.acces, session.abonnement.stripe]);

  if (!donnees) return <Chargement />;
  const a = session.abonnement;
  const responsable = session.roleCompte === "responsable" || session.admin;
  const offre = choix ?? offreConseillee(donnees.fiche?.effectif);
  const abonne = (a.statut === "actif" || a.statut === "impaye") && a.stripe;

  const ouvrir = async (adresse: string, corps: object) => {
    setEnvoi(true);
    setErreur("");
    try {
      const r = await fetch(adresse, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) });
      const reponse = (await r.json()) as { url?: string; erreur?: string };
      if (reponse.url) {
        window.location.assign(reponse.url);
        return;
      }
      setErreur(reponse.erreur ?? "Une erreur est survenue. Réessayez.");
    } catch {
      setErreur("Pas de connexion. Réessayez dans un instant.");
    }
    setEnvoi(false);
  };

  const etat =
    a.acces === "essai"
      ? `Essai gratuit : ${joursRestants(a.essaiFin) > 1 ? `${joursRestants(a.essaiFin)} jours restants` : "dernier jour"} (jusqu'au ${formaterDate(a.essaiFin!.slice(0, 10))}).`
      : a.acces === "lecture"
        ? a.statut === "essai"
          ? "Essai gratuit terminé : l'espace est en lecture seule."
          : "Abonnement terminé : l'espace est en lecture seule."
        : a.statut === "impaye"
          ? "Le dernier paiement n'a pas abouti : mettez à jour votre moyen de paiement."
          : a.stripe
            ? `Abonnement actif${a.offre ? ` · ${offres.find((o) => o.code === a.offre)?.libelle ?? ""}` : ""}${a.periodicite ? `, paiement ${a.periodicite === "an" ? "annuel" : "mensuel"}` : ""}${a.fin ? ` · prochaine échéance le ${formaterDate(a.fin.slice(0, 10))}` : ""}.`
            : "Abonnement actif, géré directement avec Frisk.";

  return (
    <div className="space-y-6">
      <EnTetePage titre="Abonnement" description="Tout Frisk Plateforme pour votre entreprise, sans engagement de durée." />

      {retourPaiement && (
        <div role="status" className="rounded-sm border border-[#0ca30c]/60 bg-[#0ca30c]/10 p-3 text-sm">
          <strong>Merci !</strong>{" "}
          {a.acces === "complet" && a.stripe
            ? "Votre abonnement est actif : tous les modules sont ouverts."
            : "Le paiement est enregistré ; l'activation prend quelques secondes, la page se met à jour toute seule."}
        </div>
      )}

      <Carte titre="Votre situation">
        <p className="text-sm">{etat}</p>
        {abonne && responsable && (
          <div className="mt-3">
            <button type="button" disabled={envoi} className={`${classeBouton} disabled:opacity-60`} onClick={() => ouvrir("/api/abonnement/portail", { entrepriseId: session.entrepriseId })}>
              Gérer mon abonnement
            </button>
            <p className="mt-2 text-xs text-gris">Moyen de paiement, factures, changement d&apos;offre ou résiliation, sur l&apos;espace sécurisé de Stripe.</p>
          </div>
        )}
        {!responsable && <p className="mt-2 text-sm text-ardoise">Seul un responsable de votre entreprise peut gérer l&apos;abonnement.</p>}
        {erreur && abonne && <p role="alert" className="mt-2 text-sm text-[#b42318]">{erreur}</p>}
      </Carte>

      {!abonne && !(a.statut === "actif" && !a.stripe) && (
        <Carte titre="Choisir mon abonnement">
          <div className="mb-4 inline-flex rounded-sm border border-pierre" role="group" aria-label="Périodicité">
            {(["mois", "an"] as Periodicite[]).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={periodicite === p}
                onClick={() => setPeriodicite(p)}
                className={`px-3 py-1.5 text-sm ${periodicite === p ? "bg-encre text-marbre" : "bg-white text-ardoise"}`}
              >
                {p === "mois" ? "Mensuel" : "Annuel"}
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {offres.map((o) => {
              const t = tarifs?.tarifs[cleTarif(o.code, periodicite)];
              const selection = offre === o.code;
              return (
                <button
                  key={o.code}
                  type="button"
                  aria-pressed={selection}
                  onClick={() => setChoix(o.code)}
                  className={`rounded-sm border bg-white p-4 text-left transition-colors ${selection ? "border-bronze ring-2 ring-bronze" : "border-pierre hover:border-bronze"}`}
                >
                  <span className="block text-sm font-semibold">{o.libelle}</span>
                  <span className="mt-2 block font-serif text-2xl text-titre">
                    {t ? prix(t.montant, t.devise) : "—"}
                    <span className="ml-1 font-sans text-xs text-gris">{t ? `${t.ht ? "HT" : "TTC"} / ${periodicite}` : "prix à venir"}</span>
                  </span>
                  {o.code === offreConseillee(donnees.fiche?.effectif) && <span className="mt-2 block text-xs text-bronze-fonce">Conseillé pour votre effectif</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-gris">250 salariés et plus, plusieurs établissements : contactez Frisk pour une offre sur mesure.</p>

          <ul className="mt-4 grid gap-1.5 text-sm sm:grid-cols-2">
            {inclus.map((x) => (
              <li key={x} className="flex gap-2">
                <span aria-hidden className="text-bronze-fonce">✓</span>
                {x}
              </li>
            ))}
          </ul>

          {responsable && (
            <div className="mt-5 space-y-3 border-t border-pierre/60 pt-4">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1 accent-bronze" checked={cgv} onChange={(e) => setCgv(e.target.checked)} />
                <span>
                  J&apos;accepte les{" "}
                  <Link href="/legal/cgv" target="_blank" className="underline">conditions générales de vente</Link> pour le compte de mon
                  entreprise.
                </span>
              </label>
              {tarifs && !tarifs.configure && (
                <p className="text-sm text-ardoise">Le paiement en ligne arrive bientôt : contactez Frisk pour vous abonner dès maintenant.</p>
              )}
              {erreur && <p role="alert" className="text-sm text-[#b42318]">{erreur}</p>}
              <button
                type="button"
                disabled={!cgv || envoi || !tarifs?.configure}
                className={`${classeBouton} disabled:opacity-60`}
                onClick={() => ouvrir("/api/abonnement/paiement", { entrepriseId: session.entrepriseId, offre, periodicite, cgv })}
              >
                {envoi ? "Ouverture du paiement…" : "Payer en ligne"}
              </button>
              <p className="text-xs text-gris">Paiement sécurisé par Stripe (carte bancaire ou prélèvement SEPA). Résiliable à tout moment.</p>
            </div>
          )}
        </Carte>
      )}

      <p className="text-sm text-ardoise">
        Vos données vous appartiennent : téléchargez-en une copie à tout moment depuis{" "}
        <Link href="/reglages" className="underline">Salariés &amp; réglages</Link>, rubrique Données.
      </p>
    </div>
  );
}
