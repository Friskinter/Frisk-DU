// Relecture de la version enregistrée pendant que nos propres envois se poursuivent.
// Une lecture partie avant la confirmation d'un de nos envois peut revenir après elle, sans nos
// modifications : fusionnée, elle les ferait disparaître de l'écran (elles restent en base, mais
// nos propres notifications en direct sont ignorées, donc rien ne corrigerait l'affichage).
// Une telle lecture est écartée et refaite.
export function gardeRelecture(essais = 3) {
  let envoisConfirmes = 0;
  return {
    // À appeler dès qu'un envoi est confirmé par la base.
    confirmer() {
      envoisConfirmes++;
    },
    // Contenu lu sans envoi confirmé entre-temps, ou null (lecture impossible, ou envois continus :
    // la prochaine relecture rattrapera).
    async relire<T>(lire: () => Promise<T | null | undefined>): Promise<T | null> {
      for (let i = 0; i < essais; i++) {
        const avant = envoisConfirmes;
        const contenu = await lire();
        if (!contenu) return null;
        if (envoisConfirmes === avant) return contenu;
      }
      return null;
    },
  };
}
