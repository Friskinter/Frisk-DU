"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { classeBouton } from "@/components/ui";
import { documentsLegaux } from "@/lib/legal";
import { accepterConditions, deconnecter, enregistrementEnAttente, useSession } from "@/lib/stockage";

function Message({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="mx-auto mt-16 max-w-lg rounded-sm border border-pierre/70 bg-white p-8 text-center">
      <h1 className="font-serif text-2xl">{titre}</h1>
      <div className="mt-3 space-y-4 text-sm text-ardoise">{children}</div>
    </div>
  );
}

// Affiche l'espace de l'entreprise seulement quand ses données sont prêtes.
export function Garde({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session.statut === "mot-de-passe-provisoire") router.replace("/mot-de-passe");
  }, [session.statut, router]);

  // Prévient avant de quitter la page si une modification n'est pas encore enregistrée.
  useEffect(() => {
    const avertir = (e: BeforeUnloadEvent) => {
      if (enregistrementEnAttente()) e.preventDefault();
    };
    window.addEventListener("beforeunload", avertir);
    return () => window.removeEventListener("beforeunload", avertir);
  }, []);

  switch (session.statut) {
    case "chargement":
    case "mot-de-passe-provisoire":
      // Les pages affichent elles-mêmes leur état de chargement tant que les données manquent.
      return <>{children}</>;
    case "conditions-a-accepter":
      return <AcceptationConditions />;
    case "aucun-espace":
      return (
        <Message titre="Aucun espace entreprise">
          {session.admin ? (
            <>
              <p>Choisissez l&apos;entreprise à ouvrir depuis la console Frisk.</p>
              <Link href="/console" className={classeBouton}>Ouvrir la console</Link>
            </>
          ) : (
            <>
              <p>Votre compte n&apos;est rattaché à aucune entreprise. Contactez Frisk pour activer votre accès.</p>
              <button type="button" onClick={deconnecter} className="text-bronze underline">Se déconnecter</button>
            </>
          )}
        </Message>
      );
    case "suspendu":
      return (
        <Message titre="Accès suspendu">
          <p>L&apos;accès de votre entreprise à Frisk DU est suspendu. Contactez Frisk pour le réactiver.</p>
          <button type="button" onClick={deconnecter} className="text-bronze underline">Se déconnecter</button>
        </Message>
      );
    case "base-a-mettre-a-jour":
      return (
        <Message titre="Mise à jour en cours">
          {session.admin ? (
            <p>
              La base de données doit être mise à jour pour cette version de Frisk DU : exécutez dans Supabase
              (SQL Editor) les migrations de <code>supabase/migrations</code> qui n&apos;ont pas encore été appliquées.
            </p>
          ) : (
            <p>Frisk DU est en cours de mise à jour. Réessayez dans quelques minutes ; contactez Frisk si cela persiste.</p>
          )}
          <button type="button" onClick={() => window.location.reload()} className={classeBouton}>Réessayer</button>
        </Message>
      );
    case "erreur":
      return (
        <Message titre="Connexion impossible">
          <p>Vos données n&apos;ont pas pu être chargées. Vérifiez votre connexion internet puis réessayez.</p>
          <button type="button" onClick={() => window.location.reload()} className={classeBouton}>Réessayer</button>
        </Message>
      );
    case "pret":
      return (
        <>
          {session.role === "lecteur" && (
            <div className="mb-4 rounded-sm border border-pierre/70 bg-marbre/60 p-3 text-sm text-ardoise print:hidden">
              👁 Accès en <strong>lecture seule</strong> : vous pouvez consulter et télécharger les documents, sans les modifier.
            </div>
          )}
          {session.role === "contributeur" && (
            <div className="mb-4 rounded-sm border border-pierre/70 bg-marbre/60 p-3 text-sm text-ardoise print:hidden">
              Vous êtes <strong>contributeur</strong> : vous saisissez les remises et réceptions d&apos;EPI et faites signer
              les salariés. Le reste est en consultation.
            </div>
          )}
          {session.enregistrement === "refuse" && (
            <div className="mb-4 rounded-sm border border-[#d03b3b] bg-[#d03b3b]/10 p-3 text-sm print:hidden">
              <strong>⚠ Modification refusée.</strong> Votre rôle ne permet pas cette modification ; elle n&apos;a pas été
              enregistrée. Demandez à un responsable de votre entreprise si besoin.
            </div>
          )}
          {children}
        </>
      );
  }
}

function AcceptationConditions() {
  const [accepte, setAccepte] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(false);
  return (
    <Message titre="Conditions d'utilisation">
      <p>Avant d&apos;utiliser Frisk DU, prenez connaissance des documents suivants (ils s&apos;ouvrent dans un nouvel onglet) :</p>
      <ul className="space-y-1 text-left">
        {documentsLegaux.map((d) => (
          <li key={d.href}>
            <a href={d.href} target="_blank" rel="noreferrer" className="text-bronze underline">{d.titre}</a>
          </li>
        ))}
      </ul>
      <label className="flex items-start gap-2 text-left">
        <input type="checkbox" className="mt-1 accent-bronze" checked={accepte} onChange={(e) => setAccepte(e.target.checked)} />
        <span>
          J&apos;ai lu et j&apos;accepte les conditions générales d&apos;utilisation et l&apos;accord de traitement des données, pour mon compte
          et pour le compte de mon entreprise.
        </span>
      </label>
      {erreur && <p className="text-[#b42318]">L&apos;acceptation n&apos;a pas pu être enregistrée. Réessayez.</p>}
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          disabled={!accepte || envoi}
          onClick={async () => {
            setEnvoi(true);
            const ok = await accepterConditions();
            setEnvoi(false);
            setErreur(!ok);
          }}
          className={`${classeBouton} disabled:opacity-50`}
        >
          {envoi ? "Enregistrement…" : "Accepter et continuer"}
        </button>
        <button type="button" onClick={deconnecter} className="text-ardoise underline">Se déconnecter</button>
      </div>
    </Message>
  );
}
