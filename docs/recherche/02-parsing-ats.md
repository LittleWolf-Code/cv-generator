# Parsing des CV par les ATS : fonctionnement, ce qui le casse, comment le tester (état au 05/10/2026, rapport vérifié)

## 0. Synthèse

- **Le vrai risque n'est pas un robot qui rejette les CV en masse.** Trois mécanismes existent vraiment :
  1. **La conversion du fichier en texte échoue.** Le profil créé est alors vide ou faux, et le candidat n'apparaît plus dans les recherches par mots-clés.
  2. **Les recruteurs règlent des filtres** : questions éliminatoires (knockout questions), critères stricts, par exemple un trou de plus de 6 mois dans le parcours.
  3. **Des scores et des classements par IA**, de plus en plus répandus (Greenhouse Talent Matching, Workday/HiredScore). Ils lisent le *texte extrait* du CV.
- **Textkernel** a intégré Sovren : le site Textkernel présente « Sovren & Textkernel » comme une offre fusionnée, et l'API TX Platform est l'ancienne API Sovren. La documentation SAP SuccessFactors le désigne comme son parseur. D'après Textkernel, il est aussi proposé pour Oracle Recruiting Cloud. Sa documentation dit : *« The vast majority of problems in parsing are not from processing the plain text, but from conversion to plain text. »*
- **PDF ou DOCX : les sources se contredisent.**
  - Textkernel déconseille le PDF (« PDF is a broken standard that often hides issues with the underlying text ») et le classe en « Major Issue » (code 300).
  - Jobscan (27/05/2025) recommande au contraire le PDF, sans décrire sa méthode de test.
  - **Conclusion retenue :** un PDF texte propre, sur une seule colonne, suffit dans la plupart des cas. Le DOCX reste l'option la plus prudente. Le générateur doit produire les deux formats, plus un .txt.
- **Test local réalisé pour ce rapport** (Edge 154.0.4258.53, trois extracteurs de texte). La partie ligatures a été réexécutée pendant la vérification et donne le même résultat :
  - Les ligatures de Calibri sortent en caractères spéciaux U+FB01–FB03 dans pdfminer.six : 0 mot-test retrouvé sur 6. Avec `font-variant-ligatures: none`, on en retrouve 6 sur 6.
  - Un titre en `letter-spacing` devient « C O M P É T E N C E S ».
  - Une mise en page sur 2 colonnes mélange les lignes des deux colonnes, ou fait passer la colonne latérale avant le nom.
  - Les jauges de compétences disparaissent.
  - html2pdf.js produit un **PDF image** dont le texte n'est pas sélectionnable (c'est écrit dans son README).
- **Mots-clés :** les moteurs comparent surtout des **termes** ; Textkernel Match v2 se décrit comme *« term-based »*. Ils y ajoutent des taxonomies de synonymes. Les abréviations ne sont pas toujours reconnues (Lever, d'après Jobscan) : il faut écrire l'acronyme **et** la forme longue. Le titre de poste et les compétences récentes pèsent plus lourd.

---

## 1. Mythes et faits vérifiés

### 1.1 « 75 % des CV sont rejetés par les ATS » : un chiffre marketing
- **Origine :** un argument de vente de **Preptel** (logiciel ResumeterPro) vers 2012.
  - D'après Uncharted Career, l'entreprise a fermé en août 2013 sans publier d'étude, de jeu de données ni de méthode.
  - Le chiffre circule sous la forme 70 %, 75 % ou 88 % selon les sites, ce qui confirme l'absence de source unique.
- **Qui l'a retracé :**
  - Uncharted Career ;
  - un article de *The Conversation* du 05/07/2026, écrit par Leda Salazar de Leon (Mount Royal University) et Mehnaz Rafi (University of Calgary) : *« a 2012 sales pitch by Preptel… No methodology was ever published »*.
- **Article de CIO du 29/02/2012 sur Preptel :** il existe bien. Il cite le classement par pertinence (*« The relevancy ranking is based on how closely you match each keyword phrase… »*) et un chiffre interne (50 % des candidats jugés « very strong » ont décroché un entretien entre septembre et décembre 2011). Il ne contient **pas** le chiffre de 75 %. Le document marketing original de Preptel reste introuvable.

### 1.2 Ce que dit vraiment le rapport HBS/Accenture *Hidden Workers* (septembre 2021)
- **Échantillon :** plus de 8 000 travailleurs « cachés » et 2 275 dirigeants (au moins 750 par pays), aux États-Unis, au Royaume-Uni et en Allemagne. L'enquête employeurs date de janvier–février 2020, l'enquête travailleurs de mai–juin 2020.
- **Le chiffre de 88 % est une opinion d'employeurs, pas un taux de rejet.** 88 % estiment que des candidats qualifiés à hautes compétences sont écartés parce qu'ils *« do not match the exact criteria established by the job description »*. Ce taux monte à 94 % pour les postes à compétences intermédiaires. Seuls les employeurs équipés d'un logiciel de recrutement (RMS) ont répondu à cette question (note de la figure 10).
- **Usage des logiciels :**
  - 63 % des employeurs utilisent un RMS : 69 % dans les entreprises de plus de 1 000 salariés, 75 % aux États-Unis, 58 % au Royaume-Uni, 54 % en Allemagne.
  - Plus de 90 % de ces employeurs s'en servent pour filtrer ou classer au départ : 94 % pour les postes intermédiaires, 92 % pour les postes qualifiés.
  - Le rapport cite Jobscan : 99 % des entreprises du Fortune 500 utilisent un ATS. Jobscan donne aujourd'hui 97,8 % (étude citée dans son article de mai 2025).
- **Exemple de filtre automatique :** *« Almost half the companies surveyed »* écartent automatiquement les CV qui présentent un trou de plus de six mois. Ce sont des **règles fixées par les recruteurs**, pas une incapacité de la machine à lire le CV.

### 1.3 Enquêtes auprès de recruteurs (à lire avec prudence : petits échantillons, éditeurs)
- **Enhancv, « structured interviews with 25 US recruiters across more than ten ATS platforms »** (page « What is ATS », publiée le 06/07/2026 et mise à jour le 30/09/2026). Enhancv vend des modèles de CV, donc l'étude n'est pas neutre.
  - 92 % disent que leur ATS *« doesn't auto-reject resumes for formatting, content, or design »*. La formulation porte sur la forme et le contenu, pas sur des « mots-clés manquants ».
  - 44 % ont accès à un « score d'adéquation » calculé par IA ; seulement 8 % s'en servent comme filtre éliminatoire.
  - 76 % apprécient les mots-clés employés naturellement.
  - La page décrit les questions éliminatoires (autorisation de travail, etc.), qui *« can route you to a recruiter for review, or auto-reject you »*.
  - **Non retrouvé sur la page :** le chiffre de « 84 % utilisent des questions éliminatoires » et les dates de l'enquête (septembre–octobre 2025). Ces deux points ne sont pas vérifiés.
- **« Sondage LinkedIn de 630 recruteurs, 83 % »** : cité par un blog, source primaire introuvable. **Non vérifié.**

### 1.4 Ce qui trie réellement (vérifié)
- **Questions éliminatoires** et **critères stricts** fixés par l'employeur (HBS, Enhancv).
- **Greenhouse Talent Matching** (suite « Real Talent » de Greenhouse Recruiting). Page de politique mise à jour le 13/08/2026 :
  - chaque candidat reçoit un score selon la proximité de son CV avec la « calibration » du recruteur ;
  - l'outil *« does not automatically reject or advance candidates »* ;
  - un candidat qui refuse l'analyse par IA est marqué *« Needs manual review »* et n'est pas évalué.
  - **Information devenue obsolète :** l'interview non datée du cofondateur Jon Stross, qui affirmait que Greenhouse ne classe pas les candidats.
- **Workday.**
  - Le projet de rachat de HiredScore (« Talent Orchestration », IA de notation et d'orchestration des candidats) a été annoncé le 26/02/2024, pièce 99.1 d'un formulaire 8-K déposé à la SEC.
  - L'affaire *Mobley v. Workday* vise des outils qui *« score, sort, rank or screen applicants »*. Le 16/05/2025, la juge Rita Lin (tribunal fédéral de Californie du Nord) a accordé une certification préliminaire en action collective nationale, au titre de la loi américaine contre la discrimination liée à l'âge (ADEA). L'état ultérieur de la procédure n'a pas été vérifié.
- **Union européenne.**
  - Le règlement sur l'IA (AI Act, Annexe III, point 4(a)) classe « à haut risque » les systèmes d'IA servant au recrutement, *« in particular to place targeted job advertisements, to analyse and filter job applications, and to evaluate candidates »*.
  - D'après la chronologie d'artificialintelligenceact.eu (mise à jour le 31/08/2026), les obligations correspondantes s'appliquent à partir du **2 décembre 2027**. Le texte initial prévoyait le 2 août 2026, et la page n'explique pas ce report : il faut le confirmer au Journal officiel de l'UE avant de le citer comme définitif.
  - Ces obligations visent les employeurs et les éditeurs d'outils de tri. Elles ne visent pas un générateur de CV personnel.

---

## 2. Comment fonctionne un parseur (chaîne de traitement)

1. **Conversion du fichier en texte brut**, avec contrôle de validité. Codes renvoyés par Textkernel :
   - `ovProbableGarbageInText` : 5 % ou plus des caractères sont des « symboles » ;
   - `ovAvgWordLengthLessThan4` ou `ovAvgWordLengthGreaterThan20` : longueur moyenne des mots anormale ;
   - `ovTooFewLineBreaks`, `ovLinesSeemTooShort` : retours à la ligne anormaux ;
   - `ovMayContainSomeReversedText` : texte possiblement à l'envers ;
   - `ovCorrupt` : fichier illisible.

   Si le texte est inutilisable, le traitement s'arrête là. Textkernel précise : *« If the converted text is malformed, we cannot fix it. »*
2. **Reconnaissance de caractères (OCR) pour les fichiers image.**
   - Chez Textkernel, elle concerne *« approximately 5% of documents »*.
   - Elle est limitée à 10 pages et 120 secondes.
   - Elle entraîne *« a small additional transaction cost »* : c'est une option payante, donc rien ne garantit que l'employeur l'ait activée.
   - Selon Textkernel (qui vend la solution), Oracle Recruiting Cloud seul ne fait pas d'OCR sur les PDF scannés.
3. **Découpage en sections** à partir des intitulés : codes Textkernel 412 à 416 (gravité « Fatal ») et 151 (voir §5.9).
4. **Extraction des champs** : nom, coordonnées, postes, dates, diplômes, compétences.
   - Affinda (article du 02/12/2025) : *« a trained machine-learning model (not an LLM) »*.
   - Textkernel propose un **LLM Parser** en option payante (*« An add-on cost applies to each transaction »*).
     - Fichiers d'environ 3 Mo maximum, contre environ 16 Mo pour le parseur standard.
     - Réponses *« several seconds slower »*.
     - Indisponible dans le centre de données australien.
     - La doc admet : *« The LLM Parser can generate information that is factually incorrect or misleading »*.
     - *Non vérifié :* la date de lancement (2024) et la prise en charge spécifique des colonnes.
5. **Normalisation** : rattachement aux taxonomies de compétences et de métiers, y compris d'une langue à l'autre, et géocodage.
6. **Indexation**, puis **recherche** par mots-clés ou requêtes booléennes et **calcul d'adéquation** avec l'offre (voir §6).

---

## 3. Panorama des ATS et des parseurs (ce qui est documenté)

| Système | Moteur de parsing | Formats et limites documentés | Remarques / fiabilité |
|---|---|---|---|
| **Workday Recruiting** | Non documenté publiquement (doc réservée aux clients) | — | Vérifier soi-même le formulaire pré-rempli. Rachat de HiredScore annoncé en février 2024. Les affirmations de blogs SEO (« parseur OCR », « 96 % de réussite en DOCX contre 85 % en PDF ») sont **invérifiables**. |
| **Oracle Taleo** (édition Business 24A) | Non documenté | PNG/JPEG acceptés, mais *« the resume will not be parsed when it is in an image format »*. Le parsing alimente le champ « resume keyword » utilisé pour les recherches. | Sur mobile, un CV collé en texte brut est analysé pour pré-remplir le formulaire. |
| **Oracle Recruiting Cloud** | Textkernel proposé par l'éditeur. *Non vérifié :* la mention « marketplace Oracle » et le plugin RChilli, absents de la page Textkernel consultée. | OCR des PDF scannés via Textkernel uniquement (affirmation du fournisseur) | Source unique : le fournisseur. |
| **SAP SuccessFactors** | **Textkernel** : *« SAP SuccessFactors uses the third-party software Textkernel to parse resume data »* | Dépôt candidat : .doc .docx .gif .jpeg .jpg .pdf .txt. **PDF protégés ou sécurisés refusés.** Dépôt en lot : 5 Mo maximum, formats DOCX, PDF, TXT, TIFF, JPG, BMP, GIF. En lot, le parsing échoue *si le pays ou la région manque*. | Langues prises en charge, dont le français. La doc admet que le parsing *« isn't always 100% accurate »*. |
| **iCIMS** | Moteur natif **non confirmé** | — | Le partenariat avec Daxtra (module complémentaire) est confirmé. L'affirmation « iCIMS = Textkernel » n'apparaît que chez un éditeur tiers (Resumap). |
| **Greenhouse** | Non précisé | .doc .docx .pdf .rtf .txt. Dépôt jusqu'à 100 Mo, mais *« can't parse resumes larger than 2.5MB »* (page « Unsuccessful resume parse »). Un CV déposé en image n'est pas analysé. | Liste officielle des causes d'échec : voir §5. Elle cite aussi les noms d'entreprise sans forme juridique (« Inc., Co., LTD, LLC »). Talent Matching : voir §1.4. |
| **Lever** | Non précisé | Doc développeurs : *« image files are not supported and will not be successfully parsed for information »* | Selon Jobscan (10/04/2026, source secondaire) : variantes d'un même mot reconnues (racinisation), mais **pas les abréviations** (« SEO » ne remonte pas sur « Search Engine Optimization »). |
| **SmartRecruiters** | Non précisé | Erreurs API `UNPARSABLE_RESUME` (par exemple une image) et `INCOMPLETE_RESUME` | Champs extraits : nom, email, téléphone, localisation, profils web, formation, expérience. |
| **Teamtailor** | Parseur maison, moteur non documenté | Formats non documentés | Annonce de 2019 : nom, email, téléphone, URL LinkedIn. Amélioré en juin 2022 (jusqu'à 100 CV d'un coup). |
| **Textkernel / Sovren** | — | Word, PDF, HTML, RTF, OpenOffice, TXT, Excel… OCR en option | *« 29 languages »*, environ 0,5 s par CV en médiane. Codes « Resume Quality » (voir §5). Selon Textkernel, *« at least 15% »* des CV sont en colonnes. |
| **Daxtra** | — | 8 Mo maximum. Formats PDF, Word, HTML, RTF, TXT, ODT, Apple Pages (selon la base de connaissances de l'intégrateur Mercury). | Prénom et nom obligatoires : un nom abrégé ou masqué fait échouer l'analyse. Au moins un téléphone et/ou un email. À éviter : en-têtes, tableaux, graphiques, photos, CV en image, texte incliné, zones de texte, formes. Polices simples (Helvetica, Arial, Times New Roman, Courier New). |
| **Affinda / RChilli / HireAbility** | — | Formats larges, images comprises | Taux de précision de 95–99 %, plus de 200 champs, plus de 50 langues : **chiffres marketing non audités**. |

---

## 4. PDF ou DOCX

**Les éléments disponibles :**
- **Textkernel :**
  - *« If you want to minimize conversion problems, don't use PDF documents. »*
  - *« PDF is a broken standard that often hides issues with the underlying text. »*
  - Code qualité 300 (« Document was PDF ») et 301 (Apple Pages) classés en Major Issue.
- **Jobscan (27/05/2025) :** *« Most applicant tracking systems read and parse PDF resumes more accurately »*. L'article invoque *« our tests »* sans méthode, échantillon ni protocole.
- **Resumap (28/07/2026, éditeur de modèles) :** un même CV exporté dans 36 modèles **PDF** et passé dans 4 parseurs (Zoho Recruit, Manatal, Workable, Textkernel).
  - Contact extrait 36 fois sur 36 partout.
  - Textkernel découpe correctement les postes dans 31 cas sur 36 et garde toutes les compétences clés dans 36 cas sur 36.
  - Zoho conserve toutes les compétences principales dans 27 cas sur 36.
  - Conclusion de Resumap : *« The failure mode isn't columns. It's text-stream order »*.
- **Ce qui est rédhibitoire partout :** un PDF image ou scanné (seul l'OCR, en option, le rattrape) et un PDF protégé (refusé par SuccessFactors).

**Recommandation pour le projet :** générer depuis une même source de données :
- (a) un **PDF texte** produit par Chromium, sur une seule colonne, sans ligatures ;
- (b) un **DOCX** natif, avec des paragraphes et des styles de titre, sans tableau ni zone de texte ;
- (c) un **.txt** à coller dans les formulaires.

Toujours respecter le format demandé par l'offre.

---

## 5. Ce qui casse le parsing, élément par élément

### 5.0 Protocole du test local
- **Génération :** Edge 154.0.4258.53 (version vérifiée sur la machine), impression en PDF sans interface (headless).
- **Extracteurs :** Xpdf `pdftotext` 4.00 (modes par défaut et `-raw`), PyMuPDF 1.26.7, pdfminer.six 20251230. pdfminer.six est très utilisé par les parseurs Python, par exemple pyresparser.
- **Limites :**
  - CV fictif, une seule machine, aucun ATS réel.
  - Les versions des extracteurs ne sont **pas les plus récentes** :
    - Xpdf 4.00 date de 2017 ;
    - PyMuPDF en est à la 1.28.2 (août 2026) ;
    - pdfminer.six en est à la 20260107.
  - Poppler `pdftotext` est plus répandu que Xpdf. Les résultats peuvent donc varier avec d'autres versions.

| Variante | Résultat |
|---|---|
| 1 colonne, Calibri, ligatures actives | Xpdf et PyMuPDF : OK. **pdfminer : 0 mot sur 6** (workflow, efficient, certification, financière, office, fluent), avec 6 caractères de ligature U+FB01–FB03 dans le texte. Après normalisation NFKC : 6/6. Résultat reproduit pendant la vérification. |
| Même chose avec `font-variant-ligatures:none` | 6/6 partout, résultat reproduit |
| Titre en `letter-spacing:.35em` | « C O M P É T E N C E S » avec Xpdf `-raw`, PyMuPDF et pdfminer. Seul Xpdf en mode par défaut recolle le mot. |
| 2 colonnes, colonne latérale en premier dans le code HTML | Xpdf et PyMuPDF : contact, compétences et langues passent **avant le nom**. Xpdf par défaut colle le 2e poste au paragraphe précédent. pdfminer **mélange les lignes des deux colonnes** (« CONTACT / Jean Dupont / +33… / Ingénieur logiciel… ») et place les langues après l'expérience. |
| 2 colonnes, contenu principal en premier dans le code HTML | Xpdf et PyMuPDF : ordre correct. **pdfminer mélange toujours les lignes.** L'ordre de lecture dépend donc de l'extracteur. |
| Tableau (dates et entreprise / poste) | Xpdf par défaut lit **colonne par colonne** : toutes les dates, puis tous les postes, et les correspondances sont perdues. Les autres extracteurs gardent l'ordre des lignes. |
| Jauges de compétences en CSS | **Niveau perdu**, seul le nom de la compétence reste |
| Étoiles ★★★★☆ | Restituées telles quelles, sans signification pour un parseur |
| Emoji « épingle » (U+1F4CD) | Caractères illisibles avec Xpdf ; restitué par PyMuPDF et pdfminer |
| Icône SVG | Supprimée sans avertissement |
| Lien affiché « GitHub » | Le lien URI est conservé, mais **le texte extrait ne contient que « GitHub »** |
| PDF balisé ? | Oui : `StructTreeRoot` et `MarkInfo /Marked true` vérifiés. Table ToUnicode présente sur les polices Calibri. Aucun des 3 extracteurs ne se sert du balisage pour l'ordre de lecture. |

### 5.1 Plusieurs colonnes
- Textkernel, code 433 (Major) : *« It is a HUGE MISTAKE for candidates to represent data in columns rather than in a simple top-to-bottom, all-across-the-page format. »*
- Son blog dit avoir fait passer la part des CV en colonnes « bien rendus » de 62 % à 90 %. Il reste donc environ 10 % d'échecs, même chez le leader du marché.
- Greenhouse cite la mise en colonnes parmi les causes d'échec.
- Resumap conclut que l'ordre du texte dans le fichier compte plus que l'aspect visuel.
- Enhancv a étudié 60 CV ayant décroché un entretien (« June 2026 group ») : 44, soit 73 %, étaient en 2 colonnes. Cela ne prouve pas de lien de cause à effet, comme l'auteur le reconnaît, et Enhancv vend des modèles 2 colonnes.

**Recommandation : une seule colonne.**

### 5.2 Tableaux
- Greenhouse (*« Complex resumes with tables, headers, and footers »*) et Daxtra les déconseillent.
- Le test montre qu'avec Xpdf en mode par défaut, les correspondances entre cellules sont perdues.

### 5.3 En-têtes, pieds de page, zones de texte
- Greenhouse : *« Name and contact information in the header, footer, or text box »* fait partie des causes d'échec.
- Daxtra : éviter les en-têtes et les zones de texte.
- Textkernel, code 311 (Major) : *« Contact information should only be found at the top of the resume. »*
- La statistique « 25 % des coordonnées non reconnues quand elles sont dans l'en-tête », attribuée à Jobscan, n'a pas de source primaire : **non vérifiée**.

### 5.4 Images, photo, logos, icônes, emoji
- Les images ne sont pas analysées chez Greenhouse (*« graphics, photos, or word art »*, *« Resumes uploaded as an image »*), Daxtra, Lever et Taleo.
- Une icône ne doit jamais être le seul support d'une information.
- Les polices d'icônes (zone Unicode à usage privé) sortent en caractères illisibles. C'est un mécanisme connu, que je n'ai pas testé ici.

### 5.5 Niveaux de compétences en barres ou étoiles
L'information est perdue (voir le test). Écrire le niveau en texte : « Anglais : C1 (TOEIC 945) », « Python : 5 ans ».

### 5.6 Polices, ligatures, table ToUnicode
- **Le principe :** un PDF stocke des numéros de glyphes, pas des lettres. Une table **ToUnicode** fait la correspondance inverse, et sans elle l'extraction renvoie du charabia.
- **Les ligatures** (fi, fl, ffi) peuvent sortir en un seul caractère spécial : c'est le résultat observé avec pdfminer. Le mot « workflow » n'est alors plus trouvé par une recherche.
- **Correctif LaTeX :**
  - Le ticket latex2e #465 (« Preload glyphtounicode.tex… ») a été clos comme réalisé le 04/05/2021, dans la version du printemps 2021.
  - Les distributions récentes de pdfLaTeX le font donc par défaut.
  - `\input{glyphtounicode}` et `\pdfgentounicode=1`, ou le paquet `cmap`, ne restent utiles que sur des installations anciennes.
- **Correctif web :** `font-variant-ligatures: none` dans la feuille de style d'impression.
- Daxtra recommande des polices simples (Helvetica, Arial, Times New Roman, Courier New).

### 5.7 Espacement des lettres, texte vertical ou incliné
- Greenhouse cite *« A resume with spaces between the letters »* parmi les causes d'échec, et le test le confirme.
- Textkernel : le texte vertical ou en diagonale empêche une extraction correcte.
- Daxtra : pas de texte incliné.

### 5.8 Ordre de lecture et PDF balisés
- Chromium produit des PDF balisés (vérifié sur le test), ce qui est utile pour l'accessibilité.
- **Aucun éditeur d'ATS ne documente l'usage de ces balises.** Les extracteurs testés suivent soit l'ordre du flux du fichier (l'ordre du code HTML), soit la géométrie de la page.
- **Règle :** ordre du code HTML = ordre visuel = ordre logique.

### 5.9 Intitulés de sections
- Textkernel, exemple de message pour le code 151 : *« Every section should have a clear, unambiguous, commonly-used header on a separate line directly above the content »*.
- Codes 412 à 416 (Fatal) : aucune section trouvée, ou sections Expérience / Formation absentes, ou reconstituées par calcul.
- Greenhouse : *« Resumes without clear sections »*.
- Le parseur d'OpenResume reconnaît un intitulé s'il est **seul sur sa ligne, en gras et en MAJUSCULES**, et sinon par mots-clés.
- Intitulés FR recommandés : « Expérience professionnelle », « Formation », « Compétences », « Langues », « Certifications », « Projets », « Centres d'intérêt ».

### 5.10 Dates
- Textkernel :
  - code 418 (Fatal) : *« Date ranges were found written vertically on multiple lines »* ;
  - codes 224 et 225 : dates de début ou de fin manquantes ;
  - code 419 (Fatal) : postes sans dates.
- Lever calcule les années d'expérience à partir des dates extraites (extrait de son centre d'aide, non revérifié).
- **Format conseillé :** « 01/2021 – 03/2023 » ou « janv. 2021 – mars 2023 », sur la même ligne que le poste ou celle juste en dessous.
- Textkernel déconseille les dates dans la section Formation (code 233, simple suggestion). C'est un avis d'origine américaine, contraire à l'usage en France.

### 5.11 Coordonnées
- **Obligatoires :**
  - nom complet : chez Daxtra, un nom abrégé ou masqué fait échouer l'analyse ;
  - au moins un téléphone et/ou un email.
- Textkernel, code 441 (Major, quand ni l'un ni l'autre n'est trouvé) : il faut toujours les deux.
- **Un seul** email et **un seul** téléphone (codes 132 et 133, suggestions).
- Indiquer **ville et pays** : en dépôt par lot, SuccessFactors ne peut pas analyser un CV sans pays ou région.
- À ne pas mettre : date de naissance, situation familiale, numéros de permis ou de passeport. Textkernel le signale par les codes 121 à 124, suggestions limitées aux CV des États-Unis, d'Australie, de Nouvelle-Zélande et du Royaume-Uni.

### 5.12 Liens
- **Afficher l'URL en clair** (« linkedin.com/in/… »).
- Avec le texte d'ancre seul (« GitHub »), l'URL disparaît du texte extrait.

### 5.13 Taille, sécurité, longueur
- Viser **moins de 2 Mo** : Greenhouse n'analyse pas au-delà de 2,5 Mo, et le LLM Parser de Textkernel est limité à environ 3 Mo.
- Pas de mot de passe ni de restriction sur le PDF.
- Les CV très longs sont tronqués (code 408, Fatal).
- Les CV de type académique sont mal analysés : seule la 1re section d'expérience est lue (code 417).

### 5.14 Générateurs HTML vers PDF (point critique pour le projet)
- **html2pdf.js** (dernière version 0.14.0, publiée le 12/01/2026 ; dépôt actif) : *« renders all content into an image, then places that image into a PDF. This means text is not selectable or searchable »*. Le README évoque un futur moteur de rendu vectoriel via jsPDF (« New renderer »), qui n'est pas encore livré. **À proscrire.**
- **À privilégier :** l'impression PDF de Chromium (`window.print()` ou un Chromium sans interface) ou un moteur vectoriel (`@react-pdf/renderer`, utilisé par OpenResume, vérifié dans son package.json). Il faut ensuite **tester** le résultat.

---

## 6. Mots-clés et correspondance avec l'offre

- **Recherche :**
  - Textkernel ne distingue pas majuscules et minuscules ;
  - Lever reconnaît les variantes d'un même mot mais pas les abréviations (Jobscan) ;
  - Greenhouse cite les titres incomplets parmi les causes d'échec (*« Sr. Account Exec instead of Senior Account Executive »*).

  → Écrire **l'acronyme et la forme longue** (« SQL (Structured Query Language) »).
- **Correspondance (Textkernel Search & Match v2) :**
  - *« term-based matching engine »*, avec un poids par critère (dans l'exemple de la doc, le titre de poste compte pour environ 30 %) ;
  - critères « must-have » et « must-not-have », qui deviennent des filtres éliminatoires ;
  - **bonus de récence** : les titres de poste récents pèsent plus ;
  - **bonus croisé** : une compétence présente dans un poste récent compte plus ;
  - pondération ajustée selon le contexte (pas de critère de lieu pour un poste en télétravail) ;
  - des « signaux sémantiques » s'ajoutent ;
  - taxonomies de synonymes et de liens métier–compétences, y compris d'une langue à l'autre.
- **Greenhouse :** score calculé par rapport à la calibration du recruteur (non publiée).
- **Pratique conseillée :**
  - reprendre les termes exacts de l'offre quand ils sont vrais ;
  - mettre l'intitulé du poste visé dans le titre ou le résumé ;
  - citer les compétences **dans les expériences récentes** et aussi dans une section Compétences. Textkernel (code 112) préfère les compétences en contexte, et 76 % des recruteurs interrogés par Enhancv apprécient les mots-clés employés naturellement ;
  - pas de bourrage de mots-clés.
- **Texte blanc caché :** aucune source vérifiée sur sa détection. C'est une manipulation, à éviter.

---

## 7. Tester soi-même la lisibilité d'un CV

1. **Copier-coller** tout le PDF dans le Bloc-notes : vérifier l'ordre, les caractères manquants, les lettres espacées.
2. **Comparer plusieurs extracteurs**, car leurs comportements diffèrent :
   - `pdftotext` (Poppler ou Xpdf), en mode par défaut et `-raw` ;
   - **PyMuPDF**, `get_text()` (licence AGPL-3.0, environ 10,8 k étoiles) ;
   - **pdfminer.six** (licence MIT, environ 7 k étoiles ; découpage géométrique, sensible aux ligatures et aux colonnes) ;
   - **pdfplumber** (licence MIT, environ 10,8 k étoiles, dernier push le 06/08/2026).
3. **Contrôles automatiques** inspirés des codes de conversion de Textkernel :
   - présence de caractères U+FB00–FB06 (ligatures), U+E000–F8FF (polices d'icônes) ou U+FFFD (caractère de remplacement) ;
   - proportion de symboles ≥ 5 % ;
   - longueur moyenne des mots < 4 (lettres espacées) ;
   - email et téléphone détectés ;
   - intitulés standards trouvés ;
   - table ToUnicode présente sur toutes les polices (vérifiable avec PyMuPDF).
4. **Parseur d'OpenResume** (open-resume.com/resume-parser). Il fonctionne dans le navigateur avec pdf.js (*« File data is used locally and never leaves your browser »*). Licence AGPL-3.0, 8 912 étoiles.
   - **Dernier commit : 29/10/2024**. Le dépôt n'est pas archivé, mais il n'est plus maintenu activement.
   - **Pensé pour l'anglais américain** : *« designed to parse single column resume in English language »*, téléphone au format « (xxx)-xxx-xxxx », lieu au format « City, ST ».
   - Un CV français peut donc obtenir un mauvais score sur le téléphone ou le lieu sans que ce soit un vrai problème.
5. **Démos ou essais de parseurs commerciaux** (Textkernel, Affinda, RChilli, Daxtra) et comptes d'essai d'ATS (Zoho Recruit, Workable, Manatal, comme dans le test Resumap). Ne pas envoyer de fausses candidatures : Greenhouse signale que son parseur ignore les données qu'il ne peut pas *« definitively prove as real »*.
6. **Outils SEO comme Jobscan :** les « scores ATS » sont propres à chaque outil et ne reproduisent aucun ATS réel.
7. **Bibliothèques open source :**
   - **Resume-Matcher** : licence Apache-2.0, 28 585 étoiles, dernier push le 04/10/2026, fonctionne avec des LLM ;
   - **pyresparser** : licence GPL-3.0, 957 étoiles, dernier commit le 13/09/2023, **à considérer comme abandonné**.

   Métadonnées relevées via l'API GitHub le 05/10/2026.

Exemple de contrôle minimal :
```python
import fitz, unicodedata, re
t = "".join(p.get_text() for p in fitz.open("cv.pdf"))
bad = re.findall(r"[\ufb00-\ufb06\ue000-\uf8ff\ufffd]", t)
print("ligatures/PUA/�:", len(bad), "| email:", bool(re.search(r"\S+@\S+\.\w+", t)))
print("mots moyens:", sum(map(len, t.split()))/max(1,len(t.split())))
```
Pour reproduire le défaut de ligature observé, il faut tester aussi avec `pdfminer.high_level.extract_text`. PyMuPDF ne le montre pas sur ce CV.

---

## 8. Checklist pour le cahier des charges

**DOIT (bloquant)**
1. Un PDF **texte** sélectionnable, jamais une image : pas de html2pdf.js ni de html2canvas, pas de scan.
2. **Une seule colonne**, ordre du code HTML = ordre de lecture, pas de colonne latérale.
3. Nom complet, un seul email, un seul téléphone, ville et **pays** en **haut du corps** du document. Rien dans les en-têtes, pieds de page ou zones de texte.
4. Intitulés de sections **standards**, seuls sur leur ligne, sans `letter-spacing`.
5. Pour chaque poste : **intitulé complet**, entreprise, lieu, dates `MM/AAAA – MM/AAAA` sur une seule ligne.
6. `font-variant-ligatures: none` dans la feuille de style d'impression, et vérification qu'il n'y a ni U+FB0x ni U+FFFD dans le texte extrait.
7. Pas de tableaux de mise en page.
8. Fichier de moins de 2 Mo, non protégé.
9. Panneau « vue ATS » qui affiche le texte extrait (pdf.js) et des alertes avant l'export.
10. Respect du format demandé par l'offre.

**DEVRAIT**
- Exports **PDF, DOCX et TXT** depuis une même source de données (JSON).
- Mots-clés de l'offre : formulation exacte, **acronyme et forme longue**, compétences reprises dans les expériences récentes, intitulé du poste visé.
- Polices système courantes (Arial, Calibri, Georgia…), 10,5 à 12 pt.
- URL affichées en clair.
- Titres de poste non abrégés, noms d'entreprise complets, forme juridique comprise si utile (SAS, SA…), par analogie avec la remarque de Greenhouse sur « Inc., LLC ».
- Niveaux de langue et de compétences écrits en texte (CECRL, années, scores).
- Langue du CV identique à celle de l'offre, intitulés de sections dans cette langue.
- 1 à 2 pages.
- Relire les champs pré-remplis dans les portails (Workday, SuccessFactors).

**À ÉVITER**
- Jauges, étoiles, graphiques de niveaux ; icônes ou emoji qui portent seuls une information ; polices d'icônes.
- Photo, logos, Word Art dans la version destinée aux ATS. Prévoir une option « version visuelle » séparée.
- Texte vertical ou incliné, lettres espacées.
- Intitulés « créatifs » (par exemple « Mon parcours ») ; dates sur plusieurs lignes ; abréviations seules.
- Date de naissance, situation familiale, numéros d'identité.
- Bourrage de mots-clés et texte caché.
- PDF Apple Pages ou DOC ancien format ; PDF protégé.

---

## 9. Non vérifié ou à suivre
- Moteurs de parsing natifs de Workday, iCIMS, Lever, Greenhouse et Teamtailor : non documentés publiquement.
- Statistiques sans source primaire trouvée :
  - « 25 % » et « 35 % » sur les en-têtes ;
  - « 96 % contre 85 % » chez Workday ;
  - « 630 recruteurs » ;
  - « 84 % de questions éliminatoires » (Enhancv).
- Dates de l'enquête Enhancv (septembre–octobre 2025) : absentes de la page consultée.
- Oracle Recruiting Cloud : la disponibilité sur la marketplace Oracle et le plugin RChilli ne sont pas confirmés.
- Date de lancement du LLM Parser de Textkernel (2024) et sa prise en charge des colonnes : non confirmées.
- AI Act : le report au 02/12/2027 apparaît sur artificialintelligenceact.eu, mais l'acte modificatif doit être confirmé au Journal officiel de l'UE.
- Suite de l'affaire *Mobley v. Workday* après mai 2025 : non suivie.
- Barème de notes A à D de HiredScore : vu uniquement chez un site tiers.
- Résultats du test local : un seul CV fictif et trois extracteurs, en versions non récentes. À reproduire avec pdf.js, Poppler récent et des ATS d'essai.

---

## Sources
- Textkernel : [Spécifications](https://developer.textkernel.com/tx-platform/v10/resume-parser/overview/specs/) · [Getting Started (conversion, OCR, PDF)](https://developer.textkernel.com/tx-platform/v10/resume-parser/overview/getting-started/) · [Resume Quality](https://developer.textkernel.com/tx-platform/v10/resume-parser/overview/parser-output/) · [Codes de conversion](https://developer.textkernel.com/tx-platform/v9/resume-parser/overview/document-conversion-result-codes/) · [LLM Parser](https://developer.textkernel.com/tx-platform/v10/resume-parser/overview/llm-parser/) · [FAQ](https://developer.textkernel.com/tx-platform/v10/faq/) · [Search & Match V2](https://developer.textkernel.com/tx-platform/v10/search-match-v2/overview/) · [Mots-clés](https://developer.textkernel.com/tx-platform/v10/search-match-v2/query-language/keywords/) · [Skills Intelligence](https://developer.textkernel.com/tx-platform/v10/skills-intelligence/overview/) · [Blog colonnes](https://www.textkernel.com/learn-support/blog/improving-extraction-from-column-resumes/) · [Oracle Recruiting Cloud](https://www.textkernel.com/learn-support/blog/oracle-recruiting-cloud-resume-parsing/) · [Sovren](https://www.textkernel.com/sovren/) · [Annonce du LLM Parser](https://www.textkernel.com/learn-support/blog/textkernel-introduces-llm-parser/) (non consultée)
- SAP SuccessFactors (extraits obtenus via l'API de recherche help.sap.com) : [Working with Resume Parsing](https://help.sap.com/docs/SAP_SUCCESSFACTORS_RECRUITING/8477193265ea4172a1dda118505ca631/07b6d03076a149b78f4f7a615e3025fd.html) · [Configuring Resume Parsing](https://help.sap.com/docs/SAP_SUCCESSFACTORS_RECRUITING/8477193265ea4172a1dda118505ca631/282b8727ec494684b2ef8e26a75788b6.html) · [Batch upload](https://help.sap.com/docs/SAP_SUCCESSFACTORS_RECRUITING/8477193265ea4172a1dda118505ca631/6f3a2ecf6b654c09a29d5ec2bd094598.html) · [Candidate Profile](https://help.sap.com/docs/SAP_SUCCESSFACTORS_RECRUITING/8477193265ea4172a1dda118505ca631/0c47856268a6427a8e93cf46c7812b7b.html)
- Oracle : [Taleo TBE 24A, CV en image](https://docs.oracle.com/en/cloud/saas/readiness/hcm/24a/tale-24a/24A-tbe-wn-f32282.htm) · [Taleo, CV en texte collé sur mobile](https://docs.oracle.com/en/cloud/saas/taleo-enterprise/22d/otcug/c-plaintextresumeparsingmobile.html)
- Greenhouse : [Formats acceptés](https://support.greenhouse.io/hc/en-us/articles/360052218132-Supported-formats-for-resumes-cover-letters-and-other-candidate-uploads) · [Unsuccessful resume parse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse) · [Talent Matching policy](https://support.greenhouse.io/hc/en-us/articles/44682413339675) · [Interview Jon Stross](https://www.briefcasecoach.com/how-an-applicant-tracking-system-works-interview-greenhouse-founder-jon-stross/)
- Lever : [Documentation développeurs](https://hire.lever.co/developer/documentation) · [Jobscan, Lever ATS](https://www.jobscan.co/blog/lever-ats/)
- SmartRecruiters : [API Parse a resume](https://developers.smartrecruiters.com/reference/candidatesresumeparse)
- Teamtailor : [Annonce 2019](https://www.teamtailor.com/en/productnews/auto-add-candidate-information-with-resume-parser/) · [Mise à jour 2022](https://www.teamtailor.com/en/productnews/parse-candidates-faster-and-easier/) · [Updates](https://updates.teamtailor.com/add-candidate-information-automatically-with-resume-parser-99282)
- Daxtra : [Partenariat iCIMS](https://info.daxtra.com/partner-icims) · [Do's & Don'ts (Mercury)](https://portal.wearemercury.com/knowledgebase/article/KA-01555/en-us)
- Affinda : [How does resume parsing work](https://www.affinda.com/blog/how-does-resume-parsing-work/) · RChilli : [Knowledge center](https://docs.rchilli.com/kc/c_RChilli_resume_parser) (non consulté) · HireAbility : [Produit ALEX](https://www.hireability.com/products/alex-cv-resume-parser/) (non consulté), [Q&A](https://www.hireability.com/resume-parsing-qa-session/)
- Mythes et études : [HBS/Accenture, Hidden Workers (PDF)](https://www.hbs.edu/ris/Publication%20Files/hiddenworkers09032021_Fuller_white_paper_33a2047f-41dd-47b1-9a8d-bd08cf3bfa94.pdf) · [Uncharted Career](https://unchartedcareer.com/blog/the-75-of-resumes-are-auto-rejected-myth-traced-to-its-source) · [The Conversation (07/2026)](https://theconversation.com/what-everyone-gets-wrong-about-the-modern-job-search-and-what-actually-works-285582) · [CIO 2012, Preptel](https://www.cio.com/article/284417/careers-staffing-new-job-search-service-helps-job-seekers-penetrate-applicant-tracking-systems.html) · [JobCannon](https://jobcannon.io/research/stats/ats-myth-preptel) (non consulté) · [Enhancv, What is ATS (enquête recruteurs)](https://enhancv.com/blog/what-is-ats/) · [Enhancv, parsing](https://enhancv.com/blog/ats-resume-parsing/) · [Resumap, 36 modèles et 4 parseurs](https://dev.to/resumap/we-ran-the-same-resume-through-4-real-ats-parsers-in-36-layouts-same-text-different-parses-3mfc) · [Jobscan, PDF ou Word](https://www.jobscan.co/blog/resume-pdf-vs-word/) · [Santa Clara University / Jobscan](https://www.scu.edu/careercenter/toolkit/job-scan-common-ats-resume-formatting-mistakes/)
- IA et droit : [Workday 8-K, HiredScore](https://www.sec.gov/Archives/edgar/data/1327811/000132781124000032/wday-02262024x991.htm) · [Holland & Knight, Mobley v. Workday](https://www.hklaw.com/en/insights/publications/2025/05/federal-court-allows-collective-action-lawsuit-over-alleged) · [AI Act, Annexe III](https://artificialintelligenceact.eu/annex/3/) · [AI Act, calendrier](https://artificialintelligenceact.eu/implementation-timeline/)
- PDF et outils : [latex2e #465 (glyphtounicode)](https://github.com/latex3/latex2e/issues/465) · [ATS Verification, LaTeX](https://atsverification.com/blog/latex-resume-ats-friendly/) (non consulté) · [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) · [Parseur OpenResume](https://www.open-resume.com/resume-parser) · [OpenResume GitHub](https://github.com/xitanggg/open-resume) · Métadonnées GitHub (API authentifiée, 05/10/2026) pour : xitanggg/open-resume, srbhr/Resume-Matcher, OmkarPathak/pyresparser, eKoopmans/html2pdf.js, jsvine/pdfplumber, pdfminer/pdfminer.six, pymupdf/PyMuPDF, latex3/latex2e

Fichiers du test local : dossier temporaire du poste (single, single_noliga, single_georgia, twocol, twocol_mainfirst, table, en .html et .pdf)

---

## Vérification

| # | Affirmation contrôlée | Verdict | Source / commentaire |
|---|---|---|---|
| 1 | Le chiffre « 75 % rejetés par les ATS » vient de Preptel en 2012, sans méthode publiée ; l'entreprise a fermé en 2013 | **Confirmé** | Uncharted Career (fermeture en août 2013) ; The Conversation, 05/07/2026, auteures et affiliations exactes ; l'article CIO du 29/02/2012 ne contient pas 75 % |
| 2 | HBS *Hidden Workers* : 8 000+ travailleurs et 2 275 dirigeants ; 88 % / 94 % ; 63 % et 75 % aux États-Unis ; >90 % (94/92) ; 99 % du Fortune 500 (Jobscan) ; près de la moitié écartent les trous de plus de 6 mois ; enquête janvier–février 2020 ; question posée aux seuls utilisateurs de RMS | **Confirmé** | Texte du PDF HBS extrait et lu. Nuance ajoutée : Jobscan donne 97,8 % en 2025 |
| 3 | Enhancv : 25 recruteurs américains, 92 % sans rejet automatique, 44 % / 8 % pour le score IA, 84 % de questions éliminatoires, septembre–octobre 2025 | **Nuancé** | 25 recruteurs, 92 %, 44/8 % et 76 % confirmés (enhancv.com/blog/what-is-ats, publiée le 06/07/2026). La formulation du 92 % porte sur « formatting, content, or design », pas sur les mots-clés. **84 % et les dates de l'enquête non retrouvés** |
| 4 | Greenhouse Talent Matching (Real Talent, doc du 13/08/2026) : « does not automatically reject or advance », « Needs manual review » | **Confirmé** | support.greenhouse.io, article 44682413339675 |
| 5 | Greenhouse : parsing limité à 2,5 Mo, dépôt jusqu'à 100 Mo, liste des causes d'échec (colonnes, tableaux, en-têtes, lettres espacées, titres abrégés, données fictives) | **Confirmé** | Les 2,5 Mo figurent sur la page « Unsuccessful resume parse », pas sur la page des formats. Cause supplémentaire ajoutée : noms d'entreprise sans forme juridique |
| 6 | Workday : rachat de HiredScore annoncé le 26/02/2024 (8-K) ; Mobley v. Workday, certification le 16/05/2025, juge Rita Lin, ADEA, « score, sort, rank or screen » | **Confirmé** | SEC, pièce 99.1 ; Holland & Knight. Suite de la procédure non vérifiée |
| 7 | AI Act, Annexe III 4(a) : obligations « haut risque » applicables le 02/12/2027 | **Nuancé** | Texte de 4(a) confirmé (citation complétée). La date apparaît sur artificialintelligenceact.eu (mise à jour le 31/08/2026), sans explication du report par rapport au 02/08/2026 initial : à confirmer au JOUE. Sans effet sur un générateur de CV personnel |
| 8 | Citations Textkernel : conversion en texte, « PDF is a broken standard », « don't use PDF », « cannot fix it », OCR (5 %, 10 pages, 120 s, coût supplémentaire) ; codes 300, 301, 311, 433 « HUGE MISTAKE », 441, 412–419, 121–124 (pays limités), 233, 112 ; codes de conversion (seuil de 5 % de symboles, etc.) ; 29 langues, 0,5 s ; au moins 15 % de CV en colonnes, 62 % → 90 % | **Confirmé** | Pages developer.textkernel.com et blog sur les colonnes. Gravités ajoutées (Fatal, Major, Suggested) |
| 9 | « Textkernel (anciennement Sovren) » | **Nuancé** | Textkernel présente « Sovren & Textkernel » comme une offre fusionnée ; ce n'est pas un simple changement de nom |
| 10 | LLM Parser de Textkernel : environ 3 Mo contre 16 Mo, plus lent, peut inventer, payant, lancé en 2024, gère la conversion et les colonnes | **Nuancé** | Taille, lenteur, citation et coût confirmés. Date de lancement et prise en charge des colonnes **non vérifiées** (retirées du corps du texte) |
| 11 | SAP SuccessFactors utilise Textkernel ; PDF protégés refusés ; lot de 5 Mo ; échec sans pays ou région | **Confirmé** | API de recherche help.sap.com (« uses the third-party software Textkernel »). Précisions : le refus des PDF sécurisés vaut pour les pièces jointes, et l'échec sans pays concerne le dépôt par lot |
| 12 | Oracle Recruiting Cloud : OCR uniquement via Textkernel ; marketplace Oracle ; plugin RChilli | **Nuancé** | Absence d'OCR natif confirmée par le blog Textkernel (affirmation du fournisseur). Marketplace et RChilli non mentionnés : **non vérifiés** |
| 13 | Taleo 24A : images acceptées mais « will not be parsed », champ « resume keyword » | **Confirmé** | docs.oracle.com, Taleo 24A |
| 14 | Daxtra : 8 Mo, nom obligatoire, téléphone et/ou email « obligatoire sinon échec », éléments à éviter, polices | **Nuancé** | Mercury confirme les 8 Mo, les éléments à éviter et les polices. L'échec explicite concerne le **nom** ; pour le contact, il faut « at least one ». Apple Pages figure parmi les formats acceptés |
| 15 | Lever : images non analysées (doc développeurs) ; racinisation mais pas d'abréviations (Jobscan, avril 2026) | **Confirmé** | hire.lever.co/developer/documentation ; Jobscan du 10/04/2026 |
| 16 | Jobscan (mai 2025) recommande le PDF, tests non détaillés | **Confirmé** | Article du 27/05/2025, aucune méthodologie publiée |
| 17 | Resumap (juillet 2026) : 36 modèles PDF, 4 parseurs, contact 36/36, Textkernel 31/36, Zoho 27/36 ; « iCIMS = Textkernel » vient uniquement de Resumap | **Confirmé** | dev.to, 28/07/2026 (parseurs : Zoho Recruit, Manatal, Workable, Textkernel). Ajout : Textkernel garde les compétences 36/36 |
| 18 | html2pdf.js : v0.14.0 en janvier 2026, rend le contenu en image, texte non sélectionnable | **Confirmé** | API GitHub (v0.14.0 du 12/01/2026, dépôt actif) et citation du README. Le README évoque un futur moteur vectoriel, non livré |
| 19 | OpenResume : AGPL, 8,9 k étoiles, dernière activité en octobre 2024, pdf.js, règles d'intitulés (gras, majuscules, seul sur la ligne), formats US, utilise react-pdf | **Confirmé** | API GitHub (8 912 étoiles, dernier commit le 29/10/2024, non archivé) ; page du parseur ; package.json (`@react-pdf/renderer`, `pdfjs-dist`) |
| 20 | Resume-Matcher (Apache-2.0, ~28,6 k étoiles, actif) ; pyresparser (GPL-3.0, dernière activité septembre 2023) ; pdfplumber (MIT, ~10,8 k) | **Confirmé** | API GitHub : 28 585 étoiles et push le 04/10/2026 ; 957 étoiles et dernier commit le 13/09/2023 ; 10 790 étoiles et push le 06/08/2026 |
| 21 | LaTeX : glyphtounicode traité par le noyau au printemps 2021 | **Confirmé, avec nuance** | Ticket #465 clos comme réalisé le 04/05/2021 (jalon « Release 2021 Spring »). Les commandes manuelles ne servent plus que sur des distributions anciennes |
| 22 | Test local : Edge 154, ligatures (pdfminer 0/6, puis 6/6 sans ligatures), PDF balisé | **Confirmé** | Réexécuté pendant la vérification : version d'Edge, 6 caractères U+FB0x, 0/6 puis 6/6, StructTreeRoot et MarkInfo présents. Nuance : extracteurs en versions anciennes (Xpdf 4.00 de 2017, PyMuPDF 1.26.7 contre 1.28.2, pdfminer.six 20251230 contre 20260107). Les variantes colonnes, tableau et espacement n'ont pas été réexécutées |
| 23 | Affinda : « not an LLM » (décembre 2025) | **Confirmé** | Billet Affinda du 02/12/2025 |
| 24 | Textkernel Match v2 : « term-based », titre de poste ≈ 30 %, critères éliminatoires, bonus de récence et bonus croisé, signaux sémantiques | **Confirmé** | Page d'aperçu de Search & Match V2 |
| 25 | Enhancv : 60 CV ayant décroché un entretien, 73 % en 2 colonnes | **Confirmé** | enhancv.com/blog/ats-resume-parsing (« June 2026 group », 44 sur 60) |
| 26 | « LinkedIn 630 recruteurs / 83 % », « 25 % / 35 % en-têtes », « Workday 96 % contre 85 % », barème A–D de HiredScore | **Non vérifiable** | Aucune source primaire trouvée ; ces chiffres restent signalés comme non vérifiés dans le rapport |