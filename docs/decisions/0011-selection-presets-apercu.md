# ADR 0011 — Sélection, presets et aperçu en direct

- **Date** : 05/10/2026
- **Statut** : accepté
- **Contexte** : lot 2 ; F-SEL-01 à 08 et 10, F-PRE-01/02, F-UI-01/02, NF-04, T-06, T-07. Le cahier fixe les exigences, pas le comportement fin des cases, de l'enregistrement ni de la règle F-SEL-10. Trois points ont été tranchés par l'utilisateur le 05/10/2026 (marqués « décision utilisateur »).

## Opérations de sélection (`packages/core/src/selection-ops.ts`)

Fonctions pures, **sans Zod** : l'interface les importe par le sous-chemin `@cv/core/selection` (entrée `exports` de `@cv/core`), ce qui garde Zod hors du navigateur (ADR 0008). Elles modifient la sélection reçue : elles servent telles quelles dans un producteur Immer, et le serveur les applique à une copie. `applyOrder` et `antichronological` y ont été déplacés (`select` les importe) ; `REGULATORY_CATEGORY` vit dans `constants.ts`.

### Trois états (F-SEL-01, F-SEL-02)

- **Entrée** (expérience, formation, projet) : décochée si son identifiant n'est pas dans `include` ; cochée si toutes ses puces le sont ; **mixte** sinon. Le compteur « 3/5 puces » compte les puces retenues, même quand l'entrée est décochée (« 3/5 puces (masquées) »).
- **Section** : décochée si `enabled` est faux ; cochée si tous ses éléments sont cochés ; mixte sinon. Pour l'accroche, l'accroche choisie compte.
- **Clic sur un parent** : il ne bascule que **son propre** état. Mixte → décoché → mixte : les puces ne bougent pas, d'où T-07. Une section décochée garde de même ses éléments.
- **Cocher un enfant rend ses parents visibles** : la section est activée, et l'entrée d'une puce est cochée. Sinon le clic n'aurait aucun effet visible.
- **Première coche d'une entrée** (décision utilisateur) : une entrée cochée alors qu'**aucune** de ses puces n'est retenue reçoit toutes ses puces. Si au moins une puce est retenue, la sélection des puces revient telle quelle.
- **Accessibilité** : `<input type="checkbox">` natif, propriété `indeterminate` remise à chaque rendu (un clic l'efface). `aria-checked="mixed"` n'est posé que dans l'état mixte (F-SEL-01) : dans les autres états, l'état natif suffit et les règles « ARIA in HTML » déconseillent de le doubler.
- **Éléments verrouillés** (décision utilisateur) : l'utilisateur peut les décocher à la main. Le verrou protège des pré-sélections automatiques (F-SEL-10) et s'affiche en badge.
- **Éléments archivés** : case désactivée (jamais rendus).

### Titre, accroche et variantes (F-SEL-03)

Le titre et l'accroche se choisissent par boutons radio, et « Aucun titre » est possible (`titleId: null`). La variante se choisit par une liste, affichée dès qu'il y en a au moins deux, pour chaque puce et pour le titre et l'accroche choisis. Choisir une accroche active la section `summary`. Un `overrides.title` déjà présent est signalé dans les réglages : sa saisie n'est pas au périmètre du lot 2.

### Ordre (F-SEL-04)

- **Éléments** : `moveInOrder` échange l'élément avec son voisin dans l'ordre affiché, puis enregistre **toute la liste** dans `order[clé]`. La clé est la section, ou l'identifiant de l'entrée pour ses puces.
- **Compétences** : elles se déplacent **dans leur catégorie** : un voisin d'une autre catégorie est enjambé, car le rendu regroupe les compétences par catégorie (ordre des catégories = ordre de la bibliothèque).
- **Sections** : `moveSection` laisse l'accroche à sa place (elle suit toujours le titre, §5.1). Avec `skills-subgroup`, la section `regulatory` est enjambée et ses boutons sont masqués : elle n'a pas de place à elle.
- **Expériences et formations** : pas de bouton, mention « Ordre antichronologique imposé ».
- **Filtre actif** : les ↑/↓ sont désactivés pendant un filtrage, pour ne pas déplacer un élément par rapport à des voisins masqués.
- **Clavier** : boutons natifs. Après un déplacement, le focus revient sur le même bouton, ou sur l'autre au bord de la liste, et la nouvelle position est annoncée par une région `aria-live` (« … déplacé en position 3 sur 8 »).

## Arbre et état de l'interface

- **Arbre indépendant de la sélection.** `GET /api/library` renvoie un arbre sans état de sélection. Les libellés existent en FR et en EN ; les variantes, la catégorie et le drapeau `fixedOrder` y figurent. L'interface applique le preset en cours d'édition : coches, ordre des sections et des éléments, variantes choisies. Une coche s'affiche donc immédiatement, sans aller-retour serveur.
- **Zustand 5.0.15 + Immer 11.1.21** (ADR 0001) : la bibliothèque, les presets, la version **enregistrée** du preset affiché et son **brouillon**, l'état de l'enregistrement et l'aperçu. `@cv/core` devient une dépendance d'exécution de `@cv/web`, limitée au sous-chemin sans Zod.

## Enregistrement du preset (décision utilisateur : automatique)

- Chaque changement s'applique au brouillon, puis est enregistré **250 ms après le dernier**, par `PUT /api/presets/:id` (preset complet et `expectedRevision`). Les enregistrements sont chaînés, jamais deux à la fois. Changer de preset enregistre d'abord le précédent.
- `PUT` ne change ni `id`, ni `isDefault`, ni `archived`, qui ont leurs propres actions. Le corps est assaini puis validé comme toute écriture (`prepare`).
- **Révision périmée** : 409 `STALE_REVISION` avec la version actuelle. Un bandeau propose « Recharger la version enregistrée » ou « Garder mes modifications ». Le second choix enregistre le brouillon par-dessus : c'est un choix explicite, sur un preset de l'utilisateur, sans fusion champ par champ.
- **Événement SSE** sur le preset affiché :
  - sans modification en attente : rechargement silencieux ;
  - si seuls la révision ou un drapeau changent (preset par défaut, archivage) : rien à fusionner ;
  - sinon : le même bandeau de conflit.
- Les écritures de l'interface renvoient `writes` et sont ignorées par le flux (ADR 0009).

## Aperçu en direct (F-SEL-06, NF-04)

- `POST /api/render` accepte `{ presetId, draft }`. `draft` (langue, `enVariant`, modèle, sélection, options) est assaini et validé comme une écriture, puis compilé, **sans rien écrire**. C'est l'équivalent interface de `preview_selection` (MCP-11, lot 5).
- L'aperçu se recompile 250 ms après le dernier changement. Une réponse dépassée par une plus récente est ignorée (numéro de séquence).
- L'interface affiche le délai entre le dernier changement et l'aperçu peint (`aperçu à jour en … ms`).
- **Mesures** du 05/10/2026 sur `debordante` (2 pages), Vite en développement :
  - requête de rendu : 40 à 70 ms (compilation Typst 5 à 20 ms et contrôle ATS compris) ;
  - chargement du PDF par pdf.js : environ 115 ms ; peinture des 2 pages à l'échelle 1,5 : environ 30 ms (12 ms pour une page) ;
  - du clic au nouveau PDF chargé dans l'aperçu : 430 à 480 ms, anti-rebond de 250 ms compris. Soit environ 0,5 s jusqu'à l'aperçu peint, sous la limite d'1 s de NF-04.
- **Peinture.** pdf.js peint au rythme de `requestAnimationFrame`. Quand la fenêtre n'est pas affichée, le navigateur réduit ce rythme à 1 image par seconde, et le délai mesuré n'a alors pas de sens. Le délai affiché fait foi quand la page est visible.

## Jauge, dépassement et blocage (F-SEL-07, F-SEL-08, F-UI-06)

- **Jauge** : `role="meter"`, échelle de 0 à 150 % avec un repère à 100 %. Elle passe au rouge au-delà, avec le dépassement en lignes (`aria-valuetext` : « 127 %, dépasse d'environ 16 lignes »).
- **État d'export** sous la barre :
  - « Export possible » ;
  - ou « Export bloqué » avec les motifs : critères rouges, et champs non traduits résumés (leur liste avec liens arrive au lot 6).
  - Au-delà d'une page en densité normale, un bouton « Passer en densité compacte » applique la correction proposée. Les boutons d'export arrivent au lot 3.
- **Message de T-ATS-01** (partagé avec le MCP) : il ne propose la densité compacte que si elle n'est pas active. Sinon : « décochez une puce ou une entrée (la densité compacte est déjà active) ».
- **Densité** : `normale` ou `compacte`, réglages de l'ADR 0007 (corps 10,5 ou 10 pt, marges 1,8 ou 1,5 cm).
- **Photo** : case désactivée jusqu'au lot 3.
- **Langue** : un seul choix FR / EN-GB (A4) / EN-US (Letter) règle `lang` et `enVariant`.

## Presets (F-PRE-01/02)

- **Création** : preset **vierge** (rien de coché, sections par défaut du §2.2 : projets et certifications désactivées). Identifiant `preset-<slug du nom>`, consigné dans `ids.json` et jamais réutilisé. `fileLabel` dérivé du nom (annexe B.4, 40 caractères, `CV` à défaut).
- **Duplication** : copie de la sélection, de l'ordre, des variantes, de la langue, du modèle, des options et du `fileLabel`. La copie n'est ni le preset par défaut, ni archivée.
- **Renommer** : enregistrement du nom. Un nom refusé (vide, emoji) est signalé dans la fenêtre, le brouillon reste intact.
- **Archiver ou restaurer** : un preset archivé reste consultable (groupe « Archivés »). Le preset par défaut ne s'archive pas (409 `IS_DEFAULT`), un preset archivé ne devient pas le preset par défaut (409 `ARCHIVED`). Archiver le preset affiché bascule sur le preset par défaut.
- **Preset par défaut** : un seul. `POST /api/presets/:id/default` retire le drapeau du précédent et renvoie les deux écritures.
- **Mémorisation** : `localStorage` ne garde que l'identifiant du preset affiché (§8.4).

## Règle serveur F-SEL-10

- **Élément visible** : identifiant dans `include`, non archivé, section activée. Pour le titre et l'accroche : élément choisi (et section `summary` activée).
- **Violations** relevées par `checkSelectionRule(bibliothèque, base, nouvelle)` :
  - `HIDES_EXPERIENCE` : une expérience visible dans la base ne l'est plus, par retrait de l'entrée ou désactivation de la section. **Retirer ses puces reste permis** : l'entrée demeure, sans trou dans le parcours ;
  - `UNCHECKS_LOCKED` : un élément verrouillé visible ne l'est plus.
- **Où la règle s'applique** :
  - **à l'acceptation** d'une proposition de sélection, sur le résultat des éléments choisis : 422 `SELECTION_RULE` avec les identifiants en cause et la consigne « décochez ces éléments de la proposition ou rejetez-la » ;
  - **dans l'écran « À valider »** : un retrait qui enfreint la règle est marqué non applicable, avec son motif, et n'est pas présélectionné ;
  - **dans l'acceptation en lot**, qui laisse la proposition de côté.
- Le lot 5 réutilisera `checkSelectionRule` à la création (`propose_selection`).
- La règle ne vise que les pré-sélections automatiques : les coches de l'utilisateur ne sont pas contrôlées.

## Conséquences

- Les tests couvrent les trois états et T-07 (`packages/core/test/selection-ops.test.ts`), les presets, l'aperçu d'un brouillon, F-SEL-10, T-06 et NF-01 (`apps/server/test/selection.test.ts`).
- `.claude/launch.json` gagne la configuration `cv-debordante` pour vérifier T-06 dans le navigateur.
