"use client";

import { useRef, useState } from "react";
import { classeBouton, classeBoutonSecondaire, classeChamp } from "@/components/ui";
import { dateDuJour, formaterDate } from "@/lib/calculs";
import type { Signature } from "@/lib/types";

// Pavé de signature : au doigt sur tablette ou téléphone, à la souris sur ordinateur.
export function PaveSignature({ onChange }: { onChange: (image: string | null) => void }) {
  const toile = useRef<HTMLCanvasElement>(null);
  const dernier = useRef<{ x: number; y: number } | null>(null);
  const [vide, setVide] = useState(true);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = toile.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };

  const commencer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dernier.current = point(e);
  };

  const tracer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dernier.current) return;
    const ctx = toile.current!.getContext("2d")!;
    const p = point(e);
    ctx.strokeStyle = "#0c0b0a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(dernier.current.x, dernier.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    dernier.current = p;
    if (vide) setVide(false);
  };

  const terminer = () => {
    if (!dernier.current) return;
    dernier.current = null;
    onChange(toile.current!.toDataURL("image/png"));
  };

  const effacer = () => {
    const c = toile.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setVide(true);
    onChange(null);
  };

  return (
    <div>
      <div className="relative rounded-sm border border-dashed border-pierre bg-white">
        <canvas
          ref={toile}
          width={500}
          height={160}
          className="block h-40 w-full cursor-crosshair touch-none"
          onPointerDown={commencer}
          onPointerMove={tracer}
          onPointerUp={terminer}
          onPointerLeave={terminer}
          aria-label="Zone de signature"
        />
        {vide && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gris">
            Signez ici avec le doigt ou la souris
          </span>
        )}
      </div>
      <button type="button" onClick={effacer} className={`${classeBoutonSecondaire} mt-2 py-1 text-xs`}>
        Effacer
      </button>
    </div>
  );
}

// Signature d'un document par une personne qui n'est pas forcément salariée (entreprise extérieure,
// transporteur) : nom et qualité, puis tracé. Une fois validée, la signature ne change plus.
export function BlocSignature({
  titre,
  nomPropose,
  signature,
  onValider,
}: {
  titre: string;
  nomPropose: string;
  signature?: Signature;
  onValider: (signature: Signature) => void;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [nom, setNom] = useState(nomPropose);

  if (signature) {
    return (
      <div className="rounded-sm border border-pierre/70 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ardoise">{titre}</p>
        <p className="mt-1 text-sm">{signature.nom}</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- image en data URL */}
        <img src={signature.image} alt={`Signature de ${signature.nom || titre}`} className="mt-2 h-16 w-auto" />
        <p className="text-xs text-gris">Signé le {formaterDate(signature.date)}</p>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-pierre/70 bg-white p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ardoise">{titre}</p>
      <label className="mb-2 block">
        <span className="mb-1 block text-xs font-medium text-ardoise">Nom et qualité du signataire</span>
        <input value={nom} onChange={(x) => setNom(x.target.value)} className={classeChamp} />
      </label>
      <PaveSignature onChange={setImage} />
      <button
        type="button"
        className={`${classeBouton} mt-2 disabled:opacity-50`}
        disabled={!image || !nom.trim()}
        onClick={() => image && onValider({ image, date: dateDuJour(), salarieId: "", nom: nom.trim() })}
      >
        Valider la signature
      </button>
    </div>
  );
}
