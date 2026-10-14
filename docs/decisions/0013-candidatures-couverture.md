# ADR 0013 — Candidatures, analyse de l'offre et couverture

- **Date** : 05/10/2026
- **Statut** : accepté
- **Contexte** : lot 4 ; F-CAN-01 à 03, F-OFF-01 à 04, ATS-19, F-UI-04 (sans la lettre), §6.4, §6.8, §7.5, §8.4, §9.1 à 9.3, annexes A, B.3 et B.4. Le cahier est muet ou imprécis sur cinq points, tranchés par l'utilisateur le 05/10/2026 (marqués « décision utilisateur »).

## Identifiant d'une candidature (décision utilisateur : format du §9.2)

`<AAAA-MM-JJ>-<entreprise>-<poste>`, par exemple `2026-10-12-acme-medical-ingenieur-logiciel-dispositifs` :

- la date est la date locale de création ;
- l'intitulé est pris sans marqueur de genre (annexe B.4) et translittéré ;
- l'identifiant fait 60 caractères au plus, coupé en fin de mot ;
- il prend un suffixe `-2`, `-3`… s'il est déjà pris.

Il est attribué par le serveur et consigné dans `ids.json` (genre `application`), et n'est jamais réutilisé. Un dossier laissé à la main sous le même nom est enjambé.

Ce format est une **exception au préfixe `app-` de l'ADR 0005**. Le dossier `applications/` dit déjà le type, et la date range les dossiers par ordre chronologique dans l'explorateur. `ID_PREFIX.application` reste défini, mais il ne sert pas.

## Création (F-CAN-01)

- **Champs** :
  - l'entreprise, l'intitulé du poste et le preset de départ sont obligatoires ;
  - la référence et l'URL sont facultatives ;
  - la langue est FR, EN-GB ou EN-US ;
  - le `fileLabel` est proposé à partir de l'intitulé, sans marqueur de genre (`proposeFileLabel`), et reste modifiable.
- **Validation** : chaque champ est assaini puis validé (`prepare`), et une erreur désigne son champ. Un refus ne consomme pas d'identifiant.
- **Offre** : on donne exactement l'une des deux sources, le texte collé ou un fichier de `import/offres/`. Elle est obligatoire au lot 4 ; le lot 5 pourra assouplir MCP-09.
- **Fichiers créés**, sous le verrou unique :
  - `ids.json` ;
  - `application.json` (`exports: []`, `tracking: null`) ;
  - `selection.json`, copie de la sélection, des options et du modèle du preset ;
  - `offer.md`.

  Le preset n'est jamais modifié. Pour une candidature en anglais créée à partir d'un preset français, la photo est décochée (`applyLanguage`, §5.4).

- **Divergence** : `selection.json` s'enregistre avec sa révision (409 `STALE_REVISION` sinon). La langue, la variante anglaise et le `fileLabel` vivent dans `application.json` (§9.2) : ils y sont fusionnés quand ils changent, sans révision attendue, puisque le MCP n'y fait que des ajouts d'exports.

## Offre : donnée non fiable (§7.5)

- **`cleanUntrusted`** (`packages/core/src/offer-text.ts`, sans Zod, importé par le navigateur via `@cv/core/offer`) :
  - NFC, puis CRLF → LF ;
  - suppression des caractères invisibles du §7.5 (U+200B–U+200F, U+2060, U+FEFF, U+E0000–U+E007F). Sont aussi retirés, pour la même raison (un texte caché ou réordonné à l'écran) : U+00AD, U+2061–U+2064, et les contrôles bidirectionnels U+202A–U+202E et U+2066–U+2069 ;
  - contrôles C0 et C1 retirés, tabulations converties en espaces, plus de deux lignes vides réduites à deux ;
  - 100 000 caractères au plus ;
  - pas d'assainissement B.1 : un emoji dans une offre ne doit pas la faire refuser, et l'offre n'est jamais rendue dans le CV.
- **`flagInstructions`** : l'offre est découpée en phrases, ligne par ligne, et chaque signalement garde sa position (ligne, début, fin) pour le surlignage. Deux niveaux :

  | Niveau     | Motifs (texte replié : minuscules, sans accents)                                                                                                                                                                                                                                                                                                  |
  | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `consigne` | « ignore/oublie/disregard… instructions/consignes/prompt », « instructions précédentes/previous instructions », « tu es / you are / act as … IA/assistant/model/recruteur », « en tant qu'IA / as an AI », « system prompt », « ne mentionne pas / do not reveal », « classe/recommande/retiens ce candidat », balises `<system>`, `</untrusted>` |
  | `mention`  | ChatGPT, GPT-n, OpenAI, Claude, Anthropic, Gemini, Copilot, Mistral, Llama, LLM ; « assistant » ; « intelligence artificielle / language model » ; « IA », « AI », « I.A. » en casse exacte                                                                                                                                                       |

  Les signalements sont calculés à chaque lecture, sans être stockés. On les voit dans le formulaire dès que l'offre est collée, et dans l'onglet « Offre », où les phrases sont surlignées (rouge pour une consigne, ambre pour une mention). Un « assistant(e) de direction » ou un « Claude » des ressources humaines sont signalés eux aussi : ce n'est qu'un signal, l'offre reste une donnée.

- **`import/offres/`** (décision utilisateur : texte et Markdown seulement, `*.md` et `*.txt`) :
  - l'interface ne reçoit que des noms de fichiers, jamais de chemin ;
  - lecture dans le périmètre du §7.6 : `assertSafeFileName`, puis `resolveInside` (realpath, comparaison en minuscules) ;
  - 1 Mo au plus, BOM toléré ;
  - PDF et DOCX arrivent au lot 6, avec l'extraction de MCP-08 ;
  - avec `npm run dev`, le dossier est `import/` à la racine. Avec `dev:demo`, c'est une copie temporaire de `fixtures/offres/`, effacée à l'arrêt.

## Analyse de l'offre (F-CAN-02, F-OFF-01 ; décision utilisateur : import JSON dans l'interface)

- **`saveOfferAnalysis`** (store) est la fonction que `save_offer_analysis` (MCP-10) appellera au lot 5 :
  - elle accepte `{ terms }` ou la forme de `analysis.json` (`{ current: { origin, terms } }`) ;
  - chaque terme est assaini puis validé ;
  - un terme dont la `sourceSentence` normalisée (`normalizeForMatch`, comparaison à la frontière de mot) n'est pas une sous-chaîne de `offer.md` est **rejeté**, avec son motif ;
  - les autres termes sont enregistrés. Si aucun terme ne passe : 422.
- **Historique** : l'analyse courante passe dans `history` (de la plus ancienne à la plus récente) et rien n'est supprimé. `createdAt` est la date de l'enregistrement. `origin` vaut celle du fichier (`claude`), sinon `utilisateur`.
- **Interface** : bouton « Importer une analyse (JSON) » dans le panneau Couverture. Les termes rejetés sont listés. L'historique se consulte terme par terme, avec la phrase source affichée comme une citation marquée « non fiable ». Un `analysis.json` déposé à la main est aussi pris en compte en direct (SSE).
- **Fixture** : `fixtures/analyses/analyse-logiciel-dm.json` passe de 7 à 11 termes, tous tirés de l'offre « logiciel DM », pour couvrir les trois groupes.

## Couverture (F-OFF-02 à 04)

**Où (recommandation retenue)** : sur le serveur, à chaque rendu de l'aperçu. `POST /api/render { applicationId, draft }` renvoie `coverage`, calculée par `computeCoverage` (`packages/core/src/coverage.ts`) sur `projection.expected`, c'est-à-dire le texte projeté de la sélection effective, la même projection que le PDF. Le navigateur n'a pas la projection. Le MCP du lot 5 (`preview_selection`, `save_offer_analysis`) réutilisera la même fonction.

**Mesure** (05/10/2026, `dev:demo`) : 67 à 115 ms par requête de rendu, couverture comprise. Avec l'anti-rebond de 250 ms, NF-04 est tenu.

### Texte comparé

Les champs de `projection.expected`, sauf le nom, les coordonnées, les intitulés de section, les plages de dates et la mention de références. Chaque champ connaît sa section, et les compétences liées à son élément (`skills` de l'entrée et de la puce).

### q = 1, q = 0,9

- **q = 1** : la forme exacte du terme, comparée par suite de mots après `normalizeForMatch` (annexe B.3). Une norme canonisée compte comme forme exacte : `CEI 62304` est `IEC 62304`.
- **q = 0,9** : un équivalent strict, c'est-à-dire :
  - un alias de l'analyse ;
  - toutes les formes (`short`, `aliases`, `long` FR et EN) de la compétence de la bibliothèque dont l'une des formes est le terme ;
  - toutes les formes de l'entrée de l'**annexe A** correspondante (nouveau `packages/core/vocab/annex-a.ts`, prévu par le §8.2).

  Exemple : « test-driven development » est couvert à 0,9 par « TDD ».

- **Jamais** un `related`.
- Un terme en double (même forme normalisée) ne compte qu'une fois, avec son poids le plus fort.

### Règles de B.3 (précisions)

- **Sigles ambigus** (`C`, `R`, `Go`, MDR, DM, CE, PMS, SAC, RA, et toute compétence `ambiguous: true`) : ils se comparent en casse exacte, jamais dans « classe X ».
- **Contexte DM** : un sigle ambigu du DM ne compte que dans trois cas :
  - le terme a `domain: dm` ;
  - l'offre contient sa forme longue (annexe A ou compétence de la bibliothèque) ;
  - l'offre contient un **autre terme de l'annexe A propre au DM**.

  Ces termes sont toutes les formes non ambiguës des entrées marquées `dmContext`. Sont exclus, car d'autres secteurs les emploient : documentation technique, V&V, IQ/OQ/PQ, CAPA, AMDEC, affaires réglementaires, RA/QA, audit interne, traçabilité des exigences, ISO/IEC 27001, HDS, RGPD, AI Act. Hors contexte DM, les équivalents de la bibliothèque et de l'annexe A ne s'appliquent pas non plus : le « MDR » d'une offre de cybersécurité (_Managed Detection and Response_) n'est pas le règlement.

- **Sigles d'une ou deux lettres** : ils ne comptent que dans la section Compétences (ligne des normes comprise), ou « dans `skills` ». Nous lisons « dans `skills` » ainsi : dans un élément dont les `skills` pointent vers une compétence de même sigle. « en C sur microcontrôleur » compte dans une puce liée à `sk-c`, pas dans l'accroche.
- **Note de non-comptage** : quand une occurrence est écartée par l'une de ces règles, le terme l'affiche (« sigle ambigu… », « sigle court… »).
- **Écart d'édition** (B.3 étape 9) : il ne change pas la couverture. Il est signalé à part quand la forme du terme porte une édition différente de celle trouvée dans le CV.

### Groupes des termes manquants (F-OFF-03)

- **(a)** Le terme se trouve, sous sa forme exacte ou sous un équivalent, dans un élément non archivé que la sélection n'affiche pas :
  - élément non coché ;
  - section désactivée ;
  - variante non choisie ;
  - autre titre ou autre accroche.

  « Cocher l'élément » applique le correctif prêt à l'emploi : `setChecked`, qui active la section et l'entrée ; pour une compétence réglementaire en `skills-subgroup`, la section Compétences ; la variante ; ou le titre et l'accroche. On garde trois éléments au plus, en commençant par la forme exacte.

- **(b)** Ni affiché ni présent ailleurs, mais :
  - c'est le `related` d'une compétence (il ne compte jamais ; un alias strict compterait) ;
  - ou bien c'est un **autre libellé** : tous les mots pleins du terme figurent dans un même champ, à une terminaison près (-e, -s, -es, -x : « Ingénieure » pour « Ingénieur »).

  Les sigles ambigus n'ont pas d'« autre libellé », parce qu'un sosie est justement ce qui ne doit pas compter.

- **(c)** Le reste, avec la mention « à n'ajouter que si c'est vrai ; sinon, à garder pour la lettre ou l'entretien ».

### Formule et niveau (seuils confirmés, §15 point 3)

Couverture = Σ w·q / Σ w, avec w = 3 (titre), 2 (requis), 1 (souhaité). La formule s'affiche avec ses valeurs : « 9 / 17 = 52,9 % ».

Les seuils du cahier sont **confirmés** : faible < 40 % ≤ moyen < 60 % ≤ bon < 80 % ≤ fort. Sur l'offre fictive « logiciel DM » et la persona `courte` :

- 52,9 % (moyen) avec le preset ;
- 63,5 % (bon) après « cocher l'élément » sur le groupe (a) ;
- 81,2 % (fort) en reprenant en plus l'intitulé du poste comme titre (ATS-19, s'il est exact).

Les niveaux restent lisibles et ne poussent pas au bourrage de mots-clés. On affiche « Niveau de couverture : moyen », jamais un « score ATS » (F-ATS-04). Les seuils sont à réévaluer par un nouvel ADR après usage réel.

**Limite connue** : sans racinisation (F-OFF-07, V2), « Ingénieure » ne couvre pas un terme « Ingénieur ». Le terme tombe en groupe (b), et l'encart ATS-19 permet d'ajuster l'intitulé.

## ATS-19 (décision utilisateur : `overrides.title`)

L'encart « Titre du CV et intitulé du poste visé » montre l'intitulé de l'offre sans marqueur de genre et le titre actuel.

- Si les deux diffèrent, un champ prérempli et modifiable, et le bouton « Utiliser comme titre du CV », écrivent `selection.overrides.title[langue]`. C'est la saisie propre à la sélection prévue par le §9.2 ; la bibliothèque ne change pas. Ce n'est jamais automatique, et la consigne est de ne le faire que si l'intitulé décrit exactement le poste.
- « Revenir au titre de la bibliothèque » retire la saisie.
- Les réglages (preset et candidature) gagnent l'édition de `overrides.title` en FR et en EN. Ils la proposaient en lecture seule depuis le lot 2.

## Exports (F-CAN-03)

- **`addApplicationExport`** (store) est **la** fonction partagée par l'export de l'interface et par `render` avec `saveToApplication` (MCP-19) :
  - dossier `exports/<AAAAMMJJ-HHmmss>[-n]_<modèle>/`, créé par un `mkdir` non récursif : deux exports dans la même seconde ne partagent jamais un dossier ;
  - fichier écrit avec `wx`, relu pour son SHA-256 ;
  - trace ajoutée à `application.json` : `dir`, `file`, `kind`, `format`, `lang`, `layout`, `createdAt`, `pages`, `atsCheck`, `sha256` et `sent: false`. `atsCheck` vaut `ok` ou `avertissements` (schéma v1), puisqu'un rouge bloque l'export.
- **Remplacement** : l'ancienne copie du MCP (`copyFile`, qui pouvait écraser un fichier dans la même seconde) est remplacée. Le refus d'un `saveToApplication` sur un preset intervient désormais avant toute écriture.
- **Interface** : même déroulé qu'au lot 3 (ADR 0012) : enregistrement, aperçu à jour, motifs de blocage, recompilation de la version enregistrée, comparaison des SHA-256 (409 `PREVIEW_MISMATCH`), téléchargement du tampon affiché. Pour un PDF, le SHA-256 relu doit égaler celui de l'aperçu (`expectedSha256`) ; sinon le dossier tout juste créé est retiré, et rien n'est tracé. Les exports d'un preset restent dans `out/exports/`.
- **Onglet « Offre »** : il liste les exports de la candidature et leur trace.

## Interface (F-UI-04 sans la lettre, §10.1)

- **Écran « Candidatures »** : liste (date, entreprise, poste, langue, preset de départ, analyse, exports), formulaire de création et bouton « Ouvrir ». Les dossiers illisibles sont listés à part.
- **Barre** : `[Preset ▼] [Candidature ▼]`. Ouvrir une candidature passe l'écran de sélection en mode candidature. Choisir un preset, ou « Aucune », revient au preset. Les actions propres aux presets sont masquées en mode candidature.
- **« Preset virtuel »** : une candidature ouverte est présentée à l'interface comme un preset, construit à partir de `application.json` (langue, libellé) et de `selection.json` (sélection, options, modèle), avec la révision de `selection.json`. L'arbre, les réglages, l'aperçu, les feux, l'export, l'enregistrement automatique (250 ms) et le bandeau de conflit fonctionnent donc sans changement.
- **Panneau central** :
  - « Couverture de l'offre » : niveau et formule, encart ATS-19, groupes (a), (b) et (c), tableau des termes (poids, domaine, q, emplacement, phrase source non fiable), analyse et historique ;
  - « Réglages de la candidature ».
- **Panneau droit** : un onglet « Offre » s'ajoute.
- **En direct** : tout changement de `applications/<id>/` (sauf les fichiers d'export eux-mêmes, dont la trace est `application.json`) recharge la liste et la candidature ouverte, avec le rapprochement de l'ADR 0011. Une nouvelle analyse relance l'aperçu, donc la couverture. `writes` peut porter `revision: null` pour un fichier sans révision (`offer.md`, un export).
- **Mémorisation** : `localStorage` garde l'identifiant de la candidature ouverte (état d'interface).

## NF-01

Les nouvelles routes passent par les contrôles `Host`, jeton, `Origin` et `Content-Type` (tests) : `GET /api/offers`, `GET` et `POST /api/applications`, `GET /api/applications/:id`, `PUT /api/applications/:id/selection`, `POST /api/applications/:id/analysis`, et `POST /api/export` et `/api/render` avec `applicationId`. Aucune écriture par GET.

## Propositions de correction du cahier

- **§9.2 / ADR 0005** : noter que l'identifiant d'une candidature suit le format `AAAA-MM-JJ-entreprise-poste` (60 caractères au plus), sans préfixe.
- **Annexe B.3, étape 8** : remplacer « un autre terme de l'annexe A » par « un autre terme **propre au DM** de l'annexe A (hors documentation technique, V&V, IQ/OQ/PQ, CAPA, AMDEC, affaires réglementaires, audit interne, traçabilité des exigences, ISO/IEC 27001, HDS, RGPD, AI Act) ». Préciser « ou dans `skills` » ainsi : « ou dans un élément dont les `skills` désignent cette compétence ».
- **F-OFF-03 (b)** : préciser « présent sous un autre libellé (tous les mots pleins du terme dans un même champ, à une terminaison près) ou en `related` ».
- **§7.5** : ajouter à la liste des caractères supprimés U+00AD, U+2061–U+2064, U+202A–U+202E et U+2066–U+2069.
- **§15, point 3** : seuils de F-OFF-04 confirmés par cet ADR.

## Conséquences

- **Tests** :
  - `packages/core/test/coverage.test.ts` : formule sur l'offre « logiciel DM » (9/17), groupes a, b et c, remontée par « cocher l'élément », q = 0,9, `related`, Go, IEC 62304 (classe C), MDR d'une offre de cybersécurité, seuils, nettoyage et signalement de l'offre ;
  - `packages/store/test/applications.test.ts` : identifiant et `ids.json`, copie du preset, divergence, `import/offres/` (périmètre), historique et rejet des analyses, non-écrasement des exports ;
  - `apps/server/test/applications.test.ts` : création depuis l'offre fictive, couverture à chaque rendu, preset inchangé, exports PDF et DOCX avec trace et T-ATS-13, `PREVIEW_MISMATCH`, phrase « ignore les instructions précédentes » signalée, NF-01 ;
  - `apps/mcp/test/inmemory.test.ts` : `render` avec `saveToApplication`, deux fois dans la même seconde.
- Aucune dépendance ajoutée.
