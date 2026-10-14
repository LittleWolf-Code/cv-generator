# Couleur, contraste, accessibilité, lisibilité écran et impression d'un CV « visuel » (PDF A4, une page)

État des sources au 8 octobre 2026. Les tableaux marqués « calcul local » ont été produits par un script Node (scratchpad de la session) qui applique les formules citées : luminance relative et rapport WCAG 2.x (mêmes formules que `packages/core/src/color.ts`), APCA-W3 0.1.9, matrices de Machado 2009 (sévérité 1,0, appliquées en RVB linéaire), luma Rec. 601 et CIEDE2000. Palette testée : les 6 nuances de `ACCENT_SWATCHES` (`packages/core/src/theme.ts`), le texte secondaire `MUTED_TEXT = #4D4D4D`, le texte courant noir (couleur par défaut de Typst, aucun `fill` dans `visuel.typ`), et la teinte `tintOf(accent, 0,08)` (8 % d'accent dans le blanc, canaux sRVB arrondis). Pour Marine, la teinte réelle vaut **#EDF1F4** (et non #EDF1F5). Tailles du modèle : corps 10 ou 10,5 pt, titres de section 11,5 ou 12 pt gras, titres latéraux corps + 0,5 pt gras, nom (nameSize + 6) = 24 ou 26 pt gras (`packages/core/src/project.ts`, lignes 49 à 62 ; `packages/render/templates/visuel.typ`). Contours des pastilles : 1 pt d'accent ; anneau de la photo : 1,5 pt d'accent.

## 1. WCAG 2.2 (1.4.3, 1.4.6, 1.4.11, 1.4.1), calcul du contraste, et statut de WCAG 3 / APCA en 2026

### Takeaway
La seule référence normative en octobre 2026 reste WCAG 2.2. Le texte doit atteindre 4,5:1 en AA, ou 3:1 s'il est grand (au moins 18 pt, ou 14 pt en gras). Le niveau AAA demande 7:1, ou 4,5:1 pour le grand texte. Les objets graphiques **nécessaires à la compréhension** doivent atteindre 3:1. Les formes décoratives en sont exemptées, et la couleur ne doit jamais être le seul moyen de transmettre une information. Dans le modèle, tous les couples de couleurs de texte passent le niveau AA. Tous passent aussi le AAA sur blanc, mais Forêt tombe à 6,69:1 sur sa teinte, sous le AAA. La teinte ne contraste qu'à 1,13–1,15:1 avec le blanc : elle ne peut porter aucune information. WCAG 3 (Working Draft du 10 septembre 2026) ne fixe encore aucun algorithme de contraste. APCA n'est pas normatif, mais il donnerait un verdict plus sévère pour le petit texte gris posé sur la teinte.

### Cited Findings
- 1.4.3 Contraste (minimum), niveau AA : le texte et les images de texte doivent atteindre au moins 4,5:1. Le texte de grande taille n'a besoin que de 3:1. Le texte incident n'a aucune exigence : composant inactif, pure décoration, texte invisible ou intégré à une image chargée d'autres contenus visuels. Les logotypes n'en ont pas non plus. — [W3C, Understanding SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- Le « grand texte » (large scale) fait au moins 18 pt, ou au moins 14 pt en gras. W3C donne l'équivalence 1 pt = 1,333 px CSS : 14 pt ≈ 18,5 px et 18 pt ≈ 24 px. — [W3C, Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- Justification des seuils. Une vision de 20/40 s'accompagne d'une perte de sensibilité au contraste d'environ 1,5, d'où 3 × 1,5 = 4,5:1. Le 3:1 est le minimum recommandé par ISO 9241-3 et ANSI-HFES-100-1988 pour un texte standard et une vue normale. — [W3C, Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- Le rapport calculé ne s'arrondit pas : 4,499:1 ne satisfait pas 4,5:1. — [W3C, Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- On évalue les couleurs **définies** (balisage, feuilles de style, agent utilisateur), et non le rendu à l'écran. L'anticrénelage peut éclaircir les polices fines. Pour ces polices, la bonne pratique est de dépasser le seuil ou d'en choisir une plus épaisse. Un contour étroit autour d'une lettre compte comme la lettre ; un contour large qui remplit les contreformes compte comme un halo, donc comme le fond. — [W3C, Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- Luminance relative : L = 0,2126 R + 0,7152 G + 0,0722 B, sur des canaux sRVB linéarisés. Le seuil de linéarisation vaut 0,04045 depuis mai 2021 (0,03928 auparavant), sans effet pratique sur les calculs. — [W3C, Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Le rapport se calcule ainsi : (L1 + 0,05) / (L2 + 0,05), où L1 est la plus claire des deux luminances. — [WCAG 2.2, définition « contrast ratio »](https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio). Le dépôt applique déjà cette formule dans `packages/core/src/color.ts`.
- 1.4.6 Contraste (amélioré), niveau AAA : 7:1, ou 4,5:1 pour le grand texte, avec les mêmes exceptions. — [W3C, Understanding SC 1.4.6](https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html) (page non relue dans cette session ; seuils connus du texte normatif).
- 1.4.11 Contraste non textuel, niveau AA : les composants d'interface et les objets graphiques doivent atteindre 3:1 avec les couleurs adjacentes. — [W3C, Understanding SC 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
  - Un objet graphique est la partie d'un graphique nécessaire pour comprendre le contenu. Un graphique purement esthétique, qu'il n'est pas nécessaire de voir pour comprendre, est exempté.
  - Si un contrôle porte un texte visible qui signale sa présence, sa bordure n'est pas exigée. Le texte placé dans un graphique relève de 1.4.3.
  - La page ne prévoit aucune exemption explicite pour les aplats colorés qui délimitent des zones : ils doivent atteindre 3:1 seulement s'ils sont nécessaires à la compréhension.
  - Les photos de personnes et les logos sont exemptés.
  - L'anticrénelage rend les traits fins plus pâles ; la bonne pratique est d'éviter les lignes très fines ou de dépasser le seuil.
  — [W3C, Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- 1.4.1 Utilisation de la couleur, niveau A : la couleur ne doit pas être le seul moyen visuel de transmettre une information, d'indiquer une action, de solliciter une réponse ou de distinguer un élément visuel. Le critère n'interdit ni la couleur ni le codage couleur, à condition qu'un autre indice visuel les accompagne. — [W3C, Understanding SC 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
  - Les personnes malvoyantes et beaucoup de personnes âgées perçoivent mal les couleurs.
  - Techniques suffisantes : G14 (information aussi donnée en texte), G182 (indice visuel supplémentaire quand la couleur du texte porte une information), G183 (contraste de 3:1 entre un lien et le texte qui l'entoure, plus un indice supplémentaire), G111 (couleur et motif).
  - Échecs : F13, F73, F81.
- WCAG 3.0 en est au Working Draft du **10 septembre 2026** ([version datée](https://www.w3.org/TR/2026/WD-wcag-3.0-20260910/)). — [W3C, WCAG 3.0 WD](https://www.w3.org/TR/wcag-3.0/)
  - Les exigences Text contrast (minimum) et (enhanced) renvoient à une mesure de contraste encore à déterminer.
  - Une note d'édition précise que l'algorithme reste à déterminer et qu'il devrait tenir compte de la taille et de la graisse.
  - Une exigence de contraste des objets graphiques existe.
- APCA a été retiré des brouillons WCAG 3 en juillet 2023. L'Editor's Draft du 8 avril 2026 dit encore que l'algorithme reste à déterminer. Si l'on utilise APCA, A. Roselli conseille de respecter **aussi** WCAG 2. Il projette l'achèvement de WCAG 3 en 2030 au plus tôt ; c'est son estimation, pas une date du W3C. — [Adrian Roselli, « WCAG3 Contrast as of April 2026 »](https://adrianroselli.com/2026/04/wcag3-contrast-as-of-april-2026.html)
  - Désaccord : des sites commerciaux annoncent une Candidate Recommendation vers fin 2027 ([webability.io](https://www.webability.io/blog/wcag-3-0-explained), [web-accessibility-checker.com](https://web-accessibility-checker.com/en/blog/wcag-3-0-guide-2026-changes-prepare)). Je n'ai pas vérifié cette date auprès du W3C, et le WD ne fixe aucune échéance.
- Paliers APCA (Lc) publiés par l'auteur d'APCA, qui ajoute que ni APCA ni WCAG 3 ne sont recommandés par le W3C : — [Myndex, apca-introduction](https://github.com/Myndex/apca-introduction)

  | Lc | Usage |
  |---|---|
  | 15 | Point d'invisibilité pour certaines personnes |
  | 30 | Minimum pour un texte de repérage (spot text) |
  | 45 | Texte fluide large (> 36 px), ou minimum du texte non fluide |
  | 60 | Texte fluide moyen (> 24 px) |
  | 75 | Minimum du texte courant (> 18 px) |
  | 90 | Valeur préférée pour le texte courant |

- « Bronze Simple Mode » (brouillon ARC, dernière modification le 2023-02-10) : texte courant au minimum Lc 75, de préférence Lc 90 ; autre texte de contenu au minimum Lc 60 ; grand texte fluide (> 36 px) au minimum Lc 45 et au maximum Lc 90. — [Readtech ARC, Bronze Simple Mode](https://readtech.org/ARC/tests/bronze-simple-mode/)
- Constantes de l'implémentation de référence APCA-W3 0.1.9 (révision du 3 juillet 2022) : exposant 2,4 ; coefficients 0,2126729 / 0,7151522 / 0,0721750 ; normBG 0,56, normTXT 0,57, revTXT 0,62, revBG 0,65 ; blkThrs 0,022, blkClmp 1,414 ; échelle 1,14 ; offset 0,027 ; loClip 0,1 ; deltaYmin 0,0005. — [apca-w3.js](https://raw.githubusercontent.com/Myndex/apca-w3/master/src/apca-w3.js)

### Inferences
- **Calcul local : contraste de la palette** (rapport WCAG ; APCA Lc du texte sur son fond)

  | Accent | Teinte (8 %) | accent/blanc | accent/teinte | #4D4D4D/teinte | noir/teinte | teinte/blanc | Lc accent/blanc | Lc accent/teinte | Lc #4D4D4D/teinte |
  |---|---|---|---|---|---|---|---|---|---|
  | Marine #1F4E79 | #EDF1F4 | 8,66 | 7,63 | 7,44 | 18,49 | 1,136 | 89,5 | 80,8 | 80,4 |
  | Pétrole #0B5563 | #EBF1F3 | 8,42 | 7,38 | 7,41 | 18,41 | 1,141 | 88,6 | 79,7 | 80,2 |
  | Forêt #2E5E3A | #EEF2EF | 7,56 | **6,69** | 7,48 | 18,58 | 1,130 | 86,1 | 77,7 | 80,8 |
  | Bordeaux #7B2C3F | #F4EEF0 | 9,23 | 8,06 | 7,38 | 18,33 | 1,145 | 90,6 | 81,4 | 79,9 |
  | Prune #5B3A73 | #F2EFF4 | 9,14 | 8,02 | 7,42 | 18,43 | 1,140 | 90,9 | 81,9 | 80,2 |
  | Graphite #37474F | #EFF0F1 | 9,65 | 8,46 | 7,41 | 18,40 | 1,141 | 92,3 | 83,3 | 80,1 |

  Valeurs sur blanc : #4D4D4D 8,45:1 (Lc 89,1), noir 21:1 (Lc 106,0). Le noir sur la teinte est à Lc 96,8–97,7.
- **Verdict WCAG 2.2.** Tous les couples atteignent l'AA (≥ 6,69:1). L'AAA (7:1) est atteint partout sauf pour **Forêt sur sa teinte (6,69:1)**. Or les titres de section (11,5–12 pt gras) et les titres latéraux (10,5–11 pt gras) restent sous 14 pt gras : ce ne sont pas des « grands textes ». Seul le nom (24–26 pt gras) en est un.
- **Teinte et formes.** La teinte n'atteint que 1,13–1,15:1 avec le blanc. Elle échouerait donc à 1.4.11 si elle était le **seul** indice d'appartenance d'un contenu à une zone (bandeau, colonne). Elle doit rester décorative : la structure doit se lire par la position, l'espacement et les titres. Les contours de 1 pt et l'anneau de 1,5 pt atteignent ≥ 6,69:1 sur la teinte et ≥ 7,56:1 sur le blanc. Ils passent 3:1 même si on les tenait pour porteurs d'information.
- **Accent et texte voisin.** Entre l'accent et le noir, le rapport n'est que de 2,18–2,78:1 ; entre l'accent et #4D4D4D, de **1,00–1,14:1** (calcul local). Par analogie avec G183, qui exige 3:1 quand la couleur seule distingue un texte, la couleur ne suffit pas à séparer les rôles (date, libellé, titre) du texte courant. Il faut un indice non coloré. Le modèle en fournit déjà : rôles en accent en **gras**, texte secondaire en *italique*. Ce point doit faire l'objet d'un test explicite.
- **APCA donne une réponse différente sur les teintes.** La teinte fait perdre environ 9 points de Lc à tous les textes : #4D4D4D passe de 89,1 à environ 80. En WCAG 2, le même texte passe seulement de 8,45 à 7,4:1, et tout reste confortablement conforme. Pour APCA, en revanche, un texte courant de 10–10,5 pt (13,3–14 px) est plus petit que les 18 px auxquels Lc 75 suffit. Il viserait plutôt Lc 90, d'après la table et les extraits ci-dessus, vérifiés en partie seulement. À ce compte, #4D4D4D sur la teinte (≈ 80) serait insuffisant, et sur blanc (89,1) tout juste limite. Le noir (97–106) reste très au-dessus.
- La différence teinte/blanc vaut environ Lc 6 sans écrêtage ; APCA renvoie 0 parce qu'il écrête sous Lc 10. C'est sous le palier Lc 15, seuil d'invisibilité pour certaines personnes : la teinte peut disparaître pour une partie des lecteurs, même à l'écran.
- APCA n'est pas normatif : le rapport peut l'afficher à titre informatif, jamais comme critère bloquant.
- **Accent personnalisé.** `sidebarTint()` supprime la teinte si l'accent ou #4D4D4D descend sous 4,5:1 sur elle (`packages/core/src/theme.ts`, lignes 92 à 96). Par approximation, la teinte fait perdre environ 12 % de contraste à l'accent (facteur ≈ 0,876). Un accent personnalisé situé entre 4,5 et environ 5,1:1 sur blanc perd donc sa teinte, et les pastilles passent au simple contour. Comportement voulu, mais à couvrir par un test.
- **Critères testables (section 1)** :
  - C-01 : pour chaque couple texte/fond {accent, #4D4D4D, noir} × {blanc, teinte}, rapport WCAG ≥ 4,5:1 sans arrondi, sauf pour le nom, qui est un grand texte (≥ 3:1).
    - Procédure : calcul sur les couleurs **définies** dans la projection et le thème, et non sur les pixels rendus (W3C), avec `contrastBetween()`.
    - Objectif AAA facultatif : ≥ 7:1. Forêt échoue sur la teinte.
  - C-02 : chaque objet graphique non décoratif atteint ≥ 3:1 avec sa couleur adjacente. Les aplats teintés sont déclarés décoratifs et ne servent jamais seuls à délimiter le contenu.
  - C-03 : deux rôles de texte qui ne diffèrent que par la couleur sont refusés. Toute différence de rôle passe aussi par la graisse, le style, la taille, la position ou le texte lui-même, à moins d'un écart de luminance ≥ 3:1 entre les deux couleurs (analogie G183).
    - Procédure : comparer les tuples (graisse, style, taille) de chaque rôle dans le gabarit.
  - C-04 (informatif) : afficher le Lc APCA de chaque couple, et signaler Lc < 75 pour le texte courant et Lc < 15 pour un élément censé rester visible.

### Gaps
- Je n'ai pas relu dans cette session les pages Understanding 1.4.6 et la définition « contrast ratio » de WCAG 2.2. Les seuils cités sont ceux du texte normatif connu.
- La table complète APCA taille/graisse → Lc (par exemple 14 px/400 → Lc 90, 14 px/700 → Lc 75) n'a été lue que par extraits. Le dépôt GitHub SAPC-APCA n'a pas livré le texte complet. Les seuils en px d'APCA visent l'écran, et je n'ai trouvé aucune conversion validée pour un document imprimé.
- La date d'achèvement de WCAG 3 n'est pas publiée par le W3C ; les échéances commerciales (CR fin 2027) ne sont pas vérifiées.

## 2. Accessibilité du PDF : PDF/UA, balisage, ordre de lecture, texte alternatif de la photo ; Section 508, EN 301 549, RGAA

### Takeaway
Pour un lecteur d'écran, ce qui compte est un PDF **balisé** : titres, listes, ordre de lecture logique, photo avec alternative (ou marquée décorative), aplats et anneaux en **artefacts**, titre et langue du document. Typst 0.14 balise par défaut et sait exporter en PDF/UA-1 : l'export refuse alors un document incomplet, par exemple une image sans alternative. Le wrapper du projet expose cette option sans que le code l'utilise. Le contraste n'est pas mesuré par les validateurs PDF/UA : les seuils viennent de WCAG. RGAA, EN 301 549 et la Section 508 ne s'imposent pas juridiquement au CV d'un candidat, mais servent de références.

### Cited Findings
- Typst 0.14 (24 octobre 2025) produit des PDF balisés par défaut. Un mode d'export PDF/UA-1 facultatif contrôle titre, hiérarchie des titres et alternatives ; si une erreur critique subsiste, par exemple une alternative manquante, aucun PDF n'est produit. — [Typst, blog 0.14](https://typst.app/blog/2025/typst-0.14) ; [Typst, « accessible PDF »](https://typst.app/blog/2025/accessible-pdf) ; [changelog 0.14.0](https://typst.app/docs/changelog/0.14.0)
- L'alternative se donne par le paramètre `alt` de `image`, ou par celui de `figure` pour les dessins. — [Typst, « accessible PDF »](https://typst.app/blog/2025/accessible-pdf)
- Exigences PDF/UA-1 listées par la documentation Typst : — [Typst, référence `pdf`](https://typst.app/docs/reference/pdf/)
  - déclarer la langue du document ;
  - utiliser les éléments sémantiques (titres, figures, listes) ;
  - ne pas transmettre d'information par le seul contraste, la seule couleur, le seul format ou la seule mise en page ;
  - envelopper tout élément décoratif dans `pdf.artifact()` ;
  - écrire du vrai texte plutôt que des images de texte.

  PDF/UA-1 et PDF 2.0 sont incompatibles. PDF/UA-2 n'est pas pris en charge (simple piste future). L'option CLI s'appelle `--pdf-standard`.
- Le wrapper installé (`@myriaddreamin/typst-ts-node-compiler` 0.7.0) expose `RenderPdfOpts.pdfStandard`, option expérimentale qui accepte `"ua-1"` (énumération `PdfStandard.UA_1`). Il expose aussi `pdfTags`, actif par défaut ; on peut désactiver le balisage, par exemple pour réduire la taille. — fichiers du dépôt `node_modules/@myriaddreamin/typst-ts-node-compiler/index-napi.d.ts` (vers les lignes 362 à 376) et `index.d.ts` (ligne 72)
- `packages/render/src` ne passe ni `pdfStandard` ni `pdfTags` (recherche dans le dépôt) : les PDF actuels sont balisés par défaut, mais non validés PDF/UA-1. Dans `visuel.typ`, la photo est un `image(src, width: …, height: …)` **sans `alt`** (ligne 115). — dépôt, `packages/render/templates/visuel.typ`
- Le protocole Matterhorn regroupe 136 conditions d'échec en 31 points de contrôle. — [PDFlib, Matterhorn Protocol](https://www.pdflib.com/pdf-knowledge-base/pdfua/matterhorn-protocol). Répartition : 87 conditions vérifiables par logiciel, 47 qui demandent un jugement humain, 2 sans test défini (extrait de recherche : [PowerMapper](https://www.powermapper.com/products/sortsite/rules/accmatterhorn/)). PAC (PDF Accessibility Checker), gratuit, applique le protocole Matterhorn ; veraPDF valide aussi PDF/UA-1. — [PDFlib](https://www.pdflib.com/pdf-knowledge-base/pdfua/matterhorn-protocol)
- veraPDF en ligne de commande : `verapdf -f ua1 <fichier.pdf>`. Les profils `ua1` (PDF/UA-1, pour PDF 1.7) et `ua2` (PDF/UA-2, pour PDF 2.0) sont disponibles. — [veraPDF, CLI Validation](https://docs.verapdf.org/cli/validation)
- Liquid Mode d'Acrobat Reader mobile (iOS, Android) recompose les PDF pour le téléphone. Adobe le rattache aux critères WCAG 2.1 Resize Text, Text Spacing et Reflow. Il s'appuie sur une IA, ne génère pas d'alternative pour les images et ne traite pas les formulaires. Un PDF déjà accessible dans sa mise en page d'origine peut mieux fonctionner avec un lecteur d'écran. — [Adobe Blog, 10 décembre 2020](https://blog.adobe.com/en/publish/2020/12/10/adobe-delivers-enhanced-pdf-reading-experience-for-accessibility)
- RGAA (version affichée : 4.1.2) : — [RGAA, critères et tests](https://accessibilite.numerique.gouv.fr/methode/criteres-et-tests/) ; [criteres.json du dépôt DISIC](https://raw.githubusercontent.com/DISIC/accessibilite.numerique.gouv.fr/main/RGAA/criteres.json)
  - 3.1 : l'information n'est pas donnée uniquement par la couleur.
  - 3.2 : texte non gras de moins de 24 px et texte gras de moins de 18,5 px ≥ 4,5:1 ; au-delà, ≥ 3:1. Logos, texte décoratif et éléments inactifs sont exemptés.
  - 3.3 : 3:1 pour les composants d'interface et les éléments graphiques porteurs d'information.
  - 13.3 : chaque document bureautique proposé en téléchargement a, si nécessaire, une version accessible.
- EN 301 549 V4.1.1 a été publiée le 2 septembre 2026. Elle reprend WCAG 2.2 AA pour le web, les documents et les logiciels, et appuie l'European Accessibility Act (mandat M/587). — [Deque, 8 septembre 2026](https://www.deque.com/blog/en-301-549-v4-1-1-is-final-what-changed-what-it-means-and-what-you-should-do/)
  - Désaccord sur la date de citation au JOUE : vers le 30 novembre 2026 selon [Deque](https://www.deque.com/blog/en-301-549-v4-1-1-is-final-what-changed-what-it-means-and-what-you-should-do/), le 16 décembre 2026 selon un extrait de [DWT](https://www.dwt.com/insights/2026/09/european-accessibility-act-ict-standards-update) que je n'ai pas lu en entier.
- WCAG 1.3.2 Ordre séquentiel logique (A) : quand l'ordre de présentation affecte le sens, un ordre de lecture correct doit pouvoir être déterminé par programme. — [W3C, Understanding 1.3.2](https://www.w3.org/WAI/WCAG22/Understanding/meaningful-sequence.html) (page non relue dans cette session)

### Inferences
- **Ce qui compte pour un lecteur d'écran lisant ce CV :**
  1. **Balises.** Le nom en titre de niveau 1 et les sections en niveau 2, sans saut de niveau. Les puces en vraies listes.
  2. **Ordre de lecture.** Les balises suivent l'ordre voulu (bandeau, colonne gauche, colonne principale, comme dans CLAUDE.md). L'ordre extrait par `pdftotext`, qui sert aux contrôles ATS, et l'ordre des balises lu par le lecteur d'écran sont deux choses distinctes : il faut tester les deux.
  3. **Décor.** Aplats teintés, anneau, contours de pastilles et puces décoratives deviennent des artefacts (`pdf.artifact()`). Le lecteur d'écran ne doit pas les annoncer.
  4. **Photo.** Soit une alternative courte venue de la projection (par exemple « Photo de <Nom> »), soit un artefact si on la juge redondante avec le nom. La règle « aucun texte en dur dans un .typ » impose que l'alternative vienne de `core.project()`.
  5. **Métadonnées.** Titre et langue déjà imposés (`set document(title: …)`, `set text(lang: …)`).
  6. **Polices.** Polices incorporées avec correspondance Unicode, ce que contrôlent déjà T-ATS-03 et l'extraction.
- PDF/UA n'impose aucun seuil numérique de contraste : la description Matterhorn consultée n'en mentionne pas. Il demande seulement que l'information ne dépende pas de la seule couleur, du seul contraste ou de la seule mise en forme (documentation Typst ci-dessus). Les validateurs PDF/UA ne mesurent donc pas les rapports de contraste, et les contrôles de la section 1 doivent rester dans la batterie de tests du projet.
- **Portée juridique.** RGAA vise les services publics et certaines entreprises, EN 301 549 l'achat public et l'EAA. Aucun des deux ne s'applique au CV d'un particulier. Ce sont des références de bonne pratique, et des destinataires publics peuvent apprécier un document conforme.
- **Critères testables (section 2)** :
  - P-01 : `pdfinfo cv.pdf` affiche « Tagged: yes » (Poppler, déjà requis par le projet). `pdfTags` n'est jamais à `false`.
  - P-02 : la compilation avec `pdfStandard: 'ua-1'` réussit. Typst refuse si l'alternative, le titre ou la hiérarchie des titres manque.
    - À faire : passer une alternative issue de la projection à la photo du modèle visuel, sans quoi l'export UA-1 échouera.
  - P-03 : `verapdf -f ua1 cv.pdf` ne signale aucune règle en échec.
  - P-04 : rapport PAC (interface Windows) sans erreur sur les contrôles automatiques, puis revue humaine de l'arbre logique : ordre, artefacts, titres.
  - P-05 : écoute avec NVDA et Acrobat Reader, puis avec VoiceOver iOS. Ordre annoncé = bandeau, gauche, principale ; navigation par titres possible ; aucune forme décorative annoncée.

### Gaps
- Je n'ai pas vérifié si Typst 0.14 classe automatiquement en artefacts les remplissages et contours de `block`, `box` et `grid`, ni comment il ordonne les balises d'une `grid` à deux colonnes. C'est à tester avec PAC ou veraPDF sur un PDF des fixtures.
- Je n'ai trouvé aucune ventilation officielle (texte PDF Association) des 87/47/2 conditions Matterhorn : chiffres tirés d'un extrait. Je n'ai pas non plus de source sur la version et l'éditeur actuel de PAC (PAC 2024).
- Section 508 : elle renverrait à WCAG 2.0 AA pour les contenus électroniques, documents non web compris (E205.4, [access-board.gov](https://www.access-board.gov/ict/)). Point non relu dans cette session.
- Je n'ai trouvé aucune source sur la façon dont les ATS ou les lecteurs d'écran mobiles exploitent le balisage d'un CV PDF.

## 3. Daltonisme : prévalence, types, simulation, critères de réussite

### Takeaway
Environ 8 % des hommes d'ascendance européenne et 0,4–0,5 % des femmes ont un déficit rouge-vert, la deutéranomalie en tête. Chez un daltonien, le contraste de luminance de la palette est conservé : en simulation, tous les textes restent ≥ 6,40:1. Ce qui se perd, c'est la **distinction de teinte** entre l'accent et le gris : Bordeaux en protanopie et Graphite (même en vision normale) se rapprochent du gris #4D4D4D. Pour réussir, la hiérarchie doit rester lisible sans la teinte et aucune information ne doit dépendre de la seule couleur. La simulation la plus juste passe par Viénot 1999 ou Brettel 1997 pour les dichromasies, et Machado 2009 (en RVB linéaire) pour les trichromasies anormales.

### Cited Findings
- Environ 1 homme sur 12 (8 %) et 1 femme sur 200 sont daltoniens : environ 3 millions de personnes au Royaume-Uni (≈ 4,5 %) et environ 300 millions dans le monde. — [Colour Blind Awareness](https://www.colourblindawareness.org/colour-blindness/)
  - Une personne atteinte du daltonisme rouge-vert confond toutes les couleurs qui contiennent du rouge ou du vert, par exemple le bleu et le violet.
- Environ 1 homme sur 12 a un déficit de la vision des couleurs (page mise à jour le 5 novembre 2025). — [NEI/NIH](https://www.nei.nih.gov/learn-about-eye-health/eye-conditions-and-diseases/color-blindness)
  - Le rouge-vert est le plus fréquent ; viennent ensuite le bleu-jaune, puis la forme complète, rare.
- Birch (2012, *JOSA A* 29:313–320) : environ 8 % des hommes et 0,4 % des femmes d'origine européenne ont un déficit rouge-vert. — cité par [PMC12385717](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12385717/)
- Sous-types, dans des échantillons non européens (extraits de recherche, à prendre avec prudence) :
  - Téhéran, garçons (8,18 % atteints) : deutéranomalie 4,93 %, protanomalie 1,14 %, deutéranopie 1,14 %, protanopie 0,97 % ([extrait](https://acnpsearch.tweb-dev.unibo.it/singlejournalindex/4590945)).
  - Inde : la deutéranomalie représente 58,7 % des déficits ([JCDR 2022](https://doaj.org/article/054cdcb82c8244988387b6bd782667c8)).
- Machado, Oliveira et Fernandes, « A Physiologically-based Model for Simulation of Color Vision Deficiency », *IEEE TVCG* 15(6):1291–1298, 2009. Matrices de sévérité 1,0 (dichromasie) : — [page des auteurs](https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html)

  | Type | Matrice (lignes R / V / B) |
  |---|---|
  | Protan | [0,152286 1,052583 −0,204868 ; 0,114503 0,786281 0,099216 ; −0,003882 −0,048116 1,051998] |
  | Deutan | [0,367322 0,860646 −0,227968 ; 0,280085 0,672501 0,047413 ; −0,011820 0,042940 0,968881] |
  | Tritan | [1,255528 −0,076749 −0,178779 ; −0,078411 0,930809 0,147602 ; 0,004733 0,691367 0,303900] |

  Des matrices de sévérité 0,6 sont aussi publiées. La page ne dit pas s'il faut les appliquer en RVB linéaire ou gamma.
- DaltonLens (19 octobre 2021, mis à jour en novembre 2021) : — [DaltonLens, revue des simulations open source](https://daltonlens.org/opensource-cvd-simulation/)
  - Viénot 1999, Brettel 1997 et Machado 2009 conviennent pour la protanopie et la deutéranopie ; Machado est plus fondé pour les anomalies.
  - L'implémentation originale de Machado ne décodait pas correctement le sRVB : il faut appliquer les matrices en linéaire.
  - Coblis V1 (ColorMatrix) ne doit jamais servir. Coblis V2 peut convenir pour protan et deutan, mais sa licence est restrictive.
  - Bibliothèques : libDaltonLens (C, un seul fichier) et DaltonLens-Python (testée).
  - Ces modèles décrivent un observateur moyen, malgré de fortes variations individuelles.
- Chrome DevTools émule l'achromatopsie, la vision floue, la deutéranopie, la protanopie et la tritanopie (panneau Rendering), avec des matrices fondées sur Machado et al. L'effet s'applique à toute la page (article de M. Bynens, mis à jour le 2025-07-04). — [Chrome for Developers](https://developer.chrome.com/blog/cvd)

### Inferences
- **Calcul local : Machado sévérité 1,0, en RVB linéaire.**
  - Contraste conservé partout. Accent simulé sur blanc : 7,22 à 10,72:1. Sur la teinte simulée : 6,40:1 au minimum (Forêt en protanopie).
  - Écart de couleur ΔE00 entre l'accent simulé et #4D4D4D simulé, valeurs les plus faibles : Bordeaux 5,1 (protan) et 8,4 (deutan) ; Graphite 5,8 (protan), 7,6 (deutan) et 11,3 (tritan) ; Pétrole 9,4 (protan).
  - En vision normale, Graphite et #4D4D4D ne sont qu'à ΔE00 8,2. Les autres accents en sont à 16,8–23,3.
  - Les ΔE00 vont de 5 à 10 : la teinte seule sépare mal ces paires. Le gras et l'italique restent nécessaires.
- La couleur de la teinte (rose pâle, vert pâle…) disparaît presque pour un dichromate. Seule compte sa clarté, qui ne porte aucune information (section 1).
- **Critères testables (section 3)** :
  - D-01 : rendre le PDF en PNG (`pdftoppm -r 150 -png`), puis simuler protanopie, deutéranopie et tritanopie (Viénot ou Brettel via DaltonLens, ou Machado 1,0 en linéaire), la protanomalie et la deutéranomalie (Machado 0,6) et l'achromatopsie (niveaux de gris).
  - D-02 : dans chaque simulation, chaque couple texte/fond reste ≥ 4,5:1, calculé sur les couleurs **simulées** des styles et non sur les pixels.
  - D-03 : chaque distinction de rôle reste visible sans la teinte (C-03). Aucune légende, aucun niveau de compétence, aucun état n'est codé par la seule couleur, ce qui vaut pour toute évolution future du modèle.
  - D-04 (informatif) : afficher le ΔE00 entre l'accent et #4D4D4D simulés, et prévenir si l'utilisateur choisit un accent à ΔE00 < 10 du gris en vision normale (cas de Graphite).

### Gaps
- Je n'ai pas vérifié que l'émulation de DevTools s'applique au lecteur PDF intégré de Chrome (PDFium). Pour plus de sûreté, ouvrir un rendu PNG ou passer par une simulation scriptée.
- Je n'ai pas lu la documentation de Sim Daltonism (macOS/iOS) ni celle du simulateur de Firefox.
- Il n'existe pas de seuil normatif de ΔE pour « distinguable par un daltonien » ; D-04 reste informatif.

## 4. Niveaux de gris, photocopie et impression bureautique : teintes claires, traits fins, texte coloré

### Takeaway
En niveaux de gris, la palette donne trois tons. Le noir reste noir ; l'accent et #4D4D4D deviennent **le même gris** (≈ 70–75 %), le rapport entre eux tombant à 1,00–1,14:1 ; la teinte devient un gris d'environ 6 %. Le texte reste lisible : ≥ 7,5:1 sur la teinte grisée. En revanche :
1. La teinte est bien sous le minimum de trame imprimable conseillé (15 %), et les copieurs la suppriment souvent (suppression du fond).
2. Les traits colorés de 1 pt, imprimés en trame grise, sont **exactement** au minimum conseillé (1 pt) et passent dessous si l'impression réduit la page (A4 sur Letter : 0,94 pt).
3. Beaucoup de pilotes proposent d'imprimer tout le texte en noir, ce qui efface toute hiérarchie fondée sur la couleur.

La hiérarchie doit donc reposer sur la graisse, la taille et la position.

### Cited Findings
- Pillow convertit en gris (mode « L ») avec la luma ITU-R 601-2 : L = R × 299/1000 + G × 587/1000 + B × 114/1000. — [Pillow, Image.convert](https://pillow.readthedocs.io/en/stable/reference/Image.html)
- Guide graphique de l'AMS (« Creating graphics for use in AMS books and journals »), paraphrasé : — [AMS (accès direct refusé, 403)](https://community.ams.org/arc/graphics/graphics-guidelines.pdf) ; texte lu sur la [copie hébergée par l'Ohio State University](https://people.math.osu.edu/joshua.1/creating-graphics.pdf)
  - pas de filet de moins de 0,5 pt à 100 % : sous 0,5 pt, il disparaît à l'impression. Un filet de 0,5 pt réduit à 50 % ne fait plus que 0,25 pt ;
  - une ligne grise (tramée) doit faire au moins 1 pt, sinon la trame de points la rend cassée et dentelée ;
  - les trames restent entre 15 % et 85 % : au-delà, elles sont trop claires ou trop sombres pour s'imprimer correctement ;
  - les paliers de trame sont espacés d'au moins 10 %, faute de quoi on ne les distingue pas ;
  - pas de texte sur une trame de plus de 35 % ;
  - le texte blanc n'est admis que sur un noir à 100 %.
- Penn State University Press (« Preparing Charts and Graphs: Exhibit B ») : — [PSU Press](https://www.psupress.org/books/author_resources/author_digsub/charts_exhibitB.html)
  - les filets doivent faire entre 1 et 2 pt dans l'original grand format, car un filet fin peut pâlir ;
  - les trames de 20 %, 50 % et 80 % restent distinguables.
- Brevet Sharp US6995866B2 (déposé le 14 mars 2001, publié le 7 février 2006) : la plupart des copieurs suppriment le fond sur la seule composante de clarté. Les pixels de fond clairs sont ramenés au blanc, et un surlignage clair autour du texte n'est pas reproduit. — [Google Patents](https://patents.google.com/patent/US6995866B2/en)
  - Voir aussi d'autres brevets de suppression automatique du fond : [US6323957](https://patents.google.com/patent/US6323957) et [US10178280](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10178280).
- Options de pilotes d'imprimante qui forcent le texte coloré en noir :
  - HP : « Print All Text as Black », disponible sur tous les pilotes HP, convertit le texte en couleur en noir ([HP](https://support.hp.com/si-en/document/c01815794)) ;
  - Ricoh : option conseillée quand le texte coloré sort pâle ([Ricoh](https://manuals.ricoh.com/driver/pcl6v4/help/en/HTMLFILE%5CIDH_HOW_BLACK_PRINTING.htm)) ;
  - Xerox : « Print Colored Text in Black » rend le texte coloré en noir plein plutôt qu'en gris ([Xerox](https://office.xerox.com/userdoc/FAM_P2/driverhelp/print_colored_text_black.html)).
- Zone non imprimable de l'imprimante laser Brother HL-L8245CDW : 4,2 mm (0,16 in) en haut et en bas, en A4, Letter et Legal. — [Brother](https://support.brother.com/g/s/id/htmldoc/printer/hll8245cdw/use/html/GUID-1BBF837B-7708-4FCB-8F03-EBC668571B9F_1.html)
  - Sur un forum HP, on cite environ 4 mm sur tous les bords pour les LaserJet, environ 2 mm en mode bord à bord, et l'impossibilité d'un vrai sans-marge en laser ([forum HP, source communautaire](https://h30434.www3.hp.com/t5/LaserJet-Printing/Borderless-printing/td-p/6151769)).
- Conseils carrière sur le noir et blanc :
  - choisir une couleur qui reste visible imprimée en noir et blanc ; le jaune, le gris et les teintes claires deviennent difficiles à lire ([North Island College, 1er septembre 2020](https://www.nic.bc.ca/about/news/stories/colour-on-resume.html)) ;
  - imprimer son CV en noir et blanc pour le tester, et éviter les fonds colorés qui compliquent l'impression ([Welcome to the Jungle, 31 mars 2022](https://www.welcometothejungle.com/fr/articles/ux-design-cv-postuler-conseils)) ;
  - « Si votre CV est imprimé en noir et blanc, il faut qu'il reste lisible » ([l'Etudiant, mis à jour le 25 novembre 2025](https://www.letudiant.fr/jobsstages/lettres-de-motivation_1/quelle-couleur-pour-un-cv.html)).

### Inferences
- **Calcul local : conversion en gris** (trame K % = 1 − gris/255 ; « 601 » = luma Rec. 601 ; « lum » = gris de même luminance relative)

  | Accent | accent → gris 601 (K %) | accent → gris lum (K %) | teinte → gris (K %) | contraste gris accent/teinte | ΔE00 gris accent/gris #4D4D4D | ΔE00 gris accent/noir |
  |---|---|---|---|---|---|---|
  | Marine | #454545 (72,9) | #4B4B4B (70,6) | 5,9 | 8,41 | 2,7 (601) / 0,7 (lum) | 19,2 |
  | Pétrole | #404040 (74,9) | #4D4D4D (69,8) | 6,3 / 5,9 | 9,02 | 4,4 / 0,0 | 17,6 |
  | Forêt | #4C4C4C (70,2) | #545454 (67,1) | 5,9 / 5,5 | 7,54 | 0,3 / 2,4 | 21,5 |
  | Bordeaux | #464646 (72,5) | #474747 (72,2) | 5,9 / 6,3 | 8,28 | 2,4 / 2,0 | 19,5 |
  | Prune | #4A4A4A (71,0) | #484848 (71,8) | 5,9 | 7,78 | 1,0 / 1,7 | 20,8 |
  | Graphite | #434343 (73,7) | #454545 (72,9) | 5,9 | 8,68 | 3,4 / 2,7 | 18,5 |

  Le gris #4D4D4D vaut lui-même 69,8 %.
- **Lecture du tableau.**
  - Le texte reste lisible en gris : ≥ 7,54:1 sur la teinte grisée.
  - L'accent et #4D4D4D deviennent indiscernables (ΔE00 de 0 à 4,4). Les dates, libellés, titres et le nom en accent ne se distinguent plus du texte secondaire que par le **gras**, l'*italique* et la taille.
  - L'accent reste nettement plus clair que le noir du texte courant (ΔE00 17,6–21,5).
- **Ce qui peut mal tourner avec les teintes claires.**
  - La teinte (≈ 6 %) est bien sous le plancher de 15 % de l'AMS. À l'impression laser, on peut obtenir un aplat granuleux, irrégulier ou absent.
  - À la photocopie, la suppression du fond la ramène très probablement au blanc. Bandeau, colonne et pastilles disparaissent alors ; le texte reste.
  - Ce n'est acceptable que si la structure se lit sans la teinte (C-02).
  - Pour qu'elle survive avec ≥ 15 % de gris, il faudrait une part d'accent d'environ 0,21 :
    - 0,20 donne 14,1–14,9 % de gris ; 0,25 donne 17,6–18,4 % ;
    - à 0,25, tous les textes restent ≥ 5,09:1 (AA), mais l'AAA est perdu partout et la consommation de toner triple (section 7) ;
    - la règle AMS des paliers d'au moins 10 % plaide dans le même sens : sous 10 %, l'écart avec le blanc risque de ne pas se voir.
- **Ce qui peut mal tourner avec les traits fins.**
  - Les contours de 1 pt, imprimés en gris tramé à 70–75 %, sont pile au minimum AMS de 1 pt pour une ligne tramée. L'anneau de 1,5 pt passe.
  - Une impression A4 sur Letter « ajustée » réduit tout à 0,9407 : 1 pt devient 0,94 pt. Une impression réduite aux marges non imprimables d'environ 4,2 mm, qui demande un facteur de 0,96 en largeur, donne 0,96 pt.
  - Pour garder ≥ 1 pt après ces réductions, viser ≥ 1,1 pt. Ce seuil est déduit des sources, non publié.
  - Sur une imprimante couleur, un trait d'accent est composé de plusieurs encres. Son rendu dépend du repérage, point non sourcé (voir Gaps).
- **Ce qui peut mal tourner avec le texte coloré.**
  - Le texte en accent ou en #4D4D4D sort comme une trame à environ 70 %. Par analogie avec la règle AMS sur les lignes grises, des bords dentelés sont possibles en petit corps, et Ricoh documente le cas du texte coloré qui sort pâle.
  - Avec l'option « tout le texte en noir » (HP, Ricoh, Xerox), toute différence de couleur disparaît.
  - Corps minimal après réduction : 9 pt × 0,9407 = **8,47 pt** sur Letter, 8,64 pt une fois réduit aux marges. C'est sous la règle du projet « aucun texte < 9 pt » quand le PDF A4 est imprimé ajusté.
- **Bord de page.** Avec la zone non imprimable d'environ 4,2 mm, les aplats à fond perdu (bandeau, colonne) gardent un liseré blanc, ou l'utilisateur réduit la page. Le texte n'est pas touché, puisque les marges de texte font ≥ 1,5 cm.
- **Désaccord entre sources.** Pour JobTeaser, le jaune reste visible à l'impression ; North Island College et Welcome to the Jungle le déconseillent. Calcul local : #FFFF00 sur blanc = 1,07:1, et 11 % de gris en luma 601. Les seconds ont raison pour le noir et blanc.
- **Critères testables (section 4)** :
  - G-01 : rendu en gris avec `pdftoppm -r 300 -gray cv.pdf out` (Poppler), ou avec Ghostscript `-sDEVICE=pnggray -r300`, ou par conversion PNG puis luma 601 (Pillow « L »). Dans chaque conversion, (a) chaque texte reste ≥ 4,5:1 sur son fond gris, calculé sur les couleurs des styles ; (b) chaque distinction de rôle tient sans la couleur (C-03).
  - G-02 : simuler la photocopie en ramenant au blanc tout pixel de luma ≥ 235 (seuil à régler, propre à chaque appareil). Vérifier qu'on retrouve encore les sections et la séparation des colonnes : titres, espacement, alignements.
  - G-03 : simuler « tout le texte en noir » en compilant le gabarit avec un thème où accent et texte secondaire valent #000000 (21:1, donc accepté par `accentProblem`). Les titres, dates et libellés doivent rester repérables par la graisse, la taille ou la position.
  - G-04 : inventaire des traits (`stroke`) du gabarit, avec ces seuils après la réduction la plus forte (0,9407) :
    - trait noir plein ≥ 0,5 pt ;
    - trait coloré ou gris ≥ 1 pt (d'où ≥ 1,07 pt au dessin) ;
    - aucun trait sous 0,5 pt.
  - G-05 : teinte. Soit elle est déclarée décorative (artefact, aucune information), et l'on accepte qu'elle disparaisse : c'est le cas actuel. Soit on exige qu'elle survive à l'impression, et sa trame en gris 601 doit atteindre ≥ 15 % (part ≥ 0,21) avec C-01 toujours vrai.
  - G-06 : texte ≥ 9 pt à l'échelle 0,9407, ou bien documenter que l'impression ajustée sur Letter descend à 8,5 pt.

### Gaps
- Je n'ai trouvé aucune source primaire pour le seuil de 5 ou 10 % sous lequel une teinte disparaîtrait. L'AMS donne 15 % ; un extrait de recherche cite 10 % sans source identifiable.
- Je n'ai trouvé aucune source sur la conversion des couleurs en gris par les pilotes de bureau et par l'impression en niveaux de gris d'Acrobat (luma 601, colorimétrie ICC, moyenne simple). Pour ces accents sombres, les deux conversions testées divergent de moins de 5 points de gris.
- Je n'ai pas lu de source primaire sur le repérage CMJN du petit texte coloré ni sur les traits fins composés de plusieurs encres. Les guides de prépresse trouvés (texte ≤ 8 pt en noir 100 % seulement) ne sont connus que par des extraits ; [4over4](https://help.4over4.com/en/articles/8324299-typography-text-and-line-art) était injoignable.
- Je n'ai trouvé aucune donnée sur les seuils de suppression du fond ni sur le mode texte/photo des copieurs de bureau (qui peuvent seuiller le texte gris en noir ou l'éclaircir), ni sur l'effet des modes « économie de toner ».
- Je n'ai pas de données mesurées sur la largeur des cellules de trame d'une laser 600 ppp ; à 600 ppp, un trait de 1 pt fait environ 8 points machine.

## 5. Lisibilité à l'écran : téléphone, ordinateur à 100 %, aperçus ATS

### Takeaway
À 100 %, 1 pt = 1,333 px CSS : un corps de 10 pt donne 13,3 px et 10,5 pt donne 14 px, au-dessus du repère de 12 px de Lighthouse. Sur un téléphone, une page A4 ajustée à la largeur réduit 10 pt à **6–7 px CSS**. Il faut zoomer d'environ 1,7 à 2 fois et faire défiler latéralement entre les deux colonnes. Les traits de 1 pt tombent sous 1 px, donc s'éclaircissent par anticrénelage. Le texte réellement recomposé sur téléphone dépend du balisage (Liquid Mode). Je n'ai trouvé aucune source sur le rendu des PDF dans les aperçus des ATS.

### Cited Findings
- 1 pt = 1,333 px CSS. — [W3C, Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- Sous 12 px, un texte est souvent difficile à lire sur mobile et oblige à zoomer. Lighthouse signale une page dont au moins 40 % du texte est sous 12 px, et recommande au moins 12 px pour 60 % du texte. — [Chrome for Developers, Lighthouse « font-size »](https://developer.chrome.com/docs/lighthouse/seo/font-size)
- Liquid Mode (Acrobat Reader iOS et Android) recompose le contenu à la largeur de l'écran ; voir la section 2 pour ses limites. — [Adobe Blog, 10 décembre 2020](https://blog.adobe.com/en/publish/2020/12/10/adobe-delivers-enhanced-pdf-reading-experience-for-accessibility)
- L'anticrénelage rend les traits et les polices fins plus pâles que leur couleur définie. — [W3C, Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) ; [Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

### Inferences
- **Calcul local : page A4 (793,7 px CSS de large à 100 %) ajustée à la largeur du téléphone**

  | Corps | à 100 % | vue de 360 px | 390 px | 412 px | 430 px | zoom pour 12 px |
  |---|---|---|---|---|---|---|
  | 9 pt | 12,0 px | 5,4 px | 5,9 px | 6,2 px | 6,5 px | × 1,85–2,20 |
  | 10 pt | 13,3 px | 6,0 px | 6,6 px | 6,9 px | 7,2 px | × 1,66–1,98 |
  | 10,5 pt | 14,0 px | 6,3 px | 6,9 px | 7,3 px | 7,6 px | × 1,58–1,89 |
  | 12 pt | 16,0 px | 7,3 px | 7,9 px | 8,3 px | 8,7 px | × 1,38–1,65 |

  Un trait de 1 pt (1,33 px à 100 %) ne fait plus que 0,6–0,7 px ajusté : il est rendu en gris plus clair.
- **Sur ordinateur à 100 %**, la page fait environ 794 px CSS de large et tient dans une fenêtre de 1366 ou 1920 px. Le corps de 10–10,5 pt (13,3–14 px) passe le repère de 12 px. Les éléments de 9 pt sont pile à 12 px.
- **Conséquence sur téléphone.** Aucune taille de corps compatible avec une page A4 ne passe le repère de 12 px en vue ajustée. L'amélioration passe par le balisage (recomposition) et par une structure qui reste lisible une fois zoomée : la colonne principale doit pouvoir se lire seule.
- **Critères testables (section 5)** :
  - E-01 : taille effective en px CSS = pt × 4/3 × (largeur de vue / 793,7). À 100 %, au moins 60 % du texte doit dépasser 12 px (repère Lighthouse appliqué au PDF). Avec un corps de 10 pt, c'est le cas.
  - E-02 : les éléments graphiques sémantiques font ≥ 1 pt. Aucune information ne repose sur un trait que la vue ajustée ramène sous 1 px.
  - E-03 : contrôle manuel dans Acrobat Reader mobile en Liquid Mode, dans le lecteur intégré iOS ou Android, et dans Chrome ou Firefox sur ordinateur à 100 %. Résultat attendu : texte complet, ordre logique, aucun aplat rendu en artefact visible.

### Gaps
- Je n'ai trouvé aucune source sur la définition du « 100 % » propre à chaque lecteur : Acrobat sous Windows (résolution système ou 72 ppp), PDFium de Chrome, pdf.js, Aperçu sur macOS.
- Je n'ai trouvé aucune source sur l'affichage des PDF dans les aperçus d'ATS (Workday, Greenhouse, Lever, Taleo, SmartRecruiters) : résolution, vignettes, gris, ou texte analysé seulement. Le projet présente d'ailleurs le modèle visuel comme « déconseillé pour les portails ATS ».
- Je n'ai pas consulté de recommandations de taille minimale propres aux plateformes (Apple HIG, Material Design) dans cette session.

## 6. Usage de la couleur dans un CV : sources design, RH et emploi (FR et EN)

### Takeaway
Les sources convergent : **une couleur d'accent** (deux ou trois au plus), en plus du noir et d'un gris. Elle sert au nom, aux titres, aux filets et aux informations clés, pas au texte courant, qui reste noir. Le CV doit rester lisible imprimé en noir et blanc. Il faut éviter le jaune, les teintes claires pour le texte et les fonds colorés. Les attentes changent selon le secteur : la couleur est presque attendue dans les métiers créatifs, et les secteurs traditionnels demandent de la sobriété. Les recruteurs sont partagés. Aucune source vérifiable ne quantifie leur préférence ; la statistique de 71 % qui circule n'a pas de source identifiable.

### Cited Findings
- **North Island College** (Student Employment Services, 1er septembre 2020) : — [NIC](https://www.nic.bc.ca/about/news/stories/colour-on-resume.html)
  - garder l'essentiel du texte en noir ;
  - réserver la couleur, avec parcimonie, au nom, aux titres ou aux filets ;
  - choisir une couleur visible en noir et blanc ; le jaune, le gris et les teintes claires sont à éviter ;
  - user du rouge avec parcimonie ;
  - se demander si l'employeur attend de la créativité ou de la tradition.
- **Welcome to the Jungle** (Paul Herbert, conseils d'une designer UX, 31 mars 2022) : — [WTTJ](https://www.welcometothejungle.com/fr/articles/ux-design-cv-postuler-conseils)
  - une seule couleur d'accent pour l'information à retenir : l'intitulé du poste pour un profil senior, le nom de l'entreprise pour un junior ;
  - le noir pour l'information moyenne, le gris pour le complémentaire ;
  - éviter le jaune et les fonds qui gênent la lecture ;
  - tester l'impression en noir et blanc et éviter les fonds colorés ;
  - trois tailles de texte au plus, une ou deux polices.
- **Welcome to the Jungle** (Ingrid, 17 mai 2017) : trois couleurs au plus, une seule police, un corps de 10 à 12 et un interlignage de 1,5. — [WTTJ](https://www.welcometothejungle.com/fr/articles/reussir-mise-en-page-cv)
- **l'Etudiant** (mis à jour le 25 novembre 2025) : — [l'Etudiant](https://www.letudiant.fr/jobsstages/lettres-de-motivation_1/quelle-couleur-pour-un-cv.html)
  - deux couleurs complémentaires au plus, pour l'accroche, les titres de section, les pictogrammes et les rubriques importantes ;
  - rester lisible en noir et blanc ;
  - ne pas transformer un titre en image pour lui donner un fond coloré ;
  - couleurs suggérées par secteur : le bleu partout, le rouge pour la banque, la finance et l'ingénierie, le vert pour l'écologie et le bien-être.
- **JobTeaser** (Selma, 23 juin 2025) : — [JobTeaser](https://www.jobteaser.com/fr/advices/quelles-couleurs-choisir-pour-son-cv)
  - trois couleurs au plus, en touches, notamment dans les titres ;
  - éviter le fluo, le rouge (sauf en finance) et le rose ;
  - un CV multicolore donne une impression de désorganisation ;
  - le jaune resterait visible à l'impression, ce que contredisent NIC et WTTJ (section 4).
- **graphiste.com** (Aude Marty, date relative affichée de trois mois, donc vers mi-2026) : — [graphiste.com](https://graphiste.com/blog/?p=10196)
  - certains recruteurs écartent les CV colorés, qu'ils jugent destinés à masquer un contenu faible ;
  - d'autres acceptent la couleur quand elle sert le contenu ;
  - trois couleurs au plus (fond blanc, texte noir, un accent) ;
  - éviter les couleurs claires pour le texte ;
  - dans les métiers créatifs, la couleur est quasi indispensable.
- ActuaLitté (22 mars 2025) recommande des couleurs subtiles, sans statistique sourcée. — [ActuaLitté](https://actualitte.com/article/122744/ressources/des-guides-pour-comprendre-comment-le-design-de-cv-influence-la-perception-des-candidats)

### Inferences
- **Conformité du design aux conventions.** Le design (un accent, texte noir, #4D4D4D pour le secondaire, couleur pour le nom, les titres, les dates et les libellés) suit la convention majoritaire.
- **Point de friction.** Les aplats teintés du bandeau et de la colonne vont contre le conseil de WTTJ UX d'éviter les fonds colorés. Leur clarté (≈ 6 % de gris) limite la gêne de lecture et le coût d'impression, mais ils disparaissent à la photocopie (section 4).
- **Rouge et bordeaux.** Les sources jugent le rouge très marqué ou le réservent à certains secteurs. Bordeaux (#7B2C3F) est un rouge très assombri. Aucune source ne traite des rouges sombres.
- **Critères testables (section 6)** :
  - U-01 : une seule teinte chromatique (l'accent et ses teintes), plus des neutres (noir, #4D4D4D, blanc).
  - U-02 : le texte courant est noir ; l'accent ne sert qu'au nom, aux titres, aux dates, aux libellés et aux puces.
  - U-03 : l'accent et le texte ne sont jamais jaunes ni clairs. Ce point est déjà garanti par `accentProblem` (≥ 4,5:1 sur blanc).
  - U-04 : le test noir et blanc G-01 est passé.

### Gaps
- Je n'ai trouvé ni étude chiffrée ni enquête sourcée sur la préférence des recruteurs français pour les CV colorés. Un extrait de recherche attribue aux recruteurs 71 % de préférence pour les CV formels et 7 % pour les designs créatifs, sans source vérifiable ; ces chiffres ne sont ni chez l'Etudiant ni chez ActuaLitté.
- Je n'ai trouvé aucune page APEC, Cadremploi, HelloWork ou Indeed France consacrée à la couleur : les recherches ont renvoyé vers d'autres sites. Je n'ai rien trouvé non plus sur les attentes propres à l'ingénierie ou à la santé (dispositifs médicaux), hormis la suggestion isolée et non argumentée de l'Etudiant d'associer le rouge à l'ingénierie.
- L'idée que les DRH imprimeraient souvent leurs e-mails en noir et blanc vient d'un extrait de recherche sans auteur identifiable. Je n'ai aucune donnée sur la part des CV imprimés par les recruteurs.
- Je n'ai pas lu les guides de Canva, de Smashing Magazine ni des services carrière universitaires français dans cette session.

## 7. Encre et toner : conception « imprimable » et grandes surfaces colorées

### Takeaway
Le rendement des toners se mesure sur une page de référence couverte à environ 5 % (ISO/IEC 19752). Un aplat clair à environ 6 % de gris sur une grande surface ajoute une consommation mesurable, sans excès. Si l'on fonçait la teinte pour qu'elle survive à l'impression (≥ 15 %), la consommation de ces zones triplerait. Les copieurs suppriment volontairement les fonds clairs, notamment pour économiser le toner. Les aplats à fond perdu ne s'impriment pas jusqu'au bord sur les lasers de bureau (≈ 4 mm).

### Cited Findings
- ISO/IEC 19752 (2004, révisée en 2017) fixe la méthode de mesure du rendement des cartouches de toner monochromes, avec une page d'essai couverte à environ 5 %. — [Wikipédia, ISO/IEC 19752](https://en.wikipedia.org/wiki/ISO/IEC_19752) ; [Ricoh, page yield (extrait)](https://ricoh.com/printers/supply/PageYield)
- La suppression du fond évite de reproduire un support coloré ou recyclé, et d'y dépenser du toner (extrait de brevet). — [US10178280](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10178280) ; [US6995866B2](https://patents.google.com/patent/US6995866B2/en)
- Éviter les fonds colorés qui compliquent l'impression. — [WTTJ, 31 mars 2022](https://www.welcometothejungle.com/fr/articles/ux-design-cv-postuler-conseils)
- Zone non imprimable d'environ 4,2 mm sur une laser de bureau. — [Brother](https://support.brother.com/g/s/id/htmldoc/printer/hll8245cdw/use/html/GUID-1BBF837B-7708-4FCB-8F03-EBC668571B9F_1.html)

### Inferences
- **Estimation de la couverture.** Couverture ajoutée par la teinte ≈ (surface teintée / surface de la page) × trame de la teinte.
  - Hypothèse non mesurée : bandeau, colonne et pastilles couvrent 35 % de la page.
  - Teinte actuelle (≈ 6 %) : environ +2,1 points de couverture, soit 40 % de la page de référence ISO.
  - Teinte à 25 % d'accent (≈ 18 %) : environ +6,3 points, plus que la page de référence entière.
  - Le texte d'une page de CV dense ajoute sa propre couverture.
  - La couverture réelle n'est pas proportionnelle au niveau de gris (engraissement du point) : ce n'est qu'un ordre de grandeur.
- **Imprimable et visible.** Une teinte claire économise le toner mais ne survit pas à l'impression ; une teinte qui survit coûte trois fois plus. Pour un CV appelé à être imprimé et photocopié, la teinte doit rester décorative et la structure tenir sans elle (G-02, G-05).
- **Critères testables (section 7)** :
  - T-01 : couverture estimée = moyenne de (1 − gris/255) sur le rendu `pdftoppm -r 300 -gray`, comparée aux 5 % de référence ISO. Pour un CV, l'objectif conseillé (non normatif) est de rester de l'ordre de la page de référence.
  - T-02 : aucun contenu ni information dans les 4,2 mm du bord. Les aplats à fond perdu sont acceptés comme coupés à l'impression.

### Gaps
- Je n'ai pas de mesure réelle de la surface teintée du modèle visuel, ni de la couverture d'un CV type. T-01 est à exécuter sur un PDF rendu à partir des fixtures, jamais sur les données réelles.
- Je n'ai trouvé aucune source sur le comportement du mode « économie de toner » ou « brouillon » face aux teintes claires et au texte gris. Je n'ai pas lu non plus la norme couleur correspondante (ISO/IEC 19798).
