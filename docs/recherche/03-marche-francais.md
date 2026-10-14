# Rapport : le CV sur le marché français, pour un générateur de CV lisible par les ATS (version vérifiée, 5 octobre 2026)

> Cette version a été relue et contrôlée. Les passages corrigés ou nuancés sont signalés par **[corrigé]** ou **[nuancé]**. Le détail de chaque contrôle se trouve dans la section « Vérification » à la fin.
> Limite de la vérification : le quota de recherche web était épuisé. Tous les contrôles ont donc été faits en ouvrant directement les pages concernées.

## 0. L'essentiel

- **Les ATS se répandent, mais ils ne trient pas tous les CV.**
  - Selon l'étude Apec du 20/05/2025, **50 % des grandes entreprises** utilisaient en 2024 un logiciel de recrutement (SIRH ou ATS) pour recruter leurs cadres. C'est 12 points de plus qu'en 2021. *(confirmé)*
  - Seules **4 %** des entreprises ayant recruté des cadres en 2024 utilisaient des outils d'IA, et 11 % envisagent de le faire. *(confirmé)*
  - Le chiffre de « 27 % des entreprises françaises » n'apparaît pas dans l'étude : **non vérifié**, à ne pas citer.
- **Conventions françaises actuelles.**
  - Une page dans l'idéal, deux au maximum. **[nuancé]** Michael Page accepte jusqu'à trois pages pour 10 ans d'expérience ou plus.
  - La photo est facultative.
  - Pas d'âge, pas de situation familiale, pas d'adresse complète.
  - Un titre de poste précis et une accroche de 2 à 3 lignes.
  - Des intitulés de sections classiques.
  - Les langues au format CECRL (A1 à C2).
- **Accents.** Aucune source vérifiable ne montre qu'un ATS courant en France gère mal les accents.
  - Textkernel, utilisé par SAP SuccessFactors (confirmé par une note SAP), prend en charge le français « all variants ».
  - Les risques documentés viennent **du PDF généré** :
    - les ligatures (fi, fl, ff), surtout quand le PDF n'a pas de table ToUnicode correcte ;
    - les polices d'icônes ;
    - le texte transformé en image.
- **CV bilingue.** Il vaut mieux produire **deux documents séparés** (FR et EN) qu'un seul document à deux colonnes.
- **RGPD.** L'exemption « usage strictement personnel » ne s'applique plus dès qu'un contenu est publié sur Internet pour un nombre indéterminé de personnes (arrêt CJUE Lindqvist, C-101/01). Le générateur doit donc être privé par défaut, et prudent avec les données de tiers (références, contacts).

---

## 1. Conventions du CV en France (2025-2026)

### 1.1 Longueur
| Source | Recommandation |
|---|---|
| Welcome to the Jungle (guide « Faire un CV efficace ») | 1 page ; « Un recruteur reste en moyenne 30 secondes maximum sur un CV » |
| HelloWork (mis à jour le 29/10/2024) **[corrigé]** | « Votre CV ne doit pas excéder deux pages – une seule page étant l'idéal » |
| France Travail (longues carrières, 15 à 30 ans d'expérience) | « une, voire une page et demie », en se concentrant sur les dix dernières années |
| Michael Page (cadre expérimenté) | « Avec 10 ans d'expérience professionnelle ou plus, un CV de deux voire trois pages maximum est tout à fait toléré. » |

→ **Règle à retenir :**
- 1 page par défaut.
- 2 pages acceptables au-delà d'environ 10 ans d'expérience ou pour un cadre.
- 3 pages restent tolérées par certains cabinets, mais il vaut mieux les déconseiller.

### 1.2 Photo
- **Droit applicable.**
  - L'article L1132-1 du Code du travail interdit toute discrimination fondée notamment sur l'apparence physique, l'âge, la situation de famille, le nom de famille ou le lieu de résidence.
  - L'article L1221-6 limite les informations demandées au candidat à celles qui ont « un lien direct et nécessaire avec l'emploi proposé ou avec l'évaluation des aptitudes professionnelles ».
- **Défenseur des droits** (guide « Pour un recrutement sans discrimination », 2019), deux citations vérifiées dans le PDF :
  - « exiger par exemple une photo sur un CV ne peut être qu'exceptionnel » ;
  - il recommande de rendre anonymes les candidatures en supprimant « notamment nom, prénom, adresse, âge, situation de famille et photo ».
- **CV anonyme.**
  - L'obligation prévue en 2006 (art. L1221-7) n'a jamais été appliquée, faute de décret.
  - La loi du 17/08/2015 l'a rendue **facultative**. Le Conseil d'État en a tiré les conséquences le 04/11/2015 (n° 387014) : il a renoncé à l'astreinte contre le gouvernement, puisque l'obligation avait disparu.
  - Texte actuel : les informations « peuvent être examinées dans des conditions préservant son anonymat ».
- **Statistiques sur la préférence des recruteurs** (« 67 % préfèrent une photo », « 85 % des PME », « étude Pôle Emploi 2024 »…).
  - Elles viennent toutes de blogs d'éditeurs de CV, sans source primaire : **non fiables**.
  - Un indice dans ce sens : Pôle emploi s'appelle France Travail depuis le 1er janvier 2024.
- **Arrêt de la Cour de cassation de 2025** qui jugerait discriminatoire l'exigence d'une photo : **non confirmé**, à ne pas citer.
- **Effet sur les ATS.**
  - Les moteurs d'analyse extraient le texte et ignorent les images : la photo ne fait pas gagner de points.
  - Le vrai risque vient de la mise en page autour de la photo (bandeau, colonne) ou de texte intégré dans une image.

→ **Recommandation :**
- photo **désactivée par défaut** ;
- activable candidature par candidature (accueil, luxe, commerce) ;
- toujours placée comme un bloc image distinct, jamais dans l'en-tête ou le pied de page.

### 1.3 Informations personnelles
| Élément | Recommandation | Base |
|---|---|---|
| Nom, prénom, téléphone, e-mail | Oui, dans le corps du document | Toutes les sources |
| Ville (département éventuellement) | Oui, **pas l'adresse complète** | HelloWork : « la ville dans laquelle vous résidez (pas besoin de préciser l'adresse exacte) » ; le lieu de résidence est un critère protégé (L1132-1) |
| Âge / date de naissance | À éviter, aucune obligation | HelloWork, 02/01/2025 : « Vous n'avez donc pas à indiquer votre âge sur votre CV » ; Défenseur des droits |
| Situation familiale, enfants | À éviter | Défenseur des droits ; L1132-1 |
| Nationalité | Facultative ; à mentionner seulement si une autorisation de travail est en jeu | Non revérifié |
| Permis de conduire | Si pertinent : « Titulaire du permis B », éventuellement « véhiculé » ; à traiter comme une **compétence** | HelloWork, 18/11/2024 (non revérifié) |
| LinkedIn, portfolio | Oui, en URL écrite en clair | Pratique courante |

**Ce que disent les études de testing :**
- Le testing Dares/IPP/ISM Corum (note IPP n°67, mai 2021) a porté sur 2 400 offres et 9 600 candidatures (confirmé dans le PDF).
  - Il ne trouve **aucune inégalité de traitement significative en moyenne** entre femmes et hommes, y compris quand le CV mentionne des enfants ou la situation conjugale.
  - Il trouve en revanche de fortes disparités selon le niveau de qualification : les femmes sont défavorisées sur les métiers peu qualifiés et favorisées sur les métiers qualifiés.
- Le testing Dares de novembre 2021 mesure **31,5 % de chances de rappel en moins** pour les candidatures dont l'identité suggère une origine maghrébine. Le chiffre est cohérent avec la publication connue, mais la page est protégée par un CAPTCHA : non revérifié en direct.

### 1.4 Titre et accroche
- **[corrigé]** France Travail recommande en haut du CV une accroche qui présente « synthétiquement vos objectifs professionnels ou vos compétences clés ». La page consultée ne dit **pas** que le titre est « obligatoire ».
- Michael Page : « un petit paragraphe de 2-3 lignes maximum » sous le titre (confirmé).
- HelloWork : « Pensez à toujours indiquer un titre de poste précis » (confirmé).
- Pour les ATS : reprendre **l'intitulé exact de l'offre** dans le titre. C'est une bonne pratique, pas une règle documentée par un éditeur.

### 1.5 Ordre et intitulés des sections
- **Ordre proposé par France Travail :** en-tête et accroche → parcours / expérience → formation → « Mais aussi… » (centres d'intérêt, savoir-être).
- **[nuancé]** La place des langues n'est pas précisée sur la page principale ; elle apparaît sur une page séparée.
- France Travail distingue trois types de CV : chronologique, thématique et mixte (non revérifié sur les pages consultées).

Intitulés standards, conseillés pour les ATS :

| FR (version ATS) | EN |
|---|---|
| Expérience professionnelle | Professional Experience |
| Formation | Education |
| Compétences | Skills |
| Langues | Languages |
| Certifications | Certifications |
| Projets | Projects |
| Bénévolat | Volunteering |
| Centres d'intérêt | Interests |

Il faut éviter les titres créatifs (« Mon parcours », « Ce qui m'anime »). Les sources commerciales sur les ATS le répètent ; aucun éditeur d'ATS ne le documente officiellement.

### 1.6 Centres d'intérêt (France Travail) **[nuancé]**
- **Environ 3**, et précis : éviter les mentions génériques comme « voyages » ou « cinéma ».
- Éviter toute activité « qui pourrait donner lieu à un débat, par exemple un engagement politique ». La religion n'est pas citée explicitement, mais elle entre dans cette logique.
- Ne rien inventer : la page prévient qu'un candidat démasqué en entretien perd toute crédibilité.
- La consigne « classés par importance » n'a pas été retrouvée.

### 1.7 Langues : CECRL
- Six niveaux, A1 à C2, regroupés en utilisateur élémentaire, indépendant et expérimenté (Conseil de l'Europe).
- France Travail conseille de « justifier votre niveau de maîtrise à l'aide d'un certificat » (TOEIC, TOEFL…) et renvoie à l'auto-évaluation CECRL (confirmé).
- Format recommandé : « Anglais : C1 (TOEIC 945, 2025) ». La formule « lu, écrit, parlé » est **obsolète**.
- **Point de tension [nuancé].** France Travail suggère de « petits cercles de couleur » sur une échelle de 1 à 5 pour le niveau **des compétences en général**, pas spécifiquement des langues. Ce type de visuel est **illisible pour un ATS** : tout niveau doit figurer **en texte**.

### 1.8 Format des dates
- **Usage typographique français** (convention générale, non vérifiée en ligne) :
  - mois en minuscules, par exemple « mars 2022 – aujourd'hui » ;
  - abréviations « janv., févr., sept. ».
- **Côté ATS**, des blogs commerciaux (moncvhub, cvadapt) recommandent **MM/AAAA**. Aucune documentation d'éditeur ne le confirme.
- **Textkernel** : l'API prévoit bien un paramètre `DocumentLastModified` (confirmé). Son usage comme date de référence pour les postes « en cours » reste une interprétation non confirmée.

→ **Recommandation :**
- stocker les dates en ISO (`YYYY-MM`) ;
- proposer deux rendus, « 03/2022 – aujourd'hui » (mode ATS) ou « mars 2022 – aujourd'hui » ;
- ne jamais mélanger les deux formats dans un même CV.

---

## 2. ATS et outils de recrutement en France

### 2.1 Panorama
Il n'existe **aucune part de marché officielle**. Les classements viennent d'éditeurs ou de blogs commerciaux.

| Outil | Origine | Segment | Ce qui est vérifié |
|---|---|---|---|
| Workday Recruiting | US | Grands groupes (L'Oréal, LVMH selon cvpass, non vérifié) | Gestion des mises en page en colonnes moins bonne (cvpass, commercial, non vérifié) |
| Oracle Taleo | US | Grands groupes historiques, secteur public | « 15 du CAC 40 » : non sourcé, à ne pas citer |
| SAP SuccessFactors | DE | Industrie, finance, pharma | **Confirmé** par la note SAP 2081576 : « Third party software Text kernel is used to parse resume data ». Analyse dans 15 langues, dont le français. Limites citées par SAP : l'analyse est « imperfect », les PDF scannés ne sont pas analysés. Le DOCX y serait plus fiable que le PDF : affirmation commerciale non vérifiée |
| SmartRecruiters | US | Grands comptes (Decathlon selon cvpass, non vérifié) | — |
| Cegid HR (ex-Talentsoft) | FR | ETI, grands comptes | **Confirmé**, page officielle : « Analyse automatique des CV et questionnaires grâce au parsing et au scoring » ; « Résumé automatique des CV via IA » |
| Teamtailor | SE | PME, scale-ups | Co-pilot **ne rejette pas automatiquement** : il affiche ✓, ✕ ou « – » (« – » quand l'information manque), et le recruteur peut modifier chaque évaluation (**confirmé**). Formats lus (docx, pptx, pdf, pages, txt, rtf) : non revérifié |
| Flatchr | FR | PME, collectivités | Aide officielle : formats acceptés « Word ou PDF » (**confirmé**). Ignorerait l'en-tête et le pied de page : non documenté par Flatchr, à ne pas citer |
| Welcome to the Jungle Solutions ATS | FR | Tech, scale-ups | Se présente comme « IA-native » (blog WTTJ du 10/03/2026, **confirmé**). **[corrigé]** Le même article vante le scoring pour « écarter les CV qui ne correspondent pas » : l'idée d'une absence de filtrage est donc fausse |
| Taleez, Beetween, WeRecruit, Talentia, Layan, ScopTalent | FR | PME, ETI | Cités dans le comparatif WTTJ ; analyse des CV et scoring revendiqués par les éditeurs eux-mêmes |
| Recruitee (Tellent), Lever, Greenhouse | NL / US | Tech | — |
| Jobaffinity | FR | — | **Aucune information vérifiée** |

**Astuce utile pour le générateur :** l'adresse de la page carrière révèle souvent l'ATS utilisé (« myworkdayjobs », « taleo », « smartrecruiters », « teamtailor », « recruitee », « successfactors »).

### 2.2 Job boards et plateformes publiques
- **France Travail – Profil de compétences** (confirmé).
  - Il génère un CV à partir du profil.
  - Seules apparaissent les informations pour lesquelles l'option **« Élément privé (non visible par les recruteurs) »** n'est pas cochée. C'est très proche du principe des cases à cocher de ton projet.
  - « Seuls les recruteurs connectés à leur Espace recruteur certifié peuvent consulter les CV ».
- **ROME 4.0** (France Travail).
  - Version 4.0 publiée en mars 2023 (confirmé, data.gouv.fr).
  - **4 API** : Compétences, Métiers, Contextes de travail, Fiches métiers. Limite : 1 appel par seconde (confirmé).
  - **[nuancé]** Le découpage « 6 domaines, 32 enjeux, 80 objectifs, 492 macro-compétences » n'a pas pu être vérifié. La fiche data.gouv.fr donne d'autres chiffres, à un niveau plus fin (plus de 21 000 savoir-faire, plus de 17 000 savoirs, 191 contextes de travail). Ne pas inscrire de chiffres dans le cahier des charges sans les recontrôler dans l'API.
  - Usage possible : **aligner le vocabulaire des compétences** sur celui des offres françaises.
- **Apec, Indeed, HelloWork, Welcome to the Jungle** : les candidatures passent par des profils ou CVthèques interrogés par mots-clés. Leur fonctionnement interne n'a pas été vérifié.

### 2.3 Accents et caractères français : ce qui est vérifié et ce qui ne l'est pas
- **Vérifié : le français chez Textkernel.**
  - « French (all variants) » est pris en charge pour l'analyse de CV et d'offres, la correspondance (avec recherche sémantique), les compétences et les métiers.
  - C'est disponible dans les centres de données NL, DE et US, mais pas JP ni AU.
  - La réponse de l'API contient un champ `ResumeMetadata.DocumentLanguage` (confirmé). Qu'il ne retienne qu'**une seule** langue par document est probable, mais non explicitement documenté.
- **Vérifié : les ligatures [nuancé].**
  - pdfTeX et react-pdf produisent fi, fl, ff, ffi en un seul glyphe.
  - Si le PDF n'a pas de table **ToUnicode** correcte, certains extracteurs perdent ou déforment ces lettres. Exemples : « workfows », « Ofcial ».
  - Sources : la PR #87 du dépôt GitHub nezor11/martinez-place (03/10/2026), un site CV personnel à 0 étoile, donc un **cas isolé** ; et atsverification.com (22/08/2026).
  - **Correctifs :**
    - react-pdf : `fontFeatureSettings: { liga: false }` (celui de la PR) ;
    - HTML/CSS : `font-variant-ligatures: none` ou `font-feature-settings: "liga" 0` ;
    - LaTeX : `\usepackage[T1]{fontenc}` + `\usepackage{cmap}` (+ `lmodern`), ou `\DisableLigatures` (microtype), ou `Ligatures=NoCommon` sous XeLaTeX/LuaLaTeX.
- **Vérifié : les polices d'icônes** (atsverification.com, 22/08/2026, confirmé). FontAwesome et équivalents produisent des caractères parasites collés à l'e-mail ou au téléphone. Certains moteurs d'analyse ne détectent alors plus les coordonnées.
- **Non vérifié : la perte d'accents.**
  - Aucune preuve qu'un ATS du marché français perde « é », « è » ou « ç » lors de l'analyse.
  - Les caractères corrompus (« mojibake ») signalés pour Workday concernent ses **exports CSV** (source commerciale non revérifiée).
  - Ne pas « dé-accentuer » la version française.
- **Précautions techniques** (hypothèses, non testées) :
  - normaliser tout le texte en Unicode NFC ;
  - remplacer l'espace fine insécable (U+202F) avant « : ; ! ? » par une espace ordinaire ou une insécable classique (U+00A0) ;
  - garder « œ », mais éviter les guillemets et tirets décoratifs dans les mots-clés ;
  - vérifier que le texte du PDF est sélectionnable et copiable.

### 2.4 Conseils Apec spécifiques aux ATS
La page Apec est toujours inaccessible (403). Son contenu vient d'un extrait de recherche, **non revérifié** :
- ordre : coordonnées → titre → résumé → expérience → compétences → formation ;
- développer les sigles à la première occurrence, par exemple « Gestion de la relation client (CRM) » ;
- un PDF texte, jamais une image ;
- des réalisations chiffrées.

### 2.5 Réglementation de l'IA dans le recrutement
- Les systèmes d'IA de recrutement sont classés « à haut risque » (annexe III de l'AI Act).
- **Report par le Digital Omnibus** : les obligations passent du **2 août 2026 au 2 décembre 2027** (confirmé par Gibson Dunn et Usercentrics).
  - **[nuancé]** Accord provisoire daté du 06/05/2026 par Gibson Dunn et du 07/05/2026 par Usercentrics. C'était probablement la nuit du 6 au 7 mai.
  - Adoption par le Parlement le 16/06/2026 et par le Conseil le 29/06/2026.
  - Signature le 08/07/2026, entrée en vigueur le 27/07/2026.
  - Numéro « Règlement (UE) 2026/1744 » selon Usercentrics : **non confirmé sur EUR-Lex** (page impossible à charger).
- Les obligations de transparence de l'article 50 restent fixées au 2 août 2026.
- Ces obligations visent les fournisseurs et utilisateurs d'outils de tri. **Un générateur de CV personnel n'est pas concerné.** C'est un simple élément de contexte.
- CNIL : le recruteur doit informer le candidat de l'existence d'une décision automatisée, par exemple un tri algorithmique des candidatures (non revérifié mot pour mot).

### 2.6 Affirmations obsolètes ou douteuses
- **« Un CV français doit comporter photo, date de naissance et situation familiale »** (guides anglophones) : **obsolète**. C'est contraire au Défenseur des droits et aux sites français.
- **« 75 % des CV sont rejetés par les ATS »** : **non sourcé**. Son origine est généralement attribuée à un ancien éditeur américain (Preptel, vers 2012), ce qui n'a pas été revérifié en ligne.
  - Jobscan, pourtant vendeur d'optimisation pour les ATS, écrit lui-même qu'un ATS « rarely "rejects" a candidate automatically » et fonctionne comme un moteur de recherche pour le recruteur.
  - Avec Teamtailor Co-pilot (pas de rejet automatique) et 4 % d'usage de l'IA (Apec), la réalité française ressemble surtout à de la **recherche et du classement**, pilotés par un humain.
  - Attention : le scoring existe bel et bien (Cegid, WTTJ) et sert à « écarter » des CV. Le risque n'est donc pas nul.
- **Les échelles visuelles** (barres, étoiles, cercles) sont incompatibles avec les ATS, même si France Travail les suggère pour les compétences.

---

## 3. CV bilingue FR/EN
- **Deux documents séparés**, chacun dans une seule langue.
  - Textkernel renvoie une langue de document (`DocumentLanguage`).
  - Les mises en page bilingues côte à côte gênent l'analyse (sources commerciales concordantes).
- **Version anglaise :**
  - intitulés traduits (Professional Experience, Education…) ;
  - CEFR au lieu de CECRL ;
  - équivalences de diplômes explicites, par exemple « Master's degree (Bac+5) » (recommandation de l'auteur) ;
  - photo généralement absente dans les pays anglophones.
- **Europass** reste une option reconnue dans l'UE, avec une colonne et des intitulés standards. Sa compatibilité ATS n'est attestée que par des sources commerciales.
- **Côté données :** des **champs traduisibles** (`fr`/`en`) pour chaque élément, plutôt que deux bases séparées.

---

## 4. RGPD si les données du CV sont stockées en ligne
- **Article 2.2.c du RGPD.**
  - Un traitement « strictement personnel ou domestique » échappe au RGPD.
  - L'arrêt CJUE Lindqvist (C-101/01, 06/11/2003, point 47) exclut de cette exemption la publication sur Internet de données accessibles à un nombre indéterminé de personnes.
  - L'hébergeur ou le prestataire technique reste soumis au RGPD.
- **Tes propres données** posent peu de difficulté. Les **données de tiers** en posent : références avec nom et téléphone d'un ancien manager, collègues cités, coordonnées de clients.
- **Côté recruteurs** (CNIL, guide du recrutement du **30/01/2023**, 19 fiches, confirmé) :
  - collecte limitée à ce qui est nécessaire ;
  - un CV non retenu peut alimenter un vivier si la conservation « n'excède en principe pas deux ans » (confirmé, fiche CNIL TPE/PME) ;
  - droits d'accès, de rectification, d'effacement et de portabilité pour le candidat.
- **[corrigé] Mise à jour en 2026.** Le site de la CNIL indique que la **fiche 16** a été mise à jour **en mai 2026**, pour le contrôle d'honorabilité. Cela ne concerne pas la conservation des CV. L'« avril 2026 » évoqué par un blog reste non vérifié.
- **Recommandations :**
  - stockage local d'abord (localStorage, IndexedDB ou JSON exportable), ou hébergement dans l'UE avec authentification ;
  - pas de page publique du catalogue complet ; si un lien est partagé : `noindex`, et ni téléphone ni adresse ;
  - pas de traceurs ni d'outil d'analyse d'audience ;
  - export et suppression complète en un clic ;
  - références « disponibles sur demande » plutôt que coordonnées de tiers.

---

## 5. Recommandations concrètes pour le générateur (marché français)

1. **Modèle de données « catalogue + sélection ».**
   - Chaque élément porte un identifiant, des tags (métier, secteur), une langue (`fr`/`en`) et une priorité.
   - Chaque candidature est un profil : cases cochées, ordre, titre, accroche.
   - Le principe s'inspire de la case « Élément privé » de France Travail (confirmée).
2. **Modèle unique « ATS-safe » par défaut :**
   - une colonne et du texte réel ;
   - polices standards (Arial, Calibri, Helvetica) ;
   - **ligatures désactivées** (`font-variant-ligatures: none`) ;
   - aucune police d'icônes ; libellés en texte (« E-mail : », « Tél. : ») ;
   - coordonnées dans le corps du document, pas dans l'en-tête ni le pied de page ;
   - ni tableau ni zone de texte ;
   - niveaux exprimés en texte, sans barres ni étoiles.
3. **Exports.**
   - Un PDF texte (impression navigateur ou bibliothèque qui produit une table ToUnicode correcte).
   - Un **DOCX** en option. L'avantage du DOCX pour Taleo et SuccessFactors n'est affirmé que par des sources commerciales.
   - Un **aperçu « vue ATS »** en texte brut, extrait du PDF généré lui-même.
4. **Contrôles automatiques avant export :**
   - nombre de pages (alerte au-delà de 1, blocage au-delà de 2) ;
   - dates complètes et cohérentes ;
   - sigles développés à la première occurrence ;
   - intitulés standards présents ;
   - normalisation NFC ;
   - absence de caractères décoratifs ;
   - texte du PDF extractible, avec un test qui cherche « fi », « fl » et « ff » dans le texte extrait.
5. **Champs propres à la France :**
   - titre de poste précis et accroche de 3 lignes au maximum ;
   - ville seule, sans adresse ;
   - permis classé en compétence ;
   - langues sur une liste fermée A1–C2, avec certification, score et date ;
   - environ 3 centres d'intérêt, avec une alerte sur les sujets clivants (politique, religion) ;
   - **date de naissance, situation familiale et photo désactivées par défaut**, avec une explication liée à l'article L1132-1.
6. **Mots-clés :**
   - une zone pour coller l'offre, avec une comparaison simple entre les mots-clés de l'offre et les éléments cochés ;
   - en option, des suggestions issues de **ROME 4.0** (API Compétences, 1 appel par seconde) ;
   - un signalement des synonymes et sigles.
7. **Bilingue :**
   - un interrupteur FR/EN qui génère deux fichiers séparés ;
   - des intitulés et formats de date propres à chaque langue ;
   - le CEFR pour la version anglaise ;
   - une alerte sur les éléments non traduits.
8. **Nommage :** `CV_Prenom_Nom_Poste_FR.pdf`, sans espaces ni caractères spéciaux. Les métadonnées PDF (titre, auteur, date) doivent être correctes.
9. **RGPD et confidentialité :**
   - application locale d'abord, sans compte ;
   - sauvegarde par export/import JSON ;
   - si une synchronisation est ajoutée : hébergement dans l'UE, authentification, chiffrement et suppression complète.
10. **Tests :**
    - extraction du texte avec deux outils différents (par exemple pdftotext et pdf.js) ;
    - un envoi d'essai sur un compte ATS de démonstration, si l'accès est possible ;
    - des mots-tests : « Ingénieur·e », « Certification », « Efficacité », « Œuvre », « workflows », « Official ».

---

## 6. Limites de ce rapport
- **Pages inaccessibles :** Apec ATS (403), Dares (CAPTCHA), EUR-Lex (contenu vide). Leurs points restent non revérifiés.
- **Quota de recherche web épuisé :** la vérification s'est faite par lecture directe des pages. Restent non vérifiés :
  - le fonctionnement interne des CVthèques ;
  - l'origine exacte du chiffre des « 75 % » ;
  - Jobaffinity ;
  - les formats acceptés par Teamtailor ;
  - le découpage hiérarchique de ROME 4.0 ;
  - la gestion des accents dans la recherche par mots-clés de chaque ATS.
- **Attributions « entreprise → ATS »** (cvpass) : source commerciale non vérifiée.

---

## Sources

**Pages ouvertes et lues (y compris pendant la vérification)**
- https://corporate.apec.fr/home/nos-etudes/toutes-nos-etudes/pratiques-de-recrutement-de-cadres-2025.html
- https://www.defenseurdesdroits.fr/sites/default/files/2023-03/DDD_guide_recrutement-sans-discrimination_20190703.pdf
- https://code.travail.gouv.fr/code-du-travail/l1221-6
- https://code.travail.gouv.fr/code-du-travail/l1221-7
- https://code.travail.gouv.fr/code-du-travail/l1132-1
- https://conseil-etat.fr/actualites/cv-anonyme
- https://www.francetravail.fr/candidat/vos-recherches/preparer-votre-candidature/cv-lettre-de-motivation-e-mail/comment-rediger-un-cv-efficace-e.html
- https://www.francetravail.fr/candidat/vos-recherches/preparer-votre-candidature/cv-lettre-de-motivation-e-mail/cv--des-exemples-pour-presenter.html
- https://www.francetravail.fr/candidat/vos-recherches/preparer-votre-candidature/cv-lettre-de-motivation-e-mail/cv--des-exemples-pour-present-1.html
- https://www.francetravail.fr/candidat/vos-recherches/preparer-votre-candidature/cv-lettre-de-motivation-e-mail/comment-faire-son-cv-quand-on-a.html
- https://www.francetravail.fr/candidat/vos-services-en-ligne/creez-un-cv-a-partir-de-votre-pr.html
- https://www.hellowork.com/fr-fr/medias/cv-rubriques.html
- https://www.hellowork.com/fr-fr/medias/date-naissance-cv.html
- https://www.welcometothejungle.com/fr/collections/candidats/faire-un-cv-guide
- https://solutions.welcometothejungle.com/blog/ats-du-march%C3%A9
- https://www.michaelpage.fr/advice/candidats/le-cv-et-la-lettre-de-motivation/quel-cv-pour-un-cadre-exp%C3%A9riment%C3%A9
- https://www.cnil.fr/fr/le-guide-du-recrutement
- https://www.cnil.fr/fr/le-recrutement
- https://www.cnil.fr/fr/recrutement-et-donnees-personnelles-dans-les-tpepme-cinq-questions-incontournables-se-poser
- https://www.ipp.eu/wp-content/uploads/2021/05/n67-notesIPP-mai2021.pdf
- https://developer.textkernel.com/TKPlatform/master/languages/
- https://developer.textkernel.com/tx-platform/v10/resume-parser/api/
- https://userapps.support.sap.com/sap/support/knowledge/en/2081576
- https://resumap.io/articles/textkernel-parsing-test
- https://help.flatchr.io/fr/articles/8278247-tout-savoir-sur-la-fiche-candidat
- https://support.teamtailor.com/en/articles/10209597-co-pilot-candidate-screening
- https://www.cegid.com/fr/produits/cegid-hr/talent-acquisition/logiciel-recrutement-ats-crm-saas/
- https://www.data.gouv.fr/dataservices/api-repertoire-operationnel-des-metiers-et-des-emplois-rome-4-0
- https://www.data.gouv.fr/fr/datasets/repertoire-operationnel-des-metiers-et-des-emplois-rome/
- https://github.com/nezor11/martinez-place et https://github.com/nezor11/martinez-place/pull/87
- https://atsverification.com/blog/latex-resume-ats-friendly/
- https://www.jobscan.co/blog/8-things-you-need-to-know-about-applicant-tracking-systems/
- https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/
- https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/
- https://cvpass.co/blog/liste-ats-france ; https://cvpass.fr/en/blog/entreprises-ats-france ; https://taleez.com/blog/meilleur-ats-logiciel-recrutement-france-comparatif ; https://www.helloworkplace.fr/ia-act-recrutement-report-2027/ (pages lues lors du rapport initial, non relues)

**Pages non chargées ou en échec**
- https://www.apec.fr/candidat/optimiser-votre-candidature/candidature/fiches-avis/optimisez-votre-cv-pour-passer-le-filtre-des-ats-.html (403)
- https://dares.travail-emploi.gouv.fr/publication/discrimination-lembauche-des-personnes-dorigine-supposee-maghrebine-quels-enseignements (CAPTCHA)
- https://eur-lex.europa.eu/eli/reg/2026/1744/oj (contenu vide)
- https://francetravail.io/data/api/rome-4-0-fiches-metiers (contenu non rendu)
- https://www.coe.int/fr/web/common-european-framework-reference-languages/level-descriptions
- https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A62001CJ0101
- https://dataclean.to/use-cases/clean-encoding-from-workday ; https://www.jobmentis.com/fr/guide/welcome-to-the-jungle-ats ; https://www.moncvhub.fr/guides/passer-filtres-ats-en-france ; https://www.cvadapt.fr/blog/ameliorer-cv-passer-ats ; https://cvperformance.fr/blog/rediger-cv/photo-cv/ ; https://enhancv.com/blog/french-resume/ ; https://www.italki.com/en/blog/french-cv

---

## Vérification

| # | Affirmation contrôlée | Verdict | Source / commentaire |
|---|---|---|---|
| 1 | Apec 20/05/2025 : 50 % des grandes entreprises utilisent un SIRH ou ATS pour les cadres (+12 points depuis 2021) ; 4 % utilisent l'IA, 11 % l'envisagent | **Confirmé** | corporate.apec.fr, étude « Pratiques de recrutement de cadres 2025 » |
| 2 | Le chiffre de « 27 % des entreprises françaises » attribué à l'Apec | **Non vérifiable** (absent de l'étude) | Retiré des recommandations |
| 3 | SAP SuccessFactors utilise Textkernel | **Confirmé** | Note SAP 2081576 : « Third party software Text kernel is used to parse resume data » (15 langues dont le français) ; Resumap 20/07/2026 |
| 4 | Textkernel prend en charge le français « all variants », dans les centres NL, DE et US | **Confirmé** | developer.textkernel.com/TKPlatform/master/languages |
| 5 | `DocumentLanguage` (une seule langue) et `DocumentLastModified` (référence pour les postes en cours) | **Nuancé** | Les deux champs existent ; leur usage (langue unique, date de référence) n'est pas documenté dans l'extrait |
| 6 | Ligatures perdues à l'extraction : PR GitHub nezor11/martinez-place #87 | **Confirmé, nuancé** | La PR existe (03/10/2026, react-pdf, `fontFeatureSettings: { liga: false }`). Le dépôt est un site CV personnel (0 étoile, 353 commits, non archivé) : c'est un cas isolé. Le problème dépend de l'absence de ToUnicode (atsverification.com) |
| 7 | Polices d'icônes qui gênent la détection des coordonnées (atsverification.com, 22/08/2026) | **Confirmé** | Date et contenu confirmés ; source commerciale |
| 8 | Profil de compétences France Travail : case « Élément privé (non visible par les recruteurs) » ; CV visibles seulement par les recruteurs certifiés | **Confirmé** | francetravail.fr, page « Créez un CV à partir de votre profil » |
| 9 | ROME 4.0 : mars 2023, API Compétences, Métiers, Fiches métiers, Contextes | **Confirmé** | data.gouv.fr (4 API, 1 appel/s, v4.0 en mars 2023) |
| 10 | ROME 4.0 : « 6 domaines, 32 enjeux, 80 objectifs, 492 macro-compétences » | **Non vérifiable** | data.gouv.fr donne d'autres chiffres, plus fins ; à recontrôler via l'API |
| 11 | Teamtailor Co-pilot : pas de rejet automatique, affichage ✓/✕/–, modifiable par le recruteur | **Confirmé** | support.teamtailor.com, article 10209597 |
| 12 | WTTJ ATS « IA-native » (mars 2026) ; absence de filtre par mots-clés | **Nuancé, partiellement réfuté** | « IA-native » confirmé (blog du 10/03/2026). Le même article vante le scoring pour « écarter » des CV |
| 13 | Cegid HR : parsing, scoring, résumé des CV par IA | **Confirmé** | cegid.com, page ATS-CRM |
| 14 | Flatchr : CV en Word ou PDF ; en-tête et pied de page ignorés | **Confirmé / non vérifiable** | Formats confirmés (help.flatchr.io) ; rien sur l'en-tête et le pied de page |
| 15 | Digital Omnibus : Annex III reportée du 02/08/2026 au 02/12/2027 ; accord du 06/05/2026 ; Parlement 16/06 ; Conseil 29/06 ; entrée en vigueur 27/07/2026 ; Règlement (UE) 2026/1744 | **Confirmé pour les dates, nuancé pour le reste** | Gibson Dunn (06/05) et Usercentrics (07/05, plus Parlement, Conseil, entrée en vigueur, numéro). Numéro non confirmé sur EUR-Lex (échec de chargement) |
| 16 | IPP n°67 (mai 2021) : 2 400 offres, 9 600 candidatures ; pas d'écart significatif femmes/hommes en moyenne ; disparités selon la qualification | **Confirmé** | PDF IPP (testing Dares/IPP/ISM Corum) |
| 17 | Dares (novembre 2021) : -31,5 % de rappel pour une origine maghrébine supposée | **Non vérifiable en direct** | Page protégée par CAPTCHA ; cohérent avec la publication connue |
| 18 | CV anonyme : loi du 17/08/2015 qui le rend facultatif ; Conseil d'État 04/11/2015 ; texte actuel de L1221-7 | **Confirmé** | conseil-etat.fr (n° 387014) ; code.travail.gouv.fr |
| 19 | Défenseur des droits (2019) : photo « exceptionnel » ; liste des éléments à anonymiser | **Confirmé** | Texte extrait du PDF du guide |
| 20 | Michael Page : « deux voire trois pages » au-delà de 10 ans ; accroche de 2-3 lignes | **Confirmé** | michaelpage.fr |
| 21 | HelloWork : « 1 page maximum » | **Réfuté (corrigé)** | La page dit « ne doit pas excéder deux pages – une seule page étant l'idéal » (mise à jour du 29/10/2024) |
| 22 | HelloWork 02/01/2025 : « Vous n'avez donc pas à indiquer votre âge sur votre CV » | **Confirmé** | hellowork.com, page date-naissance-cv |
| 23 | WTTJ : 1 page, « 30 secondes maximum » | **Confirmé** | welcometothejungle.com, guide CV |
| 24 | France Travail : titre « obligatoire » | **Nuancé** | Non trouvé ; la page parle d'une accroche qui présente « synthétiquement vos objectifs professionnels ou vos compétences clés » |
| 25 | France Travail : cercles de couleur de 1 à 5 « pour les niveaux » de langue | **Nuancé** | Les cercles concernent les compétences en général, pas spécifiquement les langues |
| 26 | France Travail : 3 centres d'intérêt, pas de politique ni de religion, classés par importance | **Nuancé** | « Environ 3 » et « engagement politique » confirmés ; religion non citée ; « classés par importance » non trouvé |
| 27 | France Travail, longues carrières : « une, voire une page et demie », dix dernières années | **Confirmé** | francetravail.fr, page « comment-faire-son-cv-quand-on-a » |
| 28 | CNIL : guide de janvier 2023 en 19 fiches ; vivier de 2 ans « en principe » ; mise à jour en avril 2026 | **Confirmé / corrigé** | Guide du 30/01/2023, 19 fiches ; « n'excède en principe pas deux ans » (fiche TPE/PME). La seule mise à jour documentée est celle de la fiche 16 en mai 2026 (contrôle d'honorabilité) |
| 29 | « 75 % des CV sont rejetés par les ATS » | **Réfuté comme généralité / non sourcé** | Jobscan : un ATS « rarely "rejects" a candidate automatically » ; aucune source primaire trouvée |
| 30 | Arrêt CJUE Lindqvist (C-101/01) : la publication sur Internet sort de l'exemption domestique | **Confirmé** (jurisprudence établie, 06/11/2003, point 47) | Page EUR-Lex non rechargée |
| 31 | Arrêt de la Cour de cassation de 2025 sur l'exigence d'une photo | **Non vérifiable** | Retiré |
| 32 | Statistiques « 67 % / 85 % » sur la photo | **Non vérifiable** (blogs commerciaux) | À ne pas citer |