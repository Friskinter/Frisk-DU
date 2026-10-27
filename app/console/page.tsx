"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Chargement,
  Indicateur,
  Pastille,
  classeBouton,
  classeBoutonSecondaire,
  classeChamp,
} from "@/components/ui";
import { formaterDate } from "@/lib/calculs";
import { deconnecter, ouvrirEntreprise } from "@/lib/stockage";
import { supabaseNavigateur } from "@/lib/supabase/client";
import { ajouterUtilisateur, creerClient, reinitialiserMotDePasse, type Resultat } from "./actions";
import { rechargerVers } from "@/lib/navigation";

type Client = {
  id: string;
  nom: string;
  actif: boolean;
  created_at: string;
  membres: { user_id: string; email: string }[];
  espaces: { updated_at: string } | null;
};

type Identifiants = { email: string; motDePasse: string };

export default function Console() {
  const [etat, setEtat] = useState<"chargement" | "refuse" | "pret">("chargement");
  const [clients, setClients] = useState<Client[]>([]);
  const [recherche, setRecherche] = useState("");
  const [retour, setRetour] = useState<{ resultat: Resultat; identifiants?: Identifiants } | null>(null);

  const recharger = useCallback(async () => {
    const supabase = supabaseNavigateur();
    const { data: utilisateur } = await supabase.auth.getUser();
    if (!utilisateur.user) return rechargerVers("/connexion");
    const { data: admin } = await supabase
      .from("admins_frisk")
      .select("user_id")
      .eq("user_id", utilisateur.user.id)
      .maybeSingle();
    if (!admin) return setEtat("refuse");
    const { data } = await supabase
      .from("entreprises")
      .select("id, nom, actif, created_at, membres(user_id, email), espaces(updated_at)")
      .order("nom");
    setClients((data ?? []) as unknown as Client[]);
    setEtat("pret");
  }, []);

  useEffect(() => {
    // Chargement initial des clients depuis Supabase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recharger();
  }, [recharger]);

  const afficher = async (action: Promise<Resultat>, email?: string) => {
    const resultat = await action;
    setRetour({
      resultat,
      identifiants: resultat.ok && resultat.motDePasse && email ? { email, motDePasse: resultat.motDePasse } : undefined,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    await recharger();
  };

  const changerStatut = async (client: Client) => {
    const verbe = client.actif ? "Suspendre" : "Réactiver";
    if (!confirm(`${verbe} l'accès de « ${client.nom} » ?`)) return;
    await supabaseNavigateur().from("entreprises").update({ actif: !client.actif }).eq("id", client.id);
    await recharger();
  };

  const retirer = async (client: Client, membre: Client["membres"][number]) => {
    if (!confirm(`Retirer l'accès de ${membre.email} à « ${client.nom} » ?`)) return;
    await supabaseNavigateur()
      .from("membres")
      .delete()
      .eq("user_id", membre.user_id)
      .eq("entreprise_id", client.id);
    await recharger();
  };

  if (etat === "chargement") return <Chargement />;
  if (etat === "refuse") {
    return (
      <div className="mx-auto mt-24 max-w-md text-center">
        <h1 className="font-serif text-2xl">Accès réservé</h1>
        <p className="mt-3 text-sm text-ardoise">La console est réservée aux administrateurs Frisk.</p>
        <Link href="/" className={`${classeBouton} mt-6`}>Retour à mon espace</Link>
      </div>
    );
  }

  const terme = recherche.trim().toLowerCase();
  const visibles = clients.filter(
    (c) => !terme || c.nom.toLowerCase().includes(terme) || c.membres.some((m) => m.email.includes(terme)),
  );

  return (
    <div className="min-h-screen">
      <header className="bg-encre text-pierre">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Image src="/logo-frisk.png" alt="" width={36} height={36} className="h-9 w-9 rounded-sm" />
            <p className="font-serif text-lg tracking-[0.2em] text-marbre">
              FRISK <span className="text-bronze-clair">DU</span>
              <span className="ml-3 text-xs tracking-[0.25em] text-gris">CONSOLE</span>
            </p>
          </div>
          <button type="button" onClick={deconnecter} className="text-sm underline hover:text-marbre">
            Se déconnecter
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-serif text-3xl">Vos clients</h1>
          <p className="mt-1 text-sm text-ardoise">
            Créez les accès de vos clients, gérez leurs utilisateurs et ouvrez leur espace pour les accompagner.
          </p>
        </div>

        {retour && (
          <div
            className={`rounded-sm border p-4 text-sm ${
              retour.resultat.ok ? "border-[#0ca30c] bg-[#0ca30c]/10" : "border-[#d03b3b] bg-[#d03b3b]/10"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">{retour.resultat.ok ? "✓ " : "⚠ "}{retour.resultat.message}</p>
              <button type="button" onClick={() => setRetour(null)} aria-label="Fermer" className="text-gris">✕</button>
            </div>
            {retour.identifiants && <BlocIdentifiants identifiants={retour.identifiants} />}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Indicateur libelle="Clients" valeur={clients.length} />
          <Indicateur libelle="Actifs" valeur={clients.filter((c) => c.actif).length} />
          <Indicateur libelle="Utilisateurs" valeur={clients.reduce((t, c) => t + c.membres.length, 0)} />
        </div>

        <NouveauClient onCreer={(nom, email, demo) => afficher(creerClient(nom, email, demo), email.trim().toLowerCase())} />

        <div className="flex items-center gap-3">
          <input
            type="search"
            placeholder="Rechercher un client ou un e-mail…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className={`${classeChamp} max-w-sm`}
          />
        </div>

        {visibles.length === 0 ? (
          <p className="py-8 text-center text-sm text-gris">Aucun client pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-4">
            {visibles.map((c) => (
              <li key={c.id} className="rounded-sm border border-pierre/70 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-medium">{c.nom}</h2>
                      {c.actif ? (
                        <Pastille couleur="#0ca30c" texte="#ffffff" icone="✓">Actif</Pastille>
                      ) : (
                        <Pastille couleur="#d03b3b" texte="#ffffff" icone="✕">Suspendu</Pastille>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gris">
                      Client depuis le {formaterDate(c.created_at.slice(0, 10))}
                      {c.espaces?.updated_at && ` · dernière modification le ${formaterDate(c.espaces.updated_at.slice(0, 10))}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={classeBouton} onClick={() => ouvrirEntreprise(c.id)}>
                      Ouvrir l&apos;espace
                    </button>
                    <button type="button" className={classeBoutonSecondaire} onClick={() => changerStatut(c)}>
                      {c.actif ? "Suspendre" : "Réactiver"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 border-t border-pierre/60 pt-3">
                  <p className="mb-2 text-xs uppercase tracking-wider text-gris">Utilisateurs</p>
                  <ul className="divide-y divide-pierre/40 text-sm">
                    {c.membres.map((m) => (
                      <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span>{m.email}</span>
                        <span className="flex gap-4 text-xs">
                          <button
                            type="button"
                            className="text-bronze underline"
                            onClick={() =>
                              confirm(`Créer un nouveau mot de passe provisoire pour ${m.email} ?`) &&
                              afficher(reinitialiserMotDePasse(m.user_id), m.email)
                            }
                          >
                            Nouveau mot de passe
                          </button>
                          <button type="button" className="text-gris underline hover:text-[#b42318]" onClick={() => retirer(c, m)}>
                            Retirer
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <AjoutUtilisateur onAjouter={(email) => afficher(ajouterUtilisateur(c.id, email), email.trim().toLowerCase())} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NouveauClient({ onCreer }: { onCreer: (nom: string, email: string, demo: boolean) => Promise<void> }) {
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [demo, setDemo] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    await onCreer(nom, email, demo);
    setEnvoi(false);
    setNom("");
    setEmail("");
    setDemo(false);
  };

  return (
    <form onSubmit={valider} className="rounded-sm border border-bronze/60 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ardoise">Nouveau client</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <label className="text-sm">
          Nom de l&apos;entreprise
          <input required value={nom} onChange={(e) => setNom(e.target.value)} className={`${classeChamp} mt-1`} />
        </label>
        <label className="text-sm">
          E-mail du responsable
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${classeChamp} mt-1`} />
        </label>
        <button type="submit" disabled={envoi} className={`${classeBouton} self-end justify-center disabled:opacity-60`}>
          {envoi ? "Création…" : "Créer le client"}
        </button>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-ardoise">
        <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} className="accent-bronze" />
        Pré-remplir avec l&apos;exemple de démonstration (pour un essai ou une présentation)
      </label>
    </form>
  );
}

function AjoutUtilisateur({ onAjouter }: { onAjouter: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [envoi, setEnvoi] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setEnvoi(true);
        await onAjouter(email);
        setEnvoi(false);
        setEmail("");
      }}
      className="mt-2 flex flex-wrap gap-2"
    >
      <input
        type="email"
        required
        placeholder="Ajouter un utilisateur (e-mail)…"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={`${classeChamp} max-w-xs`}
      />
      <button type="submit" disabled={envoi} className={`${classeBoutonSecondaire} disabled:opacity-60`}>
        {envoi ? "Ajout…" : "Ajouter"}
      </button>
    </form>
  );
}

function BlocIdentifiants({ identifiants }: { identifiants: Identifiants }) {
  const [copie, setCopie] = useState(false);
  const texte = `Bonjour,

Votre accès à Frisk DU est prêt.

Adresse : ${window.location.origin}/connexion
E-mail : ${identifiants.email}
Mot de passe provisoire : ${identifiants.motDePasse}

Vous choisirez votre propre mot de passe à la première connexion.`;

  return (
    <div className="mt-3 rounded-sm bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-gris">Identifiants à transmettre au client</p>
      <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{texte}</pre>
      <button
        type="button"
        className={`${classeBoutonSecondaire} mt-3`}
        onClick={async () => {
          await navigator.clipboard.writeText(texte);
          setCopie(true);
        }}
      >
        {copie ? "✓ Copié" : "Copier le message"}
      </button>
      <p className="mt-2 text-xs text-gris">Ce mot de passe ne sera plus affiché : copiez-le maintenant.</p>
    </div>
  );
}
