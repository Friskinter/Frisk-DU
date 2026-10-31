import { formaterDate } from "./calculs";
import type { Alerte } from "./alertes";
import { libellesTypesEcheance, type Echeance } from "./echeances";
import type { Role } from "./operations";
import type { Recapitulatif } from "./recapitulatif";
import type { Action } from "./types";

const couleurs: Record<Alerte["gravite"], string> = { critique: "#d03b3b", importante: "#ec835a", info: "#b08d57" };
const libelles: Record<Alerte["gravite"], string> = { critique: "Urgent", importante: "À traiter", info: "À surveiller" };

const echapper = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Le contenu des e-mails dépend du rôle de la personne : le responsable reçoit tout le détail, le
// contributeur le détail de ce qu'il peut traiter (les EPI), le lecteur seulement les titres. Les
// titres ne donnent que des nombres ; le détail peut citer des salariés, des produits ou des dates.
export function alerteTraitable(a: Alerte, role: Role) {
  if (role === "admin" || role === "responsable") return true;
  return role === "contributeur" && a.categorie === "EPI";
}

const detailVisible = (a: Alerte, role: Role) => alerteTraitable(a, role) && a.detail;

// Mention ajoutée en bas de l'e-mail quand une partie du détail a été retirée.
function mentionResume(alertes: Alerte[], role: Role, autreDetailRetire = false) {
  if (!autreDetailRetire && alertes.every((a) => alerteTraitable(a, role))) return "";
  return role === "contributeur"
    ? "Le détail n'est donné que pour les EPI, que vous gérez. Le reste est suivi par les responsables de votre entreprise."
    : "Version résumée : le détail est réservé aux responsables de votre entreprise.";
}

// Contenu du récapitulatif du lundi (lib/recapitulatif.ts) : urgences, échéances de la semaine,
// autres points à traiter, puis prochaine étape du parcours. Les échéances citent des salariés, des
// équipements ou des entreprises : seuls les responsables en reçoivent le détail, les autres un
// décompte par type. La prochaine étape du parcours ne s'adresse qu'aux responsables. En tête, les
// actions confiées à la personne (lib/mes-actions.ts : en retard ou à échéance dans la semaine).
export function emailRecapitulatif(
  entreprise: string,
  recap: Recapitulatif,
  aujourdhui: string,
  urlApplication: string,
  role: Role = "responsable",
  actionsConfiees: Action[] = [],
) {
  const { urgences, echeances, autres } = recap;
  const responsable = role === "admin" || role === "responsable";
  const prochaine = responsable ? recap.prochaine : undefined;
  const alertes = [...urgences, ...autres];
  const mention = mentionResume(alertes, role, echeances.length > 0 && !responsable);

  const nombre = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
  const resume = [
    actionsConfiees.length ? nombre(actionsConfiees.length, "action vous est confiée", "actions vous sont confiées") : "",
    urgences.length ? nombre(urgences.length, "urgence", "urgences") : "",
    autres.length ? nombre(autres.length, "point à traiter", "points à traiter") : "",
    echeances.length ? `${nombre(echeances.length, "échéance", "échéances")} cette semaine` : "",
  ].filter(Boolean);
  const sujet = `Frisk Plateforme · ${entreprise} : ${resume.join(", ") || "votre semaine"}`;

  const ligneAlerte = (a: Alerte) => `
      <tr><td style="padding:12px 0;border-bottom:1px solid #ece6dc">
        <span style="display:inline-block;padding:2px 8px;border-radius:10px;background:${couleurs[a.gravite]};color:#fff;font-size:12px">${libelles[a.gravite]}</span>
        <span style="color:#6b645b;font-size:12px">&nbsp;${echapper(a.categorie)}</span>
        <div style="margin-top:6px;font-weight:bold">${echapper(a.titre)}</div>
        ${detailVisible(a, role) ? `<div style="color:#3a3530">${echapper(a.detail)}</div>` : ""}
        <a href="${urlApplication}${a.lien}" style="color:#7f6235;font-size:13px">Ouvrir dans Frisk Plateforme →</a>
      </td></tr>`;
  const ligneEcheance = (e: Echeance) => `
      <tr><td style="padding:10px 0;border-bottom:1px solid #ece6dc">
        <span style="color:#6b645b;font-size:12px">${formaterDate(e.date)} · ${echapper(libellesTypesEcheance[e.type])}</span>
        <div style="margin-top:4px;font-weight:bold">${echapper(e.titre)}</div>
        ${[e.detail, e.responsable && `Responsable : ${e.responsable}`].filter(Boolean).map((t) => `<div style="color:#3a3530">${echapper(t)}</div>`).join("")}
        <a href="${urlApplication}${e.lien}" style="color:#7f6235;font-size:13px">Ouvrir →</a>
      </td></tr>`;
  const parType = Object.entries(
    echeances.reduce<Record<string, number>>((t, e) => ({ ...t, [libellesTypesEcheance[e.type]]: (t[libellesTypesEcheance[e.type]] ?? 0) + 1 }), {}),
  ).map(([type, n]) => `${type} : ${n}`);
  const titreSection = (t: string) => `<h2 style="margin:24px 0 4px;font-size:15px;color:#0c0b0a">${t}</h2>`;

  const ligneAction = (a: Action) => {
    const retard = a.echeance < aujourdhui;
    return `
      <tr><td style="padding:10px 0;border-bottom:1px solid #ece6dc">
        <span style="color:${retard ? "#b42318" : "#6b645b"};font-size:12px">${retard ? "En retard depuis le" : "Échéance le"} ${formaterDate(a.echeance)}</span>
        <div style="margin-top:4px;font-weight:bold">${echapper(a.intitule || "Action sans intitulé")}</div>
        <a href="${urlApplication}/actions?action=${a.id}" style="color:#7f6235;font-size:13px">Ouvrir →</a>
      </td></tr>`;
  };
  const sections = [
    actionsConfiees.length
      ? titreSection("Vos actions") + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${actionsConfiees.map(ligneAction).join("")}</table>`
      : "",
    urgences.length ? titreSection("Urgent") + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${urgences.map(ligneAlerte).join("")}</table>` : "",
    echeances.length
      ? titreSection("Échéances de la semaine") +
        (responsable
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${echeances.map(ligneEcheance).join("")}</table>`
          : `<ul style="margin:8px 0;padding-left:20px;color:#3a3530">${parType.map((t) => `<li>${echapper(t)}</li>`).join("")}</ul>`)
      : "",
    autres.length ? titreSection("À traiter et à surveiller") + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${autres.map(ligneAlerte).join("")}</table>` : "",
    prochaine
      ? titreSection("Prochaine étape de votre parcours") +
        `<div style="padding:12px;background:#f7f4ef;border-left:3px solid #b08d57">
          <div style="font-weight:bold">${echapper(prochaine.titre)}</div>
          <div style="margin-top:4px;color:#3a3530">${echapper(prochaine.aide)}</div>
          <a href="${urlApplication}${prochaine.lien}" style="color:#7f6235;font-size:13px">${echapper(prochaine.bouton)} →</a>
        </div>`
      : "",
  ].join("");

  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f7f4ef;font-family:Arial,sans-serif;color:#0c0b0a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
      <tr><td style="background:#0c0b0a;padding:24px;color:#ece6dc">
        <div style="letter-spacing:4px;font-size:18px">FRISK <span style="color:#c9a978">PLATEFORME</span></div>
        <div style="margin-top:8px;font-size:14px;color:#d9cfc1">Récapitulatif du ${formaterDate(aujourdhui)} · ${echapper(entreprise)}</div>
      </td></tr>
      <tr><td style="padding:8px 24px 24px">
        ${sections}
        ${mention ? `<p style="margin-top:16px;font-size:13px;color:#3a3530">${echapper(mention)}</p>` : ""}
        <p style="margin-top:24px;font-size:12px;color:#6b645b">
          Vous recevez cet e-mail chaque lundi en tant qu'utilisateur de Frisk Plateforme. Pour ne plus le recevoir,
          décochez « Récapitulatif du lundi » dans « Mon compte ».
        </p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  const texteAlerte = (a: Alerte) => `- [${libelles[a.gravite]}] ${a.titre}${detailVisible(a, role) ? ` : ${a.detail}` : ""}`;
  const texte = [
    `Frisk Plateforme · ${entreprise} · récapitulatif du ${formaterDate(aujourdhui)}`,
    ...(actionsConfiees.length
      ? ["", "VOS ACTIONS", ...actionsConfiees.map((a) => `- ${a.echeance < aujourdhui ? "en retard depuis le" : "échéance le"} ${formaterDate(a.echeance)} · ${a.intitule || "Action sans intitulé"}`)]
      : []),
    ...(urgences.length ? ["", "URGENT", ...urgences.map(texteAlerte)] : []),
    ...(echeances.length
      ? [
          "",
          "ÉCHÉANCES DE LA SEMAINE",
          ...(responsable
            ? echeances.map((e) => `- ${formaterDate(e.date)} · ${e.titre}${e.detail ? ` (${e.detail})` : ""}${e.responsable ? ` · responsable : ${e.responsable}` : ""}`)
            : parType.map((t) => `- ${t}`)),
        ]
      : []),
    ...(autres.length ? ["", "À TRAITER ET À SURVEILLER", ...autres.map(texteAlerte)] : []),
    ...(prochaine ? ["", "PROCHAINE ÉTAPE DE VOTRE PARCOURS", `${prochaine.titre} : ${prochaine.aide}`, `${urlApplication}${prochaine.lien}`] : []),
    ...(mention ? ["", mention] : []),
    "",
    `Ouvrir Frisk Plateforme : ${urlApplication}`,
  ].join("\n");

  return { sujet, html, texte };
}

// E-mail du matin : les urgences apparues depuis la veille (lib/urgences.ts).
export function emailUrgences(entreprise: string, alertes: Alerte[], aujourdhui: string, urlApplication: string, role: Role = "responsable") {
  const mention = mentionResume(alertes, role);
  const n = alertes.length;
  const sujet = `Frisk Plateforme · ${entreprise} : ${n > 1 ? `${n} nouvelles urgences` : "nouvelle urgence"}`;
  const lignes = alertes
    .map(
      (a) => `
      <tr><td style="padding:12px 0;border-bottom:1px solid #ece6dc">
        <span style="color:#6b645b;font-size:12px">${echapper(a.categorie)}</span>
        <div style="margin-top:4px;font-weight:bold">${echapper(a.titre)}</div>
        ${detailVisible(a, role) ? `<div style="color:#3a3530">${echapper(a.detail)}</div>` : ""}
        <a href="${urlApplication}${a.lien}" style="color:#7f6235;font-size:13px">Ouvrir dans Frisk Plateforme →</a>
      </td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f7f4ef;font-family:Arial,sans-serif;color:#0c0b0a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
      <tr><td style="background:#d03b3b;padding:20px 24px;color:#ffffff">
        <div style="letter-spacing:4px;font-size:16px">FRISK PLATEFORME</div>
        <div style="margin-top:6px;font-size:15px;font-weight:bold">${n > 1 ? `${n} nouvelles urgences` : "Nouvelle urgence"} · ${echapper(entreprise)}</div>
        <div style="margin-top:2px;font-size:13px">Apparue${n > 1 ? "s" : ""} depuis le dernier e-mail · ${formaterDate(aujourdhui)}</div>
      </td></tr>
      <tr><td style="padding:8px 24px 24px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lignes}</table>
        ${mention ? `<p style="margin-top:16px;font-size:13px;color:#3a3530">${echapper(mention)}</p>` : ""}
        <p style="margin-top:24px;font-size:12px;color:#6b645b">
          Vous recevez cet e-mail quand une urgence apparaît, au plus une fois par jour. Pour ne plus le recevoir,
          décochez « E-mails immédiats » dans « Mon compte ».
        </p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
  const texte = [
    `Frisk Plateforme · ${entreprise} · ${n > 1 ? `${n} nouvelles urgences` : "nouvelle urgence"} (${formaterDate(aujourdhui)})`,
    "",
    ...alertes.map((a) => `- ${a.titre}${detailVisible(a, role) ? ` : ${a.detail}` : ""}\n  ${urlApplication}${a.lien}`),
    ...(mention ? ["", mention] : []),
    "",
    "Pour ne plus recevoir ces e-mails : « Mon compte » dans Frisk Plateforme.",
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
