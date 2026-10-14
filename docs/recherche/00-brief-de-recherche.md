# Brief de recherche : générateur de CV à cases à cocher, lisible par les ATS (marché France)

*Ce brief résume les 6 rapports vérifiés le 05/10/2026 : projets open source, parsing ATS, marché français, technique PDF/DOCX, UX des outils commerciaux, analyse d'offre et IA. Il ne contient aucune affirmation qui ne vienne pas de ces rapports. La mention « non vérifié » reprend celle des rapports. Les étoiles GitHub sont celles relevées le 05/10/2026.*

---

## 1. Projets similaires

### 1.1 Open source

| Projet | URL | Licence (réutilisable ?) | Stack | Génération PDF | Sélection / variantes | ATS | Idée à emprunter |
|---|---|---|---|---|---|---|---|
| Reactive Resume v6 | https://github.com/reactive-resume/reactive-resume | MIT, 43 795★. v6.0.0 du 04/10/2026, qui casse la compatibilité. **Oui** | React 19 en SPA, Hono, PostgreSQL et Drizzle, Redis, stockage S3 | Forme (Rust/WASM, sans navigateur). Avant : react-pdf (v5.1 à 5.3), puis Chromium | `hidden` par section ou par entrée. « Copier pour une offre » crée une copie complète, et les copies divergent ensuite | 17 modèles au total, avec un filtre « ATS-safe ». Mode Check. Vérificateur ATS public qui lit le PDF avec pdf.js, en local, sur 6 axes | Vue du texte lu par l'ATS. Ajustement à la page (densité, puis marges, puis police). Exports PDF, DOCX, MD et JSON. Dates structurées |
| OpenResume | https://github.com/xitanggg/open-resume | AGPL-3.0, 8 912★. Inactif depuis le 29/10/2024. **Non** : réimplémenter, ne pas copier | Next.js 13, Redux | react-pdf, relecture par pdf.js | Aucune (un seul CV) | Une seule colonne imposée. Parseur pdf.js en 4 étapes, pensé pour l'anglais américain | L'algorithme du parseur (lignes, puis sections, puis attributs notés par points), adapté aux titres français. Fonctionnement 100 % local, sans compte |
| JSON Resume | https://jsonresume.org/schema · https://github.com/jsonresume/jsonresume.org | MIT. Schéma et CLI archivés le 12/06/2026, le monorepo reste actif. **Oui** | Node, thèmes npm | Puppeteer (CLI et thèmes) | Aucune. `additionalProperties: true` sur les entrées, mais `highlights` n'accepte que des chaînes | `@jsonresume/ats-validator` 0.3.0 : 10 contrôles sur le HTML, score de 0 à 100, note de A à F | Format d'échange en import/export. Les 10 contrôles comme checklist |
| RenderCV | https://github.com/rendercv/rendercv | MIT, 17 702★. v2.8 du 21/03/2026, aucun push depuis le 01/05/2026. **Oui** | Python 3.12 ou plus, Pydantic, Typst | Typst (PDF balisé) | Fichiers séparés pour le design et la locale, surcharges en ligne de commande | Rapport publié par le projet : 20 PDF, 99,1 % d'extraction, 3 parseurs commerciaux. Seuls 5 thèmes sur 9 sont couverts | Moteur Typst. `bold_keywords`. Test en deux couches : extraction du texte, puis parseur |
| YAMLResume | https://github.com/yamlresume/yamlresume | MIT, 1 541★, v0.16.1. **Oui** | TS, Zod | XeLaTeX, HTML, MD, DOCX | Aucune | Rien de spécifique | Validation Zod et JSON Schema. Libellés de section par locale, dont `fr` |
| Resume Matcher | https://github.com/srbhr/Resume-Matcher | Apache-2.0, 28 585★, v1.3.0 du 06/09/2026. **Oui** | FastAPI, LiteLLM, Next.js 16, SQLite | Chromium via Playwright | Un LLM réécrit un CV téléversé | Score composite heuristique, sans revendication de compatibilité ATS | Garde-fous de véracité (`resume_preservation.py`). Plafond de puces par entrée et `page_fit.py`. Suivi des candidatures |
| ResumeLM | https://github.com/olyaiy/resume-lm | AGPL-3.0, 329★. **Non** | Next.js 15, Supabase | React PDF | CV de base et CV adaptés (non vérifié) | Score ATS | Séparer le contenu de la configuration et de l'ordre des sections |
| brilliant-CV | https://github.com/yunanwg/brilliant-CV | Apache-2.0, 844★, v4.1.1. **Oui** | Typst | Typst | Profils en, de, fr, it et zh choisis à la compilation, sans héritage entre eux | Mots-clés cachés et prompt caché en option (désactivés par défaut). **À rejeter** | Profils par langue. Métadonnées PDF (Title, Author, Keywords) |
| basic-resume | https://github.com/stuxf/basic-typst-resume-template | Unlicense, 246★. **Oui** | Typst | Typst | Aucune | Se dit compatible ATS | Base de gabarit Typst sobre |
| haenlonns/resume-template | https://github.com/haenlonns/resume-template | Aucune licence. **Idée seulement** | Typst, `profile.json` | Typst | `#resume.entries(..., ids: (...))` choisit les entrées à afficher | Non | Le principe « base + liste d'identifiants » côté rendu |
| resume-bricks | https://github.com/tsubasakoizumi1122/resume-bricks | PolyForm Noncommercial, 0★, créé le 30/09/2026. **Idée seulement** | Node 18, JS sans framework | Impression du navigateur | Bibliothèque filtrable, glisser-déposer, choix des puces par CV avec compteur « 3/4 ». « Tailor to job » signale les exigences non couvertes | Aucune | **Le plus proche du projet.** Interface en 3 colonnes, repères de saut de page |
| custom-resume | https://github.com/hcstephencheung/custom-resume | Aucune licence, 0★. **Idée seulement** | Python, Pydantic, Jinja2 | HTML (PDF prévu) | YAML avec `id` et `tags`, variantes de résumé. La sélection par identifiants est sur la feuille de route | 2 colonnes, dites « ATS-parseable » ; libellés en texte | Variantes de formulation. Traçabilité de la sélection jusqu'au texte source |
| Johnesco/resume | https://github.com/Johnesco/resume | Aucune licence. **Idée seulement** | JSON, JS sans framework | Impression | 7 profils filtrés par tags, paramètres d'URL, page `customize.html` | Une colonne, page en texte brut | Préréglages par tags. Sélection partageable par URL. Version texte brut |
| zhiweio/resume-as-code | https://github.com/zhiweio/resume-as-code | MIT, 91★. **Oui** | Agents IA, Monaco, Puppeteer | Puppeteer | Des agents génèrent un CV ciblé en 10 étapes | Implicite | Étapes de « dé-IA-isation » et de relecture |
| ats-screener | https://github.com/sunnypatell/ats-screener | MIT, 167★ | SvelteKit 5, Gemini Flash Lite | Aucune | Aucune | Simule 6 ATS ; le README les présente lui-même comme des approximations. **Le texte extrait part chez un LLM côté serveur** | Contre-exemple pour la confidentialité |
| cv-julien-hassan (FR) | https://github.com/Hsn9403/cv-julien-hassan | Aucune licence. **Idée seulement** | Python, PyMuPDF, Flask | PyMuPDF | Un fichier de configuration par marché (FR, US) | Une colonne, texte sélectionnable, ajustement automatique à une page | Une variante par marché |
| render-my-cv | https://github.com/pdgramajo/render-my-cv | 0★, licence non précisée | React 19, Vite, TS, typst.ts, PWA | Typst dans le navigateur | YAML au format RenderCV | Aucune | Montre qu'une SPA Typst hors ligne est faisable |
| typst.ts | https://github.com/Myriad-Dreamin/typst.ts | Apache-2.0, 1 228★. **Oui** | Typst compilé en WASM | `$typst.pdf({ mainContent })` | Aucune | Aucune | Brique de rendu PDF sans serveur |

Projets obsolètes ou à ne pas copier :
- **Obsolètes** : HackMyResume (dernier commit en 2018) et resumetailor (2017, R et LaTeX ; l'idée des tags pondérés reste bonne).
- **Code à ne pas copier** : licences AGPL, PolyForm NC et GPL-3.0 (reeesume, CurriculumGenerator), code sans licence, et douzCv (« tous droits réservés »).
- **Contre-exemples ATS** : Awesome-CV et modern-cv utilisent la police d'icônes FontAwesome. L'issue #137 d'Awesome-CV sur l'incompatibilité ATS est ouverte depuis 2017.

### 1.2 Outils commerciaux et publics (références UX)

| Outil | Sélection / versions | Analyse d'offre / score | Export | À emprunter |
|---|---|---|---|---|
| Teal | Bibliothèque de puces synchronisée. On active ou désactive puces, expériences et compétences pour chaque version. Une case « Save to All Resumes » décide si une modification s'applique partout | Pourcentage des termes clés de l'offre présents (seuil de 80 %). Offre et CV côte à côte, mots-clés surlignés. L'Auto-Select est critiqué parce qu'il désélectionne des puces utiles | PDF uniquement | Décocher n'efface rien. Propagation des modifications. Suivi des candidatures avec la version de CV associée |
| Jobscan | Aucune | Taux de correspondance pondéré : compétences techniques, puis diplôme, puis intitulé, puis savoir-être, puis le reste. Seuil de 75 %. Exclusion manuelle d'une compétence. « ATS Tip » détecte l'ATS d'après l'URL. Correspondance trop littérale, ce que le support reconnaît | Sans objet | La hiérarchie des poids, le bouton « ignorer », la détection de l'ATS |
| Huntr | Un CV « base » et des CV « tailored » tirés de la base | Score par LLM, sémantique : les qualifications pèsent environ 1/3 à 1/2, les mots-clés moins de 20 %. 5 niveaux, et pour chaque critère « couvert » ou « non couvert » | PDF, DOCX | Suggestions à accepter, modifier ou ignorer, avec leur explication |
| Rezi | Contenu stocké à part du design | Score en 5 catégories. Une puce suggérée est placée sous le poste le plus pertinent. Repères : 3 à 6 puces par poste, 400 à 1 600 mots | PDF, DOCX, Google Drive | Des règles de qualité chiffrées |
| Enhancv | Aucune | 27 contrôles, score de correspondance | PDF et TXT, pas de DOCX | L'export TXT |
| Novorésumé | Plusieurs versions | Note de 0 à 100 sur 5 dimensions, avec l'avertissement qu'un score élevé ne garantit pas d'entretien | PDF texte, TXT | L'honnêteté sur ce que vaut le score |
| FlowCV | Entrées masquées ou visibles, ordre réglable (d'après un CLI non officiel) | Pas d'analyse d'offre | PDF | Contre-exemple : l'aperçu est du HTML côté client, le PDF est rendu à part sur le serveur |
| CVDesignR (FR) | Jusqu'à 8 CV en gratuit | Scanner ATS, reformulation par IA | PDF | Suivi des candidatures « Maestro » |
| France Travail, Profil de compétences | CV généré à partir du profil. Une case « Élément privé (non visible par les recruteurs) » exclut un élément | Aucune | Aucune | Le concept français le plus proche des cases à cocher |

### 1.3 Positionnement

La recherche n'a trouvé aucun projet établi qui réunisse trois choses : une base de contenu unique, une sélection par cases à cocher sur trois niveaux (section, entrée, puce) enregistrée pour chaque candidature, et un rendu dont la lisibilité ATS est vérifiée automatiquement. Les grands outils gèrent soit des copies complètes qui divergent avec le temps (Reactive Resume), soit une réécriture par IA (Resume Matcher, ResumeLM). Les projets « base + sélection » existent mais sont minuscules (0 à 91★) et récents, souvent sans licence réutilisable, et aucun ne traite l'ATS. Le plus proche, resume-bricks, est sous licence non commerciale. Côté commercial, Teal propose la synchronisation de puces, mais en SaaS payant, avec un export PDF seulement et une auto-sélection critiquée. En France, rien de comparable n'a été trouvé, hormis la case « Élément privé » de France Travail ; c'est une absence de preuve, pas une démonstration. Ce projet apporterait :
- une sélection qui ne détruit rien ;
- les conventions françaises par défaut (intitulés, CECRL, pas de photo, RGPD) ;
- un contrôle de la couche texte du PDF dans l'interface et en intégration continue ;
- une analyse d'offre déterministe et explicable ;
- une IA facultative, limitée à des propositions.

---

## 2. Règles ATS vérifiées

**Le contexte.** Le risque principal documenté est l'**échec de la conversion du fichier en texte**. Selon Textkernel, la plupart des problèmes de parsing viennent de cette étape. Le profil créé est alors vide ou faux, et le candidat disparaît des recherches.

S'y ajoutent deux mécanismes :
- les **questions éliminatoires et les filtres réglés par le recruteur**, par exemple un trou de plus de 6 mois dans le parcours, filtre appliqué par près de la moitié des employeurs selon HBS ;
- les **scores et classements**, qui lisent le texte extrait : Greenhouse Talent Matching, Workday HiredScore, Cegid HR, WTTJ.

Les règles ci-dessous sont des **précautions**. Elles viennent surtout de sources américaines. Il n'existe **aucune donnée publique sur le comportement des ATS en France**.

### DOIT (bloquant)

| # | Règle | Justification |
|---|---|---|
| D1 | Produire un PDF à couche texte réelle, jamais une image : ni html2pdf.js, ni html2canvas, ni scan | Taleo, Greenhouse et Lever n'analysent pas les CV en image. L'OCR de Textkernel est une option payante. html2pdf.js produit une image (c'est écrit dans son README) |
| D2 | Une seule colonne, sans colonne latérale. L'ordre du code source, l'ordre visuel et l'ordre logique sont identiques | Textkernel classe les colonnes en erreur majeure (code 433) et Greenhouse les cite parmi les causes d'échec. Test local : pdfminer mélange les lignes des deux colonnes, même quand le contenu principal vient en premier dans le HTML |
| D3 | En haut du corps du document : nom complet, **un** e-mail, **un** téléphone, ville et **pays**. Rien dans l'en-tête, le pied de page ou une zone de texte | Greenhouse cite les coordonnées en en-tête, pied de page ou zone de texte parmi les causes d'échec. Textkernel : codes 311, 441, 132 et 133. Daxtra échoue sans nom complet. SuccessFactors, en dépôt par lot, échoue sans pays |
| D4 | Intitulés de section standard, seuls sur leur ligne, **sans espacement des lettres** | Textkernel : code 151, et codes 412 à 416 classés « Fatal ». Test local : un titre espacé est extrait en « C O M P É T E N C E S » |
| D5 | Chaque entrée porte un intitulé complet, l'entreprise, le lieu, et des dates de début et de fin **sur une seule ligne**, au même format partout | Textkernel : code 418 (dates sur plusieurs lignes, « Fatal »), 419 (poste sans dates, « Fatal »), 224 et 225. Greenhouse cite les titres abrégés |
| D6 | Désactiver les ligatures. Le texte extrait ne doit contenir aucun de ces caractères : U+FB00–FB06, U+E000–F8FF, U+FFFD, U+200B, U+00AD, U+2010 | Test local : pdfminer retrouve 0 mot-test sur 6 avec les ligatures de Calibri, et 6 sur 6 avec `font-variant-ligatures: none`. Chrome (moteur Skia) produit des U+200B (issue pdf2docx #379). Le cas Awesome-CV montre des U+2010 |
| D7 | Pas de tableau de mise en page | Déconseillé par Greenhouse et Daxtra. Test local : Xpdf lit les cellules colonne par colonne et perd les correspondances |
| D8 | Aucune police d'icônes. Aucune information portée seulement par une icône, un emoji ou un SVG. Des libellés en texte (« E-mail : », « Tél. : ») | Les icônes sortent en caractères illisibles (zone privée Unicode). Test local : le SVG disparaît, l'emoji est illisible avec Xpdf |
| D9 | Niveaux écrits en texte : CECRL, années, score de certification | Test local : les jauges CSS disparaissent, les étoiles n'ont aucun sens pour un parseur |
| D10 | Afficher les URL en clair (`linkedin.com/in/…`) | Test local : seul le texte du lien (« GitHub ») est extrait |
| D11 | Polices statiques (TTF), embarquées, avec une table ToUnicode. Aucune police variable et aucune police Type 3 | Sans ToUnicode, l'extraction donne du charabia. Chrome embarque les polices variables en Type 3 ; dans le cas cv-giovanni, le nom a été extrait sans espaces |
| D12 | Césure désactivée | react-pdf coupe les mots par défaut. Pour Typst, `hyphenate: false` est recommandé. Le cas Awesome-CV montre des U+2010 et des coupures dans le texte |
| D13 | Fichier de moins de 2 Mo, sans mot de passe ni restriction | Greenhouse n'analyse pas au-delà de 2,5 Mo, le LLM Parser de Textkernel est limité à environ 3 Mo, SuccessFactors refuse les PDF protégés |
| D14 | Aucun texte caché, qu'il s'agisse de mots-clés en blanc ou d'un prompt caché | Le texte caché réapparaît dans le texte extrait. brilliant-CV avertit lui-même du risque de rejet. Des chercheurs de Duke ont trouvé des injections de prompt dans au moins 1 % d'environ 200 000 CV, et Indeed dit avoir ajouté des garde-fous |
| D15 | L'aperçu et l'export viennent du **même moteur de rendu** | Chez FlowCV, l'aperçu HTML et le PDF rendu sur le serveur diffèrent : un CV peut tenir sur 1 page à l'écran et sur 2 dans le PDF |
| D16 | Une vue « ce que voit l'ATS » (texte extrait du PDF généré) et des alertes avant l'export | Checklist du rapport sur le parsing. Reactive Resume et OpenResume proposent cette vue |
| D17 | Respecter le format de fichier demandé par l'offre | Checklist du rapport sur le parsing |

### DEVRAIT

- **Exporter en PDF, DOCX et TXT à partir de la même source.** Les sources se contredisent : Textkernel déconseille le PDF (code 300), Jobscan le recommande sans décrire sa méthode. Taleo, sur mobile, analyse un CV collé en texte brut.
- **Écrire le sigle et la forme longue**, par exemple « SQL (Structured Query Language) » ou « Gestion de la relation client (CRM) ». D'après Jobscan, Lever ne relie pas les abréviations ; l'Apec le conseille aussi (non vérifié).
- **Reprendre l'intitulé du poste visé dans le titre, s'il est exact.** Dans l'exemple de la documentation Textkernel Match v2, le titre pèse environ 30 %. Selon Jobscan (chiffre d'éditeur), 55,3 % des recruteurs filtrent par intitulé.
- **Citer les compétences dans les expériences récentes et aussi dans la section Compétences.** Textkernel préfère les compétences en contexte (code 112) et accorde des bonus de récence et de croisement. 76 % des recruteurs interrogés par Enhancv apprécient les mots-clés employés naturellement.
- **Écrire les titres de poste en entier et le nom complet de l'entreprise**, forme juridique comprise si utile. Greenhouse cite les titres abrégés et les noms sans forme juridique.
- **Utiliser des polices courantes** (Arial, Calibri, Helvetica, Georgia) **de 10 à 12 pt**. Daxtra recommande des polices simples ; c'est aussi le consensus des outils.
- **Écrire le CV dans la langue de l'offre, et faire deux fichiers séparés pour le FR et l'EN.** Textkernel renvoie une seule langue par document. Les mises en page bilingues côte à côte gênent l'analyse, selon des sources commerciales.
- **Renseigner les métadonnées du PDF** (Title, Author) et donner au fichier un nom propre : `CV_Prenom_Nom_Poste_FR.pdf`.
- **Relire les champs pré-remplis dans les portails** (Workday, SuccessFactors). SAP reconnaît que son parsing n'est pas toujours exact.

### À ÉVITER

- Jauges, étoiles, cercles de niveau : l'information disparaît.
- Photo, logos ou Word Art dans la version destinée aux ATS : les images ne sont pas analysées. Prévoir une version « visuelle » séparée.
- Texte vertical ou incliné, lettres espacées : signalé par Textkernel, Daxtra et Greenhouse.
- Intitulés créatifs (« Mon parcours », « Ce qui m'anime »), dates réparties sur plusieurs lignes, abréviations seules.
- Date de naissance, situation familiale, numéros d'identité : voir le §3 et les codes Textkernel 121 à 124.
- Bourrage de mots-clés, texte caché.
- PDF Apple Pages (code Textkernel 301), ancien format .doc, PDF protégé.
- Mises en page à deux colonnes, même celles annoncées comme « parseables ».

> **Mythes à ne pas reproduire**
> - **« 75 % des CV sont rejetés par les ATS »** : c'est un argument commercial de Preptel datant de 2012. Aucune méthode n'a été publiée et l'entreprise a fermé en 2013.
> - **« L'ATS rejette automatiquement les CV »** : Greenhouse Talent Matching ne fait ni avancer ni rejeter un candidat automatiquement, et Teamtailor Co-pilot ne rejette pas non plus. Parmi les 25 recruteurs américains interrogés par Enhancv, 92 % disent que leur ATS ne rejette pas sur la forme, le contenu ou le design. En revanche, les filtres, les questions éliminatoires et le scoring existent : 8 % utilisent le score IA comme filtre éliminatoire, et WTTJ vante un scoring qui sert à écarter des CV.
> - **« HBS : 88 % des CV sont rejetés »** : c'est l'**opinion** des employeurs sur des candidats qualifiés écartés, pas un taux de rejet.
> - **« Greenhouse ne reconnaît pas les abréviations »** : la FAQ de Greenhouse dit l'inverse (plusieurs termes peuvent correspondre à une même compétence).
> - **« Un CV français doit comporter photo, date de naissance et situation familiale »** : c'est obsolète, et contraire aux recommandations du Défenseur des droits.
> - **« Les ATS se servent des balises du PDF »** : aucun éditeur ne le documente.
> - **« Les ATS perdent les accents »** : aucune preuve trouvée. Il ne faut pas retirer les accents.
> - **« Le score de Jobscan, de Teal ou d'un autre outil reproduit l'ATS »** : non. Chaque outil a sa propre formule.
> - **« jsPDF `html()` produit une image »** : c'est faux. C'est html2pdf.js qui transforme la page en image.
> - **Chiffres sans source primaire, à ne pas citer** :
>   - 25 % ou 35 % de coordonnées perdues dans l'en-tête ;
>   - Workday : 96 % de réussite en DOCX contre 85 % en PDF ;
>   - 72 % ou 78,4 % d'échec des CV Canva ;
>   - Workday utilisé par 60 % du CAC 40 ;
>   - 67 % ou 85 % de recruteurs qui préfèrent une photo ;
>   - « 27 % des entreprises françaises » attribué à l'Apec ;
>   - 630 recruteurs et 83 % (LinkedIn) ;
>   - 84 % de questions éliminatoires (Enhancv) ;
>   - « 15 entreprises du CAC 40 sur Taleo » ;
>   - un arrêt de la Cour de cassation de 2025 sur la photo.
> - **Les tests de ShapeCV** (98,2 % pour Jake's Resume, 80 % d'échec pour Awesome-CV) : la méthode n'est pas vérifiable.

---

## 3. Spécificités France

### 3.1 Contexte ATS
- **Usage des ATS.** Selon l'Apec (20/05/2025), 50 % des grandes entreprises utilisaient en 2024 un SIRH ou un ATS pour recruter leurs cadres, soit 12 points de plus qu'en 2021. Seules 4 % des entreprises ayant recruté des cadres utilisaient l'IA, et 11 % l'envisagent.
- **Outils dont le fonctionnement est vérifié :**
  - SAP SuccessFactors analyse les CV avec Textkernel (note SAP 2081576). Textkernel prend en charge le français, toutes variantes comprises.
  - Cegid HR (ex-Talentsoft) fait du parsing, du scoring et des résumés de CV par IA.
  - Teamtailor Co-pilot ne rejette pas : il affiche ✓, ✕ ou « – », et le recruteur peut modifier chaque évaluation.
  - Flatchr accepte les CV en Word ou en PDF.
  - L'ATS de WTTJ se dit « IA-native » et vante un scoring qui sert à écarter des CV.
- **Repérer l'ATS d'une offre.** L'adresse de la page carrière le révèle souvent : `myworkdayjobs`, `taleo`, `smartrecruiters`, `teamtailor`, `recruitee`, `successfactors`.
- **Il n'existe aucune part de marché officielle des ATS en France.**

### 3.2 Conventions du CV
| Point | Recommandation | Base |
|---|---|---|
| Longueur | 1 page par défaut, 2 pages au-delà d'environ 10 ans d'expérience ou pour un cadre. 3 pages sont tolérées par certains cabinets mais déconseillées | WTTJ, HelloWork (2 pages maximum, 1 dans l'idéal), France Travail, Michael Page |
| Titre et accroche | Un titre de poste précis (l'intitulé de l'offre, s'il est exact) et une accroche de 2 à 3 lignes | HelloWork, Michael Page, France Travail |
| Ordre des sections | En-tête et accroche, puis expérience, puis formation, puis « Mais aussi… » (centres d'intérêt, savoir-être) | France Travail. L'ordre proposé par l'Apec (coordonnées, titre, résumé, expérience, compétences, formation) n'a pas été vérifié |
| Centres d'intérêt | Environ 3, précis. Pas d'engagement politique ni de sujet clivant. Ne rien inventer | France Travail |
| Langues | CECRL de A1 à C2 avec la certification, par exemple « Anglais : C1 (TOEIC 945, 2025) ». La formule « lu, écrit, parlé » est obsolète | Conseil de l'Europe, France Travail |
| Dates | Stocker en ISO (`YYYY-MM`). Deux rendus possibles : « 03/2022 – aujourd'hui » (mode ATS) ou « mars 2022 – aujourd'hui ». **Ne jamais mélanger les deux.** Le format MM/AAAA n'est recommandé que par des blogs, aucun éditeur ne le documente | Rapport sur le marché français |
| Permis | « Titulaire du permis B », à classer comme compétence | HelloWork (non vérifié) |
| Accents | Les garder. Normaliser en Unicode NFC et remplacer l'espace fine insécable U+202F par une espace normale ou par U+00A0. Ce sont des **hypothèses non testées** | Rapport sur le marché français |

### 3.3 Intitulés de section recommandés
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

### 3.4 Informations personnelles et photo
- **Droit applicable.** L'article L1132-1 du Code du travail interdit les discriminations fondées notamment sur l'apparence physique, l'âge, la situation de famille, le nom ou le lieu de résidence. L'article L1221-6 limite les informations demandées à celles qui ont un lien direct avec l'emploi.
- **Défenseur des droits (2019).** Exiger une photo doit rester exceptionnel, et il recommande d'anonymiser le nom, l'adresse, l'âge, la situation de famille et la photo.
- **CV anonyme.** Il est facultatif depuis la loi du 17/08/2015 (Conseil d'État, 04/11/2015, n° 387014).
- **À mettre** : nom, prénom, téléphone, e-mail, **ville** (pas l'adresse complète), LinkedIn et portfolio en URL lisible.
- **Désactivés par défaut**, avec une explication renvoyant à L1132-1 : date de naissance, âge, situation familiale, photo. La nationalité est facultative et ne sert que si une autorisation de travail est en jeu (non vérifié).
- **Photo.** Désactivée par défaut et activable candidature par candidature (accueil, luxe, commerce, par exemple). Elle est placée comme un bloc image distinct dans le corps, jamais dans l'en-tête ou le pied de page. L'ATS l'ignore ; le vrai risque vient de la mise en page autour (bandeau, colonne).

### 3.5 Bilingue
- Produire **deux documents séparés**, chacun dans une seule langue.
- Dans la base, utiliser des **champs traduisibles** (`fr`/`en`) plutôt que deux bases séparées.
- Pour la version anglaise :
  - intitulés traduits ;
  - CEFR à la place de CECRL ;
  - équivalence de diplôme explicite, par exemple « Master's degree (Bac+5) » (proposition de l'auteur du rapport) ;
  - en général pas de photo.
- Signaler les éléments non traduits.
- Europass reste une option reconnue dans l'UE pour l'export. Sa compatibilité ATS n'est attestée que par des sources commerciales.

### 3.6 Référentiels utiles
- **ROME 4.0** (France Travail) : référentiel français des métiers et des compétences, sous Licence Ouverte. Il propose 4 API (Compétences, Métiers, Contextes de travail, Fiches métiers), limitées à 1 appel par seconde. Les conditions d'accès n'ont pas été vérifiées.
- **ESCO** v1.2.1 : 13 939 compétences en 28 langues, dont le français. On y trouve des synonymes (`altLabels`) et des variantes (`hiddenLabels`). Le CORS est ouvert sur l'API (test du 05/10/2026).

### 3.7 RGPD
- **Exemption domestique.** Un usage strictement personnel échappe au RGPD (article 2.2.c). Cette exemption tombe dès qu'un contenu est publié sur Internet pour un nombre indéterminé de personnes (arrêt CJUE Lindqvist, C-101/01).
- **Les données de tiers posent problème** : références avec le nom et le téléphone d'un ancien manager, collègues, clients. Préférer « références disponibles sur demande ».
- **Recommandations :**
  - stockage local d'abord, sans compte ;
  - sauvegarde par export et import JSON ;
  - pas de traceur ni d'outil d'analyse d'audience ;
  - export et suppression complète en un clic ;
  - si une page est partagée : `noindex`, et ni téléphone ni adresse ;
  - si une synchronisation est ajoutée : hébergement dans l'UE, authentification, chiffrement.
- **Contexte, sans effet sur un générateur personnel :**
  - l'AI Act classe à haut risque l'IA de recrutement (Annexe III). Ces obligations sont reportées au 02/12/2027 par le règlement (UE) 2026/1744, publié au JO le 24/07/2026 selon deux sources juridiques, mais non relu sur EUR-Lex ;
  - la CNIL fait du recrutement un thème de contrôle prioritaire en 2026.

---

## 4. Options techniques

### 4.1 Comparatif des moteurs

| Approche | Couche texte (ATS) | Contrôle typographique | Français | Poids / complexité | Hors ligne, sans serveur | Verdict |
|---|---|---|---|---|---|---|
| **Typst** : CLI ou typst.ts (WASM) | La mesure publique la plus complète trouvée (RenderCV : 20 PDF sur 20 corrects, 99,1 %), mais publiée par le projet lui-même et sans comparaison. PDF balisé par défaut depuis la 0.14, PDF/UA-1 en option | Très fin | `lang: "fr"`, `hyphenate: false` | CLI léger. WASM de 14 à 25 Mo selon la configuration et les polices | Oui, avec cache | **Recommandé** |
| @react-pdf/renderer | Correcte une fois la césure et les ligatures désactivées. Un bug de ligatures a existé (#3009, fermé). PDF balisé non documenté | Flexbox (Yoga), pas de CSS complet | TTF ou WOFF, pas de polices variables | Moyen, impose React | Oui | Alternative 1 |
| Forme (`@formepdf/*`) | PDF balisé, PDF/UA-1 annoncé. **Aucune mesure ATS publique** | HTML/CSS ou composants React, Svelte, Vue, Preact | Césure automatique à désactiver | WASM de poids inconnu, version 0.x | Oui | À évaluer (adopté par Reactive Resume v6) |
| `window.print()` (Chrome), avec ou sans Paged.js | Moyenne. Skia remplace les espaces par U+200B, d'où des mots collés avec poppler : 29,6 % des mots avec Source Sans 3, mesure d'un seul projet. Type 3 si la police est variable. En-têtes et pieds ajoutés par Chrome, sauf avec `@page { margin: 0 }` | CSS complet (margin boxes natives depuis Chrome 131) | OK | Nul | Oui, mais non déterministe | Plan C |
| Puppeteer ou Playwright `page.pdf` | Mêmes défauts que Chrome, mais rendu déterministe. `tagged` vaut `true` par défaut dans Puppeteer | CSS complet | OK | Chromium complet | Non (serveur ou CI) | Seulement en CI pour un gabarit HTML |
| pdfmake (avec pdfkit 0.18 ou plus) | Correcte : le bug de table de caractères au-delà de 256 caractères est corrigé dans pdfkit 0.18.0 | Limité | OK (polices embarquées) | Moyen | Oui | Possible, rendu peu soigné |
| jsPDF | `text()` fonctionne avec une police TTF. `html()` produit du texte vectoriel mais un rendu approximatif | Placement manuel | Les 14 polices standard sont limitées à l'ASCII : une TTF est obligatoire | Faible mais laborieux | Oui | Déconseillé |
| **html2pdf.js** | **Image** : texte ni sélectionnable ni cherchable | Sans objet | Sans objet | Faible | Oui | **Interdit** |
| pdflatex / xelatex / lualatex | Pièges des ligatures et des accents OT1 (« é » extrait en « e ´ »). Cas Awesome-CV : aucun espace réel et des U+2010 | Excellent | Corrigeable | TeX Live à installer | Non | Inadapté à une page web |
| **docx (dolanmiu)** | Excellente : XML texte natif, sans problème de ToUnicode ni d'espaces | Moyen | OK | Faible, fonctionne dans le navigateur (`Packer.toBlob`) et sous Node | Oui | **Recommandé pour le DOCX** |
| docxtemplater | Excellente | Modèle Word | OK | Images et HTML en modules payants | Oui | Alternative pour le DOCX |

### 4.2 Stack recommandée

**Vite + TypeScript + Svelte 5 (ou React) + Typst**, avec typst.ts dans le navigateur et le CLI Typst en CI.

1. **Interface.** Une SPA statique avec Vite (v8, Rolldown par défaut). Svelte 5 ou React gèrent bien l'arbre de cases à cocher. React n'est imposé que si l'on choisit react-pdf. Next.js est surdimensionné : il n'y a besoin ni de serveur ni de rendu côté serveur.
2. **Rendu.** Un seul gabarit `cv.typ` lit le JSON produit par la projection (voir 4.4).
   - Dans le navigateur, `$typst.pdf()` produit le PDF et l'aperçu avec le même moteur : **l'aperçu est identique à l'export** (règle D15).
   - Utiliser le bundle « lite » avec seulement 2 ou 3 polices TTF statiques, mises en cache par un service worker.
   - Réglages : `lang: "fr"`, `hyphenate: false`, aucun `tracking`, aucune police d'icônes, une seule colonne.
3. **Versions figées.** typst.ts v0.7.0 embarque Typst 0.14.2. Le CLI utilisé en CI doit être **exactement dans la même version**. Typst est déjà en 0.15.1, et les versions 0.8.0-rc de typst.ts embarquent Typst 0.15.0-rc.1.
4. **DOCX** : avec `docx` (dolanmiu), à partir de la même projection. Paragraphes et styles de titre, sans tableau ni zone de texte, et les coordonnées dans le corps (conseil non vérifié pour Word).
5. **TXT** : généré directement depuis la projection, pour les formulaires.

**Pourquoi Typst :**
- c'est la seule mesure publique sur des parseurs commerciaux, même si elle est publiée par le projet lui-même et ne compare pas d'autres moteurs ;
- PDF balisé natif ;
- correctifs d'extraction depuis la 0.14 ;
- lecture native du JSON et du YAML ;
- aucun serveur ;
- le même moteur en local, dans le navigateur et en CI.

**Alternative 1 : Vite + React + @react-pdf/renderer.** Tout en JavaScript et léger. Mesures obligatoires :
- polices TTF statiques ;
- `Font.registerHyphenationCallback(w => [w])` ;
- ligatures désactivées avec `fontFeatureSettings`, à vérifier en CI ;
- la même batterie de tests.

Inconvénients : pas de PDF balisé documenté, et le projet de référence (Reactive Resume) vient de quitter react-pdf.

**Alternative 2, à évaluer : Forme.** À n'adopter qu'après avoir passé la batterie de tests du §7.

**Plan C : HTML/CSS + `window.print()`, et Playwright en CI.** Il faut alors :
- `@page { margin: 0 }`, les marges étant gérées dans la page ;
- des polices statiques ;
- un `word-spacing` légèrement positif. Avec 0,05em, le taux de mots collés avec poppler tombe à 0,56–0,90 %, mais 5,6 % des rendus prennent une page de plus.

### 4.3 Stockage
- **Source de vérité** : un fichier JSON ou YAML exportable, idéalement versionné dans git, ce qui donne l'historique et un diff par candidature. **Jamais uniquement dans le navigateur** : quand la prévention du suivi est active (réglage par défaut), Safari efface tout le stockage écrit par script après 7 jours d'utilisation sans interaction avec le site.
- **localStorage** (5 Mio) ou IndexedDB : seulement pour l'état de l'interface et le brouillon de sélection, avec `navigator.storage.persist()`.
- **Lecture et écriture du fichier :**
  - en mode développement local, un petit plugin ou endpoint Vite écrit dans `data/` ;
  - sinon, import et export par téléchargement ou glisser-déposer ;
  - la File System Access API quand elle existe. Elle est réservée aux navigateurs Chromium et marquée expérimentale ; Firefox et Safari n'offrent que l'OPFS.

### 4.4 Schéma de données

**Principes :**
- un format interne riche, **projeté** vers un JSON Resume v1.0.0 valide pour l'échange et la validation (Ajv ou `@jsonresume/schema`) ;
- Zod pour valider le format interne ;
- **jamais de `hidden` dans la base** : la sélection vit dans les préréglages et les candidatures ;
- les puces sont des objets avec `id`, mais `highlights` (dans JSON Resume) n'accepte que des chaînes. Il est donc généré au moment de la projection.

```json
{
  "base": {
    "meta": { "schemaVersion": 1, "lastModified": "2026-10-05" },
    "basics": {
      "name": "Prénom Nom",
      "label": { "fr": "Développeur backend", "en": "Backend Developer" },
      "email": "prenom.nom@example.com",
      "phone": "+33 6 00 00 00 00",
      "location": { "city": "Lyon", "country": "France" },
      "profiles": [{ "network": "LinkedIn", "url": "linkedin.com/in/prenom-nom" }]
    },
    "summaries": [
      { "id": "sum-backend", "tags": ["backend"], "text": { "fr": "…", "en": "…" } }
    ],
    "work": [
      {
        "id": "acme-2023",
        "name": "ACME SAS",
        "position": { "fr": "Développeur backend", "en": "Backend Developer" },
        "location": "Lyon, France",
        "startDate": "2023-01",
        "endDate": null,
        "tags": ["backend", "lead"],
        "locked": false,
        "bullets": [
          {
            "id": "acme-perf",
            "tags": ["perf"],
            "skills": ["sk-sql"],
            "variants": {
              "standard": { "fr": "Réduction de 40 % de la latence p95 …", "en": "Cut p95 latency by 40% …" },
              "court": { "fr": "…", "en": "…" }
            }
          }
        ]
      }
    ],
    "skills": [
      {
        "id": "sk-sql", "type": "hard",
        "label": { "fr": "SQL (Structured Query Language)", "en": "SQL (Structured Query Language)" },
        "aliases": ["SQL", "langage SQL"], "escoUri": null
      }
    ],
    "languages": [
      { "id": "lang-en", "language": { "fr": "Anglais", "en": "English" }, "cefr": "C1", "certificate": "TOEIC 945", "year": 2025 }
    ]
  },
  "presets": [
    {
      "id": "preset-backend", "name": "Dev backend", "autoTags": ["backend"],
      "sectionOrder": ["summary", "work", "skills", "education", "languages", "interests"],
      "include": ["sum-backend", "acme-2023", "acme-perf", "sk-sql", "lang-en"],
      "variantChoice": { "acme-perf": "court" },
      "template": "ats-1col"
    }
  ],
  "applications": [
    {
      "id": "2026-10-acme-dev", "presetId": "preset-backend", "createdAt": "2026-10-05",
      "target": { "company": "ACME", "jobTitle": "Développeur backend senior", "url": "…", "lang": "fr" },
      "offerText": "…",
      "selection": { "include": ["…"], "variantChoice": { "acme-perf": "standard" } },
      "overrides": { "basics.label": "Développeur backend senior" },
      "options": { "dateFormat": "MM/AAAA", "photo": false, "maxPages": 1 },
      "analysis": { "ignoredTerms": [], "level": "bon" },
      "status": "envoyé",
      "frozen": { "snapshot": "…", "files": ["CV_Prenom_Nom_Developpeur-backend_FR.pdf"] }
    }
  ]
}
```

- `project(base, selection, lang)` produit un JSON Resume valide, qui alimente à la fois le gabarit, le DOCX et le TXT.
- Une candidature envoyée est **figée** : une copie du JSON et du PDF. Une modification ultérieure de la base ne l'altère pas ; elle affiche seulement un indicateur « mise à jour disponible » (inspiré de Teal).

---

## 5. Fonctionnalités inspirées de l'existant

### MVP
| Fonctionnalité | Inspiration |
|---|---|
| Base de contenu structurée en JSON : identifiants stables, tags, champs FR/EN, variantes de puces | JSON Resume (extensible), custom-resume, Teal |
| Cases à cocher sur 3 niveaux (section, entrée, puce), avec un état partiel et un compteur « 3/4 ». Décocher ne supprime rien | Teal, resume-bricks, France Travail (« Élément privé ») |
| Réordonnancement par glisser-déposer, avec des boutons ↑/↓ pour le clavier | resume-bricks, FlowCV |
| Un seul modèle « ATS-safe », dont les règles D1 à D14 sont imposées par le code | OpenResume (une colonne imposée), filtre ATS-safe de Reactive Resume |
| Aperçu en direct produit par le moteur d'export | Reactive Resume v6. Contre-exemple : FlowCV |
| Jauge de pages en temps réel et alerte de débordement, avec repères de saut de page | resume-bricks, messages de Reactive Resume |
| Préréglages nommés : sélection, ordre, intitulé, accroche, modèle. On peut les dupliquer | Profils de Johnesco, profils de brilliant-CV |
| Collage d'une offre : extraction des mots-clés, surlignage dans la base et dans l'aperçu, liste des termes couverts et manquants | Teal, Jobscan, Rezi |
| Vue « ce que voit l'ATS » (texte du PDF généré, extrait avec pdf.js) et contrôles de base | Vérificateur de rxresu.me, parseur d'OpenResume |
| Export en PDF texte et sauvegarde JSON. Local d'abord, sans compte | OpenResume |

### V2
| Fonctionnalité | Inspiration |
|---|---|
| Score transparent et pondéré (§6), bouton « ignorer un terme », dictionnaire de synonymes et de sigles | Jobscan, Huntr |
| Badge de pertinence sur chaque puce, tri, et pré-sélection réversible présentée en différences | Huntr (accepter / ignorer), `tailor_selection.py` de Resume Matcher, critique de l'Auto-Select de Teal |
| Variantes de puces, propagation des modifications, indicateur « mise à jour disponible » | Synchronisation de Teal |
| Historique des candidatures : copie figée, offre, date, statut (envoyé, entretien, refus ou offre) | Teal, Huntr, Reactive Resume v6 |
| Exports DOCX et TXT | Rezi, Huntr, Novorésumé, Enhancv (TXT) |
| Bouton « ajuster à 1 page » : interligne, puis marges, puis police, **10 pt minimum**. Sinon, proposer de décocher les puces les moins pertinentes | Reactive Resume (qui descend à 9 pt ; 10 pt est un choix plus prudent) |
| Contrôles avancés : 3 à 6 puces par poste, chiffres, verbes d'action, pronoms, formules creuses | Rezi, Teal (le repère de 100 à 150 caractères par puce n'a pas été vérifié) |
| Contrôle « chaque compétence clé cochée est étayée par une puce cochée » | Rapport sur l'analyse d'offre |
| Mots-clés de l'offre mis en gras dans le CV | `bold_keywords` de RenderCV |
| Version anglaise liée à la même base | brilliant-CV, cv-julien-hassan |
| Métadonnées PDF et nom de fichier normalisé | brilliant-CV, Rezi |

### Plus tard
| Fonctionnalité | Inspiration |
|---|---|
| LLM facultatif : structurer l'offre, rapprocher les termes, suggérer des identifiants à cocher, reformuler une puce | Resume Matcher, Reactive Resume |
| Rapprochement sémantique local (embeddings) | Orientation prise par Huntr, Greenhouse et HiredScore |
| Import d'un CV (PDF, DOCX), d'un profil LinkedIn ou d'un JSON Resume | Reactive Resume, resume-bricks |
| Modèle « visuel » séparé, signalé comme non adapté aux ATS | Indeed Flex (une version Canva pour le réseau, une version ATS pour postuler) |
| Lettre de motivation à partir de la même sélection | Resume Matcher |
| Détection de l'ATS d'après l'URL de l'offre, avec conseils de format (DOCX pour Taleo et SuccessFactors selon cvpass, avis d'éditeur) | ATS Tip de Jobscan, cvpass.co |
| Suggestions issues de ROME 4.0 ou ESCO | Rapports sur le marché français et sur l'analyse d'offre |
| Export Europass XML | J0ker98/europass-cv (XSD non officiel) |
| Sélection partageable par paramètre d'URL (identifiants seulement) | Johnesco |
| Extension de navigateur pour capturer une offre | Teal |

---

## 6. Analyse d'offre et IA

### 6.1 Ce que font les ATS actuels
- Ils combinent **termes exacts** et **correspondance sémantique** :
  - Greenhouse surligne les correspondances exactes et les termes similaires, sur 5 niveaux ;
  - Workday calcule un Skills Match Score par apprentissage automatique ;
  - Textkernel Match v2 se décrit comme fondé sur les termes, avec des taxonomies de synonymes et des bonus de récence.
- Les recruteurs **filtrent toujours par mots-clés**. Selon Jobscan (chiffres d'éditeur), 76,4 % filtrent par compétences et 55,3 % par intitulé de poste.
- Conclusion : le terme exact reste nécessaire, mais il ne suffit pas.

### 6.2 Niveau 1 : déterministe, hors ligne, par défaut

Module TypeScript pur, exécuté dans un **Web Worker**, sans aucun appel réseau. Les résultats sont reproductibles et peuvent être testés unitairement sur des offres types.

1. **Normalisation du français.** Elle sert à la comparaison uniquement ; on affiche toujours le texte d'origine.
   - Minuscules, puis NFD et suppression des diacritiques.
   - Suppression des élisions (`l' d' qu' j' n' s' c'`).
   - Écriture inclusive (`développeur·se`, `(se)`, `H/F`) ramenée à une forme canonique par les alias.
   - **Termes techniques protégés avant le découpage en mots** : `C++`, `C#`, `.NET`, `Node.js`, `CI/CD`, `Power BI`, `SAP S/4HANA`.
   - Termes ambigus (`R`, `C`, `Go`, `Excel`…) : comparaison sensible à la casse, sur le mot entier, idéalement avec le contexte.
   - Groupes de 1 à 4 mots comparés au dictionnaire.
   - Racinisation Snowball FR **réservée aux mots génériques**, jamais aux noms d'outils.
   - Mots vides en français, en gardant « plus » et « atout », qui signalent une compétence souhaitée.
   - Alias bilingues FR/EN.
2. **Bibliothèques :**
   - `multilingual-stemmer` (Snowball 3.1.1 en WASM, MIT) ;
   - `@orama/stopwords` et `@orama/stemmers` (Apache-2.0, avec le français) ;
   - `natural` (MIT, orientée Node) ;
   - à éviter : `snowball-stemmer.jsx` (2015), `nlp-js-tools-french` (2017), `node-lefff` (2021, LGPL).
3. **Dictionnaire personnel**, au format `{ id, label_fr, label_en, aliases[], type: hard|soft|outil|langue|certif, escoUri? }`. Il est construit à partir de la base de l'utilisateur. Un script hors ligne en tire un sous-ensemble d'ESCO en français pour proposer des alias.
4. **Découpage de l'offre en rubriques et pondération :**
   - rubriques : « Missions », « Profil recherché », « Atouts », « Un plus », « Nice to have » ;
   - modalités : « impératif », « exigé » donnent un terme **requis** ; « apprécié », « idéalement » un terme **souhaité** ;
   - poids : titre ×1,5, requis ×1,0, missions ×0,7, souhaité ×0,5, plus un bonus de répétition plafonné à +20 %.
5. **Score explicable :**
   ```
   q(t) : 1.0 exact | 0.9 alias/sigle | 0.8 même racine (mots génériques) | 0.5 équivalence sémantique confirmée | 0 absent
   Bonus preuve ×1.15 si t est dans une puce d'expérience/projet cochée (plafonné à 1)
   Requis = Σ w·q / Σ w (termes requis) ; Souhaités = idem
   Intitulé = 100 si intitulé canonique de l'offre présent, 50 si alias, sinon 0
   Global = 0.45·Requis + 0.15·Souhaités + 0.15·Intitulé + 0.15·Formation/Certifs/Langues + 0.10·Structure
   ```
   - Afficher un niveau (faible, moyen, bon, fort) plutôt qu'un pourcentage.
   - Pour chaque terme, montrer : la phrase de l'offre, le poids et sa justification, le type de correspondance, l'endroit où il apparaît dans le CV.
   - Ne jamais promettre de « passer l'ATS ».
6. **Trois catégories de termes manquants :**
   - (a) présent dans la base mais non coché : proposer de cocher l'élément ;
   - (b) présent sous un autre libellé : proposer un alias ou une variante de puce ;
   - (c) absent de la base : à ajouter **seulement si c'est vrai**, sinon le garder pour la lettre de motivation ou l'entretien.

   Alertes : un terme répété plus de 3 fois, une compétence sans preuve dans une puce, un sigle sans sa forme longue.
7. **Pré-sélection gloutonne sous contrainte de place.**
   - La valeur d'un élément est le poids des termes **encore non couverts** qu'il couvre, plus un petit bonus de récence et de résultat chiffré.
   - Contraintes : nombre maximal de puces par entrée, nombre total de lignes, 1 ou 2 pages.
   - Règles :
     - ne jamais décocher un élément verrouillé ;
     - **ne jamais masquer une expérience entière**, pour éviter un trou dans le parcours : réduire ses puces à la place ;
     - garder l'ordre chronologique.
   - Le résultat est une **proposition** présentée en différences (+ ajouté, − retiré), avec sa raison et des boutons pour accepter ou refuser.
8. **Apprentissage.** Chaque terme inconnu peut devenir un alias, une nouvelle compétence ou un terme ignoré. TF-IDF sur les offres passées et les heuristiques (sigles, majuscules, « maîtrise de ») servent seulement à repérer les termes inconnus, pas à noter.
9. **Option N1b : embeddings locaux.** Transformers.js v4.3.0 avec `Xenova/multilingual-e5-small` (environ 118 Mo en int8, modèle de base sous MIT), chargé seulement à la demande. Il propose des « équivalences probables » que l'utilisateur confirme. **Ce n'est jamais le score principal** : c'est moins explicable, et l'étude de Wilson et Caliskan montre des biais (prénoms associés aux personnes blanches préférés dans 85,1 % des cas).

### 6.3 Niveau 2 : IA facultative, désactivée par défaut
- **Interface** `LLMProvider { extractOffer, mapTerms, suggestSelection, rewriteBullet }`. Implémentations : Anthropic (clé de l'utilisateur dans le navigateur, ou proxy en localhost) et Ollama en local. Les sorties sont validées par un schéma et fusionnées dans les **mêmes structures** que le niveau 1, avec un badge « IA ». Sans clé ou hors ligne, seul le niveau 1 fonctionne.
- **Ordre d'implémentation** : `extractOffer`, puis `mapTerms` (qui ne renvoie que des identifiants existants et une liste de termes non rattachés), puis `suggestSelection` (identifiants de la base uniquement), puis `rewriteBullet` en dernier.

| Usage | Risque |
|---|---|
| Structurer l'offre en JSON | Faible |
| Rapprocher les termes de l'offre du dictionnaire, synonymes FR/EN | Faible |
| Proposer une sélection d'identifiants | Faible : le modèle ne peut rien inventer |
| Reformuler une puce ou rédiger l'accroche | **Moyen** : risque d'invention |

- **Garde-fous** (repris de Resume Matcher et Reactive Resume) :
  - **Règles du prompt** : ne rien ajouter qui ne soit dans la source (compétence, outil, chiffre, employeur, diplôme). Un mot-clé non étayé va dans `non_etayes`. Garder le français et le ton de l'utilisateur, sans style « IA ».
  - **Contrôles automatiques après chaque reformulation :**
    - aucun chiffre, pourcentage ou montant nouveau ;
    - aucune compétence du dictionnaire absente de l'original ;
    - entreprise, dates et intitulé jamais envoyés à la reformulation, ou restaurés ;
    - similarité avec la source d'au moins 0,45 (seuil de Resume Matcher) ;
    - longueur maximale.

    Si un contrôle échoue, la proposition est rejetée avec sa raison.
  - **L'original est toujours conservé.** Une reformulation acceptée devient une **variante** de la puce.
  - **L'offre est une donnée non fiable.** Elle est placée dans un bloc délimité, et le prompt précise qu'elle ne contient aucune instruction à suivre.
- **Confidentialité :**
  - n'envoyer que l'offre et les puces concernées, **jamais** le nom, l'e-mail, le téléphone, l'adresse, la photo ou l'âge ; employeurs pseudonymisés en option ;
  - un aperçu « voir ce qui sera envoyé » avant chaque appel ;
  - l'API Anthropic ne s'entraîne pas sur le contenu client (conditions du 17/06/2025) et supprime les données sous 30 jours, sauf exceptions (jusqu'à 2 ans en cas de violation de la politique d'usage) ;
  - Ollama pour une confidentialité maximale.
- **Clé API :**
  - option recommandée : un **proxy en localhost** qui lit la clé dans un `.env` ignoré par git ;
  - sinon : une clé saisie à chaque session (en mémoire ou en `sessionStorage`), ou en `localStorage` chiffrée avec WebCrypto, avec une CSP stricte ;
  - l'appel direct depuis le navigateur passe par l'en-tête `anthropic-dangerous-direct-browser-access: true` ou l'option `dangerouslyAllowBrowser`, et n'est acceptable qu'avec sa propre clé ;
  - une clé dédiée à l'outil, un plafond de dépenses mensuel dans la Console (Settings > Billing) et un workspace dédié.
- **Notes d'implémentation pour Claude :**
  - Modèles et tarifs, en dollars par million de tokens (entrée / sortie) : `claude-opus-5-5` 4 / 20 (par défaut), `claude-sonnet-5-5` 2 / 10, `claude-haiku-4-5` 1 / 5.
  - Coût estimé par analyse (environ 6 000 tokens en entrée et 1 500 en sortie, réflexion non comptée) : 0,014 $ avec Haiku, 0,027 $ avec Sonnet, 0,054 $ avec Opus. C'est une hypothèse ; afficher le coût réel à partir du champ `usage`.
  - Obtenir du JSON avec `output_config: {format: …}`. `output_format` est déprécié. Le pré-remplissage de la réponse renvoie une erreur 400 sur Opus 5.5 et Sonnet 5.5, de même que `tool_choice` forcé (`any` ou `tool`).
  - Opus 5.5 : la réflexion ne peut pas être désactivée ; la régler avec `output_config.effort` (`medium` par défaut, `low` suffit pour l'extraction).
  - Sonnet 5.5 : `thinking: {type: "disabled"}` renvoie une erreur 400 ; utiliser `{type: "between_tools"}` ou un effort `low`.
  - Haiku 4.5 : refuse `effort` ; la réflexion se règle avec `budget_tokens`.
  - Cache de prompt : la base de CV peut servir de préfixe mis en cache, à partir de 512 à 4 096 tokens selon le modèle. En dessous, il n'est pas mis en cache, sans message d'erreur.

---

## 7. Méthode de test ATS

### 7.1 Dans l'application, avant chaque export
- Extraire le texte du PDF généré avec pdf.js et afficher le texte brut, les sections détectées, l'e-mail, le téléphone et les dates.
- Signaler les problèmes repris des codes de conversion Textkernel :
  - présence de caractères interdits ;
  - symboles représentant 5 % ou plus des caractères ;
  - longueur moyenne des mots inférieure à 4 (lettres espacées) ou supérieure à 20 ;
  - intitulés standard absents ;
  - nombre de pages au-delà de la cible : alerte au-delà de 1, blocage au-delà de 2.

### 7.2 En CI (GitHub Actions sur Ubuntu, avec `poppler-utils`)
1. Compiler des fixtures avec `typst compile`, dans la même version que celle de typst.ts. Pour un gabarit HTML, utiliser Playwright `page.pdf({ tagged: true })`.
2. `pdffonts` : aucune police Type 3, et `emb` et `uni` à `yes` partout.
3. `pdfinfo` : nombre de pages au plus égal à la cible, Title et Author renseignés, aucun chiffrement.
4. Extraction par **au moins deux extracteurs**, car pdf.js seul ne voit pas les mots collés que produit poppler (0,68 % de mots endommagés contre 29,62 % dans le cas Talentrah) :
   - `pdftotext -raw` et `-layout` ;
   - pdf.js via `unpdf` ;
   - en option, `mutool`, pdfminer.six ou pypdf.
5. Des assertions **générées à partir de la sélection cochée** : c'est le point fort de l'approche par base et sélection.
6. En option : `verapdf -f ua1` si le mode PDF/UA de Typst est activé.

```ts
// cv.extract.test.ts (Vitest)
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { extractText, getDocumentProxy } from 'unpdf'
const norm = (s: string) => s.normalize('NFKC').replace(/\s+/g, ' ')
const pdf = await readFile('out/cv.pdf')
const pdfjs = norm((await extractText(await getDocumentProxy(new Uint8Array(pdf)), { mergePages: true })).text)
const popplerRaw = execFileSync('pdftotext', ['-raw', 'out/cv.pdf', '-']).toString()
const poppler = norm(popplerRaw)
for (const t of expectedTexts) for (const out of [pdfjs, poppler]) expect(out).toContain(norm(t))
expect(popplerRaw).not.toMatch(/[\u200B\u00AD\u2010\uFB00-\uFB06\uE000-\uF8FF\uFFFD]/) // AVANT normalisation
```
La normalisation NFKC décompose les ligatures. Il faut donc chercher les caractères interdits sur le texte brut, **avant** normalisation.

### 7.3 Critères d'acceptation

| Critère | Seuil | Outil |
|---|---|---|
| Polices | 0 police Type 3 ; `emb=yes` et `uni=yes` pour toutes | `pdffonts` |
| Pages | Au plus la cible (1 ou 2) | `pdfinfo` |
| Métadonnées et sécurité | Title et Author non vides, aucun chiffrement | `pdfinfo` |
| Taille | Moins de 2 Mo | Système de fichiers |
| Textes cochés retrouvés | 100 % dans **chaque** extraction, après NFKC et normalisation des espaces | poppler, unpdf |
| Caractères interdits (texte brut) | 0 occurrence de U+200B, U+00AD, U+2010, U+FB00–FB06, U+E000–F8FF, U+FFFD | Expression régulière |
| Lettres espacées | 0 correspondance avec `/\b(?:\p{Lu} ){3,}/u` | Expression régulière |
| Mots collés | Moins de 1 % des mots attendus absents de l'extraction | Comparaison avec la sélection |
| Ordre | Le nom vient en premier ; les titres de section dans l'ordre attendu | Expression régulière |
| Coordonnées | 1 e-mail et 1 téléphone détectés | Expression régulière |
| Qualité de conversion | Moins de 5 % de symboles ; longueur moyenne des mots entre 4 et 20 | D'après les codes Textkernel |

### 7.4 Contrôles manuels ponctuels
- Copier-coller tout le PDF dans le Bloc-notes et vérifier l'ordre, les caractères manquants et les lettres espacées.
- Passer le PDF dans le parseur d'OpenResume (open-resume.com/resume-parser). Il est conçu pour l'anglais américain (téléphone au format « (xxx)-xxx-xxxx », lieu au format « City, ST »), donc un téléphone ou un lieu français peut être mal noté sans que ce soit un vrai problème.
- Utiliser le vérificateur de rxresu.me, qui mesure la fiabilité de l'extraction et non les chances d'obtenir le poste.
- Essayer des comptes d'essai d'ATS (Zoho Recruit, Workable, Manatal) ou des démos de parseurs commerciaux, **sans envoyer de fausse candidature**.
- Utiliser des mots-tests : « Ingénieur·e », « Certification », « Efficacité », « Œuvre », « workflows », « Official ».

---

## 8. Risques et points d'attention

- **Aucune preuve sur les ATS courants en France.** Toutes les mesures portent sur des parseurs génériques ou américains. La batterie de tests en CI sert de garde-fou ; aucune promesse ne doit être faite à l'utilisateur.
- **Poids de typst.ts** : 14 à 25 Mo selon la configuration, à cause surtout des polices embarquées. Utiliser le bundle lite, ses propres polices et un cache. typst.ts suit Typst avec retard : figer les versions.
- **Forme** : projet en version 0.x, sans mesure ATS. Les rapports **divergent sur son dépôt** : `amruthpillai/forme` (0★, créé le 01/10/2026) contre `formepdf/forme`, qui redirige vers `danmolitor/forme` (216★). Reactive Resume v6 l'utilise depuis le 04/10/2026, donc son comportement peut encore changer.
- **Moteur de Chrome (Skia)** : U+200B et mots collés avec poppler, polices variables en Type 3, en-têtes ajoutés par Chrome. Cela concerne le plan C et toute impression navigateur.
- **Désaccord PDF ou DOCX** entre les sources. La réponse retenue est de proposer les deux et de respecter le format demandé par l'offre.
- **Stockage navigateur** : éviction par Safari, absence de File System Access dans Firefox et Safari. La source de vérité doit être un fichier exportable.
- **Licences** : ne pas copier de code AGPL (OpenResume, ResumeLM), PolyForm NC (resume-bricks), GPL ou sans licence. On peut en reprendre les idées seulement.
- **IA** :
  - hallucinations lors des reformulations ;
  - **injection de prompt cachée dans les offres** ;
  - exposition de la clé API (risque XSS si elle est stockée dans le navigateur) ;
  - biais des embeddings ;
  - coût réel plus élevé que l'estimation sur Opus 5.5, parce que la réflexion y est toujours active.
- **Scores trompeurs** : ils peuvent pousser au bourrage de mots-clés. Il faut afficher la formule, plafonner le poids des mots-clés, et parler de « couverture des exigences ».
- **Pré-sélection automatique** : risque de retirer des puces utiles (critique de Teal) ou de créer un trou dans le parcours (filtre des 6 mois selon HBS). Elle doit rester une proposition réversible, sans jamais masquer une expérience entière.
- **Ajustement à la page** : ne pas descendre sous 10 pt. Au-delà, proposer de décocher des éléments.
- **RGPD** : données de tiers (références) ; publication en ligne qui fait perdre l'exemption domestique.
- **Points non vérifiés à ne pas inscrire comme des faits** :
  - les chiffres détaillés de ROME 4.0 et ses conditions d'accès ;
  - les conditions de réutilisation d'ESCO (décision 2011/833/UE) ;
  - le numéro du règlement AI Act sur EUR-Lex ;
  - le comportement de Firefox et Safari à l'export PDF ;
  - la prise en charge du PDF balisé par react-pdf.

### Décisions à trancher avec l'utilisateur
1. **Métier ou domaine visé** : il détermine le sous-ensemble ESCO ou ROME et les alias techniques.
2. **Langues** : FR seulement, ou FR et EN.
3. **Mode d'exécution** : fichier local, serveur Vite en localhost, ou site statique hébergé. Ce choix détermine le stockage, la gestion de la clé API et le cadre RGPD.
4. **Source de vérité** : fichiers JSON ou YAML dans git, ou IndexedDB avec export.
5. **IA** : oui ou non. Si oui, quel fournisseur (Claude ou Ollama local) et quel budget mensuel. Embeddings locaux (environ 118 Mo) : oui ou non.
6. **Historique des candidatures** et suivi des statuts : voulu ou non.
7. **Formats d'export** : PDF, DOCX, TXT ; Europass ou non.
8. **Photo** : option à prévoir ou non. **Longueur cible** (1 ou 2 pages) selon l'expérience de l'utilisateur.
9. **Framework** : Svelte 5 ou React. **Moteur** : Typst, ou react-pdf.

---

## 9. Sources

**Projets open source et outils**
- https://github.com/reactive-resume/reactive-resume · https://github.com/reactive-resume/reactive-resume/releases/tag/v6.0.0 · https://github.com/reactive-resume/reactive-resume/releases/tag/v5.1.0 · https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/README.md · https://newreleases.io/project/github/reactive-resume/reactive-resume/release/v5.1.0 · https://github.com/AmruthPillai/Reactive-Resume/releases
- https://docs.rxresu.me/ · https://docs.rxresu.me/guides/whats-new-in-v6 · https://docs.rxresu.me/guides/fitting-content-on-a-page · https://rxresu.me/ats-checker · https://rxresu.me/schema.json
- https://github.com/amruthpillai/forme · https://github.com/formepdf/forme
- https://github.com/xitanggg/open-resume · https://github.com/xitanggg/open-resume/commits/main · https://www.open-resume.com/resume-parser
- https://jsonresume.org/schema · https://github.com/jsonresume/resume-schema · https://github.com/jsonresume/resume-schema/issues/203 · https://raw.githubusercontent.com/jsonresume/resume-schema/master/schema.json · https://github.com/jsonresume/jsonresume.org/tree/master/packages/ats-validator · https://registry.npmjs.org/@jsonresume/ats-validator · https://registry.npmjs.org/resume-cli · https://github.com/rbardini/resumed
- https://github.com/rendercv/rendercv · https://docs.rendercv.com/ats_compatibility/ · https://pypi.org/pypi/rendercv/json · https://github.com/Akash4510/resume-as-code
- https://github.com/yamlresume/yamlresume
- https://github.com/srbhr/Resume-Matcher · https://github.com/srbhr/Resume-Matcher/releases/tag/v1.3.0 · https://github.com/srbhr/Resume-Matcher/issues/1011 · https://raw.githubusercontent.com/srbhr/Resume-Matcher/main/README.md · https://raw.githubusercontent.com/srbhr/Resume-Matcher/main/apps/backend/app/services/ats.py · https://raw.githubusercontent.com/srbhr/Resume-Matcher/main/apps/backend/app/services/bullet_scoring.py · https://raw.githubusercontent.com/srbhr/Resume-Matcher/main/apps/backend/app/services/tailor_selection.py · https://raw.githubusercontent.com/srbhr/Resume-Matcher/main/apps/backend/app/services/page_fit.py · https://raw.githubusercontent.com/srbhr/Resume-Matcher/main/apps/backend/app/services/resume_preservation.py · https://raw.githubusercontent.com/srbhr/Resume-Matcher/main/apps/backend/app/prompts/refinement.py · https://raw.githubusercontent.com/srbhr/Resume-Matcher/main/apps/backend/app/prompts/templates.py
- https://github.com/olyaiy/resume-lm
- https://github.com/posquit0/Awesome-CV · https://raw.githubusercontent.com/posquit0/Awesome-CV/master/awesome-cv.cls · https://shapecv.com/blog/latex-resume-ats-friendly-test
- https://github.com/stuxf/basic-typst-resume-template · https://github.com/ptsouchlos/modern-cv · https://github.com/yunanwg/brilliant-CV · https://raw.githubusercontent.com/yunanwg/brilliant-CV/main/template/profile_en/metadata.toml · https://raw.githubusercontent.com/yunanwg/brilliant-CV/main/src/lib.typ · https://raw.githubusercontent.com/yunanwg/brilliant-CV/main/docs/web/docs/migration.md · https://github.com/haenlonns/resume-template
- https://github.com/Myriad-Dreamin/typst.ts · https://github.com/Myriad-Dreamin/typst.ts/releases · https://myriad-dreamin.github.io/typst.ts/cookery/guide/all-in-one.html · https://registry.npmjs.org/@myriaddreamin/typst.ts · https://github.com/pdgramajo/render-my-cv · https://github.com/lgtm-hq/Rustume/issues/682 · https://github.com/aaditagrawal/typsmthng/pull/18
- https://github.com/tsubasakoizumi1122/resume-bricks · https://github.com/hcstephencheung/custom-resume · https://github.com/rresults/resumetailor · https://github.com/Johnesco/resume · https://github.com/zhiweio/resume-as-code · https://github.com/timrking11-blip/resume-optimization-tool · https://github.com/strokati/reeesume · https://github.com/hacksalot/HackMyResume · https://github.com/mavillemavie/jobfinder
- https://github.com/sunnypatell/ats-screener · https://github.com/anna123123123-creator/resume-match · https://github.com/KonstantinosPetrakis/esco-skill-extractor · https://github.com/INESCTEC/yake
- https://github.com/Hsn9403/cv-julien-hassan · https://github.com/LEON007007/Generateur_cv · https://github.com/J0ker98/europass-cv · https://batbrain9392.github.io/cv-builder/
- Non revérifiées : https://ktema.org/articles/the-overengineered-resume/ · https://typst.app/universe/package/basic-resume/ · https://yamlresume.dev/fr · https://kudoswall.com/resume-examples/europass/ · https://github.com/AjayLuhach/resume-forge · https://github.com/topics/resume-as-code

**Parsing ATS et éditeurs**
- Textkernel : https://developer.textkernel.com/tx-platform/v10/resume-parser/overview/specs/ · https://developer.textkernel.com/tx-platform/v10/resume-parser/overview/getting-started/ · https://developer.textkernel.com/tx-platform/v10/resume-parser/overview/parser-output/ · https://developer.textkernel.com/tx-platform/v9/resume-parser/overview/document-conversion-result-codes/ · https://developer.textkernel.com/tx-platform/v10/resume-parser/overview/llm-parser/ · https://developer.textkernel.com/tx-platform/v10/faq/ · https://developer.textkernel.com/tx-platform/v10/search-match-v2/overview/ · https://developer.textkernel.com/tx-platform/v10/search-match-v2/query-language/keywords/ · https://developer.textkernel.com/tx-platform/v10/skills-intelligence/overview/ · https://developer.textkernel.com/TKPlatform/master/languages/ · https://developer.textkernel.com/tx-platform/v10/resume-parser/api/ · https://www.textkernel.com/learn-support/blog/improving-extraction-from-column-resumes/ · https://www.textkernel.com/learn-support/blog/oracle-recruiting-cloud-resume-parsing/ · https://www.textkernel.com/sovren/ · https://www.textkernel.com/learn-support/blog/textkernel-introduces-llm-parser/
- SAP : https://help.sap.com/docs/SAP_SUCCESSFACTORS_RECRUITING/8477193265ea4172a1dda118505ca631/07b6d03076a149b78f4f7a615e3025fd.html · https://help.sap.com/docs/SAP_SUCCESSFACTORS_RECRUITING/8477193265ea4172a1dda118505ca631/282b8727ec494684b2ef8e26a75788b6.html · https://help.sap.com/docs/SAP_SUCCESSFACTORS_RECRUITING/8477193265ea4172a1dda118505ca631/6f3a2ecf6b654c09a29d5ec2bd094598.html · https://help.sap.com/docs/SAP_SUCCESSFACTORS_RECRUITING/8477193265ea4172a1dda118505ca631/0c47856268a6427a8e93cf46c7812b7b.html · https://userapps.support.sap.com/sap/support/knowledge/en/2081576 · https://news.sap.com/2025/08/sap-to-acquire-smartrecruiters/ · https://www.smartrecruiters.com/news/
- Oracle : https://docs.oracle.com/en/cloud/saas/readiness/hcm/24a/tale-24a/24A-tbe-wn-f32282.htm · https://docs.oracle.com/en/cloud/saas/taleo-enterprise/22d/otcug/c-plaintextresumeparsingmobile.html · https://docs.oracle.com/en/cloud/saas/readiness/hcm/25d/recr-25d/25D-recruiting-wn-f39550.htm
- Greenhouse : https://support.greenhouse.io/hc/en-us/articles/360052218132-Supported-formats-for-resumes-cover-letters-and-other-candidate-uploads · https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse · https://support.greenhouse.io/hc/en-us/articles/44682413339675 · https://support.greenhouse.io/hc/en-us/articles/41131886674075-Talent-Matching-FAQ · https://support.greenhouse.io/hc/en-us/articles/41396009937307-Talent-Matching · https://www.greenhouse.com/product-features/greenhouse-real-talent · https://www.greenhouse.com/real-talent-candidate-matching · https://www.greenhouse.com/newsroom · https://www.briefcasecoach.com/how-an-applicant-tracking-system-works-interview-greenhouse-founder-jon-stross/
- Workday, iCIMS, Lever, SmartRecruiters, Teamtailor, Daxtra, Affinda et autres : https://doc.workday.com/admin-guide/en-us/human-capital-management/recruiting/candidates/candidate-skills-match/ave1604091571278.html · https://www.workday.com/en-us/products/talent-management/ai-recruiting.html · https://en.wikipedia.org/wiki/Workday,_Inc. · https://joshbersin.com/2024/03/workday-to-acquire-hiredscore-a-potential-shakeup-in-hr-technology/ · https://www.sec.gov/Archives/edgar/data/1327811/000132781124000032/wday-02262024x991.htm · https://www.hklaw.com/en/insights/publications/2025/05/federal-court-allows-collective-action-lawsuit-over-alleged · https://www.icims.com/blog/find-top-talent-in-seconds-with-ai/ · https://hire.lever.co/developer/documentation · https://www.jobscan.co/blog/lever-ats/ · https://developers.smartrecruiters.com/reference/candidatesresumeparse · https://www.teamtailor.com/en/productnews/auto-add-candidate-information-with-resume-parser/ · https://www.teamtailor.com/en/productnews/parse-candidates-faster-and-easier/ · https://updates.teamtailor.com/add-candidate-information-automatically-with-resume-parser-99282 · https://support.teamtailor.com/en/articles/10209597-co-pilot-candidate-screening · https://www.jobmentis.com/en/guide/teamtailor-ats · https://info.daxtra.com/partner-icims · https://portal.wearemercury.com/knowledgebase/article/KA-01555/en-us · https://www.affinda.com/blog/how-does-resume-parsing-work/ · https://docs.rchilli.com/kc/c_RChilli_resume_parser · https://www.hireability.com/products/alex-cv-resume-parser/ · https://www.hireability.com/resume-parsing-qa-session/

**Études, mythes, enquêtes**
- https://www.hbs.edu/ris/Publication%20Files/hiddenworkers09032021_Fuller_white_paper_33a2047f-41dd-47b1-9a8d-bd08cf3bfa94.pdf · https://unchartedcareer.com/blog/the-75-of-resumes-are-auto-rejected-myth-traced-to-its-source · https://theconversation.com/what-everyone-gets-wrong-about-the-modern-job-search-and-what-actually-works-285582 · https://www.cio.com/article/284417/careers-staffing-new-job-search-service-helps-job-seekers-penetrate-applicant-tracking-systems.html · https://jobcannon.io/research/stats/ats-myth-preptel
- https://enhancv.com/blog/what-is-ats/ · https://enhancv.com/blog/ats-resume-parsing/ · https://enhancv.com/blog/does-ats-reject-resumes/ · https://dev.to/resumap/we-ran-the-same-resume-through-4-real-ats-parsers-in-36-layouts-same-text-different-parses-3mfc · https://resumap.io/articles/textkernel-parsing-test
- https://www.jobscan.co/blog/resume-pdf-vs-word/ · https://www.jobscan.co/blog/fortune-500-use-applicant-tracking-systems/ · https://www.jobscan.co/blog/ats-formatting-mistakes/ · https://www.jobscan.co/blog/8-things-you-need-to-know-about-applicant-tracking-systems/ · https://www.jobscan.co/blog/top-resume-keywords-boost-resume/ · https://www.jobscan.co/jobscan-tutorial · https://www.jobscan.co/resume-scanner · https://www.jobscan.co/blog/jobscan-vs-teal/ · https://www.jobscan.co/blog/greenhouse-ats-what-job-seekers-need-to-know/ · https://www.jobscan.co/blog/can-ats-detect-ai-resume/ · https://www.scu.edu/careercenter/toolkit/job-scan-common-ats-resume-formatting-mistakes/ · https://www.jobshinobi.com/blog/jobscan-resume-scanner-limitations
- https://finance.yahoo.com/technology/ai/articles/job-seekers-hide-invisible-instructions-100000545.html · https://arxiv.org/abs/2407.20371 · https://www.washington.edu/news/2024/10/31/ai-bias-resume-screening-race-gender/

**Marché français, droit, RGPD, IA**
- https://corporate.apec.fr/home/nos-etudes/toutes-nos-etudes/pratiques-de-recrutement-de-cadres-2025.html · https://www.apec.fr/candidat/optimiser-votre-candidature/candidature/fiches-avis/optimisez-votre-cv-pour-passer-le-filtre-des-ats-.html (403)
- https://www.defenseurdesdroits.fr/sites/default/files/2023-03/DDD_guide_recrutement-sans-discrimination_20190703.pdf · https://code.travail.gouv.fr/code-du-travail/l1221-6 · https://code.travail.gouv.fr/code-du-travail/l1221-7 · https://code.travail.gouv.fr/code-du-travail/l1132-1 · https://conseil-etat.fr/actualites/cv-anonyme
- https://www.francetravail.fr/candidat/vos-recherches/preparer-votre-candidature/cv-lettre-de-motivation-e-mail/comment-rediger-un-cv-efficace-e.html · https://www.francetravail.fr/candidat/vos-recherches/preparer-votre-candidature/cv-lettre-de-motivation-e-mail/cv--des-exemples-pour-presenter.html · https://www.francetravail.fr/candidat/vos-recherches/preparer-votre-candidature/cv-lettre-de-motivation-e-mail/cv--des-exemples-pour-present-1.html · https://www.francetravail.fr/candidat/vos-recherches/preparer-votre-candidature/cv-lettre-de-motivation-e-mail/comment-faire-son-cv-quand-on-a.html · https://www.francetravail.fr/candidat/vos-services-en-ligne/creez-un-cv-a-partir-de-votre-pr.html
- https://www.hellowork.com/fr-fr/medias/cv-rubriques.html · https://www.hellowork.com/fr-fr/medias/date-naissance-cv.html · https://www.welcometothejungle.com/fr/collections/candidats/faire-un-cv-guide · https://solutions.welcometothejungle.com/blog/ats-du-march%C3%A9 · https://www.michaelpage.fr/advice/candidats/le-cv-et-la-lettre-de-motivation/quel-cv-pour-un-cadre-exp%C3%A9riment%C3%A9
- https://www.cnil.fr/fr/le-guide-du-recrutement · https://www.cnil.fr/fr/le-recrutement · https://www.cnil.fr/fr/recrutement-et-donnees-personnelles-dans-les-tpepme-cinq-questions-incontournables-se-poser · https://www.cnil.fr/fr/controles-prioritaires-2026
- https://www.ipp.eu/wp-content/uploads/2021/05/n67-notesIPP-mai2021.pdf · https://dares.travail-emploi.gouv.fr/publication/discrimination-lembauche-des-personnes-dorigine-supposee-maghrebine-quels-enseignements (CAPTCHA)
- https://help.flatchr.io/fr/articles/8278247-tout-savoir-sur-la-fiche-candidat · https://www.cegid.com/fr/produits/cegid-hr/talent-acquisition/logiciel-recrutement-ats-crm-saas/ · https://taleez.com/logiciel-de-recrutement/ia · https://taleez.com/blog/meilleur-ats-logiciel-recrutement-france-comparatif · https://cvpass.co/blog/liste-ats-france · https://cvpass.fr/en/blog/entreprises-ats-france · https://cvpass.fr/en/blog/optimiser-cv-ats-france · https://www.helloworkplace.fr/ia-act-recrutement-report-2027/
- https://www.data.gouv.fr/dataservices/api-repertoire-operationnel-des-metiers-et-des-emplois-rome-4-0 · https://www.data.gouv.fr/fr/datasets/repertoire-operationnel-des-metiers-et-des-emplois-rome/ · https://www.data.gouv.fr/datasets/repertoire-operationnel-des-metiers-et-des-emplois-rome · https://francetravail.io/data/api/rome-4-0-fiches-metiers
- https://esco.ec.europa.eu/en/use-esco/download · https://esco.ec.europa.eu/en/about-esco/escopedia/escopedia/esco-v121 · https://esco.ec.europa.eu/en/about-esco/escopedia/escopedia/esco-v12 · https://esco.ec.europa.eu/en/classification/skill_main · https://esco.ec.europa.eu/en/use-esco/use-esco-services-api/esco-web-service-api · https://ec.europa.eu/esco/api/doc/esco_api_doc.html · https://www.onetcenter.org/database.html · https://lightcast.io/open-skills · https://www.coe.int/fr/web/common-european-framework-reference-languages/level-descriptions
- https://artificialintelligenceact.eu/annex/3/ · https://artificialintelligenceact.eu/implementation-timeline/ · https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/ · https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/ · https://www.lewissilkin.com/insights/2026/07/27/the-digital-omnibus-on-ai-enters-into-force-today-102nedo · https://lawandtechnology.eu/en/digital-omnibus-on-ai-official-journal-regulation-2026-1744/ · https://eur-lex.europa.eu/eli/reg/2026/1744/oj · https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A62001CJ0101 · https://eur-lex.europa.eu/eli/dec/2011/833/oj/eng
- https://github.com/nezor11/martinez-place · https://github.com/nezor11/martinez-place/pull/87 · https://atsverification.com/blog/latex-resume-ats-friendly/

**Technique PDF / DOCX / web**
- https://typst.app/docs/changelog/0.14.0/ · https://github.com/typst/typst/releases · https://typst.app/docs/reference/data-loading/
- https://github.com/diegomura/react-pdf · https://github.com/diegomura/react-pdf/issues/3009 · https://react-pdf.org/fonts
- https://github.com/parallax/jsPDF · https://github.com/parallax/jsPDF/releases · https://raw.githubusercontent.com/parallax/jsPDF/master/src/modules/html.js · https://github.com/parallax/jsPDF/issues/2148 · https://github.com/eKoopmans/html2pdf.js · https://github.com/foliojs/pdfkit/issues/1659 · https://github.com/foliojs/pdfkit/releases · https://raw.githubusercontent.com/bpampuch/pdfmake/master/package.json
- https://pptr.dev/api/puppeteer.pdfoptions · https://github.com/puppeteer/puppeteer/commit/031686339136873c555a19ffb871f7140a2c39d9 · https://github.com/microsoft/playwright/releases/tag/v1.42.0 · https://playwright.dev/docs/api/class-page · https://github.com/Kozea/WeasyPrint/issues/2363 · https://pagedjs.org/posts/en/a-new-chapter-in-paged.js-life/ · https://developer.chrome.com/blog/print-margins · https://pdfa.org/chrome-adds-support-for-tagged-pdf/
- https://github.com/ArtifexSoftware/pdf2docx/issues/379 · https://github.com/Bayo-1987/Claude-Talentrah/issues/597 · https://github.com/PigLardLord/cv-giovanni/issues/143 · https://dev.to/accreditly/how-html-to-pdf-conversion-actually-works-rendering-engines-text-objects-and-fonts-103j · https://github.com/cinnamennen/resume/pull/1 · https://resumeatlas.io/ats-friendly-fonts · https://github.com/latex3/latex2e/issues/465 · https://www.overleaf.com/learn/latex/French · https://github.com/ashwingopalsamy/ats-latex-resume
- https://github.com/dolanmiu/docx · https://docxtemplater.com/ · https://github.com/unjs/unpdf/blob/main/README.md · https://manpages.debian.org/stretch/poppler-utils/pdffonts.1.en.html · https://docs.verapdf.org/cli/validation/
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria · https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker · https://developer.chrome.com/docs/capabilities/web-apis/file-system-access · https://vite.dev/blog/announcing-vite8
- https://huggingface.co/Xenova/multilingual-e5-small · https://huggingface.co/docs/transformers.js/en/index · https://naturalnode.github.io/natural/stemmers.html

**Outils commerciaux (UX)**
- Teal : https://help.tealhq.com/en/collections/9568976-resume-builder · https://help.tealhq.com/en/articles/12062117-using-auto-select · https://help.tealhq.com/en/articles/9519151-export-your-resume-cover-letter · https://www.tealhq.com/tool/resume-job-description-match · https://www.linkedin.com/pulse/one-edit-multiple-resumes-learn-how-tealhq · https://resumegenius.com/reviews/teal-resume-builder-reviews · https://www.usesprout.com/blog/teal-review-pricing-alternatives · https://www.wobo.ai/blog/teal-review/
- Rezi : https://www.rezi.ai/rezi-docs/ai-keyword-targeting-explained · https://www.rezi.ai/rezi-docs/the-rezi-score-explained · https://www.rezi.ai/pricing · https://www.rezi.ai/posts/teal-review · https://www.rezi.ai/posts/rezi-vs-enhancv
- Enhancv : https://enhancv.com/ai-resume-builder/ · https://resumegenius.com/reviews/enhancv-reviews · https://help.enhancv.com/en/articles/2808841-entries-on-your-resume-what-are-they
- Kickresume et Resume Worded : https://www.kickresume.com/en/targeted-resume/ · https://stylingcv.com/blog/kickresume-review-2026-features-pricing-pros-cons-worth-it/ · https://resumeworded.com/targeted-resume
- Huntr : https://huntr.co/product/resume-tailor · https://help.huntr.co/en/articles/12241684-job-match-score · https://help.huntr.co/en/articles/12824077-understanding-huntr-s-resume-builder
- FlowCV : https://flowcv.com/ · https://flowcv.com/pricing · https://resufit.com/blog/flowcv-review-free-resume-builder-worth-trying/ · https://github.com/dannyota/flowcvcli · https://github.com/HauseMasterZ/flowcvcli
- Novorésumé, CVDesignR, Canva : https://novoresume.com/career-blog/novoresume-vs-other-resume-builders · https://novoresume.com/tools/ats-resume-checker · https://cvdesignr.com/fr · https://cvdesignr.com/fr/premium · https://trajectio.fr/cv-designr-avis-fonctionnalites/ · https://indeedflex.com/career-hub/guides/canva-resume-builder-ats

**API Claude et confidentialité**
- https://www.anthropic.com/legal/commercial-terms · https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data · https://platform.claude.com/docs/en/api/rate-limits · https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/

**Citées dans les rapports, mais non chargées ou non revérifiées**
- https://dataclean.to/use-cases/clean-encoding-from-workday · https://www.jobmentis.com/fr/guide/welcome-to-the-jungle-ats · https://www.moncvhub.fr/guides/passer-filtres-ats-en-france · https://www.cvadapt.fr/blog/ameliorer-cv-passer-ats · https://cvperformance.fr/blog/rediger-cv/photo-cv/ · https://enhancv.com/blog/french-resume/ · https://www.italki.com/en/blog/french-cv · https://www.nutrient.io/blog/how-to-convert-html-to-pdf-using-html2pdf/ · https://js.libhunt.com/jspdf-changelog/4.0.0 · https://www.npmjs.com/package/@myriaddreamin/typst.ts · https://www.hlc.com/en/publications/eu-legislators-agree-to-delay-for-highrisk-ai-rules · https://verifywise.ai/blog/eu-ai-act-omnibus-what-changed