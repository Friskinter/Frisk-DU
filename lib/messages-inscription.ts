// Message affiché quand Supabase refuse une inscription, selon le code d'erreur renvoyé.
// Les codes sont ceux de Supabase Auth (https://supabase.com/docs/guides/auth/debugging/error-codes).

export function messageInscription(erreur: { code?: string; status?: number }) {
  switch (erreur.code) {
    case "signup_disabled":
    case "email_provider_disabled":
      return "Les inscriptions sont fermées pour le moment. Contactez Frisk pour ouvrir votre espace.";
    case "captcha_failed":
      return "La vérification anti-robot a échoué. Cochez-la de nouveau puis réessayez.";
    case "weak_password":
      return "Mot de passe trop simple : mélangez lettres, chiffres et caractères spéciaux.";
    case "email_address_invalid":
      return "Cette adresse e-mail n'est pas acceptée. Vérifiez-la ou utilisez votre adresse professionnelle.";
    case "email_address_not_authorized":
      return "L'e-mail de confirmation ne peut pas être envoyé à cette adresse pour le moment. Contactez Frisk.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Trop d'inscriptions en peu de temps. Réessayez dans quelques minutes.";
  }
  if (erreur.status === 429) return "Trop d'inscriptions en peu de temps. Réessayez dans quelques minutes.";
  if (erreur.status && erreur.status >= 500) {
    return "L'e-mail de confirmation n'a pas pu être envoyé. Réessayez dans quelques minutes ; si cela persiste, contactez Frisk.";
  }
  return "L'inscription n'a pas pu aboutir. Vérifiez l'adresse e-mail et réessayez.";
}
