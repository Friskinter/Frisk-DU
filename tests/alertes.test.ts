import { describe, expect, it } from "vitest";
import { calculerAlertes } from "@/lib/alertes";
import { donneesDemo } from "@/lib/demo";
import { article, donnees, ligne, mouvement } from "./aides";

const aujourdhui = "2026-10-28";
const ids = (d: Parameters<typeof calculerAlertes>[0], v?: string | null) =>
  calculerAlertes(d, aujourdhui, v).map((a) => a.id);

describe("alertes", () => {
  it("aucune alerte pour une entreprise vide", () => {
    expect(calculerAlertes(donnees(), aujourdhui, null)).toEqual([]);
  });

  it("mise à jour annuelle : dépassée, proche, ou à jour", () => {
    const d = donnees({ duerp: [ligne()] });
    expect(ids(d, null)).toContain("version-aucune");
    expect(ids(d, "2025-10-01")).toContain("version-depassee");
    expect(ids(d, "2025-12-01")).toContain("version-proche");
    expect(ids(d, "2026-10-01")).not.toContain("version-proche");
    // Sans information sur les versions, pas d'alerte de mise à jour.
    expect(ids(d, undefined).some((i) => i.startsWith("version-"))).toBe(false);
  });

  it("actions en retard et à échéance proche", () => {
    const d = donnees({
      duerp: [
        ligne({ action: "Barrières", echeance: "2026-10-20" }),
        ligne({ action: "Formation", echeance: "2026-11-05" }),
        ligne({ action: "Faite", echeance: "2026-10-01", statut: "fait" }),
      ],
    });
    const a = calculerAlertes(d, aujourdhui);
    expect(a.find((x) => x.id === "actions-retard")?.titre).toBe("1 action de prévention en retard");
    expect(a.find((x) => x.id === "actions-bientot")?.titre).toBe("1 action à échéance dans les 15 jours");
  });

  it("risque critique sans action prévue", () => {
    const d = donnees({ duerp: [ligne({ gravite: 4, frequence: 4, action: "" })] });
    expect(ids(d)).toContain("critiques-sans-action");
  });

  it("stocks en rupture et sous le tampon", () => {
    const vide = article({ nom: "Casque" });
    const bas = article({ nom: "Gants", tampons: { "9": 10 } });
    const d = donnees({
      articles: [vide, bas],
      mouvements: [mouvement({ articleId: bas.id, quantite: 3 })],
    });
    expect(ids(d)).toEqual(expect.arrayContaining(["stocks-rupture", "stocks-tampon"]));
  });

  it("les alertes urgentes passent en premier", () => {
    const gravites = calculerAlertes(donneesDemo(aujourdhui), aujourdhui, "2025-01-01").map((a) => a.gravite);
    const ordre = { critique: 0, importante: 1, info: 2 };
    expect(gravites).toEqual([...gravites].sort((a, b) => ordre[a] - ordre[b]));
  });
});
