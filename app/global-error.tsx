"use client";

import { useEffect } from "react";
import { signalerErreur } from "@/components/suivi-erreurs";

// Erreur grave (mise en page générale) : page minimale, sans dépendre du reste de l'application.
export default function ErreurGenerale({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => signalerErreur(error), [error]);
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f7f4ef", color: "#0c0b0a", padding: "4rem 1rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem" }}>Frisk DU est momentanément indisponible</h1>
        <p>Vos données enregistrées ne sont pas perdues. L&apos;équipe Frisk a été prévenue.</p>
        <button type="button" onClick={reset} style={{ marginTop: "1rem", padding: "0.5rem 1rem", background: "#b08d57", border: 0, borderRadius: 2 }}>
          Réessayer
        </button>
      </body>
    </html>
  );
}
