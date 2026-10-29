"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { Logo } from "@/components/identite-visuelle";
import { classeBouton, classeBoutonSecondaire, classeChamp } from "@/components/ui";
import { dateDuJour } from "@/lib/calculs";
import { variablesCouleur } from "@/lib/identite";
import { PHOTOS_MAX, TAILLE_ENVOI_MAX, TAILLE_PHOTO_MAX, TYPES_SIGNALES, type FormulaireSignalement } from "@/lib/signalement";
import type { Identite, TypeEvenement } from "@/lib/types";

// Formulaire de signalement ouvert par le QR code de l'entreprise : sans compte, pensé pour le téléphone.

type Photo = { fichier: Blob; apercu: string };
type Etat = { etape: "chargement" } | { etape: "invalide"; message: string } | { etape: "formulaire"; entreprise: string; unites: string[] } | { etape: "envoye"; entreprise: string; unites: string[] };

const libelle = "mb-1 block text-sm font-medium text-encre";
const AUTRE = "__autre__";

function heureActuelle() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function identifiant() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const o = crypto.getRandomValues(new Uint8Array(16));
  o[6] = (o[6] & 0x0f) | 0x40;
  o[8] = (o[8] & 0x3f) | 0x80;
  const h = [...o].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Photo réduite à 1 600 pixels en JPEG : envoi rapide même avec peu de réseau.
async function reduire(fichier: File): Promise<Blob> {
  try {
    const image = await createImageBitmap(fichier);
    const echelle = Math.min(1, 1600 / Math.max(image.width, image.height));
    const toile = document.createElement("canvas");
    toile.width = Math.round(image.width * echelle);
    toile.height = Math.round(image.height * echelle);
    toile.getContext("2d")!.drawImage(image, 0, 0, toile.width, toile.height);
    image.close();
    const blob = await new Promise<Blob | null>((ok) => toile.toBlob(ok, "image/jpeg", 0.82));
    if (blob) return blob;
  } catch {
    // Format que le navigateur ne sait pas lire : envoyé tel quel s'il est accepté.
  }
  if (["image/jpeg", "image/png", "image/webp"].includes(fichier.type) && fichier.size <= TAILLE_PHOTO_MAX) return fichier;
  throw new Error("illisible");
}

const vide = (): FormulaireSignalement => ({
  type: "" as TypeEvenement, date: dateDuJour(), heure: heureActuelle(), unite: "", lieu: "", description: "", victime: "", lesions: "", temoins: "", declarant: "",
});

export default function PageSignaler() {
  // useParams doit être sous un Suspense avec le pré-rendu de Next.js.
  return (
    <Suspense fallback={null}>
      <Signalement />
    </Suspense>
  );
}

function Signalement() {
  const { jeton } = useParams<{ jeton: string }>();
  const [etat, setEtat] = useState<Etat>({ etape: "chargement" });
  const [f, setF] = useState<FormulaireSignalement>(vide);
  const [autreLieu, setAutreLieu] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [envoi, setEnvoi] = useState<{ id: string; enCours: boolean; erreur: string }>({ id: "", enCours: false, erreur: "" });
  const [identite, setIdentite] = useState<Identite>();

  useEffect(() => {
    fetch(`/api/signalement?jeton=${encodeURIComponent(jeton)}`)
      .then(async (r) => {
        const corps = await r.json();
        if (r.ok) setIdentite(corps.identite);
        setEtat(r.ok ? { etape: "formulaire", entreprise: corps.entreprise, unites: corps.unites } : { etape: "invalide", message: corps.erreur });
      })
      .catch(() => setEtat({ etape: "invalide", message: "Pas de connexion. Réessayez dans un instant." }));
  }, [jeton]);

  const changer = (champs: Partial<FormulaireSignalement>) => {
    setF((x) => ({ ...x, ...champs }));
    // Le formulaire a changé : un nouvel envoi est un nouveau signalement.
    setEnvoi((e) => ({ ...e, id: "", erreur: "" }));
  };

  const ajouterPhotos = async (fichiers: FileList | null) => {
    if (!fichiers) return;
    const nouvelles: Photo[] = [];
    for (const fichier of [...fichiers].slice(0, PHOTOS_MAX - photos.length)) {
      try {
        const blob = await reduire(fichier);
        nouvelles.push({ fichier: blob, apercu: URL.createObjectURL(blob) });
      } catch {
        setEnvoi((e) => ({ ...e, erreur: "Une photo n'a pas pu être lue. Prenez-la à nouveau ou choisissez-en une autre." }));
      }
    }
    setPhotos((p) => [...p, ...nouvelles]);
  };

  const retirerPhoto = (n: number) => {
    URL.revokeObjectURL(photos[n].apercu);
    setPhotos((p) => p.filter((_, i) => i !== n));
  };

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.type) return setEnvoi((x) => ({ ...x, erreur: "Choisissez ce que vous signalez." }));
    if (photos.reduce((t, p) => t + p.fichier.size, 0) > TAILLE_ENVOI_MAX) {
      return setEnvoi((x) => ({ ...x, erreur: "Photos trop lourdes : retirez-en une." }));
    }
    // Le même identifiant est réutilisé si l'envoi est relancé : pas de doublon au registre.
    const id = envoi.id || identifiant();
    setEnvoi({ id, enCours: true, erreur: "" });
    const corps = new FormData();
    corps.set("jeton", jeton);
    corps.set("id", id);
    for (const [cle, valeur] of Object.entries(f)) corps.set(cle, valeur);
    photos.forEach((p, n) => corps.append("photos", p.fichier, `photo-${n + 1}.jpg`));
    try {
      const r = await fetch("/api/signalement", { method: "POST", body: corps });
      if (!r.ok) {
        const { erreur } = await r.json().catch(() => ({ erreur: "" }));
        return setEnvoi({ id, enCours: false, erreur: erreur || "Le signalement n'a pas pu être envoyé. Réessayez." });
      }
      if (etat.etape === "formulaire") setEtat({ ...etat, etape: "envoye" });
      photos.forEach((p) => URL.revokeObjectURL(p.apercu));
      setPhotos([]);
      setEnvoi({ id: "", enCours: false, erreur: "" });
    } catch {
      setEnvoi({ id, enCours: false, erreur: "Pas de connexion. Vos informations sont conservées : réessayez dès que possible." });
    }
  };

  const recommencer = () => {
    setF(vide());
    setAutreLieu(false);
    if (etat.etape === "envoye") setEtat({ ...etat, etape: "formulaire" });
  };

  const accident = f.type === "accident-travail";

  return (
    <div className="min-h-screen bg-ivoire" style={(variablesCouleur(identite) ?? undefined) as CSSProperties | undefined}>
      <header className="bg-menu px-4 py-3 text-pierre">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          {identite?.logo ? (
            <Logo identite={identite} />
          ) : (
            <Image src="/logo-frisk.png" alt="" width={32} height={32} className="h-8 w-8 rounded-sm" />
          )}
          <div className="min-w-0">
            {identite?.logo ? (
              "entreprise" in etat && <p className="truncate text-sm text-marbre">{etat.entreprise}</p>
            ) : (
              <>
                <p className="font-serif text-sm tracking-[0.2em] text-marbre">FRISK <span className="text-bronze-clair">PLATEFORME</span></p>
                {"entreprise" in etat && <p className="truncate text-xs text-pierre/80">{etat.entreprise}</p>}
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-6">
        {etat.etape === "chargement" && <p className="text-sm text-ardoise">Chargement…</p>}

        {etat.etape === "invalide" && (
          <div className="rounded-sm border border-pierre/70 bg-white p-5">
            <h1 className="font-serif text-2xl">Lien indisponible</h1>
            <p className="mt-2 text-sm text-ardoise">{etat.message}</p>
            <p className="mt-4 text-sm font-medium">En cas d&apos;urgence, appelez le 112.</p>
          </div>
        )}

        {etat.etape === "envoye" && (
          <div className="rounded-sm border border-[#0ca30c] bg-white p-5" role="status">
            <h1 className="font-serif text-2xl">Merci, c&apos;est envoyé</h1>
            <p className="mt-2 text-sm text-ardoise">
              Votre signalement a été transmis aux responsables de la prévention. Grâce à vous, le danger pourra être corrigé.
            </p>
            <button type="button" className={`${classeBoutonSecondaire} mt-4`} onClick={recommencer}>
              Faire un autre signalement
            </button>
          </div>
        )}

        {etat.etape === "formulaire" && (
          <form onSubmit={envoyer} className="space-y-5">
            <div>
              <h1 className="font-serif text-2xl">Signaler un accident ou un danger</h1>
              <p className="mt-1 text-sm text-ardoise">Quelques secondes suffisent. Votre signalement va directement aux responsables de la prévention.</p>
              <p className="mt-2 rounded-sm border border-[#d03b3b] bg-[#d03b3b]/10 p-2 text-sm">
                Quelqu&apos;un est gravement blessé ? Appelez d&apos;abord le <a href="tel:112" className="font-semibold underline">112</a> et prévenez un sauveteur secouriste.
              </p>
            </div>

            <fieldset>
              <legend className={libelle}>Que voulez-vous signaler ?</legend>
              <div className="grid gap-2">
                {TYPES_SIGNALES.map((t) => (
                  <label
                    key={t.valeur}
                    className={`flex cursor-pointer items-start gap-3 rounded-sm border bg-white p-3 ${f.type === t.valeur ? "border-bronze ring-1 ring-bronze" : "border-pierre"}`}
                  >
                    <input type="radio" name="type" value={t.valeur} checked={f.type === t.valeur} onChange={() => changer({ type: t.valeur })} className="mt-1 accent-bronze" />
                    <span>
                      <span className="block font-medium">{t.libelle}</span>
                      <span className="block text-sm text-ardoise">{t.aide}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className={libelle}>Date</span>
                <input type="date" value={f.date} max={dateDuJour()} onChange={(x) => changer({ date: x.target.value })} className={classeChamp} />
              </label>
              <label>
                <span className={libelle}>Heure</span>
                <input type="time" value={f.heure} onChange={(x) => changer({ heure: x.target.value })} className={classeChamp} />
              </label>
            </div>

            <div className="grid gap-3">
              {etat.unites.length > 0 && (
                <label>
                  <span className={libelle}>Où ?</span>
                  <select
                    value={autreLieu ? AUTRE : f.unite}
                    onChange={(x) => {
                      setAutreLieu(x.target.value === AUTRE);
                      changer({ unite: x.target.value === AUTRE ? "" : x.target.value });
                    }}
                    className={classeChamp}
                  >
                    <option value="">Choisir…</option>
                    {etat.unites.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                    <option value={AUTRE}>Ailleurs</option>
                  </select>
                </label>
              )}
              <label>
                <span className={libelle}>{etat.unites.length > 0 ? "Endroit précis" : "Où ?"}</span>
                <input value={f.lieu} placeholder="Allée C, quai 2, véhicule…" onChange={(x) => changer({ lieu: x.target.value })} className={classeChamp} />
              </label>
            </div>

            <label className="block">
              <span className={libelle}>Que s&apos;est-il passé ?</span>
              <textarea
                required
                minLength={5}
                rows={4}
                value={f.description}
                placeholder={accident ? "Ce que faisait la personne, ce qui s'est passé…" : "Ce que vous avez vu, ce qui aurait pu arriver…"}
                onChange={(x) => changer({ description: x.target.value })}
                className={`${classeChamp} resize-y`}
              />
            </label>

            {accident && (
              <div className="grid gap-3">
                <label>
                  <span className={libelle}>Qui est blessé ?</span>
                  <input value={f.victime} onChange={(x) => changer({ victime: x.target.value })} className={classeChamp} />
                </label>
                <label>
                  <span className={libelle}>Quelle blessure ?</span>
                  <input value={f.lesions} placeholder="Coupure à la main, douleur au dos…" onChange={(x) => changer({ lesions: x.target.value })} className={classeChamp} />
                </label>
                <label>
                  <span className={libelle}>Témoins</span>
                  <input value={f.temoins} onChange={(x) => changer({ temoins: x.target.value })} className={classeChamp} />
                </label>
              </div>
            )}

            <div>
              <span className={libelle}>Photos (facultatif, {PHOTOS_MAX} au maximum)</span>
              {photos.length > 0 && (
                <ul className="mb-2 flex flex-wrap gap-2">
                  {photos.map((p, n) => (
                    <li key={p.apercu} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local de la photo */}
                      <img src={p.apercu} alt={`Photo ${n + 1}`} className="h-24 w-24 rounded-sm object-cover" />
                      <button
                        type="button"
                        onClick={() => retirerPhoto(n)}
                        aria-label={`Retirer la photo ${n + 1}`}
                        className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-encre text-sm text-white"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {photos.length < PHOTOS_MAX && (
                <label className={`${classeBoutonSecondaire} cursor-pointer`}>
                  📷 Ajouter une photo
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={(x) => { void ajouterPhotos(x.target.files); x.target.value = ""; }} />
                </label>
              )}
            </div>

            <label className="block">
              <span className={libelle}>Votre nom (facultatif)</span>
              <input value={f.declarant} autoComplete="name" onChange={(x) => changer({ declarant: x.target.value })} className={classeChamp} />
              <span className="mt-1 block text-xs text-gris">Vous pouvez rester anonyme. Votre nom permet de vous recontacter si besoin.</span>
            </label>

            {envoi.erreur && (
              <p role="alert" className="rounded-sm border border-[#d03b3b] bg-[#d03b3b]/10 p-2 text-sm">{envoi.erreur}</p>
            )}

            <button type="submit" disabled={envoi.enCours} className={`${classeBouton} w-full justify-center py-3 text-base disabled:opacity-60`}>
              {envoi.enCours ? "Envoi en cours…" : "Envoyer le signalement"}
            </button>

            <p className="text-xs text-gris">
              Les informations sont transmises uniquement à {etat.entreprise} pour la prévention des risques.{" "}
              <Link href="/legal/confidentialite" className="underline">Confidentialité</Link>
            </p>
          </form>
        )}
        {identite?.logo && (
          <p className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-gris">
            <Image src="/logo-frisk.png" alt="" width={14} height={14} className="h-3.5 w-3.5 rounded-[2px]" />
            Réalisé avec Frisk Plateforme
          </p>
        )}
      </main>
    </div>
  );
}
