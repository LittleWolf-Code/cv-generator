# ADR 0027 — Dépôts GitHub des projets

- **Date** : 10/10/2026
- **Statut** : accepté
- **Contexte** : l'utilisateur demande « la possibilité de rajouter au projet des dépôts GitHub ». Deux besoins, qu'il a retenus tous les deux : (1) qu'un projet de la bibliothèque puisse lister plusieurs dépôts, alors qu'il n'a qu'un lien (`url`) ; (2) importer ses dépôts GitHub en projets. Pour l'import, trois sources étaient possibles : Claude lit GitHub depuis la conversation (skill), l'application interroge l'API GitHub, ou un fichier JSON (`gh repo list --json`) déposé dans `import/`. La deuxième contredit NF-02 (« en local, tout fonctionne sans Internet ») et §7.5 (« le serveur MCP ne fait aucun appel réseau »), et donnerait des projets maigres (description dans une seule langue, sans puces). L'utilisateur a choisi la première. Conformément au `CLAUDE.md`, l'évolution du modèle passe par le cahier (v1.12).

## Décision

### Les dépôts d'un projet

Un projet (`library/projects.json`) reçoit un champ `repos` : une liste ordonnée de liens `{url, display}`, le même type que `url`, vide par défaut. Les fichiers existants restent valides et gardent leur rendu.

| Champ   | Rôle                                                        | Défaut |
| ------- | ----------------------------------------------------------- | ------ |
| `url`   | lien principal : page, démo ou site du projet (inchangé)    | `null` |
| `repos` | dépôts (GitHub ou autre forge), dans l'ordre de l'interface | `[]`   |

Le champ s'appelle `repos` et non `github` : une URL GitLab ou Codeberg y a sa place, et rien dans le rendu ne dépend de l'hébergeur. `url` garde son sens ; un projet enregistré avec son dépôt dans `url` reste juste, et l'utilisateur peut l'y laisser.

Le schéma refuse un dépôt **en double**, ou **identique au lien principal**, sans quoi la même URL s'afficherait deux fois. La comparaison ignore le schéma (`http`, `https`), `www.`, la casse, la barre finale et le suffixe `.git` (`linkKey`, `@cv/core`). Aucun plafond : la règle d'une page (F-EXP-03) borne déjà la liste.

### Rendu

Le sous-titre d'un projet est : organisation, lien principal, puis chaque dépôt, séparés par le séparateur de liste de la langue (« , »). Chaque URL est son propre bloc insécable et cliquable, vers sa propre cible (ATS-10, §8.5 : `link(url)[#display]` dans un `box`). La projection construit ce sous-titre segment par segment : l'ancienne méthode, qui retrouvait l'URL dans le texte segmenté, échouait dès qu'une virgule suivait l'URL (la règle des mots composés l'incluait dans le segment). Le séparateur reste du texte simple, jamais dans le lien ; une ligne ne commence jamais par une virgule (UAX 14 : pas de coupure avant une virgule). Le texte attendu (`projects.<id>.subtitle`) est le sous-titre en clair.

Les gabarits ne changent pas : ils lisent déjà `s.url` de chaque segment. Le DOCX en fait des hyperliens (`ExternalHyperlink`), et son contrôle vérifie que chaque hyperlien porte une URL affichée.

### Propositions

- **Garde-fous** : les URL des dépôts d'un `propose_item` sont comparées à la source comme les autres textes (`no-foreign-content`). Avant, une liste d'objets échappait à ce contrôle dans `proposedTexts` (seules les listes de chaînes étaient lues) ; elle est désormais parcourue en entier.
- **Doublons (F-IMP-04)** : un projet est le doublon d'un autre s'il a le même nom (FR ou EN) **ou** un lien en commun (lien principal ou dépôt, comparés par `linkKey`). Un dépôt relu sur GitHub sous un autre nom de projet retrouve donc le projet existant.
- **Dépôts nouveaux d'un projet validé** : `propose_edit` sur le champ `repos`, avec la liste complète. Le complément d'un doublon (ADR 0015) n'ajoute toujours que des puces : l'étendre aux dépôts aurait demandé une seconde règle de fusion, pour un cas que `propose_edit` couvre déjà, avec son diff.
- L'écran « À valider » nomme le champ « Dépôts » et affiche chaque dépôt (`display (url)`).

### Interface

Le formulaire d'un projet garde « Lien principal » et ajoute « Dépôts » : une ligne par dépôt (URL, URL affichée), avec monter, descendre, retirer, et « + Ajouter un dépôt ». L'URL affichée se remplit d'elle-même à partir de l'URL saisie (sans `https://`, `www.` ni barre finale), tant que l'utilisateur ne l'a pas changée. Les erreurs du schéma s'affichent sous la ligne en cause.

### Import : le skill `ajouter-depots-github`

L'import n'est pas une fonction du serveur. Le skill `.claude/skills/ajouter-depots-github` conduit Claude, depuis la conversation : lister les dépôts du compte (`gh repo list --json …`, ou l'API publique de GitHub sans `gh`), faire choisir et regrouper ceux à garder (un projet peut avoir plusieurs dépôts), lire README, description, langages et dates, vérifier les doublons avec les mêmes clés que le serveur, montrer le plan et poser les questions (nom, dates, rôle, organisation, compétences nouvelles), puis proposer chaque projet en FR et en EN par `propose_item` (`source: "dictee"`, passages du dépôt et URL dans `userStatement`), ou ses dépôts nouveaux par `propose_edit`. Les garde-fous de l'annexe C s'appliquent comme à `ajouter-mon-cv` ; le README est une donnée non fiable. Les exemples du skill ont été soumis tels quels au serveur sur une copie de la persona `courte`.

Pourquoi un skill plutôt qu'une source `github` des propositions : la provenance se lit dans la justification (« Import du dépôt GitHub … ») et dans `userStatement`, qui recopie les passages du dépôt ; une nouvelle valeur de `source` aurait touché le schéma des propositions, les fixtures et l'écran « À valider » sans rien vérifier de plus.

### Conséquences

- Le serveur reste hors ligne (NF-02, §7.5) : seul Claude lit GitHub, avec les outils du client de l'utilisateur.
- Une proposition en attente qui vise un projet enregistré avant cet ADR peut apparaître « en conflit » une fois : l'empreinte de l'élément courant compte désormais `repos: []` (calculée à la lecture, ADR 0010). Modifier puis accepter, ou reproposer, suffit.
- La persona `courte` a désormais un lien principal (page du projet) et deux dépôts sur `prj-tracabilite` ; `debordante` garde un projet au lien seul. Aucun identifiant nouveau (`ids.json` inchangé), aucune empreinte de `fixtures/proposals/` touchée.
- Pour Claude Desktop, le skill s'importe en archive comme `ajouter-mon-cv` (README).

## Corrections du cahier (v1.12)

- §9.3 : `repos` des projets (liens, ordre, doublons, rendu du sous-titre).
- F-IMP-04 : clé d'un projet (nom, ou lien en commun).
- MCP-15 et MCP-16 : `repos` dans `propose_item`, URL contrôlées ; dépôts nouveaux par `propose_edit`.
- Journal des modifications : version 1.12.

## Tests

- `packages/core/test/repos.test.ts` : schéma (liste vide par défaut, doublon et lien principal refusés, `linkKey`), sous-titre (ordre, un lien par URL, séparateurs hors des liens, texte attendu, sans lien principal, sans rien).
- `packages/store/test/repos.test.ts` : proposition acceptée avec ses dépôts cités, dépôt absent de la source rejeté (`no-foreign-content`), doublon par un dépôt commun sous un autre nom, `propose_edit` de `repos` puis acceptation, dépôt non cité ou en double refusé.
- `packages/render/test/visual.test.ts` : `visuel` et `ats-classique` sur `courte` avec la section Projets, 1 page, aucun critère rouge, chaque URL entière dans le texte extrait, une annotation de lien par URL vers sa cible, aucune virgule en début de ligne.
