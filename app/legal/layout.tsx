import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { DATE_CONDITIONS, documentsLegaux } from "@/lib/legal";

// Pages publiques : accessibles sans compte, depuis la page de connexion et le pied du menu.
export default function LayoutLegal({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ivoire">
      <header className="bg-encre text-pierre">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo-frisk.png" alt="" width={32} height={32} className="h-8 w-8 rounded-sm" />
            <span className="font-serif text-lg tracking-[0.2em] text-marbre">
              FRISK <span className="text-bronze-clair">PLATEFORME</span>
            </span>
          </Link>
          <Link href="/" className="text-sm underline hover:text-marbre">Retour à Frisk Plateforme</Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <nav aria-label="Documents légaux" className="mb-6 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {documentsLegaux.map((d) => (
            <Link key={d.href} href={d.href} className="text-ardoise underline decoration-pierre hover:decoration-bronze">
              {d.titre}
            </Link>
          ))}
        </nav>
        <article className="rounded-sm border border-pierre/70 bg-white p-6 text-sm leading-relaxed text-ardoise sm:p-10">
          {children}
          <p className="mt-10 border-t border-pierre/60 pt-4 text-xs text-gris">Version en vigueur au {DATE_CONDITIONS}.</p>
        </article>
      </main>
    </div>
  );
}
