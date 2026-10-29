"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { Carte, classeBouton, classeBoutonSecondaire, classeChamp } from "@/components/ui";
import { COULEUR_FRISK, couleurValide, lireCouleur, palette, variablesCouleur } from "@/lib/identite";
import { lireFichier, preparerLogo } from "@/lib/logo-navigateur";
import { modifier } from "@/lib/stockage";
import type { Identite } from "@/lib/types";

type Proposition = { logo: string; couleur: string | null };

const messageImage = (e: unknown) =>
  e instanceof Error && e.message === "Image vide"
    ? "Ce logo est blanc ou vide : il ne se verrait pas sur fond clair. Choisissez une autre image."
    : "Cette image n'a pas pu être lue. Essayez un fichier PNG, JPEG ou SVG.";

// Réglages : logo et couleur de l'entreprise, trouvés sur son site web ou déposés à la main.
export function IdentiteVisuelle({ entreprise, identite }: { entreprise: string; identite: Identite | undefined }) {
  const [brouillon, setBrouillon] = useState<Identite>(identite ?? {});
  const [site, setSite] = useState(identite?.site ?? "");
  const [propositions, setPropositions] = useState<Proposition[]>([]);
  const [etat, setEtat] = useState<{ enCours?: boolean; message?: string; erreur?: boolean }>({});
  const [saisieCouleur, setSaisieCouleur] = useState(identite?.couleur ?? "");

  const modifie = JSON.stringify(brouillon) !== JSON.stringify(identite ?? {});
  const couleur = couleurValide(brouillon.couleur) ? brouillon.couleur : null;
  const p = palette(couleur ?? COULEUR_FRISK);

  const choisirCouleur = (c: string) => {
    setSaisieCouleur(c);
    setBrouillon((b) => ({ ...b, couleur: c }));
  };
  const choisirLogo = (x: Proposition, avecCouleur: boolean) => {
    setBrouillon((b) => ({ ...b, logo: x.logo, ...(avecCouleur && x.couleur ? { couleur: x.couleur } : {}) }));
    if (avecCouleur && x.couleur) setSaisieCouleur(x.couleur);
  };

  const rechercher = async () => {
    setEtat({ enCours: true, message: "Recherche sur votre site…" });
    setPropositions([]);
    try {
      const reponse = await fetch("/api/identite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ site }) });
      const r = (await reponse.json()) as { logos?: string[]; couleur?: string | null; site?: string; erreur?: string };
      if (!reponse.ok) throw new Error(r.erreur);
      const prets = (await Promise.all((r.logos ?? []).map((l) => preparerLogo(l).catch(() => null)))).filter((x): x is Proposition => !!x);
      setPropositions(prets);
      const c = r.couleur ?? prets[0]?.couleur ?? null;
      setBrouillon((b) => ({ ...b, site: r.site, ...(prets[0] ? { logo: prets[0].logo } : {}), ...(c ? { couleur: c } : {}) }));
      if (c) setSaisieCouleur(c);
      setEtat({
        message: prets.length
          ? `${prets.length > 1 ? `${prets.length} images trouvées : choisissez votre logo ci-dessous.` : "Logo trouvé."} Vérifiez l'aperçu puis enregistrez.`
          : "Aucun logo utilisable sur ce site. Déposez votre logo ci-dessous.",
        erreur: !prets.length,
      });
    } catch (e) {
      setEtat({ message: e instanceof Error && e.message ? e.message : "Recherche impossible. Déposez votre logo ci-dessous.", erreur: true });
    }
  };

  const deposer = async (fichier: File | undefined) => {
    if (!fichier) return;
    if (fichier.size > 5_000_000) return setEtat({ message: "Fichier trop lourd (5 Mo au plus).", erreur: true });
    try {
      const x = await preparerLogo(await lireFichier(fichier));
      // Sans couleur choisie, on reprend celle du logo.
      choisirLogo(x, !couleur);
      setEtat({ message: "Logo prêt. Vérifiez l'aperçu puis enregistrez." });
    } catch (e) {
      setEtat({ message: messageImage(e), erreur: true });
    }
  };

  const enregistrer = () => {
    const valeur: Identite = {
      ...(brouillon.logo ? { logo: brouillon.logo } : {}),
      ...(couleur ? { couleur } : {}),
      ...(brouillon.site ? { site: brouillon.site } : {}),
    };
    modifier((d) => ({ ...d, identite: Object.keys(valeur).length ? valeur : undefined }));
    setBrouillon(valeur);
    setEtat({ message: "Identité visuelle enregistrée." });
  };

  const revenirFrisk = () => {
    if (!confirm("Retirer votre logo et votre couleur, et revenir à l'apparence de Frisk ?")) return;
    modifier((d) => ({ ...d, identite: undefined }));
    setBrouillon({});
    setSaisieCouleur("");
    setPropositions([]);
    setEtat({});
  };

  return (
    <Carte titre="Identité visuelle">
      <p className="mb-4 text-sm text-ardoise">
        Votre logo et votre couleur remplacent ceux de Frisk dans votre espace, sur le formulaire de signalement et dans tous
        vos documents PDF. Indiquez votre site web pour les retrouver automatiquement, ou déposez votre logo.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="block text-sm" htmlFor="identite-site">Site web de l&apos;entreprise</label>
            <div className="mt-1 flex gap-2">
              <input
                id="identite-site"
                value={site}
                placeholder="www.mon-entreprise.fr"
                onChange={(e) => setSite(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && site.trim() && (e.preventDefault(), void rechercher())}
                className={classeChamp}
              />
              <button type="button" className={`${classeBouton} shrink-0 disabled:opacity-60`} disabled={!site.trim() || etat.enCours} onClick={rechercher}>
                Rechercher
              </button>
            </div>
          </div>

          {propositions.length > 1 && (
            <fieldset>
              <legend className="mb-1 text-sm">Images trouvées sur votre site</legend>
              <div className="flex flex-wrap gap-2">
                {propositions.map((x, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={brouillon.logo === x.logo}
                    aria-label={`Image ${i + 1}`}
                    onClick={() => choisirLogo(x, false)}
                    className={`flex h-16 w-28 items-center justify-center rounded-sm border bg-white p-1.5 ${brouillon.logo === x.logo ? "border-bronze ring-2 ring-bronze" : "border-pierre hover:border-bronze"}`}
                  >
                    <Image src={x.logo} alt="" width={100} height={48} unoptimized className="max-h-12 w-auto object-contain" />
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <label className="block text-sm">
            Ou déposez votre logo (PNG, JPEG ou SVG)
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={(e) => {
                void deposer(e.target.files?.[0]);
                e.target.value = "";
              }}
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-sm file:border file:border-pierre file:bg-white file:px-3 file:py-1.5 file:text-sm"
            />
          </label>

          <div>
            <label className="block text-sm" htmlFor="identite-couleur">Couleur principale</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                aria-label="Choisir la couleur"
                value={couleur ?? COULEUR_FRISK}
                onChange={(e) => choisirCouleur(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-sm border border-pierre bg-white p-0.5"
              />
              <input
                id="identite-couleur"
                value={saisieCouleur}
                placeholder="#1f5fa8"
                onChange={(e) => {
                  setSaisieCouleur(e.target.value);
                  const c = lireCouleur(e.target.value);
                  if (c) setBrouillon((b) => ({ ...b, couleur: c }));
                }}
                className={`${classeChamp} max-w-32 font-mono`}
              />
            </div>
            {couleur && (p.accent !== couleur || p.fonce !== couleur) && (
              <p className="mt-1 text-xs text-gris">Frisk DU ajuste les nuances de votre couleur pour que les textes restent bien lisibles.</p>
            )}
          </div>

          {etat.message && (
            <p role="status" className={`text-sm ${etat.erreur ? "text-[#b42318]" : "text-ardoise"}`}>{etat.message}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${classeBouton} disabled:opacity-60`} disabled={!modifie} onClick={enregistrer}>
              Enregistrer l&apos;identité visuelle
            </button>
            {identite && (
              <button type="button" className={classeBoutonSecondaire} onClick={revenirFrisk}>
                Revenir à l&apos;apparence Frisk
              </button>
            )}
          </div>
        </div>

        <Apercu entreprise={entreprise} identite={brouillon} />
      </div>
    </Carte>
  );
}

function Apercu({ entreprise, identite }: { entreprise: string; identite: Identite }) {
  const style = (variablesCouleur(identite) ?? {}) as CSSProperties;
  return (
    <div style={style} aria-label="Aperçu" role="group" className="space-y-3 rounded-sm bg-ivoire p-3">
      <p className="text-xs font-medium uppercase tracking-wider text-gris">Aperçu</p>
      <div className="rounded-sm bg-menu p-3 text-pierre">
        <div className="flex items-center gap-3">
          <Logo identite={identite} />
          <p className="truncate text-sm text-marbre">{entreprise || "Votre entreprise"}</p>
        </div>
        <p className="mt-3 rounded-sm bg-bronze px-3 py-1.5 text-sm text-encre">▦ Tableau de bord</p>
        <p className="px-3 py-1.5 text-sm">▤ Document unique</p>
        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-pierre/70">
          <Image src="/logo-frisk.png" alt="" width={12} height={12} className="h-3 w-3 rounded-[2px]" />
          Réalisé avec Frisk DU
        </p>
      </div>
      <div className="rounded-sm border border-pierre bg-white p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-bronze-fonce">{entreprise || "Votre entreprise"}</p>
            <p className="font-serif text-lg text-titre">Document unique</p>
          </div>
          <Logo identite={identite} petit />
        </div>
        <span className={`${classeBouton} mt-3`}>⬇ Télécharger le PDF</span>
      </div>
    </div>
  );
}

// Logo de l'entreprise sur une pastille blanche (lisible sur le menu noir), sinon celui de Frisk.
export function Logo({ identite, petit = false, grand = false }: { identite: Identite | undefined; petit?: boolean; grand?: boolean }) {
  if (!identite?.logo) {
    return <Image src="/logo-frisk.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-sm" />;
  }
  const taille = grand ? "h-10 max-w-32 lg:h-16 lg:max-w-full lg:p-2" : petit ? "h-10 max-w-28" : "h-10 max-w-32";
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-sm bg-white p-1 ${taille}`}>
      <Image src={identite.logo} alt="" width={200} height={56} unoptimized className="h-full w-auto max-w-full object-contain" />
    </span>
  );
}
