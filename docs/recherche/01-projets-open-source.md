# Projets open source similaires : générateurs de CV, CV « maître » et ATS (relevé du 2026-10-05, version vérifiée)

## 0. Synthèse

- **Aucun projet établi ne fait exactement ce que vous voulez**, à savoir une base de contenu, des cases à cocher par section, entrée et puce, puis un CV compatible ATS. Les grands outils, comme Reactive Resume et Resume Matcher, gèrent des copies complètes de CV ou une réécriture par IA. Les projets « CV maître + sélection » existent, mais ils sont minuscules (0 à 91 étoiles) ou très récents (créés entre fin 2025 et septembre 2026). Le plus proche, **resume-bricks**, propose déjà une sélection puce par puce et une adaptation à une offre, mais sa licence interdit l'usage commercial et il ne traite pas l'ATS. **Il y a donc une vraie place pour ce projet.** Ce relevé n'est pas exhaustif : il se limite à ce que la recherche a trouvé.
- **Trois briques réutilisables ressortent :**
  - le **schéma JSON Resume**, standard d'échange ouvert aux champs personnalisés (`additionalProperties: true` sur les objets). Les puces (`highlights`) restent des **chaînes**, donc on ne peut pas leur ajouter d'`id` directement (voir 1.3) ;
  - le **rendu Typst** de RenderCV : un PDF texte balisé, testé par le projet lui-même contre trois parseurs commerciaux ;
  - la **ré-extraction du PDF avec pdf.js dans le navigateur** pour s'auto-contrôler, comme le font le parseur d'OpenResume et l'ATS checker de Reactive Resume.
- **Les bonnes pratiques ATS couramment recommandées** sont les suivantes. Ce sont des **précautions**, pas un consensus mesuré : elles viennent surtout d'éditeurs américains. Jobscan, par exemple, écrit que « many ATS parsers » ignorent les en-têtes et pieds de page, pas tous.
  - une seule colonne ;
  - des titres de section standard ;
  - les coordonnées dans le corps du document plutôt qu'en en-tête ou pied de page ;
  - aucune icône de police (FontAwesome) ;
  - ni tableaux, ni images contenant du texte ;
  - des dates cohérentes, sur la même ligne que l'entrée ;
  - un PDF dont le texte est sélectionnable.

  Les parseurs modernes en tolèrent une partie, mais suivre ces règles coûte peu et protège contre les parseurs les plus stricts. Aucune donnée publique n'a été trouvée sur les ATS utilisés en France.
- **À éviter : le texte caché**, qu'il s'agisse de mots-clés ou d'un prompt destiné aux filtres par IA. brilliant-CV propose les deux en option, désactivés par défaut, et avertit lui-même du risque de détection et de rejet.
- **Peu de projets français** ont été trouvés, et aucun ne propose la sélection par cases à cocher depuis une base. C'est une absence de preuve dans les résultats, pas une démonstration.

**Méthode.** Les étoiles et les dates viennent de l'API GitHub, relevées le 2026-10-05. Certaines affirmations ne viennent que d'extraits de recherche ; elles sont signalées « non ouvert ».

---

## 1. Grands builders de CV

### 1.1 Reactive Resume
- **URL** : https://github.com/reactive-resume/reactive-resume. L'ancien chemin `AmruthPillai/Reactive-Resume` redirige vers ce dépôt. Site : rxresu.me.
- **Licence et activité** : MIT, 43 795 ★, dernier push le 2026-10-05.
- **Version** : la **v6.0.0 est sortie le 2026-10-04**. Elle contient des changements incompatibles : il faut sauvegarder la base de données, mettre à jour en une seule étape (pas de mise à jour progressive v5 vers v6) et convertir les styles. La version précédente est la v5.3.2 du 2026-09-26.
- **Stack v6 (tableau du README)** :
  - interface React 19 en SPA, avec TanStack Router et Vite ;
  - serveur Hono sur Node.js 24 ou Cloudflare Workers ;
  - PostgreSQL avec Drizzle ORM ;
  - oRPC, REST OpenAPI et MCP ; authentification Better Auth ;
  - Tailwind, Zustand avec TanStack Query, TipTap (texte riche), Lingui (traductions) ;
  - stockage compatible S3 (SeaweedFS en développement) et Redis.
- **Génération PDF** :
  - au départ, Browserless/Chromium ;
  - de la v5.1 à la v5.3, `@react-pdf/renderer` côté client (non revérifié en détail) ;
  - en v6, **Forme** (https://github.com/amruthpillai/forme, MIT), un moteur Rust compilé en WASM qui produit des PDF paginés à partir de HTML et CSS print ou de composants React, Svelte, Vue ou Preact, sans navigateur headless. Le même moteur sert à l'aperçu et au téléchargement.
  - Point de vigilance : le dépôt Forme a été créé le 2026-10-01 et n'a aucune étoile. C'est une dépendance très jeune.
- **Modèle de données** : schéma propriétaire servi à `https://rxresu.me/schema.json` (vérifié : HTTP 200, `application/schema+json`).
  - Clés principales : `picture`, `basics`, `summary`, `sections`, `customSections`, `metadata`.
  - Chaque item porte un `id` et un booléen `hidden` ; chaque section porte des réglages d'affichage.
  - Les dates sont structurées (confirmé par le README : « structured dates »).
  - Le détail des champs n'a pas été revérifié.
- **Sélection et variantes** :
  - on peut masquer une section ou une entrée : le menu propose de masquer, dupliquer ou déplacer ;
  - « Copy a resume for a job » crée une **copie complète**. La bibliothèque gère des **tags**, du tri, une vue grille ou liste ;
  - il n'y a **pas de séparation entre la base et la sélection**, donc les copies divergent avec le temps.
- **Prise en compte de l'ATS** :
  - **17 modèles au total**, avec des filtres « une colonne », « deux colonnes » et « ATS-safe ». Ce ne sont pas 17 modèles ATS-safe ;
  - un mode Check : constats ancrés sur les lignes concernées, score de lisibilité, correspondance de mots-clés avec une offre, vue du texte lu par le logiciel, relecture IA en option ;
  - un **ATS checker public** (https://rxresu.me/ats-checker). Il lit le PDF avec PDF.js dans le navigateur, sans envoi de fichier, et note six axes : Readability, Layout, Sections, Contact details, Dates, Writing. Il précise qu'il mesure la fiabilité de l'extraction du texte, pas les chances d'obtenir le poste.
  - Le README annonce aussi un ajustement pour tenir sur la page (« Fit overflowing content by adjusting density, margins, and text size »).
- **Import et export** :
  - import : JSON Reactive Resume, JSON Resume, export LinkedIn, PDF lisible, tous sans IA ; le **Word nécessite un fournisseur d'IA** ;
  - export : PDF, DOCX, Markdown, JSON.
- **IA** : OpenAI, Anthropic, Google Gemini, OpenRouter, Ollama ou un point d'accès compatible. Les modifications sont proposées puis acceptées ou refusées.
- **Points forts** : très complet, maintenu chaque semaine, suivi de candidatures (liste, tableau, calendrier), multilingue.
- **Limites** : lourd pour un usage personnel (PostgreSQL, Redis, S3). Le modèle « copie par candidature » est l'opposé de « base + cases à cocher ». La v6 vient de sortir et casse la compatibilité.
- **À reprendre** :
  - `hidden` par section ou entrée, mais côté sélection, pas dans la base ;
  - la vérification ATS en navigateur avec pdf.js ;
  - les filtres « ATS-safe » ;
  - l'export DOCX et Markdown ;
  - les dates structurées ;
  - l'ajustement automatique à la page.

### 1.2 OpenResume (avec son parseur ATS)
- **URL** : https://github.com/xitanggg/open-resume. Site : open-resume.com.
- **Licence et activité** : **AGPL-3.0**, 8 912 ★, 145 issues ouvertes. **Dernier push le 2024-10-29** : le projet stagne.
- **Stack** : Next.js 13, TypeScript, Redux Toolkit, Tailwind. React-pdf génère le PDF, PDF.js le relit.
- **Données** : tout tourne dans le navigateur, sans compte (« no data ever leaves your browser »).
- **Sélection** : un seul CV, aucune notion de variante.
- **ATS** :
  - une seule colonne, par choix ;
  - bonnes pratiques du marché américain (« U.S. best practices ») ;
  - le README dit le CV « ATS friendly to top ATS platforms such as Greenhouse and Lever ». C'est une affirmation du projet, non démontrée.
- **Fonctionnement du parseur** (https://www.open-resume.com/resume-parser) :
  1. pdf.js extrait les éléments de texte avec leur position, leur style et leurs retours à la ligne.
  2. Les éléments sont regroupés en lignes : deux éléments voisins sont fusionnés si leur écart est inférieur à la largeur moyenne d'un caractère. Cette moyenne se calcule hors éléments en gras et retours à la ligne.
  3. Les lignes sont regroupées en sections. Un titre se reconnaît parce qu'il est seul sur sa ligne, en gras et en MAJUSCULES ; à défaut, une liste de mots-clés de titres prend le relais.
  4. Chaque attribut est extrait par un système de points. Exemple pour le nom : +3 s'il ne contient que des lettres, espaces ou points ; +2 s'il est en gras ; +2 s'il est en majuscules ; −4 s'il contient un `@`, un chiffre, une virgule ou une barre oblique.

  Le parseur est conçu pour des CV « single column resume in English language ».
- **Points forts** : 100 % local ; le parseur sert de boucle d'auto-test.
- **Limites** : projet stagnant ; anglais uniquement, donc les titres français demandent d'adapter les mots-clés. L'AGPL impose ses conditions au code qui la reprend : mieux vaut réimplémenter l'algorithme que copier le code.
- **À reprendre** : l'algorithme en 4 étapes pour un panneau « ce que voit l'ATS » ; la règle des titres en gras et majuscules seuls sur leur ligne.

### 1.3 JSON Resume : schéma, resume-cli, thèmes
- **URL** :
  - schéma : https://jsonresume.org/schema ;
  - `jsonresume/resume-schema` : MIT, 2 390 ★, **archivé** (dernier push le 2026-06-12) ;
  - `jsonresume/resume-cli` : MIT, 4 713 ★, **archivé** (dernier push le 2026-06-12) ;
  - le développement continue dans le monorepo https://github.com/jsonresume/jsonresume.org (MIT, 323 ★, push le 2026-09-09). Le paquet npm `resume-cli` (3.7.3, Node 18+) est dans `packages/cli`.
- **Modèle de données (v1.0.0)** :
  - sections : `basics`, `work`, `volunteer`, `education`, `awards`, `certificates`, `publications`, `skills`, `languages`, `interests`, `references`, `projects`, plus `meta` (`canonical`, `version`, `lastModified`) ;
  - une entrée `work` contient `name`, `location`, `description`, `position`, `url`, `startDate`, `endDate`, `summary` et `highlights[]` ;
  - une entrée `skills` contient `name`, `level`, `keywords[]` ;
  - **`additionalProperties: true`** à la racine et sur `basics`, `work`, `education`, `skills`, `projects` et `meta`. On peut donc ajouter `id`, `tags` ou `variants` **sur une entrée** sans casser la validation ;
  - **attention : chaque élément de `highlights` doit être une chaîne** (`items: {type: string}`). Mettre un objet `{id, text, tags}` dans `highlights` rend le fichier invalide. Pour identifier les puces, il faut une structure parallèle, par exemple `x_highlights: [{id, text, tags}]`, puis la projeter en chaînes à l'export ;
  - les dates sont des chaînes ISO 8601 partielles (`YYYY`, `YYYY-MM` ou `YYYY-MM-DD`).
- **Outils** :
  - resume-cli : `init`, `validate`, `export` (HTML/PDF), `serve` ;
  - les thèmes sont des paquets npm `jsonresume-theme-*` ; le dossier `packages/themes` du monorepo compte environ 55 entrées ;
  - un convertisseur `packages/converters/jsonresume-to-rendercv` ;
  - alternative légère : **resumed** (https://github.com/rbardini/resumed), MIT, 550 ★, push le 2026-09-16.
- **ATS** : le paquet **`@jsonresume/ats-validator`** (publié sur npm, version 0.3.0, MIT) fait 10 vérifications sur le HTML :
  1. HTML sémantique ;
  2. polices ;
  3. tableaux ;
  4. mise en page ;
  5. titres ;
  6. images ;
  7. tailles de police ;
  8. accessibilité ;
  9. coordonnées ;
  10. caractères spéciaux.

  Il rend un score de 0 à 100, une note de A à F et une appréciation de « excellent » à « poor ». Les seuils précis, comme la taille minimale de police, n'ont pas été revérifiés.
- **Points forts** : standard de fait pour l'échange (importé par Reactive Resume), extensible au niveau des entrées, avec un écosystème de thèmes.
- **Limites** : pas de notion de sélection ; dates en chaînes ; **puces sans identifiant et non extensibles** ; qualité des thèmes inégale ; PDF via navigateur headless ; réorganisation récente des dépôts.
- **À reprendre** : le schéma comme format **d'échange** (import/export), avec un format interne plus riche ; les 10 règles d'`ats-validator` comme liste de contrôle.

### 1.4 RenderCV (YAML vers Typst vers PDF)
- **URL** : https://github.com/rendercv/rendercv. Site : rendercv.com.
- **Licence et activité** : MIT, 17 702 ★, dernier push le 2026-05-01. **v2.8 du 2026-03-21** (GitHub et PyPI), Python 3.12 minimum.
- **Stack** : Python, Pydantic, **Typst**. Les anciennes versions utilisaient LaTeX.
- **Modèle de données** :
  - un fichier YAML avec les clés `cv`, `design`, `locale`, `settings` ;
  - les sections sont des clés libres contenant des listes d'entrées typées ;
  - un JSON Schema fournit l'autocomplétion dans l'éditeur. Le détail des types d'entrées n'a pas été revérifié.
- **Génération** : PDF, PNG, Markdown, HTML et source Typst. **Neuf thèmes** (confirmés dans le dépôt) : classic, engineeringresumes, sb2nov, moderncv, engineeringclassic, harvard, ink, opal, ember.
- **Variantes** : pas de tags natifs ; fichiers séparés pour le design, la locale et les réglages ; surcharges en ligne de commande ; `bold_keywords` ; noms de fichiers paramétrables. Ces options n'ont pas été revérifiées une par une.
- **ATS** : rapport https://docs.rendercv.com/ats_compatibility/.
  - 20 PDF testés : 4 CV × 5 thèmes (**classic, moderncv, sb2nov, engineeringresumes, engineeringclassic**). **Les thèmes harvard, ink, opal et ember ne sont pas couverts.**
  - Extraction avec `pdftotext` et PyMuPDF : 99,1 % de précision moyenne pour chacun, aucun caractère illisible, ordre de lecture correct dans les 20 cas.
  - Trois parseurs commerciaux (Affinda, Extracta, Klippa, via Eden AI) : nom, email, téléphone, entreprise, poste, date de début et date de fin sont reconnus par les trois.
    - **Établissement** : partiel chez Affinda.
    - **Lieu** : partiel chez Affinda, **non extrait** par Klippa, correct chez Extracta.
    - Les écarts de format, comme « MS » contre « Master », sont présentés comme de la normalisation.
  - « Since Typst 0.14, every PDF is a Tagged PDF » : un PDF balisé, avec un arbre de structure qui indique l'ordre de lecture.
  - **Réserves (les nôtres, le rapport n'a pas de section « limites »)** : le rapport vient du projet lui-même ; il teste des parseurs du marché, pas les ATS des entreprises (Workday, Taleo…) ; le CV de départ est propre et à une colonne.
- **Points forts** : meilleure preuve publique de compatibilité ATS trouvée, typographie soignée, CV versionnable dans Git.
- **Limites** : outil en ligne de commande Python, pas de sélection par cases à cocher, aucun push depuis le 2026-05-01.
- **Projet dérivé** : https://github.com/Akash4510/resume-as-code (1 ★, pas de licence, créé le 2026-08-19). Un YAML maître et des variantes compilées par GitHub Actions ; contenu non revérifié.
- **À reprendre** : Typst comme moteur ; `bold_keywords` ; la méthode de test en deux couches (extraction de texte, puis parseur).

### 1.5 YAMLResume
- **URL** : https://github.com/yamlresume/yamlresume (MIT, 1 541 ★, push le 2026-10-05). **Dernière version : v0.16.1 du 2026-09-20.** Issu de PPResume, un service commercial basé sur LaTeX.
- **Modèle** : schéma propre, validé par Zod et un JSON Schema.
- **Sorties** : PDF via LaTeX/XeLaTeX, HTML, Markdown, DOCX. La mention de Typst sur la feuille de route **n'apparaît pas dans le README** ; non vérifiée.
- **Locales** : 10 langues sur 12 codes de locale, dont le **français** ; README disponible en français.
- **ATS** : rien de spécifique dans le README. Pas de sélection ni de variantes.
- **À reprendre** : la validation Zod et JSON Schema ; les libellés de sections par langue ; la sortie DOCX.

### 1.6 Resume Matcher
- **URL** : https://github.com/srbhr/Resume-Matcher (Apache-2.0, 28 585 ★, push le 2026-10-04). **v1.3.0 « Crescendolls » publiée le 2026-09-06.**
- **Stack** :
  - serveur FastAPI (Python 3.13+), LiteLLM ;
  - interface Next.js 16, React 19 (Node 22+ requis en v1.3) ;
  - **SQLite depuis la v1.3**, avec clés API chiffrées et migration depuis TinyDB. Le README dit encore « TinyDB » : il n'est pas à jour ;
  - PDF via Chromium headless (Playwright).
- **Fonctionnement** : on téléverse un CV, on colle une offre, et l'IA **réécrit** un CV adapté que l'utilisateur relit. La v1.3 ajoute un assistant de création guidée.
- **Fonctions** : score de correspondance et détail du score, alignement des compétences, lettre de motivation, préparation d'entretien, suivi des candidatures.
- **Modèles** : le README en liste quatre (classique ou moderne, une ou deux colonnes) ; la v1.3 en ajoute trois (LaTeX, Clean, Vivid).
- **IA** : Ollama, OpenAI, Anthropic, Gemini, OpenRouter, DeepSeek, Groq, Azure AI Foundry, serveurs compatibles OpenAI. **Interface française depuis la v1.3** (`fr.json` présent), alors que le README ne la cite pas encore.
- **ATS** : le README ne revendique pas de compatibilité ATS ; le score est une heuristique propre au projet.
- **Limites** :
  - la réécriture par LLM expose à des hallucinations. Le README n'en parle pas ; les notes de la v1.3 mentionnent seulement « Strengthen checks around original information », un garde-fou partiel non documenté ;
  - le CV de départ est un document, pas une base structurée ;
  - les modèles à deux colonnes sont risqués.
- **À reprendre** : coller une offre, en extraire les mots-clés, afficher la couverture et les manques ; le suivi des candidatures.

### 1.7 ResumeLM
- **URL** : https://github.com/olyaiy/resume-lm (AGPL-3.0, 329 ★, push le 2026-09-14).
- **Stack** : Next.js 15, React 19, Supabase (PostgreSQL), React PDF. Non revérifié.
- **Variantes** : un CV de base et des CV adaptés, avec l'ordre et la configuration des sections stockés en JSONB. Non revérifié.
- **ATS** : scoring ATS et suggestions de mots-clés.
- **Statut** : aussi proposé en SaaS (resumelm.ca). Non revérifié.
- **À reprendre** : la séparation base / adapté ; l'ordre et la configuration des sections stockés à part du contenu.

---

## 2. Modèles LaTeX et Typst

### 2.1 Awesome-CV (LaTeX)
- **URL** : https://github.com/posquit0/Awesome-CV (LPPL-1.3c, 28 648 ★, push le 2026-09-14).
- **Technique** : XeLaTeX ; polices Source Sans 3 et Roboto ; **`\RequirePackage{fontawesome6}`** (confirmé dans `awesome-cv.cls`).
- **ATS** : l'**issue #137 « ATS incompataibility »** (sic), ouverte le 2017-06-03, est **toujours ouverte** avec 10 commentaires.
- **Test tiers, à prendre avec précaution** : ShapeCV, site commercial, article mis à jour le 2026-09-09.
  - Il dit avoir testé 5 modèles sur Workday, Greenhouse, Taleo et Lever, sans donner le nombre de tests.
  - Il annonce que les macros `\aEnvelope` / `\aPhone` sans libellé texte font échouer l'extraction des coordonnées sur **Taleo et Workday « in 80% of tests »**.
  - Il annonce 98,2 % de précision moyenne pour Jake's Resume, et moins de 35 % pour Deedy-CV et AltaCV sur certaines plateformes.
  - La méthode n'est pas vérifiable.
- **Leçon** : **ne pas mettre d'icônes de police à côté du téléphone ou de l'email**, et toujours écrire un libellé en texte.

### 2.2 basic-resume (Typst)
- **URL** : https://github.com/stuxf/basic-typst-resume-template ; paquet Typst Universe `basic-resume`.
- **Licence et activité** : Unlicense, 246 ★, dernière étiquette v0.2.9, push le 2026-03-28.
- **Contenu** : inspiré de Jake's Resume, se dit adapté aux ATS. Le détail des fonctions n'a pas été revérifié.
- **À reprendre** : une base de modèle sobre pour notre rendu Typst.

### 2.3 modern-cv (Typst)
- **URL** : **https://github.com/ptsouchlos/modern-cv** ; l'ancien chemin `DeveloperPaul123/modern-cv` redirige.
- **Licence et activité** : 627 ★, push le 2026-09-01. La dernière release GitHub est la 0.10.0 du 2026-04-20 ; le `typst.toml` de la branche principale indique 0.11.0.
- **Licence** : le `typst.toml` déclare **MIT** ; l'API GitHub renvoie `NOASSERTION`.
- **Contenu** : basé sur Awesome-CV, avec les polices Roboto et Source Sans 3 et **les icônes FontAwesome** (même risque ATS). Multilingue, avec lettre de motivation.

### 2.4 brilliant-CV (Typst)
- **URL** : https://github.com/yunanwg/brilliant-CV (Apache-2.0, 844 ★, push le 2026-10-05). **Dernière version : v4.1.1 du 2026-09-26.**
- **Variantes** :
  - des **profils** `profile_<nom>/` choisis à la compilation avec `--input profile=<nom>` ;
  - chaque profil est une configuration complète, sans héritage ;
  - le modèle fournit **cinq profils : en, de, fr, it, zh**.
- **ATS** : la section `[inject]` de `metadata.toml` est **désactivée par défaut**.
  - `injected_keywords_list` insère des mots-clés en texte caché (2 pt, blanc).
  - Le fichier avertit que certains éditeurs d'ATS et recruteurs détectent le texte caché et peuvent rejeter la candidature, et que le texte reste visible par copier-coller ou « tout sélectionner ».
  - **`custom_ai_prompt_text`** est un prompt caché destiné aux filtres par IA. Il est décrit comme expérimental, avec les mêmes risques, et le fichier ajoute que les modèles récents l'ignorent largement.
  - **Correction** : `inject_ai_prompt` a été **supprimé depuis la v3**. La compilation s'arrête avec un message de migration ; il n'est pas seulement « déprécié depuis la v4 ».
  - Les mots-clés sont aussi écrits ouvertement dans la métadonnée PDF « Keywords », et le titre et l'auteur du PDF sont toujours renseignés.
- **À reprendre** : les profils et les métadonnées PDF. **À rejeter** : le texte caché et le prompt caché.

### 2.5 haenlonns/resume-template (Typst)
- **URL** : https://github.com/haenlonns/resume-template (0 ★, pas de licence, créé et poussé le 2026-09-13).
- **Fonctionnement** : un `profile.json` contient tous les faits ; un fichier `.typ` choisit quoi afficher avec `#resume.entries(data.sections.at("work"), ids: ("acme", "previous-role"))`. Le paramètre `ids` est optionnel ; sans lui, toutes les entrées s'affichent dans l'ordre du JSON.
- **Intérêt** : c'est exactement le principe « base + sélection d'identifiants », côté rendu.

### 2.6 Rendu Typst dans le navigateur
- **URL** : https://github.com/Myriad-Dreamin/typst.ts (Apache-2.0, 1 228 ★, push le 2026-09-24).
- **Contenu** : compile Typst en WASM dans le navigateur. Les paquets npm `@myriaddreamin/typst.ts`, `@myriaddreamin/typst-all-in-one.ts` et `@myriaddreamin/typst.react` existent, en version 0.7.0.
- **Intérêt** : permettrait une page web sans serveur qui produit un PDF Typst.

---

## 3. Projets « CV maître + sélection, tags ou variantes »

| Projet | Principe | Remarques |
|---|---|---|
| **resume-bricks**<br>https://github.com/tsubasakoizumi1122/resume-bricks | Des briques YAML (`blocks/`) et une mise en page par CV (`resumes/`). Interface en 3 colonnes : bibliothèque filtrable, assemblage par glisser-déposer, aperçu fidèle à l'impression avec repères de saut de page. **Choix des puces par CV avec un compteur « 3/4 ▾ »**. Fonction « Tailor to job » : choisit les blocs et les puces, peut couper pour tenir sur une page, **signale les exigences non couvertes**. | PolyForm Noncommercial 1.0.0 (GitHub affiche `NOASSERTION`), 0 ★, créé le 2026-09-30. Node 18.17+, JavaScript sans framework, sans étape de build. PDF par la fenêtre d'impression, export Markdown, import PDF, Word et PowerPoint (unpdf, mammoth, jszip). Rien sur l'ATS. **Le plus proche de votre idée.** |
| **custom-resume**<br>https://github.com/hcstephencheung/custom-resume | Spécification maître en YAML, chaque item avec un `id` et des `tags` ; **plusieurs variantes de résumé** ; plus de puces que nécessaire. L'adaptation, **encore sur la feuille de route**, doit rendre une sélection d'identifiants traçable jusqu'à vos propres mots. | 0 ★, pas de licence, créé le 2026-09-30, push le 2026-10-03. Python, Pydantic, Jinja2. Modèle **à deux colonnes** (barre latérale de 25 %) décrit comme « ATS-parseable » : nom en premier dans l'ordre de lecture, libellés de contact en texte, ni icônes, ni barres de compétences, ni images. Sorties HTML et Markdown ; PDF prévu. |
| **resumetailor**<br>https://github.com/rresults/resumetailor | Résultats tagués avec des poids numériques ; filtrage et tri par poids. Non revérifié en détail. | 4 ★, pas de licence, créé le 2017-12-09, dernier push le 2017-12-10. R, Pandoc, LaTeX : **stack obsolète**, mais l'idée reste valable. |
| **Johnesco/resume**<br>https://github.com/Johnesco/resume | JSON et JavaScript sans framework ; **7 profils prédéfinis** (qa-lead, qa-ai, accessibility, business-analyst, instructor, cs, all) qui filtrent par tags ; paramètres d'URL (`profile`, `years`…) ; page `customize.html` qui génère l'URL ; **page `plaintextresume.html` en texte brut pour l'ATS**. | 0 ★, pas de licence, push le 2026-09-28. Impression en une colonne, titres standard. |
| **zhiweio/resume-as-code**<br>https://github.com/zhiweio/resume-as-code | Chronologie YAML unique (méthode STAR pour l'expérience, 3W pour les projets). Des agents IA génèrent un CV ciblé par offre en 10 étapes (recherche sur l'entreprise, analyse de l'offre, génération, « dé-IA-isation », relecture, révision). Éditeur Monaco avec aperçu A4 et export PDF par Puppeteer. | MIT, 91 ★, créé le 2025-12-30, push le 2026-10-02. Les identifiants stables, les drapeaux de visibilité et la mise à l'échelle des espacements de 0,7 à 1,3 × **ne sont pas visibles dans le README** : non vérifiés. |
| **resume-optimization-tool**<br>https://github.com/timrking11-blip/resume-optimization-tool | SQLite en couches, tags avec synonymes, score pondéré, traçabilité jusqu'aux identifiants. Non revérifié en détail. | 0 ★, pas de licence, créé le 2026-09-25. Très sur-dimensionné. |
| **reeesume**<br>https://github.com/strokati/reeesume | Base maître ; l'IA choisit les éléments et justifie ses choix. Non revérifié en détail. | GPL-3.0, 6 ★, push le 2026-09-23. |
| **HackMyResume**<br>https://github.com/hacksalot/HackMyResume | Format FRESH ; conversion depuis et vers JSON Resume ; sorties multiples. | MIT, 9 331 ★. **Dernier commit sur `master` le 2018-02-14 : obsolète.** L'API indique un push le 2022-04-03, sans commit sur la branche principale. |
| jobfinder<br>https://github.com/mavillemavie/jobfinder | CV maître YAML, avec la règle « never claim what the master doesn't ». | Le dépôt existe (MIT, 0 ★, push le 2026-10-05). **Contenu non ouvert**, règle non vérifiée. |
| Article « The Overengineered Resume » (ktema.org, nov. 2023) | JSON Resume, rendu par Zola puis WeasyPrint, variantes par branches Git. | Non revérifié. Montre que les branches Git sont peu pratiques pour gérer des variantes. |

---

## 4. Outils de contrôle ATS (pour l'auto-vérification)

- **rxresu.me/ats-checker** : voir 1.1. Analyse locale par PDF.js, six axes, avec l'avertissement explicite qu'il ne prédit pas l'issue d'une candidature.
- **Parseur OpenResume** : voir 1.2. Algorithme documenté, anglais et une colonne uniquement, AGPL.
- **`@jsonresume/ats-validator`** : voir 1.3. Dix vérifications sur le HTML, publié sur npm.
- **ats-screener** (https://github.com/sunnypatell/ats-screener) :
  - MIT, 167 ★, créé le 2026-02-20, push le 2026-10-01 ;
  - SvelteKit 5, analyse côté client, mammoth pour le DOCX, LLM Gemini Flash Lite ;
  - **simule six ATS** : Workday, Taleo, iCIMS, Greenhouse, Lever, SuccessFactors. Par exemple, Taleo en correspondance littérale, Lever avec racinisation, SuccessFactors avec normalisation par taxonomie ;
  - le README précise lui-même : « All scoring simulations are approximations ». Ce sont des hypothèses, pas les algorithmes réels.

---

## 5. Projets français et marché français

- **Hsn9403/cv-julien-hassan** (https://github.com/Hsn9403/cv-julien-hassan) :
  - README en français, 0 ★, pas de licence, push le 2026-10-04 ;
  - `cv_config.json` pour la France et `cv_config_us.json` pour US/UK : **une variante par marché** ;
  - Python avec PyMuPDF, Flask pour l'éditeur web ;
  - « texte sélectionnable, une seule colonne, pas de tableaux ni d'images » ; **ajustement automatique à une page**.
- **douzCv** (https://github.com/LEON007007/Generateur_cv) :
  - en français ; React 18, Vite, Zustand ; stockage LocalStorage et IndexedDB ; Gemini 2.5 Flash ;
  - « Simulateur de Score ATS en Temps Réel » ;
  - **« Tous droits réservés » : pas open source**, le code n'est pas réutilisable. Le nombre de modèles n'a pas été revérifié.
- **gabywald/CurriculumGenerator** : le dépôt existe (GPL-3.0, 6 ★, push le 2026-04-27). Le contenu (génération LaTeX multilingue) n'a pas été ouvert.
- **Europass** : https://github.com/J0ker98/europass-cv (CC-BY-4.0, 1 ★, créé le 2026-09-18).
  - Il fournit un **XSD non officiel**, des outils Node (`build-cv.mjs`, `extract-xml.mjs`, `check-import.mjs`) et de la documentation sur le format XML « Europass Candidate » (espaces de noms europass.eu, hr-xml.org/3, oagis/9, EURES).
  - L'éditeur officiel embarque un `attachment.xml` dans chaque PDF exporté.
  - Ce serait une cible d'export utile pour la fonction publique, l'UE ou EURES. Les affirmations ATS sur Europass trouvées sur des sites commerciaux ne sont pas vérifiées.
- **Locales françaises existantes** : YAMLResume (README français, locale `fr`), profil `profile_fr` de brilliant-CV, `locale` de RenderCV, interface française de Resume Matcher 1.3.
- **Hors France** : **BioBot** (https://batbrain9392.github.io/cv-builder/).
  - Le dépôt `batbrain9392/cv-builder` n'a **pas de licence** (0 ★, dernier push le 2026-04-12).
  - Il propose un export DOCX à une colonne. La stack n'a pas été revérifiée.
  - Le chiffre « plus de 90 % des grands employeurs utilisent un ATS » n'est pas sourcé chez BioBot. L'ordre de grandeur rejoint Jobscan, qui compte **97,4 % des Fortune 500 en 2026** (487 sur 500) en analysant les pages carrières. Ce chiffre concerne les **grandes entreprises américaines** et ne se transpose pas à la France.
- **Constat** : aucun projet français proposant la sélection par cases à cocher depuis une base n'a été trouvé. Aucune donnée publique fiable n'a été trouvée sur les ATS utilisés en France ni sur leur comportement d'analyse.

---

## 6. Tableau comparatif

| Projet | Licence | ★ (05/10/26) | Stack | Données | PDF | Sélection / variantes | ATS | Statut |
|---|---|---|---|---|---|---|---|---|
| Reactive Resume | MIT | 43 795 | React 19, Hono, PostgreSQL | JSON propriétaire, `hidden` par item | Forme (WASM), avant react-pdf, avant Chromium | Masquer section ou entrée ; copie complète par offre ; tags sur les documents | 17 modèles avec filtre ATS-safe, mode Check, checker pdf.js | Très actif, v6 au 04/10/26 |
| OpenResume | AGPL-3.0 | 8 912 | Next 13, Redux | État local du navigateur | react-pdf | Aucune | Une colonne imposée, parseur pdf.js | Stagnant (oct. 2024) |
| JSON Resume | MIT | 2 390 (schéma) / 4 713 (CLI) / 323 (monorepo) | Node | JSON v1.0.0, extensible au niveau des entrées (puces = chaînes) | Puppeteer (CLI, thèmes) | Aucune | `ats-validator` (10 vérifications) | Schéma et CLI archivés, monorepo actif |
| RenderCV | MIT | 17 702 | Python, Pydantic, Typst | YAML `cv/design/locale/settings` | Typst (PDF balisé) | Fichiers séparés, surcharges CLI, `bold_keywords` | Rapport : 20 PDF, 5 thèmes sur 9, 3 parseurs | v2.8 (mars 2026), pas de push depuis mai |
| YAMLResume | MIT | 1 541 | TS, Zod | YAML | XeLaTeX, HTML, DOCX, Markdown | Aucune | Aucune | Actif (v0.16.1) |
| Resume Matcher | Apache-2.0 | 28 585 | FastAPI, Next 16, LiteLLM | SQLite (v1.3) | Playwright Chromium | Réécriture IA depuis un CV | Score de mots-clés | Actif (v1.3, sept. 2026) |
| ResumeLM | AGPL-3.0 | 329 | Next 15, Supabase | PostgreSQL / JSONB | React PDF | Base puis version adaptée (IA) | Score ATS | Actif |
| Awesome-CV | LPPL-1.3c | 28 648 | XeLaTeX | .tex | XeLaTeX | Aucune | **Issue #137 ouverte depuis 2017** | Maintenu |
| basic-resume | Unlicense | 246 | Typst | .typ | Typst | Aucune | Se dit compatible ATS | Push mars 2026 |
| modern-cv | MIT (typst.toml) | 627 | Typst | .typ | Typst | Aucune | Icônes FontAwesome (risque) | Actif (dépôt déplacé vers ptsouchlos) |
| brilliant-CV | Apache-2.0 | 844 | Typst | .typ et .toml par profil | Typst | **Profils** (en, de, fr, it, zh) | Mots-clés et prompt cachés en option (à éviter) | Actif (v4.1.1) |
| resume-bricks | PolyForm NC | 0 | Node, JS sans framework | Briques YAML | Impression navigateur | **Glisser-déposer, puces par CV, adaptation à une offre** | Rien | Nouveau (sept. 2026) |
| custom-resume | aucune | 0 | Python, Pydantic, Jinja2 | YAML `id` + `tags` | HTML (PDF prévu) | **Sélection d'identifiants** (prévue), variantes de résumé | Deux colonnes dites « ATS-parseable » | Nouveau |
| Johnesco/resume | aucune | 0 | JavaScript sans framework | JSON + `tags` | Impression | **Profils par tags, paramètres d'URL** | Une colonne, texte brut | Actif |
| zhiweio/resume-as-code | MIT | 91 | Agents IA, Puppeteer | Chronologie YAML | Puppeteer | YAML par offre généré par IA | Implicite | Actif |
| resumetailor | aucune | 4 | R, Pandoc | YAML, tags avec poids | LaTeX | Filtre et tri par tags pondérés | Rien | Obsolète (2017) |
| HackMyResume | MIT | 9 331 | Node | FRESH / JSON Resume | wkhtmltopdf… | Aucune | Rien | **Obsolète (dernier commit 2018)** |
| cv-julien-hassan (FR) | aucune | 0 | Python, PyMuPDF, Flask | JSON | PyMuPDF | Un fichier par marché (FR/US) | Une colonne, une page | Récent |

---

## 7. Idées à emprunter

1. **Format interne riche, JSON Resume en échange.**
   - Ajouter un `id` stable et des `tags` à chaque entrée ; le schéma l'autorise.
   - Pour les **puces**, prévoir une structure propre, par exemple `bullets: [{id, text, tags, variants}]`. Le champ `highlights` de JSON Resume n'accepte que des chaînes : on le génère à l'export.
   - Prévoir des `variants` de formulation pour le résumé et les puces (custom-resume).
2. **Séparer la base de la sélection.**
   - Une candidature est un objet `{offre, date, idsCochés[], ordre, variantesChoisies, langue, modèle}`.
   - On ne met **jamais** de `hidden` dans la base.
   - Inspiré du paramètre `ids:` de haenlonns et de custom-resume. C'est ce qui manque à Reactive Resume, dont les copies divergent.
3. **Cases à cocher sur trois niveaux** : section, entrée, puce. Un compteur « 3/4 » par entrée (resume-bricks) et un ordre réglable par glisser-déposer.
4. **Préréglages par tags.** Un profil comme « Data » ou « Dev web » coche automatiquement selon les tags. Les tags peuvent porter des poids pour trier (resumetailor). La sélection peut se partager par paramètre d'URL (Johnesco).
5. **Coller une offre.**
   - Extraire ses mots-clés et afficher lesquels sont couverts ou absents dans la base.
   - **Suggérer des puces à cocher** plutôt que réécrire, et **signaler les exigences non couvertes** (resume-bricks).
   - Un éventuel LLM ne fait que sélectionner, avec la règle « ne jamais affirmer ce que la base ne contient pas ».
   - Ajouter des synonymes de mots-clés.
6. **Mettre en gras les mots-clés de l'offre** dans le CV généré (`bold_keywords` de RenderCV).
7. **Règles de rendu ATS imposées par le code**, par précaution :
   - une seule colonne, ordre du DOM égal à l'ordre de lecture ;
   - titres standard en français (« Expérience professionnelle », « Formation », « Compétences », « Langues », « Certifications ») ;
   - coordonnées en texte dans le corps, avec libellés, sans icônes ;
   - ni tableaux, ni barres de niveau, ni texte dans des images ;
   - dates au même format, sur la ligne de l'entrée ;
   - police standard embarquée ;
   - **ni texte caché, ni prompt caché**.
8. **Moteur PDF produisant du vrai texte** : Typst compilé dans le navigateur (typst.ts), HTML avec CSS d'impression (impression navigateur, ou Forme, encore très jeune), ou react-pdf. Typst a l'avantage d'un PDF balisé et d'un test ATS publié (RenderCV), limité à 5 thèmes et à des parseurs du marché.
9. **Panneau « ce que voit l'ATS ».** Ré-extraire le PDF généré avec pdf.js et afficher le texte brut, les sections détectées, l'email, le téléphone et les dates. Réimplémenter les 4 étapes d'OpenResume adaptées aux titres français, sans copier le code AGPL.
10. **Vérification automatique du HTML** avant export, inspirée des 10 vérifications d'`@jsonresume/ats-validator` (MIT, réutilisable).
11. **Exports multiples** : PDF, **DOCX** (certains recruteurs le demandent), texte brut ou Markdown (Johnesco, RenderCV), JSON pour la sauvegarde, et éventuellement Europass XML.
12. **Indicateur « tient sur une page »** : repères de saut de page (resume-bricks), ajustement de la densité, des marges et de la taille du texte (Reactive Resume), ajustement automatique (cv-julien-hassan), blocs indivisibles.
13. **Local d'abord** : localStorage ou IndexedDB avec import/export JSON (OpenResume), ou fichiers versionnés dans Git. Pas de compte.
14. **Validation par schéma** (Zod ou JSON Schema) avec autocomplétion dans l'éditeur de la base (RenderCV, YAMLResume).
15. **Multilingue FR/EN** : champs traduisibles dans la base, libellés de section par locale, une variante par marché (cv-julien-hassan, profils de brilliant-CV).
16. **Métadonnées et nom de fichier** : titre et auteur du PDF renseignés, mots-clés en clair dans la métadonnée `Keywords` (brilliant-CV), nom de fichier du type `NOM_Prenom_CV_Entreprise.pdf`.
17. **Historique des candidatures** : figer la sélection, l'offre et le PDF à chaque candidature, avec un statut (Reactive Resume, Resume Matcher).
18. **Licences** :
    - réutilisables : MIT, Apache ou Unlicense (Reactive Resume, RenderCV, JSON Resume et `ats-validator`, typst.ts, basic-resume, brilliant-CV) ;
    - à ne pas copier : AGPL (OpenResume, ResumeLM), PolyForm NC (resume-bricks), GPL-3.0 (reeesume, CurriculumGenerator, sauf si votre projet est lui-même en GPL), code sans licence (custom-resume, Johnesco, haenlonns…) et code « tous droits réservés » (douzCv).

---

## 8. Éléments obsolètes ou à surveiller

- **HackMyResume** : aucun commit sur `master` depuis le 2018-02-14.
- **resumetailor** : 2017, stack R et LaTeX.
- **OpenResume** : aucun push depuis le 2024-10-29, Next.js 13.
- **`jsonresume/resume-cli` et `resume-schema`** : archivés, dernier push le 2026-06-12 ; développement déplacé dans le monorepo.
- **Reactive Resume** : dépôt déplacé ; impression par Chromium puis react-pdf remplacées par Forme en v6 ; la v6 casse la compatibilité ; Forme est un dépôt créé le 2026-10-01.
- **RenderCV** : les mentions « génère du LaTeX » sont dépassées. Aucun push depuis le 2026-05-01. Le rapport ATS ne couvre pas les 4 thèmes récents.
- **Resume Matcher** : le README n'est pas à jour (TinyDB, langues, modèles) par rapport à la v1.3.
- **brilliant-CV** : `inject_ai_prompt` est supprimé depuis la v3, remplacé par `custom_ai_prompt_text`, toujours présent.
- **modern-cv** : dépôt déplacé vers `ptsouchlos/modern-cv`.
- **Awesome-CV et modern-cv** : leurs icônes FontAwesome restent un risque connu pour l'ATS.
- **Non vérifié dans ce contrôle** : le contenu détaillé de ResumeLM, resumetailor, resume-optimization-tool, reeesume, jobfinder et CurriculumGenerator ; la mise à l'échelle 0,7 à 1,3 × de zhiweio ; l'article de ktema.org ; la feuille de route Typst de YAMLResume.

---

## Sources

Consultées lors de la vérification :
- API GitHub (via `gh api`), `repos/...` pour tous les dépôts cités, plus `releases`, `issues/137`, `commits`, `contents` et `readme`
- https://github.com/reactive-resume/reactive-resume/releases/tag/v6.0.0
- https://raw.githubusercontent.com/reactive-resume/reactive-resume/main/README.md
- https://docs.rxresu.me/guides/whats-new-in-v6
- https://rxresu.me/ats-checker
- https://rxresu.me/schema.json
- https://github.com/amruthpillai/forme
- https://github.com/xitanggg/open-resume
- https://www.open-resume.com/resume-parser
- https://raw.githubusercontent.com/jsonresume/resume-schema/master/schema.json
- https://github.com/jsonresume/jsonresume.org/tree/master/packages/ats-validator
- https://registry.npmjs.org/@jsonresume/ats-validator
- https://registry.npmjs.org/resume-cli
- https://docs.rendercv.com/ats_compatibility/
- https://pypi.org/pypi/rendercv/json
- https://github.com/srbhr/Resume-Matcher/releases/tag/v1.3.0
- https://raw.githubusercontent.com/srbhr/Resume-Matcher/main/README.md
- https://raw.githubusercontent.com/posquit0/Awesome-CV/master/awesome-cv.cls
- https://shapecv.com/blog/latex-resume-ats-friendly-test
- https://raw.githubusercontent.com/yunanwg/brilliant-CV/main/template/profile_en/metadata.toml
- https://raw.githubusercontent.com/yunanwg/brilliant-CV/main/src/lib.typ
- https://raw.githubusercontent.com/yunanwg/brilliant-CV/main/docs/web/docs/migration.md
- https://github.com/ptsouchlos/modern-cv (README, typst.toml)
- https://github.com/tsubasakoizumi1122/resume-bricks
- https://github.com/hcstephencheung/custom-resume
- README de haenlonns/resume-template, Johnesco/resume, zhiweio/resume-as-code, sunnypatell/ats-screener, Hsn9403/cv-julien-hassan, LEON007007/Generateur_cv, J0ker98/europass-cv, yamlresume/yamlresume
- https://registry.npmjs.org/@myriaddreamin/typst.ts (et `typst-all-in-one.ts`, `typst.react`)
- https://www.jobscan.co/blog/fortune-500-use-applicant-tracking-systems/
- https://www.jobscan.co/blog/ats-formatting-mistakes/

Reprises du rapport initial, non revérifiées : https://ktema.org/articles/the-overengineered-resume/, https://typst.app/universe/package/basic-resume/, https://yamlresume.dev/fr, https://kudoswall.com/resume-examples/europass/, https://github.com/AjayLuhach/resume-forge, https://github.com/topics/resume-as-code.

---

## Vérification

| # | Affirmation contrôlée | Verdict | Source / commentaire |
|---|---|---|---|
| 1 | Reactive Resume : dépôt déplacé, MIT, 43 795 ★, v6.0.0 le 2026-10-04, v5.3.2 le 2026-09-26, moteur Forme WASM sans navigateur | **Confirmé** | API GitHub (redirection, releases) ; notes de la v6.0.0 ; dépôt amruthpillai/forme (créé le 2026-10-01, 0 ★, ajouté comme risque) |
| 2 | Reactive Resume : « filtre ATS-safe (17 modèles) », tags en bibliothèque, import Word nécessitant l'IA, exports PDF, DOCX, Markdown et JSON, stack Hono, Drizzle et React 19 | **Nuancé** | README : 17 modèles **au total** avec des filtres une colonne, deux colonnes et ATS-safe. Le reste est confirmé. |
| 3 | rxresu.me/ats-checker : pdf.js local, 6 axes, avertissement « pas vos chances d'obtenir le poste » | **Confirmé** | https://rxresu.me/ats-checker |
| 4 | OpenResume : AGPL-3.0, 8 912 ★, dernier push le 2024-10-29, algorithme en 4 étapes, une colonne, anglais | **Confirmé** (barème du nom complété) | API GitHub ; page du parseur ; la mention Greenhouse et Lever figure dans le README, pas sur la page du parseur |
| 5 | JSON Resume : `additionalProperties: true`, donc on peut ajouter `id`/`tags` **à chaque puce** | **Réfuté pour les puces**, confirmé pour les entrées | `schema.json` : `highlights.items` est `{type: string}`. Idée n° 1 corrigée. |
| 6 | `resume-schema` et `resume-cli` archivés (2026-06-12), monorepo actif, `@jsonresume/ats-validator` avec 10 vérifications et score de A à F | **Confirmé** | API GitHub ; README du paquet ; npm (v0.3.0). Étoiles du CLI : 4 713 via l'API. Environ 55 entrées dans `packages/themes` (et non 52). |
| 7 | RenderCV : v2.8 le 2026-03-21, Python 3.12 ou plus, Typst, 9 thèmes ; rapport ATS : 20 PDF, 99,1 %, 3 parseurs via Eden AI, PDF balisé | **Confirmé avec nuances** | API, PyPI, rapport : seuls 5 thèmes sur 9 sont testés ; le **lieu** n'est pas extrait par Klippa et l'**établissement** est partiel chez Affinda ; le rapport n'a pas de section « limites » |
| 8 | Resume Matcher v1.3.0 « Crescendolls » le 2026-09-06, passage à SQLite, interface française, Playwright, quatre modèles, aucun garde-fou de véracité | **Nuancé** | Notes de version : trois modèles ajoutés (LaTeX, Clean, Vivid), « Strengthen checks around original information ». Le README est obsolète (TinyDB, langues). |
| 9 | Awesome-CV : FontAwesome 6, issue #137 ouverte depuis le 2017-06-03 | **Confirmé** | `awesome-cv.cls` (`fontawesome6`) ; API (issue ouverte, 10 commentaires) |
| 10 | ShapeCV : « 80 % des tests » d'échec pour Awesome-CV, 98,2 % pour Jake's Resume, moins de 35 % pour Deedy-CV et AltaCV | **Nuancé** (source commerciale, non vérifiable) | Les 80 % concernent Taleo et Workday et les macros `\aEnvelope` / `\aPhone` sans libellé ; nombre de tests non donné ; mise à jour le 2026-09-09 |
| 11 | brilliant-CV : `[inject]` en texte caché, désactivé par défaut, avec avertissements ; profils en, fr, zh ; « v4 » ; `inject_ai_prompt` déprécié depuis la v4 | **Partiellement réfuté** | `metadata.toml` confirme l'injection et les avertissements. Profils : **en, de, fr, it, zh**. Version **v4.1.1**. `inject_ai_prompt` est **supprimé depuis la v3** (`lib.typ`). `custom_ai_prompt_text`, un prompt caché, existe toujours. |
| 12 | YAMLResume v0.15, Typst sur la feuille de route | **Réfuté / non vérifiable** | API : **v0.16.1** (2026-09-20). Typst absent du README. 10 langues sur 12 locales confirmées. |
| 13 | modern-cv : `DeveloperPaul123/modern-cv`, MIT selon le README, v0.10.0 | **Nuancé** | Le dépôt est désormais `ptsouchlos/modern-cv` ; MIT déclaré dans `typst.toml` ; release 0.10.0 du 2026-04-20, `typst.toml` en 0.11.0 ; FontAwesome confirmé |
| 14 | HackMyResume : dernier commit le 2018-02-14, environ 9,3 k ★ | **Confirmé** | API commits (2018-02-14) ; 9 331 ★ ; un push sans commit en 2022 |
| 15 | resume-bricks et custom-resume : créés le 2026-09-30, 0 ★, fonctions décrites | **Confirmé** (précisé) | README : resume-bricks importe aussi le .pptx et son adaptation à une offre est implémentée ; l'adaptation de custom-resume reste sur la feuille de route |
| 16 | ats-screener : six ATS simulés, approximations assumées | **Confirmé** | README (avertissement « All scoring simulations are approximations ») |
| 17 | « Consensus ATS 2025-2026 net » (coordonnées jamais en en-tête, une colonne…) | **Nuancé** | Ce sont des recommandations d'éditeurs (Jobscan : « many ATS parsers », « most ATS »), pas des mesures universelles ; aucune donnée sur les ATS en France. À garder comme règles de précaution. |
| 18 | BioBot : « plus de 90 % des grands employeurs utilisent un ATS », non sourcé | **Nuancé** | Jobscan 2026 : 97,4 % des Fortune 500 (US, par analyse des pages carrières), non transposable à la France |
| 19 | douzCv « Tous droits réservés » ; Europass `attachment.xml` | **Confirmé** | README de douzCv ; README de J0ker98/europass-cv (XSD **non officiel**) |
| 20 | typst.ts : 1,2 k ★, paquets npm | **Confirmé** | API (1 228 ★) ; npm 0.7.0 pour les trois paquets |
| 21 | zhiweio : identifiants stables, drapeaux de visibilité, mise à l'échelle de 0,7 à 1,3 × | **Non vérifiable** | Absent du README ; MIT, 91 ★, Monaco, Puppeteer, pipeline en 10 étapes confirmés |
| 22 | « Aucun projet français ne propose la sélection par cases à cocher » ; « aucun projet établi ne fait exactement ça » | **Non vérifiable** (absence de preuve) | Recherche non exhaustive ; resume-bricks s'en approche fortement |