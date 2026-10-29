import type { Metadata } from "next";
import { editeur, sousTraitants } from "@/lib/legal";
import { Article, Champ, Liste } from "../composants";

export const metadata: Metadata = { title: "Accord de traitement des données" };

export default function AccordTraitement() {
  return (
    <>
      <h1 className="font-serif text-3xl text-encre">Accord de traitement des données</h1>
      <p className="mt-2">
        Accord conclu en application de l&apos;article 28 du RGPD entre le client, <strong>responsable de traitement</strong>, et{" "}
        <Champ valeur={editeur.raisonSociale} nom="raison sociale" />, <strong>sous-traitant</strong>, pour les données personnelles
        saisies dans Frisk Plateforme. Il fait partie des conditions générales d&apos;utilisation et s&apos;applique pendant toute la durée du contrat.
      </p>

      <Article numero="1" titre="Description du traitement">
        <Liste
          elements={[
            <><strong>Objet et finalité</strong> : mise à disposition d&apos;un outil de prévention des risques professionnels (document unique, plan d&apos;actions, accidents, formations, vérifications, produits chimiques, pénibilité, EPI).</>,
            <><strong>Nature des opérations</strong> : hébergement, enregistrement, consultation, modification, export, production de documents, envoi d&apos;alertes, suppression.</>,
            <><strong>Personnes concernées</strong> : salariés, intérimaires et intervenants du client ; utilisateurs du service.</>,
            <><strong>Données</strong> : identité, service et poste ; tailles d&apos;EPI et signatures de remise ; formations et habilitations avec leurs attestations ; expositions aux risques, à la pénibilité et aux produits chimiques ; accidents et presque-accidents, y compris des données de santé (nature des lésions, arrêts de travail).</>,
            <><strong>Durée</strong> : durée du contrat, puis 30 jours pour permettre l&apos;export avant suppression.</>,
          ]}
        />
      </Article>

      <Article numero="2" titre="Obligations du sous-traitant">
        <p>Le sous-traitant s&apos;engage à :</p>
        <Liste
          elements={[
            "ne traiter les données que sur instruction documentée du client, constituée par le contrat, les présentes conditions et l'utilisation du service, et l'informer si une instruction lui paraît contraire à la réglementation ;",
            "garantir la confidentialité des données et veiller à ce que les personnes autorisées à y accéder soient soumises à une obligation de confidentialité ;",
            "mettre en œuvre les mesures de sécurité décrites en annexe ;",
            "aider le client à répondre aux demandes d'exercice des droits des personnes concernées, à réaliser une analyse d'impact si nécessaire et à respecter ses obligations de sécurité ;",
            "notifier au client toute violation de données personnelles dans les meilleurs délais et au plus tard 48 heures après en avoir pris connaissance, avec les informations utiles à sa propre notification à la CNIL ;",
            "tenir un registre des traitements effectués pour le compte du client ;",
            "mettre à disposition du client les informations nécessaires pour démontrer le respect de ces obligations et permettre des audits, à ses frais, moyennant un préavis de 30 jours et dans le respect de la confidentialité des autres clients.",
          ]}
        />
      </Article>

      <Article numero="3" titre="Sous-traitants ultérieurs">
        <p>
          Le client autorise le recours aux sous-traitants ultérieurs suivants. Frisk l&apos;informe de tout ajout ou remplacement au moins
          30 jours à l&apos;avance ; le client peut s&apos;y opposer pour un motif légitime et, à défaut d&apos;accord, résilier le contrat sans
          pénalité. Frisk impose à chacun des obligations de protection équivalentes et reste responsable de leur respect.
        </p>
        <Liste elements={sousTraitants.map((s) => <><strong>{s.nom}</strong> : {s.role.toLowerCase()} ({s.localisation}). {s.garanties}.</>)} />
      </Article>

      <Article numero="4" titre="Obligations du client">
        <Liste
          elements={[
            "fournir au sous-traitant des données licites et limitées à ce qui est nécessaire ;",
            "informer les personnes concernées du traitement ;",
            "gérer les comptes de ses utilisateurs et leurs droits d'accès ;",
            "documenter par écrit toute instruction particulière.",
          ]}
        />
      </Article>

      <Article numero="5" titre="Sort des données">
        <p>
          À la fin du contrat, le client peut exporter l&apos;intégralité de ses données pendant 30 jours. Au-delà, le sous-traitant
          supprime définitivement les données et les fichiers joints, et le confirme par écrit sur demande. Les sauvegardes de
          l&apos;hébergeur sont écrasées selon leur cycle normal de rotation.
        </p>
      </Article>

      <Article titre="Annexe : mesures de sécurité">
        <Liste
          elements={[
            "Chiffrement des échanges (HTTPS / TLS) et chiffrement des données au repos par l'hébergeur.",
            "Cloisonnement de chaque client par des règles d'accès appliquées par la base de données elle-même (sécurité au niveau des lignes).",
            "Rôles différenciés (responsable, contributeur, lecteur) vérifiés côté serveur pour chaque modification.",
            "Journal des modifications : auteur, date et contenu avant et après chaque changement.",
            "Mots de passe d'au moins 10 caractères, mot de passe provisoire à changer à la première connexion, double authentification par application.",
            "Fichiers (attestations, rapports, fiches de données de sécurité) dans un stockage privé, ouverts par des liens valables une minute.",
            "Clé d'administration de la base réservée aux serveurs, jamais exposée dans le navigateur.",
            "Versions du document unique figées et non modifiables.",
            "Tests automatisés des règles d'accès à chaque évolution du service.",
          ]}
        />
      </Article>
    </>
  );
}
