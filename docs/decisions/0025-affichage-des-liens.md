# ADR 0025 — Affichage des liens : URL seule, nom et URL, ou icône et URL

- **Date** : 10/10/2026
- **Statut** : accepté
- **Contexte** : l'utilisateur veut choisir, en ajoutant un lien à son identité, comment il s'affiche sur le CV : « icône – lien », « nom du lien – lien » ou « juste le lien ». Le cahier v1.9 n'en prévoit qu'un : l'URL lisible (§5.2, ATS-10). Il exclut aussi les icônes : « ni ligature ni icône » (§1) et ATS-08, « Aucune information portée seulement par une icône, un emoji ou un SVG ». L'ADR 0019 avait remplacé les icônes des coordonnées du CV de l'utilisateur par des libellés en texte (« aucune image hors de `photo()` »). Une icône peut donc s'ajouter à l'URL, mais pas la remplacer, et pas dans un modèle ATS. Conformément au `CLAUDE.md`, l'évolution passe par le cahier (v1.10).

## Décision

### Un style par lien, choisi dans l'identité

Chaque lien de l'identité (`profile.json`) reçoit deux champs, avec des valeurs par défaut : les fichiers existants restent valides et gardent leur rendu.

| Champ   | Valeurs                         | Défaut | Rôle                                                                          |
| ------- | ------------------------------- | ------ | ----------------------------------------------------------------------------- |
| `style` | `url`, `name`, `icon`           | `url`  | URL seule ; nom puis URL ; icône puis URL                                     |
| `name`  | bilingue (`{fr, en}`) ou `null` | `null` | nom du lien (style `name`) et texte de remplacement de l'icône (style `icon`) |

Le style appartient au lien, pas au preset : l'utilisateur le choisit en ajoutant le lien, comme il l'a demandé. Le preset choisit toujours quels liens afficher (`options.links`).

L'URL reste affichée en clair dans tous les cas (ATS-10). Le nom n'ajoute que du texte ; l'icône n'ajoute qu'une image. Aucune information n'est donc portée par la seule icône (ATS-08).

### Le nom

Sans nom à soi, le lien prend le nom de son type, dans la langue du CV (`labels.linkNames`) : LinkedIn, GitHub, Portfolio, « Site web » / « Website ». Un nom à soi est bilingue, comme les autres textes affichés : s'il manque dans la langue du CV, l'export est bloqué (`UNTRANSLATED`, champ `links.<n>.name` du profil), comme pour le pays. Il n'est résolu que s'il sert : un lien affiché par son URL seule ne bloque jamais l'export.

Le style `name` donne un libellé de coordonnée, comme « E-mail : » : le nom suivi du deux-points de la langue (`labelSep` sans son espace finale : « LinkedIn : » en français, « LinkedIn: » en anglais). Dans `ats-classique` et le DOCX, il précède l'URL sur la ligne des coordonnées ; dans le visuel, il est au-dessus de l'URL, comme les autres libellés de la colonne. C'est la forme recommandée par ATS-08 (« libellés en texte »).

### L'icône : modèle visuel seulement

Le style `icon` n'est dessiné que par le modèle `visuel`, « destiné à une lecture humaine, déconseillé pour les portails ATS ». Ailleurs, la projection le traite comme le style `url` :

- **`ats-classique`** : URL seule. Le cahier exclut les icônes des modèles ATS (§1, ATS-08), et le linter le vérifie désormais (voir plus bas).
- **DOCX** : URL seule. T-DOCX-01 réserve `w:drawing` à la photo.

L'interface l'annonce sous le choix du style, et dans les réglages d'un preset qui n'est pas en visuel. L'utilisateur qui veut un repère en texte dans un modèle ATS choisit le style `name`.

Dans le visuel, l'icône précède l'URL sur la même ligne, dans le même bloc insécable et le même lien cliquable. Elle a la hauteur du texte et prend la couleur d'accent, comme les libellés de la colonne. Une URL trop large pour la colonne est réduite avec son icône, jamais sous 9 pt (§8.5). L'icône porte le nom du lien en texte de remplacement (`alt`), dans les balises du PDF seulement, jamais visible. Le texte extrait ne contient que l'URL : le texte attendu (`header.contacts[i]`) est inchangé.

### Projection

`ProjectedContact` reçoit `icon: {kind, alt} | null`, non nul seulement pour un lien de style `icon` dans le visuel. Les autres coordonnées n'en ont jamais. `label` porte le nom du style `name`. Le gabarit ne lit que ces champs : aucun texte en dur, aucun chemin de fichier dans le `.typ`.

### Les icônes, fichiers fantômes du compilateur

Les icônes sont des SVG sans texte, écrits dans `packages/render/src/icons.ts`, un par type de lien :

| Type        | Icône                   | Origine                                                           |
| ----------- | ----------------------- | ----------------------------------------------------------------- |
| `linkedin`  | logo « in »             | Simple Icons, CC0 1.0 (marque de LinkedIn, qui désigne le profil) |
| `github`    | logo Octocat            | Simple Icons, CC0 1.0 (marque de GitHub, qui désigne le profil)   |
| `portfolio` | porte-documents (trait) | dessinée pour le projet                                           |
| `other`     | globe (trait)           | dessinée pour le projet                                           |

Comme la photo, elles passent à Typst par `mapShadow` (`/__icons/<type>-<couleur>.svg`, sous le workspace), jamais par la projection. Le nom du fichier porte la couleur d'accent, déjà contrôlée par le schéma (`#RRGGBB`) : un autre accent ne réutilise jamais une image en cache. Le rendu ajoute leurs chemins (`icons`, par type) aux données du gabarit seulement si une coordonnée a une icône. Typst les dessine en vectoriel : ni police, ni caractère, ni image matricielle dans le PDF.

### Linter (T-ATS-17)

Deux règles s'ajoutent :

- **`image-outside-photo`**, dans les deux profils : `image(` hors de `photo()` est refusé. Le profil `ats` devient plus strict (`ats-classique` et la lettre n'en avaient pas, mais rien ne l'interdisait) ; il n'est affaibli en rien.
- **`icon-content`**, profil `visuel` seulement : `image(` est aussi permis dans une fonction `link-icon()`, qui ne contient qu'une image : `box`, `baseline`, `image`, `height`, ses paramètres, et les deux champs de l'icône à leur place seulement, `data.icons.at(i.kind)` pour le chemin et `alt: i.alt` pour le texte de remplacement. Une chaîne, un bloc de contenu, un autre identifiant, ou `i.alt` / `i.kind` employés comme texte sont refusés.

Le profil `ats` ne permet `link-icon()` sous aucun nom : une icône y est toujours une `image-outside-photo`.

### Fixtures

- `courte` : le lien LinkedIn passe au style `icon`. La batterie ATS couvre l'icône dans le visuel (3 langues, 3 polices) et l'URL seule dans `ats-classique` et le DOCX. Le texte de `ats-classique` est inchangé.
- `pieges` : le lien GitHub passe au style `name`. La batterie couvre « GitHub : » dans les deux modèles.

Aucun identifiant ne change (`ids.json` inchangé) ; les propositions de `fixtures/proposals/` visent la bibliothèque, pas le profil : leurs empreintes ne changent pas.

## Décisions tranchées

| Question                               | Choix                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| Où se choisit le style                 | dans l'identité, lien par lien ; le preset choisit toujours les liens affichés      |
| Icône dans un modèle ATS               | non (§1, ATS-08) : URL seule ; le style `name` donne un repère en texte             |
| Icône dans le DOCX                     | non (T-DOCX-01) : URL seule                                                         |
| Nom d'un lien sans nom                 | le nom de son type, traduit par la projection                                       |
| Nom à soi                              | bilingue, bloquant à l'export s'il manque dans la langue du CV et qu'il est affiché |
| Couleur de l'icône                     | l'accent du thème, comme les libellés de la colonne                                 |
| Icône des autres coordonnées (e-mail…) | non : demande limitée aux liens ; elles gardent leurs libellés en texte (ADR 0019)  |

## Tests

- `packages/core/test/links.test.ts` : valeurs par défaut (un lien enregistré avant reste valide), style refusé, URL seule, nom du type en FR et en EN, nom à soi, nom non traduit bloquant seulement s'il est affiché, icône et texte de remplacement dans le visuel, aucune icône dans `ats-classique`, aucune icône pour les autres coordonnées.
- `packages/render/test/visual.test.ts` : règles `image-outside-photo` et `icon-content` dans les deux profils ; rendu de `courte` en visuel (icône avant l'URL, nom dans les balises du PDF, URL seule dans le texte, aucun critère rouge), sans icône en `ats-classique` ni dans le DOCX.
- `npm run test:ats` : `courte` (icône) et `pieges` (nom) dans les deux modèles, en FR, en-GB et en-US, avec les trois polices.

## Conséquences

- **Cahier v1.10** : §5.2, ATS-08, F-MOD-03, §8.5, §12.1 et T-ATS-17.
- **Interface** : dans l'identité, chaque lien a un choix « Affichage » (« Lien seul », « Nom – lien », « Icône – lien ») avec un aperçu du texte, et un champ « Nom du lien » bilingue pour les deux derniers. Les réglages d'un preset en `ats-classique` signalent qu'un lien à icône s'y affiche par son URL seule.
- **MCP** : aucun outil ne change ; les liens ne sortent pas par le MCP, sauf dans un rendu.
- **Mise en ligne** : le rendu change ; `npm run deploy` (YubiKey) pour l'instance en ligne.
- **Risque** : les logos de LinkedIn et de GitHub sont des marques. Ils servent ici seulement à désigner le profil vers lequel pointe le lien, sur le CV de l'utilisateur, et leur forme n'est pas modifiée. Ils sont dessinés à la couleur d'accent ; leurs règles de marque n'ont pas été vérifiées sur ce point (couleur imposée ou non).
