import { supabase } from "@/integrations/supabase/client";

// "Rester connecté" unchecked: the session ends when the browser tab is closed.
const EPHEMERAL_KEY = "ft-ephemeral-session";
const TAB_KEY = "ft-session-alive";

export function markSessionPersistence(remember: boolean) {
  if (typeof window === "undefined") return;
  if (remember) window.localStorage.removeItem(EPHEMERAL_KEY);
  else window.localStorage.setItem(EPHEMERAL_KEY, "1");
  window.sessionStorage.setItem(TAB_KEY, "1");
}

export async function enforceSessionPersistence() {
  if (typeof window === "undefined") return;
  const ephemeral = window.localStorage.getItem(EPHEMERAL_KEY);
  const alive = window.sessionStorage.getItem(TAB_KEY);
  if (ephemeral && !alive) {
    window.localStorage.removeItem(EPHEMERAL_KEY);
    await supabase.auth.signOut();
  }
}

/** Only allow same-origin relative paths as post-login destinations. */
export function safeRedirect(target: string | undefined | null, fallback = "/dashboard"): string {
  if (!target) return fallback;
  try {
    const url = new URL(target, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    const path = url.pathname + url.search + url.hash;
    if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/auth")) return fallback;
    return path;
  } catch {
    return fallback;
  }
}

export function translateAuthError(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou mot de passe incorrect.";
  if (m.includes("email not confirmed"))
    return "Confirme ton adresse e-mail avant de te connecter (vérifie tes spams).";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Un compte existe déjà avec cette adresse e-mail.";
  if (m.includes("password should be at least") || m.includes("weak"))
    return "Mot de passe trop faible : 8 caractères minimum, avec lettres et chiffres.";
  if (m.includes("pwned") || m.includes("leaked"))
    return "Ce mot de passe figure dans une fuite de données connue. Choisis-en un autre.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Trop de tentatives. Patiente quelques minutes avant de réessayer.";
  if (m.includes("current password")) return "Mot de passe actuel incorrect ou manquant.";
  if (m.includes("same password")) return "Le nouveau mot de passe doit être différent de l'actuel.";
  if (m.includes("invalid email") || m.includes("unable to validate email"))
    return "Adresse e-mail invalide.";
  if (m.includes("network") || m.includes("fetch"))
    return "Connexion impossible. Vérifie ta connexion internet.";
  return message || "Une erreur est survenue. Réessaie.";
}
