import { beforeEach, describe, expect, it, vi } from "vitest";

// Faux client Supabase « administrateur » : on observe ce que la route lui demande.
const etat = vi.hoisted(() => ({
  entreprise: { id: "e1", nom: "Entreprise 1", actif: true } as { id: string; nom: string; actif: boolean } | null,
  evenements: [] as { id: string }[],
  signalementsDerniereHeure: 0,
  depots: [] as string[],
  retraits: [] as string[],
  rpc: [] as unknown[],
  identite: undefined as Record<string, string> | undefined,
}));

vi.mock("@/lib/supabase/serveur", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      const requete = {
        select: () => requete,
        eq: () => requete,
        gt: () => Promise.resolve({ count: etat.signalementsDerniereHeure }),
        maybeSingle: () =>
          Promise.resolve({
            data: table === "entreprises" ? etat.entreprise : { contenu: { unites: ["Quai"], duerp: [], evenements: etat.evenements, identite: etat.identite } },
          }),
      };
      return requete;
    },
    storage: {
      from: () => ({
        upload: (chemin: string) => {
          etat.depots.push(chemin);
          return Promise.resolve({ error: null });
        },
        remove: (chemins: string[]) => {
          etat.retraits.push(...chemins);
          return Promise.resolve({ error: null });
        },
      }),
    },
    rpc: (nom: string, parametres: unknown) => {
      etat.rpc.push(parametres);
      return Promise.resolve({ error: null });
    },
  }),
}));

const { GET, POST } = await import("@/app/api/signalement/route");

const JETON = "a".repeat(64);
const ID = "11111111-2222-4333-8444-555555555555";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);

function envoi(champs: Record<string, string> = {}, photos: Blob[] = []) {
  const corps = new FormData();
  const valeurs = { jeton: JETON, id: ID, type: "presque-accident", description: "Palette instable allée B", date: "2026-10-28", ...champs };
  for (const [cle, valeur] of Object.entries(valeurs)) corps.set(cle, valeur);
  photos.forEach((p, n) => corps.append("photos", p, `photo-${n}.jpg`));
  return POST(new Request("https://du.frisk.fr/api/signalement", { method: "POST", body: corps }));
}

beforeEach(() => {
  etat.entreprise = { id: "e1", nom: "Entreprise 1", actif: true };
  etat.evenements = [];
  etat.signalementsDerniereHeure = 0;
  etat.depots = [];
  etat.retraits = [];
  etat.rpc = [];
});

describe("route de signalement", () => {
  it("GET : nom de l'entreprise et unités, seulement avec un lien valide", async () => {
    const ok = await GET(new Request(`https://du.frisk.fr/api/signalement?jeton=${JETON}`));
    expect(await ok.json()).toEqual({ entreprise: "Entreprise 1", unites: ["Quai"], identite: {} });
    // Logo et couleur de l'entreprise : seulement s'ils sont valides.
    etat.identite = { logo: "data:image/png;base64,iVBORw0KGgo=", couleur: "#002b5c", site: "https://acme.fr/" };
    const avecIdentite = await GET(new Request(`https://du.frisk.fr/api/signalement?jeton=${JETON}`));
    expect((await avecIdentite.json()).identite).toEqual({ logo: "data:image/png;base64,iVBORw0KGgo=", couleur: "#002b5c" });
    etat.identite = { logo: "javascript:alert(1)", couleur: "rouge" };
    expect((await (await GET(new Request(`https://du.frisk.fr/api/signalement?jeton=${JETON}`))).json()).identite).toEqual({});
    etat.identite = undefined;
    expect((await GET(new Request("https://du.frisk.fr/api/signalement?jeton=court"))).status).toBe(404);
    etat.entreprise = { id: "e1", nom: "Entreprise 1", actif: false };
    expect((await GET(new Request(`https://du.frisk.fr/api/signalement?jeton=${JETON}`))).status).toBe(404);
  });

  it("enregistre le signalement et sa photo, rangée dans le dossier de l'entreprise", async () => {
    const reponse = await envoi({}, [new Blob([JPEG], { type: "image/jpeg" })]);
    expect(reponse.status).toBe(200);
    expect(etat.depots).toHaveLength(1);
    expect(etat.depots[0]).toMatch(new RegExp(`^e1/${ID}/\\d+-photo-1\\.jpg$`));
    expect(etat.rpc).toHaveLength(1);
    expect(etat.rpc[0]).toMatchObject({ p_jeton: JETON, p_evenement: { id: ID, type: "presque-accident", photos: [{ nom: "photo-1.jpg" }] } });
  });

  it("envoi répété : ni dépôt de photo ni nouvel enregistrement", async () => {
    etat.evenements = [{ id: ID }];
    const reponse = await envoi({}, [new Blob([JPEG], { type: "image/jpeg" })]);
    expect(reponse.status).toBe(200);
    expect(etat.depots).toEqual([]);
    expect(etat.rpc).toEqual([]);
  });

  it("au-delà de 30 signalements par heure : refus avant tout dépôt", async () => {
    etat.signalementsDerniereHeure = 30;
    const reponse = await envoi({}, [new Blob([JPEG], { type: "image/jpeg" })]);
    expect(reponse.status).toBe(429);
    expect(etat.depots).toEqual([]);
  });

  it("refuse un faux fichier image, un lien invalide, un identifiant ou un type incorrect", async () => {
    const html = new Blob(["<html><script>alert(1)</script></html>"], { type: "image/jpeg" });
    expect((await envoi({}, [html])).status).toBe(400);
    expect((await envoi({ jeton: "x".repeat(64) })).status).toBe(404);
    expect((await envoi({ id: "../../autre-entreprise/x" })).status).toBe(400);
    expect((await envoi({ type: "accident-trajet" })).status).toBe(400);
    expect((await envoi({}, [1, 2, 3, 4].map(() => new Blob([JPEG], { type: "image/jpeg" })))).status).toBe(400);
    expect(etat.depots).toEqual([]);
    expect(etat.rpc).toEqual([]);
  });
});
