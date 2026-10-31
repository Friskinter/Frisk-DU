import { describe, expect, it } from "vitest";
import { destinataires, preferencesDe, preferencesParDefaut } from "@/lib/preferences-email";

const E1 = "e1";
const membres = [
  { user_id: "a", email: "responsable@e1.fr" },
  { user_id: "b", email: "contributeur@e1.fr" },
  { user_id: "c", email: "lecteur@e1.fr" },
];
const lignes = [
  { user_id: "b", entreprise_id: E1, recapitulatif: false, immediats: true },
  { user_id: "c", entreprise_id: E1, recapitulatif: true, immediats: false },
  // Préférence de « a » pour une autre entreprise : sans effet ici.
  { user_id: "a", entreprise_id: "e2", recapitulatif: false, immediats: false },
];

describe("préférences d'e-mail par personne", () => {
  it("envoie tout à qui n'a rien réglé", () => {
    expect(preferencesDe("a", E1, lignes)).toEqual(preferencesParDefaut);
    expect(preferencesDe("a", E1, [])).toEqual({ recapitulatif: true, immediats: true });
  });

  it("respecte le choix de chacun, entreprise par entreprise", () => {
    expect(destinataires(membres, E1, lignes, "recapitulatif")).toEqual(["responsable@e1.fr", "lecteur@e1.fr"]);
    expect(destinataires(membres, E1, lignes, "immediats")).toEqual(["responsable@e1.fr", "contributeur@e1.fr"]);
    expect(destinataires(membres, "e2", lignes, "recapitulatif")).toEqual(["contributeur@e1.fr", "lecteur@e1.fr"]);
  });

  it("ignore les membres sans adresse", () => {
    expect(destinataires([{ user_id: "x", email: "" }], E1, [], "recapitulatif")).toEqual([]);
  });
});
