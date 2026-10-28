import type { ReactNode } from "react";

// Champ d'information légale : en rouge tant qu'il n'est pas renseigné dans lib/legal.ts.
export function Champ({ valeur, nom }: { valeur: string; nom: string }) {
  return valeur ? <>{valeur}</> : <span className="rounded-sm bg-[#d03b3b]/10 px-1 text-[#b42318]">[{nom} à compléter]</span>;
}

export function Article({ numero, titre, children }: { numero?: string; titre: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-xl text-encre">
        {numero && <span className="text-bronze">{numero}. </span>}
        {titre}
      </h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

export function Liste({ elements }: { elements: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {elements.map((e, i) => (
        <li key={i}>{e}</li>
      ))}
    </ul>
  );
}
