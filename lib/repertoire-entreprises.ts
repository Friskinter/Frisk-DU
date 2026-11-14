import "server-only";
import { ficheDepuisResultat, type FicheOfficielle, type ResultatApi } from "./fiche-officielle";

// API publique « Recherche d'entreprises » de l'État (données de l'INSEE et du registre national des
// entreprises), sans clé. Seules les entreprises en activité sont renvoyées.
const API = "https://recherche-entreprises.api.gouv.fr/search";

export async function chercherEntreprises(recherche: string, nombre = 5): Promise<FicheOfficielle[]> {
  const url = `${API}?${new URLSearchParams({ q: recherche, per_page: String(nombre), etat_administratif: "A" })}`;
  const reponse = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!reponse.ok) throw new Error(`Répertoire des entreprises : ${reponse.status}`);
  const { results } = (await reponse.json()) as { results?: ResultatApi[] };
  return (results ?? []).map(ficheDepuisResultat);
}
