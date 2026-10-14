# ADR 0006 — API locale, jeton et lancement unique

- **Date** : 05/10/2026
- **Statut** : accepté
- **Contexte** : NF-01, NF-05, §8.3, §12.4.

## Décision

- **Ports** : interface sur `CV_PORT` (défaut **4310**), API sur `CV_PORT + 1` (4311). Les deux n'écoutent que sur `127.0.0.1`.
- **Lancement unique** : `npm run dev` exécute `scripts/dev.ts`, qui démarre l'API (Hono) **et** Vite dans le même processus. Le jeton aléatoire (32 octets) est généré à chaque démarrage et **injecté dans la page** par un plugin Vite (`<meta name="cv-token">`). Vite fait proxy sur `/api` (`changeOrigin: true`) : une seule origine pour le navigateur.
- **Contrôles** :
  - `Host` ≠ `127.0.0.1:<port API>` ou `localhost:<port API>` : 403, sur toutes les routes ;
  - `X-CV-Token` exigé sur **toutes** les routes `/api/*` sauf `/api/health`, y compris les lectures et le flux SSE. C'est plus strict que le cahier, qui ne l'exige que pour les écritures et le SSE ; aucune page tierce ne peut lire la bibliothèque, même en cas de faille CORS ;
  - écritures (POST, PUT, PATCH, DELETE) : `Origin` égal à celui de l'interface (sinon 403), `Content-Type: application/json` (sinon **415**, code non précisé par le cahier) ;
  - corps limité à 1 Mo ; en-têtes `nosniff`, `no-store`, `X-Frame-Options: DENY`, `no-referrer`.
- **Démonstration** : `npm run dev:demo` (= `npm run dev -- --fixture courte`) travaille sur une copie temporaire de la fixture ; sans argument, `npm run dev` lit `data/` (ou `CV_DATA_DIR`) et refuse de démarrer s'il est absent, avec l'indication `npm run data:init`.
- **SSE** : `/api/events` n'envoie au lot 0 qu'un événement `ready` et un battement ; la surveillance des fichiers arrive au lot 1. Côté navigateur, `EventSource` ne permet pas d'en-tête : le lot 1 lira le flux avec `fetch` pour envoyer `X-CV-Token`.
- **Interface** (lot 0) : arbre de la bibliothèque en lecture seule (cases natives désactivées, état « mixte » d'un parent partiellement coché), aperçu du tampon PDF par pdfjs-dist, feux ATS et onglet « Vue ATS » (texte brut pdf.js, bouton « copier »).

## Conséquence

Le mode production (API servant l'interface compilée) n'existe pas encore ; il n'est pas requis au lot 0.
