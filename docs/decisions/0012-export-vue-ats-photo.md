# ADR 0012 — Export, vue « ce que voit l'ATS » et photo

- **Date** : 05/10/2026
- **Statut** : accepté
- **Contexte** : lot 3 ; F-EXP-01 à 04, F-ATS-01 à 04 et 06, T-DOCX-01 à 03, F-UI-06, ATS-15, §5.2 (photo), §5.4, §8.5, annexes B.4 et B.5. Le cahier est muet sur trois points, tranchés par l'utilisateur le 05/10/2026 (marqués « décision utilisateur »).

## Export (F-EXP-01, ATS-15, T-ATS-13)

- **Destination** (décision utilisateur : les deux). Le navigateur télécharge le fichier sous son nom normalisé, et le serveur garde une **copie horodatée** dans `out/exports/<preset>/<AAAAMMJJ-HHmmss>[-n]_<modèle>/`, avec une trace `export.json` : date, langue, `enVariant`, modèle, pages, photo, résultat de l'ATS-check (`ok` ou `orange`), statut de chaque critère et les deux SHA-256. Le dossier n'est jamais réutilisé et le fichier est écrit avec `flag: 'wx'` : aucun export n'en écrase un autre. Au lot 4, la copie ira dans `exports/` de la candidature (F-CAN-03).
- **Déroulé** :
  1. l'interface enregistre le preset (enregistrement en attente forcé) ; en cas de conflit ou d'erreur, l'export est refusé avec ce motif ;
  2. elle attend que l'aperçu soit celui du dernier brouillon (aucun rendu en attente ni en cours), puis prend le **tampon chargé par la visionneuse pdf.js** et son SHA-256 (Web Crypto) ;
  3. elle refuse aussitôt si le rapport de cet aperçu contient un motif bloquant ;
  4. `POST /api/export { presetId, format, previewSha256 }` recompile le preset **enregistré**. Le rendu est déterministe (NF-08) : un SHA-256 différent signifie que l'aperçu affiché n'est pas le preset enregistré, donc **409 `PREVIEW_MISMATCH`**, T-ATS-13 rouge et rafraîchissement de l'aperçu. Un rapport bloquant donne **422 `EXPORT_BLOCKED`** avec le rapport : le serveur bloque lui aussi, l'interface n'est pas la seule barrière ;
  5. le serveur écrit la copie, la **relit** et calcule son SHA-256 ;
  6. pour un PDF, le navigateur télécharge **le tampon affiché lui-même** (`Blob` construit sur ces octets) après avoir vérifié que le `Blob` et la copie du serveur ont l'empreinte de l'aperçu. Sinon, T-ATS-13 est rouge et rien n'est téléchargé.
- **« Dernier aperçu affiché »** (précision) : c'est le tampon **chargé par la visionneuse**, au moment où elle remplace les pages précédentes, et non la fin de la peinture des pages. La peinture de pdf.js suit les images du navigateur, qui s'arrêtent quand la fenêtre est masquée (constaté : aucun `requestAnimationFrame` en 3 s dans le volet masqué). Attendre la peinture bloquait l'export. La latence de NF-04 reste mesurée à la fin de la peinture.
- **T-ATS-13 pour le DOCX** : aucun aperçu du DOCX n'existe. Le critère vérifie que le DOCX vient de la projection de l'aperçu affiché (même SHA-256 du PDF recompilé) : « DOCX produit à partir de la projection de l'aperçu affiché ».
- Les boutons sont **désactivés** tant que le rapport de l'aperçu contient un motif bloquant (ATS-16), et les motifs sont affichés en permanence sous la barre.

## Motifs de blocage (F-EXP-03, F-UI-06)

`exportBlockers(rapport, densité)` (`packages/core/src/export-blockers.ts`, sans Zod) donne la liste ordonnée des motifs, chacun avec un message actionnable et un correctif :

| Motif                            | Message                                                                                                        | Correctif                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| T-ATS-01 rouge                   | « Le CV dépasse d'environ N lignes (2 pages) : décochez une puce ou passez en densité compacte » (ADR 0011)    | bouton « Passer en densité compacte », s'il n'est pas déjà compact                            |
| Champs non traduits              | « N champs affichés non traduits en anglais : traduisez-les dans la bibliothèque, ou changez la langue du CV » | ouvre le **premier** élément concerné (la puce si c'en est une)                               |
| Langue sans niveau               | « Niveau CECRL à préciser : Allemand : choisissez un niveau de A1 à C2, ou « langue maternelle » »             | ouvre la langue                                                                               |
| Identité absente, T-ATS-08 rouge | message du critère, puis « complétez l'identité »                                                              | ouvre l'identité                                                                              |
| T-ATS-02 rouge                   | message, puis l'action                                                                                         | ouvre l'élément du premier texte manquant (chemin `experience.<id>.<puce>`), sinon la vue ATS |
| Autre critère rouge              | message, puis « voir la vue ATS » (ou « défaut du rendu, pas de votre contenu »)                               | vue ATS                                                                                       |

La liste complète des champs non traduits, avec un lien vers chacun, reste au lot 6 : le lot 3 donne un seul motif, qui ouvre le premier champ.

## Nommage et métadonnées (F-EXP-04, annexe B.4)

- `<Libellé>` est le `fileLabel` du preset. Dans les réglages, le champ se saisit librement. À la validation (Entrée ou sortie du champ), il passe par `proposeFileLabel` : marqueurs de genre retirés (aussi pour une saisie, selon l'annexe B.4), translittération, `[A-Za-z0-9-]`, 40 caractères coupés en fin de mot. « Proposer à partir du titre » part du titre choisi dans le preset (ou de sa saisie propre). Le nom des fichiers PDF et DOCX s'affiche en dessous ; `Resume_` en en-US.
- Métadonnées : celles du PDF existaient (Title `CV – Prénom Nom – titre`, Author, Subject et Keywords absents). Pour le DOCX, T-DOCX-01 vérifie aussi que Subject et Keywords sont vides.

## DOCX (F-EXP-02, T-DOCX-01 à 03)

- **Photo** : `ImageRun` **en ligne** dans le paragraphe du nom, poussée contre la marge droite par une tabulation droite à la largeur utile. Le nom reste la première ligne de texte (T-ATS-06 sur mammoth). Elle n'est jamais flottante et jamais dans un en-tête. Une image dans un paragraphe à part, au-dessus du nom, aurait coûté une ligne de la hauteur de la photo.
- **T-DOCX-01 renforcé** :
  - un seul `w:drawing`, et seulement avec la photo ; `wp:inline`, jamais `wp:anchor` ;
  - aucune police incorporée (`word/fonts/`, `w:embed…`) et une seule police déclarée, « Calibri », équivalent métrique de Carlito ;
  - Subject et Keywords vides.
- L'avertissement « pagination Word différente du PDF » prévu pour une police sans équivalent métrique est sans objet : Carlito est la seule police du thème.
- LibreOffice est absent de ce poste : T-DOCX-03 est orange, et « 1 page non garantie en DOCX » reste affiché en permanence sous le bouton.
- Les critères DOCX sont calculés **à l'export DOCX**, pas à chaque aperçu : la conversion LibreOffice prend plusieurs secondes (NF-04). Ils s'affichent dans un groupe « DOCX » des feux tant que l'aperçu reste celui qui a été exporté.

## Vue « ce que voit l'ATS » (F-ATS-01, 02 et 04)

- **Extracteurs** :
  - pdf.js : texte brut, sans normalisation, lignes reconstruites avec `hasEOL` ;
  - `pdftotext -raw` : affiché si Poppler est présent ; sinon un bandeau « Rapport incomplet », avec la raison (xpdf de Git refusé, ou Poppler absent) et la marche à suivre ;
  - DOCX : le texte de mammoth, après un export DOCX.
- **Version normalisée** (`normalizeExtracted`, cahier imprécis) :
  - NFKC, apostrophes courbes en `'`, U+2010 et U+2011 en `-` ;
  - caractères invisibles retirés, espaces Unicode ramenées à une seule, lignes rognées, lignes vides supprimées ;
  - accents et casse **conservés**, pour rester lisible et copiable. Ce n'est ni `canon` (sans espaces) ni `normalizeForMatch` (sans accents).
  - Boutons « Copier la version normalisée » et « Copier le texte brut ». Si le navigateur refuse le presse-papiers (fenêtre inactive), un message le dit au lieu d'échouer en silence.
- **Champs détectés** : `packages/render/src/ats/detect.ts` calcule pour chaque extraction :
  - le nom en première ligne ;
  - l'e-mail et le téléphone trouvés avant le premier intitulé (regex B.5, libphonenumber) ;
  - la ville et le pays ;
  - les autres coordonnées ;
  - les intitulés reconnus, dans l'ordre ;
  - une plage de dates par entrée.

  T-ATS-06, 07 et 08 sont maintenant calculés à partir de ces mêmes fonctions : une seule définition (F-ATS-02). Le rapport porte `detected` ; le MCP ne le renvoie pas (`summarize`).

## Photo (§5.2, §8.5)

- **Envoi** (décision utilisateur : recadrage dans le navigateur). Le navigateur découpe la zone 3:4, la ramène à 600 × 800 au plus dans un canvas (fond blanc, JPEG 0,95, puis 0,9 et 0,85 si besoin) et l'envoie en base64 dans du JSON (`POST /api/profile/photo`, jeton, `Origin`, corps d'1 Mo au plus) : NF-01 est respecté sans exception. Le canvas ne recopie aucune métadonnée.
- **Recadrage** (décision utilisateur : zone choisie, centrée par défaut). Le cadre 3:4 couvre au départ la plus grande zone centrée. On le déplace à la souris (pointer events) ou aux flèches (Maj : par pas de 10 %), on le redimensionne avec un curseur ou les touches + et −, avec un aperçu de 90 × 120. L'image est chargée par `onload` et non par `decode()` : `decode()` attend une image rendue, qui ne vient pas dans une fenêtre masquée (constaté). Aucune dépendance ajoutée.
- **Traitement serveur** (`processPhoto`, `sharp` 0.35.5) :
  - JPEG, PNG ou WebP seulement : un SVG est refusé ; garde de 40 mégapixels contre les bombes de décompression ;
  - orientation EXIF appliquée, puis recadrage 3:4 imposé au centre (il ne corrige qu'un arrondi, la zone arrivant déjà en 3:4) ;
  - 600 × 800 au plus, sans agrandissement, et 150 × 200 au moins (en dessous, refus « photo trop petite ») ;
  - fond blanc, sRGB, JPEG qualité 85, abaissée par paliers de 5 jusqu'à 60 pour tenir sous 300 Ko, sinon refus ;
  - EXIF, GPS, XMP et ICC supprimés (sharp ne garde rien sans `withMetadata`), ce qu'un test vérifie.
- **Stockage** : `data/assets/photo.jpg`, écrit de façon atomique sous le verrou, puis `profile.json` (`identity.photo`), avec la révision. Une nouvelle photo remplace la précédente. « Retirer » (confirmation) remet `photo: null` puis supprime le fichier. L'enregistrement du formulaire d'identité **garde la photo stockée**, quoi que le formulaire envoie, et ignore la photo dans la comparaison avec la base. `GET /api/profile/photo` sert la miniature (jeton exigé).
- **Rendu PDF** : `photo()` ne contient que `place(top + right, image(src, width: …))`. L'image passe par `mapShadow` sous le workspace (`/__photo/<sha256:16>.jpg`, chemin POSIX), jamais par la projection, qui ne porte que la taille (`photo: { width, gap }` en cm : 2,4 et 0,5 en densité normale, 2,1 et 0,4 en compacte). Le bloc identité est réduit de la largeur de la photo et de l'espace, **sans grille**. Sa hauteur est au moins celle de la photo (`layout` + `measure`) : l'accroche commence dessous.
- **T-ATS-17** : nouvelle règle `photo-content` : `photo()` ne peut contenir ni bloc de contenu, ni chaîne, ni identifiant autre que `let`, `photo`, `place`, `top`, `right`, `image`, `width` et ses paramètres. Les noms de champ sont contrôlés aussi, donc `p.name` est refusé.
- **Case « Photo » du preset** :
  - désactivée sans photo dans l'identité, décochée par défaut ;
  - décochée en passant du français à l'anglais (`applyLanguage`), avec un message, et recochable ; passer d'EN-GB à EN-US ne la touche pas ;
  - une photo cochée mais absente (fichier supprimé à la main) donne l'avertissement `PHOTO_MISSING`, sans bloquer.
- **MCP** (§7.5) : tout rendu fait pour le MCP (`render`, `check_ats`, aperçu PNG) utilise `placeholderPhoto()`, une image grise de 600 × 800. La mise en page est identique (hauteur de contenu égale, testée). Ni le PDF ni le DOCX écrits dans `out/`, ni le PNG, ni les réponses ne contiennent un octet de la photo : un test le vérifie sur les octets, Typst recopiant le JPEG tel quel dans le PDF.
- **Fixture** : `fixtures/personas/courte/assets/photo.jpg` est un motif géométrique généré par `scripts/make-fixture-photo.ts` (aucune personne, réelle ou générée) et passé par `processPhoto` (600 × 800, 28 Ko). `installFixture` copie un JPEG de `assets/` après avoir vérifié sa signature et sa taille. `test:ats` couvre `courte` sans photo et avec photo, en PDF et en DOCX : seul T-ATS-16 passe à l'orange.

## NF-01

Le corps reste limité à 1 Mo. Correction d'un défaut du lot 0 : un corps trop gros donnait une **500** (« erreur interne ») au lieu d'une **413**. C'est maintenant `413 PAYLOAD_TOO_LARGE`, « corps de requête trop volumineux (1 Mo au plus) ». Les nouvelles routes (`/api/export`, `/api/profile/photo` en GET, POST et DELETE) passent par les contrôles `Host`, jeton, `Origin` et `Content-Type`, et sont testées.

## Proposition de correction du cahier

Au §12.3, T-ATS-13, préciser : « SHA-256 du fichier exporté égal à celui du dernier tampon **chargé par la visionneuse de l'aperçu** (et non de la dernière peinture, qui dépend de l'affichage de la fenêtre). Pour un DOCX : le PDF recompilé à partir du preset enregistré a l'empreinte de l'aperçu affiché. »

## Conséquences

- Tests :
  - `packages/core/test/export.test.ts` : version normalisée, motifs de blocage, langue et photo, photo projetée ;
  - `packages/render/test/photo-export.test.ts` : traitement de la photo, rendu PDF et DOCX avec photo, image neutre du MCP, règle `photo-content`, T-ATS-13, champs détectés ;
  - `apps/server/test/export.test.ts` : export, non-écrasement, `PREVIEW_MISMATCH`, refus de `debordante`, `Resume_`, photo, NF-01 ;
  - test MCP : la photo n'est jamais transmise.
- Poppler n'est toujours pas installé sur ce poste : `test:ats` passe avec `ATS_SINGLE_EXTRACTOR=1`, rapport « incomplet ».
- Aucune dépendance ajoutée.
