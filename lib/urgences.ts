// E-mails immédiats : une fois par jour, les urgences apparues depuis le dernier envoi, en un seul
// e-mail par entreprise. Chaque urgence est repérée par l'alerte et les éléments concernés
// (« accidents-a-declarer:<id> ») ; les clés déjà signalées sont retenues (table alertes_envoyees,
// migration 020). Une urgence réglée puis revenue est signalée de nouveau.

import type { Alerte } from "./alertes";

export function clesUrgence(a: Alerte): string[] {
  const elements = a.elements?.length ? a.elements : [""];
  return elements.map((e) => `${a.id}:${e}`);
}

// Urgences à signaler (au moins un élément jamais signalé) et clés à retenir après l'envoi.
export function nouvellesUrgences(alertes: Alerte[], dejaSignalees: Set<string>) {
  const urgences = alertes.filter((a) => a.gravite === "critique");
  const aSignaler = urgences.filter((a) => clesUrgence(a).some((c) => !dejaSignalees.has(c)));
  const actuelles = new Set(urgences.flatMap(clesUrgence));
  const nouvelles = [...actuelles].filter((c) => !dejaSignalees.has(c));
  // Les urgences réglées sont oubliées : si elles reviennent, elles seront signalées de nouveau.
  const reglees = [...dejaSignalees].filter((c) => !actuelles.has(c));
  return { aSignaler, nouvelles, reglees };
}
