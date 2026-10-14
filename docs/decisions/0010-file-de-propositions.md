# ADR 0010 — File de propositions et écran « À valider »

- **Date** : 05/10/2026
- **Statut** : accepté
- **Contexte** : §6.9 (F-PRO-01 à 06), F-UI-03, §9.2 (`proposals/<ULID>.json`), annexe C. Au lot 1, les propositions viennent de fixtures ou d'un dépôt manuel ; les outils `propose_*` qui les créent arrivent au lot 5.

## Base, empreinte et état `stale`

- **Sujet** d'une proposition : la **puce** visée si `target.bulletId` est renseigné, sinon l'**élément** (titre, accroche, expérience, compétence…), et la **sélection** du preset ou de la candidature pour une proposition `selection`. Un nouvel élément (`item`) n'a pas de sujet : c'est un ajout pur, `base` vaut `null`.
- **`base.hash`** = `sha256:` + SHA-256 du **JSON canonique** du sujet (clés triées récursivement, `core/canonical.ts`), calculé sur sa forme stockée.
- **`stale` est calculé à la lecture et n'est jamais écrit par le serveur** : une proposition ouverte est en conflit si l'empreinte du sujet actuel diffère de `base.hash`, ou si le sujet n'existe plus. Si l'élément revient à son état d'origine, le conflit disparaît. Un fichier dont le statut enregistré est `stale` est traité comme ouvert.

### Ajout au schéma : `base.snapshot`

Le schéma du lot 0 ne gardait que l'empreinte de la base, ce qui ne permet pas d'afficher la colonne « base » du **conflit en trois colonnes** exigé par F-PRO-04. Ajout d'un champ **facultatif** `base.snapshot` : la copie du sujet au moment du calcul. Il n'est utilisé que si son empreinte est égale à `base.hash` ; sinon la colonne indique « non enregistrée dans la proposition ».

**Proposition de correction du cahier** : au §9.2 (exemple `proposals/…json`), écrire `"base": { "file": "library/experiences.json", "revision": 12, "hash": "sha256:…", "snapshot": { …puce au moment de la proposition… } }` ; dans F-PRO-04, préciser « la **base** (fichier, révision, empreinte du JSON canonique de l'élément visé et copie de cet élément) ».

## Acceptation (F-PRO-03)

Le texte validé n'est jamais écrasé :

| Type          | Effet                                                                                                                                                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `variant`     | **Nouvelle variante**, d'identifiant dérivé du libellé (`acme-tracabilite`, puis `-2`…). Une variante au texte identique à une variante existante n'est pas dupliquée                                                                                      |
| `translation` | Remplit seulement une langue **vide** (`null`) ; si elle est déjà traduite, la proposition est inapplicable (on modifie alors l'élément dans la bibliothèque)                                                                                              |
| `edit`        | Remplace le champ visé (chemin pointé) ; `id`, `bullets` et `variants` sont refusés. **Fait sensible** (F-PRO-06) recalculé par le serveur : `organization`, `position`, `start`, `end`, ou `sensitive: true`. L'ancienne valeur reste dans la proposition |
| `alias`       | Ajoute l'alias ou le terme voisin s'il ne figure pas déjà dans la compétence (sigle, alias, termes voisins)                                                                                                                                                |
| `item`        | Ajoute l'élément ; ses identifiants (élément et puces) doivent être libres, et sont consignés dans `ids.json`                                                                                                                                              |
| `selection`   | Éléments acceptés **un par un** (`add:<id>`, `remove:<id>`, `variant:<id>`). `prop:<ULID>` est remplacé par la variante créée à l'acceptation de cette proposition ; si elle a été rejetée, l'élément est écarté avec le motif                             |

- **Modifier puis accepter** : la valeur modifiée est assainie et validée (`editedPayloadSchemas`). Pour un nouvel élément, l'interface réutilise le formulaire de la bibliothèque. Statut `edited` si la valeur diffère de la proposition, ou si une sélection n'est acceptée qu'en partie ; sinon `accepted`. `resolution.finalValue` garde ce qui a été appliqué (identifiant de la variante créée, éléments appliqués et écartés).
- **Dépendances** : une sélection dont une dépendance est en attente est refusée (409 `DEPENDENCY_PENDING`), sauf avec `withDependencies`, qui accepte d'abord les dépendances sous le même verrou. L'interface le propose et l'annonce.
- **Conflit** : une proposition `stale` reste acceptable « sur la version actuelle » (une variante, un alias ou une sélection restent des ajouts) ; l'écran montre d'abord base, actuelle (différences surlignées par rapport à la base) et proposée. Pour une modification, les colonnes se limitent au champ visé.
- **Rejet** : statut `rejected`, motif facultatif assaini. Aucun fichier de proposition n'est supprimé : l'historique reste consultable.
- **Ordre d'écriture** : la cible, puis la proposition. Après une interruption entre les deux, une nouvelle acceptation ne change rien de plus (variante identique, alias présent, élément identique, même delta de sélection).

## Acceptation en lot (F-UI-03)

Sont exclus : les faits sensibles, les propositions en conflit (vérification refaite sous le verrou) et les propositions inapplicables. Les propositions de bibliothèque passent avant les sélections ; une sélection n'entre dans le lot que si ses dépendances en attente y sont aussi. Chaque exclusion est renvoyée avec son motif.

## Dépôt manuel et robustesse

`proposals/` est lu fichier par fichier : un nom qui n'est pas `<ULID>.json`, un `id` différent du nom, un JSON invalide (copie en cours) ou un schéma refusé apparaissent dans une liste « fichiers illisibles », sans masquer les autres propositions.

## Hors lot 1

- Les **contrôles de l'annexe C** sont calculés à la création (lot 5) ; l'écran affiche ceux qui sont enregistrés dans la proposition.
- **F-SEL-10** (aucune expérience entière masquée, éléments verrouillés) est appliqué par `propose_selection` (lots 2 et 5).
- `supersedes` est géré à la création (lot 5) ; l'écran l'affiche.
- La dépendance `ulid` n'est pas installée : le lot 1 ne crée aucune proposition.

## Fixtures

`fixtures/proposals/` (persona `courte`) : `VAR001` (variante), `SEQ001` (sélection qui dépend de `VAR001`), `STA001` (variante en conflit : instantané d'une ancienne formulation de la puce), `EDT001` (fait sensible), `SYN001` (alias), `NEW001` (nouvel élément). Les empreintes ont été calculées sur la persona installée (`hashSubject`) ; `packages/store/test/proposals.test.ts` vérifie que seule `STA001` est en conflit. Si la persona `courte` change, ce test l'indique et les empreintes sont à recalculer.
