# ADR 0015 — Imports (LinkedIn, CV) et CV bilingue

- **Date** : 06/10/2026
- **Statut** : accepté
- **Contexte** : lot 6 ; F-IMP-01 à 05, MCP-08, MCP-14, MCP-21, prompt `importer-mon-cv` (§7.3), §5.2, §5.4, F-LIB-04, F-EXP-03, F-PRO-01 à 03, §7.5, §7.6, §12.2, §12.4, T-01, T-02, T-05, annexes B.1, B.4 et C. Le cahier est muet ou imprécis sur sept points, tranchés par l'utilisateur le 06/10/2026 (marqués « décision utilisateur ») ; les autres sont des choix techniques.

## Import LinkedIn (F-IMP-02, MCP-21)

### Où on le lance (décision utilisateur : les trois)

Une seule fonction, `importLinkedIn` (`packages/store/src/linkedin.ts`), sert :

- l'interface : encart « Importer l'export LinkedIn » en haut de « À valider » (`POST /api/import/linkedin`) ;
- le script `npm run import:linkedin -- [fichier] [--dry-run] [--lang en]` ;
- l'outil `import_linkedin({ fileName?, lang?, dryRun? })`.

`fileName` désigne un ZIP ou un CSV attendu de `import/`. Sans `fileName`, ce sont tous les CSV attendus posés à la racine de `import/`. Les fichiers se désignent par leur nom seulement (§7.6).

### Lecture

- **ZIP en mémoire** (fflate, déjà figé) :
  - il n'est jamais extrait sur le disque ;
  - seuls les CSV attendus du **premier niveau** sont décompressés ; une entrée imbriquée (`Jobs/Positions.csv`) ou inattendue (`Connections.csv`) est ignorée, et seul son nom figure dans le rapport ;
  - le ZIP est poussé au décompresseur par blocs de 4 Ko, et le total décompressé est compté au fil de l'eau. Au-delà de **20 Mo**, l'import s'arrête : une bombe de décompression est stoppée après quelques mégaoctets. Le fichier ZIP lui-même est limité à 100 Mo (un export « complet » contient d'autres fichiers, jamais lus).
- **CSV** : lecteur RFC 4180 écrit pour le projet (guillemets, guillemets doublés, retours à la ligne dans un champ, BOM, CRLF), dans `packages/core/src/linkedin.ts`, sans dépendance.
- **Colonnes associées par nom**, sans tenir compte de la casse ni du BOM. L'en-tête est la première des cinq premières lignes qui nomme une colonne attendue (certains exports commencent par une note).
  - Les colonnes inconnues sont **journalisées** dans le rapport (« Profile.csv : Industry »).
  - Birth Date, Address, Zip Code et Maiden Name sont **ignorées** : leurs valeurs ne quittent jamais le lecteur CSV (test : aucune ne figure dans les lignes lues).
- **Fichiers et colonnes attendus** : ceux du cahier. Pour `Projects.csv`, `Email Addresses.csv` et `PhoneNumbers.csv`, dont le cahier ne donne pas les colonnes, celles de l'export connu :

  | Fichier               | Colonnes attendues                               |
  | --------------------- | ------------------------------------------------ |
  | `Projects.csv`        | Title, Description, Url, Started On, Finished On |
  | `Email Addresses.csv` | Email Address, Confirmed, Primary, Updated On    |
  | `PhoneNumbers.csv`    | Extension, Number, Type                          |

  Ces colonnes restent **à confirmer** sur l'export réel (procédure plus bas).

### Valeurs

- **Dates** :
  - `Jan 2020` → `2020-01` ; `2015` → `2015` ; une fin vide → en cours ;
  - toute autre valeur est une **date à vérifier** (décision utilisateur) :
    - si elle contient une année, l'année seule est gardée (jamais un mois inventé), et la valeur brute est conservée dans un contrôle `date-to-verify`, affiché en tête de la carte ;
    - sans année, un début obligatoire (expérience) rend l'élément incomplet : il n'est pas proposé, et le rapport le liste avec la valeur brute ;
    - sans année, une date facultative (formation, projet, certification) est laissée vide, avec le même contrôle ;
    - **une fin illisible n'est jamais lue comme « en cours »** : expérience non proposée ; formation ou projet sans aucune date.
  - Une proposition avec `date-to-verify` est **exclue de l'acceptation en lot** (`batchExclusion`, comme un fait sensible).
- **Langues** :
  - « Native or bilingual » → `native` ; la formulation de l'export en français, « Bilingue ou langue maternelle », aussi (choix technique) ;
  - tout autre niveau → `cefr: null`, avec le contrôle `cefr-to-specify` (« niveau CECRL à préciser (LinkedIn : « Elementary proficiency ») ») ;
  - le code ISO et les deux noms viennent d'une table écrite pour le projet (54 langues). Une langue absente de la table n'est pas proposée : elle figure dans les incomplets.
- **Lieu** (« Lyon, Auvergne-Rhône-Alpes, France ») : ville = première partie, pays = dernière, s'il figure dans une table FR/EN de 33 pays. Sinon, le lieu est laissé vide, avec le contrôle `location-to-verify` et la valeur brute.
- **Descriptions en puces** (décision utilisateur : lignes, puis phrases) :
  - découpage par lignes et marqueurs (•, -, \*, –, ·, « 1. »…) ;
  - un morceau de plus de 200 caractères est redécoupé aux fins de phrase, regroupées jusqu'à 200 ;
  - une phrase seule de plus de 200 caractères est gardée entière : `max-length` passe en **avertissement** pour un import déterministe (`lengthLevel: 'warning'`), car c'est le texte de l'utilisateur.
- **Emoji** (fréquents sur LinkedIn) : l'annexe B.1 les refuse à la saisie. Dans un import, ils sont **retirés** et signalés (`removed-characters`), plutôt que de faire perdre l'élément entier.
- **Langue des textes** : `lang` (français par défaut). L'autre langue vaut `null`, donc « non traduit » (F-LIB-04), ce qui alimente F-IMP-05.
- **Compétences** : catégorie suggérée, avec le contrôle `category-to-verify` :
  - `reglementaire` pour un terme de l'annexe A ;
  - sinon `langages`, `methodes` ou `outils` selon le vocabulaire tech, désormais rangé par nature (`TECH_KIND`) ;
  - sinon la première catégorie de la bibliothèque.
- **Incomplets**, non proposés et listés : expérience sans entreprise, sans intitulé ou sans date de début ; formation sans établissement ou sans diplôme ; certification sans organisme ; langue inconnue.
- **Source de référence des garde-fous** (annexe C) : les textes de la ligne CSV, dates comprises.

### Identité (décision utilisateur : préremplissage)

Prénom, nom et ville (`Profile.csv`), l'e-mail principal et le premier téléphone ne deviennent pas des propositions. Le schéma n'a pas de proposition d'identité, et en créer une aurait demandé un nouveau type.

- Le rapport du MCP dit seulement quels champs sont trouvés, **jamais leurs valeurs**.
- Dans l'interface, le formulaire d'identité a un bouton « Préremplir depuis l'export LinkedIn ». Le serveur relit l'export à la demande (`GET /api/import/linkedin/identity`, jeton exigé) ; rien n'est stocké. Seuls les **champs vides** sont remplis, et rien n'est enregistré sans le clic de l'utilisateur.
- Le titre (Headline) et l'accroche (Summary) deviennent des propositions `title` et `summary`.

### Essai à blanc et colonnes de l'export réel (décision utilisateur : `dryRun`)

`dryRun` lit l'export sans rien écrire. Il ne renvoie que des noms et des comptages :

- les fichiers et leurs colonnes : attendues, inconnues, ignorées, absentes ;
- le nombre de lignes ;
- par colonne de date, le nombre de valeurs de chaque format (`MMM AAAA`, `AAAA`, vide, autre) ;
- pour les langues, le nombre de niveaux natifs et de niveaux à préciser.

Aucune valeur ne figure dans la réponse (test). Avec l'accord de l'utilisateur, `import_linkedin({ fileName, dryRun: true })` sur son export confirme les colonnes du cahier. Il peut aussi lancer lui-même `npm run import:linkedin -- <fichier> --dry-run` (README). Tant que ce n'est pas fait, le point **[à vérifier]** de F-IMP-02 reste ouvert.

## Dédoublonnage et propositions (F-IMP-04 ; décision utilisateur : élément rattaché)

`propose_item` (Claude) et l'import LinkedIn passent par la même fonction, `commitCandidates` (`packages/store/src/propose.ts`) : assainissement, validation, dédoublonnage, garde-fous, identifiants réservés dans `ids.json`, écriture des propositions. Clés de l'ADR 0014. Le dédoublonnage se fait :

- **contre la bibliothèque** :
  - expérience, formation ou projet avec des puces nouvelles : un **complément**, c'est-à-dire une proposition `item` avec `duplicateOf` (le champ existait au schéma). Son acceptation n'ajoute que les puces absentes de l'élément validé ; l'organisation, l'intitulé, les dates et les autres champs restent ceux de la bibliothèque. Sa base est l'élément visé, d'où l'état `stale` et le conflit en trois colonnes ;
  - une puce **proche** d'une puce existante (Jaccard des mots pleins ≥ 0,6, même langue) devient une `variant` de cette puce, de libellé `linkedin` ou `cv` ; une puce identique est ignorée ;
  - compétence : ses nouvelles formes deviennent des `alias` (ADR 0014) ;
  - autre élément : `duplicateOf`, sans proposition ;
- **contre les propositions en attente** : `duplicateOf` = l'ULID de la proposition, **sans rien créer** (T-02). La consigne est de l'accepter ou de la rejeter d'abord ;
- **contre les éléments du même envoi** (« Python » deux fois dans `Skills.csv`) : `duplicateOf` = la proposition créée pour le premier.

Un objet bilingue envoyé sans l'une des langues (`{ fr: "…" }`) est complété par `null` : une traduction manquante vaut `null` (§9.3), ce n'est pas une erreur.

## Import du CV par Claude (F-IMP-03, MCP-08)

- **`get_import_file_text({ fileName })`**, en lecture seule :
  - texte d'un fichier de la racine de `import/` : PDF par pdf.js (unpdf), DOCX par mammoth, `.md` et `.txt` tels quels ;
  - réponse : `{ text, pages, hasTextLayer }`, plus `truncated` (30 000 caractères au plus), les phrases de consigne signalées et le nonce ;
  - le texte passe par `cleanUntrusted`, puis est marqué `<untrusted source="import">` ; e-mail et téléphone sont masqués comme dans toute réponse ;
  - un ZIP ou un CSV renvoient vers `import_linkedin`.
- **Couche texte** : un PDF a une couche texte s'il en sort au moins 30 lettres. Un PDF scanné renvoie `hasTextLayer: false`, un texte vide et « joignez le fichier directement dans la conversation, ou fournissez le DOCX ». `list({kind: import_files})` utilise la même fonction (`extractImportText`, `packages/render/src/import-text.ts`). Pour un DOCX, `pages` est le nombre enregistré par Word (`docProps/app.xml`), sinon `null`.
- **`propose_item` avec `sourceFile` PDF ou DOCX** : le texte extrait est la source de référence (annexe C). Le store ne dépend pas de render : le serveur MCP lui transmet la fonction de lecture (`readImportText`). Un PDF scanné est rejeté avec le même message.
- **Prompt `importer-mon-cv`** (étapes 1 à 5 du §7.3) :
  - l'argument `fileName` est un nom de fichier nu de `import/` (`^[\w .()-]+\.(pdf|docx|md|txt)$`) : ni chemin, ni texte libre ;
  - **une PAUSE est ajoutée à l'étape 4**, avant les traductions. Un élément proposé n'est pas encore dans la bibliothèque, et `propose_translation` ne vise que des champs validés : l'utilisateur valide d'abord ;
  - un CV joint dans la conversation sans être dans `import/` : Claude demande de l'y déposer, sinon il propose en source `dictee`, avec le passage recopié et l'accord de l'utilisateur.

## Traductions (F-IMP-05, MCP-14)

- **`propose_translation({ items: [{ target, lang, text, rationale? }] })`**, 25 au plus. La cible est celle que renvoie `list({kind: untranslated})` : `{ collection, itemId, bulletId?, variantId?, field }`.
- **Refus** :
  - une langue déjà remplie (« déjà traduit », ADR 0010 : rien n'est écrasé) ;
  - un champ vide dans les deux langues, une cible inconnue, un élément archivé ;
  - un champ de l'identité : il se traduit dans l'interface, car les propositions ne visent que la bibliothèque.
- **Doublon** : une traduction en attente pour la même cible (ou dans le même envoi) renvoie `duplicateOf`.
- **Source de référence** (annexe C) :
  - toutes les variantes FR et EN de la puce, du titre ou de l'accroche ;
  - pour un autre champ, tous les champs bilingues de l'élément ;
  - plus `bullet.skills`, `item.skills`, et la compétence elle-même pour sa forme longue.
  - Pas de similarité : les deux textes sont dans des langues différentes.
- **Provenance** : nouvelle valeur `bibliotheque` du champ `source` (ajout au schéma, rétrocompatible). Aucune des quatre valeurs du cahier ne décrit une traduction de contenu validé.
- **Repère de niveau** (§5.4) : « EQF level 7 » (ou « niveau 7 du CEC ») est un code, pas un chiffre nouveau. Sans cela, l'équivalence demandée par le §5.4 serait rejetée.

## CV en anglais (§5.4)

- **Champs non traduits** : le motif `UNTRANSLATED` de `exportBlockers` porte désormais **la liste complète** (`fields`). Chaque champ a un libellé (« intitulé », « puce (variante principale) »…) et son correctif. L'interface affiche un lien par champ, avec l'élément et le début du texte de la puce. Le lot 3 n'ouvrait que le premier (ADR 0012).
- **Orthographe contrôlée** (décision utilisateur : avertissement) :
  - `packages/core/src/text/en-spelling.ts` contient une liste rédigée pour le projet, 736 formes : -ise/-ize ciblés, -yse/-yze, -our/-or, -re/-er, licence/license, defence, -ll-/-l-, programme, catalogue, analogue, ae/oe médicaux, grey, aluminium… ;
  - les formes américaines également britanniques (« program » pour un logiciel, « meter » pour un appareil, « catalog ») ne sont signalées qu'en en-US ; « analyses », pluriel de « analysis », n'est jamais signalé ;
  - la bibliothèque n'a qu'un texte anglais pour les deux variantes : l'écart est un **avertissement** `SPELLING_VARIANT` de la projection, avec la cible. Il s'affiche en orange sous l'état d'export, champ par champ et avec son lien, et figure dans le rapport du MCP. Ce n'est pas un critère ATS (ce n'est pas de la lisibilité), et il ne bloque pas.
- **Permis** (décision utilisateur : texte généré) : en FR et en en-GB, le texte saisi (`identity.drivingLicense`, en-GB : « Full driving licence (category B) ») ; en en-US, la projection génère « Driver's license » (`US_DRIVING_LICENSE`), jamais « Class B ». Le schéma ne change pas.
- **Letter et `Resume_`** (lots 2 et 3) : vérifiés par `test:ats` (page de 612 × 792 pt dans le PDF, 12240 × 15840 twips dans le DOCX, nom `Resume_…`) et par T-05.

## Interface

- **« À valider »** :
  - encart d'import (fichier, langue des textes, rapport : propositions, doublons, incomplets, rejets, colonnes inconnues et ignorées, dates à vérifier, langues sans niveau, identité trouvée) ;
  - carte « Complément d'un élément » (puces existantes, puces ajoutées) ;
  - badges « date à vérifier » et « niveau CECRL à préciser », remarques de l'import en clair ;
  - provenance « bibliothèque » ;
  - l'acceptation en lot exclut les dates à vérifier (`batchExcluded` dans la vue).
- **Bibliothèque** : badge « niveau CECRL à préciser » sur une langue sans niveau.
- **Identité** : bouton de préremplissage.
- **Export** : liste des champs non traduits et avertissements d'orthographe, chacun avec son lien.

## Vérifications

- **`test:ats`** : `courte`, `pieges` et `debordante` en FR, en-GB et en-US, plus `courte` avec photo en FR ; refus attendu de `debordante` dans les trois. Remplissage : `courte` 61 / 61 / 65 %, `pieges` 58 / 59 / 60 %, `debordante` 127 / 125 / 134 %. Les trois personas étaient déjà entièrement traduites : aucune traduction n'a été ajoutée.
- **Tests** :
  - `packages/core/test/linkedin.test.ts` : CSV, colonnes par nom, BOM, inconnues, champs ignorés, dates, langues, lieu, puces, emoji, candidats de l'export fictif ;
  - `packages/core/test/bilingual.test.ts` : orthographe en-GB/en-US, permis, `Resume_`, avertissement avec sa cible, liste des champs non traduits, EQF, longueur ;
  - `packages/store/test/linkedin.test.ts` : premier niveau, limite de 20 Mo (bombe), CSV directs, périmètre, essai à blanc sans valeur, compléments, variantes, doublons de la bibliothèque, des propositions en attente et du même fichier, acceptation en lot, traductions ;
  - `packages/render/test/import-text.test.ts` : PDF, DOCX, PDF scanné ;
  - `apps/mcp/test/lot6.test.ts` : §12.4 sur les nouveaux outils ;
  - `apps/server/test/import.test.ts` : NF-01 sur les routes d'import ;
  - `apps/mcp/test/t01-t02-t05.test.ts` : T-01, T-02 et T-05 de bout en bout, un client MCP en mémoire jouant Claude, l'acceptation passant par l'API.
- **Navigateur** (`dev:demo`, 06/10/2026) :
  - import depuis l'encart : 13 propositions, rapport complet ;
  - rejet et acceptation dans l'interface ;
  - une proposition créée par un autre processus (serveur MCP compilé, lancé sur la copie de démo) arrive en direct, sans recharger ;
  - Allemand accepté sans niveau : badge dans la bibliothèque, export bloqué avec « Ouvrir « Allemand » » ;
  - en EN-GB, les trois champs non traduits sont listés, et chaque lien ouvre la puce visée ;
  - préremplissage de l'identité.

## Propositions de correction du cahier

- **F-IMP-04** : « S'il existe un doublon d'un élément validé, le serveur renvoie `duplicateOf` et propose ses puces nouvelles en complément (`item` avec `duplicateOf`, qui n'ajoute que des puces), une puce proche en `variant`, une forme nouvelle de compétence en `alias`. Un doublon d'une proposition en attente renvoie `duplicateOf` sans rien créer. » Remplace la précision proposée par l'ADR 0014.
- **§9.2 et F-PRO-01** : documenter `payload.duplicateOf` d'une proposition `item` (complément) ; ajouter `bibliotheque` aux valeurs de `source` (F-PRO-02).
- **F-IMP-02** :
  - colonnes de `Projects.csv`, `Email Addresses.csv` et `PhoneNumbers.csv` (tableau ci-dessus) ;
  - « Bilingue ou langue maternelle » → `native` ;
  - une date illisible garde son année et la proposition s'accepte seule ; une fin illisible n'est jamais « en cours » ;
  - les emoji sont retirés et signalés ;
  - un mode `dryRun` (noms de colonnes et comptages) ;
  - `import_linkedin({ fileName?, lang?, dryRun? })`.
- **MCP-08** : ajouter `truncated`, les phrases signalées et l'indication pour un PDF scanné.
- **§7.3, `importer-mon-cv`** : « 4. PAUSE (validation des éléments), puis `list({kind: untranslated})` et `propose_translation` par lots ». L'argument est un nom de fichier de `import/`.
- **Annexe C** :
  - source de référence d'une traduction d'un champ hors variantes : les champs bilingues de l'élément ;
  - « EQF level N » est un code ;
  - `max-length` est un avertissement pour un import déterministe.
- **§5.4** : préciser que l'orthographe contrôlée est un avertissement (un seul texte anglais pour les deux variantes) et que la ligne du permis en en-US est générée.

## Conséquences

- **Aucune dépendance ajoutée** : fflate, pdf-lib, docx, sharp, unpdf et mammoth étaient déjà figés (ADR 0001). `scripts/make-fixture-imports.ts` les utilise pour produire les fixtures.
- `fixtures/imports/` : export LinkedIn fictif (CSV et ZIP), CV fictif en PDF, DOCX et PDF scanné. `npm run dev:demo` les copie dans son `import/`.
- **Poppler** n'est toujours pas installé sur ce poste : `test:ats` passe avec `ATS_SINGLE_EXTRACTOR=1`, rapport « incomplet ».
