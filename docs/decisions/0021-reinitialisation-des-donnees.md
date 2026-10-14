# ADR 0021 — Réinitialisation des données depuis l'interface

- **Date** : 08/10/2026
- **Statut** : accepté
- **Contexte** : l'utilisateur demande « un bouton sur le serveur pour réinitialiser mes data ». Le cahier v1.5 n'en dit rien : il prévoit la sauvegarde ZIP (F-LIB-09) et, en V2, la restauration (F-LIB-09b). Sur l'instance en ligne (ADR 0018), repartir de zéro demandait jusqu'ici une connexion SSH et `receive-data.sh`. Conformément au `CLAUDE.md`, l'ajout passe par le cahier (v1.6, F-LIB-09c). Le cahier étant muet sur les détails, cet ADR retient l'option la plus simple qui ne perde rien sans copie.

## Décision

### Ce qui est effacé, ce qui est gardé

Le bouton remet `data/` dans l'état de `npm run data:init` : identité vide, bibliothèque vide (les quatre catégories par défaut), un seul preset, `preset-defaut`, vide.

| Effacé (modèle de données, §9.1)                                        | Gardé                                                                                              |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `profile.json` (identité, coordonnées), `assets/` (photo)               | `ids.json` : un identifiant n'est **jamais réutilisé** (F-LIB-02), même après une réinitialisation |
| `library/` (toutes les collections)                                     | `.git/` (dépôt privé de `data/` conseillé au §8.4) et tout fichier hors du modèle de données       |
| `presets/`                                                              | `import/` (CV, export LinkedIn, offres), `out/` (exports des presets, copies de sécurité)          |
| `applications/` (offres, analyses, lettres, y compris finales, exports) | `auth/` : clés de connexion de l'instance en ligne                                                 |
| `proposals/` (toutes les propositions, en attente ou non)               |                                                                                                    |

Garder `ids.json` évite qu'une proposition périmée (une conversation Claude d'avant la réinitialisation) vise un nouvel élément qui aurait repris l'identifiant d'un ancien. Contrepartie : un élément ressaisi à l'identique reçoit un suffixe (`exp-acme-2`). Les identifiants par défaut (catégories, `preset-defaut`) sont ajoutés au registre s'il les a perdus.

### Copie de sécurité avant d'effacer

`resetDataDir` (`packages/store/src/reset.ts`), sous le verrou unique de `data/` (§8.4) :

1. écrit une copie ZIP de `data/` (la même que « Sauvegarde ZIP », `zipDataDir`) dans `<out>/backups/cv-data-AAAAMMJJ-HHmmss.zip`, par création exclusive : une copie n'en remplace jamais une autre (suffixe `-2`, `-3`… dans la même seconde) ;
2. supprime les entrées du modèle de données, avec réessais (`EBUSY`, `EPERM` sous Windows) ;
3. recrée les fichiers vides par `initDataDir`, comme `npm run data:init`.

Si la copie échoue, rien n'est effacé. Sans dossier `out/` (`CV_OUT_DIR`), la réinitialisation est refusée (`NOT_AVAILABLE`). En ligne, la copie est dans `<base>/out/backups/`, accessible par SSH ; en local, dans `out/backups/`.

### API et interface

- `POST /api/reset` avec `{ "confirm": true }` : protégée comme toute route `/api` (NF-01 : jeton, origine, JSON ; connexion par clé en ligne). Réponse : `{ backup: "out/backups/cv-data-….zip", writes }`.
- Bouton rouge **« Réinitialiser… »** en haut à droite, à côté de « Sauvegarde ZIP ». Il ouvre une boîte de dialogue qui dit ce qui est effacé et ce qui est gardé, propose de **télécharger d'abord une sauvegarde ZIP** (coché par défaut ; un échec du téléchargement annule la réinitialisation) et demande de taper **RÉINITIALISER** (accents et casse ignorés).
- Une fois la réinitialisation faite, la boîte affiche le chemin de la copie, puis la page se recharge : l'état de l'interface (preset en cours d'édition, candidature ouverte) appartenait aux données effacées.

### Jamais par le MCP

Aucun outil MCP ne réinitialise ni ne supprime (`CLAUDE.md`, §7.5 : « aucune action destructrice possible »). Seule l'interface le fait, à la demande de l'utilisateur.

## Tests

`apps/server/test/reset.test.ts`, sur une copie de la fixture fictive `courte` avec une proposition et une candidature : refus sans confirmation, sans jeton, depuis une origine étrangère ou sans `out/`, sans rien effacer ; contenu de la copie ZIP ; dossier vide et valide après la réinitialisation ; registre des identifiants, `.git/` et fichier hors modèle gardés ; deux copies dans la même seconde ; registre complété des identifiants par défaut.

## Conséquences

- **Cahier v1.6** : F-LIB-09c (§6.1), §14 (risque « réinitialisation par erreur »).
- **Fichiers** : `packages/store/src/reset.ts`, `apps/server/src/app.ts` (route), `apps/web/src/components/ResetDialog.tsx`, `apps/web/src/App.tsx`, `apps/web/src/api.ts`.
- **Restauration** : toujours en V2 (F-LIB-09b). Pour revenir en arrière, on remet le contenu du ZIP dans `data/` (en ligne : `receive-data.sh`, lancé par l'utilisateur).
- **Mise en ligne** : l'instance en ligne n'a le bouton qu'après `npm run deploy` (ADR 0018).
