// Opérations d'enregistrement : ce qui a changé entre deux états des données.
// Le navigateur envoie ces opérations à la base (fonction appliquer_operations), qui les applique
// avec les mêmes règles que appliquerOperations ci-dessous, vérifie les droits et tient le journal.

import type { Donnees, Signature } from "./types";

export const collections = ["duerp", "actions", "evenements", "formations", "exigences", "equipements", "verifications", "produits", "interventions", "protocoles", "grilles", "visites", "accueils", "causeries", "salaries", "articles", "mouvements"] as const;
export type Collection = (typeof collections)[number];

export const clesRacine = ["entreprise", "fiche", "services", "unites", "preferences", "identite"] as const;
export type CleRacine = (typeof clesRacine)[number];

export type Operation =
  | { type: "ajout"; collection: Collection; id: string; apres: string | null; valeur: { id: string } }
  | { type: "modification"; collection: Collection; id: string; champs: Record<string, unknown> }
  | { type: "suppression"; collection: Collection; id: string }
  | { type: "racine"; cle: CleRacine; valeur: unknown }
  | { type: "signature"; id: string; valeur: Signature };

type Element = { id: string } & Record<string, unknown>;

const identique = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

function differencesCollection(collection: Collection, avant: Element[], apres: Element[]): Operation[] {
  if (avant === apres) return [];
  const ops: Operation[] = [];
  const anciens = new Map(avant.map((e) => [e.id, e]));
  const nouveaux = new Set(apres.map((e) => e.id));

  for (const e of avant) {
    if (!nouveaux.has(e.id)) ops.push({ type: "suppression", collection, id: e.id });
  }
  apres.forEach((e, i) => {
    const ancien = anciens.get(e.id);
    if (!ancien) {
      ops.push({ type: "ajout", collection, id: e.id, apres: i > 0 ? apres[i - 1].id : null, valeur: e });
    } else if (ancien !== e) {
      const champs: Record<string, unknown> = {};
      for (const cle of new Set([...Object.keys(ancien), ...Object.keys(e)])) {
        if (!identique(ancien[cle], e[cle])) champs[cle] = e[cle] ?? null;
      }
      if (Object.keys(champs).length) ops.push({ type: "modification", collection, id: e.id, champs });
    }
  });
  return ops;
}

export function calculerOperations(avant: Donnees, apres: Donnees): Operation[] {
  const ops: Operation[] = [];
  for (const cle of clesRacine) {
    if (!identique(avant[cle], apres[cle])) ops.push({ type: "racine", cle, valeur: apres[cle] ?? null });
  }
  for (const c of collections) {
    ops.push(...differencesCollection(c, (avant[c] ?? []) as unknown as Element[], (apres[c] ?? []) as unknown as Element[]));
  }
  const signaturesAvant = avant.signatures ?? {};
  for (const [id, valeur] of Object.entries(apres.signatures ?? {})) {
    if (!(id in signaturesAvant)) ops.push({ type: "signature", id, valeur });
  }
  return ops;
}

// Mêmes règles que la base : un ajout déjà présent remplace l'élément, une opération sur un
// élément supprimé est ignorée, un ajout dont le précédent a disparu va en fin de liste.
export function appliquerOperations(donnees: Donnees, ops: Operation[]): Donnees {
  let d = donnees;
  for (const op of ops) {
    if (op.type === "racine") {
      d = { ...d, [op.cle]: op.valeur ?? undefined };
    } else if (op.type === "signature") {
      if (!d.signatures?.[op.id]) d = { ...d, signatures: { ...d.signatures, [op.id]: op.valeur } };
    } else {
      const liste = [...((d[op.collection] ?? []) as unknown as Element[])];
      const pos = liste.findIndex((e) => e.id === op.id);
      if (op.type === "ajout") {
        if (pos >= 0) liste[pos] = op.valeur as Element;
        else if (op.apres === null) liste.unshift(op.valeur as Element);
        else {
          const precedent = liste.findIndex((e) => e.id === op.apres);
          liste.splice(precedent >= 0 ? precedent + 1 : liste.length, 0, op.valeur as Element);
        }
      } else if (pos < 0) {
        continue;
      } else if (op.type === "modification") {
        liste[pos] = { ...liste[pos], ...op.champs };
      } else {
        liste.splice(pos, 1);
      }
      d = { ...d, [op.collection]: liste };
    }
  }
  return d;
}

// Zones modifiables selon le rôle (la base applique les mêmes règles).
export type Role = "admin" | "responsable" | "contributeur" | "lecteur";

export function operationAutorisee(role: Role, op: Operation) {
  if (role === "admin" || role === "responsable") return true;
  if (role === "lecteur") return false;
  return op.type === "signature" || (op.type !== "racine" && op.collection === "mouvements");
}

export const libellesRoles: Record<Exclude<Role, "admin">, { libelle: string; description: string }> = {
  responsable: { libelle: "Responsable", description: "Modifie tout : DUERP, actions, accidents, formations, vérifications, produits chimiques, salariés, catalogue, réglages, versions." },
  contributeur: { libelle: "Contributeur", description: "Saisit les remises et réceptions d'EPI et fait signer les salariés." },
  lecteur: { libelle: "Lecteur", description: "Consulte seulement (par exemple un membre du CSE)." },
};
