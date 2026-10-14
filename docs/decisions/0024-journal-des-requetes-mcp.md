# ADR 0024 — Journal des requêtes MCP

- **Date** : 08/10/2026
- **Statut** : accepté
- **Contexte** : l'utilisateur demande « une page log, avec toutes les demandes MCP réalisées avec l'IP, l'heure et la date, possibilité de regrouper par id pour vérifier l'absence de fuite ». Le cahier v1.8 n'en dit rien : le §7.5 interdit qu'un outil renvoie e-mail, téléphone, photo ou adresse, mais rien ne permet à l'utilisateur de le constater, ni de voir qui a lancé le serveur MCP de l'instance en ligne (ADR 0018). Conformément au `CLAUDE.md`, l'ajout passe par le cahier (v1.9 : §7.5, §7.6, F-UI-08). Le cahier étant muet sur les détails, cet ADR retient l'option la plus simple.

## Décision

### Ce qui est journalisé

Chaque **requête JSON-RPC** reçue par le serveur MCP, protocole compris (`initialize`, `tools/list`…), devient **une ligne JSON** une fois sa réponse envoyée (`McpLogEntry`, `packages/core/src/mcp-log.ts`) :

| Champ             | Contenu                                                                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `at`              | réception de la requête (ISO 8601, UTC ; l'interface affiche l'heure du navigateur)                                                                                                                         |
| `session`         | identifiant aléatoire (8 caractères hexadécimaux) d'un démarrage du serveur, donc d'une connexion SSH (un toucher de la YubiKey) : c'est l'« id » de regroupement demandé                                   |
| `seq`             | rang de la requête dans sa session (1, 2…) : plusieurs requêtes peuvent arriver dans la même milliseconde                                                                                                   |
| `ip`, `via`       | adresse du client SSH ; `via: local` pour un serveur local (stdio), `ip: null` avec `via: ssh` pour une commande SSH qui ne transmet pas l'adresse                                                          |
| `client`          | nom et version du client MCP (`clientInfo` d'`initialize`, ou des métadonnées de la requête)                                                                                                                |
| `method`, `name`  | méthode JSON-RPC ; outil (`tools/call`) ou prompt (`prompts/get`) appelé                                                                                                                                    |
| `args`            | arguments résumés (`summarizeArgs`) : valeurs courtes telles quelles, texte de plus de 80 caractères remplacé par sa longueur, structures profondes par leur taille ; coordonnées masquées (`maskContacts`) |
| `outcome`, `code` | `ok` ; `tool-error` (refus métier, avec son code : `PAGE_OVERFLOW`, `NOT_FOUND`…) ; `error` (erreur JSON-RPC, avec son code) ; `no-response` (connexion fermée avant la réponse)                            |
| `ms`, `bytes`     | durée de traitement ; taille de la réponse (octets UTF-8)                                                                                                                                                   |
| `leaks`           | coordonnées de l'identité trouvées dans la réponse (`email`, `phone`) : la liste doit rester vide                                                                                                           |

Le journal ne contient jamais de coordonnée : seul le **type** de la coordonnée trouvée est noté, et les arguments passent par `maskContacts`.

### Contrôle « Coordonnées » (absence de fuite)

`findContactLeaks` (`packages/core/src/text/contacts.ts`) cherche dans chaque réponse envoyée **l'e-mail de l'identité** (sans tenir compte de la casse) et **son numéro de téléphone sous toutes ses formes** (texte saisi tel quel, ou numéro reconnu par libphonenumber et comparé chiffre à chiffre, `samePhone` : `06 39…`, `+33 6 39…`, `0639…`). C'est un contrôle **indépendant du masquage** des outils (`makeMasker`) : il porte sur le message réellement écrit sur le transport, outils, prompts et listes compris.

- Les données base64 des **images** (aperçus du CV) sont exclues du contrôle : ce n'est pas du texte, et la photo n'y figure jamais (rendus MCP avec `placeholderPhoto()`, ADR 0012).
- Un numéro de moins de 6 chiffres n'est pas comparé (il se retrouverait partout).
- Seules les coordonnées de l'identité sont cherchées : un e-mail quelconque d'une offre est déjà masqué par les outils et n'est pas une donnée de l'utilisateur.
- L'adresse postale n'est pas dans le modèle (§5.2 : ville et pays seulement, qui figurent sur le CV) ; la photo n'est jamais transmise : ni l'une ni l'autre n'est cherchée.

### Où et comment

- **Écriture** (`apps/mcp/src/request-log.ts`) : le transport stdio est enveloppé (`LoggedTransport`) ; `RequestJournal` note chaque requête reçue, puis écrit la ligne quand la réponse est partie. Rien ne change sur le fil. Les écritures d'un processus sont mises en file (ordre gardé), par ajout (`appendFile`, mode 600) : plusieurs processus MCP (Claude Code, Claude Desktop) peuvent écrire en même temps. Une erreur du journal ne bloque jamais le serveur : elle est signalée sur stderr. Une coordonnée trouvée est aussi signalée sur stderr.
- **Fichier** : `out/logs/mcp-AAAA-MM.jsonl` (mois UTC de la requête ; `CV_OUT_DIR` sur le serveur, donc `<base>/out/logs/`). `out/` existe déjà partout, est ignoré par git, refusé par `guard-commit` et accessible en écriture au service : aucun nouveau dossier, aucune nouvelle variable, aucun changement de `cv.service` ni d'`install-release.sh`. Ce n'est pas `data/` : le journal n'entre ni dans la sauvegarde ZIP ni dans la réinitialisation (ADR 0021), qui ne doit pas effacer une trace d'accès.
- **Conservation** : rien n'est supprimé automatiquement ; l'utilisateur efface les anciens mois s'il le souhaite (README).
- **Lecture** (`apps/server/src/mcp-log.ts`, `GET /api/mcp-log?month=AAAA-MM`) : les mois disponibles, puis un mois (par défaut le plus récent), requêtes triées de la plus récente à la plus ancienne (une ligne est écrite à la réponse, pas à la réception), 5 000 au plus, 20 Mo lus au plus (la fin du fichier). Les lignes invalides sont comptées, jamais affichées. Un mois mal formé reçoit un 400. Route protégée comme toutes les routes `/api` (jeton, session de l'instance en ligne). Sans `out/`, `available: false`.
- **Jamais par le MCP** : aucun outil ne lit le journal (il révélerait les adresses IP à Claude, sans utilité pour lui).

### Adresse IP sur l'instance en ligne

`sudo` remet l'environnement à zéro et efface `SSH_CONNECTION`. La commande SSH le transmet donc par `env` :

```
ssh <hôte> 'sudo -n -u cv env CV_SSH_CONNECTION="$SSH_CONNECTION" sh <base>/current/scripts/vps/mcp.sh'
```

- `$SSH_CONNECTION` est développé par le shell de l'utilisateur SSH sur le serveur ; `env` est une commande ordinaire pour `sudo` (aucune règle `SETENV` ni modification de `sudoers`). Claude Code ne développe que `${VAR}` dans `.mcp.json` : `$SSH_CONNECTION` y arrive intact. Le passage de l'argument par Windows (`ssh.exe`) a été vérifié.
- `peerFromEnv` lit `CV_SSH_CONNECTION`, sinon `SSH_CONNECTION` (MCP lancé par SSH sans `sudo`). Seul le premier champ, l'adresse, est gardé, s'il n'a que des caractères d'une adresse IPv4 ou IPv6.
- **Alternative écartée** : un script d'enveloppe sur le serveur, lancé par l'utilisateur SSH avant `sudo`. Les versions installées appartiennent à `cv` : un processus `cv` compromis (le MCP lit des offres non fiables) pourrait modifier ce script, que l'utilisateur SSH (administrateur) exécuterait ensuite. La commande reste donc du côté du client.
- La valeur n'est pas une preuve : quiconque lance le MCP peut la fixer, mais il faut pour cela l'accès SSH, donc la YubiKey.
- Une ancienne configuration (Claude Desktop non mis à jour) continue de fonctionner ; le journal affiche « adresse inconnue (SSH) » et l'écran le signale.

### Écran « Journal MCP » (`apps/web/src/pages/JournalPage.tsx`, route `/journal`)

- Onglet du haut, à côté de « À valider ». Choix du mois ; **regroupement** par session (par défaut), adresse IP, outil, jour, ou aucun ; option « Masquer les requêtes de protocole » ; bouton « Actualiser » (le journal est hors de `data/` : le flux SSE ne le suit pas).
- En tête : nombre de requêtes, de sessions, adresses vues, et le bilan du contrôle (vert : « aucune réponse ne contenait votre e-mail ni votre téléphone » ; rouge sinon), plus le nombre de requêtes sans adresse.
- Chaque groupe (repliable) donne la période, les adresses, les clients, les refus et le nombre de réponses avec une coordonnée ; puis le tableau : date et heure, session, adresse, requête, arguments, résultat, durée, taille de la réponse, coordonnées.

## Tests

- `packages/core/test/mcp-log.test.ts` : contrôle des coordonnées (réponse masquée, casse de l'e-mail, quatre écritures du téléphone, autres numéros, valeur trop courte), nom du fichier mensuel, schéma d'une ligne.
- `apps/mcp/test/request-log.test.ts` : adresse (`CV_SSH_CONNECTION`, `SSH_CONNECTION` en IPv6, poste local, SSH sans adresse, valeur invalide), résumé des arguments ; serveur réel sur la fixture `courte` (session, adresse, client, outils, refus `NOT_FOUND`, aucune coordonnée, aucune coordonnée dans le fichier) ; transport factice : réponse avec l'e-mail et le téléphone signalée sans les recopier, image exclue du contrôle, requête sans réponse à la fermeture.
- `apps/mcp/test/stdio.test.ts` : le serveur compilé, en sous-processus, journalise `initialize`, `tools/list` et l'outil avec l'adresse passée par `CV_SSH_CONNECTION` (et écrit dans un `CV_OUT_DIR` temporaire, jamais dans le `out/` du projet).
- `apps/server/test/mcp-log.test.ts` : mois le plus récent, tri, autre mois, mois absent, mois mal formé (400), lignes invalides comptées, sans `out/`, jeton exigé.

## Conséquences

- Cahier v1.9 : §7.5 (contrôle des réponses), §7.6 (commande SSH, journal), F-UI-08 (écran).
- `.mcp.json`, la configuration Claude Desktop du README et `scripts/vps/mcp.sh` (commentaire) portent la nouvelle commande. **Effet sur le VPS après `npm run deploy`**, puis `/mcp` ; Claude Desktop : mettre à jour son bloc `cv` à la main.
- Le journal contient des adresses IP et le nom des outils appelés : il reste sur le serveur (ou le poste), comme les exports de `out/`.
