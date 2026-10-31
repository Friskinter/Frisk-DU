"use client";

import { useRef, type ReactNode } from "react";
import { formatNombre, niveauDe } from "@/lib/calculs";

export const classeChamp =
  "w-full rounded-sm border border-pierre bg-white px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-bronze";

export const classeBouton =
  "inline-flex items-center gap-2 rounded-sm bg-bronze px-3.5 py-2 text-sm font-medium text-encre transition-colors hover:bg-bronze-clair";

export const classeBoutonSecondaire =
  "inline-flex items-center gap-2 rounded-sm border border-pierre bg-white px-3.5 py-2 text-sm text-ardoise transition-colors hover:border-bronze";

export function Chargement() {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-gris">
      Chargement de vos données…
    </div>
  );
}

// En-tête de page : l'action principale et une ou deux actions courantes restent visibles ;
// les actions moins fréquentes (`plus`) sont rangées dans un menu « Plus ».
export function EnTetePage({
  titre,
  description,
  actions,
  plus,
}: {
  titre: string;
  description?: string;
  actions?: ReactNode;
  plus?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-2xl text-titre sm:text-3xl">{titre}</h1>
        {description && (
          <p className="mt-1 max-w-3xl text-sm text-ardoise">{description}</p>
        )}
      </div>
      {(actions || plus) && (
        <div className="flex flex-wrap gap-2">
          {plus && <MenuPlus>{plus}</MenuPlus>}
          {actions}
        </div>
      )}
    </div>
  );
}

// Menu déroulant « Plus » : se referme après un choix.
function MenuPlus({ children }: { children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={menu} className="relative">
      <summary className={`${classeBoutonSecondaire} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>Plus ▾</summary>
      <div
        className="absolute left-0 z-30 mt-1 flex w-64 flex-col gap-1 rounded-sm border border-pierre/70 bg-white p-2 shadow-lg [&>*]:w-full [&>*]:justify-start [&>*]:text-left"
        onClick={() => menu.current?.removeAttribute("open")}
      >
        {children}
      </div>
    </details>
  );
}

export function Carte({
  titre,
  children,
  actions,
  className = "",
}: {
  titre?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-sm border border-pierre/70 bg-white p-4 sm:p-5 ${className}`}>
      {(titre || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {titre && <h2 className="text-sm font-semibold uppercase tracking-wider text-intertitre">{titre}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Indicateur({
  libelle,
  valeur,
  detail,
  alerte,
}: {
  libelle: string;
  valeur: string | number;
  detail?: string;
  alerte?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-sm border border-pierre/70 bg-white p-3 sm:p-4">
      <p className="text-xs uppercase tracking-wider text-gris">{libelle}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums sm:text-3xl ${alerte ? "text-[#b42318]" : "text-encre"}`}>
        {valeur}
      </p>
      {detail && <p className="mt-1 text-xs text-ardoise">{detail}</p>}
    </div>
  );
}

export function Pastille({
  couleur,
  texte,
  icone,
  children,
}: {
  couleur: string;
  texte: string;
  icone?: string;
  children: ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: couleur, color: texte }}
    >
      {icone && <span aria-hidden>{icone}</span>}
      {children}
    </span>
  );
}

const iconesNiveau: Record<string, string> = {
  faible: "✓",
  modere: "~",
  important: "!",
  critique: "‼",
};

export function PastilleCriticite({ score }: { score: number }) {
  const niveau = niveauDe(score);
  return (
    <Pastille couleur={niveau.couleur} texte={niveau.texte} icone={iconesNiveau[niveau.code]}>
      {formatNombre.format(score)} · {niveau.libelle}
    </Pastille>
  );
}

// ---------- Graphiques (une seule série, couleur bronze, info-bulle au survol) ----------

export type Barre = { cle: string; libelle: string; valeur: number; detail?: string };

export function BarresHorizontales({
  donnees,
  format = (v: number) => formatNombre.format(v),
  actif,
  onSelection,
  vide = "Aucune donnée sur la période.",
}: {
  donnees: Barre[];
  format?: (v: number) => string;
  actif?: string;
  onSelection?: (cle: string) => void;
  vide?: string;
}) {
  if (donnees.length === 0) return <p className="py-6 text-center text-sm text-gris">{vide}</p>;
  const max = Math.max(...donnees.map((d) => d.valeur), 1);
  return (
    <ul className="space-y-1">
      {donnees.map((d) => {
        const estinactif = actif && actif !== d.cle;
        return (
          <li key={d.cle}>
            <button
              type="button"
              disabled={!onSelection}
              onClick={() => onSelection?.(d.cle)}
              title={`${d.libelle} : ${format(d.valeur)}${d.detail ? ` — ${d.detail}` : ""}`}
              className="group grid w-full grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded-sm px-1 py-1 text-left hover:bg-marbre/60 disabled:cursor-default sm:grid-cols-[minmax(0,12rem)_1fr_auto]"
            >
              <span className="truncate text-sm text-ardoise">{d.libelle}</span>
              <span className="h-4 rounded-r-[4px] bg-transparent">
                <span
                  className="block h-full rounded-r-[4px] transition-opacity"
                  style={{
                    width: `${Math.max((d.valeur / max) * 100, 1)}%`,
                    background: "#b08d57",
                    opacity: estinactif ? 0.3 : 1,
                  }}
                />
              </span>
              <span className="text-right text-sm tabular-nums text-encre">{format(d.valeur)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function Colonnes({
  donnees,
  format = (v: number) => formatNombre.format(v),
}: {
  donnees: Barre[];
  format?: (v: number) => string;
}) {
  const max = Math.max(...donnees.map((d) => d.valeur), 1);
  return (
    <div>
      <div className="relative flex h-48 items-end gap-[2px] border-b border-[#c3c2b7]">
        {[0.5, 1].map((r) => (
          <div
            key={r}
            className="pointer-events-none absolute inset-x-0 border-t border-[#e1e0d9]"
            style={{ bottom: `${r * 100}%` }}
          >
            <span className="absolute -top-4 left-0 text-[10px] text-gris">{format(max * r)}</span>
          </div>
        ))}
        {donnees.map((d) => (
          <div key={d.cle} className="group relative flex h-full flex-1 items-end justify-center hover:bg-marbre/50">
            <div
              className="w-full max-w-10 rounded-t-[4px]"
              style={{ height: `${(d.valeur / max) * 100}%`, background: "#b08d57" }}
            />
            <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-sm bg-encre px-2 py-1 text-xs text-marbre group-hover:block">
              {d.libelle} : <strong>{format(d.valeur)}</strong>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px]">
        {donnees.map((d, i) => (
          <span key={d.cle} className="flex-1 truncate text-center text-[10px] text-gris">
            {donnees.length > 8 && i % 2 === 1 ? "" : d.libelle}
          </span>
        ))}
      </div>
    </div>
  );
}
