"use client";

import { useRef, useState } from "react";
import { classeBouton, classeBoutonSecondaire, classeChamp } from "@/components/ui";
import { dateDuJour, formaterDate } from "@/lib/calculs";
import type { Signature } from "@/lib/types";

// Les signatures sont enregistrées avec les données de l'entreprise et rechargées à chaque ouverture :
// on les réduit (300 × 96 pixels, noir ou transparent, sans dégradé) pour qu'elles pèsent quelques
// kilo-octets au lieu d'une vingtaine, sans perte de lisibilité à l'écran ni dans les PDF.
function imageCompacte(source: HTMLCanvasElement) {
  const reduite = document.createElement("canvas");
  reduite.width = 300;
  reduite.height = 96;
  const ctx = reduite.getContext("2d")!;
  ctx.drawImage(source, 0, 0, reduite.width, reduite.height);
  const pixels = ctx.getImageData(0, 0, reduite.width, reduite.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const trace = pixels.data[i + 3] >= 80;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = trace ? 12 : 0;
    pixels.data[i + 3] = trace ? 255 : 0;
  }
  ctx.putImageData(pixels, 0, 0);
  return reduite.toDataURL("image/png");
}

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
    onChange(imageCompacte(toile.current!));
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
  // Le nom proposé suit la fiche tant que l'utilisateur ne l'a pas modifié lui-même.
  const [nomSaisi, setNom] = useState<string | null>(null);
  const nom = nomSaisi ?? nomPropose;

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
