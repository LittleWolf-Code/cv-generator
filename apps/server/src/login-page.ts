// Sign-in page of the online instance (ADR 0018): self-contained (no external resource, NF-01), its
// script and style allowed by hash in a strict Content-Security-Policy. Sign-in with a registered
// security key, or registration of a key with the one-time code generated on the server.
import { createHash } from 'node:crypto';

const STYLE = String.raw`
:root { color-scheme: light; font-family: system-ui, sans-serif; color: #1f2937; background: #f3f4f6; }
main { max-width: 28rem; margin: 10vh auto; padding: 2rem; background: #fff; border-radius: 0.75rem; box-shadow: 0 1px 4px rgb(0 0 0 / 0.12); }
h1 { font-size: 1.4rem; margin: 0 0 0.5rem; }
p { line-height: 1.5; }
button { font: inherit; padding: 0.6rem 1rem; border: 0; border-radius: 0.5rem; background: #1d4ed8; color: #fff; cursor: pointer; width: 100%; }
button:disabled { background: #9ca3af; cursor: not-allowed; }
button:focus-visible, input:focus-visible, summary:focus-visible { outline: 3px solid #f59e0b; outline-offset: 2px; }
details { margin-top: 1.5rem; border-top: 1px solid #e5e7eb; padding-top: 1rem; }
summary { cursor: pointer; font-weight: 600; }
label { display: block; margin: 0.75rem 0 0.25rem; font-size: 0.9rem; }
input { font: inherit; width: 100%; box-sizing: border-box; padding: 0.5rem; border: 1px solid #9ca3af; border-radius: 0.4rem; }
form button { margin-top: 1rem; }
code { background: #f3f4f6; padding: 0 0.25rem; border-radius: 0.25rem; }
#status { min-height: 1.5em; margin-top: 1rem; }
#status.err { color: #b91c1c; }
`;

const SCRIPT = String.raw`
'use strict';
const byId = (id) => document.getElementById(id);
const statusLine = byId('status');
function say(text, error) {
  statusLine.textContent = text;
  statusLine.className = error ? 'err' : '';
}
function fromB64u(s) {
  const b = atob(s.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out.buffer;
}
function toB64u(buffer) {
  let s = '';
  for (const x of new Uint8Array(buffer)) s += String.fromCharCode(x);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
function nextPage() {
  const s = new URLSearchParams(location.search).get('suite') || '/';
  const backslash = String.fromCharCode(92);
  return s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/' + backslash) ? s : '/';
}
async function post(path, data) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'same-origin',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || 'erreur ' + res.status);
  return body;
}
function explain(err) {
  if (err && err.name === 'NotAllowedError') return 'Opération annulée ou délai dépassé : recommencez et touchez la clé quand elle clignote.';
  if (err && err.name === 'InvalidStateError') return 'Cette clé est déjà enregistrée.';
  if (err && err.name === 'SecurityError') return "Le navigateur refuse la clé pour cette adresse : ouvrez l'instance par son adresse https.";
  return (err && err.message) || String(err);
}
function credentialJSON(cred, response) {
  return {
    id: cred.id,
    rawId: toB64u(cred.rawId),
    type: cred.type,
    clientExtensionResults: cred.getClientExtensionResults(),
    authenticatorAttachment: cred.authenticatorAttachment || undefined,
    response,
  };
}
async function signIn() {
  say('Touchez votre clé de sécurité…');
  try {
    const { challengeId, options } = await post('/auth/login/options', {});
    const publicKey = {
      ...options,
      challenge: fromB64u(options.challenge),
      allowCredentials: (options.allowCredentials || []).map((c) => ({ ...c, id: fromB64u(c.id) })),
    };
    const cred = await navigator.credentials.get({ publicKey });
    const r = cred.response;
    await post('/auth/login/verify', {
      challengeId,
      response: credentialJSON(cred, {
        clientDataJSON: toB64u(r.clientDataJSON),
        authenticatorData: toB64u(r.authenticatorData),
        signature: toB64u(r.signature),
        userHandle: r.userHandle ? toB64u(r.userHandle) : undefined,
      }),
    });
    say('Connecté.');
    location.assign(nextPage());
  } catch (err) {
    say(explain(err), true);
  }
}
async function enrol(event) {
  event.preventDefault();
  say('Touchez la clé à enregistrer…');
  try {
    const { challengeId, options } = await post('/auth/register/options', {
      code: byId('code').value,
      label: byId('label').value,
    });
    const publicKey = {
      ...options,
      challenge: fromB64u(options.challenge),
      user: { ...options.user, id: fromB64u(options.user.id) },
      excludeCredentials: (options.excludeCredentials || []).map((c) => ({ ...c, id: fromB64u(c.id) })),
    };
    const cred = await navigator.credentials.create({ publicKey });
    const r = cred.response;
    await post('/auth/register/verify', {
      challengeId,
      response: credentialJSON(cred, {
        clientDataJSON: toB64u(r.clientDataJSON),
        attestationObject: toB64u(r.attestationObject),
        transports: r.getTransports ? r.getTransports() : undefined,
      }),
    });
    say('Clé enregistrée : vous êtes connecté.');
    location.assign(nextPage());
  } catch (err) {
    say(explain(err), true);
  }
}
byId('login').addEventListener('click', signIn);
byId('enrol').addEventListener('submit', enrol);
if (!window.PublicKeyCredential) {
  say('Ce navigateur ne gère pas les clés de sécurité (WebAuthn).', true);
} else {
  fetch('/auth/status', { credentials: 'same-origin' })
    .then((r) => r.json())
    .then((s) => {
      if (!s.enrolled) {
        byId('enrol-box').open = true;
        byId('login').disabled = true;
        say("Aucune clé n'est encore enregistrée : enregistrez-en une ci-dessous.");
      }
    })
    .catch(() => {});
}
`;

const hash = (text: string) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;

/** The page and its Content-Security-Policy (inline script and style allowed by their hash only). */
export function loginPage(): { html: string; csp: string } {
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Connexion – Générateur de CV</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<h1>Générateur de CV</h1>
<p>Instance en ligne protégée : connectez-vous avec votre clé de sécurité.</p>
<button id="login" type="button">Se connecter avec ma clé de sécurité</button>
<p id="status" role="status" aria-live="polite"></p>
<details id="enrol-box">
<summary>Enregistrer une clé de sécurité</summary>
<p>Sur le serveur, générez un code à usage unique (valable 15 minutes) avec <code>npm run auth:code</code>, puis saisissez-le ici. Enregistrez de préférence une seconde clé, de secours.</p>
<form id="enrol">
<label for="code">Code d'enregistrement</label>
<input id="code" name="code" autocomplete="off" spellcheck="false" required />
<label for="label">Nom de la clé</label>
<input id="label" name="label" maxlength="80" placeholder="YubiKey principale" />
<button type="submit">Enregistrer la clé</button>
</form>
</details>
</main>
<script>${SCRIPT}</script>
</body>
</html>
`;
  const csp = [
    "default-src 'none'",
    `script-src ${hash(SCRIPT)}`,
    `style-src ${hash(STYLE)}`,
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
  return { html, csp };
}
