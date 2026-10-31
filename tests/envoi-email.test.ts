import { afterEach, describe, expect, it, vi } from "vitest";
import { bilanEnvois, envoyerEmail, raisonRefus } from "@/lib/envoi-email";

const message = { from: "Frisk <alertes@frisk.fr>", to: "patron@e1.fr", subject: "Sujet", html: "<p>x</p>", text: "x" };

describe("envoi d'un e-mail", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("réussit quand Resend accepte", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ id: "1" }));
    expect(await envoyerEmail("re_test", message)).toEqual({ reussi: true, erreur: "" });
  });

  it("donne la raison d'un refus de Resend", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ statusCode: 403, message: "The frisk.fr domain is not verified." }, { status: 403 }));
    expect(await envoyerEmail("re_test", message)).toEqual({ reussi: false, erreur: "Resend 403 : The frisk.fr domain is not verified." });
  });

  it("ne s'arrête pas si Resend est injoignable", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("délai dépassé");
    });
    expect(await envoyerEmail("re_test", message)).toEqual({ reussi: false, erreur: "Resend injoignable : délai dépassé" });
  });

  it("se contente du code quand la réponse n'est pas lisible", async () => {
    expect(await raisonRefus(new Response("panne", { status: 500 }))).toBe("Resend 500");
    expect((await raisonRefus(Response.json({ message: "x".repeat(900) }, { status: 400 }))).length).toBe(500);
  });
});

describe("bilan de la semaine dans la console", () => {
  it("compte les envois réussis et les échecs des 7 derniers jours", () => {
    const maintenant = Date.parse("2026-11-02T08:00:00Z");
    const envois = [
      { created_at: "2026-11-02T06:30:00Z", reussi: true },
      { created_at: "2026-11-01T06:30:00Z", reussi: false },
      { created_at: "2026-10-20T06:30:00Z", reussi: false },
    ];
    expect(bilanEnvois(envois, maintenant)).toEqual({ reussis: 1, echecs: 1 });
  });
});
