# ADR 0014 — Outils MCP du lot 5, propositions et garde-fous

- **Date** : 06/10/2026
- **Statut** : accepté
- **Contexte** : lot 5 ; MCP-04 à 07, 09 à 13, 15 à 17, prompt `adapter-a-une-offre` (§7.3), §7.4, §7.5, annexe C, F-SEL-10, F-PRO-01 à 04, F-IMP-04, §12.1 et §12.4, T-03. Le cahier est muet ou imprécis sur sept points : quatre ont été tranchés par l'utilisateur le 06/10/2026 (marqués « décision utilisateur »), les trois autres sont des choix techniques.

## Outils

| Outil                        | Fonction partagée (store, core)                                                      | Écriture                                |
| ---------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------- |
| MCP-04 `get_items`           | `loadLibraryFiles`                                                                   | aucune                                  |
| MCP-05 `list`                | `listApplications`, `listImportFiles`, `scanProposals`                               | aucune                                  |
| MCP-06 `get_preset`          | `listPresets`                                                                        | aucune                                  |
| MCP-07 `get_application`     | `loadApplication`, `readOffer`                                                       | aucune                                  |
| MCP-09 `create_application`  | `createApplication` (lot 4)                                                          | ajout                                   |
| MCP-10 `save_offer_analysis` | `saveOfferAnalysis` (lot 4), `computeCoverage`                                       | ajout                                   |
| MCP-11 `preview_selection`   | `renderCv`, `bulletLineCosts`, `computeCoverage`                                     | aucune                                  |
| MCP-12 à 17 `propose_*`      | `proposeSelection`, `proposeVariants`, `proposeItems`, `proposeEdit`, `proposeAlias` | `proposals/<ULID>.json` (et `ids.json`) |

- **Mêmes fonctions que l'interface** : les outils d'ajout passent par celles du lot 4. Aucun outil n'écrit dans `library/`, `presets/` ni `profile.json` (test d'empreintes).
- **Organisation** : le serveur est découpé en `context.ts` (options, annotations, erreurs, marquage), `tools-read.ts`, `tools-application.ts`, `tools-propose.ts` et `prompts.ts`.
- **Annotations** : celles du §7.2. `readOnlyHint` pour les lectures et `preview_selection` ; `idempotentHint: false` pour les ajouts, les propositions, `render` et `check_ats` ; `openWorldHint` et `destructiveHint` à `false` partout.
- **`outputSchema`** sur chaque outil.
- **Instructions du serveur** : 1 596 caractères.

## Propositions (§6.9, F-PRO-04)

- **Identifiant** : ULID (dépendance `ulid` 3.0.2, MIT, version exacte, ADR 0001 ; générateur monotone).
- **Base** `{ file, revision, hash, snapshot }` calculée par le serveur sur l'état courant (ADR 0010) ; `origin: claude`.
- **Contrôles** : les huit règles de l'annexe C, enregistrées dans `checks` et affichées dans « À valider ». Une règle `error` en échec rejette la proposition, qui n'est alors pas écrite. Une règle `warning` (similarité, sigle ambigu, terme de l'offre repris) laisse passer la proposition, en l'affichant.
- **Lot de 25** (`propose_variant`, `propose_item`) : résultat par élément (`created`, `rejected` avec la règle, `duplicateOf`). Si tout est rejeté : erreur d'outil `GUARDRAIL_REJECTED`, qui porte les résultats.
- **Révision lue** : `baseRevision` facultatif (`propose_variant`, `propose_edit`, `propose_selection`). Une révision périmée donne `STALE_REVISION` avec la révision courante (§8.4). C'est indispensable pour une sélection : un delta calculé sur une version que l'utilisateur a modifiée entre-temps reviendrait sur ses coches.
- **Identifiants réservés** : ceux d'un nouvel élément (`propose_item`) sont consignés dans `ids.json` dès la proposition, pour que deux propositions en attente ne partagent jamais un identifiant. L'acceptation admet un identifiant déjà consigné.
- **Réponse** : `reviewUrl` (`http://127.0.0.1:<CV_PORT>/a-valider?ids=…`) et le rappel de lancer `npm run dev`. Le serveur MCP ne fait aucun appel réseau, donc il ne vérifie pas si l'interface tourne (choix technique).

### `propose_selection` (MCP-12)

- **Contenu** : la sélection candidate complète, à partir de `get_application` ou `get_preset`. Elle est stockée en **delta** : ajouts, retraits, variantes.
- **Ce que le delta ne porte pas** : sections, ordre, titre et accroche choisis, titre saisi. Ces écarts sont listés dans la réponse (`ignored`) et dans un contrôle d'avertissement.
- **Élément ajouté rendu visible** (précision de l'ADR 0010) : à l'acceptation, la section d'un élément ajouté est activée, l'entrée d'une puce ajoutée est cochée, et la section Compétences l'est aussi pour une norme affichée en `skills-subgroup`. C'est la règle « cocher un enfant rend ses parents visibles » de l'ADR 0011. Sans elle, un projet ajouté resterait masqué par sa section désactivée.
- **F-SEL-10** : appliquée sur le résultat (`checkSelectionRule`) : 422 `SELECTION_RULE` avec les identifiants en cause.
- **Variantes en attente** : un `prop:<ULID>` doit désigner une variante en attente de cet élément ; il est ajouté à `dependsOn`.
- **Une seule proposition active par cible** : une nouvelle doit nommer l'active dans `supersedes`, sinon `SUPERSEDES_REQUIRED`. L'ancienne passe à `superseded`, avec `resolution.finalValue.by`.

### `propose_item` (MCP-15)

- **Sources de référence** (annexe C) :
  - `dictee` : `userStatement`, obligatoire ;
  - `import-cv` : le texte de `sourceFile` ;
  - `offre` : la bibliothèque et les durées calculées, **pour un titre ou une accroche seulement** ;
  - `import-linkedin` : réservée à MCP-21 (lot 6).
- **Fichiers lus** (décision utilisateur : texte seulement) : `.md` et `.txt` de `import/`. PDF et DOCX donnent `NOT_AVAILABLE`, avec la consigne de joindre le fichier dans la conversation (lot 6 : MCP-08).
- **Contrôle d'un élément** : il est assaini puis validé avec des identifiants provisoires, pour qu'un refus ne consomme pas d'identifiant ; puis l'intégrité de la bibliothèque (catégorie, compétences liées) est vérifiée. Les années des dates sont contrôlées comme des nombres ; les mois ne le sont pas, car une déclaration les écrit rarement en chiffres.
- **Dédoublonnage F-IMP-04**, contre la bibliothèque et contre les propositions en attente. Clés :

  | Élément               | Clé                                                 |
  | --------------------- | --------------------------------------------------- |
  | Expérience            | organisation normalisée et dates qui se chevauchent |
  | Formation             | établissement et diplôme                            |
  | Compétence            | `short` ou alias (`sameTerm`)                       |
  | Langue                | code                                                |
  | Titre, accroche       | texte identique                                     |
  | Projet, certification | nom                                                 |
  | Centre d'intérêt      | texte                                               |

- **Doublon trouvé** (interprétation) :
  - compétence : ses nouvelles formes deviennent des propositions `alias` ;
  - autre élément : `duplicateOf` est renvoyé, avec la consigne de compléter par `propose_variant` (puces) ou `propose_edit` (champ). Aucun type de proposition ne permet d'ajouter une puce à une expérience existante : l'import complet arrive au lot 6.

### `propose_edit` (MCP-16) et `propose_alias` (MCP-17)

- **`propose_edit`** :
  - source de référence : l'ancienne valeur, plus `userStatement` quand l'utilisateur a donné la correction ;
  - `organization`, `position`, `start` et `end` sont des faits sensibles (contrôle `immutable-fields` avec motif, F-PRO-06) ;
  - les dates ne passent pas par `no-new-numbers` : ce sont des valeurs structurées, validées une par une dans l'interface ;
  - champs refusés : `id`, `bullets`, `variants` ; l'élément modifié doit rester valide.
- **`propose_alias`** : un alias (équivalent strict, qui compte pour la couverture) qui désigne **une autre compétence connue** du dictionnaire est refusé (« GitLab » pour Git). Un alias ne doit pas rendre couvert un terme que la candidate n'a pas. Un terme voisin (`related`) est admis.

## Garde-fous de l'annexe C (`packages/core/src/guardrails.ts`)

| Règle                | Mise en œuvre                                                                                                                                                                                                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-new-numbers`     | Codes retirés d'abord : normes, `21 CFR`, termes protégés (`510(k)`, `2017/745`), règlements, MDCG, versions. Séparateurs de milliers et décimales, `%`, `k`, `M`, `Md`, `€`, `$`, `x`. Nombres en lettres de 0 à 20 (FR, EN), **sauf « un », « une », « one »** (articles bien plus souvent que nombres). Valeurs comparées une à une |
| `protected-facts`    | `classe I/II/IIa/IIb/III` et `classe A/B/C` : chaque classe du texte doit figurer dans la source (une variante courte peut en omettre une)                                                                                                                                                                                             |
| `no-new-skills`      | Voir ci-dessous                                                                                                                                                                                                                                                                                                                        |
| `immutable-fields`   | Les outils autres que `propose_edit` ne peuvent pas modifier organisation, intitulé ni dates par construction ; `propose_edit` marque le fait sensible                                                                                                                                                                                 |
| `max-length`         | Puce : 200 caractères. Accroche : 3 lignes, estimées à 3 × 95 caractères                                                                                                                                                                                                                                                               |
| `similarity`         | Jaccard des mots pleins (mots vides FR et EN retirés) avec le texte source **le plus proche** de la même langue ; avertissement sous 0,45                                                                                                                                                                                              |
| `allowed-editions`   | Édition hors de la table A.2 rejetée, sauf si la source l'écrit déjà (« celle qui était appliquée à l'époque », A.2). Les amendements EN (`2016/A11:2021`) sont admis. Terme historique (QSR, DHF, DMR, DHR, MDD, exigences essentielles, 93/42/CEE) absent de la source : rejeté pour une expérience en cours                         |
| `no-foreign-content` | URL (domaines en minuscules : « ASP.NET » n'en est pas une), adresse e-mail (regex B.5), phrase de niveau « consigne » de `flagInstructions` : rejetées si absentes de la source                                                                                                                                                       |

### `no-new-skills`

- **Dictionnaire** : compétences et alias de la bibliothèque ; annexe A ; termes et alias de **toutes** les analyses enregistrées (courantes et historiques) ; vocabulaire tech de référence (`packages/core/vocab/tech.ts`, choix technique : 250 termes courants rédigés pour le projet, aucun référentiel copié).
- **Fusion** : les entrées qui partagent une forme normalisée sont une seule compétence, et l'identifiant de la bibliothèque prime. Passer de « CEI 62304 » à « IEC 62304 » n'est donc pas une nouveauté.
- **Ensemble autorisé** : les compétences détectées dans la source, plus `bullet.skills` et `item.skills`.
- **Sigle ambigu** (Go, R, Swift, Spring…) : avertissement seulement.
- **Précision apportée par ce lot** :
  - **Le problème** : appliquée à la lettre, la règle rejetait toute reformulation du groupe (b). Exemple : la puce dit « traçabilité exigences-tests », la variante reprend le terme de l'offre, « traçabilité des exigences », qui est un terme de l'analyse donc une « compétence » du dictionnaire. Or c'est l'usage prévu de `propose_variant` (étape 6 du prompt).
  - **La règle retenue** : un terme du dictionnaire est **admis avec un avertissement** quand la source le dit déjà sous un autre libellé (tous ses mots pleins, à une terminaison près, comme le groupe b de F-OFF-03), ou quand c'est un `related` d'une compétence liée à la puce.
  - **Ce qui reste rejeté** : un terme d'un seul mot (Kubernetes), ou sans appui dans la source.

### Durées calculées (décision utilisateur : prudent, deux totaux)

- **Ce qui compte** : expériences seulement, périodes qui se chevauchent fusionnées.
- **Bornes** : une date sans mois est lue au plus court (début en décembre, fin en janvier) ; une expérience en cours compte jusqu'au mois actuel ; arrondi à l'année inférieure.
- **Nombres admis** : le total avec stages et alternances, le total sans, et le total par tag. Une durée n'est jamais gonflée.
- **Exemple** : sur `courte`, 7 ans au total, 7 sans le stage, 3 ans pour le tag `dm`.

## Aperçu (MCP-11)

- **Aucune écriture** : `preview_selection` compile la sélection candidate sur une copie de la bibliothèque. Une variante `prop:<ULID>` y est ajoutée sous l'identifiant `prop-<ulid>`, le temps de l'aperçu.
- **Coût en lignes de chaque puce** (choix technique) : la compilation de mesure est rejouée sans la puce, sans produire de PDF ; la différence de hauteur est convertie en lignes de corps, au dixième. C'est exact, interligne et espacements compris, et le gabarit n'est pas touché. Une compilation de mesure de quelques millisecondes par puce.
- **Couverture** : renvoyée sous forme compacte (niveau, formule, groupes, correctifs), avec les phrases sources marquées.

## Données non fiables (§7.5 ; choix technique)

- **Marquage** : le texte externe (offre, phrase source d'une analyse, phrase signalée) est entouré de `<untrusted source="offer" nonce="…">`, avec un nonce aléatoire de 16 caractères hexadécimaux **par réponse**. Il est appliqué dans le **texte** et dans **`structuredContent`**, car un client peut passer l'un ou l'autre au modèle. Le nonce est aussi renvoyé dans un champ `nonce`.
- **Neutralisation** : `<untrusted` et `</untrusted` présents dans le contenu deviennent `&lt;untrusted` et `&lt;/untrusted`.
- **Coordonnées** : `maskContacts` s'applique, comme avant, à toute réponse.

## `create_application` (décision utilisateur : offre obligatoire)

Exactement l'un des deux, `offerFile` (recommandé) ou `offerText`, comme dans l'interface. La description et le prompt invitent à saisir l'offre dans l'interface ou dans `import/offres/` plutôt que dans le chat (§7.5).

## Prompt `adapter-a-une-offre` (§7.3)

- **Contenu** : les étapes 1 à 10 du cahier, en français.
- **Argument** : `applicationId`, facultatif, et un **mot isolé** (`^[a-z0-9-]+$`) ; un texte libre est refusé.
- **Sans identifiant** : l'étape 2 demande de saisir l'offre dans l'interface ou dans `import/offres/`, puis d'appeler `create_application` avec `offerFile`.
- **Étape 8** : une PAUSE explicite, que `propose_selection` rappelle aussi dans sa réponse.
- **Claude Desktop** (§15 point 5, décision utilisateur) : la procédure est dans le README (bloc `cv` de la configuration MSIX, redémarrage complet). L'utilisateur l'applique quand il le souhaite ; le point reste à vérifier jusque-là. Dans Claude Code, le prompt apparaît après `npm run build:mcp` puis `/mcp`.

## Vérifications

- **Tests** :
  - `packages/core/test/guardrails.test.ts` : les six cas du §12.1, nombres en lettres et unités, alias de la même compétence, sigle ambigu, terme historique, contenu étranger, similarité, termes de l'offre repris, durées, marquage ;
  - `apps/mcp/test/lot5.test.ts` : schémas, refus (`GUARDRAIL_REJECTED`, chemins interdits, `NOT_AVAILABLE`, `STALE_REVISION`, `SELECTION_RULE`, `SUPERSEDES_REQUIRED`), aucune écriture dans le contenu validé, aucune coordonnée, offre piégée neutralisée, `prop:<ULID>`, prompt, acceptation qui rend visibles les éléments ajoutés ;
  - `apps/mcp/test/t03.test.ts` : T-03 de bout en bout ;
  - tests du lot 0 mis à jour (17 outils, 1 prompt).
- **Navigateur** (`dev:demo`, 06/10/2026) : le serveur MCP compilé, lancé en sous-processus sur la copie de démo, crée une variante. Elle arrive en direct dans « À valider » (badge à 1, sans recharger), et le `reviewUrl` ouvre la page filtrée avec les huit contrôles.

## Propositions de correction du cahier

- **Annexe C, `no-new-skills`** : ajouter « Un terme du dictionnaire que la source exprime déjà sous un autre libellé (tous ses mots pleins) ou comme terme voisin d'une compétence liée est admis avec un avertissement : c'est la reformulation du groupe (b) de F-OFF-03. »
- **Annexe C, `no-new-numbers`** : préciser « les nombres en lettres de zéro à vingt, sauf un, une et one (articles) » ; et, pour `propose_edit`, « les dates ne sont pas comptées : ce sont des faits sensibles validés un par un ».
- **MCP-12** : préciser « seules les coches et les variantes sont proposées ; la section d'un élément ajouté est activée à l'acceptation » ; ajouter `baseRevision` à la signature (et à MCP-13 et MCP-16), pour le refus `STALE_REVISION` du §8.4.
- **F-IMP-04** : préciser le traitement d'un doublon d'expérience ou de formation : `duplicateOf`, sans proposition, jusqu'à l'import du lot 6.

## Conséquences

- **Dépendance** : `ulid` 3.0.2 ajoutée à `@cv/store` (ADR 0001).
- **Interface** : la file « À valider » affiche déjà les contrôles et les avertissements. Le panneau Couverture indique désormais de passer par le prompt `adapter-a-une-offre`.
