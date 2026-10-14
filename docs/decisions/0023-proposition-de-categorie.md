# ADR 0023 — Proposer une catégorie de compétences par le MCP

- **Date** : 08/10/2026
- **Statut** : accepté
- **Contexte** : l'utilisateur demande que Claude puisse proposer une catégorie de compétences. Le cahier v1.7 ne le permet pas : `propose_item` (MCP-15) ne connaît que neuf types, et une compétence ne peut viser qu'une catégorie validée. La skill `ajouter-mon-cv` renvoyait donc l'utilisateur à l'interface. Le cahier limitait aussi `dependsOn` aux sélections qui dépendent de variantes (F-PRO-03). Conformément au `CLAUDE.md`, l'évolution passe par le cahier (v1.8). Une grande part existait déjà et sert telle quelle : le schéma d'une catégorie (`{id, label}` bilingue), le préfixe d'identifiant `cat`, la collection `categories` du store, le libellé « Catégorie » des propositions et le formulaire de l'interface.

## Décision

### Une proposition `item` de type `category`

Une catégorie est une proposition `item` avec `itemType: 'category'` et `item: { id, label: { fr, en } }`, objet strict : ni `tags`, ni `locked`. Aucun nouveau type de proposition. Le libellé doit avoir au moins une langue : `{fr: null, en: null}` est refusé par le store (« label : au moins une langue (fr ou en) »), sans changer le schéma des fichiers existants. Sources admises : `dictee` (avec `userStatement`) et `import-cv`. `offre` reste refusée hors titre et accroche. Les garde-fous de l'annexe C s'appliquent au libellé comme à tout texte proposé.

### Identifiant `cat-<slug>`

Le serveur attribue `cat-<slug>`, tiré des trois premiers mots du libellé FR, sinon EN : c'est le format d'une catégorie créée dans l'interface (`allocateIdIn` ne change pas). L'identifiant est réservé dans `ids.json` dès la proposition et n'est jamais réutilisé, même après un rejet (F-LIB-02) : une catégorie ressaisie reçoit `cat-…-2`. Les quatre catégories par défaut (`langages`, `outils`, `methodes`, `reglementaire`) gardent leur slug nu.

« Modifier puis accepter » garde l'identifiant réservé : un `id` modifié est ignoré, pour une catégorie comme pour tout nouvel élément. Sinon, les compétences qui en dépendent viseraient un identifiant absent, et `ids.json` enregistrerait un identifiant non réservé.

### Dédoublonnage (F-IMP-04)

La clé est le libellé normalisé (casse, accents et ponctuation ignorés), comparé en FR et en EN dans les deux sens. Il est comparé à la bibliothèque, aux propositions de catégorie en attente et aux éléments du même envoi. Rien n'est écrit pour un doublon :

| Doublon de…              | `duplicateOf`                  | `itemId`                 | Indice                                                                                              |
| ------------------------ | ------------------------------ | ------------------------ | --------------------------------------------------------------------------------------------------- |
| une catégorie validée    | son identifiant (`outils`)     | le même                  | « catégorie déjà présente : visez son identifiant (itemId) dans le champ category des compétences » |
| une catégorie en attente | l'ULID de sa proposition       | son identifiant réservé  | « catégorie déjà proposée, en attente : visez son itemId dans le champ category des compétences »   |
| un élément du même envoi | l'ULID de la proposition créée | l'identifiant du premier | « doublon d'un autre élément du même envoi »                                                        |

Une catégorie n'a jamais de complément.

### Résultat de `propose_item` et de `list`

Chaque élément créé renvoie `itemId` (l'identifiant attribué) et `dependsOn` ; chaque doublon renvoie `itemId`, l'identifiant à viser. Le résumé texte l'écrit aussi : `#0 créée : <ULID> (élément cat-electronique)`, `; dépend de <ULID>`, `(identifiant à viser : outils)`. `list({kind: proposals})` renvoie `itemId` pour une proposition `item` : une autre conversation retrouve ainsi une catégorie en attente. Le `reviewUrl` inclut les dépendances encore ouvertes, pour que l'écran « À valider » montre la catégorie avec ses compétences.

### Une compétence peut viser une catégorie en attente (F-PRO-03 étendu)

Le champ `category` d'une compétence (`propose_item` de type `skill`, ou `propose_edit` du champ `category` d'une compétence) vise une catégorie validée, ou l'`itemId` d'une catégorie en attente. Dans le second cas, le serveur remplit `dependsOn` avec l'ULID de la proposition de catégorie.

Une catégorie ni validée ni en attente est refusée à la proposition :

- par `propose_item`, avec l'indice « proposez d'abord la catégorie (propose_item type category) dans un appel séparé, puis visez l'itemId renvoyé » ;
- par `propose_edit`, qui ne le vérifiait pas jusqu'ici : erreur `INVALID_DATA` « catégorie inconnue : … ». Pour ce champ, la valeur est un identifiant, pas un texte : les garde-fous textuels (`no-new-numbers`, similarité) ne s'y appliquent pas.

Une compétence ne peut pas viser une catégorie proposée dans le même appel : Claude fait deux appels, la catégorie d'abord, et réutilise l'`itemId` renvoyé. L'`itemId` d'un élément en attente ne sert que dans ce champ `category`.

### Acceptation

La dépendance est calculée sur la valeur finale, après « modifier puis accepter ». Une compétence rattachée à une catégorie validée par « modifier puis accepter » n'en exige plus. Si la catégorie visée est encore en attente :

- sans `withDependencies`, la réponse est `DEPENDENCY_PENDING` (409), « cette compétence dépend de la catégorie proposée « X » : acceptez-la avant, ou avec elle » ;
- avec `withDependencies`, la catégorie est acceptée d'abord, sous le même verrou. La valeur finale de la compétence est contrôlée avant (assainissement, intégrité, schéma, sur une bibliothèque qui contient la catégorie en mémoire) : une compétence refusée ne laisse pas sa catégorie acceptée. L'interface envoie `withDependencies` dès que la carte affiche une dépendance en attente, ou que « modifier puis accepter » rattache la compétence à une catégorie en attente.

Si la catégorie a été rejetée, la compétence reste en attente : pas de rejet en cascade. Son acceptation renvoie `NOT_APPLICABLE`, « la catégorie proposée « X » a été rejetée : modifiez puis acceptez avec une autre catégorie », et la carte l'affiche comme non applicable. L'acceptation d'une sélection est transitive : si elle dépend (`dependsOn` explicite de `propose_selection`) d'une compétence en attente, cette compétence est acceptée avec sa catégorie en attente. Une sélection ne peut pas ajouter elle-même une compétence en attente : `add` n'accepte que des éléments validés.

L'acceptation en lot traite d'abord les nouvelles catégories, puis les autres propositions de bibliothèque, puis les sélections. Toute proposition dont une dépendance ouverte est hors du lot est laissée de côté, quel que soit son type ; l'écran « À valider » l'exclut du lot de la même façon.

Une catégorie acceptée s'ajoute en fin de collection. L'ordre des groupes de compétences du CV suit celui de la bibliothèque, et l'interface ne réordonne pas encore les catégories.

### Écran « À valider »

- Une catégorie s'affiche en carte « Nouvelle catégorie », cible « Nouvel élément : Catégorie « … » », et se modifie avec le formulaire des catégories.
- Une compétence dépendante est applicable, avec le motif « acceptée avec la catégorie proposée « X » dont elle dépend ». Sa ligne « Catégorie » affiche le libellé suivi de « (en attente) », jamais l'identifiant brut.
- Dans « modifier puis accepter », le menu des catégories d'une compétence ajoute un groupe « En attente de validation ». `GET /api/proposals` renvoie pour cela `pendingCategories` (toutes les catégories en attente, quel que soit le filtre `?ids=`), et le contrôle en direct (`POST /api/library/skills/check`) accepte `withPendingCategories`.

Aucune route nouvelle : NF-01, `security()` et `PasskeyAuth.gate()` ne changent pas.

### Écritures

À la proposition, rien n'est écrit hors de `proposals/<ULID>.json` et `ids.json`. L'acceptation d'une catégorie n'écrit que `library/categories.json` et la résolution de sa proposition.

### Décisions tranchées

| Question                                          | Choix                                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Format des identifiants                           | `cat-<slug>`, comme dans l'interface ; aucun cas particulier dans `allocateIdIn`          |
| Catégorie et compétences dans le même appel       | refusé avec un indice : deux appels                                                       |
| Libellé obligatoire                               | au moins une langue, contrôlé par le store ; schéma inchangé                              |
| Catégorie rejetée avec des compétences en attente | les compétences restent en attente, non applicables, à corriger ; pas de rejet en cascade |
| Catégorie proche de « Normes et réglementation »  | simple consigne dans la skill : seule `reglementaire` alimente la section Normes          |
| Position d'une catégorie acceptée                 | en fin de collection                                                                      |
| `reviewUrl`                                       | inclut les dépendances ouvertes                                                           |
| `propose_edit` vers une catégorie inconnue        | refusé à la proposition (changement de contrat de MCP-16)                                 |
| `itemId` dans les vues de l'interface             | non : seul `list` du MCP le renvoie                                                       |

## Tests

- `packages/core/test/proposals.test.ts` : schéma (dont le refus de `tags`), application (ajout, identifiant déjà utilisé, idempotence, collection incompatible, identifiant conservé en « modifier puis accepter »), `describeTarget`, `openCategoryProposals`, `requiredCategory`.
- `packages/store/test/propose-category.test.ts` : proposition dictée, refus (sans `userStatement`, en source `offre`, libellé vide, emoji) sans consommer d'identifiant, doublons (bibliothèque en FR et en EN, en attente, même envoi), compétence dépendante, catégorie inconnue ou du même appel refusée, `proposeEdit` du champ `category`, acceptation (`DEPENDENCY_PENDING`, `withDependencies`, catégorie rejetée puis « modifier puis accepter » vers `outils`, « modifier puis accepter » vers une catégorie en attente, compétence refusée sans catégorie acceptée), `propose_edit` du champ `category` accepté avec sa catégorie ou écarté du lot, sélection qui dépend d'une compétence en attente (transitivité), lot dans le désordre et dépendance hors du lot, empreinte de tout `data/`.
- `apps/mcp/test/lot5.test.ts` : `propose_item` de type `category`, `itemId` dans `structuredContent` et dans le texte, compétence dépendante et `reviewUrl`, doublon en attente, `propose_edit` du champ `category`, `list` avec `itemId`.
- `apps/mcp/test/inmemory.test.ts` et `lot6.test.ts` : instructions de 2 048 caractères au plus, étape 3 du prompt `importer-mon-cv`.
- `apps/server/test/proposals-category.test.ts` : vues (dont un `propose_edit` du champ `category`), `pendingCategories` malgré `?ids=`, 409 puis 200 avec `withDependencies` (dont « modifier puis accepter » vers une catégorie en attente), lot dans le désordre, catégorie rejetée, catégorie acceptée puis supprimée (« catégorie inconnue »), contrôle avec `withPendingCategories`, 403 sans jeton.

Toutes les propositions de ces tests sont créées sur une copie de la persona fictive `courte` ; aucune fixture n'est ajoutée dans `fixtures/proposals/`.

## Conséquences

- **Cahier v1.8** : F-PRO-01, F-PRO-03, F-IMP-04, MCP-05, MCP-15, MCP-16, §7.3 (`importer-mon-cv`).
- **Skill** `ajouter-mon-cv` : procédure en deux appels (catégorie, puis compétences avec `category` = `itemId`), identifiants `cat-…`, clé de doublon d'une catégorie.
- **Contrat** : `propose_edit` refuse désormais à la proposition une catégorie inconnue, jusqu'ici refusée seulement à l'acceptation.
- **Normes** : une catégorie proposée « Réglementation » n'alimente pas la section Normes, qui reste liée à `reglementaire`. La skill le rappelle.
- **Risques** : un identifiant de catégorie rejetée reste consommé. La suppression d'une catégorie dans l'interface ignore les propositions en attente qui la visent : elles deviennent non applicables, avec le motif « catégorie inconnue : … » (le motif « a été rejetée » est réservé à une catégorie rejetée ou remplacée). L'interface n'a pas de test automatique : ses changements ne sont couverts que par `npm run typecheck` et la recette manuelle (`npm run dev:demo`).
- **Mise en ligne** : en local, `npm run build:mcp` puis `/mcp` ; pour le VPS, `npm run deploy` (YubiKey) puis `/mcp`. D'ici là, Claude Desktop et l'instance en ligne refusent le type `category`. L'archive `ajouter-mon-cv.zip` de Claude Desktop (`out/skills/`, hors dépôt) est à régénérer après la mise en ligne.
- Ni le rendu ni le contrôle ATS ne changent : `npm run test:ats` n'est pas requis.
