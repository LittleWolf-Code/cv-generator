# ADR 0007 — Gabarit `ats-classique`, projection et police Carlito

- **Date** : 05/10/2026
- **Statut** : accepté
- **Contexte** : ATS-01 à ATS-17, §5, §8.5, F-MOD-01/02, F-EXP-02.

## Gabarit

- `packages/render/templates/ats-classique.typ` est écrit **entièrement en mode code** : aucun texte, pas même une ponctuation. Libellés, intitulés et séparateurs (« : », « , », « | », espace avant `h(1fr)`) viennent de la projection (`punct`, `labels`). Aucune chaîne littérale ne contient de lettre ni de chiffre : T-ATS-17 le vérifie avec un petit analyseur (mode balisage / mode code, chaînes, commentaires, étiquettes).
- Réglages : `fallback: false`, `hyphenate: false`, `ligatures: false`, `tracking: 0pt`, `smartquote(enabled: false)`, `par(justify: false)`, `document(date: none)`, marges ≥ 1,5 cm, corps 10,5 pt (normale) ou 10 pt (compacte).
- Entrée : ligne 1 = intitulé en gras + espace + `h(1fr)` + `box(dates)` ; ligne 2 = organisation, ville, pays (italique) ; puis les puces (`list`, puce « • » par défaut de Typst). Ni `grid`, ni `table`, ni `place`.
- Intitulés de section : `heading(level: 1)` (balisage PDF), avec un filet sous l'intitulé (décor sans texte).
- Blocs insécables (`box`) calculés par `segmentText` : normes et règlements (« NF EN ISO 13485:2016 », « MDR (UE) 2017/745 »), termes protégés (`C++`, `CI/CD`…), `short` des compétences, mots composés avec `-`, `–`, `/` ou `@`, nombres groupés (« 1 200 »), pourcentages (« 45 % »), plages d'années écrites dans un texte.

## Choix de présentation (cahier muet)

- Contrat : rien pour un CDI ; sinon entre parenthèses après l'intitulé : « Ingénieure R&D (stage) ».
- Compétences : une ligne par catégorie, « Libellé : a, b, c » ; la forme longue suit le sigle à chaque occurrence dans la section (ATS-18).
- Langues : une seule ligne, éléments séparés par « | » (« Français : langue maternelle | Anglais : C1 (TOEIC 945, 2025) »).
- Centres d'intérêt : une ligne, séparés par des virgules.
- Formation : « Diplôme, spécialité (équivalence de niveau) » sur la ligne de l'intitulé ; mention dans la ligne 2.
- Permis et autorisation de travail : une ligne dans Compétences avec le texte bilingue saisi.

## Police

Carlito (OFL 1.1, mêmes métriques que Calibri), TTF **statiques** (aucun axe variable, vérifié avec fontkit) téléchargés du dépôt officiel `googlefonts/carlito`, commit `3a810cab78ebd6e2e4eed42af9e8453c4f9b850a` :

| Fichier                | SHA-256                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| Carlito-Regular.ttf    | `f6418f708baede9789daef5d458c0f53d2a888af9820e8062934e504fedc6595` |
| Carlito-Bold.ttf       | `bb5d20f79b82599ec72983597437373a80f2d2085fa91fc144fd74e876a594db` |
| Carlito-Italic.ttf     | `0b019225e58d702bfedcbd35c21696769f8ee115cb6343f84c2f240312450d1c` |
| Carlito-BoldItalic.ttf | `b32928186c119599e03ca6a1ffc680fdcb7fac95772f4b95d989cf6cd3861517` |
| OFL.txt                | `58402f82a7c332a700294988fe7554fbb0a63a8d27ccc1ee3bbc640311990a00` |

## DOCX minimal

Même projection ; styles natifs (`Heading 1`), tabulation droite à la largeur utile pour les dates, puces « • » sur un niveau, police déclarée « Calibri », aucune police incorporée, aucun en-tête ni pied de page, liens = URL affichées. T-DOCX-01 et 02 au vert sur les trois fixtures ; T-DOCX-03 orange (LibreOffice absent).
