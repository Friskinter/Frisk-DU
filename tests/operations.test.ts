import { describe, expect, it } from "vitest";
import { donneesDemo } from "@/lib/demo";
import { appliquerOperations, calculerOperations, operationAutorisee } from "@/lib/operations";
import type { Donnees } from "@/lib/types";
import { donnees, ligne } from "./aides";

// JSON ne distingue pas undefined et absent : on compare comme la base le ferait.
const json = (d: Donnees) => JSON.parse(JSON.stringify(d));

function allerRetour(avant: Donnees, apres: Donnees) {
  const ops = calculerOperations(avant, apres);
  expect(json(appliquerOperations(avant, ops))).toEqual(json(apres));
  return ops;
}

describe("calcul des opérations", () => {
  const l1 = ligne({ id: "l1" });
  const l2 = ligne({ id: "l2" });
  const base = donnees({ duerp: [l1, l2] });

  it("aucune opération sans changement", () => {
    expect(calculerOperations(base, base)).toEqual([]);
    expect(calculerOperations(base, { ...base, duerp: [...base.duerp] })).toEqual([]);
  });

  it("ajout au milieu, avec la position", () => {
    const l3 = ligne({ id: "l3" });
    const ops = allerRetour(base, { ...base, duerp: [l1, l3, l2] });
    expect(ops).toEqual([{ type: "ajout", collection: "duerp", id: "l3", apres: "l1", valeur: l3 }]);
  });

  it("ajout en tête", () => {
    const l0 = ligne({ id: "l0" });
    const ops = allerRetour(base, { ...base, duerp: [l0, l1, l2] });
    expect(ops[0]).toMatchObject({ type: "ajout", apres: null });
  });

  it("modification : seuls les champs changés sont envoyés", () => {
    const ops = allerRetour(base, { ...base, duerp: [{ ...l1, gravite: 4 }, l2] });
    expect(ops).toEqual([{ type: "modification", collection: "duerp", id: "l1", champs: { gravite: 4 } }]);
  });

  it("suppression", () => {
    const ops = allerRetour(base, { ...base, duerp: [l2] });
    expect(ops).toEqual([{ type: "suppression", collection: "duerp", id: "l1" }]);
  });

  it("réglages de l'entreprise et signatures", () => {
    const signature = { image: "data:", date: "2026-10-28", salarieId: "s" };
    const ops = allerRetour(base, { ...base, entreprise: "Nouveau nom", unites: ["Atelier"], signatures: { x: signature } });
    expect(ops.map((o) => o.type)).toEqual(["racine", "racine", "signature"]);
  });

  it("remplacement complet (restauration d'une sauvegarde)", () => {
    allerRetour(donnees(), donneesDemo("2026-10-28"));
    allerRetour(donneesDemo("2026-10-28"), donnees());
  });
});

describe("travail à plusieurs", () => {
  it("les modifications locales en attente sont réappliquées sur la version d'un collègue", () => {
    const base = donnees({ duerp: [ligne({ id: "l1", gravite: 1, frequence: 1 })] });
    // Un collègue change la fréquence pendant que je change la gravité.
    const collegue = { ...base, duerp: [{ ...base.duerp[0], frequence: 4 }] };
    const mesOps = calculerOperations(base, { ...base, duerp: [{ ...base.duerp[0], gravite: 3 }] });
    const fusion = appliquerOperations(collegue, mesOps);
    expect(fusion.duerp[0]).toMatchObject({ gravite: 3, frequence: 4 });
  });

  it("modifier une ligne supprimée par un collègue est sans effet", () => {
    const base = donnees({ duerp: [ligne({ id: "l1" })] });
    const mesOps = calculerOperations(base, { ...base, duerp: [{ ...base.duerp[0], gravite: 4 }] });
    expect(appliquerOperations(donnees(), mesOps).duerp).toEqual([]);
  });

  it("un ajout renvoyé deux fois ne crée pas de doublon", () => {
    const base = donnees();
    const ops = calculerOperations(base, { ...base, duerp: [ligne({ id: "l1" })] });
    expect(appliquerOperations(appliquerOperations(base, ops), ops).duerp).toHaveLength(1);
  });
});

describe("droits par rôle", () => {
  const surDuerp = { type: "modification", collection: "duerp", id: "l", champs: {} } as const;
  const surEpi = { type: "ajout", collection: "mouvements", id: "m", apres: null, valeur: { id: "m" } } as const;

  it("responsable et administrateur : tout", () => {
    expect(operationAutorisee("responsable", surDuerp)).toBe(true);
    expect(operationAutorisee("admin", surDuerp)).toBe(true);
  });
  it("contributeur : EPI seulement", () => {
    expect(operationAutorisee("contributeur", surEpi)).toBe(true);
    expect(operationAutorisee("contributeur", surDuerp)).toBe(false);
  });
  it("lecteur : rien", () => {
    expect(operationAutorisee("lecteur", surEpi)).toBe(false);
  });
});
