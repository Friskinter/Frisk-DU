"use client";

import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { rechercher, type Resultat } from "@/lib/recherche";
import type { Donnees } from "@/lib/types";

// Champ « Rechercher » en haut du menu, aussi ouvert par Ctrl+K (⌘K sur Mac) depuis n'importe quelle page.
export function RechercheGlobale({ donnees }: { donnees: Donnees | null }) {
  const [ouverte, setOuverte] = useState(false);

  useEffect(() => {
    const raccourci = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOuverte(true);
      }
    };
    document.addEventListener("keydown", raccourci);
    return () => document.removeEventListener("keydown", raccourci);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuverte(true)}
        aria-keyshortcuts="Control+K"
        className="flex w-full items-center gap-2 rounded-sm border border-white/15 px-3 py-1.5 text-left text-sm text-pierre/80 hover:border-white/30 hover:text-marbre"
      >
        <span aria-hidden>⌕</span>
        <span className="flex-1">Rechercher…</span>
        <kbd aria-hidden className="hidden rounded-sm border border-white/15 px-1 text-[10px] lg:inline">Ctrl K</kbd>
      </button>
      {/* Hors du menu : sinon les éléments fixes des pages (en-têtes de tableau…) passent par-dessus. */}
      {ouverte && donnees && createPortal(<Fenetre donnees={donnees} onFermer={() => setOuverte(false)} />, document.body)}
    </>
  );
}

function Fenetre({ donnees, onFermer }: { donnees: Donnees; onFermer: () => void }) {
  const router = useRouter();
  const [saisie, setSaisie] = useState("");
  const recherche = useDeferredValue(saisie);
  const [actif, setActif] = useState(0);
  const champ = useRef<HTMLInputElement>(null);
  const idListe = useId();
  const resultats = useMemo(() => rechercher(donnees, recherche), [donnees, recherche]);

  useEffect(() => {
    champ.current?.focus();
  }, []);

  // Le résultat actif reste visible quand on descend avec les flèches.
  useEffect(() => {
    document.getElementById(`${idListe}-${actif}`)?.scrollIntoView({ block: "nearest" });
  }, [actif, idListe]);

  const ouvrir = (r: Resultat) => {
    onFermer();
    router.push(r.lien);
  };

  const clavier = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onFermer();
    else if (e.key === "ArrowDown" && resultats.length) {
      e.preventDefault();
      setActif((i) => (i + 1) % resultats.length);
    } else if (e.key === "ArrowUp" && resultats.length) {
      e.preventDefault();
      setActif((i) => (i - 1 + resultats.length) % resultats.length);
    } else if (e.key === "Enter" && resultats[actif]) {
      e.preventDefault();
      ouvrir(resultats[actif]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-encre/40 px-4 pt-[10vh]" onClick={onFermer}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rechercher dans Frisk Plateforme"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={clavier}
        className="w-full max-w-xl overflow-hidden rounded-sm bg-white text-encre shadow-xl"
      >
        <input
          ref={champ}
          type="text"
          role="combobox"
          aria-label="Rechercher un salarié, un risque, une action, un produit…"
          aria-expanded={resultats.length > 0}
          aria-controls={idListe}
          aria-activedescendant={resultats[actif] ? `${idListe}-${actif}` : undefined}
          aria-autocomplete="list"
          placeholder="Salarié, risque, action, produit, équipement…"
          value={saisie}
          onChange={(e) => {
            setSaisie(e.target.value);
            setActif(0);
          }}
          className="w-full border-b border-pierre/70 px-4 py-3 text-base outline-none"
        />
        <ul id={idListe} role="listbox" aria-label="Résultats" className="max-h-[60vh] overflow-y-auto">
          {resultats.map((r, i) => (
            <li
              key={`${r.categorie}-${r.id}`}
              id={`${idListe}-${i}`}
              role="option"
              aria-selected={i === actif}
              onMouseMove={() => setActif(i)}
              onClick={() => ouvrir(r)}
              className={`cursor-pointer border-b border-pierre/40 px-4 py-2 text-sm ${i === actif ? "bg-marbre" : ""}`}
            >
              <span className="block text-[10px] uppercase tracking-wider text-gris">{r.categorie}</span>
              <span className="font-medium">{r.titre}</span>
              {r.detail && <span className="text-gris"> · {r.detail}</span>}
            </li>
          ))}
        </ul>
        {recherche.trim() && !resultats.length && <p className="px-4 py-3 text-sm text-gris">Aucun résultat pour « {recherche.trim()} ».</p>}
        {!recherche.trim() && (
          <p className="px-4 py-3 text-sm text-gris">
            Tapez un nom, un danger, un produit… Les flèches choisissent un résultat, Entrée l&apos;ouvre, Échap ferme.
          </p>
        )}
      </div>
    </div>
  );
}
