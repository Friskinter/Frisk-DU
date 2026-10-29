import type { Metadata } from "next";
import { editeur, sousTraitants } from "@/lib/legal";
import { Article, Champ, Liste } from "../composants";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function Confidentialite() {
  return (
    <>
      <h1 className="font-serif text-3xl text-encre">Politique de confidentialité</h1>
      <p className="mt-2">
        Cette politique explique comment les données personnelles sont traitées dans Frisk DU, conformément au règlement
        (UE) 2016/679 (RGPD) et à la loi « Informatique et libertés ».
      </p>

      <Article numero="1" titre="Deux rôles distincts">
        <Liste
          elements={[
            <>
              <strong>Frisk est responsable de traitement</strong> pour les comptes des utilisateurs (adresse e-mail, rôle, entreprise de
              rattachement, dates de connexion, journal des modifications) et pour la relation commerciale avec ses clients.
            </>,
            <>
              <strong>Le client est responsable de traitement</strong> pour les données de ses salariés et intervenants qu&apos;il saisit
              dans son espace (noms, postes, tailles d&apos;EPI, signatures, formations, accidents, expositions), ainsi que pour les signalements
              envoyés par ses salariés depuis le lien de signalement de l&apos;entreprise (description, photos, nom facultatif). Frisk agit alors comme
              sous-traitant, selon l&apos;<a href="/legal/traitement" className="text-bronze-fonce underline">accord de traitement des données</a>.
            </>,
          ]}
        />
      </Article>

      <Article numero="2" titre="Données traitées par Frisk en tant que responsable">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-xs">
            <thead className="bg-marbre text-ardoise">
              <tr>
                <th className="p-2">Finalité</th>
                <th className="p-2">Données</th>
                <th className="p-2">Base légale</th>
                <th className="p-2">Durée de conservation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pierre/60">
              <tr>
                <td className="p-2">Gestion des comptes et accès au service</td>
                <td className="p-2">E-mail, mot de passe (chiffré), rôle, entreprise, facteurs de double authentification</td>
                <td className="p-2">Exécution du contrat (art. 6.1.b)</td>
                <td className="p-2">Durée du contrat, puis suppression dans les 30 jours</td>
              </tr>
              <tr>
                <td className="p-2">Sécurité et traçabilité</td>
                <td className="p-2">Journal des modifications (auteur, date, contenu modifié), journaux techniques de connexion</td>
                <td className="p-2">Intérêt légitime : sécurité du service et preuve des modifications (art. 6.1.f)</td>
                <td className="p-2">Journal : durée du contrat ; journaux techniques : 12 mois au plus</td>
              </tr>
              <tr>
                <td className="p-2">Récapitulatif hebdomadaire des alertes</td>
                <td className="p-2">E-mail, alertes de l&apos;espace</td>
                <td className="p-2">Exécution du contrat (art. 6.1.b) ; désactivable dans les réglages</td>
                <td className="p-2">Pas de conservation au-delà de l&apos;envoi</td>
              </tr>
              <tr>
                <td className="p-2">Relation commerciale et facturation</td>
                <td className="p-2">Coordonnées des interlocuteurs du client</td>
                <td className="p-2">Exécution du contrat ; obligations comptables</td>
                <td className="p-2">Durée du contrat + 3 ans ; pièces comptables 10 ans</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Article>

      <Article numero="3" titre="Données de santé">
        <p>
          Le registre des accidents peut contenir des données de santé (nature des lésions, arrêts de travail) et la liste des salariés
          exposés à des produits CMR sert au suivi médical renforcé. Ces données sont traitées pour le compte de l&apos;employeur, au titre
          de ses obligations en matière de santé et de sécurité au travail (article 9.2.b du RGPD). Elles ne sont accessibles qu&apos;aux
          utilisateurs de l&apos;espace concerné et ne figurent jamais dans les e-mails d&apos;alerte. Les signalements envoyés par les salariés
          rejoignent ce registre ; l&apos;e-mail qui prévient les responsables n&apos;indique que le type d&apos;événement, sans description ni lésions.
        </p>
      </Article>

      <Article numero="4" titre="Destinataires et sous-traitants">
        <p>Les données ne sont ni vendues ni cédées. Frisk fait appel aux prestataires techniques suivants :</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-xs">
            <thead className="bg-marbre text-ardoise">
              <tr>
                <th className="p-2">Prestataire</th>
                <th className="p-2">Rôle</th>
                <th className="p-2">Localisation des données</th>
                <th className="p-2">Garanties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pierre/60">
              {sousTraitants.map((s) => (
                <tr key={s.nom}>
                  <td className="p-2">{s.nom}</td>
                  <td className="p-2">{s.role}</td>
                  <td className="p-2">{s.localisation}</td>
                  <td className="p-2">{s.garanties}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Article>

      <Article numero="5" titre="Sécurité">
        <p>
          Connexions chiffrées (HTTPS), mots de passe chiffrés, double authentification, cloisonnement des données de chaque client
          dans la base de données, droits par rôle, journal des modifications, fichiers stockés de façon privée et ouverts par liens
          temporaires, sauvegardes de l&apos;hébergeur.
        </p>
      </Article>

      <Article numero="6" titre="Cookies">
        <p>
          Frisk DU dépose uniquement les cookies strictement nécessaires à la connexion (session d&apos;authentification) et mémorise dans
          le navigateur l&apos;établissement ouvert. Ces traceurs étant indispensables au service, ils ne nécessitent pas de consentement
          (article 82 de la loi « Informatique et libertés »). Aucun cookie de mesure d&apos;audience ou publicitaire n&apos;est utilisé.
        </p>
      </Article>

      <Article numero="7" titre="Vos droits">
        <p>
          Vous disposez des droits d&apos;accès, de rectification, d&apos;effacement, de limitation, d&apos;opposition et de portabilité. Pour les
          données saisies par votre employeur, adressez-vous d&apos;abord à lui : Frisk l&apos;assistera pour répondre. Pour les données dont
          Frisk est responsable, écrivez à <Champ valeur={editeur.email} nom="e-mail de contact" />. Une réponse est apportée dans un
          délai d&apos;un mois.
        </p>
        <p>
          Vous pouvez introduire une réclamation auprès de la CNIL (www.cnil.fr, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07).
        </p>
      </Article>

      <Article numero="8" titre="Contact">
        <p>
          <Champ valeur={editeur.raisonSociale} nom="Raison sociale" />, <Champ valeur={editeur.siege} nom="adresse du siège" /> ·{" "}
          <Champ valeur={editeur.email} nom="e-mail de contact" />
        </p>
      </Article>
    </>
  );
}
