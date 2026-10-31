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
import { accesEntreprise, joursRestants, offres, type StatutAbonnement } from "@/lib/abonnement";
import { libellesStatutAvis, type StatutAvis } from "@/lib/avis";
import { formaterDate } from "@/lib/calculs";
import { bilanEnvois, libellesEnvoi, type EnvoiJournal } from "@/lib/envoi-email";
import { champsManquants } from "@/lib/legal";
import { deconnecter, ouvrirEntreprise } from "@/lib/stockage";
import { libellesRoles } from "@/lib/operations";
import { supabaseNavigateur } from "@/lib/supabase/client";
import { ajouterUtilisateur, creerClient, exporterClient, reinitialiserDoubleAuth, reinitialiserMotDePasse, supprimerClient, type Resultat } from "./actions";
import { telecharger } from "@/lib/calculs";
import { CodeDoubleAuth } from "@/components/code-double-auth";
import { DoubleAuthentification } from "@/components/double-authentification";
import { codeRequis } from "@/lib/double-auth";
import { rechargerVers } from "@/lib/navigation";

type Client = {
  id: string;
  nom: string;
  actif: boolean;
  created_at: string;
  groupe_id: string | null;
  abonnement: StatutAbonnement;
  essai_fin: string | null;
  offre: string | null;
  periodicite: string | null;
  stripe_abonnement: string | null;
  inscription_libre: boolean;
  membres: { user_id: string; email: string; role: RoleMembre }[];
  espaces: { updated_at: string } | null;
};

type Groupe = { id: string; nom: string };

type Identifiants = { email: string; motDePasse: string };
type RoleMembre = keyof typeof libellesRoles;
const rolesMembre = Object.keys(libellesRoles) as RoleMembre[];

export default function Console() {
  const [etat, setEtat] = useState<"chargement" | "refuse" | "code" | "pret">("chargement");
  const [doubleAuth, setDoubleAuth] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [emailAdmin, setEmailAdmin] = useState("");
  const [recherche, setRecherche] = useState("");
  const [retour, setRetour] = useState<{ resultat: Resultat; identifiants?: Identifiants } | null>(null);

  const recharger = useCallback(async () => {
    const supabase = supabaseNavigateur();
    const { data: utilisateur } = await supabase.auth.getUser();
    if (!utilisateur.user) return rechargerVers("/connexion");
    if (await codeRequis()) return setEtat("code");
    const { data: admin } = await supabase
      .from("admins_frisk")
      .select("user_id")
      .eq("user_id", utilisateur.user.id)
      .maybeSingle();
    setEmailAdmin(utilisateur.user.email ?? "");
    if (!admin) return setEtat("refuse");
    const [{ data }, { data: listeGroupes }] = await Promise.all([
      supabase
        .from("entreprises")
        .select("id, nom, actif, created_at, groupe_id, abonnement, essai_fin, offre, periodicite, stripe_abonnement, inscription_libre, membres(user_id, email, role), espaces(updated_at)")
        .order("nom"),
      supabase.from("groupes").select("id, nom").order("nom"),
    ]);
    setClients((data ?? []) as unknown as Client[]);
    setGroupes((listeGroupes ?? []) as Groupe[]);
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

  // Abonnement accordé par Frisk (client conseil, paiement hors ligne) ou essai prolongé.
  const changerAbonnement = async (client: Client, changement: Partial<Pick<Client, "abonnement" | "essai_fin">>, message: string) => {
    if (!confirm(`${message} pour « ${client.nom} » ?`)) return;
    const { error } = await supabaseNavigateur().from("entreprises").update(changement).eq("id", client.id);
    setRetour({ resultat: error ? { ok: false, message: "L'abonnement n'a pas pu être modifié." } : { ok: true, message: `${message} : fait.` } });
    await recharger();
  };

  const changerRole = async (client: Client, membre: Client["membres"][number], role: RoleMembre) => {
    const { error } = await supabaseNavigateur()
      .from("membres")
      .update({ role })
      .eq("user_id", membre.user_id)
      .eq("entreprise_id", client.id);
    setRetour({
      resultat: error
        ? { ok: false, message: "Le rôle n'a pas pu être modifié." }
        : { ok: true, message: `${membre.email} est maintenant ${libellesRoles[role].libelle.toLowerCase()}.` },
    });
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

  // Rattache un client à un groupe existant, à un nouveau groupe, ou le détache.
  const changerGroupe = async (client: Client, valeur: string) => {
    const supabase = supabaseNavigateur();
    let groupeId: string | null = valeur || null;
    if (valeur === "nouveau") {
      const nom = prompt("Nom du groupe (souvent le nom de la société) :", client.nom)?.trim();
      if (!nom) return;
      const { data, error } = await supabase.from("groupes").insert({ nom }).select("id").single();
      if (error || !data) return setRetour({ resultat: { ok: false, message: "Le groupe n'a pas pu être créé." } });
      groupeId = data.id;
    }
    const { error } = await supabase.from("entreprises").update({ groupe_id: groupeId }).eq("id", client.id);
    setRetour({ resultat: error ? { ok: false, message: "Le rattachement n'a pas pu être enregistré." } : { ok: true, message: groupeId ? `« ${client.nom} » rattaché au groupe.` : `« ${client.nom} » ne fait plus partie d'un groupe.` } });
    await recharger();
  };

  const renommerGroupe = async (client: Client) => {
    const actuel = groupes.find((g) => g.id === client.groupe_id);
    if (!actuel) return;
    const nom = prompt("Nouveau nom du groupe :", actuel.nom)?.trim();
    if (!nom || nom === actuel.nom) return;
    const { error } = await supabaseNavigateur().from("groupes").update({ nom }).eq("id", actuel.id);
    setRetour({ resultat: error ? { ok: false, message: "Le groupe n'a pas pu être renommé." } : { ok: true, message: `Groupe renommé « ${nom} ».` } });
    await recharger();
  };

  // Nouvel établissement : même groupe (créé si besoin), mêmes utilisateurs si demandé.
  const creerEtablissement = async (client: Client, nom: string, memesUtilisateurs: boolean) => {
    const supabase = supabaseNavigateur();
    let groupeId = client.groupe_id;
    if (!groupeId) {
      const { data, error } = await supabase.from("groupes").insert({ nom: client.nom }).select("id").single();
      if (error || !data) return setRetour({ resultat: { ok: false, message: "Le groupe n'a pas pu être créé." } });
      groupeId = data.id as string;
      await supabase.from("entreprises").update({ groupe_id: groupeId }).eq("id", client.id);
    }
    const { data: site, error } = await supabase.from("entreprises").insert({ nom, groupe_id: groupeId }).select("id").single();
    if (error || !site) return setRetour({ resultat: { ok: false, message: "L'établissement n'a pas pu être créé." } });
    if (memesUtilisateurs && client.membres.length) {
      await supabase.from("membres").insert(client.membres.map((m) => ({ user_id: m.user_id, entreprise_id: site.id, email: m.email, role: m.role })));
    }
    setRetour({
      resultat: {
        ok: true,
        message: `Établissement « ${nom} » créé${memesUtilisateurs && client.membres.length ? ` avec les ${client.membres.length} utilisateur(s) de « ${client.nom} »` : ""}.`,
      },
    });
    await recharger();
  };

  const exporter = async (client: Client) => {
    setRetour({ resultat: { ok: true, message: `Export de « ${client.nom} » en cours…` } });
    const resultat = await exporterClient(client.id);
    if (!resultat.ok) return setRetour({ resultat });
    telecharger(resultat.nom, resultat.contenu, "application/json");
    setRetour({ resultat: { ok: true, message: `Export de « ${client.nom} » téléchargé (données, versions, journal et liens vers les fichiers valables 7 jours).` } });
  };

  if (etat === "chargement") return <Chargement />;
  if (etat === "code") {
    return (
      <div className="mx-auto mt-24 max-w-sm rounded-sm border border-pierre/70 bg-white p-6">
        <h1 className="mb-4 font-serif text-2xl">Double authentification</h1>
        <CodeDoubleAuth onValide={() => rechargerVers("/console")} />
      </div>
    );
  }
  if (etat === "refuse") {
    return (
      <div className="mx-auto mt-24 max-w-md text-center">
        <h1 className="font-serif text-2xl">Accès réservé</h1>
        <p className="mt-3 text-sm text-ardoise">La console est réservée aux administrateurs Frisk.</p>
        {emailAdmin && (
          <p className="mt-2 text-sm text-ardoise">
            Vous êtes connecté avec <strong>{emailAdmin}</strong>, qui n&apos;est pas un compte administrateur.
            Déconnectez-vous puis reconnectez-vous avec votre compte Frisk.
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className={classeBouton}>Retour à mon espace</Link>
          <button type="button" onClick={deconnecter} className={classeBoutonSecondaire}>Se déconnecter</button>
        </div>
      </div>
    );
  }

  const terme = recherche.trim().toLowerCase();
  const nomGroupe = (c: Client) => groupes.find((g) => g.id === c.groupe_id)?.nom ?? "";
  // Les établissements d'un même groupe se suivent.
  const visibles = clients
    .filter(
      (c) =>
        !terme ||
        c.nom.toLowerCase().includes(terme) ||
        nomGroupe(c).toLowerCase().includes(terme) ||
        c.membres.some((m) => m.email.includes(terme)),
    )
    .sort((a, b) => (nomGroupe(a) || a.nom).localeCompare(nomGroupe(b) || b.nom, "fr") || a.nom.localeCompare(b.nom, "fr"));

  return (
    <div className="min-h-screen">
      <header className="bg-encre text-pierre">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Image src="/logo-frisk.png" alt="" width={36} height={36} className="h-9 w-9 rounded-sm" />
            <p className="font-serif text-lg tracking-[0.2em] text-marbre">
              FRISK <span className="text-bronze-clair">PLATEFORME</span>
              <span className="ml-3 text-xs tracking-[0.25em] text-gris">CONSOLE</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-xs text-gris">
              Connecté : <span className="text-pierre">{emailAdmin}</span>{" "}
              <span className="ml-1 rounded-full bg-bronze px-2 py-0.5 text-[10px] font-medium text-encre">Administrateur Frisk</span>
            </span>
            <button type="button" onClick={deconnecter} className="underline hover:text-marbre">
              Se déconnecter
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-serif text-3xl">Vos clients</h1>
          <p className="mt-1 text-sm text-ardoise">
            Créez les accès de vos clients, gérez leurs utilisateurs et ouvrez leur espace pour les accompagner.
          </p>
        </div>

        {!doubleAuth && (
          <div className="rounded-sm border border-[#d03b3b] bg-[#d03b3b]/10 p-4 text-sm text-ardoise">
            <p className="font-medium text-encre">Protégez votre compte administrateur</p>
            <p className="mt-1">Il donne accès aux données de tous vos clients : activez la double authentification ci-dessous.</p>
          </div>
        )}
        <DoubleAuthentification recommandee onChange={setDoubleAuth} />

        {champsManquants().length > 0 && (
          <div className="rounded-sm border border-[#fab219] bg-[#fab219]/10 p-4 text-sm text-ardoise">
            <p className="font-medium text-encre">Mentions légales à compléter avant la mise en ligne</p>
            <p className="mt-1">
              Renseignez dans <code>lib/legal.ts</code> : {champsManquants().join(", ")}. Ces informations apparaissent sur les{" "}
              <Link href="/legal/mentions" className="text-bronze-fonce underline">pages légales</Link>.
            </p>
          </div>
        )}

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

        <AvisClients />
        <ErreursRecentes />
        <EnvoisEmail />

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
                        <Pastille couleur="#0ca30c" texte="#0b0b0b" icone="✓">Actif</Pastille>
                      ) : (
                        <Pastille couleur="#d03b3b" texte="#ffffff" icone="✕">Suspendu</Pastille>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-ardoise">{resumeAbonnement(c)}</p>
                    {c.groupe_id && (
                      <p className="mt-1 text-xs text-bronze-fonce">
                        Groupe {nomGroupe(c)} · {clients.filter((x) => x.groupe_id === c.groupe_id).length} établissement(s)
                      </p>
                    )}
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
                    {!c.stripe_abonnement && c.abonnement !== "actif" && (
                      <button type="button" className={classeBoutonSecondaire} onClick={() => changerAbonnement(c, { abonnement: "actif" }, "Accorder l'abonnement (hors paiement en ligne)")}>
                        Accorder l&apos;abonnement
                      </button>
                    )}
                    {c.abonnement === "essai" && (
                      <button
                        type="button"
                        className={classeBoutonSecondaire}
                        onClick={() => changerAbonnement(c, { essai_fin: new Date(Math.max(Date.now(), new Date(c.essai_fin ?? 0).getTime()) + 7 * 86_400_000).toISOString() }, "Prolonger l'essai de 7 jours")}
                      >
                        Prolonger l&apos;essai
                      </button>
                    )}
                    <button type="button" className={classeBoutonSecondaire} onClick={() => exporter(c)} title="Toutes les données du client au format JSON">
                      Exporter les données
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-pierre/60 pt-3 text-sm">
                  <label className="text-xs text-gris">
                    <span className="mb-1 block uppercase tracking-wider">Groupe</span>
                    <select
                      value={c.groupe_id ?? ""}
                      onChange={(e) => changerGroupe(c, e.target.value)}
                      className={`${classeChamp} w-auto py-1 text-xs`}
                    >
                      <option value="">Aucun (entreprise seule)</option>
                      {groupes.map((g) => (
                        <option key={g.id} value={g.id}>{g.nom}</option>
                      ))}
                      <option value="nouveau">+ Nouveau groupe…</option>
                    </select>
                  </label>
                  {c.groupe_id && (
                    <button type="button" className="pb-1.5 text-xs text-ardoise underline" onClick={() => renommerGroupe(c)}>
                      Renommer le groupe
                    </button>
                  )}
                  <NouvelEtablissement onCreer={(nom, memes) => creerEtablissement(c, nom, memes)} />
                </div>

                <div className="mt-4 border-t border-pierre/60 pt-3">
                  <p className="mb-2 text-xs uppercase tracking-wider text-gris">Utilisateurs</p>
                  <ul className="divide-y divide-pierre/40 text-sm">
                    {c.membres.map((m) => (
                      <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span>{m.email}</span>
                        <span className="flex flex-wrap items-center gap-4 text-xs">
                          <select
                            value={m.role}
                            onChange={(e) => changerRole(c, m, e.target.value as RoleMembre)}
                            className={`${classeChamp} w-auto py-1 text-xs`}
                            title={libellesRoles[m.role].description}
                            aria-label={`Rôle de ${m.email}`}
                          >
                            {rolesMembre.map((r) => (
                              <option key={r} value={r}>
                                {libellesRoles[r].libelle}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="text-bronze-fonce underline"
                            onClick={() =>
                              confirm(`Créer un nouveau mot de passe provisoire pour ${m.email} ?`) &&
                              afficher(reinitialiserMotDePasse(m.user_id), m.email)
                            }
                          >
                            Nouveau mot de passe
                          </button>
                          <button
                            type="button"
                            className="text-bronze-fonce underline"
                            title="Si l'utilisateur a perdu son téléphone"
                            onClick={() =>
                              confirm(`Retirer la double authentification de ${m.email} ? Il pourra se connecter avec son seul mot de passe, puis la réactiver.`) &&
                              afficher(reinitialiserDoubleAuth(m.user_id))
                            }
                          >
                            Réinitialiser la double authentification
                          </button>
                          <button type="button" className="text-gris underline hover:text-[#b42318]" onClick={() => retirer(c, m)}>
                            Retirer
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <AjoutUtilisateur
                    onAjouter={(email, role) => afficher(ajouterUtilisateur(c.id, email, role), email.trim().toLowerCase())}
                  />
                </div>
                <SuppressionClient client={c} onSupprimer={(nom) => afficher(supprimerClient(c.id, nom))} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SuppressionClient({ client, onSupprimer }: { client: { nom: string }; onSupprimer: (nom: string) => Promise<void> }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [envoi, setEnvoi] = useState(false);
  if (!ouvert) {
    return (
      <div className="mt-4 border-t border-pierre/60 pt-3 text-right">
        <button type="button" className="text-xs text-gris underline hover:text-[#b42318]" onClick={() => setOuvert(true)}>
          Supprimer définitivement ce client…
        </button>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-sm border border-[#d03b3b] bg-[#d03b3b]/5 p-4 text-sm">
      <p className="font-medium text-[#b42318]">Suppression définitive de « {client.nom} »</p>
      <p className="mt-1 text-ardoise">
        Données, versions figées du document unique, journal, fichiers joints et accès seront effacés sans retour possible ; les comptes
        qui n&apos;ont accès à aucune autre entreprise seront supprimés. Exportez d&apos;abord les données et transmettez-les au client : il
        doit conserver ses versions du document unique pendant 40 ans.
      </p>
      <label className="mt-3 block text-xs text-ardoise">
        Pour confirmer, tapez le nom exact de l&apos;entreprise :
        <input value={nom} onChange={(e) => setNom(e.target.value)} className={`${classeChamp} mt-1 max-w-sm`} />
      </label>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={nom.trim() !== client.nom || envoi}
          onClick={async () => {
            setEnvoi(true);
            await onSupprimer(nom);
            setEnvoi(false);
          }}
          className="rounded-sm bg-[#d03b3b] px-3.5 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {envoi ? "Suppression…" : "Supprimer définitivement"}
        </button>
        <button type="button" className={classeBoutonSecondaire} onClick={() => { setOuvert(false); setNom(""); }}>
          Annuler
        </button>
      </div>
    </div>
  );
}

function NouvelEtablissement({ onCreer }: { onCreer: (nom: string, memesUtilisateurs: boolean) => Promise<void> }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [memes, setMemes] = useState(true);
  if (!ouvert) {
    return (
      <button
        type="button"
        className={`${classeBoutonSecondaire} border-bronze py-1.5 text-xs`}
        onClick={() => setOuvert(true)}
        title="Créer un autre site de ce client, avec son propre document unique"
      >
        + Ajouter un établissement
      </button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!nom.trim()) return;
        await onCreer(nom.trim(), memes);
        setNom("");
        setOuvert(false);
      }}
    >
      <label className="text-xs text-gris">
        <span className="mb-1 block uppercase tracking-wider">Nom de l&apos;établissement</span>
        <input required autoFocus value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Société X – site de Lyon" className={`${classeChamp} w-64 py-1 text-sm`} />
      </label>
      <label className="flex items-center gap-1.5 pb-1.5 text-xs text-ardoise">
        <input type="checkbox" className="accent-bronze" checked={memes} onChange={(e) => setMemes(e.target.checked)} />
        Mêmes utilisateurs
      </label>
      <button type="submit" className={`${classeBouton} py-1 text-xs`}>Créer</button>
      <button type="button" className="pb-1.5 text-xs text-gris underline" onClick={() => setOuvert(false)}>Annuler</button>
    </form>
  );
}

type AvisConsole = {
  id: string;
  modifie_le: string;
  note: number;
  texte: string;
  auteur: string;
  fonction: string;
  entreprise_affichee: string;
  statut: StatutAvis;
  entreprises: { nom: string } | null;
};

// Avis des clients à relire avant publication sur le site vitrine (migration 018). On publie les
// avis positifs comme négatifs ; on n'écarte que l'injurieux, le hors sujet et les données
// personnelles (règle annoncée sur le site vitrine).
function AvisClients() {
  const [avis, setAvis] = useState<AvisConsole[] | null>(null);
  const [toutVoir, setToutVoir] = useState(false);
  const [erreur, setErreur] = useState("");
  const lire = useCallback(async () => {
    const { data, error } = await supabaseNavigateur()
      .from("avis")
      .select("id, modifie_le, note, texte, auteur, fonction, entreprise_affichee, statut, entreprises(nom)")
      .order("modifie_le", { ascending: false })
      .limit(100);
    // Base pas encore à jour (migration 018) : la rubrique reste masquée.
    setAvis(error ? null : ((data ?? []) as unknown as AvisConsole[]));
  }, []);
  useEffect(() => {
    // Chargement initial des avis depuis Supabase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void lire();
  }, [lire]);
  if (!avis) return null;

  const moderer = async (id: string, statut: StatutAvis) => {
    setErreur("");
    const { error } = await supabaseNavigateur().rpc("moderer_avis", { p_avis: id, p_statut: statut });
    if (error) setErreur("La modification n'a pas pu être enregistrée.");
    await lire();
  };
  const enAttente = avis.filter((a) => a.statut === "en_attente");
  const affiches = toutVoir ? avis : enAttente;

  return (
    <section className="rounded-sm border border-pierre/70 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ardoise">Avis clients</h2>
        <p className="text-sm">
          {enAttente.length ? `${enAttente.length} à relire` : "Aucun avis à relire."} · {avis.filter((a) => a.statut === "publie").length} publié(s)
        </p>
      </div>
      {avis.length > enAttente.length && (
        <button type="button" className="mt-2 text-sm text-bronze-fonce underline" onClick={() => setToutVoir(!toutVoir)}>
          {toutVoir ? "Afficher seulement les avis à relire" : "Afficher tous les avis"}
        </button>
      )}
      {erreur && <p className="mt-2 text-sm text-[#b42318]">{erreur}</p>}
      {affiches.length > 0 && (
        <ul className="mt-3 divide-y divide-pierre/60 text-sm">
          {affiches.map((a) => (
            <li key={a.id} className="py-3">
              <p className="text-xs text-gris">
                {new Date(a.modifie_le).toLocaleDateString("fr-FR")} · {a.entreprises?.nom ?? "—"} · {libellesStatutAvis[a.statut]}
              </p>
              <p className="mt-1">
                <span className="text-bronze" aria-label={`${a.note} étoiles sur 5`}>{"★".repeat(a.note)}</span>
                <span className="text-pierre" aria-hidden>{"★".repeat(5 - a.note)}</span>
              </p>
              <p className="mt-1 whitespace-pre-line">{a.texte}</p>
              <p className="mt-1 text-xs text-ardoise">
                {a.auteur}
                {a.fonction && `, ${a.fonction}`}
                {a.entreprise_affichee ? ` · ${a.entreprise_affichee}` : " · entreprise non citée"}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                {a.statut !== "publie" && (
                  <button type="button" className="text-bronze-fonce underline" onClick={() => moderer(a.id, "publie")}>Publier</button>
                )}
                {a.statut !== "refuse" && (
                  <button type="button" className="text-[#b42318] underline" onClick={() => moderer(a.id, "refuse")}>Ne pas publier</button>
                )}
                {a.statut !== "en_attente" && (
                  <button type="button" className="text-gris underline" onClick={() => moderer(a.id, "en_attente")}>Remettre à relire</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Erreur = { id: number; created_at: string; origine: string; message: string; detail: string; page: string; navigateur: string };

// Dernières erreurs rencontrées par les utilisateurs (navigateur) ou par le serveur, sur 90 jours.
function ErreursRecentes() {
  const [liste, setListe] = useState<{ erreurs: Erreur[]; semaine: number } | null>(null);
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => {
    const lire = async () => {
      const { data } = await supabaseNavigateur()
        .from("erreurs")
        .select("id, created_at, origine, message, detail, page, navigateur")
        .order("created_at", { ascending: false })
        .limit(50);
      const erreurs = (data ?? []) as Erreur[];
      const depuis = Date.now() - 7 * 86_400_000;
      setListe({ erreurs, semaine: erreurs.filter((e) => new Date(e.created_at).getTime() > depuis).length });
    };
    void lire();
  }, []);
  if (!liste) return null;
  const { erreurs, semaine } = liste;
  return (
    <section className="rounded-sm border border-pierre/70 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ardoise">Erreurs rencontrées</h2>
        <p className="text-sm">
          {erreurs.length ? `${semaine} cette semaine · ${erreurs.length} au total (50 dernières)` : "Aucune erreur enregistrée."}
        </p>
      </div>
      {erreurs.length > 0 && (
        <>
          <button type="button" className="mt-2 text-sm text-bronze-fonce underline" onClick={() => setOuvert(!ouvert)}>
            {ouvert ? "Masquer" : "Afficher le détail"}
          </button>
          {ouvert && (
            <ul className="mt-3 divide-y divide-pierre/60 text-sm">
              {erreurs.map((e) => (
                <li key={e.id} className="py-2">
                  <p>
                    <span className="text-xs text-gris">{new Date(e.created_at).toLocaleString("fr-FR")} · {e.origine} · {e.page || "—"}</span>
                    <br />
                    <strong className="break-all">{e.message}</strong>
                  </p>
                  {e.detail && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-gris">Détail technique</summary>
                      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-sm bg-ivoire p-2 text-xs">{e.detail}{e.navigateur ? `\n\n${e.navigateur}` : ""}</pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

// Derniers e-mails envoyés par Frisk Plateforme (alertes, urgences, signalements), sur 90 jours :
// un échec (adresse refusée, clé Resend invalide, domaine non vérifié) se voit tout de suite.
function EnvoisEmail() {
  const [liste, setListe] = useState<{ envois: EnvoiJournal[]; bilan: ReturnType<typeof bilanEnvois> } | null>(null);
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => {
    const lire = async () => {
      const { data } = await supabaseNavigateur()
        .from("envois_email")
        .select("id, created_at, type, destinataire, reussi, erreur, entreprises(nom)")
        .order("created_at", { ascending: false })
        .limit(100);
      const envois = (data ?? []) as unknown as EnvoiJournal[];
      setListe({ envois, bilan: bilanEnvois(envois, Date.now()) });
    };
    void lire();
  }, []);
  if (!liste) return null;
  const { envois, bilan } = liste;
  const affiches = ouvert ? envois : envois.filter((e) => !e.reussi).slice(0, 10);
  return (
    <section className="rounded-sm border border-pierre/70 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ardoise">E-mails envoyés</h2>
        <p className="text-sm">
          {envois.length
            ? `Cette semaine : ${bilan.reussis} envoyé${bilan.reussis > 1 ? "s" : ""} · ${bilan.echecs} échec${bilan.echecs > 1 ? "s" : ""}`
            : "Aucun e-mail envoyé pour l'instant."}
        </p>
      </div>
      {bilan.echecs > 0 && (
        <p role="alert" className="mt-2 text-sm text-[#b42318]">
          Des e-mails n&apos;ont pas pu partir cette semaine : la raison est indiquée ci-dessous.
        </p>
      )}
      {affiches.length > 0 && (
        <ul className="mt-3 divide-y divide-pierre/60 text-sm">
          {affiches.map((e) => (
            <li key={e.id} className="py-2">
              <span className="text-xs text-gris">
                {new Date(e.created_at).toLocaleString("fr-FR")} · {libellesEnvoi[e.type]} · {e.entreprises?.nom ?? "—"}
              </span>
              <br />
              <span className="break-all">{e.destinataire}</span>{" "}
              {e.reussi ? <span className="text-[#006300]">envoyé</span> : <strong className="text-[#b42318]">échec</strong>}
              {e.erreur && <span className="block break-all text-xs text-ardoise">{e.erreur}</span>}
            </li>
          ))}
        </ul>
      )}
      {envois.length > 0 && (
        <button type="button" className="mt-2 text-sm text-bronze-fonce underline" onClick={() => setOuvert(!ouvert)}>
          {ouvert ? "N'afficher que les échecs" : `Afficher tous les envois (${envois.length} derniers)`}
        </button>
      )}
    </section>
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

function AjoutUtilisateur({ onAjouter }: { onAjouter: (email: string, role: RoleMembre) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleMembre>("responsable");
  const [envoi, setEnvoi] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setEnvoi(true);
        await onAjouter(email, role);
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
      <select value={role} onChange={(e) => setRole(e.target.value as RoleMembre)} className={`${classeChamp} w-auto`} aria-label="Rôle">
        {rolesMembre.map((r) => (
          <option key={r} value={r}>
            {libellesRoles[r].libelle}
          </option>
        ))}
      </select>
      <button type="submit" disabled={envoi} className={`${classeBoutonSecondaire} disabled:opacity-60`}>
        {envoi ? "Ajout…" : "Ajouter"}
      </button>
    </form>
  );
}

function BlocIdentifiants({ identifiants }: { identifiants: Identifiants }) {
  const [copie, setCopie] = useState(false);
  const texte = `Bonjour,

Votre accès à Frisk Plateforme est prêt.

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

function resumeAbonnement(c: Client) {
  const offre = offres.find((o) => o.code === c.offre)?.libelle;
  const acces = accesEntreprise({ abonnement: c.abonnement, essaiFin: c.essai_fin });
  const origine = c.inscription_libre ? "inscription en ligne" : "créé par Frisk";
  if (c.abonnement === "essai") {
    return acces === "essai" ? `Essai gratuit : ${joursRestants(c.essai_fin)} jour(s) restant(s) · ${origine}` : `Essai terminé, sans abonnement · ${origine}`;
  }
  if (c.abonnement === "termine") return `Abonnement terminé (lecture seule) · ${origine}`;
  const detail = [offre, c.periodicite === "an" ? "annuel" : c.periodicite === "mois" ? "mensuel" : null].filter(Boolean).join(", ");
  return `${c.abonnement === "impaye" ? "Paiement en échec" : "Abonné"}${c.stripe_abonnement ? " en ligne" : " (accordé par Frisk)"}${detail ? ` · ${detail}` : ""} · ${origine}`;
}
