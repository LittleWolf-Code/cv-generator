# ADR 0005 — Stockage atomique, identifiants et fixtures

- **Date** : 05/10/2026
- **Statut** : accepté
- **Contexte** : §8.4, §9, annexe B.1, annexe D.

## Écriture atomique

`write-file-atomic` ne réessaie pas le `rename` sur `EPERM`/`EBUSY`, fréquents sous Windows (antivirus, indexeur). Le cahier autorise « ou rename avec réessais » : `packages/store/src/atomic.ts` écrit un fichier temporaire dans le même dossier (`flag wx`, `fsync`), puis `rename` avec **5 réessais** espacés de 20, 40, 80, 160 et 320 ms sur `EPERM`, `EACCES` et `EBUSY`. JSON en UTF-8 sans BOM ; BOM toléré en lecture.

## Verrou et révisions

- Verrou unique `data/.lock` (`proper-lockfile`, `realpath: false`, péremption 10 s), partagé par l'API et les processus MCP.
- Chaque fichier a une `revision` ; `write()` l'incrémente. Avec `expectedRevision`, une révision périmée lève `STALE_REVISION` (HTTP 409, erreur d'outil MCP).
- `schemaVersion` ≠ 1 : refus explicite `SCHEMA_VERSION`.

## Identifiants

Format `<préfixe>-<slug>[-n]` (`exp-medtech-exemple-2023`, puis `-2`, `-3`…), préfixes `ttl`, `sum`, `exp`, `edu`, `prj`, `sk`, `cert`, `lang`, `int`, `cat`, `b` (puce), `lk` (lien), `preset`, `app`. Chaque identifiant attribué est consigné dans `ids.json` et n'est jamais réutilisé, même après suppression. Les propositions utilisent un ULID (lot 1).

## Assainissement et schéma

Le schéma Zod **refuse** tout texte non assaini (annexe B.1) : un texte stocké est toujours la sortie de `sanitize`. L'assainissement a lieu sur le chemin d'écriture (saisie, import, proposition). Écarts mineurs, documentés dans le code : les espaces de bord sont aussi retirées, et CRLF devient LF dans les champs multilignes.

## Fixtures

Les personas de `fixtures/personas/` ont l'arborescence de `data/`, mais ce sont des **saisies brutes** : `installFixture()` les copie dans un dossier (temporaire en général) **en passant par le chemin d'écriture** (assainissement puis validation). C'est ce qui permet à `pieges` de contenir U+00A0, U+202F, U+00AD, U+200B, U+2011 et des apostrophes courbes, et de vérifier qu'ils sont assainis. Les saisies qui doivent être refusées (emoji, contrôle, zone privée) sont dans `pieges/refused-inputs.json`, hors modèle de données.

`npm run dev:demo`, les tests et `test:ats` travaillent sur une **copie temporaire** : les fixtures versionnées ne sont jamais modifiées.

| Persona      | Remplissage mesuré | Résultat                                                |
| ------------ | ------------------ | ------------------------------------------------------- |
| `courte`     | 61 %               | 1 page, tous les critères au vert                       |
| `pieges`     | 58 %               | 1 page, tous les critères au vert                       |
| `debordante` | 127 % (≈ 1,3 page) | 2 pages, dépassement d'environ 16 lignes, export refusé |
