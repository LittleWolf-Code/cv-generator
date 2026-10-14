# ADR 0008 — Édition de la bibliothèque et sauvegarde

- **Date** : 05/10/2026
- **Statut** : accepté
- **Contexte** : lot 1 ; F-LIB-01 à 09 (sauf 06b et 09b), ATS-22, §8.4, §9.3, annexe B.1. Le cahier fixe les exigences mais pas le détail de la concurrence, de la validation en direct ni de la suppression des puces.

## Décision

### Écriture d'un élément (`packages/store/src/library.ts`)

Ordre, sous le verrou unique `data/.lock` :

1. **Assainissement** (`sanitizeDeep`, annexe B.1). Un refus (emoji, contrôle, zone privée) est renvoyé avec le **chemin du champ** (`bullets.0.variants.1.text.fr`) et un message sans chemin (« emoji interdit (U+1F680) en position 5 »). L'interface l'affiche sous le champ.
2. **Identifiants** attribués par le serveur (F-LIB-02) pour l'élément, ses nouvelles puces et les nouveaux liens de l'identité, puis consignés dans `ids.json`. À la création, tout identifiant envoyé par le client est **ignoré**. Une première validation se fait avec des identifiants provisoires, pour qu'une saisie refusée ne consomme pas d'identifiant. Base du slug : organisation et année de début (expérience), établissement et année (formation), sigle (compétence), code (langue), 3 à 4 premiers mots ailleurs.
3. **Schéma Zod** de la collection (le même que partout), puis **intégrité** de la bibliothèque : seules les erreurs nouvelles bloquent (identifiant en double, catégorie inconnue, rapportée sur `category`).
4. Écriture atomique de `ids.json` (si besoin), puis du fichier de la collection.

**Validation en direct** : `POST /api/library/:collection/check` exécute les étapes 1 à 3 sans rien écrire et renvoie aussi les avertissements ATS-22. L'interface l'appelle 400 ms après la dernière frappe. Le schéma reste donc unique (côté serveur) et le navigateur n'embarque ni Zod ni `libphonenumber-js`.

### Concurrence (précision du §8.4)

Une modification envoie la révision du fichier **et l'élément tel qu'il a été chargé** (`base`). Si la révision a changé mais que l'élément est identique (une autre partie du fichier a bougé, par exemple une proposition acceptée sur une autre expérience), la modification est **réappliquée** sur la version courante, comme le cahier le prévoit pour les ajouts purs. Sinon : **409 `STALE_REVISION`** avec la version actuelle ; l'interface propose de la charger. La création est un ajout pur, jamais refusée pour révision.

### Suppression en deux temps (F-LIB-05)

- « Archiver » met `archived: true` : l'élément n'est plus rendu ni proposé, il reste dans la bibliothèque.
- « Supprimer définitivement » n'est accepté **que pour un élément archivé** (sinon 409 `NOT_ARCHIVED`), après une confirmation dans l'interface. L'identifiant reste dans `ids.json` et n'est jamais réutilisé (`int-photo` supprimé, puis recréé : `int-photo-2`). Une référence restée dans un preset est ignorée avec un avertissement (§9.3).
- **Catégories** (cahier muet) : le schéma n'a pas de champ `archived`. Elles se suppriment directement après confirmation, et la suppression est refusée (409 `IN_USE`) tant qu'une compétence les utilise.
- **Puces et variantes** (cahier muet) : elles n'ont pas d'état archivé dans le schéma. Leur retrait se fait dans le formulaire de l'élément, avec une confirmation, puis s'enregistre comme toute modification.

### Duplication

Copie insérée juste après l'original, avec de nouveaux identifiants (élément et puces), non archivée, textes identiques. L'interface ouvre la copie.

### ATS-22 : avertissements, jamais un refus

`core/entry-warnings.ts` :

- **intitulé de poste** (FR et EN) : mot de 1 à 5 lettres suivi d'un point (« Ing. », « Sr. »), ou abréviation courante (`ing`, `resp`, `dev`, `mgr`, `eng`, `sr`, `jr`, `asst`, `dir`, `coord`, `proj`, `admin`…) ;
- **organisation** (expérience) et **établissement** (formation) réduits à un sigle de 2 à 5 caractères (« CEA », « CHU »).

Une heuristique ne peut pas connaître tous les sigles légitimes : c'est un avertissement affiché à la saisie et un badge dans la liste.

### Filtres (F-LIB-06)

Filtre texte côté interface, sur un texte de recherche calculé par le serveur (toutes les chaînes de l'élément, minuscules, sans accents). Filtre « non traduit » : élément dont au moins un champ bilingue vaut `null` (puces comprises). Les archivés sont masqués par défaut. Seuls ces deux interrupteurs sont mémorisés dans `localStorage` (état d'interface, §8.4).

### Sauvegarde ZIP (F-LIB-09)

`GET /api/backup.zip` (lecture seule, donc un GET, avec le jeton comme toute route `/api`) renvoie `cv-data-AAAAMMJJ-HHmmss.zip` : tout `data/` sous un dossier `data/`, sans le verrou, les fichiers temporaires ni `.git/`. Compression par **fflate 0.8.3**, déjà figé dans le projet (ADR 0001). L'interface télécharge le fichier par `fetch` puis un lien `blob:`, puisqu'un lien simple ne peut pas envoyer `X-CV-Token`.

## Conséquences

- La photo de l'identité reste au lot 3 (`sharp`) ; le formulaire d'identité l'indique.
- Les cases de sélection restent en lecture seule jusqu'au lot 2.
