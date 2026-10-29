import { describe, expect, it } from "vitest";
import { calculerAlertes } from "@/lib/alertes";
import { emailSignalement } from "@/lib/email-alertes";
import { donneesDemo } from "@/lib/demo";
import { evenementSignale, jetonValide, lienSignalement, lireFormulaire, typeImage } from "@/lib/signalement";

const aujourdhui = "2026-10-28";
const formulaire = (champs: Record<string, unknown> = {}) => ({
  type: "presque-accident", date: "2026-10-27", heure: "14:20", unite: "Zone de stockage", lieu: "Allée B",
  description: "Un luminaire pend au-dessus de l'allée", victime: "", lesions: "", temoins: "", declarant: "Karim",
  ...champs,
});

describe("signalement terrain", () => {
  it("lit et nettoie le formulaire venu de l'extérieur", () => {
    const lu = lireFormulaire(formulaire({ description: `  ${"x".repeat(5000)}  `, inconnu: "ignoré" }), aujourdhui);
    expect(lu.ok && lu.formulaire.description.length).toBe(3000);
    expect(lu.ok && "inconnu" in lu.formulaire).toBe(false);
    // Date dans le futur ou mal formée : celle du jour ; heure invalide : vide.
    const corrige = lireFormulaire(formulaire({ date: "2030-01-01", heure: "25:00" }), aujourdhui);
    expect(corrige.ok && [corrige.formulaire.date, corrige.formulaire.heure]).toEqual([aujourdhui, ""]);
    expect(lireFormulaire(formulaire({ date: 42 }), aujourdhui)).toMatchObject({ ok: true, formulaire: { date: aujourdhui } });
  });

  it("refuse un type inconnu ou une description vide", () => {
    expect(lireFormulaire(formulaire({ type: "accident-trajet" }), aujourdhui).ok).toBe(false);
    expect(lireFormulaire(formulaire({ type: "<script>" }), aujourdhui).ok).toBe(false);
    expect(lireFormulaire(formulaire({ description: "   " }), aujourdhui).ok).toBe(false);
  });

  it("crée un événement à compléter : unité reconnue, accident à déclarer, signalé par le salarié", () => {
    const lu = lireFormulaire(formulaire({ type: "accident-travail", victime: "Paul", lesions: "Coupure" }), aujourdhui);
    if (!lu.ok) throw new Error();
    const photos = [{ chemin: "e1/id/photo-1.jpg", nom: "photo-1.jpg" }];
    const e = evenementSignale(lu.formulaire, "11111111-2222-4333-8444-555555555555", photos, ["Zone de stockage"], "2026-10-28T09:00:00.000Z");
    expect(e).toMatchObject({
      type: "accident-travail", unite: "Zone de stockage", lieu: "Allée B", salarieId: "externe", victime: "Paul", lesions: "Coupure",
      declaration: "a-faire", photos, signalement: { par: "Karim", recuLe: "2026-10-28T09:00:00.000Z" },
    });
    // Unité inconnue : gardée dans le lieu ; presque-accident : ni victime ni lésions ; nom vide : anonyme.
    const autre = lireFormulaire(formulaire({ unite: "Parking", victime: "X", lesions: "Y", declarant: "" }), aujourdhui);
    if (!autre.ok) throw new Error();
    expect(evenementSignale(autre.formulaire, "id", [], ["Zone de stockage"], "t")).toMatchObject({
      unite: "", lieu: "Parking · Allée B", victime: "", lesions: "", declaration: "non-requise", signalement: { par: "Anonyme" },
    });
  });

  it("reconnaît les images par leur contenu, pas par leur nom", () => {
    expect(typeImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(typeImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe("image/png");
    expect(typeImage(new TextEncoder().encode("RIFF1234WEBPVP8 "))).toBe("image/webp");
    expect(typeImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(typeImage(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
  });

  it("jeton du lien : 64 caractères hexadécimaux", () => {
    expect(jetonValide("a".repeat(64))).toBe(true);
    expect(jetonValide("a".repeat(63))).toBe(false);
    expect(jetonValide("../".repeat(22))).toBe(false);
    expect(jetonValide(undefined)).toBe(false);
    expect(lienSignalement("https://du.frisk.fr", "a".repeat(64))).toBe(`https://du.frisk.fr/signaler/${"a".repeat(64)}`);
  });

  it("démonstration : la situation dangereuse signalée hier est à analyser", () => {
    const d = donneesDemo(aujourdhui);
    expect(d.evenements.filter((e) => e.signalement)).toHaveLength(1);
    const alerte = calculerAlertes(d, aujourdhui).find((a) => a.id === "signalements-terrain");
    expect(alerte?.gravite).toBe("importante");
    expect(alerte?.lien).toBe(`/accidents?evenement=${d.evenements[3].id}`);
    // Une fois analysé, le signalement ne figure plus dans l'alerte.
    const analyse = { ...d, evenements: d.evenements.map((e) => (e.signalement ? { ...e, analyseeLe: aujourdhui, enseignements: "Fixation refaite" } : e)) };
    expect(calculerAlertes(analyse, aujourdhui).some((a) => a.id === "signalements-terrain")).toBe(false);
  });

  it("e-mail aux responsables : type et lien seulement, texte échappé", () => {
    const { sujet, html, texte } = emailSignalement("<Atelier & Cie>", "Accident du travail", true, "https://du.frisk.fr/accidents?evenement=1");
    expect(sujet).toBe("Frisk Plateforme · <Atelier & Cie> : nouveau signalement (accident du travail)");
    expect(html).toContain("&lt;Atelier &amp; Cie&gt;");
    expect(html).not.toContain("<Atelier");
    expect(texte).toContain("déclaré à la CPAM dans les 48 heures");
  });
});
