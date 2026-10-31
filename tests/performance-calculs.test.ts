import { describe, expect, it } from "vitest";
import { donneesVolumineuses } from "../e2e/volume";
import { calculerAlertes } from "@/lib/alertes";
import { calculerEcheances } from "@/lib/echeances";
import { emailRecapitulatif } from "@/lib/email-alertes";
import { calculerParcours } from "@/lib/parcours";
import { preparerRecapitulatif } from "@/lib/recapitulatif";
import { changementsEnAttente } from "@/lib/reexamen";
import { nouvellesUrgences } from "@/lib/urgences";

// Les alertes, échéances et le parcours sont recalculés à chaque affichage du tableau de bord, et
// pour chaque entreprise par les tâches du matin et du lundi : ils doivent rester rapides sur un
// très gros client (500 risques, 8 000 mouvements d'EPI, 900 signatures…). Les seuils sont larges
// pour une machine d'intégration chargée ; en local, chaque calcul prend quelques millisecondes.
const AUJOURDHUI = "2026-11-02";
const d = donneesVolumineuses(AUJOURDHUI);

// Durée médiane de 5 exécutions, en millisecondes.
function duree(calcul: () => unknown) {
  const durees = Array.from({ length: 5 }, () => {
    const debut = performance.now();
    calcul();
    return performance.now() - debut;
  });
  return durees.sort((a, b) => a - b)[2];
}

describe("calculs rapides sur un très gros client", () => {
  it("alertes, échéances et parcours du tableau de bord", () => {
    const alertes = calculerAlertes(d, AUJOURDHUI, "2026-03-01");
    expect(alertes.some((a) => a.id === "risques-a-reexaminer")).toBe(true);
    expect(duree(() => calculerAlertes(d, AUJOURDHUI, "2026-03-01"))).toBeLessThan(250);
    expect(duree(() => calculerEcheances(d, AUJOURDHUI))).toBeLessThan(100);
    expect(duree(() => calculerParcours(d, { aujourdhui: AUJOURDHUI, versions: 1, derniereVersion: "2026-03-01", lienActif: true }))).toBeLessThan(100);
    expect(duree(() => changementsEnAttente(d))).toBeLessThan(20);
  });

  it("récapitulatif du lundi et urgences du matin, par entreprise", () => {
    const contexte = { versions: 1, derniereVersion: "2026-03-01", lienActif: true };
    const recap = preparerRecapitulatif(d, AUJOURDHUI, contexte);
    expect(duree(() => preparerRecapitulatif(d, AUJOURDHUI, contexte))).toBeLessThan(300);
    expect(duree(() => emailRecapitulatif("Gros client", recap, AUJOURDHUI, "https://app", "responsable"))).toBeLessThan(50);
    const alertes = calculerAlertes(d, AUJOURDHUI, "2026-03-01");
    expect(duree(() => nouvellesUrgences(alertes, new Set()))).toBeLessThan(20);
  });
});
