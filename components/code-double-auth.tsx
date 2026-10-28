"use client";

import { useState } from "react";
import { classeBouton, classeChamp } from "@/components/ui";
import { validerCode } from "@/lib/double-auth";
import { deconnecter } from "@/lib/stockage";

// Saisie du code à 6 chiffres de l'application d'authentification.
export function CodeDoubleAuth({ onValide }: { onValide: () => void }) {
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    const probleme = await validerCode(code);
    setEnvoi(false);
    if (probleme) {
      setErreur(probleme);
      setCode("");
      return;
    }
    onValide();
  };

  return (
    <form onSubmit={valider} className="space-y-4 text-left">
      <p className="text-sm text-ardoise">
        Ouvrez votre application d&apos;authentification et saisissez le code à 6 chiffres affiché pour Frisk DU.
      </p>
      <label className="block text-sm">
        Code de vérification
        <input
          required
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className={`${classeChamp} mt-1 py-2.5 text-center text-lg tracking-[0.4em]`}
        />
      </label>
      {erreur && <p className="text-sm text-[#b42318]">{erreur}</p>}
      <button type="submit" disabled={envoi} className={`${classeBouton} w-full justify-center py-3 disabled:opacity-60`}>
        {envoi ? "Vérification…" : "Valider"}
      </button>
      <p className="text-center text-xs text-gris">
        Téléphone perdu ? Contactez Frisk pour réinitialiser votre double authentification.{" "}
        <button type="button" onClick={deconnecter} className="underline">Se déconnecter</button>
      </p>
    </form>
  );
}
