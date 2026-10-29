import { describe, expect, it } from "vitest";
import { gardeRelecture } from "@/lib/relecture";

// Lecture dont on choisit le moment de la réponse, comme une requête réseau lente.
function lectureLente() {
  const reponses: ((contenu: string) => void)[] = [];
  const lire = () => new Promise<string>((ok) => reponses.push(ok));
  return { lire, repondre: (contenu: string) => reponses.shift()!(contenu), appels: () => reponses.length };
}

const attendre = () => new Promise((ok) => setTimeout(ok, 0));

describe("relecture pendant nos envois", () => {
  it("garde la lecture quand aucun envoi n'a été confirmé entre-temps", async () => {
    const garde = gardeRelecture();
    const { lire, repondre } = lectureLente();
    const resultat = garde.relire(lire);
    repondre("version du collègue");
    expect(await resultat).toBe("version du collègue");
  });

  it("écarte une lecture partie avant la confirmation de notre envoi, et relit", async () => {
    const garde = gardeRelecture();
    const { lire, repondre } = lectureLente();
    const resultat = garde.relire(lire);
    // La lecture part, puis notre envoi est confirmé avant qu'elle revienne : elle est périmée.
    garde.confirmer();
    repondre("version sans notre modification");
    await attendre();
    repondre("version avec notre modification");
    expect(await resultat).toBe("version avec notre modification");
  });

  it("abandonne si nos envois se confirment sans arrêt (la relecture suivante rattrapera)", async () => {
    const garde = gardeRelecture(2);
    const { lire, repondre, appels } = lectureLente();
    const resultat = garde.relire(lire);
    garde.confirmer();
    repondre("périmée 1");
    await attendre();
    garde.confirmer();
    repondre("périmée 2");
    expect(await resultat).toBeNull();
    expect(appels()).toBe(0);
  });

  it("renvoie null si la lecture échoue", async () => {
    const garde = gardeRelecture();
    expect(await garde.relire(async () => undefined)).toBeNull();
  });
});
