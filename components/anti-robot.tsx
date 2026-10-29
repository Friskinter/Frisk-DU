"use client";

import { useEffect, useRef, useState } from "react";
import { MODE_TEST } from "@/lib/mode-test";

// Vérification anti-robot Cloudflare Turnstile, exigée par Supabase à l'inscription, à la connexion
// et pour le mot de passe oublié (Authentication > Attack Protection > Captcha). Sans
// NEXT_PUBLIC_TURNSTILE_SITE_KEY, ni en mode de test, rien n'est affiché ni exigé.
// Un jeton ne sert qu'une fois : après chaque envoi, changer la `key` du composant pour en obtenir un neuf.
const CLE_SITE = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
export const ANTI_ROBOT_ACTIF = Boolean(CLE_SITE) && !MODE_TEST;

type Turnstile = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      language: string;
      callback: (jeton: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let chargement: Promise<Turnstile> | null = null;

function chargerTurnstile() {
  chargement ??= new Promise<Turnstile>((ok, echec) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => (window.turnstile ? ok(window.turnstile) : echec(new Error("Turnstile absent")));
    script.onerror = () => {
      chargement = null;
      script.remove();
      echec(new Error("Turnstile non chargé"));
    };
    document.head.appendChild(script);
  });
  return chargement;
}

// onJeton reçoit le jeton à transmettre à Supabase (captchaToken), ou "" quand il expire.
export function AntiRobot({ onJeton }: { onJeton: (jeton: string) => void }) {
  const conteneur = useRef<HTMLDivElement>(null);
  const [indisponible, setIndisponible] = useState(false);

  useEffect(() => {
    const element = conteneur.current;
    if (!ANTI_ROBOT_ACTIF || !element) return;
    let annule = false;
    let widget: { turnstile: Turnstile; id: string } | null = null;
    chargerTurnstile()
      .then((turnstile) => {
        if (annule) return;
        const id = turnstile.render(element, {
          sitekey: CLE_SITE!,
          language: "fr",
          callback: onJeton,
          "expired-callback": () => onJeton(""),
          "error-callback": () => onJeton(""),
        });
        widget = { turnstile, id };
      })
      .catch(() => {
        if (!annule) setIndisponible(true);
      });
    return () => {
      annule = true;
      if (widget) widget.turnstile.remove(widget.id);
    };
  }, [onJeton]);

  if (!ANTI_ROBOT_ACTIF) return null;
  return (
    <div>
      <div ref={conteneur} className="min-h-[65px]" />
      {indisponible && (
        <p role="alert" className="text-sm text-[#b42318]">
          La vérification anti-robot n&apos;a pas pu se charger. Désactivez le bloqueur de publicités pour ce site ou rechargez la page.
        </p>
      )}
    </div>
  );
}
