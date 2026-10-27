"use client";

import { useState } from "react";
import { EcranAuth } from "@/components/ecran-auth";
import { classeBouton, classeChamp } from "@/components/ui";
import { supabaseNavigateur } from "@/lib/supabase/client";
import { rechargerVers } from "@/lib/navigation";

export default function ChoisirMotDePasse() {
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (motDePasse.length < 10) return setErreur("Le mot de passe doit contenir au moins 10 caractères.");
    if (motDePasse !== confirmation) return setErreur("Les deux mots de passe ne sont pas identiques.");
    setEnvoi(true);
    const { error } = await supabaseNavigateur().auth.updateUser({
      password: motDePasse,
      data: { mot_de_passe_provisoire: false },
    });
    if (error) {
      setEnvoi(false);
      setErreur(
        error.code === "same_password"
          ? "Choisissez un mot de passe différent de l'actuel."
          : "Le mot de passe n'a pas pu être modifié. Réessayez.",
      );
      return;
    }
    rechargerVers("/");
  };

  return (
    <EcranAuth titre="Choisissez votre mot de passe" sousTitre="Il vous servira à chaque connexion. 10 caractères minimum.">
      <form onSubmit={valider} className="space-y-4">
        <label className="block text-sm">
          Nouveau mot de passe
          <input type="password" required autoComplete="new-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} className={`${classeChamp} mt-1 py-2.5`} />
        </label>
        <label className="block text-sm">
          Confirmation
          <input type="password" required autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={`${classeChamp} mt-1 py-2.5`} />
        </label>
        {erreur && <p className="text-sm text-[#b42318]">{erreur}</p>}
        <button type="submit" disabled={envoi} className={`${classeBouton} w-full justify-center py-3 disabled:opacity-60`}>
          {envoi ? "Patientez…" : "Enregistrer et continuer"}
        </button>
      </form>
    </EcranAuth>
  );
}
