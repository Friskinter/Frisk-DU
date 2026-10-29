"use client";

import Link from "next/link";
import { DoubleAuthentification } from "@/components/double-authentification";
import { Carte, Chargement, EnTetePage } from "@/components/ui";
import { libellesRoles } from "@/lib/operations";
import { useSession } from "@/lib/stockage";

export default function PageCompte() {
  const session = useSession();
  if (session.statut !== "pret") return <Chargement />;

  return (
    <div className="space-y-4">
      <EnTetePage titre="Mon compte" description="Identifiants et sécurité de votre compte Frisk DU." />

      <Carte titre="Identifiants">
        <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-gris">E-mail</dt>
          <dd>{session.email}</dd>
          <dt className="text-gris">Rôle</dt>
          <dd>{session.admin ? "Administrateur Frisk" : session.role !== "admin" ? libellesRoles[session.role].libelle : ""}</dd>
          <dt className="text-gris">Mot de passe</dt>
          <dd>
            <Link href="/mot-de-passe" className="text-bronze-fonce underline">Changer de mot de passe</Link>
          </dd>
        </dl>
      </Carte>

      <DoubleAuthentification recommandee={session.admin || session.role === "responsable"} />
    </div>
  );
}
