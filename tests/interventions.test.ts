import { describe, expect, it } from "vitest";
import { calculerAlertes } from "@/lib/alertes";
import { donneesDemo } from "@/lib/demo";
import { normaliser } from "@/lib/donnees";
import {
  dernierSuivi,
  elementsManquants,
  etatIntervention,
  nouveauRisqueIntervention,
  nouveauSuivi,
  nouvelleIntervention,
  planEcritObligatoire,
  risqueDuTravail,
  travauxDangereux,
} from "@/lib/interventions";
import { libelleElement } from "@/lib/journal";
import { appliquerOperations, calculerOperations } from "@/lib/operations";
import type { Donnees, Intervention } from "@/lib/types";

const aujourdhui = "2026-10-28";
const signatures: Donnees["signatures"] = {
  eu: { image: "data:image/png;base64,AA", date: "2026-10-01", salarieId: "", nom: "C. Moreau" },
  ee: { image: "data:image/png;base64,AA", date: "2026-10-01", salarieId: "", nom: "K. B." },
};

function complete(champs: Partial<Intervention> = {}): Intervention {
  return nouvelleIntervention({
    entreprise: "Net'Indus", objet: "Nettoyage", debut: "2026-10-01", fin: "2026-12-31",
    inspectionLe: "2026-09-25", secours: "SST : Laurent P.",
    risques: [nouveauRisqueIntervention({ risque: "Heurt par un chariot", mesures: "Allées fermées" })],
    signatureEu: "eu", signatureEe: "ee",
    ...champs,
  });
}

describe("plans de prévention", () => {
  it("plan écrit obligatoire à partir de 400 heures ou pour un travail dangereux", () => {
    expect(planEcritObligatoire({ heures: 399, travauxDangereux: [] })).toBe(false);
    expect(planEcritObligatoire({ heures: 400, travauxDangereux: [] })).toBe(true);
    expect(planEcritObligatoire({ heures: 8, travauxDangereux: ["hauteur"] })).toBe(true);
  });

  it("liste des travaux dangereux : codes uniques, risque type pour chacun", () => {
    const codes = travauxDangereux.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain("points-chauds");
    for (const code of codes) expect(risqueDuTravail(code)?.mesures).toBeTruthy();
    expect(risqueDuTravail("inconnu")).toBeNull();
  });

  it("indique ce qui manque, dans l'ordre de préparation", () => {
    expect(elementsManquants(complete(), signatures)).toEqual([]);
    expect(elementsManquants(complete({ inspectionLe: "", signatureEe: undefined }), signatures)).toEqual([
      "l'inspection commune préalable",
      "les signatures des deux entreprises",
    ]);
    // Une ligne de risque sans mesure ne compte pas comme une analyse.
    expect(elementsManquants(complete({ risques: [nouveauRisqueIntervention({ risque: "Chute" })] }), signatures)).toContain(
      "l'analyse des risques d'interférence",
    );
  });

  it("état : à préparer, à signer, à venir, en cours, terminée", () => {
    expect(etatIntervention(complete({ secours: "" }), signatures, aujourdhui)).toBe("a-preparer");
    expect(etatIntervention(complete({ signatureEu: undefined }), signatures, aujourdhui)).toBe("a-signer");
    expect(etatIntervention(complete({ debut: "2026-11-15" }), signatures, aujourdhui)).toBe("a-venir");
    expect(etatIntervention(complete(), signatures, aujourdhui)).toBe("en-cours");
    expect(etatIntervention(complete({ fin: "2026-10-27", secours: "" }), signatures, aujourdhui)).toBe("terminee");
  });

  it("dernier suivi : inspection commune ou dernière réunion", () => {
    const i = complete({ suivi: [nouveauSuivi({ date: "2026-10-20" }), nouveauSuivi({ date: "2026-10-05" })] });
    expect(dernierSuivi(i)).toBe("2026-10-20");
    expect(dernierSuivi(complete({ suivi: [] }))).toBe("2026-09-25");
  });

  it("alertes : intervention en cours sans plan signé, plan à préparer avant le début", () => {
    const base = normaliser({ ...donneesDemo(aujourdhui), signatures });
    const d = {
      ...base,
      interventions: [
        complete({ id: "a", entreprise: "Échafaudages Durand", travauxDangereux: ["hauteur"], signatureEe: undefined }),
        complete({ id: "b", entreprise: "Peinture Martin", heures: 20, inspectionLe: "" }),
        complete({ id: "c", entreprise: "Soudure Rhône", debut: "2026-11-05", fin: "2026-11-08", signatureEu: undefined, signatureEe: undefined }),
        complete({ id: "d", entreprise: "Déjà signé", debut: "2026-11-02" }),
      ],
    };
    const alertes = calculerAlertes(d, aujourdhui);
    const sansPlan = alertes.find((a) => a.id === "interventions-sans-plan");
    expect(sansPlan?.gravite).toBe("critique");
    expect(sansPlan?.detail).toContain("Échafaudages Durand");
    expect(sansPlan?.lien).toBe("/entreprises-exterieures?intervention=a");
    expect(alertes.find((a) => a.id === "interventions-a-completer")?.detail).toContain("Peinture Martin");
    const aPreparer = alertes.find((a) => a.id === "interventions-a-preparer");
    expect(aPreparer?.detail).toContain("Soudure Rhône");
    expect(aPreparer?.detail).not.toContain("Déjà signé");
  });

  it("alerte de suivi : travaux dangereux sans réunion de coordination depuis 3 mois", () => {
    const d = { ...normaliser(donneesDemo(aujourdhui)), signatures, interventions: [complete({ travauxDangereux: ["electrique"], inspectionLe: "2026-06-01", debut: "2026-06-02" })] };
    expect(calculerAlertes(d, aujourdhui).some((a) => a.id === "interventions-suivi")).toBe(true);
  });

  it("démonstration : un plan signé en cours, un plan à préparer avant des travaux par points chauds", () => {
    const d = donneesDemo(aujourdhui);
    const etats = d.interventions.map((i) => etatIntervention(i, d.signatures, aujourdhui));
    expect(etats).toEqual(["en-cours", "a-preparer"]);
    expect(calculerAlertes(d, aujourdhui).some((a) => a.id === "interventions-a-preparer")).toBe(true);
  });

  it("enregistrement : signature et plan passent par les opérations", () => {
    const avant = normaliser(donneesDemo(aujourdhui));
    const i = nouvelleIntervention({ entreprise: "Net'Indus" });
    const apres = {
      ...avant,
      interventions: [...avant.interventions, { ...i, signatureEe: "s1" }],
      signatures: { ...avant.signatures, s1: { image: "x", date: aujourdhui, salarieId: "", nom: "K. B." } },
    };
    const ops = calculerOperations(avant, apres);
    expect(ops.map((o) => o.type).sort()).toEqual(["ajout", "signature"]);
    expect(appliquerOperations(avant, ops)).toEqual(apres);
  });

  it("journal : libellé lisible", () => {
    const d = normaliser(donneesDemo(aujourdhui));
    const i = d.interventions[0];
    expect(
      libelleElement({ id: 1, created_at: "", auteur: "", collection: "interventions", element_id: i.id, action: "modification", avant: null, apres: null }, d),
    ).toBe("Plan de prévention : Net'Indus Services");
    expect(
      libelleElement({ id: 2, created_at: "", auteur: "", collection: "signatures", element_id: "x", action: "ajout", avant: null, apres: { nom: "K. B.", salarieId: "" } }, d),
    ).toBe("Signature de K. B.");
  });
});
