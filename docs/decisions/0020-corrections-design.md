# ADR 0020 — Corrections de design du visuel et d'ats-classique (batterie T-DES)

- **Date** : 08/10/2026
- **Statut** : accepté
- **Contexte** :
  - **Recherche** : une recherche documentaire sur les critères de design d'un CV (`reports/Critères de design de CV.md`) a défini une batterie de tests de designer (T-DES).
  - **Audit** : passée sur 60 rendus du modèle visuel (`reports/Audit design du modèle visuel.md`), elle a relevé quinze défauts. Le principal est le rythme vertical, et le défaut des dates touche aussi `ats-classique`.
  - **Décision utilisateur du 08/10/2026** : « corrige tout, ats-classique aussi ».

  Cet ADR complète l'ADR 0019. Il en remplace trois points : la teinte jusqu'en bas de page, les deux styles de pastille, et le libellé des coordonnées sur la ligne de la valeur. Cahier passé en v1.5 : ATS-05, ATS-21, F-SEL-09, F-MOD-03, §8.5.

## Échelle verticale (thème, tous les gabarits)

La table des densités (`project.ts`) donne désormais un **pas** de ligne, pas un interligne :

| Réglage                                                      | Normale                                                    | Compacte            |
| ------------------------------------------------------------ | ---------------------------------------------------------- | ------------------- |
| Pas d'une ligne de base à la suivante, en corps              | 1,25                                                       | 1,20                |
| `leading` (calculé : pas − hauteur de capitale de la police) | 0,608 em Carlito, 0,590 Source Sans 3, 0,552 IBM Plex Sans | 0,558, 0,540, 0,502 |
| Entre deux entrées (`entryGap`)                              | 10 pt (6 avant)                                            | 8,5 pt (4 avant)    |
| Au-dessus d'un intertitre (`sectionGap`)                     | 20 pt (9 avant)                                            | 17 pt (6 avant)     |

- **Interligne par police** : Typst mesure `leading` de la ligne de base à la hauteur de capitale de la ligne suivante. Le même 0,45 em donnait donc un pas de 1,09 en Carlito et de 1,15 en IBM Plex Sans. La hauteur de capitale de la face normale est dans `THEME_FONT_META.capHeight`, que `fonts.test.ts` compare au fichier TTF.
- **Plancher** : un pas d'au moins 1,20 du corps (Butterick : 120 à 145 %). La densité compacte gagne sur les marges, les corps et les écarts, jamais sous ce plancher. Un CV trop long se raccourcit.
- **Échelle** : les écarts suivent la proximité. Lignes d'une entrée < entrées (environ 1,5 fois) < sections (environ 1,5 fois encore).
- **Première entrée d'une section** : elle prend l'écart du dessous de l'intertitre (0,65 corps dans le visuel, 0,6 corps dans `ats-classique`), et non `entryGap`. Sinon, le plus grand des deux espaces l'emportait et l'intertitre s'éloignait de son contenu.

## Intertitres

**Visuel** :

- même pastille dans les deux colonnes : même corps (celui des intertitres du thème, 12 pt ou 11,5 pt), texte aligné à gauche, contour de 1,25 pt ; seule la pastille principale est remplie de la teinte ;
- la pastille déborde dans la marge de 0,55 corps, pour que son texte commence exactement sur le bord de la colonne ;
- le texte est **noir**, l'accent est dans la pastille : en couleur d'accent, l'intertitre était plus pâle que les intitulés de poste au flou (7e à 10e rang de noirceur) ;
- le titre du bandeau prend le même corps : il ne reste que trois corps sur la page (26, 12 et 10,5 pt).

**`ats-classique`** :

- intertitre en noir, au corps du thème + 1 pt (13 pt), au-dessus d'un filet d'accent de 1,25 pt (0,6 pt avant). Il dépasse ainsi les intitulés de poste dans toutes les polices.

**Unités** : les marges des pastilles sont en points calculés sur le corps du texte. Dans une règle `show heading`, `em` suivrait le corps par défaut d'un intertitre Typst (14,7 pt).

## Dates (deux gabarits)

La coupure de ligne pouvait tomber entre `h(1fr)` et la boîte des dates. Les dates passaient alors seules à la ligne suivante, **collées à gauche** : 10 rendus sur 54 dans le visuel, et `pieges` dans `ats-classique`.

`title-line` mesure (`layout`, `measure`) si une boîte de la largeur de l'espace et des dates tient après la dernière ligne de l'intitulé :

- si oui, les dates suivent l'intitulé sur cette ligne ;
- sinon, elles passent entières à la ligne suivante (`linebreak()` puis `h(1fr)`).

Elles sont toujours au bord droit. L'ordre du texte extrait ne change pas, et T-ATS-07 non plus. ATS-05 décrivait des dates « restant sur la ligne de l'intitulé », ce que le gabarit ne faisait pas pour un intitulé long : le cahier décrit désormais ce comportement.

## Visuel : colonne, coordonnées, teinte, accent

- **Colonne latérale** : 6,8 cm et marge intérieure de 0,35 cm (6,5 et 0,4 avant), soit 6,1 cm de texte. L'URL LinkedIn de `courte` y tient en IBM Plex Sans sans être réduite. La réduction (jamais sous 9 pt) reste un filet de sécurité pour une valeur plus longue.
- **Coordonnées** : chaque libellé au-dessus de sa valeur, comme « Langages ». Avant, le libellé suivait la valeur quand la place le permettait, et passait seul à la ligne sinon (« E-mail : » orphelin dans 33 rendus sur 54).
- **Libellés** de la colonne latérale (coordonnées, « Langages ») : gras, en couleur d'accent, plus petits que les intertitres et plus sombres que le texte.
- **Alignements** :
  - listes sans retrait : la puce est sur le bord du texte (décalée de 1 pt avant) ;
  - nom du bandeau sur le bord du texte principal (marge de 0,55 cm ; 4,3 pt de décalage avant) ; sans photo, il reste sur le bord du texte latéral.
- **Teinte** : elle s'arrête avec le contenu. La deuxième rangée de la grille est aussi haute que la colonne la plus longue, et le `v(1fr)` de l'ADR 0019 est retiré. Une colonne teintée qui descendait seule jusqu'en bas sous une colonne principale finie aux deux tiers formait un L lourd.
- **Accent et gris** : les dates sont en graisse normale (accent). L'organisation et le lieu sont en italique noir : le gris et l'italique cumulaient deux atténuations sur une des six données que lit un recruteur. `theme.muted` n'est plus utilisé par les gabarits ; il reste dans la projection et dans le contrôle de la teinte.
- **Traits** : 1,25 pt pour les pastilles et le filet vertical sans teinte, 1,5 pt pour le filet du bandeau et l'anneau. Ils restent au-dessus de 1 pt une fois une page A4 ajustée sur du Letter.

## Finitions (deux gabarits)

- **Lignes creuses** :
  - réglages : `par.linebreaks` vaut `optimized`, une chaîne venue de la projection (`theme.linebreaks`), aucun texte dans un gabarit ; `text.costs.runt` vaut 100 000 %. Un essai sur une puce réelle montre qu'un coût de 1 500 % ou 10 000 % laisse « development) » seul, quand l'éviter raccourcit beaucoup la ligne d'avant.
  - résultat : plus aucune ligne creuse dans les 108 rendus de base.
  - contrepartie : 22 rendus du visuel ont, dans la colonne principale, une ligne non finale de 64 à 74 % de la colonne, sous les 75 % proposés pour le drapeau (seuil sans source). Une dernière ligne d'un seul mot est un défaut classique, alors qu'une puce de deux lignes plus équilibrée ne l'est pas : le compromis est accepté.
- **Tiret séparateur** : un tiret entre espaces reste avec le mot qui le précède, par une règle de `segmentText` (« ISO 13485 – » insécable). Aucune ligne ne commence plus par un tiret. Ce défaut était apparu dans 15 rendus avec la coupure optimisée.
- **Séparateur des coordonnées** (`ats-classique`) : le « | » reste en fin de ligne avec la coordonnée qui le précède (`box` de la coordonnée et du séparateur, puis l'espace). Avant, une ligne de coordonnées coupée pouvait commencer par « | ». Le texte extrait ne change pas.
- **Photo** :
  - texte de remplacement « Photo de Prénom Nom » (`photo.alt`, libellé `photoOf`), dans les balises du PDF seulement (`image(…, alt: …)`), et `altText` de l'image dans le DOCX ;
  - le linter permet `alt` dans `photo()` pour les deux profils : ce n'est pas du texte visible.

## DOCX

Le DOCX ajoutait l'interligne du PDF comme espace après chaque paragraphe, en plus de l'interligne simple de Word (environ 1,2 fois le corps). Avec les nouveaux écarts, `courte` avec photo passait sur deux pages dans LibreOffice. Le DOCX reproduit désormais l'échelle du PDF :

- aucun espace après les paragraphes d'une entrée ;
- avant une entrée, avant un intertitre et avant la mention des références : ce que le PDF ajoute au blanc entre deux lignes.

## Résultats (batterie T-DES, 114 rendus)

Mesures du visuel (54 rendus de base) et d'`ats-classique` (54), plus six couleurs. Écarts en points, d'une ligne de base au haut des capitales suivantes ; blanc au-dessus et au-dessous des pastilles ou du titre et de son filet.

| Mesure                                     | Avant (visuel, audit) | Visuel                     | `ats-classique`       |
| ------------------------------------------ | --------------------- | -------------------------- | --------------------- |
| Pas des lignes                             | 1,09 à 1,25           | 1,20 à 1,26                | 1,20 à 1,25           |
| Entre entrées / dans une entrée            | 1,00 à 1,04           | 1,52 à 1,57                | 1,52 à 1,57           |
| Au-dessus d'un intertitre / entrées        | —                     | 1,54 à 1,59                | 1,62 à 1,66           |
| Dessus / dessous d'un intertitre           | 0,27 à 0,71           | 2,01 à 2,70                | 2,48 à 3,05           |
| Corps sur la page                          | 5 ou 6                | 3                          | 4                     |
| Dates hors du bord droit                   | 10 rendus sur 54      | 0                          | 0                     |
| Lignes creuses                             | 54 rendus sur 54      | 0                          | 0                     |
| Noirceur au flou : intertitres / intitulés | 7e à 10e rang         | 0,37–0,42 / 0,27–0,33      | 0,35–0,42 / 0,27–0,32 |
| Bas de la teinte                           | 100 % de la page      | 61 à 84 %, avec le contenu | —                     |

Tous les autres tests passent : contraste (6,69:1 au minimum, et 6,42:1 en simulation de daltonisme), un style par rôle et un seul pour les intertitres des deux colonnes, aucun débordement, coordonnées d'une seule disposition, texte de remplacement de la photo.

**Restent, à titre d'information** :

- **Prose dans la colonne latérale** : des éléments de trois lignes, avec les formes longues de « CI/CD » et des normes. C'est le contenu, à régler dans le preset.
- **Photocopie** : la teinte (luma 240) est effacée par un copieur ; les intertitres gardent leur contour.
- **`ats-classique`** :
  - environ 107 caractères par ligne sur une seule colonne. Rien n'est changé : réduire la ligne coûterait des lignes sur une page stricte ; c'est à revoir si l'utilisateur le souhaite.
  - le libellé « E-mail : » (l'Académie recommande « Courriel : ») est gardé : il est d'usage et reconnu des logiciels de recrutement.

## Tests

- **Vitest** :
  - `visual.test.ts`, propriétés de design mesurées sur le PDF (pdf.js) : dates au même bord droit dans les deux gabarits (`pieges`, IBM Plex Sans), échelle verticale, intertitres rattachés à ce qui suit (rapport ≥ 1,8 de texte à texte), pas de 1,25, puces, nom et intertitres alignés, aucune ligne creuse, texte de remplacement dans les balises ;
  - `theme.test.ts` : pas par police et densité, échelle ;
  - `fonts.test.ts` : hauteur de capitale du registre ;
  - `contacts-segments.test.ts` : tiret séparateur insécable ;
  - `export.test.ts` : photo projetée avec son `alt`.
- **Batterie T-DES** : l'outil de mesure reste hors du dépôt (`out/exp/design/battery.ts`, dossier ignoré par git) ; sa version permanente (`npm run test:design`) serait un autre ADR.
- **Batterie ATS** : `npm run test:ats` reste conforme à l'attendu sur ses 72 cas (deux extracteurs, PDF et DOCX).
- **Recette T-05** : le scénario passe le preset en densité compacte avant l'export en-US. Ce CV remplit 94 % d'une page A4 avec la nouvelle échelle, et le format Letter, plus court de 50 pt, le faisait dépasser d'une ligne. C'est le remède que propose le message de dépassement.

## Conséquences

- **Fichiers** :
  - cœur : `theme.ts` (`capHeight`), `project.ts` (densités, `leading` calculé, `linebreaks`, `alt`), `projection.ts`, `labels.ts` (`photoOf`), `segments.ts` (tiret) ;
  - rendu : `visuel.typ` et `ats-classique.typ` (gabarits), `docx.ts` (échelle verticale, `altText`), `template-lint.ts` (`alt`).
- **Effet sur les PDF** :
  - les PDF de tous les modèles changent (interligne, écarts) ; la lettre prend aussi le nouveau pas ;
  - les exports déjà faits ne changent pas ; un nouvel export d'un même preset donne un autre PDF ;
  - un même CV occupe plus de hauteur, par exemple `courte` en Carlito : 61 → 70 % en `ats-classique`, 66 → 72 % en visuel ;
  - un CV qui tenait de justesse peut dépasser : l'interface le signale comme toujours (dépassement chiffré), et la densité compacte ou une puce en moins le ramène sur une page.
- **Mise en ligne** : l'instance en ligne ne change qu'après `npm run deploy` (ADR 0018).
