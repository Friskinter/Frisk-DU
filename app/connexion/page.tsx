"use client";

import { useState } from "react";
import { EcranAuth } from "@/components/ecran-auth";
import { classeBouton, classeChamp } from "@/components/ui";
import { supabaseNavigateur } from "@/lib/supabase/client";
import { rechargerVers } from "@/lib/navigation";

export default function Connexion() {
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [oubli, setOubli] = useState(false);
  const [message, setMessage] = useState<{ type: "erreur" | "info"; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const seConnecter = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setMessage(null);
    const { error } = await supabaseNavigateur().auth.signInWithPassword({ email: email.trim(), password: motDePasse });
    if (error) {
      setEnvoi(false);
      setMessage({
        type: "erreur",
        texte:
          error.code === "invalid_credentials"
            ? "E-mail ou mot de passe incorrect."
            : "Connexion impossible pour le moment. Réessayez dans quelques instants.",
      });
      return;
    }
    rechargerVers("/");
  };

  const reinitialiser = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    await supabaseNavigateur().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?suite=/mot-de-passe`,
    });
    setEnvoi(false);
    // Même message que l'adresse existe ou non, pour ne pas révéler les comptes.
    setMessage({
      type: "info",
      texte: "Si un compte existe pour cette adresse, un e-mail vous a été envoyé pour choisir un nouveau mot de passe.",
    });
  };

  return (
    <EcranAuth
      titre={oubli ? "Mot de passe oublié" : "Connexion"}
      sousTitre={oubli ? "Recevez un lien par e-mail pour choisir un nouveau mot de passe." : "Accédez à l'espace de votre entreprise."}
    >
      <form onSubmit={oubli ? reinitialiser : seConnecter} className="space-y-4">
        <label className="block text-sm">
          E-mail
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${classeChamp} mt-1 py-2.5`} />
        </label>
        {!oubli && (
          <label className="block text-sm">
            Mot de passe
            <input type="password" required autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} className={`${classeChamp} mt-1 py-2.5`} />
          </label>
        )}
        {message && (
          <p className={`text-sm ${message.type === "erreur" ? "text-[#b42318]" : "text-[#006300]"}`}>{message.texte}</p>
        )}
        <button type="submit" disabled={envoi} className={`${classeBouton} w-full justify-center py-3 disabled:opacity-60`}>
          {envoi ? "Patientez…" : oubli ? "Envoyer le lien" : "Se connecter"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOubli(!oubli);
            setMessage(null);
          }}
          className="block w-full text-center text-sm text-ardoise underline"
        >
          {oubli ? "Retour à la connexion" : "Mot de passe oublié ?"}
        </button>
      </form>
    </EcranAuth>
  );
}
