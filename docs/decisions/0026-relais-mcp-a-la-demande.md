# ADR 0026 — Relais MCP à la demande : la clé de sécurité seulement quand Claude utilise `cv`

- **Date** : 10/10/2026
- **Statut** : accepté
- **Contexte** : l'utilisateur signale que « Claude Code demande toutes les deux minutes [sa] clé passkey ». Depuis l'ADR 0018, `.mcp.json` lance le serveur `cv` sur le VPS par SSH, et chaque connexion SSH demande de toucher la YubiKey. Or Claude Code démarre les serveurs de `.mcp.json` **avec chaque session** de ce dossier, nouvelle ou rouverte, et l'application de bureau en ouvre souvent plusieurs ; Claude Desktop fait de même à son lancement. Le journal de connexion de Claude Code (`mcp-logs-cv`) du 10/10/2026 montre trois demandes en moins de trois minutes (une session rouverte à 11:42:59, deux nouvelles à 11:44:33 et 11:45:18), toutes abandonnées après 30 s, dans des sessions qui n'avaient pas besoin des données réelles (le développement se fait sur `fixtures/`). Le cahier (v1.9, §7.6) dit seulement que « la clé de sécurité est demandée à chaque démarrage ». Choix de l'utilisateur : la connexion à la demande.

## Décision

Un **relais local**, `apps/mcp/src/relay.ts` (compilé dans `apps/mcp/dist/relay.js` par `npm run build:mcp`, donc par `postinstall`), se place entre Claude et la commande SSH, qu'il reçoit en arguments :

```
node apps/mcp/dist/relay.js C:/Windows/System32/OpenSSH/ssh.exe <hôte> "sudo -n -u cv env CV_SSH_CONNECTION=\"$SSH_CONNECTION\" sh <base>/current/scripts/vps/mcp.sh"
```

### Ce que le relais répond seul

Il garde une **copie** de ce que le serveur a répondu à la dernière connexion : le résultat d'`initialize` (par version du protocole demandée par le client), la liste des outils et celle des prompts. Avec cette copie, sans rien lancer :

| Requête du client                                                            | Réponse du relais                                                             |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `initialize`                                                                 | la copie pour la version demandée (instructions et capacités comprises)       |
| `notifications/initialized`                                                  | rien : le relais envoie la sienne au serveur à chaque connexion               |
| `tools/list`, `prompts/list`                                                 | la copie                                                                      |
| `ping`                                                                       | `{}`                                                                          |
| méthode inconnue avant `initialize` (`server/discover`…)                     | « Method not found » (-32601), comme le serveur réel                          |
| autre méthode inconnue, ou d'une capacité absente (`resources/list`…)        | « Method not found », comme le serveur réel                                   |
| notification (`notifications/cancelled`…)                                    | ignorée : aucun serveur ne tourne                                             |
| **`tools/call`, `prompts/get`**, toute autre requête d'une capacité annoncée | **lance le serveur réel** (la clé est demandée), puis lui transmet la requête |

### Connexion

- Le relais lance la commande, rejoue l'`initialize` du client (son `clientInfo` arrive donc dans le journal des requêtes, ADR 0024), envoie `notifications/initialized`, puis transmet les requêtes en attente. Ensuite, tout passe tel quel dans les deux sens, ligne par ligne, sauf les réponses aux requêtes du relais lui-même (identifiants `cv-relay-…`).
- Une fois connecté, il redemande les listes au serveur et met la copie à jour. Si une liste déjà servie depuis la copie a changé (nouvelle version déployée), il envoie `notifications/tools/list_changed` ou `notifications/prompts/list_changed` : le client relit la liste.
- **Sans copie** pour la version demandée (premier usage, client qui change de version), il se connecte dès `initialize` : un toucher au démarrage de cette session-là, comme avant, puis la copie existe.
- **Échec** (clé non touchée, connexion refusée, 120 s sans réponse) : chaque requête en attente reçoit une erreur JSON-RPC (-32000) qui dit de réessayer ; le relais revient à l'état initial et **la requête suivante relance la connexion**. Il en va de même si la connexion se ferme pendant la session : les requêtes sans réponse reçoivent une erreur, et `/mcp` puis « Reconnect » n'est plus nécessaire.
- Le serveur tourne ensuite jusqu'à la fin de la session : une session qui utilise `cv` demande **un** toucher, comme avant.

### Copie

- Fichier `out/mcp-relay/<empreinte>.json` (`CV_OUT_DIR` s'il est défini), l'empreinte étant les 16 premiers caractères du SHA-256 de la commande : le serveur local et celui du VPS ne partagent jamais leur copie. Racine par `resolveRoot` (`CV_ROOT`, `CLAUDE_PROJECT_DIR`, chemin du module ; jamais `process.cwd()`).
- Écriture atomique (fichier temporaire puis renommage, mode 600) ; les versions d'`initialize` gardées par un autre relais (Claude Desktop, autre session) sont conservées. Une copie illisible est ignorée (connexion dès `initialize`) ; une erreur d'écriture est signalée sur stderr, jamais bloquante.
- **Contenu** : instructions, capacités, descriptions et schémas des outils et des prompts, c'est-à-dire du code, pas des données. Aucune réponse d'outil n'y entre (test : ni l'e-mail ni le téléphone ni le nom de la persona). `out/` est ignoré par git et refusé par `guard-commit`.

## Sécurité

- Inchangée pour l'accès : chaque connexion SSH demande la YubiKey ; le relais ne garde aucune connexion ouverte entre deux sessions et ne lance que la commande écrite dans `.mcp.json` (ou dans la configuration de Claude Desktop).
- Le journal des requêtes garde son sens : une session du journal est toujours un démarrage du serveur, donc une connexion SSH. Les requêtes servies par la copie n'y figurent pas : elles n'atteignent pas le serveur.
- stdout du relais : uniquement des messages JSON-RPC (§7.6) ; ses journaux (`[cv-relay] …`) et ceux du serveur vont sur stderr.

## Alternatives écartées

- **Multiplexage SSH** (`ControlMaster`, `ControlPersist`) : non pris en charge par l'OpenSSH de Windows, le seul qui dialogue avec la YubiKey sur ce poste (ADR 0018) ; et une connexion maîtresse persistante ouvrirait le serveur sans toucher pendant sa durée de vie.
- **Désactiver `cv` par défaut** (`disabledMcpjsonServers`) : aucune demande, mais il faut réactiver le serveur par `/mcp` (choix qui reste pour les sessions suivantes) avant chaque usage.
- **Transport HTTP derrière un tunnel SSH permanent** : un seul toucher par jour, mais un tunnel ouvert donne accès sans toucher à tout processus du poste, et le serveur MCP gagnerait un second transport à sécuriser.
- **Allonger le délai de connexion** : ne réduit pas le nombre de demandes.

## Tests

`apps/mcp/test/relay.test.ts`, sur le serveur compilé et une copie de la fixture `courte` (`CV_OUT_DIR` temporaire) :

- sans copie : connexion dès `initialize`, 22 outils, copie écrite, sans coordonnée ni nom ;
- avec la copie : sonde `server/discover` refusée, `initialize`, `tools/list`, `prompts/list`, `ping` et `resources/list` servis sans lancer le serveur ; le premier `get_overview` le lance ; une seule nouvelle session dans le journal, avec le `clientInfo` du client ;
- copie périmée : liste servie depuis la copie, `notifications/tools/list_changed` après connexion, liste à jour ensuite ;
- serveur qui échoue au premier lancement (comme `ssh` sans toucher) : erreur claire à `initialize` sans copie ; avec la copie, erreur au premier outil puis succès au suivant, sans relancer le client ;
- sans commande : refus de démarrer (code 2), rien sur stdout.

## Conséquences

- `.mcp.json` lance `node apps/mcp/dist/relay.js` suivi de la commande SSH ; effet **immédiat sur le poste** (rien à déployer : le relais tourne en local), après `npm run build:mcp` et une nouvelle session (ou `/mcp`, puis reconnexion).
- Claude Desktop : bloc `cv` à mettre à jour à la main (README) ; le relais lui évite la demande au lancement de l'application.
- Une session dans un _worktree_ sans `npm install` n'a pas `apps/mcp/dist/relay.js` : le serveur `cv` y échoue sans demander la clé.
- Cahier v1.11 : §7.6 (relais à la demande), §8.2 (arborescence), §14 (risque).
