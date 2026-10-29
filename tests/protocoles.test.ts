import { describe, expect, it } from "vitest";
import { calculerAlertes } from "@/lib/alertes";
import { donneesDemo } from "@/lib/demo";
import { normaliser } from "@/lib/donnees";
import { libelleElement } from "@/lib/journal";
import { SIGNATURES, dejaRenouvele, elementsManquants, etatProtocole, nouveauProtocole, renouveler } from "@/lib/protocoles";
import type { Donnees, Protocole } from "@/lib/types";

const aujourdhui = "2026-10-28";
const signatures: Donnees["signatures"] = {
  a: { image: "data:image/png;base64,AA", date: "2026-01-05", salarieId: "", nom: "C. Moreau" },
  t: { image: "data:image/png;base64,AA", date: "2026-01-05", salarieId: "", nom: "J. V." },
};

function complet(champs: Partial<Protocole> = {}): Protocole {
  return nouveauProtocole([], "2026-01-05", {
    transporteur: "Rhône Express", lieu: "Quai 1", acces: "Portail A", consignes: "Cales de roues", secours: "SST : Laurent P.",
    responsable: "Responsable entrepôt", vehicules: "Porteur 19 t", marchandises: "Palettes filmées",
    signatureAccueil: "a", signatureTransporteur: "t",
    ...champs,
  });
}

describe("protocoles de sécurité", () => {
  it("un nouveau protocole reprend les informations d'accueil du précédent, valable 12 mois", () => {
    const precedent = complet();
    const p = nouveauProtocole([precedent], aujourdhui);
    expect(p).toMatchObject({ lieu: "Quai 1", acces: "Portail A", consignes: "Cales de roues", responsable: "Responsable entrepôt" });
    expect(p).toMatchObject({ transporteur: "", vehicules: "", marchandises: "", debut: aujourdhui, fin: "2027-10-28", permanent: true });
    expect(p.signatureAccueil).toBeUndefined();
  });

  it("indique ce qui manque, dont les précautions pour les matières dangereuses", () => {
    expect(elementsManquants(complet(), signatures)).toEqual([]);
    expect(elementsManquants(complet({ matieresDangereuses: true }), signatures)).toEqual(["les précautions liées aux matières dangereuses"]);
    expect(elementsManquants(complet({ acces: "", circulation: "Sens unique" }), signatures)).toEqual([]);
    expect(elementsManquants(complet({ vehicules: "", signatureTransporteur: undefined }), signatures)).toEqual([
      "les véhicules du transporteur",
      SIGNATURES,
    ]);
  });

  it("états : à compléter, à signer, à venir, valide, à renouveler, expiré", () => {
    const valide = { debut: "2026-01-05", fin: "2027-01-05" };
    expect(etatProtocole(complet({ ...valide, lieu: "" }), signatures, aujourdhui)).toBe("a-completer");
    expect(etatProtocole(complet({ ...valide, signatureAccueil: undefined }), signatures, aujourdhui)).toBe("a-signer");
    expect(etatProtocole(complet({ debut: "2026-11-02", fin: "2027-11-02" }), signatures, aujourdhui)).toBe("a-venir");
    expect(etatProtocole(complet(valide), signatures, aujourdhui)).toBe("valide");
    expect(etatProtocole(complet({ debut: "2025-11-15", fin: "2026-11-15" }), signatures, aujourdhui)).toBe("a-renouveler");
    // Une opération ponctuelle ne se renouvelle pas.
    expect(etatProtocole(complet({ permanent: false, debut: "2026-11-15", fin: "2026-11-15" }), signatures, "2026-11-15")).toBe("valide");
    expect(etatProtocole(complet({ debut: "2025-10-01", fin: "2026-10-01" }), signatures, aujourdhui)).toBe("expire");
  });

  it("renouvellement : période suivante, sans signatures ; le précédent n'alerte plus", () => {
    const p = complet({ debut: "2025-11-15", fin: "2026-11-15" });
    const q = renouveler(p, aujourdhui);
    expect(q).toMatchObject({ transporteur: "Rhône Express", lieu: "Quai 1", debut: "2026-11-16", fin: "2027-11-16" });
    expect(q.signatureAccueil).toBeUndefined();
    expect(q.id).not.toBe(p.id);
    expect(dejaRenouvele(p, [p, q])).toBe(true);
    expect(dejaRenouvele(q, [p, q])).toBe(false);
    // Un protocole déjà expiré repart d'aujourd'hui.
    expect(renouveler(complet({ debut: "2025-01-01", fin: "2026-01-01" }), aujourdhui).debut).toBe(aujourdhui);
  });

  it("alertes : opérations sans protocole signé, protocole à finaliser, protocole à renouveler", () => {
    const d = {
      ...normaliser(donneesDemo(aujourdhui)),
      signatures,
      protocoles: [
        complet({ id: "p1", transporteur: "Sans signature", debut: "2026-10-01", fin: "2027-10-01", signatureTransporteur: undefined }),
        complet({ id: "p2", transporteur: "La semaine prochaine", permanent: false, debut: "2026-11-03", fin: "2026-11-03", vehicules: "" }),
        complet({ id: "p3", transporteur: "Bientôt échu", debut: "2025-11-15", fin: "2026-11-15" }),
      ],
    };
    const alertes = calculerAlertes(d, aujourdhui);
    const nonSignes = alertes.find((a) => a.id === "protocoles-non-signes");
    expect(nonSignes?.gravite).toBe("critique");
    expect(nonSignes?.lien).toBe("/entreprises-exterieures?protocole=p1");
    expect(alertes.find((a) => a.id === "protocoles-a-preparer")?.detail).toContain("La semaine prochaine");
    expect(alertes.find((a) => a.id === "protocoles-a-renouveler")?.detail).toContain("Bientôt échu");

    // Une fois renouvelé, il n'y a plus d'alerte de renouvellement.
    const renouvele = { ...d, protocoles: [...d.protocoles, renouveler(d.protocoles[2], aujourdhui)] };
    expect(calculerAlertes(renouvele, aujourdhui).some((a) => a.id === "protocoles-a-renouveler")).toBe(false);
  });

  it("démonstration : un protocole à renouveler, une livraison de matières dangereuses à compléter", () => {
    const d = donneesDemo(aujourdhui);
    expect(d.protocoles.map((p) => etatProtocole(p, d.signatures, aujourdhui))).toEqual(["a-renouveler", "a-completer"]);
    const ids = calculerAlertes(d, aujourdhui).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["protocoles-a-renouveler", "protocoles-a-preparer"]));
  });

  it("journal : libellé lisible", () => {
    const d = normaliser(donneesDemo(aujourdhui));
    const p = d.protocoles[0];
    expect(
      libelleElement({ id: 1, created_at: "", auteur: "", collection: "protocoles", element_id: p.id, action: "modification", avant: null, apres: null }, d),
    ).toBe("Protocole de sécurité : Transports Rhône Express");
  });
});
