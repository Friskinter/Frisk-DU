// Préférences d'e-mail de chaque personne, pour chacune de ses entreprises (table preferences_email,
// migration 019). Sans préférence enregistrée, la personne reçoit tout.

export type PreferencesEmail = {
  recapitulatif: boolean; // récapitulatif des alertes du lundi
  immediats: boolean; // e-mails envoyés sur le moment (signalement terrain, urgences)
};

export const preferencesParDefaut: PreferencesEmail = { recapitulatif: true, immediats: true };

type Ligne = { user_id: string; entreprise_id: string; recapitulatif: boolean; immediats: boolean };

// Préférences de chaque membre d'une entreprise, d'après les lignes de la table.
export function preferencesDe(userId: string, entrepriseId: string, lignes: Ligne[]): PreferencesEmail {
  const l = lignes.find((x) => x.user_id === userId && x.entreprise_id === entrepriseId);
  return l ? { recapitulatif: l.recapitulatif, immediats: l.immediats } : preferencesParDefaut;
}

// Adresses à qui envoyer un e-mail du type donné, parmi les membres de l'entreprise.
export function destinataires(
  membres: { user_id: string; email: string }[],
  entrepriseId: string,
  lignes: Ligne[],
  type: keyof PreferencesEmail,
): string[] {
  return membres.filter((m) => m.email && preferencesDe(m.user_id, entrepriseId, lignes)[type]).map((m) => m.email);
}
