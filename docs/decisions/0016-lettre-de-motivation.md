# ADR 0016 — Lettre de motivation

- **Date** : 06/10/2026
- **Statut** : accepté
- **Contexte** : lot 7 ; F-LET-01 à 07, F-MOD-05, F-EXP-01 à 04, F-CAN-03, MCP-18 à 20, prompt `rediger-lettre` (§7.3), §5.4, §9.1, §9.2, §12.1 à 12.4, T-04, annexes B.4 et C (`letter-facts`). Le cahier est muet ou imprécis sur neuf points, tranchés par l'utilisateur le 06/10/2026 (marqués « décision utilisateur ») ; les autres sont des choix techniques. **Le schéma v1 n'est pas modifié** : `letterVersionFile` et `activeLetter` servent tels quels.

## Versions (F-LET-01, F-LET-04)

- **Emplacement** : `applications/<id>/letters/<fr|en>/v<n>.json`, une lettre par candidature et par langue.
- **Jamais d'écrasement** :
  - le numéro est attribué sous le verrou unique (max + 1) ;
  - le fichier est créé par `DataStore.create` : un fichier temporaire, puis un lien physique vers le nom final, qui échoue si le fichier existe déjà (`ALREADY_EXISTS`). La création est donc atomique et exclusive, même avec deux processus MCP et l'interface (test : deux enregistrements simultanés donnent v1 et v2) ;
  - une version ne change ensuite qu'une fois : son statut passe à `finale`.
- **Origine** : `claude` (`save_letter_draft`) ou `utilisateur` (interface). `basedOn` désigne la version reprise ; une version de départ inexistante est refusée.
- **Version active** (décision utilisateur) :
  - elle ne se choisit que dans l'interface (`setActiveLetter`) ; le MCP ne la change jamais (test) ;
  - **aucune activation automatique**, pas même de la première version ;
  - l'export (interface, et `render` avec `saveToApplication`) n'utilise **que** la version active : sans elle, `NO_ACTIVE_LETTER` ;
  - `render` sans `saveToApplication` accepte un argument `version`, pour un aperçu.
- **Édition et statut finale** (décision utilisateur) :
  - bouton « Enregistrer comme nouvelle version » (origine `utilisateur`, `basedOn` = la version éditée), sans enregistrement automatique ;
  - « Marquer comme finale » se fait dans l'interface seulement, après confirmation, et **n'est pas réversible** ;
  - pour changer une lettre finale, on enregistre une nouvelle version à partir d'elle ; la version finale reste intacte (test).
- **Rôles** (décision utilisateur : ordre imposé, souple) :
  - FR : `vous`, `moi` (une ou deux fois), `nous` ;
  - EN : `opening`, `evidence` (deux fois si `motivation` manque), `motivation` (facultatif), `close` ;
  - la règle est vérifiée à l'enregistrement (`checkLetterRoles`), pas dans le schéma : les fichiers existants restent valides ;
  - un ordre hors règle est refusé avec le motif.
- **Longueur** (décision utilisateur) : aucun plafond par paragraphe, seulement la page stricte et le dépassement chiffré.

## Parties générées par le serveur (F-LET-01, 02, 05)

- **Date** (décision utilisateur : date du jour au rendu) :
  - FR « Lyon, le 1er octobre 2026 » (ordinal « 1er », ville de l'identité ; « Le 1er octobre 2026 » sans ville) ;
  - en-GB « 1 October 2026 » ; en-US « October 1, 2026 » ; pas de lieu en anglais ;
  - les métadonnées du PDF restent sans date (NF-08) ;
  - si l'aperçu et l'export tombent de part et d'autre de minuit, l'export est refusé (empreintes différentes, T-ATS-13) et l'aperçu se recharge ;
  - les tests fixent la date.
- **Objet** :
  - FR « Objet : Candidature au poste d'ingénieur logiciel dispositifs médicaux – Réf. ACME-1234 » ;
  - marqueurs de genre retirés (annexe B.4) ;
  - minuscule initiale, sauf pour un sigle (« DSI adjoint ») ;
  - « de » élidé devant une voyelle, accentuée ou non (pas devant « h ») ;
  - EN (décision utilisateur) : « Application for the position of Software Engineer – Ref. … », en gras, sans libellé, avec l'intitulé tel quel ;
  - « – Réf. » / « – Ref. » seulement avec une référence.
- **Formules d'appel et de politesse**, générées ensemble (décision utilisateur pour les cas non couverts) :

  | Destinataire      | FR                           | en-GB                                                   | en-US                                     |
  | ----------------- | ---------------------------- | ------------------------------------------------------- | ----------------------------------------- |
  | inconnu           | « Madame, Monsieur, »        | « Dear Hiring Manager, » → « Yours faithfully, »        | « Dear Hiring Manager, » → « Sincerely, » |
  | civilité seule    | « Madame, » ou « Monsieur, » | « Dear Madam, » / « Dear Sir, » → « Yours faithfully, » | « Dear Hiring Manager, » → « Sincerely, » |
  | civilité et nom   | « Madame, » (jamais le nom)  | « Dear Ms Martin, » → « Yours sincerely, »              | « Dear Ms. Martin, » → « Sincerely, »     |
  | nom sans civilité | « Madame, Monsieur, »        | « Dear Claire Durand, » → « Yours sincerely, »          | « Dear Claire Durand, » → « Sincerely, »  |
  - En français, la formule finale reprend exactement l'appel : « Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées. »
  - Jamais « Mrs » ni « Miss ».
  - Le nom s'écrit tel qu'il doit suivre la civilité (« Martin »).
  - `checkFormulaPair` signale toute incohérence (avertissement `FORMULA_MISMATCH` de la projection).

- **Pièce jointe** : « P. J. : CV » / « Enclosure: CV ».

## Mise en page (décision utilisateur : usage français et anglais)

Une seule colonne, aucune grille ni tableau :

- **expéditeur** en haut à gauche : nom (couleur d'accent), téléphone, e-mail, ville et pays. Pas d'adresse postale, absente du modèle (§5.2) ;
- **FR** : destinataire puis lieu et date alignés à droite (`align(end, …)`) ;
- **EN** : tout est aligné à gauche, la date, puis le destinataire ;
- **destinataire** : civilité et nom s'ils sont connus, fonction, entreprise (celle de la candidature par défaut), ville ;
- ensuite : objet, appel, paragraphes, formule finale, signature, « P. J. ».

## Garde-fous de la lettre (F-LET-04, F-LET-06, annexe C `letter-facts`)

Une version est un **ajout** : elle n'est jamais refusée pour son contenu. Seuls les cas suivants la refusent :

- un `sourceIds` inconnu ;
- un ordre de rôles hors règle ;
- une saisie non assainie.

Tout le reste donne un **avertissement**, calculé à la lecture (`letterChecks`), comme `stale`. Il est affiché sur chaque version et renvoyé par `save_letter_draft`.

- **Source de référence** : les éléments cités (une puce avec son élément), leurs années et les durées calculées. Pour `vous` et `motivation`, `offer.md` en plus.
- **Chiffres** :
  - un chiffre absent de la source est signalé ;
  - un chiffre qui ne vient que de l'offre est signalé hors de `vous` / `motivation`.
- **Compétences** : dans `moi` / `evidence`, une compétence du dictionnaire (bibliothèque, annexe A, vocabulaire tech, termes des analyses de l'offre) qui ne figure nulle part dans la bibliothèque est signalée. Les classes de dispositif ne comptent pas comme des compétences : ce sont des faits protégés, contrôlés à part.
- **Faits protégés** (classes de DM et de logiciel) ; **contenu étranger** (URL, e-mail, consigne).
- **Formule écrite dans un paragraphe** : elle est générée, donc signalée.
- **Éléments cités mais non cochés** dans la sélection de la candidature.
- **Interprétation de F-LET-06** : « vous ou motivation » désigne `vous` en FR et `motivation` en EN. L'`opening` n'admet pas de fait de l'offre ; la lettre anglaise fictive les place donc en `motivation`.

## Rendu (F-MOD-05, F-LET-07)

- **Projection** : `projectLetter` (`packages/core/src/letter.ts`) produit toutes les chaînes affichées et les textes attendus champ par champ (T-ATS-02, 03). Le thème est celui de la candidature (police, accent, densité, `projectionTheme`), comme le CV.
- **Gabarit unique** `packages/render/templates/lettre.typ` :
  - mêmes réglages que les gabarits ATS ;
  - aucun texte écrit en dur ;
  - T-ATS-17 vérifié par le test du gabarit et à chaque rapport.
- **Compilation et mesure** : `compileLetter` partage la mesure du CV (page stricte, dépassement chiffré, message « La lettre dépasse d'environ N lignes : raccourcissez un paragraphe ») et le contrôle des glyphes (`missingGlyphsIn`).
- **Contrôle ATS** (`runLetterAtsCheck`) : la colonne Lettre du §12.3, soit T-ATS-01 à 05, 09 à 14 et 17 ; 06 à 08, 15 et 16 sont sans objet. Pour un DOCX, s'y ajoutent T-DOCX-01, T-DOCX-02 (T-ATS-02 et 04 sur le texte de mammoth) et T-DOCX-03.
- **DOCX** : `buildLetterDocx`, à partir de la même projection ; paragraphes natifs, aucune police incorporée, alignement à droite par paragraphe.
- **Nommage** : `LM_<Prénom>_<Nom>_<Entreprise>_<FR|EN>`, `CoverLetter_` en anglais (en-GB comme en-US), translittération de l'annexe B.4. Title « Lettre de motivation – … » (« Cover letter – … »), Author.
- **Export** :
  - `addApplicationExport` prend un `kind` ; une lettre va dans `exports/<AAAAMMJJ-HHmmss>_lettre/` ;
  - `layout` de la trace = la mise en page de la candidature (le schéma l'exige) ;
  - même déroulé que le CV : l'aperçu affiché (version active, le jour même) doit avoir l'empreinte du fichier exporté (T-ATS-13), sinon 409.

## MCP

- **`save_letter_draft`** (MCP-18) :
  - signature du cahier, plus `basedOn` (facultatif) ;
  - `lang` vaut par défaut la langue de la candidature ;
  - crée une version, la compile, et renvoie : numéro, pages, remplissage, dépassement, avertissements, parties générées, version active (inchangée) et lien de relecture (`/candidatures/<id>/lettre?lang=…`).
- **`render`** et **`check_ats`** en `kind: letter` :
  - la cible est une candidature (`INVALID_TARGET` pour un preset) ;
  - `render` accepte `version` pour un aperçu ; avec `saveToApplication`, seule la version active s'exporte ;
  - `includePreviewImage` est ignoré pour une lettre ;
  - les réponses ne contiennent ni e-mail ni téléphone (masquage habituel).
- **Prompt `rediger-lettre`** (décision utilisateur : pas d'argument `lang`) :
  - `applicationId` seulement, la lettre est dans la langue de la candidature ;
  - étapes : `get_application`, `get_guidelines(letter)`, `get_items`, rédaction en paragraphes avec un rôle (sans formules ni parties générées), `save_letter_draft`, compte rendu des avertissements.
- **`get_guidelines(letter)`** et les instructions du serveur sont mis à jour (1 837 caractères ; 21 outils et 3 prompts).

## Interface (F-UI-04)

- **Page « Lettre »** d'une candidature (`/candidatures/<id>/lettre?lang=fr|en`), ouverte par « ✉ Lettre » dans l'écran Candidatures et dans la barre d'une candidature ouverte :
  - liste des versions (origine, date, active, finale, nombre d'avertissements) ;
  - diff mot à mot entre deux versions ;
  - édition du destinataire et des paragraphes (rôle et texte), avec les avertissements de chaque paragraphe ;
  - « Rendre active », « Marquer comme finale » ;
  - aperçu PDF de la version affichée avec ses critères ;
  - export PDF et DOCX de la version active, avec les motifs de blocage.
- **En direct** : une version créée par Claude apparaît sans rechargement (SSE).
- `wordDiff` est exposé par `@cv/core/export` (module sans dépendance).

## Vérifications

- **`test:ats`** : lettre FR, en-GB et en-US sur `courte` et `pieges`, tout au vert (remplissage 46, 47 et 50 %). Le format Letter et les noms `LM_` / `CoverLetter_` sont vérifiés. La lettre trop longue sur `debordante` est refusée (108 %, dépassement de 5 lignes).
- **Tests** :
  - `packages/core/test/letter.test.ts` : formules, objet, date du 1er du mois, rôles, nommage, projection, garde-fous ;
  - `packages/store/test/letters.test.ts` : enregistrements simultanés, refus, statut finale, version active, export `_lettre` ;
  - `packages/render/test/letter.test.ts` : T-ATS-17 sur `lettre.typ`, page A4 et Letter, dépassement, critères de la colonne Lettre, DOCX ;
  - `apps/mcp/test/lot7.test.ts` : §12.4 sur `save_letter_draft`, `render` et `check_ats` en `kind: letter`, et le prompt ;
  - `apps/server/test/letter.test.ts` : NF-01 et règles des routes ;
  - `apps/mcp/test/t04.test.ts` : T-04 de bout en bout.
- **Navigateur** (`dev:demo`, 06/10/2026) :
  - la démo crée une candidature fictive avec la lettre v1 de Claude ;
  - modification d'un paragraphe, v2 « vous (de v1) », diff v1 → v2, activation, export disponible ;
  - une v3 enregistrée par un autre processus MCP arrive en direct, et la version active reste la v2 ;
  - onglet EN sans version, avec les rôles anglais.

## Propositions de correction du cahier

- **F-LET-01** : la date est celle du jour du rendu.
- **F-LET-02** : préciser l'objet en anglais (« Application for the position of … – Ref. … », sans libellé) et le cas du sigle en tête d'intitulé.
- **F-LET-03** : préciser l'ordre et les répétitions (FR vous, moi ×1–2, nous ; EN opening, evidence ×1–2, motivation facultatif, close).
- **F-LET-05** : ajouter le tableau des cas non couverts.
- **F-LET-06** : préciser « vous (FR) ou motivation (EN) ».
- **MCP-18** : ajouter `basedOn` ; `lang` facultatif.
- **MCP-19** : ajouter `version` (aperçu d'une version) ; seule la version active s'exporte.
- **F-CAN-03** : le dossier d'export d'une lettre est `exports/<AAAAMMJJ-HHmmss>_lettre/`.
- **§12.3** : préciser que T-DOCX-01 à 03 s'appliquent au DOCX de la lettre.

## Conséquences

- **Aucune dépendance ajoutée** (Typst, docx, pdf-lib, fflate déjà figés).
- **Fixtures** : `fixtures/letters/` contient une lettre FR, une lettre EN et une lettre FR trop longue, fictives. `npm run dev:demo` crée une candidature fictive avec sa lettre v1.
- **Poppler** n'est toujours pas installé sur ce poste : `test:ats` passe avec `ATS_SINGLE_EXTRACTOR=1`, rapport « incomplet ».
- **LibreOffice** est désormais installé : T-DOCX-03 mesure la pagination (1 page pour `courte`, 2 pour la lettre trop longue de `debordante`). LibreOffice refuse une seconde instance sur le même profil : deux conversions simultanées (tests en parallèle, ou une fenêtre LibreOffice ouverte) faisaient échouer l'une d'elles, donc un orange aléatoire. Chaque processus a maintenant son propre profil (`-env:UserInstallation`, dossier temporaire supprimé à la sortie) et ses conversions passent une à une. Les tests attendent l'orange sans LibreOffice, et le nombre de pages mesuré avec.
