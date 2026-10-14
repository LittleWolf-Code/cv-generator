# ADR 0017 — Modèle visuel, thèmes et recette du MVP

- **Date** : 06/10/2026
- **Statut** : accepté ; la mise en page du visuel (section « Mise en page » et photo) est remplacée par l'[ADR 0019](0019-visuel-repris-du-cv.md) ; densités (interligne, écarts) revues par l'[ADR 0020](0020-corrections-design.md)
- **Contexte** : lot 8 ; F-MOD-01, F-MOD-03, F-MOD-05, F-EXP-02, §4, §5.2, §5.3, §8.5, §12.2, §12.3 (colonne Visuel), §12.5, §12.6 (T-01 à T-08), §15 points 1 et 2, NF-10. Le cahier est muet ou imprécis sur dix points, tranchés par l'utilisateur le 06/10/2026 (marqués « décision utilisateur », toutes les recommandations retenues). **Seul changement de schéma** : l'énumération `theme.font` passe de `carlito` à trois valeurs ; les fichiers existants restent valides.

## Modèle `visuel` (F-MOD-03)

### Mise en page (décision utilisateur : deux colonnes, colonne latérale à droite)

`packages/render/templates/visuel.typ`, écrit comme `ats-classique.typ` : entièrement en mode code, **aucun texte en dur** (libellés et ponctuation viennent de la projection), mêmes réglages (`fallback: false`, `hyphenate: false`, `ligatures: false`, `tracking: 0pt`, `smartquote(enabled: false)`, `par(justify: false)`, `document(date: none)`, marges du thème, corps ≥ 10 pt).

- **En-tête** sur toute la largeur : nom en couleur d'accent (corps du nom + 4 pt), titre, coordonnées (chacune dans un `box`, séparateur en couleur d'accent), puis un filet d'accent et l'accroche.
- **Photo** : à droite de l'en-tête, coins arrondis (`box(clip: true, radius: 4pt, image(…))`), en ligne dans une grille d'en-tête : aucun `place()`. Elle passe toujours par `mapShadow`, jamais par la projection ; le MCP utilise l'image neutre (ADR 0012).
- **Deux colonnes** (`grid(columns: (1fr, 6cm), column-gutter: 0.6cm)`) : la colonne principale porte Expérience, Formation et Projets ; la colonne de droite, sur une teinte légère de l'accent, porte Compétences, Normes et réglementation, Certifications, Langues et Centres d'intérêt. Dans la colonne de droite, une ligne libellée (« Langages ») met son libellé au-dessus de ses éléments ; une ligne sans libellé (langues, normes, centres d'intérêt) met un élément par ligne.
- **Répartition** : la projection marque chaque section `side` (vrai pour les cinq sections de droite, seulement en visuel). L'ordre de la sélection est gardé dans chaque colonne ; `projection.headings` reste l'ordre de la sélection.
- **Ordre du texte extrait** (décision utilisateur) : en-tête, colonne principale, colonne de droite. Typst écrit les cellules de la grille dans cet ordre ; pdf.js et `pdftotext -raw` les lisent ainsi. Nom et coordonnées restent avant le premier intitulé : T-ATS-08 reste vert. T-ATS-06 passe à l'orange dès que l'ordre des sections de la sélection mêle les deux colonnes (cas des presets par défaut).
- **Espacement sous le nom** : pdf.js ne commence une nouvelle ligne que si le décalage vertical dépasse la moitié de la hauteur du texte précédent. Avec un nom de 24 pt et 0,4 em dessous, le nom et le titre étaient extraits sur une seule ligne (« Camille MartinIngénieure… »). 0,75 em règle le cas pour les trois polices.
- **Largeur de la colonne de droite** : 6 cm, pour que « Normes et réglementation » tienne sur une ligne en IBM Plex Sans, la plus large des trois polices.

### Couleurs (ATS-14, NF-10)

Le texte n'est jamais blanc. Le texte secondaire (organisation, lieu) est gris foncé `#4D4D4D` (8,4:1). La teinte de la colonne de droite est l'accent mêlé à 8 % de blanc ; elle n'est gardée que si l'accent et le texte secondaire y atteignent encore 4,5:1 (`sidebarTint`), sinon la colonne n'a pas de fond (filet vertical d'accent). Les six pastilles ont une teinte (6,6:1 à 8,4:1 pour l'accent sur sa teinte).

### T-ATS-17 en visuel (décision utilisateur : intégrité et garde-fous)

Le linter a deux profils, choisis par le **nom** du gabarit (`lintProfileOf`), jamais par son contenu :

| Règle                                                  | `ats` (ats-classique, lettre) | `visuel`                                     |
| ------------------------------------------------------ | ----------------------------- | -------------------------------------------- |
| texte en dur (balisage ou chaîne avec lettre, chiffre) | bloquant                      | bloquant                                     |
| `eval(`, `hide(`, texte blanc, taille < 9 pt           | bloquant                      | bloquant                                     |
| `table(`                                               | bloquant                      | bloquant (inutile au visuel)                 |
| `place(` hors de `photo()`                             | bloquant                      | bloquant (inutile au visuel)                 |
| contenu de `photo()`                                   | l'image et son placement      | idem, plus `box`, `clip`, `radius` (arrondi) |
| `grid(`                                                | bloquant                      | **permis** (deux colonnes)                   |

La règle d'`ats-classique` n'est pas affaiblie : un test montre que la source du gabarit visuel, examinée sous un nom ATS, est refusée. Dans le rapport, le critère s'appelle « Gabarit conforme (intégrité) » en visuel.

### Colonne Visuel du contrôle ATS (§12.3)

`toVisualColumn` transforme la colonne ATS : T-ATS-05 à 08 rouges deviennent orange (avec « mise en page du modèle visuel : avertissement, pas un blocage ») ; T-ATS-15 et 16 sont sans objet ; T-ATS-01 à 04 et 09 à 13 restent bloquants ; T-ATS-14 reste orange au plus ; T-ATS-03 garde son seuil. En DOCX, T-DOCX-02 passe aussi T-ATS-06 et 08 en orange au plus.

Le rapport porte `notice: { badge, docx }` en visuel : le badge « Destiné à une lecture humaine, déconseillé pour les portails ATS » et, pour un DOCX, la remarque sur la colonne unique. Il est absent en ATS et pour la lettre. L'interface, le MCP et `test:ats` l'affichent ou le vérifient.

### DOCX du visuel (décision utilisateur : le DOCX une colonne, avec un avertissement)

F-EXP-02 interdit tableaux, zones de texte et cadres : un DOCX à deux colonnes n'est pas possible proprement. Le DOCX du visuel est celui d'`ats-classique`, construit sur la projection du visuel (thème, Normes en section dédiée, photo en ligne), avec la remarque « Le DOCX garde une seule colonne : la mise en page visuelle n'existe qu'en PDF ». T-DOCX-01 à 03 s'appliquent (T-DOCX-03 orange au plus, §12.2).

### Passage d'un modèle à l'autre (décision utilisateur : normes automatiques, photo suggérée)

`applyLayout` (`@cv/core/selection`) :

- en entrant dans le visuel, `regulatoryPlacement` passe à `own-section` (défaut du visuel, §5.3) ; en revenant à un modèle ATS, il revient à `skills-subgroup` ;
- la photo n'est jamais cochée d'office : si l'identité en a une, un message la suggère ;
- l'interface annonce chaque changement, comme la photo décochée en passant en anglais.

`renderCv` applique la même fonction quand une requête force le modèle (`layout` de `render`, `check_ats` et `preview_selection`) : un aperçu visuel d'un preset ATS montre les normes en section dédiée, sans modifier le preset.

## Thèmes (F-MOD-01, F-MOD-05)

### Polices (décision utilisateur : Source Sans 3 et IBM Plex Sans ; §15 point 1)

Téléchargées avec l'accord de l'utilisateur depuis les publications officielles, en TTF **statiques** (aucune table `fvar`, contours `glyf`), quatre styles chacune, sous licence OFL 1.1 :

- **Source Sans 3** 3.052 : `adobe-fonts/source-sans`, publication `3.052R`, archive `TTF-source-sans-3.052R.zip` (SHA-256 `1b0dd1ec44b39f1dd98bbd153a1a3815f083639874ddee02c842bd601bad3d21`) ; licence `LICENSE.md` de la même étiquette ;
- **IBM Plex Sans** 3.005 : `IBM/plex`, publication `@ibm/plex-sans@1.1.0`, archive `ibm-plex-sans.zip` (SHA-256 `fb365d910566e6d199cc2c15579a7dd9a267128e18431a394ed81f1970c69200`), dossier `fonts/complete/ttf/`.

| Fichier                    | Nom PostScript         | SHA-256                                                            |
| -------------------------- | ---------------------- | ------------------------------------------------------------------ |
| SourceSans3-Regular.ttf    | SourceSans3-Regular    | `4644c81b86ec9caaa76b634889968ed3c4f4f52f054855933acc7c2b21e53b0f` |
| SourceSans3-Bold.ttf       | SourceSans3-Bold       | `9214b9d95e4231c609802815c2646c98174e2102d0d37f88978a7f8e71006e6a` |
| SourceSans3-It.ttf         | SourceSans3-It         | `192afd78f0f54a3c69eaf02d43f4d9a821e9d6110e41d3d25d61a7385cd580e4` |
| SourceSans3-BoldIt.ttf     | SourceSans3-BoldIt     | `7978291fc1bf314db887e0366853b33c5cf2e964c7b95cfb9ce403a6ec46a842` |
| IBMPlexSans-Regular.ttf    | IBMPlexSans            | `975dcda37d80f038dcd143c22e33ca2d97a0cc5a929aace1c749153b0fe1afa5` |
| IBMPlexSans-Bold.ttf       | IBMPlexSans-Bold       | `9e6c74a889a700d707613d24548fe4ffa6bc59559a0689d2cf9e133bdcdafb2f` |
| IBMPlexSans-Italic.ttf     | IBMPlexSans-Italic     | `a9c6ef9942c49e49d11e11a6dacc0b3a087978757e9b22a06b8ac22a6400fb15` |
| IBMPlexSans-BoldItalic.ttf | IBMPlexSans-BoldItalic | `0e3142ba2ef31fe5c02f0c6c36424f251609cd6b73880076e21c2e81931ba2b9` |
| SourceSans3-LICENSE.md     | —                      | `db4728023c37bd1db542fd14ff9e4f3bcc23836b8374f6fe1f2351d38c2996d5` |
| IBMPlexSans-LICENSE.txt    | —                      | `37784b44044a4ffd9256702b7c0982c37e5c8887ba90c6dca0479aea93dc898d` |

Les deux licences sont copiées avec leurs fins de ligne ramenées à LF (`.gitattributes`) ; les TTF sont identiques aux originaux. `packages/render/fonts/` est exclu de Prettier.

- **Contrôles** : les empreintes, l'absence de `fvar` et les noms PostScript sont vérifiés par `packages/render/test/fonts.test.ts`. La couverture des glyphes (`findMissingGlyphs`) est vide pour les trois personas en FR et en EN, et pour chacune des trois polices (accents, œ, æ, ·, –, •, «, », €…). T-ATS-09 est vert pour chaque police, dans les deux modèles et dans la lettre, et les seules polices embarquées sont celles du thème.
- **Refus** : une police hors de l'énumération est refusée par le schéma ; une famille inconnue de Typst donne `UNKNOWN_FONT` ; un caractère absent de la police donne `MISSING_GLYPH`, avec le caractère et l'élément.
- **DOCX** (F-EXP-02) : Carlito est déclarée « Calibri » (mêmes métriques). Source Sans 3 et IBM Plex Sans n'ont pas d'équivalent dans Word : le DOCX déclare aussi « Calibri », et T-DOCX-03 est **toujours orange**, avec le message « Pagination Word différente du PDF : police déclarée Calibri, … n'ayant pas d'équivalent métrique dans Word », et le nombre de pages que LibreOffice donne pour ce texte en Calibri s'il est installé. L'interface l'annonce sous le choix de la police et sous le bouton DOCX.
- **Registre** : `THEME_FONT_META` (core, sans Zod : libellé, famille Typst, équivalent métrique) et `THEME_FONTS` (render : fichiers, noms PostScript, police déclarée du DOCX).

### Couleur d'accent (décision utilisateur : pastilles et couleur libre)

- Six pastilles nommées, toutes au-dessus de 7:1 sur blanc : Marine `#1F4E79` (8,6:1), Pétrole `#0B5563` (8,4:1), Forêt `#2E5E3A` (7,5:1), Bordeaux `#7B2C3F` (9,2:1), Prune `#5B3A73` (9,1:1), Graphite `#37474F` (9,6:1).
- Une couleur libre (sélecteur ou code `#RRGGBB`) est acceptée si son contraste sur blanc atteint 4,5:1. Le refus donne le ratio, arrondi par défaut pour ne jamais afficher « 4,5:1 » pour 4,49 : « contraste de 2,3:1 sur blanc, insuffisant (minimum 4,5:1) : choisissez une couleur plus foncée ». Le même message vient du schéma (API, MCP, fichiers) et de l'interface, qui n'applique pas une couleur refusée.
- Aucun nom de thème n'est stocké : le schéma garde `font`, `accent` et `density`.

### Niveau (décision utilisateur : preset et candidature)

`selection.json` d'une candidature contient déjà son `template` : modèle et thème se règlent dans la candidature (preset virtuel, ADR 0013) sans toucher au preset. La lettre de la candidature prend sa police et son accent (`projectionTheme`), quel que soit le modèle du CV : le gabarit de lettre reste unique (F-MOD-05) et la page « Lettre » affiche le thème appliqué.

## MCP (décision utilisateur : autorisé, avec les avertissements)

- `render`, `check_ats` et `preview_selection` acceptent `layout: ats-classique | visuel` ; `ats-moderne` est refusé par le schéma de l'outil.
- `atsReport.notice` (badge et remarque DOCX, `null` en ATS) est dans `structuredContent` ; le résumé texte ajoute « modèle visuel : destiné à une lecture humaine, déconseillé pour les portails ATS ».
- `get_guidelines(cv)` décrit les modèles et le thème, et dit de garder `ats-classique` pour une candidature en ligne. Les instructions du serveur mentionnent le visuel (1 906 caractères, plafond 2 048). Le prompt `adapter-a-une-offre` n'est pas modifié : il rend le modèle de la candidature.

## Interface

- Barre : liste « Modèle » (ATS classique, Visuel) avec le badge « Lecture humaine » (texte complet en infobulle), et les messages de bascule.
- Réglages (preset et candidature) : encart « Thème » (police, pastilles, couleur libre avec contraste en direct et refus motivé). Les indications de la photo et des normes changent avec le modèle.
- Export : badge complet, remarque du DOCX du visuel, avertissement de police sous le bouton DOCX ; « Export possible » précise que les critères de mise en page du visuel sont en orange.
- Vue ATS : bandeau du modèle visuel au-dessus des feux.

## Batterie ATS (`npm run test:ats`)

72 cas, tous conformes à l'attendu, avec les deux extracteurs (pdf.js et `pdftotext -raw` de Poppler 26.09.0) et `pdffonts` pour T-ATS-09 :

| Groupe                                        | Cas | Attendu                                                               |
| --------------------------------------------- | --- | --------------------------------------------------------------------- |
| CV `ats-classique`, Carlito                   | 10  | tout au vert (T-ATS-16 orange avec photo) ; `debordante` refusé       |
| CV `visuel`, Carlito                          | 10  | intégrité au vert, aucun rouge, badge ; `debordante` refusé           |
| CV `ats-classique` et `visuel`, Source Sans 3 | 14  | idem, `courte` et `pieges` en FR, en-GB, en-US, `debordante` FR       |
| CV `ats-classique` et `visuel`, IBM Plex Sans | 14  | idem                                                                  |
| Lettre, chaque police                         | 21  | tout au vert ; lettre trop longue refusée ; police et accent du thème |
| Lettre d'une candidature en visuel            | 3   | identique (gabarit unique), sans badge                                |

DOCX : pour chaque cas Carlito, et pour un cas par autre police et par modèle. Remplissage du visuel (Carlito) : `courte` 56 / 56 / 61 % (63 % avec la photo), `pieges` 56 / 53 / 55 %, `debordante` 144 / 136 / 142 %. Seuls oranges en visuel : T-ATS-06 (ordre des colonnes), et T-ATS-07 pour `pieges` FR en IBM Plex Sans (l'intitulé de 90 caractères tient sur deux lignes dans la colonne principale, et ses dates passent sur la troisième).

## Recette (§12.6 ; décision utilisateur sur la répartition)

- **Automatique** : `npm run test:recette` lance les tests nommés T-01 à T-08 (15 tests : `t01-t02-t05`, `t03`, `t04` côté MCP ; T-06, `t07` et `t08` côté API, plus T-07 dans les opérations de sélection). T-07 et T-08 sont nouveaux, de bout en bout par l'API.
- **Interface** : chaque scénario rejoué dans le navigateur intégré sur `npm run dev:demo` (et `cv-debordante` pour T-06), Claude étant simulé par un client MCP en mémoire branché sur la copie de démo et son `import/` fictif, jamais sur `data/` ni sur le vrai `import/`. Détail, résultats et écarts : [`docs/recette.md`](../recette.md).
- **Utilisateur** : contrôles manuels du §12.5, Claude Desktop (§15 point 5), essai à blanc de l'export LinkedIn réel (README, « Ce qui vous reste à faire »).

### Défauts trouvés et corrigés pendant ce lot

- **Mots collés par Poppler en Source Sans 3** : trouvé en installant Poppler, après la recette. `pdftotext -raw` collait environ 28 % des paires de mots en Source Sans 3 (« logicielavec6ans »), dans les deux modèles et dans la lettre ; pdf.js les séparait. L'espace de Source Sans 3 mesure 0,20 em ; un essai montre que Poppler colle encore les mots à 100 % d'espacement et les sépare dès 115 %, alors que Carlito (0,23 em) et IBM Plex Sans (0,25 em) passent tels quels. Le thème porte donc un espacement des mots propre à la police (`wordSpacing`, Typst `text.spacing`) : 125 % pour Source Sans 3 (0,25 em, comme IBM Plex Sans), 100 % pour les deux autres. Les trois gabarits l'appliquent. `fonts.test.ts` vérifie T-ATS-03 avec `pdftotext` pour chaque police quand Poppler est installé, et Vitest charge désormais `.env` (`POPPLER_BIN`), comme l'interface, le serveur MCP et les scripts. Toute nouvelle police doit passer T-ATS-03 avec les deux extracteurs.

- **T-DOCX-03 orange au hasard** (lot 7) : avec LibreOffice désormais installé, deux conversions simultanées sur le même profil échouaient. Chaque processus a son profil, ses conversions passent une à une (ADR 0016, conséquences). Les profils laissés par un processus tué (worker de test, serveur arrêté) sont supprimés à la création d'un nouveau profil s'il n'y a plus de processus qui les utilise.
- **Candidature ouverte non restaurée** (lot 4) : au chargement, l'interface pouvait afficher le preset par défaut, et oublier la candidature mémorisée, avant de recevoir la liste des candidatures. Elle n'était alors rouverte qu'une fois sur deux. L'identifiant mémorisé est maintenant lu avant tout affichage.

## Points du cahier

- **§15 point 1** (polices) : tranché, trois polices.
- **§15 point 2** (ordre des sections selon le profil, décision utilisateur) : laissé ouvert. L'ordre se règle déjà dans chaque preset ; le README le note dans « Ce qui reste à faire ».
- **Corrections des ADR 0002 à 0017** (décision utilisateur) : intégrées au cahier, version 1.2, avec un journal des modifications.

## Conséquences

- Aucune dépendance ajoutée ; les deux polices ajoutent 2,3 Mo au dépôt (huit TTF).
- Tests : `packages/core/test/theme.test.ts`, `packages/render/test/visual.test.ts`, `packages/render/test/fonts.test.ts`, `apps/mcp/test/lot8.test.ts`, `apps/server/test/t07.test.ts`, `apps/server/test/t08.test.ts`.
- **Poppler** 26.09.0 (binaires `oschwartz10612/poppler-windows`, `Release-26.09.0-0.zip`, SHA-256 `7a6f256a0ddf7536182246a5733331bf4677cbcc34f4663774947ad34556c8d0`) est installé dans `%LOCALAPPDATA%\Programs\poppler-26.09.0`, désigné par `POPPLER_BIN` dans `.env` : `test:ats` est complet, sans `ATS_SINGLE_EXTRACTOR`.
