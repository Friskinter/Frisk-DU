import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Alerte } from "@/lib/alertes";
import { clesUrgence, nouvellesUrgences } from "@/lib/urgences";

const alerte = (id: string, gravite: Alerte["gravite"], elements?: string[]): Alerte => ({ id, gravite, categorie: "DUERP", titre: id, detail: "", lien: "/", elements });

describe("urgences à signaler", () => {
  it("repère chaque urgence par l'alerte et l'élément concerné", () => {
    expect(clesUrgence(alerte("stocks-rupture", "critique", ["gants:9", "casque:U"]))).toEqual(["stocks-rupture:gants:9", "stocks-rupture:casque:U"]);
    expect(clesUrgence(alerte("version-depassee", "critique"))).toEqual(["version-depassee:"]);
  });

  it("ne signale que les urgences nouvelles, pas les points à traiter ni à surveiller", () => {
    const alertes = [alerte("accidents-a-declarer", "critique", ["ev1"]), alerte("actions-bientot", "importante", ["a1"]), alerte("stocks-rupture", "critique", ["gants:9"])];
    const premier = nouvellesUrgences(alertes, new Set());
    expect(premier.aSignaler.map((a) => a.id)).toEqual(["accidents-a-declarer", "stocks-rupture"]);
    expect(premier.nouvelles).toEqual(["accidents-a-declarer:ev1", "stocks-rupture:gants:9"]);

    const lendemain = nouvellesUrgences(alertes, new Set(premier.nouvelles));
    expect(lendemain.aSignaler).toEqual([]);
  });

  it("signale une alerte dès qu'un nouvel élément y apparaît", () => {
    const r = nouvellesUrgences([alerte("actions-retard", "critique", ["a1", "a2"])], new Set(["actions-retard:a1"]));
    expect(r.aSignaler.map((a) => a.id)).toEqual(["actions-retard"]);
    expect(r.nouvelles).toEqual(["actions-retard:a2"]);
  });

  it("oublie les urgences réglées, pour les signaler de nouveau si elles reviennent", () => {
    const r = nouvellesUrgences([], new Set(["stocks-rupture:gants:9"]));
    expect(r.reglees).toEqual(["stocks-rupture:gants:9"]);
  });
});

// Tâche du matin, avec un faux client Supabase « administrateur » qui garde les urgences signalées.
const etat = vi.hoisted(() => ({
  contenu: null as unknown,
  signalees: [] as { entreprise_id: string; cle: string }[],
  preferences: [] as { user_id: string; entreprise_id: string; recapitulatif: boolean; immediats: boolean }[],
}));

vi.mock("@/lib/supabase/serveur", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      const lecture = (data: unknown) => ({ then: (ok: (r: { data: unknown; error: null }) => unknown) => Promise.resolve({ data, error: null }).then(ok) });
      if (table === "entreprises") {
        return {
          select: () => ({
            eq: () =>
              lecture([
                {
                  id: "e1",
                  nom: "Entreprise 1",
                  membres: [
                    { user_id: "a", email: "patron@e1.fr", role: "responsable" },
                    { user_id: "b", email: "salarie@e1.fr", role: "lecteur" },
                  ],
                  espaces: { contenu: etat.contenu },
                  versions: [{ created_at: "2026-09-01T10:00:00Z" }],
                },
              ]),
          }),
        };
      }
      if (table === "preferences_email") return { select: () => lecture(etat.preferences) };
      return {
        select: () => lecture(etat.signalees),
        upsert: (lignes: { entreprise_id: string; cle: string }[]) => {
          etat.signalees.push(...lignes.filter((l) => !etat.signalees.some((s) => s.cle === l.cle)));
          return lecture(null);
        },
        delete: () => ({
          eq: () => ({
            in: (_: string, cles: string[]) => {
              etat.signalees = etat.signalees.filter((s) => !cles.includes(s.cle));
              return lecture(null);
            },
          }),
        }),
      };
    },
  }),
}));

const { GET } = await import("@/app/api/urgences/route");
const { donneesVides } = await import("@/lib/demo");

const accident = (id: string) => ({ id, date: "2026-10-30", type: "accident-travail", declaration: "a-faire", lieu: "Quai" });

describe("tâche du matin des urgences", () => {
  let envois: { to: string; subject: string }[];
  let textes: Record<string, string>;
  const appel = () => GET(new Request("https://du.frisk.fr/api/urgences", { headers: { authorization: "Bearer secret" } }));

  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "secret");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("ALERTES_EXPEDITEUR", "Frisk Plateforme <alertes@frisk.fr>");
    envois = [];
    textes = {};
    vi.stubGlobal("fetch", async (_url: string, options: { body: string }) => {
      const corps = JSON.parse(options.body);
      envois.push({ to: corps.to, subject: corps.subject });
      textes[corps.to] = corps.text;
      return new Response("{}");
    });
    etat.signalees = [];
    etat.preferences = [{ user_id: "b", entreprise_id: "e1", recapitulatif: true, immediats: false }];
    etat.contenu = { ...donneesVides(), evenements: [accident("ev1")] };
  });

  it("refuse un appel sans le secret du planificateur", async () => {
    expect((await GET(new Request("https://du.frisk.fr/api/urgences"))).status).toBe(401);
  });

  it("envoie une seule fois chaque urgence, aux personnes qui le souhaitent", async () => {
    await appel();
    expect(envois).toEqual([{ to: "patron@e1.fr", subject: "Frisk Plateforme · Entreprise 1 : nouvelle urgence" }]);
    expect(etat.signalees.map((s) => s.cle)).toEqual(["accidents-a-declarer:ev1"]);

    envois = [];
    await appel();
    expect(envois).toEqual([]);

    // Un deuxième accident à déclarer : nouvel e-mail.
    etat.contenu = { ...donneesVides(), evenements: [accident("ev1"), accident("ev2")] };
    await appel();
    expect(envois).toHaveLength(1);
    expect(etat.signalees.map((s) => s.cle).sort()).toEqual(["accidents-a-declarer:ev1", "accidents-a-declarer:ev2"]);

    // Les déclarations faites : les urgences sont oubliées.
    etat.contenu = donneesVides();
    envois = [];
    await appel();
    expect(envois).toEqual([]);
    expect(etat.signalees).toEqual([]);
  });

  it("donne le détail au responsable et un résumé au lecteur", async () => {
    etat.preferences = [];
    await appel();
    expect(envois.map((e) => e.to)).toEqual(["patron@e1.fr", "salarie@e1.fr"]);
    expect(textes["patron@e1.fr"]).not.toContain("Version résumée");
    expect(textes["salarie@e1.fr"]).toContain("Version résumée : le détail est réservé aux responsables");
    expect(textes["salarie@e1.fr"].length).toBeLessThan(textes["patron@e1.fr"].length);
  });

  it("en aperçu, n'envoie rien et ne retient rien", async () => {
    const reponse = await GET(new Request("https://du.frisk.fr/api/urgences?apercu=1", { headers: { authorization: "Bearer secret" } }));
    expect((await reponse.json()).rapport).toEqual([{ entreprise: "Entreprise 1", destinataires: ["patron@e1.fr"], urgences: 1, envoye: false }]);
    expect(envois).toEqual([]);
    expect(etat.signalees).toEqual([]);
  });

  it("si l'envoi échoue, l'urgence repartira le lendemain", async () => {
    vi.stubGlobal("fetch", async () => new Response("erreur", { status: 500 }));
    await appel();
    expect(etat.signalees).toEqual([]);
  });
});
