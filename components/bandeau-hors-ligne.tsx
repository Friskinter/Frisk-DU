"use client";

import { useSession } from "@/lib/stockage";

// Sans réseau (visite sur le terrain), on dit clairement où sont les saisies et ce qui va se passer.
export function BandeauHorsLigne() {
  const { enregistrement } = useSession();
  if (enregistrement !== "hors-ligne" && enregistrement !== "erreur") return null;
  return (
    <div role="status" className="mb-4 rounded-sm border border-[#fab219] bg-[#fff8e6] px-4 py-2.5 text-sm print:hidden">
      {enregistrement === "hors-ligne" ? (
        <>
          <strong>Hors ligne : vos saisies sont enregistrées sur cet appareil.</strong> Continuez normalement : elles seront
          envoyées automatiquement au retour du réseau, même si vous fermez la page entre-temps.
        </>
      ) : (
        <>
          <strong>Hors connexion : ne fermez pas la page.</strong> Vos dernières saisies n&apos;ont pas pu être gardées sur cet
          appareil ; elles seront envoyées dès le retour du réseau.
        </>
      )}
    </div>
  );
}
