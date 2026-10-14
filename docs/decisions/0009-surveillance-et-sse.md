# ADR 0009 — Surveillance de `data/` et flux SSE

- **Date** : 05/10/2026
- **Statut** : accepté
- **Contexte** : §8.4 (surveillance, événement avec la révision, l'interface ignore ses propres écritures), F-PRO-05 (mise à jour en direct), NF-01 (jeton sur le flux SSE), ADR 0006.

## Décision

- **chokidar 5.0.0** (version de l'annexe E, figée exactement ; `engines` : Node ≥ 20.19, satisfait), dans `packages/store` (`watchDataDir`). Le serveur de l'interface le démarre ; les processus MCP n'en ont pas besoin.
- **Ignorés** : le verrou `.lock` (un dossier créé par `proper-lockfile`), tout chemin qui contient un segment `*.lock`, les fichiers temporaires des écritures atomiques (`*.tmp`) et `.git/`.
- **Anti-rebond de 100 ms par fichier.** À l'échéance, l'événement porte `{ file, revision, deleted }` : `file` est relatif à `data/` avec des `/`, `revision` est relue dans le JSON (`null` si le fichier est illisible, par exemple pendant une copie manuelle : la modification suivante produira un nouvel événement).
- **SSE** `GET /api/events` : `ready` à la connexion, `change` pour chaque événement, `ping` toutes les 25 s. Le jeton est exigé, comme sur toute route `/api`.
- **Côté navigateur**, le flux est lu par `fetch` (`X-CV-Token`, `TextDecoderStream`), car `EventSource` ne permet pas d'en-tête. Reconnexion après 2 s en cas de coupure. Sur un **403**, le serveur a redémarré avec un nouveau jeton : l'interface affiche « rechargez la page » au lieu de réessayer en boucle.
- **Propres écritures** : chaque réponse d'écriture de l'API contient `writes: [{ file, revision }]`. L'interface les mémorise et ignore l'événement correspondant ; elle a déjà rechargé ses données après sa propre écriture.
- **Rechargement** : tout autre événement sur `profile.json`, `library/`, `presets/`, `proposals/` ou la sélection d'une candidature recharge la bibliothèque et la file (anti-rebond de 150 ms). La file est rechargée même pour un changement de la bibliothèque, car l'état `stale` d'une proposition en dépend (ADR 0010).

## Constat

Sous Windows, arrêter `npm run dev` en tuant le processus ne déclenche pas les gestionnaires `SIGINT`/`SIGTERM` : la copie temporaire de `npm run dev:demo` reste alors dans le dossier temporaire du système. C'est sans risque (fixture fictive), et c'est le comportement du lot 0.
