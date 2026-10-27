// Navigation avec rechargement complet : vide les données gardées en mémoire après une connexion,
// une déconnexion ou un changement d'entreprise.
export function rechargerVers(chemin: string) {
  window.location.href = chemin;
}
