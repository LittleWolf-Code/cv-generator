# Générateur de CV lisible par les ATS

Application **locale et personnelle** : une bibliothèque de contenus (expériences, puces, compétences, normes…), une sélection à cases à cocher par candidature, un rendu PDF Typst **contrôlé automatiquement pour sa lisibilité par les ATS**, et un serveur MCP pour que Claude propose sélections, reformulations et traductions, toujours validées par vous.

Le cahier des charges [`CAHIER_DES_CHARGES.md`](CAHIER_DES_CHARGES.md) fait foi. Les décisions techniques sont dans [`docs/decisions/`](docs/decisions/README.md).

> **Développement** : spécification, architecture, revue, tests et recette par Lucas Lopvet ; code écrit avec Claude Code. Ce dépôt a été publié avec un historique neuf (octobre 2026) : l'historique de développement n'est pas public. Licence : [MIT](LICENSE).

> **État : MVP terminé (lot 8 : modèle visuel, thèmes et recette).** Le détail des lots suit ; la recette est dans [`docs/recette.md`](docs/recette.md), et ce qu'il vous reste à faire en fin de page. Rendu PDF et DOCX du modèle `ats-classique`, contrôle ATS, API locale sécurisée, serveur MCP (5 outils au lot 0, 17 et un prompt guidé au lot 5, 20 et deux prompts au lot 6, 21 et trois prompts au lot 7). Lot 1 : édition de la bibliothèque, sauvegarde ZIP, mise à jour en direct, écran « À valider ». Lot 2 : cases à cocher à trois états, variantes, ordre ↑/↓, options et presets, aperçu en direct avec jauge de remplissage et blocage au-delà d'une page. Lot 3 : export PDF et DOCX depuis l'interface, motifs de blocage avec lien vers le correctif, nom de fichier normalisé, vue « ce que voit l'ATS » complète, photo facultative. Lot 4 : candidatures (offre collée ou choisie dans `import/offres/`, sélection propre qui diverge du preset, exports rangés dans la candidature), analyse de l'offre et couverture des termes recalculée à chaque coche. Lot 5 : Claude crée et analyse les candidatures, prévisualise des sélections et fait des propositions (sélection, variantes, nouveaux éléments, corrections, alias) que vous validez dans « À valider » ; le serveur applique les garde-fous anti-invention et refuse ce qui n'est pas dans la source. Lot 6 : import déterministe de l'export LinkedIn (interface, script ou Claude) et import du CV par Claude, en propositions dédoublonnées ; traductions proposées par Claude ; CV anglais en en-GB (A4) ou en-US (Letter, fichiers `Resume_`), avec la liste des champs non traduits qui bloquent l'export et l'orthographe de la variante contrôlée. Lot 7 : lettre de motivation par candidature et par langue, en versions jamais écrasées (rédigées par Claude ou par vous), avec l'expéditeur, la date, l'objet et les formules générés par le serveur, des avertissements anti-invention, une page stricte et l'export PDF et DOCX de la version active. Lot 8 : modèle `visuel` en deux colonnes, destiné à une lecture humaine (critères de mise en page en orange, intégrité du fichier toujours bloquante), thèmes (trois polices, couleur d'accent contrôlée, densité) pour un preset ou une candidature, repris par la lettre, et recette complète T-01 à T-08.

---

## Installation

Prérequis : **Node.js 22.19 ou plus** (24 LTS recommandé), npm et git.

```powershell
git clone https://github.com/LittleWolf-Code/cv-generator.git
cd cv-generator
npm install
npm run data:init
```

- `npm install` installe les versions figées, compile le serveur MCP (`postinstall`) et active le hook `guard-commit` (`prepare`).
- `npm run data:init` crée un dossier `data/` vide et valide. Il n'écrase jamais rien et n'y met aucune donnée.

Optionnel, pour une batterie ATS complète : **Poppler** (voir plus bas). LibreOffice, s'il est installé (c'est le cas sur ce poste), compte les pages du DOCX (T-DOCX-03) ; il tourne dans un profil temporaire propre au processus, et ne gêne pas une fenêtre LibreOffice ouverte.

## Lancement

```powershell
npm run dev
```

Ouvre l'interface sur <http://127.0.0.1:4310/> (l'API écoute sur 127.0.0.1:4311, jamais sur le réseau). `npm run dev` lit `data/`, ou le dossier désigné par `CV_DATA_DIR`.

Pour voir l'application sur une **persona fictive** sans toucher à vos données :

```powershell
npm run dev:demo
```

(équivalent de `npm run dev -- --fixture courte` ; les autres fixtures : `debordante`, qui dépasse la page, et `pieges`). Le travail se fait sur une copie temporaire ; en démo, `import/` est une copie temporaire qui contient les trois offres fictives de `fixtures/offres/` (dans `import/offres/`), l'export LinkedIn fictif et le CV fictif en PDF, en DOCX et en PDF scanné (`fixtures/imports/`).

## Utilisation

- **Bibliothèque** (écran par défaut) : en haut le preset et ses réglages ; à gauche la bibliothèque avec les cases à cocher, un filtre texte, un filtre « Non traduit » et l'affichage des archivés ; au centre les réglages du preset, ou le formulaire de l'élément cliqué ; à droite l'aperçu PDF et les feux de lisibilité ATS. « + Ajouter » crée un élément dans le groupe ; les identifiants sont attribués par le serveur.
- **Sélection** : cochez une section, une entrée ou une puce. Une entrée en partie cochée est « mixte » (compteur « 3/5 puces »). **Décocher ne supprime rien** : une entrée décochée masque ses puces, qui reviennent telles quelles quand on la recoche. Cocher une entrée dont aucune puce n'est retenue coche toutes ses puces. Le titre et l'accroche se choisissent par un bouton radio ; une liste propose la variante de chaque puce, du titre et de l'accroche. Les boutons ↑/↓ (utilisables au clavier) réordonnent les sections, les puces, les projets, les compétences (dans leur catégorie), les certifications, les langues et les centres d'intérêt ; expériences et formations restent en ordre antichronologique.
- **Modèle** (barre du haut) : **ATS classique** (une colonne, par défaut, pour les portails de recrutement) ou **Visuel** (repris de votre CV : bandeau avec la photo ronde, le nom et le titre ; colonne de gauche sur une teinte de l'accent avec les coordonnées, Compétences, Normes, Langues, Certifications et Centres d'intérêt ; intitulés en pastilles ; la teinte s'arrête avec le contenu). Le visuel porte le badge « Lecture humaine » : il est **destiné à une lecture humaine, déconseillé pour les portails ATS**. Ses critères de mise en page (ordre des sections, dates, coordonnées, lettres espacées) sont en orange ; ses critères d'intégrité (1 page, textes retrouvés, caractères, polices, taille, poids, métadonnées, aperçu = export) restent bloquants. L'export PDF reste possible avec ces avertissements ; son DOCX garde une seule colonne. Passer au visuel met « Normes et réglementation » en section dédiée (et le retour en ATS la remet en ligne dans Compétences) ; la photo n'est que suggérée.
- **Thème** (encart « Thème » des réglages, pour un preset comme pour une candidature) : police (Carlito, aux métriques de Calibri ; Source Sans 3 ; IBM Plex Sans), couleur d'accent (six pastilles, ou une couleur libre dont le contraste sur blanc doit atteindre 4,5:1 : sinon elle est refusée, avec le ratio obtenu) et densité (barre du haut). Avec Source Sans 3 ou IBM Plex Sans, le DOCX déclare Calibri : sa pagination diffère du PDF (feu orange). Source Sans 3 est composée avec des espaces entre mots un peu plus larges (125 %), sans quoi Poppler colle les mots. La lettre de motivation reprend la police et l'accent de la candidature.
- **Réglages du preset** : langue (FR, EN-GB en A4, EN-US en Letter), densité (normale ou compacte) et photo dans la barre du haut ; liens affichés, permis, autorisation de travail, format des dates, placement des normes, mention « références » et **libellé des fichiers** au centre. Le libellé se saisit librement ou se propose à partir du titre du CV (marqueurs de genre comme « H/F » retirés) ; le nom des fichiers s'affiche en dessous.
- **Aperçu en direct** : chaque changement recompile le CV en moins d'une seconde et s'enregistre tout seul (indicateur « Enregistré »). La **jauge** montre le remplissage de la page ; au-delà de 100 %, le dépassement est chiffré en lignes et l'**export est bloqué**, avec la marche à suivre (« décochez une puce ou passez en densité compacte », bouton pour passer en compacte). Si le preset est modifié ailleurs (autre onglet, proposition acceptée) pendant votre saisie, un bandeau propose de recharger la version enregistrée ou de garder vos modifications.
- **Export** : « Exporter PDF » et « Exporter DOCX », dans la barre du haut. Le preset est enregistré, puis le serveur vérifie que le preset enregistré donne exactement l'aperçu affiché (même empreinte SHA-256, critère T-ATS-13) : le **PDF exporté est l'aperçu affiché**. Le navigateur télécharge le fichier sous son nom normalisé (`CV_Prénom_Nom_Libellé_FR.pdf`, `Resume_…` en EN-US), et une **copie horodatée** est gardée dans `out/exports/<preset>/<AAAAMMJJ-HHmmss>_<modèle>/` avec une trace `export.json` (aucun export n'en écrase un autre). Le DOCX vient du même contenu, en styles Word natifs, police déclarée « Calibri » ; **1 page non garantie en DOCX** (Word pagine lui-même). Les boutons sont désactivés tant qu'un motif bloque l'export : plus d'une page, critère rouge, champ affiché non traduit, langue sans niveau CECRL. Chaque motif a un bouton qui ouvre l'élément à corriger (ou passe en densité compacte).
- **Vue ATS** (onglet à côté de l'aperçu) : le texte tel qu'un logiciel de recrutement le lit, par extracteur (pdf.js, `pdftotext -raw` si Poppler est installé, sinon le rapport est marqué « incomplet » ; DOCX après un export DOCX), en **texte brut**, en **version normalisée** (boutons « Copier ») et en **champs détectés** : nom en première ligne, e-mail, téléphone, ville et pays, intitulés reconnus, une plage de dates par entrée. On parle de lisibilité : un texte bien extrait ne préjuge pas de l'issue d'une candidature.
- **Photo** (facultative, dans le formulaire d'identité) : choisissez une image, placez le cadre 3:4 (souris, flèches, curseur de taille), puis enregistrez. Elle est réduite à 600 × 800 px au plus, réencodée en JPEG (300 Ko au plus) **sans métadonnées** (EXIF, GPS) et rangée dans `data/assets/photo.jpg`. Elle n'apparaît que si la case « Photo » du preset est cochée (décochée par défaut, et automatiquement en passant en anglais), avec un feu orange : les ATS l'ignorent et elle est déconseillée hors de France. Elle n'est jamais transmise à Claude : les rendus du serveur MCP utilisent une image grise de même taille.
- **Presets** : « Nouveau » (sélection vide), « Dupliquer », « Renommer », « Archiver » (le preset reste consultable sous « Archivés » et peut être restauré) et « Définir par défaut ». Le preset par défaut ne s'archive pas.
- **Saisie** : chaque champ est vérifié en direct par le serveur. Le texte est assaini à l'enregistrement (apostrophes droites, espaces normalisées). Un emoji, un caractère de contrôle ou de la zone privée est refusé, avec le champ en cause. Un intitulé abrégé (« Ing. », « Resp. ») ou une organisation réduite à un sigle donne un avertissement (ATS-22), sans bloquer.
- **Suppression en deux temps** : « Archiver » retire l'élément du CV sans le perdre, puis « Supprimer définitivement » le retire de la bibliothèque, après confirmation. Son identifiant n'est jamais réutilisé.
- **À valider** : les propositions de Claude (ou d'un import) attendent votre décision : accepter, modifier puis accepter, ou rejeter. Une reformulation acceptée devient une **nouvelle variante** ; le texte d'origine n'est jamais écrasé. Une sélection s'accepte élément par élément ; elle ne peut ni masquer une expérience entière, ni décocher un élément verrouillé (règle F-SEL-10 : ces éléments sont refusés). Si l'élément visé a changé depuis la proposition, un **conflit en trois colonnes** (base, actuelle, proposée) s'affiche. L'acceptation en lot laisse de côté les faits sensibles (organisation, intitulé, dates), les dates à vérifier d'un import et les conflits. Un élément qui double un élément validé devient un **complément** : son acceptation n'ajoute que les puces nouvelles, sans toucher à l'organisation, à l'intitulé ni aux dates. Une **traduction** ne remplit qu'une langue vide.
- **Import LinkedIn** (encart en haut de « À valider ») : choisissez le ZIP (ou « CSV déposés dans import/ ») et la langue des textes, puis « Importer ». Chaque élément devient une proposition ; le rapport donne les propositions créées, les doublons, les éléments incomplets non proposés (sans date de début, sans diplôme…), les colonnes inconnues et ignorées, les dates à vérifier (l'année seule est gardée, jamais un mois inventé) et les langues dont le niveau CECRL est à préciser : tant qu'il n'est pas renseigné, l'export d'un CV qui affiche cette langue est bloqué. L'identité trouvée (nom, e-mail, téléphone, ville) n'est jamais enregistrée : le bouton « Préremplir depuis l'export LinkedIn » du formulaire d'identité remplit les champs vides, que vous enregistrez vous-même.
- **CV en anglais** : en EN-GB (A4) ou EN-US (Letter, fichiers `Resume_…`), chaque champ affiché non traduit bloque l'export et figure dans la liste sous la barre, avec un lien vers l'élément (et la puce) à traduire. La bibliothèque n'a qu'un texte anglais pour les deux variantes : l'orthographe de l'autre variante (licence/license, organisation/organization, -ise/-ize…) est signalée en orange, sans bloquer. En EN-US, la ligne du permis est « Driver's license ».
- **Candidatures** (onglet du haut) : la liste, et « Nouvelle candidature » : entreprise, intitulé du poste, référence et URL (facultatives), langue, preset de départ, libellé des fichiers (proposé à partir de l'intitulé, sans « H/F », modifiable) et texte de l'offre, **collé** ou **choisi dans `import/offres/`** (`.md` ou `.txt` ; l'interface ne voit que les noms de fichiers). L'offre est une **donnée non fiable** : ses caractères invisibles sont retirés, et les phrases qui ressemblent à des consignes pour une IA (« ignore les instructions… », « ChatGPT », « Claude »…) sont signalées dès la saisie, puis surlignées dans l'onglet « Offre ». L'identifiant (`2026-10-12-acme-medical-ingenieur-logiciel`) est attribué par le serveur.
- **Candidature ouverte** (sélecteur « Candidature » de la barre, ou « Ouvrir ») : elle s'édite comme un preset, avec arbre, réglages, aperçu, feux et export, enregistrement automatique. Sa sélection est une **copie** du preset de départ, qui ne change jamais. Au centre, la **couverture des termes de l'offre**, recalculée à chaque coche : formule (Σ w·q / Σ w), niveau (faible, moyen, bon, fort ; jamais un « score ATS »), termes manquants en trois groupes (a : dans la bibliothèque mais non coché, avec « Cocher l'élément » ; b : sous un autre libellé ou en terme voisin ; c : absent, à n'ajouter que si c'est vrai), et la proposition de reprendre l'intitulé du poste comme titre du CV (ATS-19, toujours à votre initiative, modifiable). Les exports d'une candidature sont rangés dans `data/applications/<id>/exports/<AAAAMMJJ-HHmmss>_<modèle>/`, avec leur trace dans `application.json` ; aucun n'en écrase un autre.
- **Lettre de motivation** (bouton « ✉ Lettre » d'une candidature, ou de la barre quand elle est ouverte) : une lettre par langue, en versions. Chaque enregistrement crée une **nouvelle version** (rien n'est écrasé) ; Claude en ajoute aussi (prompt `rediger-lettre`). Vous écrivez le destinataire (civilité, nom, fonction, entreprise, ville) et 3 ou 4 paragraphes avec un rôle, dans cet ordre : en français vous, moi (une ou deux fois), nous ; en anglais opening, evidence, motivation (facultatif), close. Le serveur génère l'expéditeur, le lieu et la date (du jour), l'objet (« Candidature au poste d'… – Réf. … »), les formules d'appel et de politesse, appariées, et « P. J. : CV ». Les avertissements signalent un chiffre ou une compétence sans source, un fait de l'offre hors du paragraphe vous (ou motivation), un élément cité non coché. « Comparer » montre le diff entre deux versions. Seule la **version active**, que vous choisissez, s'exporte (`LM_Prénom_Nom_Entreprise_FR.pdf`, `CoverLetter_…_EN`), en une page stricte ; la copie est rangée dans `exports/<horodatage>_lettre/` de la candidature. « Marquer comme finale » est définitif : une version finale ne change plus, une modification crée une nouvelle version.
- **Analyse de l'offre** : Claude l'enregistre lui-même (prompt `adapter-a-une-offre`, ci-dessous) ; vous pouvez aussi « Importer une analyse (JSON) » dans le panneau Couverture. Chaque phrase source doit figurer dans l'offre. L'analyse précédente reste dans l'historique.
- **Journal MCP** (onglet du haut) : toutes les requêtes reçues par le serveur MCP, avec la date, l'heure (de votre navigateur) et l'adresse IP du client SSH, la session, le client (Claude Code, Claude Desktop), l'outil et ses arguments résumés (textes longs remplacés par leur longueur, coordonnées masquées), le résultat (ok, refus avec son code, erreur), la durée et la taille de la réponse. Une **session** est un démarrage du serveur MCP, donc une connexion SSH (un toucher de la YubiKey). Regroupez par session, adresse IP, outil ou jour, un mois à la fois. La colonne **« Coordonnées »** dit si la réponse envoyée à Claude contenait votre e-mail ou votre téléphone, sous quelque forme que ce soit : elle doit toujours afficher « ✓ aucune », et un bandeau rouge signale le contraire. Le journal est écrit dans `out/logs/mcp-AAAA-MM.jsonl` ; Claude ne peut pas le lire. « Actualiser » recharge le mois affiché.
- **Sauvegarde ZIP** (en haut à droite) : télécharge une copie complète de `data/`.
- **Réinitialiser…** (en haut à droite, en rouge) : efface toutes vos données (identité et photo, bibliothèque, presets, candidatures, propositions) pour repartir d'un dossier vide. Tapez RÉINITIALISER pour confirmer. Le serveur garde d'abord une copie ZIP dans `out/backups/`, et la boîte propose de télécharger la sauvegarde ZIP (coché par défaut). `import/` et les clés de connexion ne sont pas touchés ; le registre des identifiants est gardé (un identifiant n'est jamais réutilisé). Claude ne peut pas réinitialiser vos données.

**Essayer la file « À valider » sans Claude.** Lancez `npm run dev:demo` : la console affiche le dossier de données temporaire. Copiez-y une proposition fictive, elle apparaît en direct :

```powershell
Copy-Item "fixtures\proposals\01JC0FX0000000000000VAR001.json" "<dossier affiché>\proposals\"
```

`VAR001` est une variante à accepter ou rejeter, `STA001` un cas en conflit, `EDT001` un fait sensible, `SEQ001` une sélection qui dépend de `VAR001`, `SYN001` un alias, `NEW001` un nouvel élément.

**Essayer la couverture sans Claude.** Dans `npm run dev:demo`, créez une candidature à partir du fichier `offre-logiciel-dm.md`, puis importez `fixtures/analyses/analyse-logiciel-dm.json` dans le panneau Couverture : niveau moyen (9 / 17), un terme en groupe a (« Cocher l'élément » fait passer à bon), deux en b, un en c.

## Commandes

| Commande                           | Rôle                                                                                                                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev` / `npm run dev:demo` | Interface + API locale (une seule commande)                                                                                                                                                                |
| `npm test`                         | Tests unitaires, API et MCP (Vitest)                                                                                                                                                                       |
| `npm run test:ats`                 | Batterie ATS (§12.2) : `ats-classique` et `visuel`, CV et lettre, FR, en-GB et en-US (Letter), trois polices, sur `courte`, `pieges` et `debordante` (72 cas) ; PDF, DOCX et rapports dans `out/test-ats/` |
| `npm run test:recette`             | Les scénarios de recette T-01 à T-08 (§12.6), de bout en bout                                                                                                                                              |
| `npm run typecheck`                | TypeScript strict sur tout le dépôt                                                                                                                                                                        |
| `npm run lint` / `npm run format`  | ESLint / Prettier                                                                                                                                                                                          |
| `npm run data:init`                | Crée `data/` vide et valide                                                                                                                                                                                |
| `npm run import:linkedin`          | Import LinkedIn en propositions (`-- <fichier>` ZIP ou CSV de `import/`, `--dry-run` : colonnes et comptages seulement, `--lang en`)                                                                       |
| `npm run build:mcp`                | Recompile le serveur MCP                                                                                                                                                                                   |
| `npm run mcp:inspect`              | Ouvre MCP Inspector sur le serveur `cv`                                                                                                                                                                    |
| `npm run build` / `npm start`      | Mode production : compile, puis sert l'interface et l'API sur un seul port (`127.0.0.1:4310`)                                                                                                              |
| `npm run deploy`                   | Déploie le dernier commit sur le serveur de l'instance en ligne (outillage privé de l'auteur, non publié)                                                                                                  |
| `npm run auth:code`                | Sur le serveur : code à usage unique pour enregistrer une clé de sécurité                                                                                                                                  |

### Poppler (deuxième extracteur de texte)

`npm run test:ats` exige deux extracteurs : pdf.js et `pdftotext` de **Poppler**. Le `pdftotext` fourni par Git for Windows est celui de xpdf : il n'est pas utilisé. **Sur ce poste, Poppler 26.09.0 est installé** dans `%LOCALAPPDATA%\Programs\poppler-26.09.0`, et `.env` contient son `POPPLER_BIN` : rien à faire. L'archive `poppler-<version>.tar.xz` de poppler.freedesktop.org contient le **code source**, à compiler : prenez la version déjà compilée pour Windows. Installation sans droits administrateur :

1. Télécharger <https://github.com/oschwartz10612/poppler-windows/releases/download/v26.09.0-0/Release-26.09.0-0.zip> ;
2. extraire l'archive, par exemple dans `C:\Outils\poppler-26.09.0` ;
3. créer un fichier `.env` à la racine du projet (modèle : `.env.example`) contenant :
   ```
   POPPLER_BIN=C:\Outils\poppler-26.09.0\Library\bin
   ```

En attendant, la batterie peut tourner avec pdf.js seul ; le rapport est alors marqué « incomplet » :

```powershell
$env:ATS_SINGLE_EXTRACTOR=1; npm run test:ats
```

---

## Brancher Claude (MCP)

Le serveur MCP « cv » fonctionne même si l'interface n'est pas lancée. Il exige un dossier de données (`npm run data:init`). Il ne fait **aucun appel réseau** et ne renvoie jamais votre e-mail, votre téléphone, votre photo ni une adresse.

Outils :

- **lecture** : `get_overview` (à appeler en premier), `get_guidelines`, `get_library`, `get_items`, `list`, `get_preset`, `get_application` ;
- **candidatures** : `create_application`, `save_offer_analysis` (renvoie la couverture), `preview_selection` (aperçu sans écriture : pages, dépassement, feux ATS, couverture, coût en lignes de chaque puce) ;
- **presets** : `create_preset` (preset vide ou copie d'un preset, avec la langue et le modèle de départ ; aucun autre preset ne change). Claude en choisit ensuite le contenu par `propose_selection`, à valider dans « À valider ». Le thème, les options, le renommage et l'archivage restent dans l'interface ;
- **imports** : `get_import_file_text` (texte d'un CV de `import/`, PDF ou DOCX, donnée non fiable, coordonnées masquées ; un PDF scanné renvoie « joignez le fichier directement dans la conversation, ou fournissez le DOCX »), `import_linkedin` (import déterministe en propositions ; `dryRun` : noms de colonnes et comptages seulement) ;
- **propositions** : `propose_selection`, `propose_variant`, `propose_item` (avec `sourceFile` PDF ou DOCX ; renvoie l'identifiant `itemId` de chaque élément ; une catégorie de compétences se propose d'abord, puis ses compétences la visent par son `itemId` et s'acceptent avec elle), `propose_translation` (une langue vide seulement), `propose_edit`, `propose_alias`. Rien n'est appliqué : chaque proposition arrive dans « À valider » (lien `reviewUrl` dans la réponse ; lancez `npm run dev` si l'interface est fermée). Le serveur applique les **garde-fous** de l'annexe C (aucun chiffre, aucune compétence ni aucune classe de dispositif absents de la source, éditions de normes autorisées, ni URL ni consigne étrangères…) et refuse une proposition en citant la règle ; une sélection ne peut ni masquer une expérience entière ni décocher un élément verrouillé ;
- **lettre** : `save_letter_draft` (nouvelle version de la lettre d'une candidature, compilée, avec les avertissements des garde-fous ; la version active ne change jamais par Claude) ;
- **rendu** : `render` (avec `saveToApplication`, l'export est rangé dans la candidature ; `kind: letter` pour la lettre, dans sa version active), `check_ats`. `render`, `check_ats` et `preview_selection` acceptent `layout: visuel` : la réponse porte alors le badge « destiné à une lecture humaine, déconseillé pour les portails ATS » et les critères de mise en page en orange.

**Adapter le CV à une offre avec Claude.** Créez la candidature dans l'interface (offre collée ou fichier de `import/offres/`), puis lancez le prompt `adapter-a-une-offre` avec son identifiant (dans Claude Code : `/cv:adapter-a-une-offre`, ou `/mcp__cv__adapter-a-une-offre`). Claude analyse l'offre, itère des aperçus jusqu'à 1 page, propose au besoin des variantes pour les termes « sous un autre libellé », fait **une** proposition de sélection, puis s'arrête : validez dans « À valider », dites-le-lui, et il rend le CV et le contrôle. Il vous signale les termes absents de la bibliothèque, à n'ajouter que s'ils sont vrais.

**Rédiger la lettre avec Claude.** Lancez le prompt `rediger-lettre` avec l'identifiant de la candidature (`/cv:rediger-lettre`). Claude lit la candidature, l'offre et les règles, rédige les paragraphes à partir de la bibliothèque et enregistre une nouvelle version, puis vous rend compte des avertissements. Relisez-la dans la page « Lettre », modifiez-la au besoin et choisissez la version active avant d'exporter.

**Importer votre CV avec Claude.** Déposez le CV (PDF ou DOCX) dans `import/`, puis lancez le prompt `importer-mon-cv` avec son nom de fichier (`/cv:importer-mon-cv`). Claude lit le texte, propose les éléments tels quels (le serveur compare chaque texte au fichier et écarte ce qui n'y est pas), sans doublon de la bibliothèque ni des propositions en attente de l'import LinkedIn, puis s'arrête : validez dans « À valider », dites-le-lui, et il propose les traductions manquantes.

**Ajouter votre CV en le joignant à la conversation (skill `ajouter-mon-cv`).** Joignez votre CV (PDF, DOCX ou image) ou collez-en le texte, et demandez par exemple « ajoute mon CV au site ». Le skill ([`.claude/skills/ajouter-mon-cv`](.claude/skills/ajouter-mon-cv/SKILL.md)) déroule les étapes suivantes :

1. il fait l'état de la bibliothèque et l'inventaire du CV ;
2. il vous montre les doublons (bibliothèque et propositions en attente) ;
3. il vous pose, par petits lots, les questions qui manquent (niveaux CECRL, mois, lieux, contrats, catégories) ; il ne propose une nouvelle catégorie de compétences qu'avec votre accord ;
4. il propose chaque élément en « dictée », avec le passage du CV recopié mot pour mot comme preuve ;
5. après votre validation, il propose les traductions anglaises et relie les compétences aux expériences.

Le skill est disponible dans Claude Code dans ce dossier. Pour Claude Desktop, importez l'archive `ajouter-mon-cv.zip` (Paramètres → Capacités → Skills). Cette archive n'est pas dans le dépôt : refaites-la (dossier `.claude/skills/ajouter-mon-cv` compressé) après chaque modification du skill, une fois le serveur MCP mis à jour (`npm run build:mcp`, ou `npm run deploy` pour l'instance en ligne).

**Ajouter vos dépôts GitHub en projets (skill `ajouter-depots-github`).** Demandez par exemple « ajoute mes dépôts GitHub » en donnant votre compte. Claude liste vos dépôts publics (avec `gh`, ou l'API de GitHub dans Claude Desktop), vous fait choisir ceux à garder et les regrouper (un projet peut avoir plusieurs dépôts), lit leurs README, vous pose les questions qui manquent (nom, dates, rôle), puis propose chaque projet en français et en anglais avec ses dépôts, ou ajoute un dépôt à un projet existant. C'est Claude qui lit GitHub : le générateur reste hors ligne. Dans l'interface, un projet a un « Lien principal » et une liste de « Dépôts », affichés en clair après lui sur le CV (ADR 0027). Pour Claude Desktop, importez l'archive `ajouter-depots-github.zip` (dossier [`.claude/skills/ajouter-depots-github`](.claude/skills/ajouter-depots-github/SKILL.md) compressé), comme pour `ajouter-mon-cv`.

### Claude Code

Le fichier `.mcp.json` (propre à chaque poste, ignoré par git) déclare le serveur `cv` pour Claude Code. Copiez [`.mcp.json.example`](.mcp.json.example), qui lance le **serveur local** (données de `data/`) : `"command": "node", "args": ["apps/mcp/dist/index.js"]`. Ouvrez Claude Code dans le dossier du projet : à la première utilisation, il demande d'approuver le serveur `cv`. Après une modification du MCP : `npm run build:mcp`, puis `/mcp` et reconnexion.

**Instance en ligne** : le serveur `cv` tourne sur votre serveur et Claude le lance par SSH, à travers un **relais à la demande** (`apps/mcp/dist/relay.js`, [ADR 0026](docs/decisions/0026-relais-mcp-a-la-demande.md)) : `"command": "node", "args": ["apps/mcp/dist/relay.js", "<programme ssh>", "<hôte>", "<commande qui lance le serveur MCP sur le serveur>"]`. Claude Code démarre le serveur `cv` avec chaque session, mais le relais répond seul au démarrage avec la copie de la dernière connexion (`out/mcp-relay/`), et n'ouvre la connexion SSH qu'au **premier outil ou prompt `cv` utilisé**. Une clé SSH matérielle n'est donc demandée que dans une session qui se sert de vos données, une fois. La toute première fois (pas encore de copie), elle est demandée au démarrage de la session. Si la connexion échoue, Claude reçoit une erreur : la demande suivante réessaie, sans `/mcp`. Pour le Journal MCP, la commande distante peut transmettre l'adresse du client SSH (`env CV_SSH_CONNECTION="$SSH_CONNECTION"`, ADR 0024).

Le fichier [`.claude/settings.json`](.claude/settings.json) interdit à Claude Code de lire ou modifier `data/` et `import/` directement : les données réelles ne passent que par les outils `mcp__cv__*`.

### Claude Desktop (installation MSIX de ce poste)

Le fichier de configuration est :

```
%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json
```

(pour une installation classique : `%APPDATA%\Claude\claude_desktop_config.json`). Ajoutez le bloc suivant, en le fusionnant dans `mcpServers` si d'autres serveurs existent déjà :

```json
{
  "mcpServers": {
    "cv": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\chemin\\vers\\cv-generator\\apps\\mcp\\dist\\index.js"]
    }
  }
}
```

Chemins **absolus** pour la commande et pour le script ; les `\` sont doublés, une espace dans le chemin ne s'échappe pas. Si vos données sont hors du dépôt, ajoutez `"env": { "CV_DATA_DIR": "D:\\Donnees\\cv-data" }` dans le bloc `cv`. Après une recompilation, **quittez complètement** Claude Desktop (icône de la zone de notification, « Quitter ») puis relancez-le. Journaux : dossier `logs\` à côté du fichier de configuration (`mcp-server-cv.log`).

**Instance en ligne** : remplacez le bloc `cv` par un bloc qui lance le relais (`apps\mcp\dist\relay.js`, chemin absolu) suivi du programme SSH, de l'hôte et de la commande distante, comme pour Claude Code ci-dessus. La clé SSH est alors demandée au premier outil `cv` qu'utilise Claude, et non au lancement de Claude Desktop (sauf la toute première fois).

`env CV_SSH_CONNECTION="$SSH_CONNECTION"` transmet votre adresse IP au serveur MCP à travers `sudo` (qui l'efface), pour le **Journal MCP**. Sans elle, le serveur fonctionne, mais le journal affiche « adresse inconnue (SSH) ».

Ce fichier n'est jamais modifié par le projet : c'est à vous de le faire.

**Vérifier le prompt dans Claude Desktop** (point ouvert du §15) : après avoir ajouté le bloc et relancé Claude Desktop, ouvrez une conversation, cliquez sur « + » (ou l'icône des connecteurs) : le serveur `cv` doit apparaître avec ses outils et le prompt « Adapter le CV à une offre ». Choisissez-le, donnez l'identifiant d'une candidature, et vérifiez que Claude suit les étapes. Notez ce que vous voyez (prompt présent ou non, argument demandé) : ce comportement n'a pas encore été vérifié sur ce poste.

---

## Où déposer votre CV actuel et votre export LinkedIn

Dans le dossier **`import/`** à la racine (créez-le ; il est ignoré par git et refusé par le hook `guard-commit`) :

```
import/
├─ CV_actuel.pdf            (ou .docx)
├─ Basic_LinkedInDataExport_….zip   (ou les fichiers .csv)
└─ offres/
   └─ offre-acme.md         (texte d'une offre, .md ou .txt)
```

Les offres de `import/offres/` se choisissent à la création d'une candidature. L'export LinkedIn s'importe depuis « À valider », par `npm run import:linkedin` ou par Claude (`import_linkedin`) ; le ZIP est lu en mémoire (seuls les CSV attendus du premier niveau, 20 Mo décompressés au plus), jamais extrait. Le CV s'importe avec Claude (prompt `importer-mon-cv`). Pour l'export LinkedIn : _Paramètres > Confidentialité des données > Obtenir une copie de vos données_.

**Confirmer les colonnes de votre export LinkedIn sans en lire le contenu** (point « à vérifier » de F-IMP-02). Déposez le ZIP dans `import/`, puis, au choix :

```bash
npm run import:linkedin -- Basic_LinkedInDataExport_JJ-MM-AAAA.zip --dry-run
```

ou demandez à Claude `import_linkedin` avec `dryRun: true`. Rien n'est écrit ; la sortie ne contient que les noms de fichiers et de colonnes (attendues, inconnues, ignorées, absentes), les nombres de lignes, et des comptages de formats de dates et de niveaux de langue, jamais une valeur. Une colonne attendue « absente » ou des dates « autre » signalent un format à adapter.

---

## Données et confidentialité

- **Vos données** sont dans `data/` (ou `CV_DATA_DIR`), en JSON. `data/`, `import/`, `out/` et `.env` sont ignorés par git, et le hook `guard-commit` refuse tout commit qui en contiendrait. Le dépôt de code ne contient que des **fixtures fictives**.
- **Exports** : les copies horodatées de `out/exports/` contiennent vos coordonnées (et la photo si elle est cochée) ; `out/` est ignoré par git. Supprimez-les quand vous n'en avez plus besoin.
- **Journal MCP** : `out/logs/` garde, mois par mois, les adresses IP et les requêtes de Claude (jamais vos coordonnées). Rien n'est effacé automatiquement, pas même par « Réinitialiser… » : supprimez les anciens mois vous-même si vous le souhaitez.
- Conseil : faites de `data/` un **dépôt git privé séparé** pour garder l'historique de vos contenus.
- Les règles de Claude Code interdisent la lecture de `data/` et `import/`, mais **pas un script lancé par Bash**. Pour plus de sûreté, placez vos données hors du dépôt : `CV_DATA_DIR=D:\Donnees\cv-data` dans `.env` (chemin absolu), puis `npm run data:init`.
- **Pour travailler sur votre CV avec Claude** : utilisez une conversation où les **autres connecteurs** (web, messagerie…) sont désactivés, et ne choisissez jamais « toujours autoriser » pour un outil réseau.
- Vérifiez le réglage de confidentialité de votre compte Claude sur l'utilisation des conversations pour l'entraînement : s'il est activé, la conservation est plus longue (jusqu'à 5 ans selon les conditions grand public d'Anthropic).
- Saisissez les offres **dans l'interface** ou déposez-les dans `import/offres/` plutôt que de les coller dans le chat : une offre collée devient un message de votre part, sa recopie coûte des tokens et peut la tronquer. Le texte d'une offre est traité comme une donnée **non fiable**.
- Le serveur MCP ne fait aucun appel réseau. L'interface ne charge aucune ressource externe et n'envoie aucune télémétrie.

---

## Contrôles manuels ponctuels (§12.5)

Les contrôles automatiques garantissent la **lisibilité** du fichier, pas l'issue d'une candidature. De temps en temps, et au moins une fois sur votre vrai CV, vérifiez aussi les points ci-dessous. Faites-les d'abord sur un CV **fictif** :

- `npm run test:ats` dépose ses PDF dans `out/test-ats/<date>/`, par exemple `cv-ats-classique-carlito-pieges-fr.pdf` et `cv-visuel-carlito-courte-fr-photo.pdf` ;
- ou bien, dans `npm run dev:demo`, cliquez sur « Exporter PDF ».

### 1. Copier-coller dans le Bloc-notes

1. Ouvrez le PDF exporté dans votre lecteur (Edge, Acrobat…).
2. **Ctrl+A** pour tout sélectionner, puis **Ctrl+C**.
3. Ouvrez le Bloc-notes (**Win+R**, `notepad`, Entrée), puis **Ctrl+V**.
4. Vérifiez dans le texte collé :
   - la première ligne est « Prénom Nom » ;
   - l'e-mail, le téléphone, la ville et le pays viennent avant le premier intitulé ;
   - chaque intitulé de section est seul sur sa ligne, dans l'ordre du CV ;
   - chaque plage de dates est entière (« 02/2023 – aujourd'hui ») ;
   - les accents sont conservés, aucun mot n'est collé à son voisin, aucun caractère n'est remplacé par ☐ ou �.
5. Comparez avec l'onglet « Vue ATS » de l'interface (texte brut et version normalisée) : ils doivent dire la même chose.

En modèle **visuel**, le texte suit l'ordre de la page : bandeau, colonne de gauche (coordonnées, Compétences, Normes, Langues…), puis colonne principale. Les sections de gauche viennent donc avant l'Expérience : c'est attendu (feu orange T-ATS-06).

### 2. Parseur d'OpenResume

1. Ouvrez <https://www.open-resume.com/resume-parser> dans votre navigateur.
2. Avant d'y déposer votre vrai CV, lisez ce que le site dit du traitement du fichier. Commencez par le CV fictif.
3. Déposez le PDF (ats-classique).
4. Vérifiez que le nom, l'e-mail, le téléphone et les sections (Experience, Education, Skills) sont reconnus.

Conçu pour les États-Unis, ce parseur lit mal un téléphone (+33 / 06…) ou une ville française : ce n'est pas un vrai problème.

### 3. Vérificateur de rxresu.me (Reactive Resume)

1. Ouvrez <https://rxresu.me>. Un compte peut être demandé.
2. Importez le PDF, et regardez ce que l'outil en extrait : sections, entrées, dates, compétences.

Même prudence que pour OpenResume : c'est un service tiers. N'y déposez votre vrai CV que si vous l'acceptez.

### 4. Mots-tests

Les mots « Ingénieur·e », « Efficacité », « Œuvre », « workflows » et « ISO 13485:2016 » doivent ressortir à l'identique, sans ligature (« ffi », « fl ») ni espace parasite.

1. Le PDF `cv-ats-classique-carlito-pieges-fr.pdf` contient déjà « Ingénieur·e », « Œuvre » et « ISO 13485:2016 ».
2. Pour « Efficacité » et « workflows », lancez `npm run dev:demo` et ajoutez-les à un centre d'intérêt (« Efficacité des workflows »).
3. Exportez, puis cherchez chaque mot avec **Ctrl+F** dans le lecteur PDF.
4. Collez aussi le texte dans le Bloc-notes et cherchez-y les mêmes mots.

---

## Instance en ligne (VPS)

Depuis le lot 9 ([ADR 0018](docs/decisions/0018-instance-en-ligne-vps.md)), l'application peut tourner sur un serveur, en HTTPS sur un sous-domaine, derrière une **clé de sécurité** (WebAuthn). Le serveur MCP y tourne aussi : Claude le lance par SSH, à travers le relais à la demande ([ADR 0026](docs/decisions/0026-relais-mcp-a-la-demande.md)).

- **Mode production** : `npm run build && npm start` sert l'interface et l'API sur `127.0.0.1` ; un proxy inverse (nginx) publie l'instance. `CV_PUBLIC_ORIGIN` active la connexion par clé de sécurité (voir [`.env.example`](.env.example)).
- **Connexion** : la page `/connexion` demande la clé de sécurité. La session dure 12 h ; un redémarrage du serveur demande de se reconnecter. « Se déconnecter » est en haut à droite.
- **Enregistrer une clé** (la première fois, puis une seconde clé de secours) : `npm run auth:code`, lancé **sur le serveur**, donne un code valable 15 minutes, à saisir sur la page de connexion, dans « Enregistrer une clé de sécurité ».
- **Sauvegarde** : le bouton « Sauvegarde ZIP » télécharge vos données depuis l'instance en ligne. Faites-en une régulièrement.

Les scripts de déploiement de l'instance de l'auteur (`scripts/vps/`, `scripts/deploy-vps.ts`) et ses détails d'accès ne sont pas publiés. Pour votre propre serveur : installez une version, lancez `npm ci && npm run build`, puis `npm start` sous un utilisateur dédié, avec `CV_PUBLIC_ORIGIN` et les dossiers `CV_DATA_DIR`, `CV_IMPORT_DIR`, `CV_OUT_DIR` et `CV_AUTH_DIR` (chemins absolus) ; publiez `127.0.0.1:<CV_PORT>` en HTTPS.

---

## Recette du MVP et ce qu'il vous reste à faire

La recette T-01 à T-08 (§12.6) a été rejouée le 06/10/2026, par des tests automatiques (`npm run test:recette`) et dans l'interface (`npm run dev:demo`). Tous les scénarios sont conformes ; le détail, la méthode et les deux écarts corrigés sont dans [`docs/recette.md`](docs/recette.md). Claude y était simulé par un client MCP sur la copie de démo : le vrai Claude, vos données et les sites tiers sont restés hors de la recette.

**Ce qui vous reste à faire :**

1. **Brancher Claude Desktop** (section « Claude Desktop ») et vérifier les trois prompts (`adapter-a-une-offre`, `importer-mon-cv`, `rediger-lettre`) : point ouvert n° 5 du §15. Dans Claude Code, faites `/mcp` après `npm run build:mcp`.
2. **Confirmer les colonnes de votre export LinkedIn** par l'essai à blanc (section « Où déposer… »), puis l'importer.
3. **Remplir votre bibliothèque** (identité, photo si vous le souhaitez, import LinkedIn et import du CV par Claude), puis créer vos presets.
4. **Faire les contrôles manuels** ci-dessus sur votre vrai CV, au moins une fois.
5. **Choisir l'ordre des sections** de vos presets : en profil junior, Formation peut passer avant Expérience (↑/↓). Le cahier laisse ce point ouvert (§15 point 2) : aucun ordre par profil n'est imposé.

**Ce qui reste prévu après le MVP** (cahier, « V2 » et « Plus tard ») :

- copie figée et suivi des candidatures, ATS détecté d'après l'URL ;
- « Ajuster à 1 page », glisser-déposer, cocher par tag, filtres avancés ;
- restauration d'un ZIP, modèle `ats-moderne`, mots-clés de l'offre en gras ;
- badges, surlignage et extraction déterministe des termes de l'offre ;
- contrôles de rédaction, panneaux redimensionnables, navigation clavier complète, tableau de bord ;
- prompt `traduire-bibliotheque`, migrations de schéma, tests de bout en bout Playwright, commit automatique de `data/` ;
- plus tard : ESCO et ROME, embeddings, exports TXT, JSON Resume et Europass, extension de navigateur, mode sombre.

---

## Organisation du dépôt

```
packages/core     schéma Zod v1, assainissement, comparaison, sélection et projection
packages/render   gabarits Typst (ats-classique, visuel, lettre), polices (Carlito, Source Sans 3, IBM Plex Sans), compilation, mesure, DOCX, contrôle ATS
packages/store    lecture et écriture atomiques, verrou, révisions, identifiants, édition, propositions, surveillance, ZIP
apps/server       API Hono (127.0.0.1, jeton ; connexion par clé de sécurité en ligne)
apps/web          interface React + Vite + Tailwind
apps/mcp          serveur MCP stdio « cv »
fixtures/         personas, offres et propositions FICTIVES
scripts/          dev, start, data-init, check-ats, guard-commit, make-fixture-photo, auth-code
docs/decisions/   ADR
docs/recette.md   rapport de recette du MVP (T-01 à T-08)
```
