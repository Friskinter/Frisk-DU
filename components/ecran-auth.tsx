import Image from "next/image";
import Link from "next/link";
import { documentsLegaux } from "@/lib/legal";
import type { ReactNode } from "react";

export function EcranAuth({ titre, sousTitre, children }: { titre: string; sousTitre?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-encre bg-[radial-gradient(ellipse_at_top_right,rgba(176,141,87,0.18),transparent_60%)] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image src="/logo-frisk.png" alt="" width={56} height={56} className="h-14 w-14 rounded-sm" priority />
          <p className="mt-4 font-serif text-2xl tracking-[0.25em] text-marbre">
            FRISK <span className="text-bronze-clair">DU</span>
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gris">Document unique · Pénibilité · EPI</p>
        </div>
        <div className="rounded-sm bg-ivoire p-6 sm:p-8">
          <h1 className="font-serif text-xl">{titre}</h1>
          {sousTitre && <p className="mt-1 text-sm text-ardoise">{sousTitre}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-6 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-gris">
          {documentsLegaux.map((d) => (
            <Link key={d.href} href={d.href} className="hover:text-pierre hover:underline">{d.titre}</Link>
          ))}
        </p>
      </div>
    </div>
  );
}
