# ADR 0003 — Serveur MCP sur le SDK v2

- **Date** : 05/10/2026
- **Statut** : accepté
- **Contexte** : §7.1, §7.2, §7.6, §12.4 ; points **[à vérifier à l'init]** du §12.4 (client en mémoire, « paire de transports liés », révision du protocole) et du §7.3 (prompts dans Claude Desktop).

## Décision

- `@modelcontextprotocol/server` 2.3.0 : `McpServer`, `registerTool(name, { title, description, inputSchema, outputSchema, annotations }, handler)` avec des schémas **Zod 4** ; transport `StdioServerTransport` importé de `@modelcontextprotocol/server/stdio`.
- Chaque outil renvoie `structuredContent` et un résumé texte ; les erreurs métier sont des résultats `isError: true` de forme `{code, message, details, hint}` (le SDK ne valide pas `outputSchema` sur un résultat en erreur).
- Toute réponse passe par un masquage (`maskContacts`) : e-mail et téléphone de l'identité, et toute autre adresse ou numéro détectés, deviennent `{{email}}` / `{{phone}}`.
- Lot 0 : MCP-01 `get_overview`, MCP-02 `get_guidelines`, MCP-03 `get_library`, MCP-19 `render`, MCP-20 `check_ats`. Annotations : `openWorldHint: false` et `destructiveHint: false` partout ; `readOnlyHint: true` pour les trois lectures ; `idempotentHint: false` pour `render` et `check_ats`, qui écrivent des fichiers horodatés dans `out/`.
- Instructions du serveur : 1 047 caractères (plafond 2 048).

## Vérifications

| Point                                                                     | Résultat                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paire de transports liés                                                  | `InMemoryTransport.createLinkedPair()` est exporté par `@modelcontextprotocol/server` **et** `@modelcontextprotocol/client` 2.3.0. Test `apps/mcp/test/inmemory.test.ts`                                                                                                                                                                                   |
| Révision du protocole                                                     | `LATEST_PROTOCOL_VERSION = "2025-11-25"` ; versions acceptées : 2025-11-25, 2025-06-18, 2025-03-26, 2024-11-05, 2024-10-07. Le client v2 et un client stdio brut (test en sous-processus) négocient **2025-11-25**. Le README du SDK cite la spécification 2026-07-28 (mode sans session), qui ne concerne pas le transport stdio initialisé classiquement |
| « Un serveur v2 répond aussi aux clients du protocole 2025-11-25 » (§7.1) | Confirmé                                                                                                                                                                                                                                                                                                                                                   |
| stdout propre                                                             | Test en sous-processus : depuis `os.tmpdir()`, chaque ligne de stdout est un message JSON-RPC 2.0 ; les journaux (racine résolue, dossier de données) sont sur stderr                                                                                                                                                                                      |
| Prompts dans Claude Desktop (§7.3)                                        | **Non vérifié** : les prompts arrivent au lot 5, et le vérifier exigerait de modifier la configuration de Claude Desktop, ce que je n'ai pas fait sans accord. Reporté au lot 5 (point ouvert n° 5 du §15)                                                                                                                                                 |

## Résolution de la racine (§7.6)

`CV_ROOT`, sinon `CLAUDE_PROJECT_DIR`, sinon le dossier déduit du module (`apps/mcp/dist/index.js` → `../../..`) ; jamais `process.cwd()`.

**Précision ajoutée** : `CLAUDE_PROJECT_DIR` n'est retenu que s'il désigne bien ce projet (`package.json` racine nommé `cv-generator`). Sinon, un serveur « cv » déclaré au niveau utilisateur et lancé depuis une session Claude Code ouverte dans un autre projet prendrait la racine de cet autre projet. Le cahier est muet sur ce cas ; c'est l'option la plus simple qui reste sûre.

Si le dossier de données est introuvable, le serveur écrit sur stderr « Lancez npm run data:init » et s'arrête avec le code 1 (testé).
