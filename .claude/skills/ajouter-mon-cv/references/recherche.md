# Recherche des intitulés et des termes

À lire avant l'étape 4. Une traduction mot à mot d'un intitulé français donne souvent un intitulé que personne ne cherche (« Chargée d'affaires réglementaires » → _Regulatory Business Officer_, au lieu de _Regulatory Affairs Specialist_). Un recruteur, ou un ATS, cherche les intitulés et les termes **du marché**. Cette recherche sert à les trouver, sans rien changer aux faits.

## Ce qu'on cherche, et ce qu'on en fait

| Pour…             | On cherche                                                        | Ça devient                                                                   |
| ----------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| chaque poste      | l'intitulé anglais reconnu ; l'intitulé français usuel des offres | `position.en` ; des titres de CV candidats                                   |
| chaque diplôme    | le nom anglais du domaine ; le niveau EQF                         | `field.en`, `levelEquivalent.en` (table de references/donnees.md, section 4) |
| le titre du CV    | 2 ou 3 intitulés du marché qui décrivent vraiment le profil       | des éléments `title` (fr + en), **seulement ceux que l'utilisateur choisit** |
| chaque compétence | la forme longue, les autres graphies, les termes des offres       | `long`, `aliases`, `related`                                                 |

Ce que la recherche ne change jamais : `position.fr` reste l'intitulé du CV, mot pour mot. C'est le poste réellement occupé, un fait sensible. Un intitulé du marché plus flatteur ne le remplace pas.

## Sources, dans cet ordre

1. **ESCO**, la classification européenne des métiers et compétences : libellés officiels en français et en anglais, avec leurs variantes. Gratuite, sans clé.
   - Recherche d'un métier : `https://ec.europa.eu/esco/api/search?text=<intitulé encodé>&language=fr&type=occupation&limit=5`. Chaque résultat a `title`, `uri` et `preferredLabel` dans chaque langue (`fr`, `en`…).
   - Détail d'un métier : `https://ec.europa.eu/esco/api/resource/occupation?uri=<uri>&language=en`. Les champs utiles sont `preferredLabel`, `alternativeLabel` (listes `fr` et `en`) et `description`.
   - Compétences : même chose avec `type=skill` et `resource/skill`.
   - Le classement est approximatif. Pour « ingénieur qualité logiciel », le premier résultat est _engine designer_ et le bon est _quality engineer_, dont les variantes anglaises contiennent _software quality engineer_. Lisez la `description` avant de retenir un métier.
2. **Offres d'emploi** (recherche web) : pour vérifier qu'un intitulé est réellement employé, et dans quel pays. En français : Welcome to the Jungle, APEC, France Travail, Indeed France. En anglais : des sites britanniques (Reed, Totaljobs, LinkedIn UK) pour en-GB, ou américains pour en-US. Un intitulé présent dans plusieurs offres récentes vaut mieux qu'un intitulé rare, même officiel.
3. **Sans accès au web** : vos connaissances, en signalant « non vérifié » dans le plan montré à l'utilisateur.

Outils : `WebFetch` pour l'API ESCO (demandez les champs utiles dans le `prompt`) et `WebSearch` pour les offres. S'ils sont différés, chargez-les avec `ToolSearch` (`select:WebFetch,WebSearch`) en un seul appel. Faites les recherches indépendantes en parallèle.

## Ce qui sort de la conversation

Seuls des **termes génériques** partent sur le web : un intitulé de poste, un nom de diplôme, une compétence. Jamais le nom de la personne, ses coordonnées, le nom de son employeur, ni un passage du CV. « ingénieur qualité logiciel » est une recherche ; « ingénieur qualité logiciel chez Exemple Santé à Lyon » n'en est pas une.

## Choisir un intitulé

- **Même poste, même niveau.** _Senior_, _Lead_, _Principal_, _Head of_ ou _Manager_ seulement si le CV le dit. « Responsable » peut être _Manager_ (encadrement) ou _Lead_ / _Owner_ (sans encadrement) : demandez si le CV ne le dit pas.
- **Le genre du CV.** ESCO donne « ingénieur qualité/ingénieure qualité » : prenez la forme du CV. L'anglais est neutre. Jamais de « H/F ».
- **Casse.** En anglais, _Title Case_ pour un intitulé (_Software Quality Engineer_) ; ESCO écrit en minuscules.
- **Pas de nouveau domaine.** L'intitulé anglais ne nomme pas un domaine ou une compétence absents du français. Sinon le serveur rejette l'élément : _Medical Device Software Engineer_ fait détecter la compétence MDSW si le passage français ne la contient pas. Préférez alors _Software Engineer, Medical Devices_, ou citez le passage du CV qui en parle.
- **Titres de CV.** Partez des postes les plus récents. Proposez à l'utilisateur 2 ou 3 intitulés du marché qui décrivent son profil réel, avec leur version anglaise, et laissez-le choisir (ou n'en garder aucun). Son choix, recopié dans `userStatement` (« Précisions de l'utilisateur : « je garde Ingénieure qualité logiciel » »), justifie l'élément `title`. Un titre très proche d'un titre déjà dans la bibliothèque se propose comme variante de celui-ci (`propose_variant`, cible `{ kind: "title", id }`).

## Présenter le résultat (étape 6)

Un tableau court, à faire valider avec le reste du plan :

| Poste du CV                       | Intitulé anglais retenu       | Intitulé usuel des offres (FR)   | Source                |
| --------------------------------- | ----------------------------- | -------------------------------- | --------------------- |
| Ingénieure logiciel embarqué      | Embedded Software Engineer    | Ingénieur logiciel embarqué      | ESCO, offres UK       |
| Chargée d'affaires réglementaires | Regulatory Affairs Specialist | Chargé d'affaires réglementaires | ESCO, offres UK et FR |

Puis la question des titres de CV, avec les candidats numérotés.
