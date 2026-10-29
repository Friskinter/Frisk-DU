import { describe, expect, it } from "vitest";
import { messageInscription } from "@/lib/messages-inscription";

describe("message d'erreur à l'inscription", () => {
  it("explique clairement chaque refus de Supabase", () => {
    expect(messageInscription({ code: "signup_disabled", status: 422 })).toMatch(/inscriptions sont fermées/);
    expect(messageInscription({ code: "captcha_failed", status: 400 })).toMatch(/anti-robot/);
    expect(messageInscription({ code: "weak_password", status: 422 })).toMatch(/trop simple/);
    expect(messageInscription({ code: "email_address_invalid", status: 400 })).toMatch(/n'est pas acceptée/);
    expect(messageInscription({ code: "email_address_not_authorized", status: 400 })).toMatch(/ne peut pas être envoyé/);
    expect(messageInscription({ code: "over_email_send_rate_limit", status: 429 })).toMatch(/Trop d'inscriptions/);
    expect(messageInscription({ status: 429 })).toMatch(/Trop d'inscriptions/);
    expect(messageInscription({ code: "unexpected_failure", status: 500 })).toMatch(/e-mail de confirmation n'a pas pu être envoyé/);
    expect(messageInscription({ code: "autre", status: 400 })).toMatch(/n'a pas pu aboutir/);
  });
});
