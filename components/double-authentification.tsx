"use client";

import { useEffect, useState } from "react";
import { Carte, Pastille, classeBouton, classeBoutonSecondaire, classeChamp } from "@/components/ui";
import { commencerActivation, confirmerActivation, desactiver, facteurActif } from "@/lib/double-auth";

type Activation = { factorId: string; qrCode: string; cle: string };

// Activation et désactivation de la double authentification du compte connecté.
export function DoubleAuthentification({ recommandee, onChange }: { recommandee?: boolean; onChange?: (active: boolean) => void }) {
  const [facteur, setFacteur] = useState<{ id: string; created_at: string } | null | undefined>(undefined);
  const [activation, setActivation] = useState<Activation | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    let actif = true;
    facteurActif().then((f) => {
      if (!actif) return;
      setFacteur(f ? { id: f.id, created_at: f.created_at } : null);
      onChange?.(!!f);
    });
    return () => {
      actif = false;
    };
    // onChange ne sert qu'à prévenir le parent : seule la lecture initiale compte ici.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commencer = async () => {
    setMessage(null);
    setEnvoi(true);
    const a = await commencerActivation();
    setEnvoi(false);
    if (!a) return setMessage({ ok: false, texte: "L'activation n'a pas pu démarrer. Réessayez dans un instant." });
    setActivation(a);
    setCode("");
  };

  const confirmer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activation) return;
    setEnvoi(true);
    const probleme = await confirmerActivation(activation.factorId, code);
    setEnvoi(false);
    if (probleme) return setMessage({ ok: false, texte: probleme });
    setFacteur({ id: activation.factorId, created_at: new Date().toISOString() });
    setActivation(null);
    onChange?.(true);
    setMessage({ ok: true, texte: "Double authentification activée. Le code vous sera demandé à chaque connexion." });
  };

  const retirer = async () => {
    if (!facteur || !confirm("Désactiver la double authentification ? Votre compte ne sera plus protégé que par son mot de passe.")) return;
    const ok = await desactiver(facteur.id);
    if (ok) {
      setFacteur(null);
      onChange?.(false);
    }
    setMessage(ok ? { ok: true, texte: "Double authentification désactivée." } : { ok: false, texte: "La désactivation a échoué. Reconnectez-vous puis réessayez." });
  };

  return (
    <Carte
      titre="Double authentification"
      actions={
        facteur === undefined ? null : facteur ? (
          <Pastille couleur="#0ca30c" texte="#0b0b0b" icone="✓">Activée</Pastille>
        ) : (
          <Pastille couleur="#fab219" texte="#0b0b0b">Désactivée</Pastille>
        )
      }
    >
      {message && (
        <p className={`mb-3 rounded-sm border p-3 text-sm ${message.ok ? "border-[#0ca30c] bg-[#0ca30c]/10" : "border-[#d03b3b] bg-[#d03b3b]/10"}`}>
          {message.ok ? "✓ " : "⚠ "}
          {message.texte}
        </p>
      )}
      <p className="text-sm text-ardoise">
        En plus du mot de passe, un code à 6 chiffres affiché par une application sur votre téléphone (Google Authenticator,
        Microsoft Authenticator, 1Password…) vous est demandé à la connexion. Même si votre mot de passe était dérobé, personne ne
        pourrait accéder aux données. {recommandee ? "Fortement recommandé pour votre rôle." : ""}
      </p>
        {facteur ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-ardoise">Activée le {new Date(facteur.created_at).toLocaleDateString("fr-FR")}.</span>
            <button type="button" onClick={retirer} className={`${classeBoutonSecondaire} hover:text-[#b42318]`}>
              Désactiver
            </button>
          </div>
        ) : activation ? (
          <div className="mt-4 grid gap-6 md:grid-cols-[auto_1fr]">
            {/* QR code fourni par Supabase sous forme d'image SVG. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activation.qrCode} alt="QR code à scanner avec l'application d'authentification" className="h-48 w-48 rounded-sm border border-pierre bg-white p-2" />
            <form onSubmit={confirmer} className="space-y-3 text-sm">
              <ol className="list-decimal space-y-1 pl-5 text-ardoise">
                <li>Installez une application d&apos;authentification sur votre téléphone si vous n&apos;en avez pas.</li>
                <li>Dans l&apos;application, ajoutez un compte et scannez ce QR code.</li>
                <li>Saisissez le code à 6 chiffres qu&apos;elle affiche.</li>
              </ol>
              <p className="text-xs text-gris">
                Impossible de scanner ? Saisissez cette clé dans l&apos;application : <code className="break-all rounded-sm bg-marbre px-1">{activation.cle}</code>
              </p>
              <input
                required
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123 456"
                className={`${classeChamp} max-w-48 py-2.5 text-center text-lg tracking-[0.3em]`}
              />
              <div className="flex gap-2">
                <button type="submit" disabled={envoi} className={`${classeBouton} disabled:opacity-60`}>
                  {envoi ? "Vérification…" : "Activer"}
                </button>
                <button type="button" onClick={() => setActivation(null)} className={classeBoutonSecondaire}>Annuler</button>
              </div>
            </form>
          </div>
        ) : (
          <button type="button" onClick={commencer} disabled={envoi} className={`${classeBouton} mt-4 disabled:opacity-60`}>
            Activer la double authentification
          </button>
        )}
    </Carte>
  );
}
