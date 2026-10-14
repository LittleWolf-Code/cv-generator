# Fixtures (données fictives)

Tout ce dossier est **fictif** : aucune donnée réelle ne doit y figurer (NF-03). « Camille Martin », les entreprises, les écoles, les numéros et les adresses sont inventés. Le téléphone utilise une tranche réservée aux œuvres de fiction par l'ARCEP, les adresses e-mail le domaine réservé `example.com`.

| Dossier | Contenu | Résultat attendu |
|---|---|---|
| `personas/courte/` | Bibliothèque complète FR + EN, et une photo **fictive** (`assets/photo.jpg` : motif géométrique généré, aucune personne) | Tient sur une page ; tous les critères ATS au vert. Avec la case « Photo » cochée : T-ATS-16 orange, rien d'autre de dégradé. Lien LinkedIn au style `icon` (ADR 0025) : icône dans le visuel, URL seule en `ats-classique` et dans le DOCX. Projet `prj-tracabilite` (non coché) avec un lien principal et deux dépôts (ADR 0027) |
| `personas/debordante/` | Même persona, tout coché | Environ 1,3 page : export refusé, critère Pages rouge, dépassement chiffré ; autres critères verts sur le PDF de mesure |
| `personas/pieges/` | Pièges du §12.2 du cahier | Caractères assainis, aucune fausse détection de coordonnées, chaque plage de dates sur une ligne. Lien GitHub au style `name` (ADR 0025) : « GitHub : » avant l'URL |
| `offres/` | 3 offres fictives : développeur backend, logiciel DM, qualité / affaires réglementaires DM | Entrée des lots 4 et 5 ; copiées dans le `import/offres/` temporaire de `npm run dev:demo` ; aucune phrase signalée comme consigne pour une IA |
| `analyses/` | Analyse fictive de l'offre « logiciel DM » : 11 termes, chacun avec sa phrase source tirée de l'offre | Couverture (lot 4) sur `courte` avec son preset : 9 / 17 = 52,9 %, moyen ; groupe a : « traçabilité des exigences » (« matrice de traçabilité », dans le projet non coché) ; b : l'intitulé (« Ingénieure »), « cycle de vie logiciel » (terme voisin) ; c : « tests d'intégration ». À importer dans le panneau Couverture d'une candidature |
| `imports/` | Export LinkedIn fictif de Camille Martin : CSV dans `linkedin/` et le ZIP `Basic_LinkedInDataExport_fictif.zip` (avec un CSV hors périmètre à la racine et un CSV imbriqué, ignorés) ; CV fictif en PDF avec couche texte, en DOCX et en PDF « scanné » (une image de barres grises, sans texte), générés depuis `cv-source.md` par `npx tsx scripts/make-fixture-imports.ts` | Lot 6 : import sur `courte` = 13 propositions (dont un complément MedTech, une variante, une date à vérifier, l'allemand sans niveau CECRL), 11 doublons, 4 incomplets ; T-01, T-02, T-05. Copiés dans le `import/` temporaire de `npm run dev:demo` |
| `letters/` | Lettres de motivation fictives pour l'offre « logiciel DM » : FR (`vous`, `moi`, `nous`), EN (`opening`, `evidence`, `motivation`, `close`, destinataire « Ms Durand ») et une lettre FR trop longue | Lot 7 : 1 page et tous les critères de la colonne Lettre au vert en FR, en-GB et en-US ; la lettre trop longue est refusée (dépassement chiffré). La v1 de la candidature de `npm run dev:demo` |
| `proposals/` | 6 propositions fictives sur `courte` : variante (`VAR001`), sélection qui en dépend (`SEQ001`), variante en conflit (`STA001`), fait sensible (`EDT001`), alias (`SYN001`), nouvel élément (`NEW001`) | Écran « À valider » (lot 1) : seule `STA001` est en conflit |

## Format

Chaque persona a la même arborescence que `data/` (§9.1). Les fichiers sont des **saisies brutes** : ils passent par le chemin d'écriture (`installFixture` de `packages/store`), qui assainit chaque texte (annexe B.1) puis valide le schéma. C'est pourquoi `pieges/` contient volontairement des caractères interdits (U+00A0, U+202F, U+00AD, U+200B, U+2011, apostrophes courbes), écrits en échappements JSON `\u` pour rester lisibles.

La photo de `courte` se régénère avec `npx tsx scripts/make-fixture-photo.ts` : le script dessine un motif abstrait et le fait passer par le traitement d'import (recadrage 3:4, 600 × 800 px, JPEG qualité 85, sans métadonnées). `installFixture` copie tel quel un JPEG de `assets/` après avoir vérifié qu'il pèse 300 Ko au plus.

`pieges/refused-inputs.json` liste des saisies que l'assainissement doit **refuser** (emoji, caractère de contrôle, zone privée). Il ne fait pas partie du modèle de données et n'est pas installé.

Après une modification d'une bibliothèque, mettez à jour `ids.json` (registre des identifiants) : chaque identifiant d'élément, de puce, de preset et de lien doit y figurer.

Les propositions ne sont pas installées avec les personas : on les dépose à la main dans le dossier `proposals/` de la démo (voir le README). Leur `base.hash` est l'empreinte SHA-256 du JSON canonique de l'élément visé dans la persona `courte` installée, et `base.snapshot` sa copie (ADR 0010). Si `courte` change, `packages/store/test/proposals.test.ts` échoue : recalculez ces empreintes avec `hashSubject` de `packages/store`.
