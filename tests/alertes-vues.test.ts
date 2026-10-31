import { describe, expect, it } from "vitest";
import type { Alerte } from "@/lib/alertes";
import { alertesNouvelles, empreinte, VISITE, vuesDepuis } from "@/lib/alertes-vues";

const alerte = (id: string, elements?: string[], titre = id): Alerte => ({ id, gravite: "importante", categorie: "DUERP", titre, detail: "", lien: "/", elements });

describe("alertes nouvelles depuis la dernière visite", () => {
  it("résume chaque alerte par une empreinte courte, stable et sensible à son contenu", () => {
    const a = alerte("actions-retard", ["a2", "a1"]);
    expect(empreinte(a)).toMatch(/^actions-retard:[0-9a-f]{8}$/);
    expect(empreinte(a)).toBe(empreinte(alerte("actions-retard", ["a1", "a2"])));
    expect(empreinte(a)).not.toBe(empreinte(alerte("actions-retard", ["a1", "a2", "a3"])));
    expect(empreinte(alerte("formations-30j", undefined, "1 formation"))).not.toBe(empreinte(alerte("formations-30j", undefined, "2 formations")));
    expect(empreinte(alerte("x", Array.from({ length: 500 }, (_, i) => `element-${i}`))).length).toBeLessThan(120);
  });

  it("première visite : rien n'est présenté comme nouveau", () => {
    expect(vuesDepuis([])).toBeNull();
    expect(alertesNouvelles([alerte("a")], null).size).toBe(0);
  });

  it("signale les alertes absentes de la dernière visite, ou dont le contenu a changé", () => {
    const avant = [alerte("actions-retard", ["a1"]), alerte("stocks-rupture", ["g"])];
    const vues = vuesDepuis([{ empreinte: VISITE }, ...avant.map((a) => ({ empreinte: empreinte(a) }))]);
    expect(vues?.size).toBe(2);
    const maintenant = [alerte("actions-retard", ["a1", "a2"]), alerte("stocks-rupture", ["g"]), alerte("formations-30j", ["f"])];
    expect([...alertesNouvelles(maintenant, vues)]).toEqual(["actions-retard", "formations-30j"]);
  });

  it("visite précédente sans alerte : tout ce qui apparaît est nouveau", () => {
    expect([...alertesNouvelles([alerte("a"), alerte("b")], vuesDepuis([{ empreinte: VISITE }]))]).toEqual(["a", "b"]);
  });
});
