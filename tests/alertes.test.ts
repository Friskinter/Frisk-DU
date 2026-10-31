import { describe, expect, it } from "vitest";
import { alertesAffichees, calculerAlertes, type Alerte } from "@/lib/alertes";
import { donneesDemo } from "@/lib/demo";
import { action, article, donnees, equipement, ligne, mouvement, verification } from "./aides";

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
    const l = ligne({ id: "l1" });
    const d = donnees({
      duerp: [l],
      actions: [
        action("l1", { intitule: "Barrières", echeance: "2026-10-20" }),
        action("l1", { intitule: "Formation", echeance: "2026-11-05" }),
        action("l1", { intitule: "Faite", echeance: "2026-10-01", statut: "fait" }),
      ],
    });
    const a = calculerAlertes(d, aujourdhui);
    expect(a.find((x) => x.id === "actions-retard")?.titre).toBe("1 action de prévention en retard");
    expect(a.find((x) => x.id === "actions-bientot")?.titre).toBe("1 action à échéance dans les 15 jours");
  });

  it("risque critique sans action prévue", () => {
    const d = donnees({ duerp: [ligne({ gravite: 4, frequence: 4 })] });
    expect(ids(d)).toContain("critiques-sans-action");
  });

  it("risque prioritaire traité uniquement par des EPI", () => {
    const l = ligne({ id: "l1", gravite: 4, frequence: 3 });
    const seulEpi = donnees({ duerp: [l], actions: [action("l1", { principe: "epi" })] });
    expect(ids(seulEpi)).toContain("seulement-epi");
    const complete = donnees({ duerp: [l], actions: [action("l1", { principe: "epi" }), action("l1", { principe: "collective" })] });
    expect(ids(complete)).not.toContain("seulement-epi");
  });

  it("efficacité à vérifier un mois après la réalisation", () => {
    const d = donnees({
      duerp: [ligne({ id: "l1" })],
      actions: [action("l1", { statut: "fait", realiseeLe: "2026-09-01" }), action("l1", { statut: "fait", realiseeLe: "2026-10-20" })],
    });
    expect(calculerAlertes(d, aujourdhui).find((a) => a.id === "efficacite-a-verifier")?.titre).toBe(
      "1 action réalisée dont l'efficacité reste à vérifier",
    );
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

  it("à niveau égal, la date la plus proche passe en premier", () => {
    const risque = ligne();
    const chariot = equipement({ nom: "Chariot", periodicite: 12 });
    const d = donnees({
      duerp: [risque],
      // Action dans 12 jours, vérification dans 5 jours : toutes deux « à traiter ».
      actions: [action(risque.id, { intitule: "Garde-corps", echeance: "2026-11-09" })],
      equipements: [chariot],
      verifications: [verification(chariot, { date: "2025-11-02", prochaine: "2026-11-02" })],
    });
    const aTraiter = calculerAlertes(d, aujourdhui, "2026-10-01").filter((a) => a.gravite === "importante");
    expect(aTraiter.map((a) => [a.id, a.date])).toEqual([
      ["verifications-bientot", "2026-11-02"],
      ["actions-bientot", "2026-11-09"],
    ]);
  });

  it("lien vers l'élément lui-même quand l'alerte n'en concerne qu'un", () => {
    const risque = ligne();
    const a1 = action(risque.id, { intitule: "A", echeance: "2026-09-01" });
    const a2 = action(risque.id, { intitule: "B", echeance: "2026-09-02" });
    const lien = (actions: (typeof a1)[]) =>
      calculerAlertes(donnees({ duerp: [risque], actions }), aujourdhui, "2026-10-01").find((a) => a.id === "actions-retard")!.lien;
    expect(lien([a1])).toBe(`/actions?action=${a1.id}`);
    expect(lien([a1, a2])).toBe("/actions");
  });
});

describe("alertes affichées d'emblée au tableau de bord", () => {
  const a = (id: string, gravite: Alerte["gravite"], categorie: Alerte["categorie"] = "DUERP"): Alerte => ({ id, gravite, categorie, titre: id, detail: "", lien: "/" });
  const alertes = [
    a("u1", "critique"), a("u2", "critique", "EPI"),
    a("t1", "importante"), a("t2", "importante", "EPI"), a("t3", "importante"), a("t4", "importante"), a("t5", "importante"), a("t6", "importante"),
    a("s1", "info"), a("s2", "info", "EPI"),
  ];
  const ids = (l: Alerte[]) => l.map((x) => x.id);

  it("montre toutes les urgences puis les 5 points suivants", () => {
    expect(ids(alertesAffichees(alertes, new Set(), "", false))).toEqual(["u1", "u2", "t1", "t2", "t3", "t4", "t5"]);
  });

  it("montre toujours les nouveautés, même au-delà des 5 points", () => {
    expect(ids(alertesAffichees(alertes, new Set(["s2"]), "", false))).toContain("s2");
  });

  it("montre tout sur demande, ou tout le module choisi", () => {
    expect(alertesAffichees(alertes, new Set(), "", true)).toHaveLength(alertes.length);
    expect(ids(alertesAffichees(alertes, new Set(), "EPI", false))).toEqual(["u2", "t2", "s2"]);
  });
});
