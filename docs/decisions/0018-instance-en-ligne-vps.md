# ADR 0018 — Instance en ligne sur un VPS : mode production, connexion par clé de sécurité, MCP par SSH

- **Date** : 07/10/2026
- **Statut** : accepté
- **Contexte** : l'utilisateur demande de déployer l'application sur son VPS, l'accès au serveur passant par sa YubiKey. La demande contredit le cahier v1.2 : §1.4 (« hébergement en ligne » hors périmètre), §2.1 (usage « en local »), NF-01 (écoute sur `127.0.0.1` et `Host` local seulement) et NF-02 (hors ligne). Conformément au `CLAUDE.md`, l'écart est **proposé ici et intégré au cahier v1.3**, et non appliqué en silence. Les cinq choix structurants ont été posés à l'utilisateur le 07/10/2026 (marqués « décision utilisateur »).

> Les scripts de déploiement décrits ici (`scripts/deploy-vps.ts`, `scripts/vps/`) sont propres à l'instance de l'auteur et ne sont pas publiés ; les chemins du serveur sont notés `<base>`.

## Décisions de l'utilisateur (07/10/2026)

| Sujet               | Décision                                                                                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rôle du serveur     | **Instance principale** : `data/` et `import/` vivent sur le serveur. L'utilisateur les y copie lui-même (règle des données réelles : Claude ne les copie jamais). Le `data/` local devient une archive. |
| Accès à l'interface | **HTTPS public** sur un sous-domaine de l'utilisateur, derrière nginx (le tunnel SSH, recommandé parce qu'il ne change pas NF-01, n'a pas été retenu)                                                    |
| Authentification    | **Clé d'accès WebAuthn** (la YubiKey) dans l'application, recommandée face à Authelia et à l'authentification HTTP de base                                                                               |
| Serveur MCP         | **`cv` lancé sur le serveur par SSH** (`.mcp.json` et Claude Desktop), et non un second serveur MCP à côté du local                                                                                      |
| SSH du serveur      | Clé FIDO2 `ed25519-sk` dédiée ; **mots de passe coupés** une fois l'accès par YubiKey vérifié.                                                                                                           |

## Mode production : `npm start`

`scripts/start.ts` lance **un seul serveur** sur `127.0.0.1:<CV_PORT>` : l'API sert aussi l'interface compilée (`npm run build`, `apps/web/dist`) par `serveWeb` (`apps/server/src/web.ts`). Ce module injecte `X-CV-Token` dans `index.html`, comme Vite en développement. Il sert `assets/` (un seul niveau, noms filtrés, types connus) et renvoie la page pour les routes de l'interface ; les routes `/api` et `/auth` inconnues restent des 404. `npm run dev` est inchangé.

Les dossiers se règlent par `CV_DATA_DIR`, `CV_IMPORT_DIR`, `CV_OUT_DIR` et `CV_AUTH_DIR` (chemins absolus). Par défaut : `data/`, `import/`, `out/` et `auth/` à la racine. Le serveur MCP lit les mêmes variables (`resolveRoot`). Sans `CV_PUBLIC_ORIGIN`, `npm start` reste une instance locale, sans connexion.

## NF-01 révisée

- **Écoute toujours sur `127.0.0.1`** : c'est nginx qui publie l'instance.
- `CV_PUBLIC_ORIGIN` (https, un nom d'hôte, sans chemin ni port : `parsePublicOrigin`) ajoute **un seul** hôte aux `Host` permis et une seule origine aux `Origin` permises. Tout autre hôte reçoit toujours un 403.
- **Une origine publique exige la connexion par clé, et réciproquement** : `createApp` refuse de démarrer sinon.
- Le jeton `X-CV-Token`, le contrôle d'`Origin` et de `Content-Type` sur les écritures, la limite de 1 Mo et l'absence d'écriture par GET sont inchangés. Ils s'ajoutent à la session.

## Connexion par clé de sécurité (`apps/server/src/auth.ts`)

- **Bibliothèque** : `@simplewebauthn/server` **14.0.3** (MIT), version exacte, la référence en Node pour la vérification WebAuthn (attestation, signature, compteur). Écrire cette vérification à la main serait plus risqué.
- **Paramètres** : RP ID = hôte de l'origine publique. Origine attendue = l'origine publique. Attestation `none`. Clé non résidente (`residentKey: discouraged`, pour ne pas occuper d'emplacement de la YubiKey). Vérification de l'utilisateur `preferred` (PIN si le navigateur le demande). Le compteur de signatures est contrôlé (clone détecté).
- **Enregistrement d'une clé** : il faut un **code à usage unique** créé sur le serveur par `npm run auth:code` (`scripts/vps/auth-code.sh`), donc lisible seulement par SSH, c'est-à-dire avec la YubiKey.
  - Le code fait 20 caractères dans un alphabet de 31 sans ambiguïté, soit environ 99 bits.
  - Il est valable 15 minutes, avec 5 essais au plus, et seul son SHA-256 est stocké.
  - Il n'est consommé qu'à la vérification de la clé, et seulement s'il est encore celui pour lequel les options ont été émises.
  - 10 clés au plus. La page recommande d'en enregistrer une seconde, de secours.
- **Session** : identifiant aléatoire de 256 bits, gardé **en mémoire** (un redémarrage, donc un déploiement, demande de se reconnecter). Elle dure 12 h.
  - Le cookie est `__Host-cv-session` : `HttpOnly`, `Secure`, `Path=/`.
  - Il est en `SameSite=Lax` et non `Strict`, pour qu'un lien `reviewUrl` ouvert depuis Claude arrive connecté. Les écritures restent protégées par l'`Origin`, le jeton et le JSON obligatoire.
- **Contrôle d'accès** (`gate`) : `/connexion`, `/auth/*` et `/api/health` sont libres. Sans session, `/api/*` répond **401** `UNAUTHENTICATED` et une page redirige vers `/connexion?suite=<chemin>` (retour limité à un chemin local, `safeNext`). L'interface renvoie vers la connexion sur un 401 et propose « Se déconnecter » (balise `cv-online`).
- **Limites** : 20 échecs en 15 minutes suspendent la connexion et l'enregistrement (429). Au plus 50 défis en attente, à usage unique, valables 5 minutes.
- **Stockage** : `CV_AUTH_DIR` (`keys.json`, `enrolment-code.json`, en mode 600), **hors de `data/`**. Les clés n'apparaissent donc ni dans la sauvegarde ZIP ni dans le MCP. `auth/` est ignoré par git et refusé par `guard-commit`.
- **Page `/connexion`** : autonome, sans ressource externe, sous une CSP stricte (`default-src 'none'` ; script et style autorisés par leur empreinte SHA-256).
- **Tests** (`apps/server/test/auth.test.ts`) : un authentificateur logiciel ES256 produit de vraies attestations et signatures. Ils couvrent l'enregistrement, la connexion, le rejeu, une autre clé, une autre origine, le code faux, expiré ou réutilisé, l'expiration et la fermeture de session, le 429, `Host` et `Origin`, la CSP et `safeNext`.

## MCP par SSH

Le serveur MCP tourne sur le serveur, sous l'utilisateur système `cv` : `ssh <hôte> sudo -n -u cv sh <base>/current/scripts/vps/mcp.sh` (stdin et stdout portent le protocole, les journaux vont sur stderr). Chaque démarrage du MCP demande donc de toucher la YubiKey. Les `reviewUrl` partent de `CV_PUBLIC_ORIGIN` (`interfaceOrigin`), sinon de `http://127.0.0.1:<CV_PORT>`.

## Déploiement : `npm run deploy` (`scripts/deploy-vps.ts`)

- **Ce qui part** : le **dernier commit** (`git archive HEAD`, donc les seuls fichiers versionnés, jamais `data/`, `import/`, `out/`, `auth/` ni `.env`). Le transfert passe par **une seule connexion SSH**, donc un seul toucher de la clé. Sous Windows, le script utilise l'OpenSSH du système, qui dialogue avec la YubiKey.
- **Réglages** (`.env` local) : `CV_DEPLOY_HOST` (hôte de `~/.ssh/config`) et `CV_DEPLOY_ORIGIN`.
- **Sur le serveur**, `scripts/vps/install-release.sh` (root) :
  - crée l'utilisateur `cv` et les dossiers `<base>/{data,import,out,auth}` (mode 700), qu'une version ne touche jamais ;
  - écrit `<base>/cv.env` ;
  - installe la version dans `<base>/releases/<date>-<commit>`, puis lance `npm ci` et `npm run build` sous `cv` ;
  - initialise un `data/` vide s'il manque ;
  - bascule le lien `<base>/current`, puis installe et redémarre `cv.service` ;
  - vérifie `/api/health` et **revient à la version précédente** en cas d'échec ;
  - garde les 3 dernières versions.
- **Service** (`scripts/vps/cv.service`) : utilisateur `cv`, système et code en lecture seule (`ProtectSystem=strict`), écriture limitée aux quatre dossiers de données, aucune capacité, `NoNewPrivileges`.
- **HTTPS** : `scripts/vps/setup-https.sh <domaine>`, une seule fois. Il obtient le certificat Let's Encrypt avec le compte certbot déjà présent sur le serveur (aucune acceptation de conditions au nom de l'utilisateur), puis installe le site nginx (`nginx-cv.conf` : HSTS, `noindex`, 2 Mo, SSE sans tampon). Il n'écrase jamais un autre site.
- **Données** : `scripts/vps/receive-data.sh` reçoit une archive `data/` (+ `import/`) **envoyée par l'utilisateur**. Il arrête le service, garde les dossiers précédents dans `<base>/backups/`, installe les nouveaux, relance le service et le vérifie.

## Accès SSH par YubiKey depuis le poste Windows

Constats du 07/10/2026 :

- `ssh-add -K` et `ssh-keygen -K` (OpenSSH de Windows comme celui de Git) ne savent pas récupérer une clé résidente : « invalid format ».
- L'OpenSSH de Windows exige `SecurityKeyProvider internal`.
- `BatchMode` abandonne une clé protégée par une phrase de passe sans solliciter la YubiKey.

D'où une **clé non résidente sans phrase de passe**, dédiée : le fichier n'est qu'une poignée, inutilisable sans la YubiKey, qu'il faut toucher à chaque connexion. L'hôte SSH de `~/.ssh/config` n'utilise que cette clé (`IdentitiesOnly yes`, `IdentityAgent none`, `SecurityKeyProvider internal`), sans mot de passe ni clavier interactif.

## Corrections du cahier (v1.3)

§1.4, §2.1, §7.6, §8.1, §8.2, NF-01, NF-02, NF-05, §13 (lot 9), §14.

## Risques et limites

- **Perte de la YubiKey** : enregistrer une seconde clé sur la page de connexion. Pour SSH, la console du fournisseur du VPS reste le dernier recours.
- **Sauvegarde des données du serveur** : le bouton « Sauvegarde ZIP » et les copies de `<base>/backups/`. Aucune sauvegarde automatique hors du serveur n'est prévue (à décider).
- **NF-02** : l'instance en ligne exige Internet ; le mode local (`npm run dev`) reste disponible.
