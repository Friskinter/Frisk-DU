import { describe, expect, it } from "vitest";
import { calculerEcheances } from "@/lib/echeances";
import { nouvelleIntervention } from "@/lib/interventions";
import { nouveauProtocole } from "@/lib/protocoles";
import { action, donnees, equipement, formation, ligne, salarie, verification } from "./aides";

const AUJOURDHUI = "2026-10-31";

describe("prochaines échéances", () => {
  it("réunit actions, formations, vérifications, interventions et protocoles, par date", () => {
    const risque = ligne({ danger: "Chute de hauteur", unite: "Quai" });
    const pierre = salarie({ nom: "Pierre M." });
    const chariot = equipement({ nom: "Chariot n° 1", periodicite: 12 });
    const d = donnees({
      duerp: [risque],
      actions: [action(risque.id, { intitule: "Garde-corps", echeance: "2026-11-20", responsable: "Julie" })],
      salaries: [pierre],
      formations: [formation({ salarieId: pierre.id, type: "sst", obtenueLe: "2024-11-10", expireLe: "2026-11-10" })],
      equipements: [chariot],
      verifications: [verification(chariot, { date: "2025-11-05", prochaine: "2026-11-05" })],
      interventions: [nouvelleIntervention({ entreprise: "Métal Rhône", debut: "2026-12-01", fin: "2026-12-05", coordinateur: "Julie" })],
    });

    const echeances = calculerEcheances(d, AUJOURDHUI);
    expect(echeances.map((e) => [e.type, e.date])).toEqual([
      ["verification", "2026-11-05"],
      ["formation", "2026-11-10"],
      ["action", "2026-11-20"],
      ["intervention", "2026-12-01"],
    ]);
    const a = echeances.find((e) => e.type === "action")!;
    expect(a).toMatchObject({ titre: "Garde-corps", detail: "Chute de hauteur · Quai", responsable: "Julie", lien: `/actions?risque=${risque.id}`, enRetard: false });
    expect(echeances.find((e) => e.type === "formation")!.detail).toBe("Pierre M.");
  });

  it("garde les échéances dépassées, marquées en retard, et écarte celles au-delà de l'horizon", () => {
    const risque = ligne();
    const d = donnees({
      duerp: [risque],
      actions: [
        action(risque.id, { intitule: "En retard", echeance: "2026-09-01" }),
        action(risque.id, { intitule: "Trop loin", echeance: "2027-06-01" }),
        action(risque.id, { intitule: "Faite", echeance: "2026-11-02", statut: "fait" }),
        action(risque.id, { intitule: "Sans date", echeance: "" }),
      ],
    });
    const echeances = calculerEcheances(d, AUJOURDHUI);
    expect(echeances.map((e) => e.titre)).toEqual(["En retard"]);
    expect(echeances[0].enRetard).toBe(true);
  });

  it("ne suit que la dernière formation de chaque salarié présent", () => {
    const present = salarie({ nom: "Présent" });
    const d = donnees({
      salaries: [present],
      formations: [
        formation({ salarieId: present.id, type: "sst", obtenueLe: "2022-11-10", expireLe: "2024-11-10" }),
        formation({ salarieId: present.id, type: "sst", obtenueLe: "2024-11-10", expireLe: "2026-12-10" }),
        formation({ salarieId: "parti", type: "sst", obtenueLe: "2024-11-10", expireLe: "2026-11-10" }),
      ],
    });
    expect(calculerEcheances(d, AUJOURDHUI).map((e) => e.date)).toEqual(["2026-12-10"]);
  });

  it("protocoles : fin d'un protocole permanent non renouvelé, ou date d'une opération ponctuelle", () => {
    const permanent = nouveauProtocole([], AUJOURDHUI, { transporteur: "Rhône Express", permanent: true, debut: "2025-12-01", fin: "2026-11-30" });
    const ponctuel = nouveauProtocole([], AUJOURDHUI, { transporteur: "ChimTrans", permanent: false, debut: "2026-11-03", fin: "2026-11-03" });
    const echeances = calculerEcheances(donnees({ protocoles: [permanent, ponctuel] }), AUJOURDHUI);
    expect(echeances.map((e) => [e.date, e.titre])).toEqual([
      ["2026-11-03", "Opération de déchargement : ChimTrans"],
      ["2026-11-30", "Protocole à renouveler : Rhône Express"],
    ]);

    // Renouvelé : la période suivante est prévue, plus d'échéance pour l'ancien.
    const suivant = nouveauProtocole([permanent], AUJOURDHUI, { transporteur: "Rhône Express", permanent: true, debut: "2026-12-01", fin: "2027-11-30" });
    expect(calculerEcheances(donnees({ protocoles: [permanent, suivant] }), AUJOURDHUI)).toEqual([]);
  });
});
