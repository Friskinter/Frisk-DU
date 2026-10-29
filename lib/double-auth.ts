"use client";

// Double authentification par application (TOTP : Google Authenticator, Microsoft Authenticator,
// 1Password…), gérée par Supabase Auth. Dès qu'un facteur est activé, la base n'ouvre les données
// qu'aux sessions validées par un code (migration 010).

import { supabaseNavigateur } from "./supabase/client";

// La session doit-elle encore être validée par un code ?
export async function codeRequis() {
  const { data } = await supabaseNavigateur().auth.mfa.getAuthenticatorAssuranceLevel();
  return !!data && data.nextLevel === "aal2" && data.currentLevel !== "aal2";
}

export async function facteurActif() {
  const { data } = await supabaseNavigateur().auth.mfa.listFactors();
  return data?.totp[0] ?? null;
}

export async function validerCode(code: string): Promise<string | null> {
  const facteur = await facteurActif();
  if (!facteur) return "Aucune double authentification n'est activée sur ce compte.";
  const { error } = await supabaseNavigateur().auth.mfa.challengeAndVerify({ factorId: facteur.id, code: code.replace(/\s/g, "") });
  return error ? "Code incorrect ou expiré. Saisissez le code affiché actuellement dans votre application." : null;
}

// Première étape de l'activation : QR code à scanner et clé à saisir à la main si besoin.
export async function commencerActivation() {
  const supabase = supabaseNavigateur();
  // Une activation commencée puis abandonnée laisse un facteur non vérifié : on le retire.
  const { data: facteurs } = await supabase.auth.mfa.listFactors();
  for (const f of facteurs?.all ?? []) {
    if (f.factor_type === "totp" && f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Frisk Plateforme ${new Date().toISOString().slice(0, 10)}` });
  if (error || !data) return null;
  return { factorId: data.id, qrCode: data.totp.qr_code, cle: data.totp.secret };
}

export async function confirmerActivation(factorId: string, code: string): Promise<string | null> {
  const { error } = await supabaseNavigateur().auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, "") });
  return error ? "Code incorrect. Vérifiez que l'heure de votre téléphone est juste et saisissez le code affiché actuellement." : null;
}

export async function desactiver(factorId: string): Promise<boolean> {
  const { error } = await supabaseNavigateur().auth.mfa.unenroll({ factorId });
  return !error;
}
