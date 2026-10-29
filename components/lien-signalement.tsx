"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Carte, classeBouton, classeBoutonSecondaire } from "@/components/ui";
import { telechargerAfficheSignalement } from "@/lib/pdf/telecharger";
import { lienSignalement } from "@/lib/signalement";
import { MODE_TEST } from "@/lib/mode-test";
import { supabaseNavigateur } from "@/lib/supabase/client";
import type { Identite } from "@/lib/types";

// Lien de signalement des salariés (QR code) : activation, affiche, changement, désactivation.
export function LienSignalement({ entrepriseId, entreprise, identite, modifiable }: { entrepriseId: string; entreprise: string; identite: Identite | undefined; modifiable: boolean }) {
  const [jeton, setJeton] = useState<string | null | undefined>(MODE_TEST ? "0".repeat(64) : undefined);
  const [qr, setQr] = useState("");
  const [erreur, setErreur] = useState("");
  const [copie, setCopie] = useState(false);
  const lien = jeton ? lienSignalement(window.location.origin, jeton) : "";

  useEffect(() => {
    if (MODE_TEST) return;
    supabaseNavigateur()
      .from("entreprises")
      .select("jeton_signalement")
      .eq("id", entrepriseId)
      .maybeSingle()
      .then(({ data, error }: { data: { jeton_signalement: string | null } | null; error: unknown }) =>
        error ? setErreur("Le lien de signalement n'a pas pu être lu.") : setJeton(data?.jeton_signalement ?? null),
      );
  }, [entrepriseId]);

  useEffect(() => {
    if (!lien) return;
    QRCode.toDataURL(lien, { width: 600, margin: 1, errorCorrectionLevel: "M" }).then(setQr);
  }, [lien]);

  const changer = async (actif: boolean) => {
    if (jeton && !confirm(actif ? "Changer le lien ? Les QR codes déjà affichés ne fonctionneront plus." : "Désactiver le lien ? Les salariés ne pourront plus rien signaler par QR code.")) return;
    setErreur("");
    if (MODE_TEST) return setJeton(actif ? "1".repeat(64) : null);
    const { data, error } = await supabaseNavigateur().rpc("changer_lien_signalement", { p_entreprise: entrepriseId, p_actif: actif });
    if (error) setErreur("La modification a échoué. Réessayez.");
    else setJeton((data as string | null) ?? null);
  };

  const copier = async () => {
    await navigator.clipboard.writeText(lien);
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  };

  return (
    <Carte titre="Signalement par les salariés">
      <p className="mb-3 text-sm text-ardoise">
        Vos salariés signalent un accident, un presque-accident ou une situation dangereuse depuis leur téléphone, sans compte, en scannant un QR code. Chaque
        signalement arrive ici, avec ses photos, et les responsables sont prévenus par e-mail.
      </p>
      {erreur && <p role="alert" className="mb-3 text-sm text-[#b42318]">{erreur}</p>}
      {jeton === undefined && !erreur && <p className="text-sm text-gris">Chargement…</p>}
      {jeton === null && (
        modifiable ? (
          <button type="button" className={classeBouton} onClick={() => changer(true)}>
            Activer le signalement par QR code
          </button>
        ) : (
          <p className="text-sm text-gris">Le signalement par QR code n&apos;est pas activé. Un responsable peut l&apos;activer.</p>
        )
      )}
      {jeton && (
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element -- QR code généré dans le navigateur */}
          {qr && <img src={qr} alt="QR code du lien de signalement" className="h-40 w-40 rounded-sm border border-pierre/70 bg-white p-1" />}
          <div className="min-w-0 space-y-3">
            <p className="break-all rounded-sm bg-marbre/60 p-2 text-xs text-ardoise">{lien}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={classeBouton} disabled={!qr} onClick={() => telechargerAfficheSignalement(entreprise, lien, qr, identite)}>
                ⬇ Affiche à imprimer (PDF)
              </button>
              <button type="button" className={classeBoutonSecondaire} onClick={copier}>
                {copie ? "✓ Lien copié" : "Copier le lien"}
              </button>
              <a href={lien} target="_blank" rel="noopener noreferrer" className={classeBoutonSecondaire}>
                Essayer le formulaire
              </a>
            </div>
            {modifiable && (
              <div className="flex flex-wrap gap-3 text-xs">
                <button type="button" className="text-ardoise underline" onClick={() => changer(true)}>
                  Changer le lien
                </button>
                <button type="button" className="text-ardoise underline hover:text-[#b42318]" onClick={() => changer(false)}>
                  Désactiver
                </button>
                <span className="text-gris">Changez le lien s&apos;il a circulé hors de l&apos;entreprise.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Carte>
  );
}
