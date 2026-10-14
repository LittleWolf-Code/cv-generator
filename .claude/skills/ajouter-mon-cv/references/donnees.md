# Données des propositions : formes, correspondances, limites

À lire avant la première proposition. Les exemples sont **fictifs**. Le lot de la section 2 a été soumis tel quel au serveur sur une copie de la persona fictive « courte » : chaque élément est créé, sauf la langue et le centre d'intérêt, que cette persona contient déjà (`duplicateOf`).

## Sommaire

1. Règles communes
2. Exemple de lot `propose_item` (bilingue, avec tags, compétences liées, alias et termes voisins)
3. Exemples de la seconde passe (`propose_edit` des compétences, `propose_alias`)
4. Traduction : règles et correspondances
5. Tags
6. Compétences : forme longue, alias, termes voisins, formes proches
7. Correspondances : dates, contrats, CECRL, langues, catégories
8. Clés de doublon (identiques à celles du serveur)
9. Limites

## 1. Règles communes

- **Champ bilingue** : `{ "fr": "…", "en": "…" }`, **les deux langues remplies**. La langue du CV est recopiée mot pour mot ; l'autre est la traduction de Claude (section 4). `null` seulement pour une traduction écartée par le serveur, qui se reprend à la seconde passe, jamais `""`.
- **Dates** : `AAAA-MM`, ou `AAAA` si le mois n'est pas écrit et que l'utilisateur ne l'a pas donné. Un poste en cours a `"end": null`. Le garde-fou vérifie que chaque année figure dans `userStatement`.
- **Pas d'identifiant** dans `data` (le serveur les attribue), ni `locked`, ni `archived`.
- **`tags`** : sur chaque élément et chaque puce (section 5). Le serveur ne les compare pas à la source : leur justesse dépend de Claude.
- **`skills`** : les identifiants des compétences **déjà dans la bibliothèque** dont le nom court ou un alias apparaît dans le texte de l'élément ou de la puce. Une compétence proposée dans le même lot n'a pas encore d'identifiant : elle se relie à la seconde passe.
- **Puce** : `{ "tags": […], "skills": […], "variants": [ { "text": { "fr": "…", "en": "…" } } ] }`, une seule variante, recopiée mot pour mot dans la langue du CV. La variante reçoit l'identifiant `principale`.
- **`userStatement`** : le passage du CV entre « », puis les précisions de l'utilisateur entre « ». Les sauts de ligne sont fusionnés par le serveur. Tout chiffre, toute compétence et toute URL de `data`, **dans les deux langues**, doivent y correspondre. Le serveur lit aussi comme une compétence un domaine ou une notion nommés dans une forme longue, une traduction ou un terme voisin (« dispositifs médicaux » → DM) : citez alors en plus le passage du CV qui en parle (un autre passage du même CV convient), ou raccourcissez le texte.

## 2. Exemple de lot `propose_item`

La bibliothèque contient déjà les compétences `sk-c` (C), `sk-cicd` (CI/CD), `sk-gitlab-ci` (GitLab CI) et `std-iec62304` (IEC 62304), lues avec `get_library`. Le CV cite aussi « IEC 62366-1 » et « AMDEC », absentes de la bibliothèque : elles sont proposées dans le lot, et seront reliées à la seconde passe.

```json
{
  "items": [
    {
      "type": "title",
      "source": "dictee",
      "userStatement": "Extrait du CV (copié mot pour mot) : « Ingénieure logiciel embarqué »",
      "rationale": "Import du CV joint, en-tête",
      "data": {
        "tags": ["embarque"],
        "variants": [{ "text": { "fr": "Ingénieure logiciel embarqué", "en": "Embedded Software Engineer" } }]
      }
    },
    {
      "type": "summary",
      "source": "dictee",
      "userStatement": "Extrait du CV (copié mot pour mot) : « Ingénieure logiciel spécialisée en dispositifs médicaux de classe IIa : C embarqué, conformité IEC 62304 et automatisation des tests. »",
      "rationale": "Import du CV joint, profil",
      "data": {
        "tags": ["dm", "embarque"],
        "variants": [
          {
            "text": {
              "fr": "Ingénieure logiciel spécialisée en dispositifs médicaux de classe IIa : C embarqué, conformité IEC 62304 et automatisation des tests.",
              "en": "Software engineer specialising in Class IIa medical devices: embedded C, IEC 62304 compliance and test automation."
            }
          }
        ]
      }
    },
    {
      "type": "experience",
      "source": "dictee",
      "userStatement": "Extrait du CV (copié mot pour mot) : « Ingénieure logiciel embarqué – Exemple Santé SAS, Lyon (CDI) – 02/2023 – aujourd'hui. Mise en conformité IEC 62304 (classe B) du logiciel d'une pompe à perfusion. Chaîne CI/CD sous GitLab CI : validation d'une version ramenée de 3 jours à 4 heures. » Précisions de l'utilisateur dans la conversation : « Lyon, en France »",
      "rationale": "Import du CV joint, expérience professionnelle",
      "data": {
        "position": { "fr": "Ingénieure logiciel embarqué", "en": "Embedded Software Engineer" },
        "organization": "Exemple Santé SAS",
        "location": { "city": "Lyon", "country": { "fr": "France", "en": "France" } },
        "contract": "cdi",
        "start": "2023-02",
        "end": null,
        "tags": ["dm", "embarque"],
        "skills": ["std-iec62304", "sk-cicd", "sk-gitlab-ci"],
        "bullets": [
          {
            "tags": ["reglementaire"],
            "skills": ["std-iec62304"],
            "variants": [
              {
                "text": {
                  "fr": "Mise en conformité IEC 62304 (classe B) du logiciel d'une pompe à perfusion",
                  "en": "Brought infusion-pump software into IEC 62304 (Class B) compliance"
                }
              }
            ]
          },
          {
            "tags": ["devops", "tests"],
            "skills": ["sk-cicd", "sk-gitlab-ci"],
            "variants": [
              {
                "text": {
                  "fr": "Chaîne CI/CD sous GitLab CI : validation d'une version ramenée de 3 jours à 4 heures",
                  "en": "Built a CI/CD pipeline on GitLab CI: release validation cut from 3 days to 4 hours"
                }
              }
            ]
          }
        ]
      }
    },
    {
      "type": "education",
      "source": "dictee",
      "userStatement": "Extrait du CV (copié mot pour mot) : « 2016 – 2019 : Diplôme d'ingénieur en génie biomédical, École Exemple d'Ingénieurs (Grenoble) » Précisions de l'utilisateur dans la conversation : « de septembre 2016 à septembre 2019 ; c'est un Bac+5, grade de master ; en France »",
      "rationale": "Import du CV joint, formation",
      "data": {
        "degree": { "fr": "Diplôme d'ingénieur", "en": "Diplôme d'Ingénieur" },
        "field": { "fr": "génie biomédical", "en": "Biomedical Engineering" },
        "institution": "École Exemple d'Ingénieurs",
        "location": { "city": "Grenoble", "country": { "fr": "France", "en": "France" } },
        "start": "2016-09",
        "end": "2019-09",
        "levelEquivalent": { "fr": "Bac+5, grade de master", "en": "Master's degree in Engineering, EQF level 7" },
        "tags": ["dm"]
      }
    },
    {
      "type": "project",
      "source": "dictee",
      "userStatement": "Extrait du CV (copié mot pour mot) : « Moniteur ECG libre (2020) – développeuse principale : traitement du signal en C sur microcontrôleur ARM Cortex-M4. »",
      "rationale": "Import du CV joint, projets",
      "data": {
        "name": { "fr": "Moniteur ECG libre", "en": "Open-source ECG monitor" },
        "role": { "fr": "développeuse principale", "en": "Main developer" },
        "start": "2020",
        "end": "2020",
        "tags": ["dm", "embarque"],
        "skills": ["sk-c"],
        "bullets": [
          {
            "tags": ["embarque"],
            "skills": ["sk-c"],
            "variants": [
              {
                "text": {
                  "fr": "Traitement du signal en C sur microcontrôleur ARM Cortex-M4",
                  "en": "Signal processing in C on an ARM Cortex-M4 microcontroller"
                }
              }
            ]
          }
        ]
      }
    },
    {
      "type": "skill",
      "source": "dictee",
      "userStatement": "Extraits du CV (copiés mot pour mot) : « Normes : IEC 62304, IEC 62366-1 » « Ingénieure logiciel spécialisée en dispositifs médicaux de classe IIa »",
      "rationale": "Import du CV joint, compétences",
      "data": {
        "category": "reglementaire",
        "short": "IEC 62366-1",
        "code": "IEC 62366-1",
        "long": {
          "fr": "ingénierie de l'aptitude à l'utilisation des dispositifs médicaux",
          "en": "usability engineering for medical devices"
        },
        "aliases": ["CEI 62366-1", "EN 62366-1", "NF EN 62366-1"],
        "related": ["aptitude à l'utilisation", "usability engineering"]
      }
    },
    {
      "type": "skill",
      "source": "dictee",
      "userStatement": "Extrait du CV (copié mot pour mot) : « Méthodes : AMDEC, TDD »",
      "rationale": "Import du CV joint, compétences",
      "data": {
        "category": "methodes",
        "short": "AMDEC",
        "long": {
          "fr": "analyse des modes de défaillance, de leurs effets et de leur criticité",
          "en": "failure mode, effects and criticality analysis"
        },
        "aliases": ["FMECA"],
        "related": ["AMDE", "analyse de risques", "risk analysis"]
      }
    },
    {
      "type": "certification",
      "source": "dictee",
      "userStatement": "Extrait du CV (copié mot pour mot) : « Certified ScrumMaster – Scrum Alliance, juin 2021 »",
      "rationale": "Import du CV joint, certifications",
      "data": {
        "name": { "fr": "Certified ScrumMaster", "en": "Certified ScrumMaster" },
        "issuer": "Scrum Alliance",
        "date": "2021-06",
        "tags": ["agile"]
      }
    },
    {
      "type": "language",
      "source": "dictee",
      "userStatement": "Extrait du CV (copié mot pour mot) : « Anglais : courant (TOEIC 945) » Précisions de l'utilisateur dans la conversation : « niveau C1 »",
      "rationale": "Import du CV joint, langues",
      "data": {
        "code": "en",
        "language": { "fr": "Anglais", "en": "English" },
        "cefr": "C1",
        "certification": { "name": "TOEIC", "score": "945" }
      }
    },
    {
      "type": "interest",
      "source": "dictee",
      "userStatement": "Extrait du CV (copié mot pour mot) : « Course à pied (semi-marathon) »",
      "rationale": "Import du CV joint, centres d'intérêt",
      "data": {
        "text": { "fr": "Course à pied", "en": "Running" },
        "detail": { "fr": "semi-marathon", "en": "half marathon" }
      }
    }
  ]
}
```

« TDD » et « IEC 62304 », déjà dans la bibliothèque, ne sont pas reproposés. Pour une norme, la clé `edition` n'est permise que si le CV l'écrit **et** qu'elle figure dans la table A.2 de `get_guidelines` (par exemple `ISO 14971` → `2019`). Sinon, omettez-la.

## 3. Exemples de la seconde passe

Après validation, `get_library({ view: "index", collections: ["skills"] })` donne les identifiants des nouvelles compétences (ici, par exemple, `sk-amdec`).

**Relier une compétence** à un élément ou à une puce : `newValue` = les identifiants déjà liés **plus** les nouveaux. Le serveur refuse le lien si `userStatement` ne cite pas le passage où la compétence apparaît.

```json
{
  "target": { "collection": "experiences", "itemId": "exp-exemple-sante-2023", "bulletId": "b-exemple-sante-pompe" },
  "field": "skills",
  "newValue": ["std-iec62304", "sk-amdec"],
  "rationale": "« AMDEC » apparaît dans la puce",
  "userStatement": "Passage du CV (copié mot pour mot) : « AMDEC du logiciel de la pompe à perfusion »"
}
```

L'avertissement « texte éloigné de la source » qui accompagne un lien de compétence est attendu : il compare des identifiants, pas des phrases.

**Terme voisin mis de côté** (une autre compétence, que `propose_item` aurait prise pour une compétence non déclarée) : `propose_alias({ skillId: "sk-jenkins", alias: "GitHub Actions", kind: "related", rationale: "outil d'intégration continue voisin, souvent cité dans les offres" })`.

## 4. Traduction : règles et correspondances

Le but : que l'export anglais soit possible dès la validation, sans seconde saisie. La traduction n'ajoute **rien** : mêmes faits, même portée, mêmes chiffres.

- **Anglais britannique (en-GB) par défaut** : _specialising_, _organisation_, _licence_, _programme_. En-US seulement si l'utilisateur vise les États-Unis (la bibliothèque n'a qu'un texte anglais ; l'orthographe de l'autre variante n'est qu'un avertissement).
- **Inchangés** : chiffres, unités, sigles, noms de normes, noms propres (organisations, produits, outils), classes de dispositif (`classe IIa` → `Class IIa`, jamais une autre classe).
- **Puces** : style d'un CV anglais, verbe d'action en tête (_Led_, _Built_, _Cut_), au passé, ou au présent pour le poste en cours, sans « I ». 200 caractères au plus, comme en français. Un nom de domaine ou de compétence qui n'est pas dans la phrase française n'entre pas dans la phrase anglaise : le serveur le détecterait (« _Medical Device Software_ » est lu comme la compétence MDSW).
- **Poste** : l'intitulé anglais **reconnu** trouvé à l'étape de recherche (references/recherche.md), en _Title Case_, au même niveau de séniorité. Jamais _Senior_, _Lead_, _Head_ ou _Manager_ que le français ne dit pas.
- **Diplôme** (`get_guidelines`) : `degree.en` garde l'intitulé français (« Diplôme d'Ingénieur », « Licence », « Master », « BTS ») ; `field.en` traduit le domaine ; `levelEquivalent.en` donne le repère international, **seulement si l'utilisateur a confirmé le niveau** :

  | Niveau français             | `levelEquivalent.en`                          |
  | --------------------------- | --------------------------------------------- |
  | Bac                         | `Upper secondary qualification, EQF level 4`  |
  | Bac+2 (BTS, DUT)            | `Short-cycle higher education, EQF level 5`   |
  | Bac+3 (Licence, BUT)        | `Bachelor's degree, EQF level 6`              |
  | Bac+5 (Master)              | `Master's degree, EQF level 7`                |
  | Bac+5 (Diplôme d'ingénieur) | `Master's degree in Engineering, EQF level 7` |
  | Doctorat                    | `Doctorate, EQF level 8`                      |

  Jamais « Bac+5 » en anglais. Le chiffre du niveau EQF est admis par le garde-fou.

- **Mention** : `with honours (mention bien)`, la mention française entre parenthèses.
- **Pays et langues** : nom anglais usuel (`Allemagne` → `Germany`, `Anglais` → `English`). La ville (`city`) n'est pas bilingue.
- **Certification** : son nom officiel, identique dans les deux langues s'il est anglais ; sinon le nom anglais officiel s'il existe, à défaut une traduction fidèle.
- **Projet** : un nom propre reste identique ; un nom descriptif se traduit.
- **CV en anglais** : même démarche dans l'autre sens, le français est la traduction.

## 5. Tags

Les tags rangent la bibliothèque : filtre de `get_library({ tags })`, « cocher par tag » dans un preset, et **durées par tag** que le serveur calcule (« 6 ans en `dm` ») et qu'une accroche peut citer. Un tag sur une expérience revient donc à dire « ce temps compte dans ce domaine » : c'est une affirmation, à poser seulement quand le texte de l'élément ou l'utilisateur le dit.

- **Format** : identifiant en minuscules, sans accent, mots séparés par des tirets (`gestion-projet`, `reglementaire`), en français.
- **Réutilisez d'abord les tags existants** (vue `index` de `get_library`), pour garder un seul vocabulaire. Pas de quasi-doublon (`test` à côté de `tests`, `qualité` à côté de `qualite`).
- **Où et combien** : 1 à 3 par expérience, formation, projet, certification, titre et accroche ; 0 à 2 par puce. Rien sur les compétences (leur catégorie suffit), les langues ni les centres d'intérêt.
- **Quoi** : le domaine ou le secteur sur un élément (`dm`, `sante`, `embarque`, `aeronautique`, `data`) ; l'activité sur une puce (`reglementaire`, `tests`, `qualite`, `devops`, `gestion-projet`, `management`, `recherche`).
- **Jamais un nom de compétence** (`python`, `iec-62304`) : la compétence se relie par `skills`, et le serveur refuse un tag qui nomme une compétence absente de la source.
- **Élément existant sans tag** : `propose_edit({ field: "tags", newValue: [...] })`, seulement pour les éléments que le CV concerne. L'avertissement de similarité est attendu.

## 6. Compétences : forme longue, alias, termes voisins, formes proches

| Champ     | Ce qu'il contient                                                                                                                | Compte pour la couverture d'une offre | Exemples                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `long`    | forme longue d'un sigle, bilingue ; `null` si `short` n'est pas un sigle                                                         | oui                                   | AMDEC → analyse des modes de défaillance… / failure mode, effects and criticality analysis |
| `aliases` | **équivalent strict** : autre graphie officielle, préfixe NF, EN ou CEI, sigle anglais du même concept, nom avec ou sans éditeur | oui                                   | IEC 62304 → CEI 62304, NF EN 62304 ; AMDEC → FMECA ; Excel → Microsoft Excel               |
| `related` | terme **voisin** : plus large, plus étroit, historique, ou mot générique des offres                                              | jamais                                | CI/CD → intégration continue, continuous integration ; AMDEC → AMDE, analyse de risques    |

- **Forme longue** : remplissez-la pour un sigle sans ambiguïté dans le domaine du CV ; demandez à l'utilisateur pour un sigle à plusieurs sens (SI, PLM dans un autre contexte…). `get_guidelines` exige « sigle et forme longue au moins une fois » : c'est utile à la lecture ATS.
- **Alias** : un alias rend un terme d'offre « couvert ». Un faux alias ferait croire à une compétence que la personne n'a pas : en cas de doute, c'est un terme voisin. Le serveur refuse un alias qui est une autre compétence connue (« Java » pour Python).
- **Termes voisins** : 2 à 5 par compétence, choisis parmi ceux que les offres emploient (recherche, étape 4). Dans `propose_item`, n'y mettez que des termes génériques : un terme voisin qui est lui-même un outil, un langage, une norme ou une méthode (GitHub Actions, Kubernetes, ISO 9001) est lu comme une compétence non déclarée, et **toute la compétence est rejetée**. Mettez-le de côté pour la seconde passe (`propose_alias`, `kind: "related"`), qui l'accepte.
- **Formes proches d'une compétence existante** : le serveur ne reconnaît que les formes identiques (sans accent, casse ni ponctuation). « Python 3 » à côté de « Python », « MS Excel » à côté de « Excel », « gestion de projets » à côté de « gestion de projet » deviendraient une seconde compétence. Proposez plutôt la forme du CV comme alias de la compétence existante (`propose_alias`, `kind: "alias"`), ou comme terme voisin si elle est plus large ou plus étroite. Deux compétences distinctes (JavaScript et TypeScript, Excel et VBA) restent distinctes.

## 7. Correspondances

**Dates.**

| Dans le CV                                                            | Valeur                                     |
| --------------------------------------------------------------------- | ------------------------------------------ |
| `02/2023`, `février 2023`, `févr. 2023`, `Feb 2023`                   | `2023-02`                                  |
| `2023` seul                                                           | `2023`, ou le mois que l'utilisateur donne |
| `aujourd'hui`, `présent`, `en cours`, `depuis 2023`, `present`, `now` | `end: null`                                |
| `2019 – 2021` pour une formation                                      | `start: "2019"`, `end: "2021"`             |

**Contrats.** CDI → `cdi` · CDD → `cdd` · Stage → `stage` · Alternance ou apprentissage → `alternance` · Freelance, indépendant ou auto-entrepreneur → `freelance` · Intérim → `interim` · Thèse, doctorat ou CIFRE → `these`. Rien d'écrit : demandez, sinon `null`. Le contrat est une énumération, traduite au rendu : rien à traduire.

**Niveaux CECRL (`cefr`).** `A1` à `C2` tels quels. « Langue maternelle » ou « natif » → `native`. « Courant », « bilingue », « bon niveau », « notions » ou un score (TOEIC, IELTS, TOEFL) **ne se convertissent pas** : demandez le niveau CECRL. Un score va dans `certification` (`name`, `score`, `year` au format `AAAA`).

**Codes de langue (ISO 639-1).** français `fr` · anglais `en` · espagnol `es` · allemand `de` · italien `it` · portugais `pt` · néerlandais `nl` · chinois `zh` · japonais `ja` · arabe `ar` · russe `ru`.

**Catégories de compétences.** Utilisez les identifiants **réellement présents** dans la collection `categories` (`get_library`). Ceux créés par défaut :

| Identifiant     | Contenu                                                         | Exemples                                                 |
| --------------- | --------------------------------------------------------------- | -------------------------------------------------------- |
| `langages`      | langages de programmation et de requête                         | C, C++, Python, Java, SQL                                |
| `outils`        | logiciels, outils, environnements, plateformes, frameworks      | Git, GitLab CI, Docker, MATLAB, Jira, LabVIEW            |
| `methodes`      | méthodes et pratiques                                           | Agile, Scrum, TDD, CI/CD, cycle en V, AMDEC              |
| `reglementaire` | normes et réglementation (section « Normes et réglementation ») | ISO 13485, IEC 62304, ISO 14971, règlement (UE) 2017/745 |

Seule `reglementaire` alimente la section « Normes et réglementation » du CV : une norme ou un règlement va toujours dans `reglementaire`, jamais dans une nouvelle catégorie « Réglementation ».

**Nouvelle catégorie.** Les savoir-être et les compétences métier sans catégorie adaptée se signalent à l'utilisateur. S'il l'accepte, proposez la catégorie, puis ses compétences dans un appel **séparé** (SKILL.md, étape 7). Le serveur attribue l'identifiant, de la forme `cat-<slug>` (`cat-electronique`) : ne l'inventez jamais, lisez-le dans l'`itemId` du résultat. Une catégorie créée dans l'interface a la même forme. Exemple fictif, soumis tel quel au serveur sur une copie de la persona « courte » :

```json
{
  "items": [
    {
      "type": "category",
      "source": "dictee",
      "userStatement": "Précisions de l'utilisateur dans la conversation : « Oui, crée une catégorie Électronique. »",
      "rationale": "Import du CV joint, compétences",
      "data": { "label": { "fr": "Électronique", "en": "Electronics" } }
    }
  ]
}
```

Résultat : `created`, `itemId: "cat-electronique"`. Appel suivant :

```json
{
  "items": [
    {
      "type": "skill",
      "source": "dictee",
      "userStatement": "Extrait du CV (copié mot pour mot) : « Électronique : KiCad »",
      "rationale": "Import du CV joint, compétences",
      "data": {
        "category": "cat-electronique",
        "short": "KiCad",
        "long": null,
        "aliases": [],
        "related": ["CAO électronique", "PCB design"]
      }
    }
  ]
}
```

Résultat : `created`, avec `dependsOn` = la proposition de la catégorie. Dans « À valider », la compétence s'accepte avec sa catégorie, ou après elle. Si l'utilisateur rejette la catégorie, la compétence reste en attente, non applicable : il la modifie (autre catégorie) puis l'accepte, ou la rejette.

## 8. Clés de doublon

Le serveur compare sans accents, sans casse et sans ponctuation. Les formes proches (section 6) ne sont pas des doublons pour lui : c'est à Claude de les repérer.

| Type                   | Doublon si…                                                | Ce que fait le serveur avec un élément validé                                                           |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| experience             | même `organization` **et** dates qui se chevauchent        | puces identiques ignorées ; puce proche (≥ 60 % de mots communs) → variante ; autres puces → complément |
| education              | même `institution` **et** même `degree`                    | idem pour les puces ; sinon rien                                                                        |
| project, certification | même `name`                                                | idem pour les puces (projet) ; sinon rien                                                               |
| skill                  | `short` ou un alias identique                              | une nouvelle forme devient un **alias**                                                                 |
| language               | même `code`                                                | rien (un champ vide se complète par `propose_edit`)                                                     |
| interest               | même `text`                                                | rien                                                                                                    |
| title, summary         | même texte                                                 | rien (une autre formulation : `propose_variant`)                                                        |
| category               | même `label`, en FR ou en EN (comparés dans les deux sens) | rien ; `itemId` donne l'identifiant à viser dans `category` des compétences                             |

Un doublon d'une **proposition en attente** ne crée rien. Un doublon **dans le même lot** non plus : il renvoie le premier. Pour une catégorie en attente, `duplicateOf` est l'ULID de sa proposition : visez toujours son `itemId`.

## 9. Limites

| Limite                                                                | Valeur                                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| éléments par `propose_item`, `propose_variant`, `propose_translation` | 25                                                                                   |
| `propose_alias`, `propose_edit`                                       | 1 par appel                                                                          |
| `userStatement`                                                       | 4 000 caractères                                                                     |
| puce                                                                  | 200 caractères, dans chaque langue                                                   |
| accroche (`summary`)                                                  | 285 caractères, dans chaque langue                                                   |
| `get_items`                                                           | 30 identifiants                                                                      |
| `get_library`                                                         | 500 éléments par page, réponse tronquée vers 30 000 caractères (suivre `nextCursor`) |
