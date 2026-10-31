import { describe, expect, it } from "vitest";
import { ajouterAFile, lireFile, memoriserFile } from "@/lib/file-attente";
import type { Operation } from "@/lib/operations";

function stockage(plein = false) {
  const valeurs = new Map<string, string>();
  return {
    valeurs,
    getItem: (cle: string) => valeurs.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => {
      if (plein) throw new Error("QuotaExceededError");
      valeurs.set(cle, valeur);
    },
    removeItem: (cle: string) => void valeurs.delete(cle),
  };
}

const modif = (id: string, champs: Record<string, unknown>): Operation => ({ type: "modification", collection: "visites", id, champs });

describe("modifications gardées sur l'appareil", () => {
  it("garde la file d'une entreprise et d'un utilisateur, et la vide une fois envoyée", () => {
    const s = stockage();
    expect(memoriserFile("E1", "Marie@exemple.fr", [modif("v1", { synthese: "RAS" })], s)).toBe(true);
    expect(lireFile("E1", "marie@exemple.fr", s)).toEqual([modif("v1", { synthese: "RAS" })]);
    // Un autre utilisateur, ou une autre entreprise, sur le même appareil : rien à envoyer.
    expect(lireFile("E1", "paul@exemple.fr", s)).toEqual([]);
    expect(lireFile("E2", "marie@exemple.fr", s)).toEqual([]);
    memoriserFile("E1", "marie@exemple.fr", [], s);
    expect(s.valeurs.size).toBe(0);
  });

  it("stockage plein ou bloqué : signalé, sans planter", () => {
    expect(memoriserFile("E1", "m@x.fr", [modif("v1", {})], stockage(true))).toBe(false);
    expect(memoriserFile("E1", "m@x.fr", [modif("v1", {})], null)).toBe(false);
    expect(lireFile("E1", "m@x.fr", null)).toEqual([]);
  });

  it("contenu illisible : file vide", () => {
    const s = stockage();
    s.valeurs.set("frisk-en-attente:E1:m@x.fr", "{pas du json");
    expect(lireFile("E1", "m@x.fr", s)).toEqual([]);
  });

  it("fusionne les modifications successives d'un même élément", () => {
    let file: Operation[] = [];
    for (const texte of ["R", "RA", "RAS"]) file = ajouterAFile(file, [modif("v1", { synthese: texte })]);
    file = ajouterAFile(file, [modif("v1", { unite: "Quai" })]);
    expect(file).toEqual([modif("v1", { synthese: "RAS", unite: "Quai" })]);
    // Un autre élément entre les deux : l'ordre est respecté, rien n'est fusionné.
    file = ajouterAFile(file, [modif("v2", { synthese: "x" }), modif("v1", { synthese: "OK" })]);
    expect(file.map((o) => (o.type === "modification" ? o.id : ""))).toEqual(["v1", "v2", "v1"]);
  });
});
