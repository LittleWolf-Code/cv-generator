# ADR 0022 — Création d'un preset par le MCP

- **Date** : 08/10/2026
- **Statut** : accepté
- **Contexte** : l'utilisateur demande s'il peut « créer un preset de CV avec le MCP du site ». Le cahier v1.6 ne le prévoit pas : aucun outil du §7.2 ne crée de preset (F-PRE-02 ne se fait que dans l'interface), et `propose_selection` (MCP-12) ne modifie qu'un preset existant. L'utilisateur demande l'outil `create_preset`. Conformément au `CLAUDE.md`, l'ajout passe par le cahier (v1.7, MCP-22). Le cahier étant muet sur les détails, cet ADR retient l'option la plus simple qui garde la règle « Claude propose, l'utilisateur dispose ».

## Décision

### Un ajout, pas une proposition

Le §7.1 permet au MCP deux sortes d'écritures : des propositions, et des **ajouts** (candidature, analyse, version de lettre, exports horodatés). Un nouveau preset est un ajout : un nouveau fichier `presets/<id>.json`, plus son identifiant dans `ids.json`, comme pour `create_application`. Aucun autre fichier ne change : ni la bibliothèque, ni `profile.json`, ni un autre preset.

Les propositions protègent le contenu validé. Or un nouveau preset n'apporte aucun contenu nouveau : soit il est vide (rien de coché), soit il copie un preset validé. Son contenu passe ensuite par `propose_selection`, que l'utilisateur accepte ou rejette dans l'interface. `create_application` suit la même logique : sa sélection est copiée d'un preset, puis modifiée par proposition.

### La même fonction que l'interface

`create_preset` appelle `createPreset` (`packages/store/src/presets.ts`), la fonction des boutons « Nouveau » et « Dupliquer » de l'interface :

- l'identifiant `preset-<slug>` est attribué par le serveur, inscrit dans `ids.json` et jamais réutilisé (F-LIB-02). Deux appels avec le même nom donnent deux presets (`-2`) ;
- le nom passe par `sanitize()` (schéma `text`) ; un nom vide ou un emoji est refusé (`INVALID_DATA`, champ `name`) ;
- une copie n'est jamais le preset par défaut, ni archivée. Seule exception, commune avec l'interface : si aucun preset n'est le preset par défaut, le nouveau le devient. Cela n'arrive pas en pratique, car `npm run data:init` et la réinitialisation (ADR 0021) laissent toujours `preset-defaut`, qui ne peut pas être archivé.

L'interface recharge les presets dès qu'un fichier de `presets/` change (SSE, ADR 0009). Un preset créé par Claude apparaît donc sans recharger la page.

### Entrée

| Champ      | Valeurs                   | Effet                                                                                                                                    |
| ---------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `name`     | texte                     | Nom du preset, par exemple « Ingénieur logiciel DM » ; le libellé des fichiers en est tiré (annexe B.4), comme dans l'interface          |
| `from`     | identifiant de preset     | Copie : sélection, ordre, variantes, options, modèle, thème, langue et libellé des fichiers. Absent : preset vide                        |
| `language` | `fr`, `en-GB`, `en-US`    | Langue de départ, les trois valeurs du sélecteur « Langue » de l'interface (`applyLanguage`) : passer en anglais décoche la photo (§5.4) |
| `layout`   | `ats-classique`, `visuel` | Modèle de départ (`applyLayout`) : « Normes et réglementation » passe en section dédiée dans le visuel ; la photo n'est jamais cochée    |

Langue et modèle sont acceptés parce qu'ils définissent un preset (F-PRE-01 : « Ingénieur logiciel DM », « Dev backend »…). Sans eux, Claude créerait un preset français en ATS classique, que l'utilisateur devrait corriger dans l'interface. Ils passent par les fonctions des sélecteurs de l'interface, donc par les mêmes règles.

Le thème (police, accent), la densité, les options (photo, permis, liens…), le renommage, l'archivage et le choix du preset par défaut restent dans l'interface. Ce sont des choix de présentation ou des données personnelles qui reviennent à l'utilisateur.

### Sortie

`{presetId, name, revision, lang, enVariant, layout, fileLabel, isDefault, duplicatedFrom, checked, notes}`. `revision` se repasse en `baseRevision` de `propose_selection`. `notes` reprend les messages de l'interface (photo décochée, placement des normes, preset devenu par défaut). Le résumé texte donne l'étape suivante : `get_preset` et `get_library`, puis `preview_selection` jusqu'à 1 page, puis `propose_selection`. Pas de `reviewUrl` : rien n'est à valider, le preset est visible dans la liste des presets.

Annotations : `destructiveHint: false`, `idempotentHint: false` (chaque appel crée un preset), `openWorldHint: false`.

### Ce que l'outil ne fait pas

Il ne modifie, ne renomme, n'archive ni ne supprime aucun preset, et ne change pas le preset par défaut. Il ne coche rien : un preset vide reste vide jusqu'à l'acceptation d'une proposition de sélection.

## Tests

`apps/mcp/test/presets.test.ts`, sur une copie de la fixture fictive `courte` :

- preset vide : identifiant attribué par le serveur, inscrit dans `ids.json`, rien de coché, lisible par `get_preset` ;
- copie en `en-US` et en visuel : même sélection, même thème, même libellé, photo décochée, normes en section dédiée ;
- refus d'un preset source inconnu, d'un chemin et d'un nom invalide, sans rien écrire ;
- parcours complet : `create_preset`, `get_preset`, `preview_selection` (1 page), `propose_selection` avec `baseRevision`, rien d'appliqué avant l'acceptation, puis acceptation par `acceptProposal`.

Dans tous les cas, l'empreinte de la bibliothèque, de `profile.json` et du preset existant ne change pas, et aucune réponse ne contient d'e-mail ni de téléphone. `inmemory.test.ts` et `stdio.test.ts` comptent désormais 22 outils. Les tests de l'API des presets (`apps/server/test/selection.test.ts`) passent sans changement : la route `POST /api/presets` ne transmet ni `language` ni `layout`.

## Conséquences

- **Cahier v1.7** : F-PRE-02, §7.1 (le preset parmi les ajouts), §7.2 (MCP-22).
- **Fichiers** : `packages/store/src/presets.ts` (`language`, `layout`, `changes`), `apps/mcp/src/tools-preset.ts`, `apps/mcp/src/server.ts`, `apps/mcp/src/instructions.ts`, `README.md`, `CLAUDE.md`.
- **Risque** : Claude peut multiplier les presets. Parade : l'outil ne s'appelle qu'à la demande de l'utilisateur, un preset de trop s'archive dans l'interface, et rien n'est jamais supprimé.
- **Mise en ligne** : l'instance en ligne n'a l'outil qu'après `npm run deploy` (ADR 0018), puis `/mcp` pour reconnecter Claude Code (Claude Desktop : le quitter complètement).
