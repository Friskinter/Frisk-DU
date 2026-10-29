// Mode de test des parcours (tests Playwright, dossier e2e/) : l'application démarre sans compte
// sur les données de démonstration et n'enregistre rien. Activé uniquement à la compilation par
// NEXT_PUBLIC_FRISK_E2E=1 ; next.config.ts refuse de compiler ce mode sur l'hébergeur.
export const MODE_TEST = process.env.NEXT_PUBLIC_FRISK_E2E === "1";

// Rôle simulé, choisi par le test avant le chargement de la page.
export const CLE_ROLE_TEST = "frisk-e2e-role";

// Données de remplacement (JSON), déposées par le test dans une variable globale (le stockage local
// du navigateur est limité à 5 Mo) : sert aux essais avec un gros volume.
export const CLE_DONNEES_TEST = "__friskDonneesTest";
