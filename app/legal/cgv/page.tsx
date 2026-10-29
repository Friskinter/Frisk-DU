import type { Metadata } from "next";
import { DUREE_ESSAI_JOURS } from "@/lib/abonnement";
import { editeur } from "@/lib/legal";
import { Article, Champ, Liste } from "../composants";

export const metadata: Metadata = { title: "Conditions générales de vente" };

// Projet de conditions générales de vente de l'abonnement en ligne : à faire relire par un juriste.
export default function Cgv() {
  return (
    <>
      <h1 className="font-serif text-3xl text-encre">Conditions générales de vente</h1>
      <p className="mt-2">
        Les présentes conditions s&apos;appliquent aux abonnements à Frisk Plateforme souscrits en ligne auprès de{" "}
        <Champ valeur={editeur.raisonSociale} nom="raison sociale" /> (« Frisk »). Elles complètent les conditions générales
        d&apos;utilisation. Le service est réservé aux professionnels (entreprises, associations, collectivités) : les dispositions du
        Code de la consommation relatives au droit de rétractation ne s&apos;appliquent pas.
      </p>

      <Article numero="1" titre="Essai gratuit">
        <p>
          Chaque nouvelle entreprise bénéficie d&apos;un essai gratuit de {DUREE_ESSAI_JOURS} jours, sans moyen de paiement demandé.
          Pendant l&apos;essai, le document unique, le plan d&apos;actions et la liste des salariés sont utilisables ; les autres modules sont
          présentés en aperçu. Les documents produits pendant l&apos;essai portent la mention « Version d&apos;essai » et aucune version
          officielle du document unique ne peut être figée.
        </p>
        <p>
          À la fin de l&apos;essai, sans abonnement, l&apos;espace passe en lecture seule : les données restent consultables et exportables.
          Si aucun abonnement n&apos;est souscrit, Frisk peut les supprimer 12 mois après la fin de l&apos;essai, après en avoir informé
          le client par e-mail.
        </p>
      </Article>

      <Article numero="2" titre="Offres et prix">
        <p>
          Le prix de l&apos;abonnement dépend de l&apos;effectif de l&apos;entreprise (tranches présentées sur la page Abonnement de
          l&apos;espace) et de la périodicité choisie, mensuelle ou annuelle. Les prix sont indiqués hors taxes ; la TVA applicable est
          ajoutée sur la facture. Les entreprises de 250 salariés et plus bénéficient d&apos;une offre sur devis.
        </p>
        <p>
          Le client choisit la tranche correspondant à son effectif. Si l&apos;effectif dépasse durablement la tranche souscrite, Frisk
          peut proposer le passage à la tranche supérieure, appliqué à la période suivante.
        </p>
      </Article>

      <Article numero="3" titre="Paiement">
        <p>
          Le paiement s&apos;effectue en ligne par carte bancaire ou prélèvement SEPA, par l&apos;intermédiaire du prestataire de paiement
          Stripe. Frisk n&apos;a pas accès aux numéros de carte. L&apos;abonnement est payable d&apos;avance, au début de chaque période ; une
          facture est disponible dans l&apos;espace de gestion de l&apos;abonnement.
        </p>
        <p>
          En cas d&apos;échec du paiement, de nouvelles tentatives sont faites pendant quelques jours et le client est invité à mettre à
          jour son moyen de paiement ; l&apos;accès est maintenu pendant cette période. Si le paiement n&apos;aboutit pas, l&apos;abonnement
          prend fin et l&apos;espace passe en lecture seule. Tout retard de paiement entraîne, de plein droit, des pénalités au taux
          d&apos;intérêt légal multiplié par trois et une indemnité forfaitaire pour frais de recouvrement de 40 € (articles L441-10 et
          D441-5 du Code de commerce).
        </p>
      </Article>

      <Article numero="4" titre="Durée, renouvellement et résiliation">
        <Liste
          elements={[
            <>L&apos;abonnement prend effet au paiement et se renouvelle automatiquement pour une même période (mois ou année).</>,
            <>
              Le client peut le résilier à tout moment depuis l&apos;espace de gestion de l&apos;abonnement : la résiliation prend effet à la
              fin de la période en cours, déjà payée, sans remboursement au prorata.
            </>,
            <>Le client peut changer de tranche ou de périodicité ; le changement est calculé au prorata par le prestataire de paiement.</>,
            <>Frisk peut résilier l&apos;abonnement en cas de manquement grave du client, dans les conditions des CGU.</>,
          ]}
        />
      </Article>

      <Article numero="5" titre="Données après la fin de l'abonnement">
        <p>
          À la fin de l&apos;abonnement, l&apos;espace passe en lecture seule : le client conserve l&apos;accès à ses données et peut les
          exporter. Les versions figées du document unique restent consultables. Frisk peut supprimer les données 12 mois après la fin
          de l&apos;abonnement, après en avoir informé le client par e-mail, ou plus tôt à sa demande. Il appartient au client de conserver
          une copie de son document unique pendant la durée exigée par la loi (40 ans pour les versions successives).
        </p>
      </Article>

      <Article numero="6" titre="Évolution des prix">
        <p>
          Frisk peut faire évoluer ses prix. Le client en est informé par e-mail au moins 30 jours avant leur application, qui
          intervient au renouvellement suivant ; il peut résilier avant cette date.
        </p>
      </Article>

      <Article numero="7" titre="Droit applicable et litiges">
        <p>
          Les présentes conditions sont soumises au droit français. À défaut d&apos;accord amiable, tout litige relève des tribunaux
          compétents de <Champ valeur={editeur.ville} nom="ville du siège" />.
        </p>
      </Article>
    </>
  );
}
