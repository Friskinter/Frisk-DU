import type { Metadata } from "next";
import { editeur, regionDonnees, sousTraitants } from "@/lib/legal";
import { Article, Champ } from "../composants";

export const metadata: Metadata = { title: "Mentions légales" };

export default function MentionsLegales() {
  return (
    <>
      <h1 className="font-serif text-3xl text-encre">Mentions légales</h1>
      <p className="mt-2">
        Informations prévues par l&apos;article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie
        numérique, concernant le service en ligne Frisk Plateforme.
      </p>

      <Article titre="Éditeur">
        <p>
          <Champ valeur={editeur.raisonSociale} nom="Raison sociale" /> ({editeur.nomCommercial}),{" "}
          <Champ valeur={editeur.formeJuridique} nom="forme juridique" /> au capital de <Champ valeur={editeur.capital} nom="capital" />.
          <br />
          Siège social : <Champ valeur={editeur.siege} nom="adresse du siège" />
          <br />
          Immatriculation : <Champ valeur={editeur.rcs} nom="RCS ou SIREN" />
          <br />
          TVA intracommunautaire : <Champ valeur={editeur.tva} nom="numéro de TVA" />
          <br />
          Téléphone : <Champ valeur={editeur.telephone} nom="téléphone" /> · E-mail : <Champ valeur={editeur.email} nom="e-mail" />
        </p>
        <p>
          Directeur de la publication : <Champ valeur={editeur.directeurPublication} nom="nom du représentant légal" />
        </p>
      </Article>

      <Article titre="Hébergement">
        {sousTraitants.slice(0, 2).map((s) => (
          <p key={s.nom}>
            <strong>{s.nom}</strong> ({s.role.toLowerCase()}) : {s.adresse}.
          </p>
        ))}
        <p>
          Les données des clients sont stockées dans la région : <Champ valeur={regionDonnees} nom="région d'hébergement" />.
        </p>
      </Article>

      <Article titre="Propriété intellectuelle">
        <p>
          Le service Frisk Plateforme, son code, ses textes, ses grilles de cotation, ses référentiels et ses éléments graphiques sont la
          propriété de {editeur.nomCommercial}. Toute reproduction ou réutilisation sans autorisation écrite est interdite. Les données
          saisies par les clients restent leur propriété.
        </p>
      </Article>

      <Article titre="Données personnelles et cookies">
        <p>
          Le traitement des données personnelles est décrit dans la <a href="/legal/confidentialite" className="text-bronze-fonce underline">politique de confidentialité</a>.
          Frisk Plateforme n&apos;utilise que des cookies strictement nécessaires à la connexion ; aucun cookie de mesure d&apos;audience ou
          publicitaire n&apos;est déposé.
        </p>
      </Article>
    </>
  );
}
