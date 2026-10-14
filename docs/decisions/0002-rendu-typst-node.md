# ADR 0002 — Rendu Typst par le compilateur Node

- **Date** : 05/10/2026
- **Statut** : accepté
- **Contexte** : §8.1, §8.5, §14 ; point **[à vérifier à l'init]** du §8.5 : « le compilateur Node n'utilise pas de police système à la place de celles du thème ».

## Décision

Le rendu passe par `NodeCompiler` de `@myriaddreamin/typst-ts-node-compiler` 0.7.0 (Typst 0.14.2), un seul compilateur par processus, `workspace` = `packages/render/templates`, `fontArgs: [{ fontPaths: [packages/render/fonts] }]`. Le gabarit lit `json(bytes(sys.inputs.project))`. Deux compilations par rendu : A4/Letter (le PDF montré et exporté) et `page(height: auto)` (mesure). Le repli sur la CLI Typst n'est pas nécessaire.

## Vérifications faites sur ce poste (prototype, 05/10/2026)

| Point                                | Résultat                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Polices système                      | **Chargées, et impossible de les désactiver.** Avec `font: "Arial"`, le PDF embarque `ArialMT`. L'API 0.7.0 n'a que `fontArgs`, `workspace` et `inputs` ; aucune option ni variable d'environnement d'exclusion (seul `TYPST_FONT_PATHS` existe). Les polices intégrées à Typst (Libertinus Serif, New Computer Modern) sont aussi disponibles |
| Famille inconnue                     | Simple **avertissement** (`takeWarnings()` : `unknown font family: …`), pas une erreur, et le texte **disparaît** du PDF (aucune police embarquée)                                                                                                                                                                                             |
| Glyphe absent avec `fallback: false` | Aucun diagnostic ; le glyphe est rendu par `.notdef` et **extrait comme U+0000** par pdf.js                                                                                                                                                                                                                                                    |
| Polices embarquées avec Carlito      | `Type0` + `CIDFontType2`, sous-ensembles `XXXXXX+Carlito-Regular/Bold/Italic`, ToUnicode présent                                                                                                                                                                                                                                               |
| Ligatures et guillemets              | `ligatures: false` : « fi », « fl », « workflows » extraits lettre à lettre ; `smartquote(enabled: false)` : apostrophes droites conservées                                                                                                                                                                                                    |
| Espace avant `h(1fr)`                | Conservée : « Ingénieure logiciel 02/2023 – aujourd'hui » est extrait avec un blanc                                                                                                                                                                                                                                                            |
| Mesure                               | `query(doc, { selector: '<cv-end>', field: 'value' })` renvoie `[{ page, x: "51.02pt", y: "172.15pt" }]` ; avec `height: auto`, une seule page dont `y` donne la hauteur réelle                                                                                                                                                                |
| Reproductibilité                     | Deux compilations identiques donnent le même SHA-256 (`date: none`)                                                                                                                                                                                                                                                                            |
| Métadonnées                          | Title et Author renseignés, Subject et Keywords absents, `Creator: Typst 0.14.2`                                                                                                                                                                                                                                                               |
| Performance                          | Création du compilateur ≈ 130 ms (balayage des polices système) ; compilation 5 à 25 ms, double compilation comprise                                                                                                                                                                                                                           |

## Parades retenues

1. La famille de police vient uniquement du thème (`theme.font` est une énumération : `carlito`), jamais d'une saisie.
2. `fallback: false` dans le gabarit.
3. **Contrôle des glyphes avant compilation** (`fontkit`, table cmap des 4 styles) : un caractère absent bloque le rendu en citant le caractère et l'élément (`MISSING_GLYPH`).
4. Tout avertissement `unknown font family` est transformé en **erreur bloquante** (`UNKNOWN_FONT`).
5. T-ATS-09 vérifie en JS (pdf-lib) que les polices embarquées sont exclusivement celles du thème, avec ToUnicode, sans Type 3.
6. T-ATS-04 cherche aussi U+0000 et les caractères de contrôle C0 dans l'extraction (ADR 0004).
7. Les chemins de polices personnalisés sont prioritaires sur les polices système dans le moteur de polices de Typst ; une copie système de Carlito (installée par exemple avec LibreOffice) est détectable par `systemCopiesOf('carlito')` pour expliquer un éventuel écart de version.

## Proposition de correction du cahier

Le point du §8.5 est **invalidé** tel qu'il est écrit. Proposition de remplacement du paragraphe **[à vérifier à l'init]** du §8.5 :

> Le compilateur Node 0.7.0 charge toujours les polices système et les polices intégrées de Typst ; il n'existe pas d'option pour les exclure. Les garanties reposent sur : famille de police issue du thème uniquement, `fallback: false`, contrôle des glyphes avant compilation, avertissement `unknown font family` traité comme erreur bloquante, et T-ATS-09 (bloquant). Un glyphe absent avec `fallback: false` est extrait comme U+0000 : T-ATS-04 le détecte.

Et dans le §14, ligne « Le compilateur Node utilise une police système » : ajouter « (constaté au lot 0 : les polices système sont chargées ; ADR 0002) ».
