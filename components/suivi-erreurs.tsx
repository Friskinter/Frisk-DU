"use client";

import { useEffect } from "react";
import { erreurIgnoree } from "@/lib/erreurs";
import { MODE_TEST } from "@/lib/mode-test";

const MAX_PAR_PAGE = 10;
const deja = new Set<string>();

// Envoie une erreur au suivi de Frisk (une fois par message, dix au plus par chargement de page).
export function signalerErreur(erreur: unknown, entrepriseId?: string) {
  if (MODE_TEST || typeof window === "undefined") return;
  const message = erreur instanceof Error ? `${erreur.name}: ${erreur.message}` : String(erreur);
  const detail = erreur instanceof Error ? erreur.stack ?? "" : "";
  if (deja.has(message) || deja.size >= MAX_PAR_PAGE || erreurIgnoree(message, detail)) return;
  deja.add(message);
  const corps = JSON.stringify({ message, detail, page: window.location.pathname, navigateur: navigator.userAgent, entrepriseId });
  void fetch("/api/erreurs", { method: "POST", headers: { "content-type": "application/json" }, body: corps, keepalive: true }).catch(() => {});
}

// Écoute les erreurs non rattrapées de toute l'application.
export function SuiviErreurs() {
  useEffect(() => {
    const surErreur = (e: ErrorEvent) => signalerErreur(e.error ?? e.message);
    const surRejet = (e: PromiseRejectionEvent) => signalerErreur(e.reason);
    window.addEventListener("error", surErreur);
    window.addEventListener("unhandledrejection", surRejet);
    return () => {
      window.removeEventListener("error", surErreur);
      window.removeEventListener("unhandledrejection", surRejet);
    };
  }, []);
  return null;
}
