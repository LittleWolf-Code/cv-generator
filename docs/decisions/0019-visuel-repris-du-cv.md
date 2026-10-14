# ADR 0019 — Modèle visuel repris du CV de l'utilisateur

- **Date** : 07/10/2026
- **Statut** : accepté ; complété par l'[ADR 0020](0020-corrections-design.md) (teinte arrêtée au contenu, pastilles de même style, libellés des coordonnées au-dessus des valeurs, dates, échelle verticale)
- **Contexte** : l'utilisateur a fourni son CV actuel, mis en page dans un outil graphique, comme modèle de design. Décisions de l'utilisateur du 07/10/2026 : reprendre son **design** (pas son contenu) ; le reprendre **adapté aux règles** (ni texte blanc ni nouvelle police) ; **remplacer** la mise en page du visuel plutôt qu'ajouter un troisième modèle ; extraire le texte dans l'**ordre visuel**. Cet ADR remplace la section « Mise en page » de l'ADR 0017 et sa description de la photo. Les couleurs (ATS-14), le profil `visuel` de T-ATS-17, la colonne Visuel du contrôle, le DOCX, `applyLayout` et les thèmes de l'ADR 0017 ne changent pas. Cahier passé en v1.4 : F-MOD-03 et §8.5. **Aucun changement de schéma.**

## Ce qui est repris et ce qui est adapté

| CV fourni                                                    | Modèle `visuel`                                                                                                                                           | Raison                                                                              |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Bandeau bleu foncé, nom et titre en blanc                    | Bandeau sur la teinte de l'accent, nom en couleur d'accent, titre en noir, filet d'accent dessous                                                         | Jamais de texte blanc (ADR 0017) ; le linter refuse `fill: white`                   |
| Colonne noire à gauche, texte blanc, sur toute la hauteur    | Colonne de gauche sur la même teinte, texte noir, jusqu'à la marge du bas                                                                                 | Même règle ; marges d'au moins 1,5 cm, donc pas de fond à fond perdu                |
| Photo ronde cerclée de bleu, à cheval sur le bandeau         | Photo ronde cerclée d'un filet d'accent, dans le bandeau, au-dessus de la colonne de gauche                                                               | Aucun `place()` : la photo reste en ligne, dans une cellule de la grille            |
| Coordonnées avec icônes en haut de la colonne                | Coordonnées en haut de la colonne, une par ligne, avec leurs libellés (« E-mail : », « Tél. : ») en couleur d'accent                                      | Aucune image hors de `photo()` ; les libellés viennent de la projection             |
| Intitulés en pastilles : pleines à droite, cerclées à gauche | Pastilles pleines (teinte) dans la colonne principale, cerclées (filet d'accent) dans la colonne de gauche, intitulé en couleur d'accent et en gras       | Contraste d'au moins 4,5:1 : la teinte n'est gardée que si l'accent y atteint 4,5:1 |
| Police géométrique (de type Montserrat)                      | Police du thème (Carlito, Source Sans 3 ou IBM Plex Sans)                                                                                                 | Décision utilisateur ; une nouvelle police demande un ADR et ses contrôles (§8.5)   |
| Année devant l'intitulé, durée à droite (« 4 mois »)         | Plage de dates à droite de l'intitulé, comme dans les autres modèles                                                                                      | ATS-05 : même format partout ; la durée n'est pas une donnée du modèle              |
| Listes à puces dans la colonne                               | Lignes sans libellé (normes, langues, centres d'intérêt) en liste à puces ; une ligne libellée (« Langages ») garde son libellé au-dessus de ses éléments | Les éléments d'une ligne libellée restent sur une ligne, séparés par des virgules   |

## Mise en page

`packages/render/templates/visuel.typ`, toujours écrit en mode code seulement : aucun texte en dur, mêmes réglages qu'avant (`fallback: false`, `hyphenate: false`, `ligatures: false`, `tracking: 0pt`, `smartquote(enabled: false)`, `par(justify: false)`, `document(date: none)`, marges du thème, corps d'au moins 10 pt).

- **Une grille de deux colonnes** (`columns: (6.5cm, 1fr)`, sans gouttière) et de deux rangées. Première rangée, le **bandeau** : la photo, puis le nom (corps du nom + 6 pt, couleur d'accent) et le titre (corps du titre + 1 pt). Sans photo, le nom occupe toute la largeur du bandeau (`grid.cell(colspan: 2)`). Seconde rangée : la **colonne de gauche** (coordonnées puis sections `side`) et la **colonne principale** (accroche, sections, mention des références). Fonds, filets et marges intérieures sont donnés par des fonctions de la cellule (`fill`, `stroke`, `inset`).
- **Largeur** de la colonne de gauche : 6,5 cm (6 cm avant), pour les coordonnées. La colonne principale garde 10,35 cm de texte en densité normale (10,8 cm avant) et 10,95 cm en densité compacte.
- **Colonne jusqu'en bas de la page** : un `v(1fr)` termine la colonne de gauche. Une rangée fractionnaire (`rows: (auto, 1fr)`) a été essayée puis rejetée : elle ne se coupe pas entre deux pages, si bien que `debordante` sortait sur **une seule page tronquée** (T-ATS-01 vert à tort, T-ATS-02 rouge). Avec `v(1fr)`, un CV trop long passe en page 2 comme avant. Dans la compilation de mesure (`page(height: auto)`), l'espace fractionnaire est nul : la mesure et le coût en lignes des puces ne changent pas.
- **Coordonnées trop larges** : chaque valeur reste dans un `box`. Dans 6,5 cm, une URL longue serait coupée à l'intérieur de son `box`, au trait d'union (essai : « linkedin.com/in/camille-martin- / fictif » en IBM Plex Sans, T-ATS-03 orange). La valeur est donc mesurée (`layout`, `measure`) et, si elle dépasse la colonne, composée plus petite pour tenir sur une ligne, **jamais sous 9 pt** (`calc.max(9, …)`). Le libellé peut passer seul sur la ligne précédente.
- **Sans teinte** (accent trop clair pour la teinte, ADR 0017) : bandeau et colonne sans fond, pastilles cerclées, et un filet vertical d'accent sépare les deux colonnes.
- **Photo** : `box(clip: true, radius: 50%, image(src, width: w, height: w))`, avec `w` la largeur de la photo du thème (2,4 cm, ou 2,1 cm en densité compacte). L'image 3:4 est recadrée en carré, centrée (`fit` vaut `"cover"` par défaut ; écrire la chaîne `"cover"` serait refusé comme texte en dur). Le cercle d'accent est un `box` autour de `photo()`, hors de la fonction. L'image passe toujours par `mapShadow`, jamais par la projection ; le MCP utilise l'image neutre (ADR 0012).

## Ordre du texte extrait (décision utilisateur : ordre visuel)

Bandeau (nom, titre), colonne de gauche (coordonnées, puis ses sections), colonne principale. Typst écrit les cellules de la grille rangée par rangée, de gauche à droite : l'ordre du flux est l'ordre de la page, et pdf.js comme `pdftotext -raw` le lisent ainsi.

- Le nom reste la première ligne, le titre la deuxième, et les coordonnées viennent avant le premier intitulé : **T-ATS-08 vert**. L'échec relevé par la recherche (`docs/recherche/02-parsing-ats.md` : la colonne latérale qui passe **avant le nom**) n'a pas lieu, puisque le bandeau précède la colonne.
- **T-ATS-06 orange**, comme avant, dès que l'ordre de la sélection mêle les deux colonnes (cas des presets par défaut) : les sections de gauche sont lues avant l'Expérience.
- Option écartée : garder l'ordre de l'ADR 0017 (en-tête, colonne principale, colonne latérale). Il fallait une grille écrite de droite à gauche (`text(dir: rtl)`) pour mettre la colonne principale en premier dans le flux, et sortir les coordonnées de la colonne pour garder T-ATS-08 vert.

## T-ATS-17

Le profil `visuel` permet en plus `height` dans `photo()`, pour l'image carrée découpée en cercle. Le profil `ats` (ats-classique, lettre) ne change pas : un test vérifie que la photo ronde y est refusée (`photo-content`). Le reste du profil `visuel` est inchangé : `grid` permis ; texte en dur, `eval`, `hide`, `table`, texte blanc, taille sous 9 pt et `place` hors de `photo()` bloquants.

## Batterie ATS (`npm run test:ats`)

72 cas, tous conformes à l'attendu, avec les deux extracteurs. Remplissage du visuel en Carlito (FR / en-GB / en-US) : `courte` 66 / 65 / 69 % (72 % avec la photo), `pieges` 63 / 61 / 66 %, `debordante` 149 / 144 / 151 %, refusé sur deux pages. Le bandeau et la colonne principale plus étroite coûtent environ 10 points de remplissage par rapport à l'ADR 0017.

Seuls oranges en visuel : T-ATS-06 (ordre des colonnes) partout, et T-ATS-07 pour `pieges` en IBM Plex Sans, en FR comme avant et désormais aussi en en-GB : l'intitulé de 90 caractères et l'intitulé de la formation tiennent sur deux lignes, et leurs dates passent sur la troisième.

## Conséquences

- Fichiers : `packages/render/templates/visuel.typ` (réécrit), `packages/render/src/ats/template-lint.ts` (`height`), `packages/render/test/visual.test.ts` (ordre du texte, photo ronde, coordonnée réduite) ; libellés de `guidelines.ts` (MCP) et de `PresetSettings.tsx` (« colonne de gauche ») ; commentaires de `theme.ts`, `project.ts` et `projection.ts` ; README, `CLAUDE.md`, cahier (v1.4).
- Aucune dépendance, aucune police, aucun champ de schéma ajoutés. Les presets et candidatures en `visuel` prennent la nouvelle mise en page sans migration. Un PDF déjà exporté ne change pas : un nouvel export du même preset produit un PDF différent.
- L'instance en ligne ne prend la nouvelle mise en page qu'après `npm run deploy` (ADR 0018).
