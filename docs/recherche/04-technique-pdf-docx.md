# Choix techniques pour générer un CV PDF/DOCX lisible par les ATS depuis une page web

*Recherche du 2026-10-05, puis vérification des faits le même jour. Les étoiles GitHub sont celles affichées lors de la consultation. Ce qui n'a pas pu être vérifié porte la mention « non vérifié ». La section « Vérification » à la fin donne le verdict de chaque affirmation contrôlée et sa source.*

## 0. En bref

- **Ce qui compte, c'est la couche texte du PDF, pas l'apparence.** Il faut :
  - des glyphes reliés à l'Unicode (ToUnicode) ;
  - de vrais caractères espace ;
  - un ordre de lecture linéaire ;
  - aucune police d'icônes ;
  - aucun texte rendu en image ;
  - aucun espacement de lettres.

  Il vaut aussi mieux éviter les polices Type 3, comme le montre un cas documenté.
- **Tous les moteurs ont des pièges documentés en 2024-2026 :**
  - **Chrome/Skia** (impression ou Puppeteer/Playwright) remplace les espaces par U+200B. Avec poppler, on obtient des mots collés. L'ampleur dépend de la police : un projet unique mesure 29,6 % de mots endommagés avec Source Sans 3.
  - **LaTeX** a ses pièges de ligatures et d'accents OT1.
  - **react-pdf** a eu un bug de ligatures.
  - **html2pdf.js** produit une image. jsPDF `html()` produit au contraire du vrai texte vectoriel, mais avec un rendu approximatif.
- **Typst (≥ 0.14) : c'est la mesure publique la plus complète trouvée.** RenderCV obtient 20 PDF corrects sur 20 et 99,1 % de précision d'extraction. Mais ce rapport est **publié par le projet lui-même et ne compare pas d'autres moteurs**. Typst produit des PDF tagués par défaut et tourne dans le navigateur via WASM (typst.ts).
- **Nouveau (04/10/2026) : Reactive Resume v6 a abandonné @react-pdf/renderer pour Forme.** Forme est un moteur Rust/WASM qui produit des PDF tagués par défaut. C'est une piste à évaluer, mais le projet est jeune.
- **Il faut tester en CI avec plusieurs extracteurs.** Un test avec pdf.js seul ne détecte pas les mots collés que produit poppler.
- **Aucune mesure trouvée ne porte sur les ATS courants du marché français.** Les seuls tests commerciaux publics (Affinda, Extracta, Klippa via Eden AI) sont des parseurs génériques.

---

## 1. Ce que « lisible par un ATS » veut dire techniquement

Les ATS convertissent le PDF en texte brut avant de l'analyser. C'est ce qu'affirme le [Reactive Resume ATS Checker](https://rxresu.me/ats-checker), qui reproduit cette étape avec PDF.js dans le navigateur. *Nuance : cette affirmation vient d'un outil, pas d'une étude des ATS. Certains parseurs ajoutent de l'OCR ou une analyse visuelle de la mise en page (non vérifié). Le principe « couche texte propre d'abord » reste la seule hypothèse prudente.*

| Piège | Effet mesuré / documenté | Source |
|---|---|---|
| **Chrome/Skia : espaces** | Skia dessine chaque mot comme un objet texte séparé, entre deux glyphes d'espace enveloppés dans `/Span <</ActualText <FEFF200B>>>`. PyMuPDF lit alors U+200B au lieu d'une espace, et les mots sont collés. Issue ouverte le 25/09/2026, toujours ouverte. | [pdf2docx #379](https://github.com/ArtifexSoftware/pdf2docx/issues/379) |
| **Chromium (Playwright, Linux) + poppler `pdftotext`** | Mesure d'un seul projet (Talentrah, générateur de CV à 65 gabarits ; issue du 30/09/2026, ouverte). Taux de mots du corps endommagés avec Source Sans 3 : **29,62 % avec poppler**, contre 0,68 % avec pdf.js, 0,74 % avec pdfminer, 0 % avec MuPDF et 0,88 % avec PDFBox. `word-spacing: 0.05em` ramène poppler à 0,56–0,90 % selon le profil, mais 11 rendus sur 195 (5,6 %) prennent une page de plus. Avec `0.1em`, on tombe à 0 %, mais 21 rendus gagnent une page. Le correctif n'a pas été adopté. | [Talentrah #597](https://github.com/Bayo-1987/Claude-Talentrah/issues/597) |
| **Polices variables dans Chrome** | Chrome embarque chaque instance en Type 3. Selon dev.to, le texte reste sélectionnable ; le problème principal concerne les validateurs PDF/A. Mais dans un cas réel (Inter variable + `letter-spacing: -0.5pt`), le nom et les titres en gras sont extraits sans espaces avec `pdftotext -raw` (« GiovanniTrovato »). Correctif : TTF statiques et aucun letter-spacing. | [cv-giovanni #143](https://github.com/PigLardLord/cv-giovanni/issues/143) (fermée), [dev.to/accreditly](https://dev.to/accreditly/how-html-to-pdf-conversion-actually-works-rendering-engines-text-objects-and-fonts-103j) (03/09/2026) |
| **Letter-spacing sur les titres** | Selon un site commercial, avec +2 pt, 4 extracteurs sur 5 ne reconnaissent plus les sections (« E X P E R I E N C E ») et le choix de police ne change rien. **Non vérifiable** (page bloquée en HTTP 429). Le conseil reste cohérent avec le cas cv-giovanni. | [resumeatlas.io](https://resumeatlas.io/ats-friendly-fonts) |
| **Ligatures fi/fl/ff** | pdfTeX rend fi, fl et ff comme un seul glyphe. Sans mapping correct, « Financial » ne contient plus la suite « fi ». | [atsverification.com, 22/08/2026](https://atsverification.com/blog/latex-resume-ats-friendly/) (service commercial, Tanzeel Labs) |
| **Polices d'icônes (FontAwesome)** | Elles sont extraites comme des caractères parasites collés à l'e-mail ou au téléphone. | idem |
| **Césure en fin de ligne, tirets U+2010, absence de vrais espaces** | Cas réel Awesome-CV avec fontspec/HarfBuzz : « Mostrecentlyfocused », **0 caractère espace** dans le PDF (471 après correction), 17 tirets U+2010 ou césures conditionnelles. PR fusionnée le 30/09/2026 : 0 erreur sur 6 extractions (poppler raw et layout, pdfminer, PyMuPDF, pypdf, pdf.js). | [cinnamennen/resume PR #1](https://github.com/cinnamennen/resume/pull/1) |
| **Texte rendu en image** | html2pdf.js (html2canvas + jsPDF) place une image dans le PDF : le texte n'est ni sélectionnable ni cherchable. C'est indiqué dans le README, section « Known issues ». | [html2pdf.js README](https://github.com/eKoopmans/html2pdf.js) |
| **Mises en page en colonnes** | Les lignes des colonnes gauche et droite s'entrelacent. | non vérifié ici (issues GitHub vues en recherche), à tester soi-même |

Je n'ai trouvé **aucune source montrant que les ATS commerciaux lisent l'arbre de balises** d'un PDF tagué. Le tagging sert surtout à l'accessibilité. Son effet sur les ATS reste une hypothèse.

---

## 2. Comparatif des moteurs de rendu

### A. Impression navigateur (`window.print()` + CSS `@media print` / `@page`) et Paged.js

- **Couche texte** : c'est le moteur Skia de Chrome, donc les pièges U+200B, mots collés et Type 3 décrits plus haut. Le résultat dépend aussi du navigateur et des réglages du dialogue d'impression.
- **En-têtes et pieds de page de Chrome** : Chrome ajoute ses propres en-têtes et pieds (URL, date) s'il reste de la place, *même si la page définit déjà des margin boxes* ([Chrome blog, 30/10/2024](https://developer.chrome.com/blog/print-margins)). Ce texte parasite atterrit dans la couche texte. Pour l'éviter : `@page { margin: 0 }` (ou une marge trop petite pour les accueillir), ou demander à l'utilisateur de décocher l'option.
- **PDF tagué** : « Enregistrer en PDF » de Chrome produirait un PDF tagué depuis Chrome 85, avec un retrait en 2022 puis un rétablissement dans Chrome 106 (**non vérifié** : pdfa.org a renvoyé HTTP 403).
- **Firefox et Safari** : aucune mesure fiable trouvée (non vérifié).
- **Typographie** : CSS complet. Depuis Chrome 131, les 16 margin boxes `@page` et les compteurs `page`/`pages` sont natifs. Paged.js devient donc moins nécessaire pour un CV d'une ou deux pages.
- **Paged.js** : polyfill W3C de pagination avec prévisualisation. Le projet est en refonte : « paged.js neue », avec un passage direct à la 2.0 (billet du 17/05/2025 sur [pagedjs.org](https://pagedjs.org/posts/en/a-new-chapter-in-paged.js-life/) ; avancement actuel non vérifié). C'est toujours l'impression du navigateur qui produit le PDF, donc la couche texte reste la même.
- **Français** : bon, avec des polices web.
- **Poids** : nul.
- **Hors ligne / sans serveur** : oui, mais le PDF n'est pas déterministe.

### B. Génération côté client

**@react-pdf/renderer** ([16,8k étoiles](https://github.com/diegomura/react-pdf))
- Produit du vrai texte. La mise en page est en flexbox (Yoga), pas en CSS complet.
- **Polices** : TTF ou WOFF uniquement. Les polices variables ne fonctionnent pas ([react-pdf.org/fonts](https://react-pdf.org/fonts)).
- **Césure automatique par défaut** (`hyphenationPenalty` à 100 en texte justifié, 600 sinon). Pour la désactiver : `Font.registerHyphenationCallback(w => [w])` ou `hyphenationPenalty={Infinity}`.
- **Bug de ligatures avec `Font.register`** : « 123ff456fi987 » devient « 123f456f987 » au copier-coller (v4.1.6, [#3009](https://github.com/diegomura/react-pdf/issues/3009), fermée ; version corrective non indiquée). `fontFeatureSettings` est évoqué comme piste, sans confirmation.
- **PDF tagué** : aucun support mentionné dans le README (non vérifié au-delà).
- **Utilisateurs** :
  - **Reactive Resume v5.1.0** (7 mai 2026) l'a adopté en abandonnant Browserless/headless Chrome, avec un aperçu pdf.js rendu depuis le même arbre ([release v5.1.0](https://github.com/reactive-resume/reactive-resume/releases/tag/v5.1.0)). **Mais Reactive Resume v6.0.0 (04/10/2026) l'a remplacé par Forme** (voir ci-dessous).
  - **OpenResume** ([8,9k étoiles](https://github.com/xitanggg/open-resume)) l'utilise aussi, mais ce dépôt est **inactif : dernier commit le 29/10/2024**.

**Forme** (`@formepdf/core`, `@formepdf/react` ; [danmolitor/forme](https://github.com/formepdf/forme), 216 étoiles, MIT) *(ajout issu de la vérification)*
- Moteur de rendu écrit en Rust et compilé en WASM. Il pagine des PDF dans le processus, sans navigateur headless. On l'alimente en HTML/CSS ou avec des composants React, Svelte, Vue ou Preact.
- **Selon le README :**
  - PDF tagués par défaut ;
  - PDF/UA-1 « vérifié » avec veraPDF sur un corpus de 9 documents ;
  - PDF/A ;
  - mise en forme OpenType (GSUB/GPOS) ;
  - coupure de lignes Knuth-Plass ;
  - césure automatique en plus de 35 langues, **à désactiver pour un CV**.
- **Adopté par Reactive Resume v6.0.0** : `packages/pdf` dépend de `@formepdf/core` et `@formepdf/react` 0.27.0, et `pdfjs-dist` 6.4.299 sert à l'aperçu. Les notes de version annoncent un meilleur Unicode et une meilleure gestion des ligatures et de la pagination.
- **Limites** : projet jeune (0.x, 216 étoiles). Aucune mesure publique d'extraction ATS trouvée. Taille du WASM non mesurée.

**pdfmake** (0.3.11, API à base de promesses, `pdfMake.addFonts`, police Roboto par défaut via un VFS)
- Repose sur pdfkit (`^0.19.1`).
- Ancien bug pdfkit : au-delà de 256 caractères uniques, le CMap ToUnicode déclarait un mauvais nombre de plages, et PDFium (Chrome/Edge) rendait du texte illisible au copier-coller ([pdfkit #1659](https://github.com/foliojs/pdfkit/issues/1659)). **Corrigé dans pdfkit 0.18.0** (15/03/2026), donc absent de pdfmake 0.3.11. Il suffit de vérifier la version résolue de pdfkit.
- Mise en page déclarative assez limitée pour un rendu soigné.

**jsPDF** ([31,3k étoiles](https://github.com/parallax/jsPDF))
- **Version** : 4.2.1 (17 mars, 2026 selon libhunt). Les versions 4.0.0 à 4.2.1 corrigent plusieurs vulnérabilités : traversée de chemin dans la build Node, injections PDF/AcroForm/XMP, déni de service sur GIF et BMP.
- **Polices** : les 14 polices standard sont « limitées au codepage ASCII » (README). Il faut une TTF personnalisée pour le français.
- Placement manuel par coordonnées.
- **`html()`** : passe par html2canvas, mais **dessine sur le `context2d` de jsPDF, donc produit du texte vectoriel et non une image** (source `src/modules/html.js`). C'est html2pdf.js qui rastérise. `html()` reste **déconseillé** pour un CV : fidélité CSS approximative et polices à intégrer manuellement. Qualité d'extraction non mesurée.
- Problème ancien de texte non copiable avec des polices personnalisées ([#2148](https://github.com/parallax/jsPDF/issues/2148), 2018, fermé).

### C. Rendu headless côté serveur (Puppeteer / Playwright `page.pdf`)

- Même moteur Skia que Chrome, donc **mêmes pièges** sur les espaces et le Type 3. La mesure Talentrah vient justement de Playwright/Chromium sur `ubuntu-latest`. En revanche, le rendu est déterministe : version de Chromium figée et options contrôlées.
- **Puppeteer** ([pptr.dev](https://pptr.dev/api/puppeteer.pdfoptions)) :
  - `tagged` vaut maintenant **`true` par défaut** (et n'est **pas** marqué expérimental) ;
  - `outline` vaut `false` et **c'est lui qui est expérimental** ;
  - `waitForFonts` vaut `true` ;
  - `preferCSSPageSize` vaut `false` par défaut.
  
  L'option `tagged` avait été ajoutée avec `false` par défaut ([commit](https://github.com/puppeteer/puppeteer/commit/031686339136873c555a19ffb871f7140a2c39d9), non ouvert) : les anciens articles qui disent « par défaut false » sont obsolètes.
- **Playwright** : `tagged` et `outline` existent depuis la v1.42 ([release v1.42.0](https://github.com/microsoft/playwright/releases/tag/v1.42.0)). `page.pdf` est réservé à Chromium. La valeur par défaut de `tagged` n'a pas pu être lue (doc tronquée), donc il faut la passer explicitement.
- **Poids** : un Chromium complet, donc un serveur ou un Node local. Inutile pour un outil mono-utilisateur, sauf **en CI pour tester un gabarit HTML**.
- **WeasyPrint** : son support PDF/UA était décrit comme « limité » avec des « problèmes fondamentaux » ([#2363](https://github.com/Kozea/WeasyPrint/issues/2363), ouverte le 24/01/2025, aujourd'hui fermée, travaux visant la v66). La citation « non garanti valide » n'a pas été retrouvée.

### D. Typst

- **0.14.0 (24/10/2025)** ([changelog](https://typst.app/docs/changelog/0.14.0/)) :
  - export PDF réécrit autour de la bibliothèque `krilla` ;
  - **PDF tagués par défaut** ;
  - PDF/UA-1 en option (PDF/UA-2 prévu) ;
  - tous les profils PDF/A (1b à 4e) ;
  - l'extraction de texte fonctionne même quand plusieurs caractères donnent le même glyphe ;
  - correction du mapping des artefacts de césure vers l'Unicode.
- **Versions suivantes** : 0.14.1 (03/12/2025) et 0.14.2 (12/12/2025). **0.15.0 (15/06/2026)** apporte les polices variables et le MathML en export HTML. **0.15.1** est sortie le 17/07/2026 ([releases](https://github.com/typst/typst/releases)).
- **Mesure ATS** : rapport de **RenderCV** (CV en YAML compilés avec Typst, [17,7k étoiles](https://github.com/rendercv/rendercv)).
  - 20 PDF : 4 CV × 5 thèmes (classic, moderncv, sb2nov, engineeringresumes, engineeringclassic).
  - Texte extractible, ordre correct, « zéro caractère corrompu ».
  - 99,1 % de précision moyenne avec pdftotext et avec PyMuPDF.
  - Affinda, Extracta et Klippa, interrogés via l'API Eden AI, ont extrait tous les champs principaux ([docs.rendercv.com](https://docs.rendercv.com/ats_compatibility/)).
  - **Limites** : rapport non daté, produit par le projet lui-même, limité aux thèmes RenderCV, sans comparaison avec d'autres moteurs et sans ATS du marché français.
- **Données natives** : `json()`, `yaml()`, `toml()`, `csv()` ([doc](https://typst.app/docs/reference/data-loading/)). Le gabarit peut lire directement le fichier de données.
- **Dans le navigateur, avec typst.ts** ([1,2k étoiles](https://github.com/Myriad-Dreamin/typst.ts), activement maintenu) :
  - **API** : `$typst.pdf({ mainContent })` via le bundle « all-in-one ». La version complète inclut les polices et le WASM et fonctionne hors ligne. La version lite les exclut et doit les charger à part, depuis un CDN ou une source configurée ([guide](https://myriad-dreamin.github.io/typst.ts/cookery/guide/all-in-one.html)).
  - **Versions** : **v0.7.0 (1er juin 2026) embarque Typst 0.14.2.** Les v0.8.0-rc1 à rc3 (juin) embarquent Typst 0.15.0-rc.1 ([releases](https://github.com/Myriad-Dreamin/typst.ts/releases)).
  - **Poids** : non documenté officiellement.
    - [Rustume #682](https://github.com/lgtm-hq/Rustume/issues/682) (28/07/2026) mesure **+16,4 Mo gzip** avec le moteur de rendu, environ 17,4 Mo au total. L'essentiel vient des polices embarquées de `typst-assets`. Une optimisation est estimée autour de 14 Mo.
    - [typsmthng PR #18](https://github.com/aaditagrawal/typsmthng/pull/18) (fusionnée le 02/10/2026) fait passer le compilateur WASM non compressé de **28,4 Mo à 24,6 Mo**.
    - Recommandation : bundle lite et uniquement vos propres polices.
  - **Exemple existant** : [render-my-cv](https://github.com/pdgramajo/render-my-cv) (React 19, Vite, TypeScript, typst.ts, PWA hors ligne, YAML RenderCV ; dépôt confidentiel à 0 étoile).
- **Français** : `#set text(lang: "fr")`. **Désactiver la césure** (`hyphenate: false`) pour éviter les mots coupés dans la couche texte. Par défaut (`auto`), elle ne s'active qu'en texte justifié.

### E. LaTeX

- **pdflatex** : ligatures sans ToUnicode, et accents OT1 composés en lettre + accent séparés (« é » extrait comme « e ´ »). Correctifs ([atsverification](https://atsverification.com/blog/latex-resume-ats-friendly/), [Overleaf French](https://www.overleaf.com/learn/latex/French), [ats-latex-resume](https://github.com/ashwingopalsamy/ats-latex-resume)) :
  - `\usepackage[T1]{fontenc}`, `lmodern` et `cmap` ;
  - ou `\input{glyphtounicode}\pdfgentounicode=1` ;
  - ou `microtype` avec `\DisableLigatures`.
- **xelatex/lualatex** : `fontspec` gère l'Unicode (`Ligatures=NoCommon` possible), **mais ce n'est pas une garantie**.
  - Dans le cas Awesome-CV, le PDF n'avait aucun vrai espace et contenait des U+2010, car HarfBuzz transforme « - » en U+2010.
  - Correctif : passer à **LuaLaTeX** (xelatex ne peut pas exécuter le correctif Lua), avec `Renderer=Node`, l'inserteur d'espaces de `tagpdf` (le tagging complet casserait les tableaux imbriqués d'Awesome-CV), sans césure et sans icônes ([PR #1](https://github.com/cinnamennen/resume/pull/1)).
- **Poids** : TeX Live, donc un serveur ou une installation locale. Des portages WASM existent (TeXlyre par exemple) mais n'ont pas été évalués. Peu adapté à un outil web léger.

### F. DOCX

- **docx (dolanmiu)** ([5,9k étoiles](https://github.com/dolanmiu/docx)) : API TypeScript déclarative qui fonctionne dans le navigateur (`Packer.toBlob`) et sous Node. Gère styles, puces, tableaux, liens et en-têtes. Le DOCX est du texte XML natif, donc **pas de problème de ToUnicode ni d'espaces**.
- **docxtemplater** : remplissage d'un modèle Word (`{placeholders}`, boucles, conditions) avec un cœur open source. Les images et le HTML sont des **modules payants**, parmi 19 modules vendus à l'unité ou en offres PRO/ENTERPRISE ([docxtemplater.com](https://docxtemplater.com/)).
- Conseil répandu mais non vérifié ici : ne pas placer les coordonnées dans l'en-tête ou le pied de page Word, et éviter les zones de texte.

### Tableau de synthèse

| Option | Couche texte ATS | Contrôle typo | Français | Poids / complexité | Hors ligne, sans serveur |
|---|---|---|---|---|---|
| `window.print` (Chrome) | Moyenne : U+200B, mots collés avec poppler (selon la police), Type 3 si police variable | CSS complet | OK | Nul | Oui, mais non déterministe |
| + Paged.js | idem | + pagination | OK | Faible ; projet en refonte | Oui |
| @react-pdf/renderer | Bonne une fois ligatures et césure désactivées | Flexbox | OK (TTF/WOFF) | Moyen ; React imposé | Oui |
| Forme (nouveau) | Tagué par défaut, PDF/UA-1 annoncé ; **aucune mesure ATS publique** | HTML/CSS ou composants | Césure à désactiver | WASM (poids non mesuré) ; projet jeune | Oui |
| pdfmake | Bonne (bug CMap pdfkit corrigé en 0.18) | Limité | OK (VFS) | Moyen | Oui |
| jsPDF `text()` | OK avec TTF ; `html()` = texte vectoriel mais rendu approximatif | Manuel | Police à ajouter | Faible, mais laborieux | Oui |
| html2pdf.js | **Image : à proscrire** | — | — | Faible | Oui |
| Puppeteer/Playwright | Comme Chrome, mais tagué et déterministe | CSS complet | OK | Lourd (Chromium) | Non (serveur ou CI) |
| **Typst CLI / typst.ts** | **Meilleure mesure publique trouvée** (auto-publiée) ; tagué, PDF/UA-1 | Très fin | OK | CLI léger ; WASM lourd (~14-25 Mo selon config.) | **Oui** (WASM mis en cache) |
| pdflatex | Pièges ligatures et OT1 (corrigeables) | Excellent | Piège OT1 | Lourd | Non |
| xe/lualatex | À vérifier (cas U+2010 et espaces absents) | Excellent | Bon | Lourd | Non |
| docx / docxtemplater | Excellente (texte natif) | Moyen | OK | Faible | Oui |

---

## 3. Données : schéma et stockage

### Schéma

**JSON Resume** : v1.0.0, JSON Schema draft-07, `additionalProperties: true`. Les sections sont `basics`, `work`, `volunteer`, `education`, `awards`, `certificates`, `publications`, `skills` (`name`, `level`, `keywords`), `languages`, `interests`, `references`, `projects` et `meta` (`canonical`, `version`, `lastModified`) ([schema.json](https://raw.githubusercontent.com/jsonresume/resume-schema/master/schema.json)).

**Changement récent** : le dépôt `resume-schema` est **archivé depuis le 12/06/2026** (2,4k étoiles). Le schéma vit désormais dans le monorepo `jsonresume/jsonresume.org`, sous `packages/schema`, et reste publié sur npm sous le même nom `@jsonresume/schema` ([dépôt](https://github.com/jsonresume/resume-schema)).

**Pas de tags ni de variantes dans le standard.** La proposition « Ability to tag resumes for varying jobs » ([#203](https://github.com/jsonresume/resume-schema/issues/203), 18/11/2015) est fermée et ne figure pas dans le schéma v1.0.0.

**Proposition** : une base maître étendue, puis une projection vers un JSON Resume strict.

```yaml
# data/base.yaml  (source de vérité, versionnée dans git)
basics: { name: ..., email: ..., label: ... }
work:
  - id: acme-2023              # id stable = clé des cases à cocher
    name: ACME
    position: Développeur backend
    startDate: 2023-01
    tags: [backend, lead]
    highlights:                # JSON Resume = string[] ; ici des objets
      - id: acme-perf
        text: "Réduction de 40 % de la latence p95 …"
        tags: [perf]
        variants: { en: "Cut p95 latency by 40% …", court: "…" }
skills:
  - id: lang-back
    name: Backend
    keywords: [{ id: kw-ts, text: TypeScript, tags: [web] }]
```

```yaml
# data/selections/2026-10-acme-dev.yaml  (une candidature)
target: { company: ACME, jobTitle: "Dev backend", lang: fr }
include: [acme-2023, acme-perf, kw-ts, ...]   # ids cochés, dans l'ordre
overrides: { basics.label: "Développeur backend senior" }
```

La fonction `project(base, selection)` renvoie un **JSON Resume valide**. Ce résultat :
- se valide avec `@jsonresume/schema` ou Ajv (draft-07) ;
- alimente le gabarit ;
- reste compatible avec les thèmes existants ;
- garde une trace de chaque envoi dans git.

### Stockage

- **Source de vérité** : des fichiers YAML ou JSON dans un dépôt git. On garde l'historique, les commentaires YAML et un diff par candidature.
- **`localStorage`** : 5 MiB par origine, plus 5 MiB de `sessionStorage` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)). C'est suffisant pour l'état de l'interface, comme un brouillon de sélection.
- **Safari et l'éviction automatique** :
  - Quand la prévention du suivi intersite est active (réglage par défaut), Safari supprime *tout* le stockage écrit par script (localStorage, sessionStorage, IndexedDB, Cache API…) d'une origine sans interaction de l'utilisateur pendant 7 jours d'utilisation du navigateur. Les cookies posés par le serveur sont épargnés (MDN).
  - `navigator.storage.persist()` protège de l'éviction sous pression disque.
  - Conclusion : **jamais de source de vérité stockée uniquement dans le navigateur**.
- **File System Access API** (`showOpenFilePicker` / `showSaveFilePicker`) : marquée « Limited availability » et « Experimental » par [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker). Elle est disponible dans les navigateurs Chromium (Chrome et Edge depuis la 86) ; dans Brave, seulement derrière un flag. Firefox et Safari n'exposent que l'OPFS ([Chrome docs](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)).
- **En pratique** :
  - en mode dev local, un petit endpoint ou plugin Vite écrit dans `data/` ;
  - sinon, import et export JSON/YAML (téléchargement ou glisser-déposer) ;
  - et la File System Access API quand le navigateur le permet.

---

## 4. Frameworks pour un outil personnel

- **Vite** : la v8 est sortie le 12/03/2026, avec Rolldown comme bundler unique par défaut ([vite.dev](https://vite.dev/blog/announcing-vite8)). C'est le socle naturel d'une SPA statique.
- **Vanilla + Vite** : possible, mais l'état imbriqué (sections, entrées, puces, variantes, ordre) devient vite pénible à gérer à la main.
- **Svelte 5, Vue ou React + TypeScript** : leur réactivité convient bien aux arbres de cases à cocher. **React n'est imposé que si l'on choisit @react-pdf/renderer.** Forme accepte aussi Svelte, Vue et Preact.
- **Next.js** : surdimensionné. Il n'y a pas besoin de serveur et le SSR ne sert à rien. Il ne se justifierait que pour une route serveur Puppeteer, ce qui n'est pas recommandé ici.

---

## 5. Vérifier automatiquement en CI que le PDF est extractible

Leçon de [Talentrah #597](https://github.com/Bayo-1987/Claude-Talentrah/issues/597) : **pdf.js seul ne voit pas les mots collés que produit poppler** (0,68 % de mots endommagés contre 29,62 %). Il faut au moins deux extracteurs.

**Pipeline (GitHub Actions, Ubuntu, `apt-get install poppler-utils`)** :
1. **Produire les PDF de fixtures** : `typst compile`, ou Playwright `page.pdf({ tagged: true })` pour un gabarit HTML.
2. **`pdffonts cv.pdf`** : aucune police `Type 3`, et `emb` et `uni` à `yes` partout. La colonne `uni` indique la présence d'un ToUnicode ([man pdffonts](https://manpages.debian.org/stretch/poppler-utils/pdffonts.1.en.html)).
3. **`pdfinfo`** : nombre de pages ≤ N, champs Title et Author renseignés.
4. **Extraction triple** :
   - `pdftotext -raw` et `-layout` ;
   - pdf.js via **unpdf** (`extractText(pdf, { mergePages: true })`, qui embarque PDF.js 5.6.205 selon le [README](https://github.com/unjs/unpdf/blob/main/README.md)) ;
   - en option `mutool draw -F txt`, pdfminer ou pypdf (pypdf est l'extracteur qui révélait « Mostrecentlyfocused »).
5. **Assertions générées à partir des données sélectionnées** (c'est le point fort de l'approche) :
   - chaque `highlight.text` coché apparaît dans chaque extraction, après normalisation NFKC et normalisation des espaces ;
   - le nom apparaît en premier, et les titres de section dans l'ordre attendu ;
   - l'e-mail et le téléphone sont retrouvés par regex ;
   - aucun caractère interdit : `U+200B`, `U+00AD`, `U+2010`, `U+FB00–FB06` (ligatures), zone privée `U+E000–F8FF` (icônes) ;
   - aucun motif de lettres espacées : `/\b(?:\p{Lu} ){3,}/u` ;
   - taux de mots collés (tokens attendus absents de l'extraction) inférieur à 1 %.
6. **En option** : `verapdf -f ua1` si l'on active le mode PDF/UA de Typst ([veraPDF docs](https://docs.verapdf.org/cli/validation/)).
7. **Contrôle manuel ponctuel** : le parseur d'OpenResume (dépôt inactif depuis 10/2024 mais utilisable) ou l'ATS Checker de Reactive Resume (PDF.js, 100 % navigateur).

```ts
// cv.extract.test.ts (Vitest)
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { extractText, getDocumentProxy } from 'unpdf'
const norm = (s: string) => s.normalize('NFKC').replace(/\s+/g, ' ')
const pdf = await readFile('out/cv.pdf')
const pdfjs = norm((await extractText(await getDocumentProxy(new Uint8Array(pdf)), { mergePages: true })).text)
const poppler = norm(execFileSync('pdftotext', ['-raw', 'out/cv.pdf', '-']).toString())
for (const t of expectedTexts) for (const out of [pdfjs, poppler]) expect(out).toContain(norm(t))
expect(poppler).not.toMatch(/[\u200B\u00AD\u2010\uFB00-\uFB06\uE000-\uF8FF]/)
```

*Attention : la normalisation NFKC décompose les ligatures U+FB00–FB06. Il faut donc tester les caractères interdits sur le texte brut, **avant** normalisation, comme le fait la dernière ligne.*

---

## 6. Recommandation

### Stack principale : Vite + TypeScript + Svelte 5 (ou React) + Typst (typst.ts dans le navigateur, CLI en CI)

1. **Données** : `data/base.yaml` et `data/selections/*.yaml` versionnés dans git. Schéma TypeScript validé avec Ajv ou Zod. Projection vers un JSON Resume strict.
2. **Interface** : arbre de cases à cocher par section et par puce, glisser-déposer pour l'ordre, choix des variantes (FR/EN/court). Brouillon dans `localStorage`, plus import et export.
3. **Rendu** : un seul gabarit `cv.typ` qui lit le JSON projeté.
   - Dans le navigateur : typst.ts (`$typst.pdf`), avec un aperçu SVG ou PDF produit par le même moteur. **L'aperçu est donc identique à l'export.**
   - Bundle lite, avec seulement 2 ou 3 TTF statiques mises en cache par un service worker : fonctionnement hors ligne après le premier chargement.
   - Réglages : `lang: "fr"`, `hyphenate: false`, aucun `tracking`, aucune police d'icônes, une seule colonne.
4. **CI** : le même `cv.typ` compilé avec le CLI `typst`, **dans la même version que celle embarquée par typst.ts** (0.14.2 pour typst.ts 0.7.0), sur des fixtures. Puis la batterie de tests du §5.
5. **Phase 2** : export DOCX avec `docx` (dolanmiu) à partir de la même projection.

**Pourquoi Typst :**
- c'est la mesure publique la plus complète trouvée sur des parseurs commerciaux (auto-publiée par RenderCV et non comparative, mais aucun autre moteur n'a de mesure équivalente publiée) ;
- PDF tagué et PDF/UA-1 natifs depuis 0.14, avec des correctifs d'extraction ciblés ;
- contrôle typographique fin ;
- lecture native du JSON et du YAML ;
- aucun serveur ;
- même moteur en local, dans le navigateur et en CI.

**Risques :**
- le poids du WASM, de 14 à 25 Mo selon la configuration et les polices : acceptable pour un usage personnel avec cache ;
- typst.ts suit Typst avec un temps de retard (la 0.7.0 stable correspond à Typst 0.14.2, alors que Typst est en 0.15.1) : figer les versions ;
- l'apprentissage de la syntaxe Typst ;
- aucune preuve sur les ATS courants en France : c'est la batterie de CI qui sert de garde-fou.

### Alternative 1 : Vite + React + TypeScript + @react-pdf/renderer

Tout en JavaScript, léger et hors ligne. Utilisé par Reactive Resume de la v5.1 à la v5.x (remplacé par Forme en v6.0.0) et par OpenResume (inactif depuis 10/2024).

**Mitigations obligatoires :**
- TTF statiques ;
- `registerHyphenationCallback(w => [w])` ;
- désactivation des ligatures (`fontFeatureSettings`, à vérifier en CI) ;
- la même batterie de tests (Node peut produire le PDF avec `renderToFile`).

**Inconvénients** : pas de PDF tagué documenté, typographie moins fine, et le principal projet de référence vient de l'abandonner.

### Alternative 2 (à évaluer) : Forme (`@formepdf/*`)

C'est le moteur adopté par Reactive Resume v6. Il accepte des composants React, Svelte ou Vue ou du HTML/CSS, produit des PDF tagués et vise PDF/UA-1. **Mais il est en 0.x, n'a que 216 étoiles et n'a aucune mesure ATS publique.** À n'adopter qu'après avoir passé la batterie du §5.

*Plan C, le plus simple mais le moins fiable* : HTML/CSS + `window.print()` dans Chrome, et Playwright `page.pdf` en CI. Il faut alors :
- un `word-spacing` légèrement positif, en surveillant le débordement de page ;
- des polices statiques ;
- `@page { margin: 0 }`, les marges étant gérées dans la page ;
- accepter les U+200B de Skia.

---

## Sources

**Pages lues (WebFetch), recherche initiale et vérification**
- https://docs.rendercv.com/ats_compatibility/
- https://github.com/rendercv/rendercv
- https://github.com/cinnamennen/resume/pull/1
- https://atsverification.com/blog/latex-resume-ats-friendly/
- https://github.com/Bayo-1987/Claude-Talentrah/issues/597
- https://github.com/ArtifexSoftware/pdf2docx/issues/379
- https://github.com/PigLardLord/cv-giovanni/issues/143
- https://dev.to/accreditly/how-html-to-pdf-conversion-actually-works-rendering-engines-text-objects-and-fonts-103j
- https://github.com/diegomura/react-pdf, https://github.com/diegomura/react-pdf/issues/3009, https://react-pdf.org/fonts
- https://github.com/reactive-resume/reactive-resume (README, releases v5.1.0 et v6.0.0, `packages/pdf/package.json`, `apps/web/package.json`)
- https://newreleases.io/project/github/reactive-resume/reactive-resume/release/v5.1.0
- https://github.com/formepdf/forme (redirige vers danmolitor/forme)
- https://rxresu.me/ats-checker
- https://github.com/xitanggg/open-resume, https://github.com/xitanggg/open-resume/commits/main
- https://github.com/parallax/jsPDF, https://github.com/parallax/jsPDF/releases, https://raw.githubusercontent.com/parallax/jsPDF/master/src/modules/html.js
- https://github.com/eKoopmans/html2pdf.js
- https://github.com/foliojs/pdfkit/issues/1659, https://github.com/foliojs/pdfkit/releases
- https://raw.githubusercontent.com/bpampuch/pdfmake/master/package.json
- https://pptr.dev/api/puppeteer.pdfoptions
- https://github.com/microsoft/playwright/releases/tag/v1.42.0, https://playwright.dev/docs/api/class-page (tronqué)
- https://github.com/Kozea/WeasyPrint/issues/2363
- https://typst.app/docs/changelog/0.14.0/, https://github.com/typst/typst/releases, https://typst.app/docs/reference/data-loading/
- https://github.com/Myriad-Dreamin/typst.ts, https://github.com/Myriad-Dreamin/typst.ts/releases, https://myriad-dreamin.github.io/typst.ts/cookery/guide/all-in-one.html
- https://github.com/lgtm-hq/Rustume/issues/682
- https://github.com/aaditagrawal/typsmthng/pull/18
- https://github.com/pdgramajo/render-my-cv
- https://pagedjs.org/posts/en/a-new-chapter-in-paged.js-life/
- https://developer.chrome.com/blog/print-margins
- https://developer.chrome.com/docs/capabilities/web-apis/file-system-access, https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- https://github.com/jsonresume/resume-schema, https://github.com/jsonresume/resume-schema/issues/203, https://raw.githubusercontent.com/jsonresume/resume-schema/master/schema.json
- https://github.com/unjs/unpdf/blob/main/README.md
- https://github.com/dolanmiu/docx
- https://docxtemplater.com/
- https://vite.dev/blog/announcing-vite8

**Non ouvertes ou bloquées (HTTP 403/429)** : https://resumeatlas.io/ats-friendly-fonts (429), https://pdfa.org/chrome-adds-support-for-tagged-pdf/ (403), https://github.com/puppeteer/puppeteer/commit/031686339136873c555a19ffb871f7140a2c39d9, https://www.overleaf.com/learn/latex/French, https://github.com/ashwingopalsamy/ats-latex-resume, https://www.nutrient.io/blog/how-to-convert-html-to-pdf-using-html2pdf/, https://js.libhunt.com/jspdf-changelog/4.0.0, https://manpages.debian.org/stretch/poppler-utils/pdffonts.1.en.html, https://docs.verapdf.org/cli/validation/, https://www.npmjs.com/package/@myriaddreamin/typst.ts

**Non vérifié** :
- extraction des PDF produits par Firefox ou Safari ;
- support du PDF tagué par react-pdf ;
- taille exacte des bundles typst.ts lite, @react-pdf/renderer et Forme ;
- exploitation des balises PDF par les ATS commerciaux ;
- comportement des ATS courants en France ;
- historique du PDF tagué dans Chrome (85, retrait en 2022, Chrome 106).

---

## Vérification

| # | Affirmation contrôlée | Verdict | Source / commentaire |
|---|---|---|---|
| 1 | Rapport RenderCV : 20 PDF (4 CV × 5 thèmes), 99,1 % avec pdftotext et PyMuPDF, Affinda/Extracta/Klippa sans erreur | **Confirmé**, avec nuance | [docs.rendercv.com](https://docs.rendercv.com/ats_compatibility/) : chiffres exacts, parseurs interrogés via Eden AI. Rapport non daté, auto-publié et non comparatif. « Meilleur bilan mesuré » reformulé en « mesure publique la plus complète trouvée ». |
| 2 | Typst 0.14.0 du 24/10/2025 : krilla, PDF tagués par défaut, PDF/UA-1, tous les PDF/A, correctifs d'extraction | **Confirmé** | [changelog 0.14.0](https://typst.app/docs/changelog/0.14.0/) |
| 3 | Typst 0.15.0 du 15/06/2026 (polices variables, MathML), 0.15.1 du 17/07/2026 | **Confirmé** | [typst/releases](https://github.com/typst/typst/releases) |
| 4 | typst.ts v0.7.0 du 01/06/2026 avec Typst 0.14.2 ; v0.8.0-rc avec 0.15.0-rc.1 ; 1,2k étoiles | **Confirmé** | [typst.ts releases](https://github.com/Myriad-Dreamin/typst.ts/releases) |
| 5 | Poids WASM : +16,4 Mo gzip (Rustume) ; « 22-25 Mo non compressés » (typsmthng) | **Confirmé / nuancé** | [Rustume #682](https://github.com/lgtm-hq/Rustume/issues/682) : +16,4 Mo gzip, dus aux polices de typst-assets. [typsmthng PR #18](https://github.com/aaditagrawal/typsmthng/pull/18) : 28,4 → 24,6 Mo non compressés, et non « 22-25 Mo ». |
| 6 | Talentrah #597 : 29,62 % (poppler) contre 0,68 / 0,74 / 0 / 0,88 % ; `word-spacing` à 0,56-0,90 % ; 5,6 % de pages en plus | **Confirmé**, avec nuance | [Talentrah #597](https://github.com/Bayo-1987/Claude-Talentrah/issues/597) : issue du 30/09/2026, ouverte. Chromium de Playwright sur ubuntu-latest, 11/195 rendus. Mesure d'un seul projet, sur une seule police. |
| 7 | pdf2docx #379 : ActualText U+200B de Skia, ouverte le 25/09/2026, non résolue | **Confirmé** | [pdf2docx #379](https://github.com/ArtifexSoftware/pdf2docx/issues/379) |
| 8 | Polices variables → Type 3 dans Chrome, perte d'espaces | **Nuancé** | [cv-giovanni #143](https://github.com/PigLardLord/cv-giovanni/issues/143) (fermée) confirme le cas, combiné à un letter-spacing négatif. [dev.to](https://dev.to/accreditly/how-html-to-pdf-conversion-actually-works-rendering-engines-text-objects-and-fonts-103j) confirme le Type 3, mais dit que le texte reste sélectionnable ; la gêne principale concerne PDF/A. |
| 9 | Letter-spacing +2 pt : 4 extracteurs sur 5 en échec ; la police ne change rien (resumeatlas) | **Non vérifiable** | Page bloquée (HTTP 429), site commercial |
| 10 | atsverification (22/08/2026) : ligatures, icônes, OT1, correctifs | **Confirmé** | [atsverification.com](https://atsverification.com/blog/latex-resume-ats-friendly/) : service commercial (Tanzeel Labs) |
| 11 | Cas Awesome-CV : « Mostrecentlyfocused », U+2010 via HarfBuzz, `Renderer=Node`, tagpdf, 0 erreur sur 6 extracteurs | **Confirmé**, moteur nuancé | [PR #1](https://github.com/cinnamennen/resume/pull/1) (fusionnée le 30/09/2026) : 0 → 471 espaces. Le correctif impose LuaLaTeX (xelatex ne peut pas l'exécuter) ; le moteur du PDF défaillant est ambigu. |
| 12 | « jsPDF `html()` produit une image » | **Réfuté** | [jsPDF html.js](https://raw.githubusercontent.com/parallax/jsPDF/master/src/modules/html.js) dessine via `pdf.context2d`, donc du texte vectoriel. C'est html2pdf.js qui rastérise ([README](https://github.com/eKoopmans/html2pdf.js), « Known issues »). |
| 13 | Puppeteer : `tagged` vaut `true` par défaut « (expérimental) » | **Nuancé** | [pptr.dev](https://pptr.dev/api/puppeteer.pdfoptions) : `true` par défaut et **non** expérimental ; c'est `outline` qui l'est. `preferCSSPageSize` vaut `false`. |
| 14 | Playwright : `tagged` et `outline` depuis la v1.42 | **Confirmé** | [release v1.42.0](https://github.com/microsoft/playwright/releases/tag/v1.42.0) ; valeur par défaut de `tagged` non lue (doc tronquée) |
| 15 | Reactive Resume v5.1 : @react-pdf/renderer, fin de Browserless, aperçu pdf.js | **Confirmé mais obsolète** | [release v5.1.0](https://github.com/reactive-resume/reactive-resume/releases/tag/v5.1.0) (7 mai 2026). **v6.0.0 (04/10/2026) est passé à Forme** : `@formepdf/core` et `@formepdf/react` 0.27.0 dans `packages/pdf/package.json` ([release v6.0.0](https://github.com/reactive-resume/reactive-resume/releases/tag/v6.0.0)). |
| 16 | OpenResume (8,9k étoiles) utilise react-pdf | **Confirmé**, avec nuance | [open-resume](https://github.com/xitanggg/open-resume) : dernier commit le 29/10/2024, projet inactif |
| 17 | rxresu.me ATS Checker : PDF.js, 100 % navigateur, « les ATS convertissent en texte brut » | **Confirmé** (l'outil le dit), **généralisation nuancée** | [rxresu.me/ats-checker](https://rxresu.me/ats-checker). Ce qui est vrai des ATS en général reste non démontré, et rien n'est démontré pour les ATS français. |
| 18 | Bug pdfkit #1659 (CMap > 256 caractères) : « fermé, risque faible » | **Nuancé (corrigé)** | Corrigé dans [pdfkit 0.18.0](https://github.com/foliojs/pdfkit/releases). pdfmake 0.3.11 dépend de pdfkit `^0.19.1` ([package.json](https://raw.githubusercontent.com/bpampuch/pdfmake/master/package.json)). |
| 19 | jsPDF 4.2.1 (mars 2026), plusieurs CVE corrigées ; 14 polices limitées à l'ASCII | **Confirmé** | [jsPDF releases](https://github.com/parallax/jsPDF/releases) : avis GHSA de la 4.0.0 à la 4.2.1 ; GitHub n'affiche pas l'année, 2026 d'après libhunt. Citation du README confirmée. |
| 20 | JSON Resume `resume-schema` archivé le 12/06/2026, déplacé dans le monorepo, même paquet npm ; #203 non adoptée | **Confirmé** | [resume-schema](https://github.com/jsonresume/resume-schema), [#203](https://github.com/jsonresume/resume-schema/issues/203) (fermée) |
| 21 | Chrome 131 : 16 margin boxes, compteurs `page`/`pages` ; en-têtes Chrome ajoutés même avec margin boxes | **Confirmé** | [Chrome blog 30/10/2024](https://developer.chrome.com/blog/print-margins) : en-têtes absents si la marge est nulle ou trop petite |
| 22 | PDF tagué de Chrome : Chrome 85, retiré en 2022, rétabli dans Chrome 106 | **Non vérifiable** | pdfa.org bloqué (HTTP 403), budget de recherche épuisé |
| 23 | Paged.js « neue », passage direct à la 2.0 (17/05/2025) | **Confirmé** | [pagedjs.org](https://pagedjs.org/posts/en/a-new-chapter-in-paged.js-life/) |
| 24 | WeasyPrint : PDF/UA expérimental, « non garanti valide » | **Nuancé** | [#2363](https://github.com/Kozea/WeasyPrint/issues/2363) : « limité, problèmes fondamentaux », issue aujourd'hui fermée (travaux visant la v66) ; citation non retrouvée |
| 25 | react-pdf : TTF/WOFF seulement, pas de polices variables, césure par défaut | **Confirmé** | [react-pdf.org/fonts](https://react-pdf.org/fonts) : la mention « motifs en-US » n'a pas été retrouvée et a été retirée |
| 26 | localStorage à 5 MiB ; éviction Safari après 7 jours ; File System Access réservée à Chromium | **Confirmé**, avec nuance | [MDN quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) : éviction conditionnée à la prévention du suivi (active par défaut). [MDN showOpenFilePicker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker) : « Limited availability ». |
| 27 | Vite 8 du 12/03/2026, Rolldown par défaut | **Confirmé** | [vite.dev](https://vite.dev/blog/announcing-vite8) |
| 28 | docxtemplater : images et HTML en modules payants | **Confirmé** | [docxtemplater.com](https://docxtemplater.com/) |
| 29 | render-my-cv (React 19, Vite, typst.ts, PWA, YAML RenderCV, 0 étoile) | **Confirmé** | [render-my-cv](https://github.com/pdgramajo/render-my-cv) |
| 30 | Nombres d'étoiles (react-pdf 16,8k, jsPDF 31,3k, docx 5,9k, RenderCV 17,7k, typst.ts 1,2k, resume-schema 2,4k, OpenResume 8,9k) | **Confirmé** | Pages GitHub consultées le 05/10/2026 |
| 31 | unpdf embarque PDF.js 5.6.205 | **Confirmé** | [README unpdf](https://github.com/unjs/unpdf/blob/main/README.md) (pdfjs-dist 6.4.299 existe déjà, utilisé par Reactive Resume) |

*Budget de recherche web (WebSearch) épuisé pendant la vérification : tous les contrôles ci-dessus ont été faits par lecture directe des pages (WebFetch).*