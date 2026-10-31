import { describe, expect, it } from "vitest";
import type { Alerte } from "@/lib/alertes";
import { alerteTraitable, emailRecapitulatif, emailUrgences } from "@/lib/email-alertes";
import { destinatairesAvecRole } from "@/lib/preferences-email";

const alerte = (id: string, categorie: Alerte["categorie"], detail: string): Alerte => ({
  id, gravite: "critique", categorie, titre: `Titre ${id}`, detail, lien: "/", elements: [id],
});
const alertes = [alerte("accidents-a-declarer", "Accidents", "Accident de Paul Martin du 30/10"), alerte("stocks-rupture", "EPI", "Gants nitrile taille 9")];

describe("contenu des e-mails selon le rôle", () => {
  it("le responsable traite tout, le contributeur les EPI, le lecteur rien", () => {
    expect(alertes.map((a) => alerteTraitable(a, "responsable"))).toEqual([true, true]);
    expect(alertes.map((a) => alerteTraitable(a, "admin"))).toEqual([true, true]);
    expect(alertes.map((a) => alerteTraitable(a, "contributeur"))).toEqual([false, true]);
    expect(alertes.map((a) => alerteTraitable(a, "lecteur"))).toEqual([false, false]);
  });

  it("le responsable reçoit tout le détail", () => {
    for (const email of [emailRecapitulatif("E1", { urgences: alertes, echeances: [], autres: [] }, "2026-11-02", "https://app", "responsable"), emailUrgences("E1", alertes, "2026-11-02", "https://app")]) {
      for (const contenu of [email.html, email.texte]) {
        expect(contenu).toContain("Paul Martin");
        expect(contenu).toContain("Gants nitrile");
        expect(contenu).not.toContain("Version résumée");
      }
    }
  });

  it("le contributeur ne reçoit le détail que pour les EPI", () => {
    for (const email of [emailRecapitulatif("E1", { urgences: alertes, echeances: [], autres: [] }, "2026-11-02", "https://app", "contributeur"), emailUrgences("E1", alertes, "2026-11-02", "https://app", "contributeur")]) {
      for (const contenu of [email.html, email.texte]) {
        expect(contenu).not.toContain("Paul Martin");
        expect(contenu).toContain("Gants nitrile");
        expect(contenu).toContain("Titre accidents-a-declarer");
        expect(contenu).toContain("Le détail n'est donné que pour les EPI");
      }
    }
  });

  it("le lecteur reçoit un résumé : les titres, sans les noms ni le détail", () => {
    for (const email of [emailRecapitulatif("E1", { urgences: alertes, echeances: [], autres: [] }, "2026-11-02", "https://app", "lecteur"), emailUrgences("E1", alertes, "2026-11-02", "https://app", "lecteur")]) {
      expect(email.sujet).toContain("E1");
      for (const contenu of [email.html, email.texte]) {
        expect(contenu).not.toContain("Paul Martin");
        expect(contenu).not.toContain("Gants nitrile");
        expect(contenu).toContain("Titre stocks-rupture");
        expect(contenu).toContain("Version résumée");
      }
    }
  });

  it("donne le rôle de chaque destinataire, lecteur par défaut", () => {
    const membres = [
      { user_id: "a", email: "a@e1.fr", role: "responsable" },
      { user_id: "b", email: "b@e1.fr", role: "contributeur" },
      { user_id: "c", email: "c@e1.fr", role: null },
      { user_id: "d", email: "d@e1.fr", role: "lecteur" },
    ];
    const lignes = [{ user_id: "d", entreprise_id: "e1", recapitulatif: false, immediats: true }];
    expect(destinatairesAvecRole(membres, "e1", lignes, "recapitulatif")).toEqual([
      { email: "a@e1.fr", role: "responsable" },
      { email: "b@e1.fr", role: "contributeur" },
      { email: "c@e1.fr", role: "lecteur" },
    ]);
  });
});
