import { formaterDate } from "./calculs";
import type { Alerte } from "./alertes";

const couleurs: Record<Alerte["gravite"], string> = { critique: "#d03b3b", importante: "#ec835a", info: "#b08d57" };
const libelles: Record<Alerte["gravite"], string> = { critique: "Urgent", importante: "À traiter", info: "À surveiller" };

const echapper = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Contenu de l'e-mail de récapitulatif hebdomadaire.
export function emailAlertes(entreprise: string, alertes: Alerte[], aujourdhui: string, urlApplication: string) {
  const sujet = `Frisk Plateforme · ${entreprise} : ${alertes.length} point${alertes.length > 1 ? "s" : ""} à traiter`;
  const lignes = alertes
    .map(
      (a) => `
      <tr><td style="padding:12px 0;border-bottom:1px solid #ece6dc">
        <span style="display:inline-block;padding:2px 8px;border-radius:10px;background:${couleurs[a.gravite]};color:#fff;font-size:12px">${libelles[a.gravite]}</span>
        <span style="color:#6b645b;font-size:12px">&nbsp;${echapper(a.categorie)}</span>
        <div style="margin-top:6px;font-weight:bold">${echapper(a.titre)}</div>
        <div style="color:#3a3530">${echapper(a.detail)}</div>
        <a href="${urlApplication}${a.lien}" style="color:#7f6235;font-size:13px">Ouvrir dans Frisk Plateforme →</a>
      </td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f7f4ef;font-family:Arial,sans-serif;color:#0c0b0a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
      <tr><td style="background:#0c0b0a;padding:24px;color:#ece6dc">
        <div style="letter-spacing:4px;font-size:18px">FRISK <span style="color:#c9a978">PLATEFORME</span></div>
        <div style="margin-top:8px;font-size:14px;color:#d9cfc1">Récapitulatif du ${formaterDate(aujourdhui)} · ${echapper(entreprise)}</div>
      </td></tr>
      <tr><td style="padding:8px 24px 24px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lignes}</table>
        <p style="margin-top:24px;font-size:12px;color:#6b645b">
          Vous recevez cet e-mail chaque lundi en tant qu'utilisateur de Frisk Plateforme. Pour ne plus le recevoir,
          décochez l'option dans « Salariés &amp; réglages ».
        </p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  const texte = [
    `Frisk Plateforme · ${entreprise} · récapitulatif du ${formaterDate(aujourdhui)}`,
    "",
    ...alertes.map((a) => `- [${libelles[a.gravite]}] ${a.titre} : ${a.detail}`),
    "",
    `Ouvrir Frisk Plateforme : ${urlApplication}`,
  ].join("\n");

  return { sujet, html, texte };
}

// E-mail aux responsables quand un salarié signale un événement depuis le terrain. Il ne contient
// ni la description ni les lésions (données de santé) : seulement le type et le lien.
export function emailSignalement(entreprise: string, type: string, accident: boolean, lien: string) {
  const sujet = `Frisk Plateforme · ${entreprise} : nouveau signalement (${type.toLowerCase()})`;
  const consigne = accident
    ? "S'il y a eu un arrêt ou des soins médicaux, l'accident doit être déclaré à la CPAM dans les 48 heures."
    : "Analysez-le rapidement : un presque-accident traité, c'est un accident évité.";
  const html = `<div style="font-family:Arial,sans-serif;color:#0c0b0a;max-width:560px">
    <p style="font-size:16px"><strong>${echapper(type)}</strong> signalé depuis le terrain chez ${echapper(entreprise)}.</p>
    <p>${echapper(consigne)}</p>
    <p><a href="${echapper(lien)}" style="color:#7f6235">Ouvrir le signalement dans Frisk Plateforme →</a></p>
  </div>`;
  const texte = `${type} signalé depuis le terrain chez ${entreprise}.\n\n${consigne}\n\n${lien}`;
  return { sujet, html, texte };
}
