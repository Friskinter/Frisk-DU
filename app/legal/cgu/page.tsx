import type { Metadata } from "next";
import { editeur } from "@/lib/legal";
import { Article, Champ, Liste } from "../composants";

export const metadata: Metadata = { title: "Conditions générales d'utilisation" };

export default function Cgu() {
  return (
    <>
      <h1 className="font-serif text-3xl text-encre">Conditions générales d&apos;utilisation</h1>
      <p className="mt-2">
        Les présentes conditions encadrent l&apos;utilisation du service Frisk DU, édité par{" "}
        <Champ valeur={editeur.raisonSociale} nom="raison sociale" /> (« Frisk »). Le prix et la durée de l&apos;abonnement sont fixés par les{" "}
        conditions générales de vente (abonnement en ligne) ou par le contrat signé avec Frisk ; en cas de contradiction, le contrat
        prévaut.
      </p>

      <Article numero="1" titre="Définitions">
        <Liste
          elements={[
            <><strong>Client</strong> : l&apos;entreprise ou l&apos;organisme qui a souscrit au service.</>,
            <><strong>Utilisateur</strong> : toute personne disposant d&apos;un compte rattaché à l&apos;espace du client (responsable, contributeur, lecteur).</>,
            <><strong>Espace</strong> : l&apos;ensemble des données d&apos;un établissement du client (document unique, plan d&apos;actions, accidents, formations, vérifications, produits chimiques, EPI).</>,
            <><strong>Données du client</strong> : toutes les informations saisies ou importées dans l&apos;espace, y compris les fichiers joints.</>,
          ]}
        />
      </Article>

      <Article numero="2" titre="Objet du service">
        <p>
          Frisk DU est un outil en ligne d&apos;aide à l&apos;évaluation et à la prévention des risques professionnels : document unique
          d&apos;évaluation des risques (DUERP), plan d&apos;actions, suivi des accidents, des formations, des vérifications périodiques, des
          produits chimiques, de la pénibilité et des équipements de protection individuelle.
        </p>
        <p>
          <strong>Frisk DU est un outil : il ne se substitue pas à l&apos;évaluation des risques que l&apos;employeur doit réaliser.</strong>{" "}
          L&apos;employeur reste seul responsable du contenu de son document unique, des cotations retenues et des mesures de prévention
          (articles L4121-1 et suivants du Code du travail). Les grilles, bibliothèques de risques, périodicités et rappels
          réglementaires proposés sont indicatifs ; il appartient au client de vérifier qu&apos;ils correspondent à sa situation et aux
          textes en vigueur.
        </p>
      </Article>

      <Article numero="3" titre="Comptes et accès">
        <Liste
          elements={[
            "Les comptes sont créés par Frisk à la demande du client. Le client désigne ses utilisateurs et leur rôle, et informe Frisk de tout départ.",
            "Les identifiants sont personnels et confidentiels. L'utilisateur choisit un mot de passe d'au moins 10 caractères et peut activer la double authentification, recommandée pour les responsables.",
            "Le client est responsable de l'usage fait des comptes de ses utilisateurs. Toute utilisation suspecte doit être signalée sans délai à Frisk.",
          ]}
        />
      </Article>

      <Article numero="4" titre="Obligations du client">
        <Liste
          elements={[
            "Saisir des informations exactes et licites, et ne les utiliser que pour la prévention des risques professionnels et la gestion de la santé et de la sécurité au travail.",
            "Ne saisir que les données personnelles nécessaires, en particulier pour les données de santé (lésions, suivi médical) : jamais de diagnostic détaillé ni d'information médicale sans lien avec la prévention.",
            "Informer ses salariés du traitement de leurs données dans Frisk DU, en tant que responsable de ce traitement.",
            "Conserver lui-même les versions de son document unique pendant la durée légale de 40 ans (article R4121-4 du Code du travail), Frisk DU permettant leur export en PDF.",
            "Ne pas tenter d'accéder aux données d'autres clients, de contourner les mesures de sécurité ou de perturber le service.",
          ]}
        />
      </Article>

      <Article numero="5" titre="Disponibilité et évolution">
        <p>
          Frisk met en œuvre les moyens raisonnables pour assurer l&apos;accès au service 24 h/24 et 7 j/7, sous réserve des opérations de
          maintenance et des incidents chez ses hébergeurs. Il s&apos;agit d&apos;une obligation de moyens. Frisk peut faire évoluer les
          fonctionnalités du service ; une évolution qui supprimerait une fonctionnalité essentielle est annoncée au moins un mois à
          l&apos;avance.
        </p>
      </Article>

      <Article numero="6" titre="Données du client">
        <Liste
          elements={[
            "Le client reste propriétaire de ses données. Frisk ne les utilise que pour fournir le service et n'en fait aucun usage commercial.",
            "Le client peut à tout moment exporter ses données (sauvegarde complète, document unique en PDF, tableaux Excel).",
            "À la fin du contrat, les données restent exportables pendant 30 jours, puis sont supprimées définitivement, fichiers joints compris, sauf demande contraire du client ou obligation légale.",
          ]}
        />
        <p>
          Les traitements de données personnelles effectués pour le compte du client sont régis par l&apos;
          <a href="/legal/traitement" className="text-bronze-fonce underline">accord de traitement des données</a>, qui fait partie des présentes conditions.
        </p>
      </Article>

      <Article numero="7" titre="Sécurité">
        <p>
          Frisk met en œuvre des mesures de sécurité adaptées : connexions chiffrées, cloisonnement des données de chaque client au niveau
          de la base de données, droits par rôle, journal des modifications, fichiers privés accessibles par liens temporaires,
          double authentification. Le détail figure en annexe de l&apos;accord de traitement des données.
        </p>
      </Article>

      <Article numero="8" titre="Responsabilité">
        <p>
          Frisk est responsable des dommages directs résultant d&apos;un manquement prouvé à ses obligations. Sa responsabilité ne peut être
          engagée pour les décisions prises par le client sur la base du service, ni pour le contenu saisi par le client. Sauf faute
          lourde ou intentionnelle, la responsabilité totale de Frisk est limitée aux sommes payées par le client au cours des douze
          mois précédant le fait générateur.
        </p>
      </Article>

      <Article numero="9" titre="Propriété intellectuelle">
        <p>
          Frisk concède au client, pour la durée du contrat, un droit d&apos;utilisation personnel et non transférable du service.
          Les documents produits par le service (document unique, registres, notices) appartiennent au client.
        </p>
      </Article>

      <Article numero="10" titre="Suspension et résiliation">
        <p>
          Frisk peut suspendre un accès en cas d&apos;usage contraire aux présentes conditions, de risque pour la sécurité du service ou
          de défaut de paiement, après mise en demeure restée sans effet pendant 15 jours (sauf urgence de sécurité). Les conditions
          de résiliation de l&apos;abonnement sont fixées par les conditions générales de vente ou par le contrat.
        </p>
      </Article>

      <Article numero="11" titre="Modification des conditions">
        <p>
          Frisk peut modifier les présentes conditions. Les utilisateurs sont informés à leur connexion et doivent accepter la nouvelle
          version pour continuer à utiliser le service.
        </p>
      </Article>

      <Article numero="12" titre="Droit applicable et litiges">
        <p>
          Les présentes conditions sont soumises au droit français. À défaut d&apos;accord amiable, tout litige entre professionnels
          relève des tribunaux compétents de <Champ valeur={editeur.ville} nom="ville du siège" />.
        </p>
      </Article>
    </>
  );
}
