# Analyse d'offre, correspondance de mots-clés et IA optionnelle pour un générateur de CV à cases à cocher

*Rapport de recherche, état au 2026-10-05, **vérifié et corrigé le 2026-10-05**. Les étoiles GitHub et les dates de commit viennent de l'API GitHub, consultée le jour de la vérification. Les versions de paquets viennent du registre npm. « (non vérifié) » signale une donnée qu'aucune source primaire ne confirme. Les corrections sont intégrées au texte et détaillées dans la section « Vérification » à la fin.*

---

## 0. Synthèse

- **Les ATS de 2024-2026 combinent mots-clés exacts et correspondance sémantique.**
  - Greenhouse surligne les correspondances exactes **et** les mots-clés « similaires ».
  - Workday calcule un *Skills Match Score* par apprentissage automatique (ML).
  - iCIMS déduirait les compétences à partir du texte complet du CV **(non vérifié : la source citée ne le dit pas)**.
  - Taleez (éditeur français) affirme analyser le parcours plutôt que les seuls termes.
  - Les recruteurs continuent aussi de **filtrer et chercher par mots-clés**. Les mots exacts restent donc nécessaires, mais ils ne suffisent plus.
- **Ces outils notent et classent, ils ne rejettent pas seuls.** Les éditeurs présentent leur notation comme une aide à la décision humaine. L'article 22 du RGPD et l'AI Act vont dans ce sens :
  - l'emploi est un domaine « à haut risque » de l'annexe III ;
  - les obligations correspondantes sont reportées au **2 décembre 2027** par le règlement (UE) 2026/1744 ;
  - la CNIL fait du recrutement un thème de contrôle prioritaire en 2026.

  Conséquence : le CV doit convaincre un score **et** un humain qui lit le texte extrait.
- **Le texte caché (police blanche, instructions pour l'IA) est à exclure.**
  - Des chercheurs de Duke ont trouvé des injections de prompt dans **au moins 1 %** d'environ 200 000 CV. L'étude est connue par la presse (août 2026) ; l'étude elle-même n'a pas été consultée.
  - Indeed dit avoir mis en place des garde-fous pour repérer ce contenu suspect.
  - Le texte caché redevient visible dès qu'on regarde le texte brut extrait.

  Le générateur ne doit jamais proposer cette option.
- **Côté client, une analyse fiable et explicable sans IA est possible :**
  1. un **dictionnaire de compétences personnel** (alias et synonymes FR/EN), alimenté au besoin par **ESCO en français** (13 939 compétences) ;
  2. une normalisation adaptée au français ;
  3. une pondération selon la rubrique de l'offre (requis, souhaité, missions) ;
  4. un score pondéré dont chaque point se justifie ;
  5. une **pré-sélection automatique** des éléments à cocher par couverture gloutonne sous contrainte de place.
- **Le LLM (API Claude ou modèle local) doit rester optionnel.**
  - Faible risque et vraie valeur : structurer l'offre et rapprocher les synonymes.
  - Risque moyen : reformuler des puces. Il faut des garde-fous automatiques (aucun chiffre, aucune compétence, aucun employeur absents de la source) et une comparaison avant/après validée par l'utilisateur.
  - Resume Matcher (open source, actif) applique déjà ce modèle et sert de bonne référence.

---

## 1. Les ATS de 2024-2026 font-ils du matching sémantique ?

### 1.1 Ce que les éditeurs documentent

| Éditeur / fonction | Mécanisme déclaré | Décision humaine ? | Source |
|---|---|---|---|
| **Workday** – *Candidate Skills Match* | Analyse des candidatures par ML. Score fondé sur la similarité entre les compétences de la candidature et celles de l'offre. Prérequis : activer Skills Cloud. Algorithme non publié. | Workday dit surveiller et tester la fonction pour détecter les biais interdits. Le client reste responsable de sa conformité, y compris en droit anti-discrimination. | doc.workday.com |
| **Workday / HiredScore** (rachat annoncé fin février ou début mars 2024 : l'article de J. Bersin du 1er mars 2024 en parle comme d'une annonce « de la semaine ») | Matching par IA (« talent orchestration »), notation des candidats. | — | joshbersin.com |
| **Greenhouse** – *Talent Matching* (fonction de *Real Talent*, **date de lancement non vérifiée** ; article d'aide mis à jour le 09/09/2026) | Le recruteur calibre la recherche ; Greenhouse **recommande 4 à 6 compétences clés**, pondérées par curseurs. Surligne les correspondances exactes et similaires. Cinq niveaux : Strong, Good, Partial, Limited, Needs manual review. Module complémentaire des offres Core, Plus et Pro. | « assistive AI, not automated-decision-making » : ne fait ni avancer ni rejeter automatiquement un candidat. | support.greenhouse.io, greenhouse.com |
| **iCIMS** – *Role Fit* | Classement par IA ; compétences déduites du texte complet du CV. **(non vérifié)** : le billet iCIMS cité (mai 2021) parle de « intelligent talent matching » mais ne mentionne ni *Role Fit* ni cette déduction. | Recommandation au recruteur (non vérifié). | icims.com (ne confirme pas) |
| **Oracle Recruiting** 25D | Fonction *AI Agent for Candidate Experience* : agents *Job Recommendations* et *Job Fit* **côté candidat**. Aucune note chiffrée documentée. | — | docs.oracle.com |
| **Taleez** (FR, PME/ETI) | « Matching CV IA » : part du poste à pourvoir, puis s'appuie d'abord sur le parcours réel des candidats, pas seulement sur les termes du CV. | Taleez dit que l'IA analyse, classe et propose, mais ne décide **jamais** à la place du recruteur. | taleez.com |
| **Teamtailor** | Selon un guide tiers (JobMentis, mis à jour le 15/05/2026), Teamtailor n'a ni score de présélection, ni algorithme de matching, ni rejet automatique. **Source tierce, non confirmée par l'éditeur.** | — | jobmentis.com |

### 1.2 Les recruteurs cherchent et filtrent toujours par mots-clés

- Jobscan indique que **99,7 %** des recruteurs utilisent des filtres (rapport *State of the Job Search*). Jobscan est un éditeur commercial : ses chiffres sont auto-déclarés et sa méthodologie n'a pas été évaluée. Le détail :
  - 76,4 % filtrent par compétences ;
  - 59,7 % par formation ;
  - 55,3 % par intitulé de poste ;
  - 50,6 % par certification ou licence ;
  - 44 % par années d'expérience.
- Selon le même éditeur, un CV qui contient l'**intitulé exact du poste visé** obtient **10,6 fois** plus d'entretiens. C'est une affirmation de l'éditeur.
- Le tutoriel Jobscan recommande un « match rate » d'au moins 75 %. Il hiérarchise : compétences techniques (poids le plus fort) > niveau d'études (si un diplôme avancé est demandé) > intitulé de poste > savoir-être > autres mots-clés. Il conseille de **ne pas** ajouter toutes les compétences manquantes, mais de privilégier les compétences techniques fréquentes.

### 1.3 Conséquences pour la stratégie de mots-clés

1. **Le terme exact reste utile.** La recherche booléenne du recruteur, les filtres et la correspondance exacte de Greenhouse le récompensent. Il faut reprendre la formulation de l'offre **quand elle décrit vraiment ton expérience**.
2. **Écrire le sigle et la forme longue** (« SQL », « BI (Business Intelligence) »). Certains systèmes ne reconnaissent ni les synonymes ni les abréviations.
3. **Montrer chaque compétence dans son contexte.** Les couches sémantiques (Workday Skills Cloud, et peut-être iCIMS, non vérifié) lisent tout le texte. Une compétence citée dans une puce d'expérience, avec un résultat, pèse plus qu'une liste isolée. Le générateur doit vérifier que chaque compétence clé cochée est étayée par au moins une puce cochée.
4. **Aligner l'intitulé du CV sur celui de l'offre**, si c'est honnête.
5. **Ne pas bourrer de mots-clés.** Avec des embeddings, répéter un terme n'augmente pas la similarité de façon fiable. Le recruteur lit le texte extrait. Les LLM qui évaluent peuvent pénaliser un texte artificiel.
6. **Pratiques obsolètes ou dangereuses :**
   - le texte blanc ou les instructions cachées (« ignore previous instructions »). Des chercheurs de Duke ont trouvé des injections de prompt dans au moins 1 % d'environ 200 000 CV réels (rapporté par la presse en août 2026). Indeed dit en avoir trouvé et avoir ajouté des garde-fous ;
   - viser une « densité de mots-clés » ;
   - les statistiques non sourcées du type « 75 % des CV rejetés par les ATS » (aucune source primaire trouvée ; à ne pas reprendre).
7. **Biais des modèles sémantiques.** L'étude de Wilson et Caliskan (Université de Washington, AIES 2024) porte sur des modèles d'embeddings massifs (MTE) utilisés pour une recherche de CV, avec plus de 500 CV et 500 offres. Ces modèles préféraient les prénoms associés aux personnes blanches dans **85,1 %** des cas, et les prénoms féminins dans seulement 11,1 % des cas. Pour ton outil, cela veut dire : n'envoyer à un LLM ni nom, ni photo, ni âge (minimisation des données).

### 1.4 Cadre réglementaire, utile pour comprendre le comportement des ATS

- **AI Act (*Digital Omnibus on AI*).** Le règlement (UE) 2026/1744 a été publié au Journal officiel le 24 juillet 2026. Il est en vigueur depuis le 27 juillet 2026.
  - Les obligations sur les systèmes à haut risque autonomes de l'annexe III (emploi, recrutement) passent du 2 août 2026 au **2 décembre 2027**.
  - Pour les systèmes intégrés à des produits (annexe I), la date est le 2 août 2028.
  - Les obligations de transparence de l'article 50 restent applicables au 2 août 2026. Les systèmes mis sur le marché avant cette date ont jusqu'au 2 décembre 2026 pour marquer les contenus générés.
- **RGPD article 22 et CNIL.** Un rejet entièrement automatisé n'est pas conforme. La CNIL a publié un guide recrutement en janvier 2023 (non revérifié). Le 3 avril 2026, elle a annoncé que le recrutement est une thématique de contrôle prioritaire pour 2026.
  - Les contrôles portent sur les systèmes de décision automatisée, l'information des candidats et les durées de conservation.
  - Ils visent d'abord les grandes entreprises et les cabinets de recrutement.

---

## 2. Extraire les mots-clés d'une offre (en français)

### 2.1 Normalisation du français : la partie la plus importante

| Problème | Traitement recommandé |
|---|---|
| Accents, casse | Minuscules, puis NFD et suppression des diacritiques **pour la comparaison seulement**. On affiche l'original. |
| Élisions | Retirer `l' d' qu' j' n' s' c'` (« l'analyse » devient « analyse »). |
| Écriture inclusive / genre | `développeur·se`, `développeur(se)`, `H/F`, `développeuse` ramenés à une forme canonique par la table d'alias. |
| Termes techniques | Protéger **avant** la découpe en mots : `C++`, `C#`, `.NET`, `Node.js`, `CI/CD`, `Power BI`, `SAP S/4HANA`. Utiliser une liste de motifs et les alias du dictionnaire. |
| Termes ambigus | `R`, `C`, `Go`, `Swift`, `Rust`, `Spark`, `Excel` : correspondance sensible à la casse, mot entier, et idéalement contexte (« langage », « maîtrise de »). |
| Expressions de plusieurs mots | n-grammes de 1 à 4 mots comparés au dictionnaire (« gestion de projet », « analyse de données »). |
| Racinisation (stemming) vs lemmatisation | Snowball FR (racinisation) pour les **mots génériques uniquement**. Jamais sur les noms d'outils, où l'on garde exact ou alias. La lemmatisation (Lefff) est plus juste mais plus lourde. |
| Mots vides | Liste FR (stopwords). Garder « plus » et « atout », qui signalent une compétence souhaitée. |
| Offres mêlant FR et EN | Alias bilingues : « gestion de projet » ↔ « project management ». |

**Bibliothèques JS repérées.** Versions et dates relevées sur le registre npm le 05/10/2026.

- **`natural`** (MIT, v8.1.1, février 2026, environ 10,9k★)
  - Contenu : `PorterStemmerFr` et `CarryStemmerFr` (documentés), `AggressiveTokenizerFr` (exporté dans le code), `TfIdf`.
  - Plutôt orientée Node : à empaqueter (bundler) pour le navigateur.
- **`@orama/stemmers`** et **`@orama/stopwords`** (Apache-2.0, v3.1.18, décembre 2025)
  - 28 langues pour la racinisation et 31 listes de mots vides, **dont le français**.
- **`multilingual-stemmer`** (MIT, v2.1.1, août 2026)
  - Snowball 3.1.1 compilé en WebAssembly, 34 langues, pour Node ≥ 22 et le navigateur.
  - Option actuelle la plus propre pour Snowball FR dans le navigateur.
- **À éviter (non maintenus) :**
  - `snowball-stemmer.jsx` : dernière publication en 2015 ;
  - `nlp-js-tools-french` : 2017 ;
  - `node-lefff` : 2021, et licence **LGPL-3.0** à prendre en compte.

### 2.2 Correspondance par dictionnaire et taxonomie : le cœur fiable

| Référentiel | Intérêt pour toi | Langue | Licence / accès |
|---|---|---|---|
| **ESCO** v1.2.1 (déc. 2025, version mineure de qualité) | **13 939 compétences** (piliers savoirs, langues, aptitudes, transversales). Colonnes `preferredLabel`, **`altLabels`** (synonymes), `hiddenLabels` (variantes, fautes courantes), `skillType` (compétence ou connaissance), `reuseLevel` (transversale, sectorielle…), `conceptUri`. | 28 langues dont **FR** | Téléchargement gratuit, sur adresse e-mail (lien envoyé par courriel). Formats CSV, ODS, JSON-LD, RDF/TTL, XML. Réutilisation libre avec citation de la source (décision 2011/833/UE, **non revérifiée**). API REST `/search?text=…&language=fr&type=skill`, `/suggest2`, `selectedVersion`. **CORS ouvert** : `Access-Control-Allow-Origin: *` constaté le 05/10/2026 sur `/search`. Préférer quand même un sous-ensemble téléchargé : fonctionnement hors ligne, aucune requête externe avec le contenu des offres. |
| **ROME 4.0** (France Travail) | Référentiel français des métiers et compétences. data.gouv annonce 1 911 fiches métiers, 14 301 appellations, 21 320 savoir-faire et 17 319 savoirs (mise à jour du 18/06/2026). | FR | Licence Ouverte / Open Licence. XLSX et PDF sur data.gouv. Quatre API (Compétences, Métiers, Contextes, Fiches) sur francetravail.io, conditions d'accès non vérifiées. |
| **O\*NET** 31.0 | Les technologies très demandées dans les offres (*hot technologies*) figurent dans le fichier « Software Skills » (31 821 lignes en 31.0) : utile pour les noms d'outils. | EN uniquement | CC BY 4.0, avec citation d'O\*NET 31.0 et du U.S. Department of Labor. |
| **Lightcast Open Skills** | **Plus de 34 000 compétences** (et non 35 000). | Surtout EN (langues non précisées) | API sur inscription. La gratuité générale n'est pas explicitement confirmée par la page, qui la mentionne pour les organisations d'intérêt général. |

**Recommandation.** Le dictionnaire de référence doit être **celui de l'utilisateur**, construit à partir de sa base de CV :

```
{ id, label_fr, label_en, aliases[], type: hard|soft|outil|langue|certif, escoUri? }
```

ESCO FR sert à proposer des alias (`altLabels`) et à repérer les compétences de l'offre absentes de la base. Un script hors ligne peut convertir le CSV ESCO en un JSON filtré sur le domaine métier, pour rester léger.

### 2.3 Méthodes statistiques, en complément

- **TF-IDF / BM25.** L'IDF a besoin d'un corpus : une offre seule ne suffit pas, il faut accumuler localement les offres déjà analysées. Seul, TF-IDF remonte du bruit (nom de l'entreprise, avantages). C'est utile pour repérer les **termes inconnus** du dictionnaire, pas pour noter.
- **YAKE.** Méthode non supervisée sur un seul document, compatible avec le français.
  - Implémentation de référence en Python : le dépôt est désormais `INESCTEC/yake`, ex-`LIAAD/yake`.
  - **Il existe des portages JS/TS sur npm**, contrairement à ce qu'annonçait la première version de ce rapport : `yake-ts` (v1.2.5, août 2026), `@ade_oshineye/yaket` (v0.5.3, avril 2026), `@seanmozeik/yake-ts` (septembre 2026) et `yake-wasm` (2022).
  - Ces portages sont récents et peu éprouvés ; leur qualité en français n'a pas été vérifiée.
- **Heuristiques simples et efficaces :**
  - mots à majuscule ou aspect technique (`/[A-Z][\w.+#\/-]+/`) ;
  - sigles ;
  - mots-clés repérés par des marqueurs (« maîtrise de », « connaissance de », « expérience en »).

### 2.4 Pondérer selon la structure de l'offre

1. Découper l'offre par titres de rubrique (regex FR et EN) :
   - « Missions », « Vos responsabilités » ;
   - « Profil recherché », « Compétences requises » ;
   - « Atouts », « Un plus », « Souhaité » ;
   - « Nice to have ».
2. Lire les modalités dans la phrase :
   - « impératif », « indispensable », « exigé » → **requis** ;
   - « apprécié », « serait un plus », « idéalement » → **souhaité**.
3. Poids proposés : titre ×1,5 ; requis ×1,0 ; missions ×0,7 ; souhaité ×0,5. Ajouter un bonus plafonné (+20 %) si le terme est répété.

### 2.5 Matching sémantique local, optionnel et sans IA générative

- **Transformers.js** (`@huggingface/transformers`, Apache-2.0, v4.3.0 du 16/09/2026) avec `Xenova/multilingual-e5-small` : embeddings ONNX calculés dans le navigateur, en WASM ou en WebGPU.
  - Quantification `q8` par défaut en WASM selon la documentation de la v3 (non revérifié pour la v4).
- **Taille et licence du modèle (vérifiées)** :
  - `model_quantized.onnx` (int8) pèse environ **118 Mo**, la version fp16 environ 235 Mo, la version fp32 environ 470 Mo ;
  - le modèle de base `intfloat/multilingual-e5-small` est sous **MIT** ; le dépôt Xenova n'affiche pas de licence propre ;
  - le chargement doit donc être différé (lazy), mis en cache, et déclenché seulement à la demande.
- **Usage** : proposer des **« équivalences probables »** entre une exigence de l'offre et une puce de la base, à faire confirmer par l'utilisateur. Ne jamais l'utiliser comme score principal : c'est moins explicable et sujet aux biais (§1.3).
- **`esco-skill-extractor`** (Python, MIT, 32★, dernier commit en juin 2025) montre l'approche « embeddings + similarité cosinus avec ESCO ».
  - Seuils par défaut : 0,6 pour les compétences et 0,55 pour les métiers ISCO.
  - Son modèle par défaut, `all-MiniLM-L6-v2`, est anglais et le français n'est pas documenté. Il faudrait un modèle multilingue.

---

## 3. Un score de correspondance simple et explicable, calculé dans le navigateur

### 3.1 Références existantes

- **Resume Matcher, `services/ats.py`** :
  `overall = 0.55·keyword_match + 0.25·skills_coverage + 0.20·section_completeness`.
  - Le calcul composite est déterministe. Mais `keyword_match` est le pourcentage fourni par le pipeline de raffinement (`refiner.calculate_keyword_match`), et les compétences de l'offre sont extraites par LLM : le score n'est donc déterministe **qu'à entrées LLM fixées**.
  - La couverture des compétences vaut `matched / total` sur les exigences requises et souhaitées. Une compétence compte si elle figure dans la liste `technicalSkills` (comparaison exacte en minuscules) ou en mot entier dans le texte complet. Pas de synonymes.
- **Resume Matcher, `bullet_scoring.py`** (repli sans LLM) : 20 points par terme distinct de l'offre trouvé dans une puce, plafonné à 100. Ni racinisation, ni synonymes.
- **resume-match** (navigateur seul, MIT) :
  - découpe l'offre sur la ponctuation en fragments d'exigence ;
  - un fragment est « couvert » si plus de 50 % de ses mots-clés sont présents ;
  - score = fragments couverts / fragments.
  - Le README reconnaît qu'il n'y a aucune compréhension sémantique. Sa tokenisation vise l'anglais (et les bigrammes chinois) : elle n'est pas adaptée au français telle quelle.

### 3.2 Formule proposée

On travaille sur des termes canoniques issus du dictionnaire.

```
Pour chaque terme t de l'offre : poids w(t) (rubrique × modalité × répétition plafonnée)
Qualité de correspondance q(t) dans le CV sélectionné :
  1.0  exact (forme canonique)        0.9  alias/synonyme/sigle
  0.8  même racine (mots génériques)  0.5  équivalence sémantique CONFIRMÉE par l'utilisateur
  0    absent
Bonus « preuve » : ×1.15 si t apparaît dans une puce d'expérience/projet cochée
                   (pas seulement dans la rubrique Compétences), plafonné à 1.

Sous-scores (chacun sur 0-100) :
  Requis      = Σ w·q / Σ w   (termes requis)
  Souhaités   = idem          (termes souhaités)
  Intitulé    = 100 si l'intitulé du CV contient l'intitulé canonique de l'offre, sinon 50 pour un alias, sinon 0
  Formation/Certifs/Langues exigées = couverture
  Structure   = rubriques standard présentes (Expérience, Formation, Compétences, coordonnées)

Global = 0.45·Requis + 0.15·Souhaités + 0.15·Intitulé + 0.15·Formation/Certifs/Langues + 0.10·Structure
```

### 3.3 Présentation : l'explicabilité avant le chiffre

- **Afficher une fourchette** (« faible / moyen / bon / fort »), inspirée des cinq niveaux de Greenhouse, plutôt que « 73,4 % ». Ne jamais promettre de « passer l'ATS ».
- **Pour chaque terme**, montrer :
  - la phrase de l'offre surlignée ;
  - le poids et sa justification (« requis, rubrique Profil ») ;
  - le type de correspondance ;
  - l'endroit où il apparaît dans le CV (rubrique et élément).
- **Séparer les termes manquants en trois catégories.** C'est la fonction la plus utile pour un CV à cases à cocher :
  1. **Dans ta base mais non coché** : proposer de cocher l'élément.
  2. **Dans ta base sous un autre libellé** : proposer d'ajouter un alias, ou une variante de puce qui reprend le mot de l'offre.
  3. **Absent de ta base** : à n'ajouter **que si c'est vrai**. Sinon, c'est une information pour la lettre de motivation ou l'entretien.
- **Avertissements :**
  - terme répété plus de 3 fois (bourrage) ;
  - compétence présente seulement dans la liste, sans preuve ;
  - sigle sans forme longue, ou l'inverse.

---

## 4. Pré-sélection automatique des cases à cocher

1. **Modèle de données.** Chaque élément de la base (expérience, puce, projet, certification…) porte `skills: [idCanonique]`, `date`, `verrouillé?`, `épinglé?` et `variantes[]`. Les étiquettes sont calculées automatiquement à partir du texte via le dictionnaire, puis corrigées à la main.
2. **Valeur d'un élément** = somme des poids des termes de l'offre **encore non couverts** qu'il couvre (rendement marginal décroissant), plus un petit bonus de récence et de résultat chiffré.
3. **Couverture gloutonne pondérée sous contrainte de place :**
   - tant qu'il reste de la place, ajouter l'élément au meilleur gain marginal ;
   - les contraintes de place sont : nombre de puces maximum par expérience (le `max_per_entry` de Resume Matcher), nombre total de lignes, et une ou deux pages ;
   - Resume Matcher fait de même : il note les puces, sélectionne les meilleures dans la limite par entrée (`tailor_selection.py`), puis ajuste pour tenir sur une page (`page_fit.py`).
4. **Règles de sécurité :**
   - ne jamais décocher un élément verrouillé ;
   - **ne jamais masquer une expérience entière** (pour éviter un trou dans le parcours), mais réduire ses puces ;
   - garder l'ordre chronologique.
5. **Interface :**
   - la pré-sélection est une **proposition** sous forme de différences (+ ajouté / − retiré), avec la raison (« couvre : SQL, Power BI ») ;
   - boutons « accepter tout », « accepter » ou « refuser » par élément ;
   - la sélection est enregistrée par candidature, ce qui permet un historique offre ↔ CV.

---

## 5. Projets open source comparables

| Projet | Licence / ★ / activité (05/10/2026) | Approche analyse d'offre | Ce qu'il faut retenir |
|---|---|---|---|
| **Resume Matcher** (`srbhr/Resume-Matcher`) | Apache-2.0, **28 585★**. v1.3.0 « Crescendolls » du 06/09/2026, dernier push le 04/10/2026 : **actif**. | FastAPI + LiteLLM côté serveur, Next.js 16 + React 19 côté client. Plus de 100 LLM, dont Ollama en local et Claude Haiku 4.5 côté Anthropic. Extraction de l'offre par LLM : `required_skills`, `preferred_skills`, `key_responsibilities`, `experience_years`, `seniority_level`. Score ATS composite (§3.1). Notation des puces par LLM, avec repli sur les mots-clés. | **`resume_preservation.py`** : champs protégés (id, entreprise, intitulé, lieu, années), détection de **chiffres nouveaux** (`_novel_numbers`), seuil de similarité `_GROUNDING_REVIEW_THRESHOLD = 0.45`. Sous ce seuil, le texte source est restauré ou un avertissement « grounding review » est émis. Les prompts `CRITICAL_TRUTHFULNESS_RULES` interdisent d'ajouter une compétence, un outil ou une certification absents du CV d'origine, et d'inventer des résultats chiffrés. L'issue #1011 (ouverte le 30/09/2026) propose de séparer le score de mots-clés d'un « parse-check » déterministe d'extractibilité. |
| **Reactive Resume** (dépôt **déplacé** vers `reactive-resume/reactive-resume`) | MIT, **43 795★**. **v6.0.0 publiée le 04/10/2026**, la veille de ce rapport : très récente. | Assistant IA avec ton propre fournisseur (BYOK) : OpenAI, Anthropic, Gemini, OpenRouter, Ollama, endpoints compatibles. Correspondance de mots-clés avec l'offre et **vue du texte tel que lu par le logiciel de recrutement**. Vérificateur ATS public qui lit le PDF dans le navigateur, sans compte. | Modèle d'interface : **modifications proposées, montrées avec ce qui change et pourquoi, acceptées ou refusées une par une**. |
| **OpenResume** (`xitanggg/open-resume`) | AGPL-3.0, 8 912★. **Dernier commit le 29/10/2024 : non maintenu depuis près de 2 ans.** | Analyseur de PDF côté client (pdf.js) pour tester la lisibilité par un ATS. | Le test « mon PDF se relit-il correctement ? » est complémentaire de l'analyse d'offre. À prendre comme référence de conception, pas comme dépendance (et l'AGPL est contaminante). |
| **ats-screener** (`sunnypatell`) | MIT, 167★, push le 01/10/2026. | SvelteKit 5, TF-IDF maison + taxonomie. Le PDF est analysé dans le navigateur, puis **le texte extrait est noté côté serveur** par Gemini Flash Lite, avec repli sur Llama 3.3 70B via Groq ; Ollama possible en auto-hébergement. Simule six ATS. Compte gratuit requis sur le service hébergé. | Le README reconnaît que ce sont des **approximations**, faute de documentation des éditeurs. **Le texte du CV part chez Gemini ou Groq** dans la version hébergée. |
| **resume-match** (`anna123123123-creator`) | MIT, 0★, créé et poussé le 25/09/2026. | Navigateur seul, sans dépendance, couverture de fragments. | Référence minimale et honnête sur ses limites. Très récent, tokenisation anglaise. |
| **esco-skill-extractor** | MIT, 32★, dernier commit le 12/06/2025. | Python, embeddings + ESCO. | Le français n'est pas documenté ; modèle par défaut anglais. |
| **Jobscan** (commercial) | — | « Match rate » avec priorités (§1.2). | Bon modèle de priorisation, à ne pas recopier comme vérité. |

---

## 6. Utiliser un LLM (API Claude) : usages, garde-fous, confidentialité, clé API

### 6.1 Usages classés par rapport valeur / risque

| Usage | Risque | Contrainte de sortie |
|---|---|---|
| Structurer l'offre en JSON (intitulé, requis, souhaités, séniorité, langues) | Faible | Schéma JSON strict |
| Rapprocher les termes de l'offre et ton dictionnaire (synonymes, traductions FR/EN) | Faible | Ne renvoyer **que des `id` existants**, plus une liste `non_mappés` |
| Proposer une sélection d'éléments | Faible | **Uniquement des `id` de la base** : le modèle ne peut rien inventer |
| Reformuler une puce avec le vocabulaire de l'offre | **Moyen** (invention) | Comparaison avant/après, vérifications automatiques, validation manuelle |
| Rédiger le résumé ou l'accroche | Moyen | Mêmes garde-fous |

### 6.2 Garde-fous (repris de Resume Matcher et Reactive Resume)

- **Règles du prompt :**
  - ne rien ajouter (compétence, outil, chiffre, employeur, diplôme) qui ne figure pas dans la source ;
  - un mot-clé de l'offre non étayé va dans `non_etayes`, pas dans le texte ;
  - garder le français et le ton de l'utilisateur ;
  - éviter le style « IA » (Resume Matcher demande explicitement de retirer toute tournure qui sonne IA).
- **Vérifications automatiques côté client après chaque reformulation :**
  - (a) aucun nombre, pourcentage ou montant nouveau ;
  - (b) aucune compétence du dictionnaire absente des puces d'origine ;
  - (c) champs protégés (entreprise, dates, intitulé) jamais envoyés à la reformulation, ou restaurés ;
  - (d) similarité minimale avec la source (Resume Matcher utilise 0,45) ;
  - (e) longueur maximale.
  - Si une vérification échoue, la proposition est rejetée avec sa raison.
- **L'original est toujours conservé.** La reformulation acceptée devient une **variante** de la puce dans la base, réutilisable pour d'autres offres.
- **L'offre est une donnée non fiable.** Elle peut contenir des instructions cachées. La placer dans un bloc délimité et préciser dans le prompt qu'elle ne contient aucune instruction à suivre.

### 6.3 Confidentialité

- **API Anthropic** : les conditions commerciales, en vigueur depuis le 17/06/2025, interdisent à Anthropic d'entraîner ses modèles sur le contenu client issu des services.
- **Conservation** : les entrées et sorties de l'API sont supprimées sous 30 jours. Exceptions :
  - services à conservation plus longue sous ton contrôle (Files API) ;
  - accord de zéro conservation (ZDR) ;
  - application de la politique d'usage (jusqu'à 2 ans pour les entrées et sorties signalées) ;
  - obligation légale.
- **Minimisation** : n'envoyer que l'offre et les puces concernées. **Jamais** l'identité (nom, e-mail, téléphone, adresse, photo, âge). Option de pseudonymisation des employeurs.
- **Aperçu « voir ce qui sera envoyé »** avant chaque appel, et un interrupteur général « IA désactivée » par défaut.
- **Pour une confidentialité maximale** : LLM local via Ollama (pris en charge par Resume Matcher et Reactive Resume).

### 6.4 Gérer la clé API dans un outil personnel

- **Appel direct depuis le navigateur.** L'API accepte le CORS avec l'en-tête `anthropic-dangerous-direct-browser-access: true` (annoncé en août 2024 ; requête de pré-vérification testée avec succès le 05/10/2026). Le SDK JS propose l'option `dangerouslyAllowBrowser`. C'est acceptable **seulement avec ta propre clé** (BYOK) : n'importe qui ayant accès à la page peut lire une clé intégrée au code.
- **Options de stockage, de la plus sûre à la moins sûre :**
  1. **Petit proxy local** (`localhost`) qui lit la clé dans un `.env` ignoré par git. La clé ne passe jamais dans le navigateur. C'est l'option recommandée si l'outil tourne en local.
  2. Clé saisie à chaque session et gardée en mémoire ou en `sessionStorage`.
  3. `localStorage`, éventuellement chiffré avec une phrase secrète via WebCrypto. Le risque est une faille XSS, à limiter par une CSP stricte et l'absence de scripts tiers non nécessaires.
- **Hygiène :**
  - clé dédiée à l'outil et révocable ;
  - **plafond de dépenses mensuel personnalisé** : réglable dans la Console (Settings > Billing), sous le plafond de ton palier. Des limites par *Workspace* sont aussi possibles : un workspace dédié à l'outil permet de cantonner sa dépense ;
  - `.env` dans `.gitignore` ;
  - jamais de clé dans le dépôt ni dans un site publié.

### 6.5 Notes d'implémentation Claude

Tarifs Anthropic (référence de l'API Claude en cache au 25/09/2026), en $ par million de tokens (entrée / sortie) :

| Modèle | Identifiant | Entrée | Sortie |
|---|---|---|---|
| Claude Opus 5.5 | `claude-opus-5-5` | 4 | 20 |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | 2 | 10 |
| Claude Haiku 4.5 | `claude-haiku-4-5` | 1 | 5 |

- **Modèle configurable**, avec `claude-opus-5-5` par défaut (fidélité des reformulations). Le choix d'un modèle moins cher revient à l'utilisateur.
- **Ordre de grandeur par analyse** (≈ 6k tokens en entrée, 1,5k en sortie, sans les tokens de réflexion) : environ 0,014 $ avec Haiku 4.5, 0,027 $ avec Sonnet 5.5, 0,054 $ avec Opus 5.5. C'est une hypothèse, pas une mesure.
  - Sur Opus 5.5, la réflexion est toujours active et facturée au tarif de sortie : le coût réel sera supérieur.
- **Sortie JSON** : utiliser les sorties structurées `output_config: {format: …}`.
  - L'ancien paramètre `output_format` est déprécié.
  - Le pré-remplissage de la réponse (prefill) renvoie une erreur 400 sur les familles Opus et Sonnet 4.6 et suivantes, dont Opus 5.5 et Sonnet 5.5.
  - Sur Opus 5.5 et Sonnet 5.5, l'appel d'outil forcé (`tool_choice` `any` ou `tool`) renvoie aussi une erreur 400 : passer par les sorties structurées pour obtenir du JSON.
- **Réflexion et effort, selon le modèle :**
  - **Opus 5.5** : la réflexion ne peut pas être désactivée (`disabled` et `budget_tokens` renvoient une erreur 400). Régler la profondeur avec `output_config.effort`. La valeur par défaut est `medium` ; `low` convient pour l'extraction.
  - **Sonnet 5.5** : `thinking: {type: "disabled"}` renvoie une erreur 400. Pour couper la réflexion, utiliser `{type: "between_tools"}` (avec un effort `high` ou moins), ou garder la réflexion avec un effort `low`.
  - **Haiku 4.5** : `effort` **n'est pas accepté** (erreur). La réflexion, si on la veut, se règle avec `budget_tokens`. Le code doit donc adapter les paramètres au modèle choisi.
- **Mise en cache du prompt** : la base de CV, stable, peut servir de préfixe mis en cache. La taille minimale du préfixe dépend du modèle (de 512 à 4 096 tokens) ; un préfixe plus court n'est pas mis en cache, sans message d'erreur.
- **Afficher le coût réel** de chaque appel à partir du champ `usage` de la réponse.

---

## 7. Architecture proposée du module « analyse d'offre » en deux niveaux

```
                 ┌──────────────────────── Base CV (JSON local / IndexedDB) ─────────────────────┐
                 │ éléments {id, type, texte, date, skills[], verrouillé, variantes[]}            │
                 │ dictionnaire {id, label_fr, label_en, aliases[], type, escoUri?}               │
                 └──────────────────────────────────────┬──────────────────────────────────────────┘
 Offre (collée) ─► [N1] Normalisation FR ─► Découpe en rubriques + modalités ─► Extraction
                        (élisions, accents,     (titre/requis/souhaité/         a) dictionnaire (trie/Aho-Corasick
                         inclusif, termes        missions → poids)                 sur n-grammes 1-4, alias)
                         techniques protégés)                                    b) termes inconnus (heuristiques,
                                                                                    TF-IDF sur offres passées)
                     ─► Matching base (exact/alias/racine) ─► Score + rapport explicable
                     ─► Pré-sélection gloutonne sous contrainte ─► DIFF proposé ─► validation utilisateur
                     ─► Contrôles ATS (intitulé, sigle+forme longue, preuve en contexte, bourrage)
                     ─► Instantané « candidature » (offre + analyse + sélection) + export JSON
          (option N1b) Embeddings locaux Transformers.js (~118 Mo, chargé à la demande) → « équivalences probables » à confirmer

 [N2 – IA opt-in] interface LLMProvider { extractOffer, mapTerms, suggestSelection, rewriteBullet }
     implémentations : Anthropic (BYOK navigateur | proxy localhost), Ollama (local)
     ─► sorties JSON validées (schéma, output_config.format) ─► fusionnées dans les MÊMES structures que N1 (badge « IA »)
     ─► garde-fous post-reformulation (chiffres, compétences, champs protégés, similarité, longueur)
     ─► aperçu de la charge envoyée, identité masquée, coût affiché ; sans clé ou hors ligne → N1 seul
```

### Niveau 1 : sans IA, déterministe, hors ligne

- Module TS pur, exécuté dans un **Web Worker**, sans aucun appel réseau.
- Dictionnaire en JSON chargé au démarrage. Script hors ligne pour importer un sous-ensemble d'ESCO FR.
- **Boucle d'apprentissage** : chaque terme inconnu peut être rattaché à une compétence existante (nouvel alias), ajouté comme nouvelle compétence, ou ignoré (liste noire). Le module s'améliore à chaque offre analysée.
- Résultats **reproductibles** : même offre et même base donnent toujours le même score et la même suggestion. On peut écrire des tests unitaires sur des offres types.

### Niveau 2 : avec IA, optionnel

- Désactivé par défaut. Il n'ajoute que des **propositions** dans les structures du niveau 1, sans flux parallèle.
- Ordre d'implémentation conseillé :
  1. `extractOffer` ;
  2. `mapTerms` ;
  3. `suggestSelection` (id uniquement) ;
  4. `rewriteBullet` en dernier, avec tous les garde-fous.
- Les paramètres d'appel (réflexion, effort) dépendent du modèle (§6.5).

### Points à trancher dans le cahier des charges

- Métier ou domaine visé : il détermine le sous-ensemble ESCO ou ROME et les alias techniques.
- CV en FR seulement, ou FR et EN.
- Exécution : fichier local, `localhost` ou site statique hébergé. Cela change le stockage de la clé.
- IA souhaitée ou non, fournisseur (Claude ou local), budget mensuel (à reporter dans le plafond de dépenses de la Console).
- Embeddings locaux (environ 118 Mo à télécharger une fois) : oui ou non.
- Historique des candidatures voulu ou non.
- Format de sortie : PDF texte à une colonne, DOCX…

---

## Sources

**Pages et fichiers ouverts et lus :**
- https://github.com/srbhr/resume-matcher (et API GitHub : dépôt, releases, issue #1011)
- https://raw.githubusercontent.com/srbhr/Resume-Matcher/main/README.md ; …/apps/frontend/package.json ; …/apps/backend/pyproject.toml
- https://raw.githubusercontent.com/srbhr/Resume-Matcher/main/apps/backend/app/services/ats.py
- https://raw.githubusercontent.com/srbhr/Resume-Matcher/main/apps/backend/app/services/bullet_scoring.py
- https://raw.githubusercontent.com/srbhr/Resume-Matcher/main/apps/backend/app/services/tailor_selection.py
- https://raw.githubusercontent.com/srbhr/Resume-Matcher/main/apps/backend/app/services/page_fit.py
- https://raw.githubusercontent.com/srbhr/Resume-Matcher/main/apps/backend/app/services/resume_preservation.py
- https://raw.githubusercontent.com/srbhr/Resume-Matcher/main/apps/backend/app/prompts/refinement.py
- https://raw.githubusercontent.com/srbhr/Resume-Matcher/main/apps/backend/app/prompts/templates.py
- https://github.com/srbhr/Resume-Matcher/issues/1011
- https://github.com/reactive-resume/reactive-resume (ex-AmruthPillai/Reactive-Resume) et son README
- https://github.com/xitanggg/open-resume
- https://github.com/sunnypatell/ats-screener (README)
- https://github.com/anna123123123-creator/resume-match (README, branche master)
- https://github.com/KonstantinosPetrakis/esco-skill-extractor (README, branche master)
- https://github.com/INESCTEC/yake (ex-LIAAD/yake, via l'API GitHub)
- Registre npm : `natural`, `@orama/stemmers`, `@orama/stopwords`, `multilingual-stemmer`, `snowball-stemmer.jsx`, `node-lefff`, `nlp-js-tools-french`, `@huggingface/transformers`, recherche « yake »
- https://huggingface.co/Xenova/multilingual-e5-small (et API Hugging Face : fichiers ONNX) ; API Hugging Face `intfloat/multilingual-e5-small` (licence)
- https://huggingface.co/docs/transformers.js/en/index
- https://naturalnode.github.io/natural/stemmers.html ; code source `natural` (tokenizers)
- https://esco.ec.europa.eu/en/use-esco/download
- https://esco.ec.europa.eu/en/about-esco/escopedia/escopedia/esco-v121
- https://esco.ec.europa.eu/en/about-esco/escopedia/escopedia/esco-v12
- https://esco.ec.europa.eu/en/classification/skill_main
- https://esco.ec.europa.eu/en/use-esco/use-esco-services-api/esco-web-service-api
- https://ec.europa.eu/esco/api/doc/esco_api_doc.html (et test CORS sur `https://ec.europa.eu/esco/api/search`)
- https://www.data.gouv.fr/datasets/repertoire-operationnel-des-metiers-et-des-emplois-rome
- https://www.onetcenter.org/database.html
- https://lightcast.io/open-skills
- https://support.greenhouse.io/hc/en-us/articles/41396009937307-Talent-Matching
- https://www.greenhouse.com/product-features/greenhouse-real-talent ; https://www.greenhouse.com/real-talent-candidate-matching ; https://www.greenhouse.com/newsroom
- https://doc.workday.com/admin-guide/en-us/human-capital-management/recruiting/candidates/candidate-skills-match/ave1604091571278.html
- https://joshbersin.com/2024/03/workday-to-acquire-hiredscore-a-potential-shakeup-in-hr-technology/
- https://docs.oracle.com/en/cloud/saas/readiness/hcm/25d/recr-25d/25D-recruiting-wn-f39550.htm
- https://www.icims.com/blog/find-top-talent-in-seconds-with-ai/ (ouverte : ne confirme pas *Role Fit*)
- https://taleez.com/logiciel-de-recrutement/ia
- https://www.jobmentis.com/en/guide/teamtailor-ats
- https://www.jobscan.co/blog/top-resume-keywords-boost-resume/
- https://www.jobscan.co/jobscan-tutorial
- https://finance.yahoo.com/technology/ai/articles/job-seekers-hide-invisible-instructions-100000545.html
- https://arxiv.org/abs/2407.20371 (Wilson & Caliskan, AIES 2024)
- https://www.washington.edu/news/2024/10/31/ai-bias-resume-screening-race-gender/
- https://www.lewissilkin.com/insights/2026/07/27/the-digital-omnibus-on-ai-enters-into-force-today-102nedo
- https://lawandtechnology.eu/en/digital-omnibus-on-ai-official-journal-regulation-2026-1744/
- https://www.cnil.fr/fr/controles-prioritaires-2026
- https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data
- https://www.anthropic.com/legal/commercial-terms
- https://platform.claude.com/docs/en/api/rate-limits (plafonds de dépenses)
- https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/ (et test de pré-vérification CORS sur `api.anthropic.com/v1/messages`)
- Référence de l'API Claude (skill `claude-api`, cache du 25/09/2026) : tarifs, identifiants, `output_config`, prefill, réflexion et effort, cache de prompt

**Non ouvertes ou non concluantes (à revérifier) :**
- https://eur-lex.europa.eu/eli/dec/2011/833/oj/eng (page vide lors de la vérification)
- https://www.hlc.com/en/publications/eu-legislators-agree-to-delay-for-highrisk-ai-rules ; https://verifywise.ai/blog/eu-ai-act-omnibus-what-changed (non rouvertes ; dates confirmées par deux autres sources)
- https://www.data.gouv.fr/dataservices/api-repertoire-operationnel-des-metiers-et-des-emplois-rome-4-0
- https://www.jobscan.co/blog/can-ats-detect-ai-resume/ (non rouverte)
- Guide recrutement de la CNIL (janvier 2023) : non rouvert

---

## Vérification

*Contrôles faits le 2026-10-05. Le quota de recherche web de la session était épuisé : la vérification s'est faite par lecture directe des URL (WebFetch), par l'API GitHub, le registre npm et l'API Hugging Face, par des tests d'en-têtes HTTP, et par la référence de l'API Claude.*

| # | Affirmation contrôlée | Verdict | Détail / correction | Source |
|---|---|---|---|---|
| 1 | Greenhouse Talent Matching : 4 à 6 compétences pondérées, surlignage exact et similaire, 5 niveaux, « assistive AI », pas de rejet automatique | **Confirmé**, avec une nuance | « 4 à 6 » est une **recommandation**, pas une limite. Module complémentaire des offres Core, Plus et Pro. | support.greenhouse.io (MAJ 09/09/2026) |
| 2 | Real Talent « lancé le 3 juin 2025 » | **Non vérifiable** | Date absente de la page produit, de l'article d'aide et du newsroom. Retirée du texte. | greenhouse.com, newsroom |
| 3 | Workday Candidate Skills Match : ML, similarité de compétences, Skills Cloud requis, surveillance des biais, client responsable | **Confirmé** | — | doc.workday.com |
| 4 | Rachat de HiredScore par Workday « annoncé en mars 2024 » | **Nuancé** | L'article de J. Bersin du 01/03/2024 évoque une annonce « de la semaine » : fin février ou début mars 2024. Communiqué Workday non retrouvé. | joshbersin.com |
| 5 | iCIMS Role Fit : compétences générées à partir du texte complet du CV | **Non vérifiable** | Le billet iCIMS cité (2021) ne mentionne ni Role Fit ni cette déduction. Marqué « non vérifié » partout. | icims.com |
| 6 | Oracle 25D : agents Job Fit et Job Recommendations côté candidat, sans score chiffré | **Confirmé** | Fonction *AI Agent for Candidate Experience*. | docs.oracle.com |
| 7 | Taleez : « L'IA ne décide pas à votre place » | **Nuancé** | La formulation exacte dit « jamais » et non « pas ». Le reste est confirmé. | taleez.com |
| 8 | Teamtailor : ni score ni rejet automatique | **Nuancé** | Dit explicitement par JobMentis (page du 15/05/2026), source tierce ; non confirmé par l'éditeur. | jobmentis.com |
| 9 | Jobscan : 99,7 % / 76,4 / 59,7 / 55,3 / 50,6 / 44 % ; « 10,6 fois » ; match rate ≥ 75 % ; ordre de priorité ; ne pas tout ajouter | **Confirmé** (comme chiffres de l'éditeur) | Le seuil de 75 % et l'ordre de priorité viennent du tutoriel, pas de l'article de blog. | jobscan.co (blog et tutoriel) |
| 10 | Étude Duke : environ 200 000 CV, au moins 1 % avec injection de prompt ; Indeed détecte | **Confirmé** (source secondaire) | Rapporté par Yahoo Finance (10/08/2026). Indeed dit avoir mis en place des garde-fous. Étude primaire non consultée. | finance.yahoo.com |
| 11 | UW / AIES 2024 : modèles d'embeddings, prénoms « blancs » préférés dans 85,1 % des cas | **Confirmé** | Modèles d'embeddings massifs (MTE). Prénoms féminins préférés dans seulement 11,1 % des cas. | arxiv.org/abs/2407.20371, washington.edu |
| 12 | AI Act : règlement (UE) 2026/1744, JO du 24/07/2026, en vigueur le 27/07/2026, annexe III au 02/12/2027, article 50 maintenu au 02/08/2026 | **Confirmé** | Précisions ajoutées : annexe I au 02/08/2028 ; délai de grâce pour le marquage des contenus jusqu'au 02/12/2026. | lewissilkin.com, lawandtechnology.eu |
| 13 | CNIL : recrutement thème prioritaire 2026 (annonce du 03/04/2026), décisions automatisées, information des candidats, conservation, cibles grandes entreprises et cabinets | **Confirmé** | — | cnil.fr |
| 14 | ESCO v1.2.1 (décembre 2025), 13 939 compétences, 28 langues, téléchargement sur e-mail | **Confirmé** | v1.2.1 est une version mineure de qualité (pas d'ajout de contenu). | esco.ec.europa.eu |
| 15 | API ESCO : « CORS non documenté » | **Réfuté** (par test) | `Access-Control-Allow-Origin: *` renvoyé sur `/search` et en pré-vérification, le 05/10/2026. | Test HTTP |
| 16 | ESCO réutilisable selon la décision 2011/833/UE | **Non vérifiable** | La page EUR-Lex était vide ; la page de téléchargement ne cite que la gratuité. | esco.ec.europa.eu, eur-lex |
| 17 | ROME 4.0 : 14 301 appellations, 21 320 savoir-faire, 17 319 savoirs, Licence Ouverte, XLSX | **Confirmé** | Ajouts : 1 911 fiches, formats XLSX et PDF, mise à jour du 18/06/2026. | data.gouv.fr |
| 18 | O\*NET 31.0, CC BY 4.0, liste *Hot Technologies* | **Confirmé**, avec une nuance | Les *hot technologies* sont dans le fichier « Software Skills ». | onetcenter.org |
| 19 | Lightcast Open Skills : plus de 35 000 compétences, API gratuite sur inscription | **Nuancé** | La page annonce **34 000+**. Inscription requise ; gratuité confirmée seulement pour les organisations d'intérêt général. | lightcast.io |
| 20 | YAKE : pas de portage JS trouvé | **Réfuté** | Portages sur npm : `yake-ts`, `@ade_oshineye/yaket`, `@seanmozeik/yake-ts`, `yake-wasm`. Dépôt déplacé vers `INESCTEC/yake`. | Registre npm, API GitHub |
| 21 | Bibliothèques JS FR (`natural`, `@orama/*`, `snowball-stemmer.jsx`, `multilingual-stemmer`, `node-lefff`, `nlp-js-tools-french`) | **Nuancé** | Toutes existent. `natural` (février 2026) et `multilingual-stemmer` (août 2026) sont actifs ; `@orama` a eu sa dernière version en décembre 2025 (28 racinisations et 31 listes de mots vides, FR inclus). `snowball-stemmer.jsx` (2015), `nlp-js-tools-french` (2017) et `node-lefff` (2021, LGPL-3.0) sont abandonnés. `AggressiveTokenizerFr` existe dans le code de `natural`. | Registre npm, code de `natural` |
| 22 | `Xenova/multilingual-e5-small` : taille et licence non vérifiées | **Complété** | Version quantifiée d'environ 118 Mo (fp16 environ 235 Mo, fp32 environ 470 Mo). Modèle de base sous MIT. Transformers.js en v4.3.0 (Apache-2.0). Le `q8` par défaut n'a pas été revérifié pour la v4. | API Hugging Face, npm |
| 23 | esco-skill-extractor : MIT, 32★, seuils 0,6 et 0,55, `all-MiniLM-L6-v2` | **Confirmé**, avec une nuance | 0,55 est le seuil pour les **métiers**. Dernier commit le 12/06/2025. | README, API GitHub |
| 24 | Resume Matcher : Apache-2.0, environ 28,6k★, v1.3, Next.js 16, LiteLLM, Ollama, Claude Haiku 4.5, formule 0,55 / 0,25 / 0,20, repli à 20 points, `_novel_numbers`, seuil 0,45, `CRITICAL_TRUTHFULNESS_RULES`, consigne anti-style IA, `max_per_entry`, `page_fit.py` | **Confirmé** | 28 585★, v1.3.0 du 06/09/2026, actif (push du 04/10/2026). Nuance : `keyword_match` et les compétences de l'offre viennent du pipeline LLM ; le seuil de 0,45 déclenche une restauration ou un avertissement selon le champ. | Code source, API GitHub |
| 25 | Issue #1011 (30/09/2026) : séparer le score de mots-clés d'un parse-check | **Confirmé** | Elle propose aussi un serveur MCP et un backend PostgreSQL optionnel. | github.com |
| 26 | Reactive Resume v6 : MIT, environ 43,8k★, BYOK multi-fournisseurs, mots-clés de l'offre, vue du texte lu par l'ATS, vérificateur PDF dans le navigateur, modifications acceptées ou refusées | **Confirmé**, avec des nuances | Dépôt **déplacé** vers `reactive-resume/reactive-resume`. v6.0.0 publiée le 04/10/2026 seulement. 43 795★. | README, API GitHub |
| 27 | OpenResume : AGPL-3.0, environ 8,9k★ | **Confirmé**, avec une nuance | **Dernier commit le 29/10/2024** : non maintenu. | API GitHub |
| 28 | ats-screener : MIT, 167★, TF-IDF + taxonomie, Gemini, six ATS, approximations | **Confirmé**, avec des nuances | Repli sur Llama 3.3 via Groq, Ollama en auto-hébergement, compte requis. Le PDF est analysé localement, mais le texte extrait est envoyé au LLM côté serveur. | README |
| 29 | resume-match : MIT, 0★, fragments couverts au-delà de 50 % | **Confirmé** | Créé le 25/09/2026 ; tokenisation anglaise (et bigrammes chinois). | README, API GitHub |
| 30 | Anthropic : pas d'entraînement sur le contenu client (conditions du 17/06/2025) ; suppression sous 30 jours et exceptions | **Confirmé** | Précision : conservation jusqu'à 2 ans en cas de violation de la politique d'usage. | anthropic.com/legal, privacy.claude.com |
| 31 | En-tête CORS `anthropic-dangerous-direct-browser-access` (août 2024), `dangerouslyAllowBrowser` | **Confirmé** | Billet du 23/08/2024. Pré-vérification acceptée le 05/10/2026. | simonwillison.net, test HTTP |
| 32 | Plafond de dépenses dans la Console « (non vérifié) » | **Confirmé** | Limite mensuelle personnalisable sous le plafond du palier (Settings > Billing), plus limites par *Workspace*. | platform.claude.com/docs/en/api/rate-limits |
| 33 | Tarifs et identifiants : Opus 5.5 (4 / 20 $), Sonnet 5.5 (2 / 10 $), Haiku 4.5 (1 / 5 $) ; estimations 0,014 / 0,027 / 0,054 $ | **Confirmé** | Calculs refaits et justes. | Référence de l'API Claude (cache du 25/09/2026) |
| 34 | `output_config.format` ; `output_format` déprécié ; prefill refusé ; réflexion non désactivable sur Opus 5.5 ; `effort` ; taille minimale de cache | **Confirmé**, avec des compléments | Ajouts : effort par défaut `medium` sur Opus 5.5 ; `tool_choice` forcé refusé (400) sur Opus 5.5 et Sonnet 5.5 ; Sonnet 5.5 se coupe avec `between_tools` ; Haiku 4.5 refuse `effort` ; cache à partir de 512 à 4 096 tokens selon le modèle. | Référence de l'API Claude |
| 35 | « 75 % des CV rejetés par les ATS » | **Non vérifiable** | Aucune source primaire : déjà signalé comme mythe, à ne pas reprendre. | — |