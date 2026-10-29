"use client";

import Link from "next/link";
import { useState } from "react";
import { AntiRobot, ANTI_ROBOT_ACTIF } from "@/components/anti-robot";
import { EcranAuth } from "@/components/ecran-auth";
import { classeBouton, classeChamp } from "@/components/ui";
import { DUREE_ESSAI_JOURS, effectifsInscription } from "@/lib/abonnement";
import { VERSION_CONDITIONS } from "@/lib/legal";
import { MODE_TEST } from "@/lib/mode-test";
import { rechargerVers } from "@/lib/navigation";
import { supabaseNavigateur } from "@/lib/supabase/client";

// Inscription libre : compte et entreprise créés en une fois, essai gratuit sans carte bancaire.
export default function Inscription() {
  const [entreprise, setEntreprise] = useState("");
  const [effectif, setEffectif] = useState(effectifsInscription[0]);
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [accepte, setAccepte] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [jeton, setJeton] = useState("");
  const [essai, setEssai] = useState(0);

  const inscrire = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur("");
    if (motDePasse.length < 10) return setErreur("Choisissez un mot de passe d'au moins 10 caractères.");
    setEnvoi(true);
    if (MODE_TEST) {
      setEnvoi(false);
      setEnvoye(true);
      return;
    }
    const { data, error } = await supabaseNavigateur().auth.signUp({
      email: email.trim(),
      password: motDePasse,
      options: {
        captchaToken: jeton || undefined,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          inscription: { entreprise: entreprise.trim(), effectif },
          conditions_acceptees: VERSION_CONDITIONS,
          conditions_acceptees_le: new Date().toISOString(),
        },
      },
    });
    setEnvoi(false);
    // Le jeton anti-robot ne sert qu'une fois : nouvelle vérification pour un éventuel nouvel essai.
    setJeton("");
    setEssai((n) => n + 1);
    if (error) {
      setErreur(
        error.code === "captcha_failed"
          ? "La vérification anti-robot a échoué. Cochez-la de nouveau puis réessayez."
          : error.code === "weak_password"
          ? "Mot de passe trop simple : mélangez lettres, chiffres et caractères spéciaux."
          : error.code === "over_email_send_rate_limit" || error.status === 429
            ? "Trop d'inscriptions en peu de temps. Réessayez dans quelques minutes."
            : "L'inscription n'a pas pu aboutir. Vérifiez l'adresse e-mail et réessayez.",
      );
      return;
    }
    // Confirmation par e-mail désactivée dans Supabase : la session est déjà ouverte.
    if (data.session) rechargerVers("/");
    // Sinon (ou si l'adresse a déjà un compte), même message : on ne révèle pas les comptes existants.
    else setEnvoye(true);
  };

  if (envoye) {
    return (
      <EcranAuth titre="Vérifiez votre boîte mail" sousTitre="Une dernière étape avant d'ouvrir votre espace.">
        <div className="space-y-4 text-sm text-ardoise">
          <p>
            Nous avons envoyé un lien de confirmation à <strong>{email.trim()}</strong>. Cliquez dessus : votre espace s&apos;ouvre et votre
            essai gratuit de {DUREE_ESSAI_JOURS} jours commence.
          </p>
          <p>Rien reçu après quelques minutes ? Regardez dans les courriers indésirables.</p>
          <Link href="/connexion" className="block text-center underline">Retour à la connexion</Link>
        </div>
      </EcranAuth>
    );
  }

  return (
    <EcranAuth titre="Essai gratuit" sousTitre={`${DUREE_ESSAI_JOURS} jours pour découvrir Frisk DU, sans carte bancaire.`}>
      <form onSubmit={inscrire} className="space-y-4">
        <label className="block text-sm">
          Nom de l&apos;entreprise
          <input required maxLength={120} autoComplete="organization" value={entreprise} onChange={(e) => setEntreprise(e.target.value)} className={`${classeChamp} mt-1 py-2.5`} />
        </label>
        <label className="block text-sm">
          Effectif
          <select value={effectif} onChange={(e) => setEffectif(e.target.value)} className={`${classeChamp} mt-1 py-2.5`}>
            {effectifsInscription.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          E-mail professionnel
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${classeChamp} mt-1 py-2.5`} />
        </label>
        <label className="block text-sm">
          Mot de passe (10 caractères au moins)
          <input type="password" required minLength={10} autoComplete="new-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} className={`${classeChamp} mt-1 py-2.5`} />
        </label>
        <label className="flex items-start gap-2 text-xs text-ardoise">
          <input type="checkbox" required className="mt-0.5 accent-bronze" checked={accepte} onChange={(e) => setAccepte(e.target.checked)} />
          <span>
            J&apos;accepte, pour mon compte et celui de mon entreprise, les{" "}
            <a href="/legal/cgu" target="_blank" rel="noreferrer" className="underline">conditions générales d&apos;utilisation</a>, la{" "}
            <a href="/legal/confidentialite" target="_blank" rel="noreferrer" className="underline">politique de confidentialité</a> et l&apos;
            <a href="/legal/traitement" target="_blank" rel="noreferrer" className="underline">accord de traitement des données</a>.
          </span>
        </label>
        <AntiRobot key={essai} onJeton={setJeton} />
        {erreur && <p role="alert" className="text-sm text-[#b42318]">{erreur}</p>}
        <button type="submit" disabled={envoi || !accepte || (ANTI_ROBOT_ACTIF && !jeton)} className={`${classeBouton} w-full justify-center py-3 disabled:opacity-60`}>
          {envoi ? "Patientez…" : "Commencer mon essai gratuit"}
        </button>
        <p className="text-center text-sm text-ardoise">
          Déjà un compte ? <Link href="/connexion" className="underline">Se connecter</Link>
        </p>
      </form>
    </EcranAuth>
  );
}
