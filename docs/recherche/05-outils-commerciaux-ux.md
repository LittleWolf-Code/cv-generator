# Benchmark des outils commerciaux de CV : personnalisation par offre, UX et ATS (état au 05/10/2026, version vérifiée)

## 0. Synthèse

- **Le modèle « CV maître + versions » est maintenant courant.**
  - Teal propose une bibliothèque de puces synchronisée entre toutes les versions. On coche ou décoche chaque élément selon la version.
  - Huntr distingue un CV « base » et des CV « tailored ».
  - France Travail génère un ou plusieurs CV à partir du Profil de compétences.
  - CVDesignR gère plusieurs versions (jusqu'à 8 CV en gratuit).
  - FlowCV n'a pas de bibliothèque. Selon un CLI non officiel, son modèle de données prévoit un indicateur caché/visible et un ordre pour chaque entrée.
- **Deux familles de score de correspondance.**
  - **Recoupement littéral pondéré.**
    - Jobscan : compétences techniques > diplôme > intitulé > soft skills > autres mots.
    - Teal : pourcentage des termes clés de l'offre présents dans le CV.
  - **Évaluation sémantique par un modèle de langage (LLM).**
    - Huntr : les qualifications pèsent environ un tiers à la moitié du score, les mots-clés généralement moins de 20 %.
    - Le contexte est reconnu même si le mot exact est absent.
  - Ces scores ne reproduisent pas les vrais ATS. Ceux-ci évoluent vers la correspondance sémantique (Greenhouse Talent Matching, Workday HiredScore). Greenhouse ne rejette jamais automatiquement.
- **Le chiffre « 75 % des CV rejetés par les ATS » est un mythe.**
  - Il vient d'un argument commercial de Preptel en 2012. L'entreprise a fermé en 2013 et n'a jamais publié de méthodologie.
  - Le vrai risque technique est un **CV mal lu par l'ATS** : colonnes, en-têtes, icônes, PDF en image. C'est le problème des CV Canva.
- **Contrôle de la longueur :**
  - Novorésumé limite la version gratuite à une page ; plusieurs pages demandent Premium. Une alerte de débordement n'est pas confirmée par les sources consultées.
  - Reactive Resume (open source, v6 sortie le 04/10/2026) a un bouton « Fit to one page ». Il réduit dans l'ordre la densité, puis les marges, puis la police (9 pt minimum).
  - Les autres outils laissent l'utilisateur régler l'espacement à la main.
- **Export très variable selon les outils.**
  - Teal : PDF uniquement.
  - Rezi, Kickresume et Huntr : PDF et DOCX.
  - Enhancv : PDF et TXT selon le site officiel, sans Word.
  - FlowCV : seul le PDF est confirmé.
  - Reactive Resume : PDF, Word, Markdown et JSON.
  - Pour un public français, **PDF texte + DOCX** reste le choix le plus sûr.
- **Les meilleurs principes UX à reprendre pour une interface à cases à cocher :**
  - des cases à 3 niveaux (section > élément > puce) ;
  - des presets nommés par type de poste ;
  - une jauge de page en temps réel ;
  - le surlignage des mots-clés de l'offre directement sur les puces de la base ;
  - une liste de mots-clés couverts / manquants, avec un bouton « ignorer » ;
  - un aperçu texte brut (« ce que voit l'ATS ») ;
  - une copie figée de chaque CV envoyé, liée à la candidature.

---

## 1. Fiches outils

### Teal (tealhq.com) : référence du « CV maître » et du suivi de candidatures
- **Bibliothèque et synchronisation (« Resume Syncing », annoncée le 02/08/2023, confirmé).**
  - Le contenu est partagé entre toutes les versions de CV.
  - Une nouvelle puce est disponible partout ; on l'active ou la désactive pour chaque version.
  - Décocher ne supprime rien : la puce reste dans le compte.
  - Quand on modifie une puce, une case « Save to All Resumes » décide si la modification s'applique partout ou seulement à la version en cours.
  - Si la modification n'est pas synchronisée, les autres versions affichent « Update Available ». Ce point vient d'extraits d'aide et n'a pas été vérifié sur la page source.
  - Les pages d'aide Teal renvoient une erreur 403 et n'ont pas pu être ouvertes.
- **Granularité des cases.** On peut cocher/décocher les puces, les expériences et les compétences (usesprout, 12/2025 ; resumegenius, 01/2026).
- **Auto-Select.**
  - Option à activer *avant* d'associer une offre (onglet « Job Matcher » > menu « … » > « Auto-select content to matched job »).
  - L'outil désactive les éléments jugés peu pertinents.
  - Critique relevée par Wobo (07/2026) : *« AI often deselects bullets with valuable experience »*.
- **Job Matcher / Match Score.**
  - On colle l'offre. L'écran montre le CV et l'offre côte à côte, avec les mots-clés de l'offre surlignés et un score qui se met à jour pendant l'édition.
  - Calcul : pourcentage des termes clés de l'offre présents dans le CV. Jobscan (09/03/2026) indique qu'un score de 80 % ou plus est considéré comme bon chez Teal.
  - La version gratuite ne montre que les 5 premiers mots-clés ; la liste complète et le score demandent Teal+ (Wobo, 07/2026).
- **Resume Analyzer.**
  - Note la structure, les résultats chiffrés et l'usage des mots-clés.
  - Contrôles : nombre de puces par poste, puces de 100 à 150 caractères, verbes d'action, contact, intitulé visé, longueur du résumé.
  - Ces détails viennent d'extraits non vérifiés sur la page source (403). Il en va de même pour le conseil de prévoir 15 à 20 puces par poste dans la base.
- **Mise en page.**
  - Aperçu en direct.
  - L'onglet « Advanced » (Teal+) règle les espacements.
  - Aucun compteur de pages n'est documenté.
  - Le glisser-déposer n'est mentionné dans aucune revue consultée.
- **Export.** PDF uniquement. resumegenius (30/01/2026) le confirme et regrette l'absence de Word. La FAQ Teal n'a pas pu être ouverte.
- **Suivi de candidatures.**
  - Étapes : Bookmarked → Applying → Applied → Interviewing → Negotiating → Accepted.
  - Notes, contacts, modèles d'e-mail, version de CV rattachée à chaque offre.
  - Extension Chrome pour enregistrer des offres depuis LinkedIn, Indeed, etc.
  - Teal a racheté Ramped (candidature automatique) en 12/2025. Selon Wobo, la candidature automatique n'était toujours pas disponible en 07/2026.
- **Prix.** Teal+ coûte 13 $/semaine, 29 $/mois ou 79 $/trimestre (Jobscan 03/2026, Wobo 07/2026). resumegenius indiquait 9 $/semaine en 01/2026 : le prix hebdomadaire a augmenté.

### Jobscan : référence du « match rate »
- **Calcul (tutoriel officiel, confirmé).** Ordre de priorité :
  1. compétences techniques (hard skills), poids le plus fort ;
  2. niveau d'études, seulement si l'offre exige un diplôme avancé ;
  3. intitulé de poste. Jobscan affirme qu'un intitulé identique donne un taux d'entretien « 3.5 times » plus élevé ; c'est un chiffre de l'éditeur, sans méthodologie publiée ;
  4. soft skills ;
  5. autres mots-clés.
- **Ce qui compte et ne compte pas.**
  - Les compétences fréquentes dans l'offre pèsent plus.
  - Le nombre de mots et les résultats chiffrés ne comptent pas dans le score ; ils donnent seulement des conseils.
  - Seuil recommandé : 75 %.
- **Exclude skills.** On peut retirer une compétence non pertinente via le lien « Report ».
- **Predicted skills.** Elles ne comptent pas dans le score, puisqu'elles ne sont pas dans l'offre.
- **Scan.**
  - Plus de 30 contrôles : type de fichier, colonnes, tableaux, graphismes, polices, en-têtes/pieds de page, emplacement du contact, titres de sections, format des dates, correspondance poste/expérience, résultats mesurables, longueur, ton, orthographe.
  - Jobscan annonce aussi « up to 3x more job interviews » : argument marketing.
- **ATS Tip (confirmé).** À partir du nom de l'entreprise et de l'URL de l'offre, Jobscan détecte l'ATS et adapte ses conseils.
- **Power Edit.** Éditeur qui recalcule le score à chaque frappe, fonction payante. Non revérifié lors de ce contrôle.
- **Prix.** Premium : 49,95 $/mois ou 89,95 $ par trimestre (article Jobscan du 09/03/2026). La version gratuite donne « quelques scans par mois ». Le chiffre de 5 scans vient de sources tierces et n'est pas confirmé par Jobscan.
- **Limite reconnue.** Le scanner peut signaler comme manquante une compétence formulée autrement. Exemples : « project management » au lieu de « program delivery », « Tableau » au lieu de « data visualization ». JobShinobi le rapporte en citant le support Jobscan lui-même.
- **Point obsolète.**
  - D'anciens conseils disaient que Greenhouse ne reconnaît pas les abréviations et classe selon la fréquence des mots.
  - La FAQ Greenhouse Talent Matching dit au contraire que **plusieurs termes peuvent correspondre à une même compétence**.
  - L'article Jobscan sur Greenhouse (24/09/2026) affirme que Greenhouse « does not reject anyone automatically, and it never has ».

### Rezi
- **Rezi Score (doc officielle, confirmé) : temps réel, 5 catégories.**
  - Content : 3 à 6 puces par expérience, impact.
  - Format : 1 page idéalement, 2 au maximum ; police de 8,5 à 11 pt.
  - Optimization : alignement avec l'offre.
  - Best Practices : 400 à 1 600 mots, dates au format « January 2025 », pas de formules creuses (« hardworking », « team player », « results-driven ») sans preuve.
  - Application Ready.
  - Seuils : 90+ prêt à envoyer ; 50 à 89 à améliorer ; moins de 50 à retravailler.
- **AI Keyword Targeting (confirmé).**
  - On saisit l'intitulé, l'entreprise et l'offre.
  - L'outil liste les mots-clés manquants ; ceux qui sont présents ont une coche verte et sont surlignés dans le CV.
  - Les puces générées sont placées **sous le poste qui correspond le mieux au mot-clé**.
  - La doc recommande d'intégrer les mots-clés naturellement plutôt que de les empiler.
  - Les « 10 catégories » et « priorités 1 à 3 » d'un résumé de recherche **n'existent pas** dans la doc officielle.
- **Architecture.** Le contenu est stocké à part du design.
- **Export.**
  - PDF, Word (.DOCX) et Google Drive sur toutes les formules (page tarifs officielle).
  - Gratuit : 1 CV, 3 téléchargements PDF. Les sources tierces parlent de DOCX illimités en gratuit ; la page officielle ne le confirme pas et parle de limites variables selon la formule.
  - Pro à 29 $/mois ; Lifetime à 149 $.
  - Aucune fonction « tenir sur 1 page » documentée.

### Enhancv
- **Fonctions.**
  - IA de personnalisation selon l'offre et score de correspondance.
  - Resume Checker avec **27 contrôles** (confirmé).
  - **15 modèles « ATS-tested »**. L'éditeur affirme qu'ils sont lus à plus de 90 % par Sovren et RChilli ; c'est une affirmation de l'éditeur.
  - Non confirmés sur les pages consultées : surlignage de chaque modification à accepter ou refuser, option « content visibility toggle ».
- **Export.** La page officielle annonce **PDF et TXT** (couche texte sélectionnable), **pas de DOCX**. La revue resumegenius (02/03/2026) dit « PDF only, no Word download ». Pas d'export Word dans les deux cas.
- **Limites.**
  - Essai limité à 15 entrées (aide officielle).
  - Selon resumegenius : essai de 7 jours, 2 CV maximum, marque Enhancv sur les téléchargements, payant à partir de 29 $/mois.
  - Aucun indicateur de débordement de page documenté.

### Kickresume
- **Targeted Resume (confirmé).**
  - On saisit l'intitulé, l'entreprise et l'offre, puis « Tailor Now » réécrit le résumé, la formation, les expériences et les compétences.
  - Trois indicateurs : compatibilité ATS, mots-clés, alignement avec l'offre.
  - Plus de 40 modèles, traduction dans plus de 8 langues.
  - Le chiffre de « 20 000 phrases toutes faites » n'est **pas confirmé**.
- **Export.** PDF et DOCX. La version gratuite ne permet pas de télécharger (stylingcv 2026, source tierce).

### Resume Worded
- **Targeted Resume (confirmé).** L'outil extrait les hard et soft skills et donne un « Relevancy Score ». En dessous de 80, le CV est jugé mal ciblé (page officielle).
- **Avertissement attribué à l'outil** (« les ATS varient ; une correspondance ne garantit pas un entretien ») : **non trouvé** sur la page consultée. L'idée reste juste, mais ne doit pas être citée comme venant de Resume Worded.

### Huntr : système de score le plus transparent
- **CV base et CV tailored (confirmé).**
  - Le CV « base » contient tout. Son score porte sur la complétude des sections, la qualité et la longueur du contenu.
  - Le CV « tailored » est créé par l'IA, qui « tire le contenu le plus pertinent de la base ». Son score porte sur les compétences, la pertinence de l'expérience et les mots-clés.
- **Job Match Score (LLM, confirmé).**
  - Qualifications : environ un tiers à la moitié du score ; les « Must-Have » pèsent le plus.
  - Missions : les missions principales comptent plus que les secondaires.
  - Mots-clés : généralement moins de 20 % ; les mots-clés Must-Have comptent plus, pour éviter l'accumulation.
  - Intitulé de poste : pris en compte, poids non précisé.
  - Correspondance **sémantique** : par exemple, « storytelling » est couvert si le CV décrit une présentation de récits à des parties prenantes.
  - Résultat en 5 niveaux : Poor, Weak, Fair, Good, Great.
  - Affichage « Covered / Not Covered » pour chaque critère.
- **Interface (page produit, confirmé).**
  - « Accept, tweak, or ignore » pour chaque suggestion, avec explication et aperçu en direct.
  - Versions illimitées, comparaison côte à côte.
  - Export PDF et DOCX ; CV rattaché à la candidature suivie.
  - 7 modèles ATS. L'onglet « Layout & Style » règle polices, espacements, marges et format des dates.
  - Huntr annonce « 2× more interviews » : chiffre de l'éditeur.

### FlowCV
- **Fonctions.** Éditeur avec aperçu en direct, sections réordonnables, plus de 50 modèles (la page d'accueil dit aussi « 100+ »). PDF illimité sans filigrane.
- **Export.** **Seul le PDF est confirmé**, par la page officielle et par resufit (06/2026). FlowCV permet d'*importer* un DOCX ; l'export DOCX n'est pas confirmé.
- **Formules (sources divergentes).**
  - Page tarifs officielle consultée : Gratuit (1 CV, 1 lettre) et Pro à 60 €/an (5 €/mois), avec CV illimités, suivi de candidatures et IA.
  - resufit (06/2026) mentionne en plus une formule Basic à 36 $/an (3 CV, suivi).
  - L'offre varie peut-être selon la région ou a changé.
- **Pas d'analyse d'offre**, quelle que soit la formule (resufit, 06/2026, confirmé).
- **Modèle de données, d'après le CLI non officiel `flowcvcli`.**
  - Dépôt d'origine : github.com/dannyota/flowcvcli, 6 étoiles, 27 commits. Le dépôt HauseMasterZ cité au départ n'en est qu'un fork (0 étoile).
  - Il utilise l'API interne non documentée de FlowCV et « may break if that changes ».
  - Chaque entrée a un ID et un état caché/visible (`hide` / `show-entry`).
  - L'ordre se gère pour les entrées (`reorder`) et pour les sections (`reorder-sections`).
  - Les réglages de style sont dans `resume.customization`.
- **Piège à noter (confirmé).** *« The on-screen preview is client-side HTML; the PDF download is a separate server render »* : l'aperçu et le PDF ne viennent pas du même moteur, d'où un risque d'écart.

### Novorésumé
- **Longueur.**
  - Gratuit : un seul CV d'une page.
  - Premium : plusieurs pages et contrôle de la mise en page.
  - Non confirmés : l'alerte de débordement, et l'idée que les profils seniors le vivent comme une interruption (non sourcée).
- **Fonctions.** Plusieurs versions enregistrables, export en PDF texte et en TXT (confirmé).
- **Vérificateur ATS (0 à 100), 5 dimensions (confirmé).** Correspondance avec l'offre, format/structure, qualité du contenu, organisation des sections, éléments techniques. L'outil prévient : *« A high score doesn't guarantee an interview »*.

### Outils français
- **CVDesignR.**
  - Création ou import (Word, PDF, Canva).
  - IA : reformuler, enrichir, mettre en valeur, personnaliser selon l'offre.
  - Scanner ATS, suivi de candidatures « Maestro », offres d'emploi.
  - Gratuit jusqu'à 8 CV.
  - Premium affiché à **9,99 €/mois**, avec la mention « prix prototype » sur la page : à revérifier.
  - Export PDF confirmé.
  - Non vérifiés : la connexion avec le compte France Travail et le lien partageable.
- **France Travail, « Profil de compétences » (confirmé).**
  - L'outil génère un CV avec tous les éléments du profil.
  - On peut ajouter un titre et une accroche, et choisir les données les plus pertinentes.
  - Les éléments marqués « Élément privé (non visible par les recruteurs) » sont exclus.
  - Le CV est stocké dans le profil.
- **Autres** (comparatif modeles-de-cv.com, 2026, non revérifié) :
  - modeles-de-cv.com : plus de 200 modèles Word, vérificateur ATS en français ;
  - CVcrea, Europass, DoYouBuzz, HelloCV.
- **ATS rencontrés en France (cvpass.co).**
  - Grands comptes : Workday (dominant au CAC 40 et au-delà de 10 000 salariés), Taleo, SuccessFactors.
  - PME/ETI : Flatchr, Taleez, Beetween, Recruitee, SmartRecruiters, Lever, Greenhouse, Teamtailor.
  - SmartRecruiters : rachat annoncé par SAP le 01/08/2025 et **finalisé le 11/09/2025**.
  - Part de Workday au CAC 40 : cvpass.fr dit « 60 % » sans source ; les autres chiffres circulants se contredisent. **Non vérifiable.**
  - cvpass.co conseille le DOCX pour Taleo et SuccessFactors, et le PDF texte pour les ATS récents (Workday, SmartRecruiters, Greenhouse, Lever). L'ATS se repère à l'URL (myworkdayjobs.com, boards.greenhouse.io).

### Canva : le contre-exemple
- **Ce que font la plupart de ses modèles.** Zones de texte, plusieurs colonnes, barres latérales, icônes pour le contact, barres de niveau, frises graphiques.
- **Pourquoi ça casse :**
  - l'ordre de lecture est perdu ;
  - les informations portées par des graphismes disparaissent ;
  - les en-têtes et pieds de page sont souvent ignorés.
- **Recommandation (Indeed Flex, confirmé).** Garder « a Canva version for networking and an ATS-optimized version for applications ».
- **Test simple (conseil courant, non attribué).** Copier tout le PDF dans un éditeur de texte brut.
- Les chiffres « 72 % des modèles Canva échouent » et « 78,4 % sur Workday » sont **non vérifiables : à ne pas citer**.

### Reactive Resume (open source, activement maintenu)
- **Maintenance.** v6.0.0 publiée le 04/10/2026 : refonte, nouveau moteur PDF « Forme », éditeur en 3 modes Write / Design / Check, suivi de candidatures. Versions 5.x en août et septembre 2026 ; vérificateur ATS gratuit dans le navigateur depuis la v5.2.9.
- **« Fit to one page » (doc, confirmé).** Réduit dans l'ordre :
  1. la densité (Roomy → Normal → Compact) ;
  2. les marges (Wide → Normal → Narrow) ;
  3. la taille du texte, d'un demi-point à la fois, jamais sous 9 pt.
- **Messages.** « Runs onto page 2 by about 6 lines », puis « Still 2 pages at 9 pt. Hide a section or shorten entries. »
- **Format « Free-form ».** Pages de hauteur libre, pour une lecture à l'écran.
- L'alerte « sous un interligne de 1,15 » n'est **pas confirmée**.
- **Export.** PDF, Word, Markdown et JSON (doc v6). Le mode « Check » signale les problèmes ligne par ligne et compare le CV à une offre.
- **Prudence.** La v6 vient de sortir ; le comportement peut encore changer.

---

## 2. Thèmes transverses

### 2.1 Comment le score est calculé, et ses limites

| Outil | Méthode | Seuil | Particularités |
|---|---|---|---|
| Jobscan | Recoupement pondéré : compétences techniques > études > intitulé > soft skills > autres ; la fréquence compte | 75 % | Exclude skills ; predicted skills hors score ; ATS Tip |
| Teal | % des termes clés de l'offre présents dans le CV | 80 % | Mis à jour en direct ; vue côte à côte ; top 5 en gratuit |
| Rezi | Score de qualité (5 catégories) + ciblage des mots-clés | 90 (prêt) | Puce suggérée placée sous le poste le plus pertinent |
| Huntr | LLM sémantique : qualifications (≈1/3 à 1/2), missions, mots-clés (<20 %), intitulé | Good/Great | Couvert / non couvert pour chaque critère, avec explication |
| Resume Worded | Relevancy score | 80 | Hard et soft skills |
| Kickresume | 3 indicateurs : ATS, mots-clés, alignement | n.c. | Réécriture complète |
| Novorésumé | 0 à 100, 5 dimensions | n.c. | Avertissement honnête sur les limites |

**Limites constatées :**
- **Correspondance trop littérale** chez les outils par recoupement : « project management » ≠ « program delivery ». Le support Jobscan le reconnaît.
- **Pousse à accumuler les mots-clés.** Huntr pondère volontairement les mots-clés à moins de 20 % pour l'éviter.
- **Les offres contiennent souvent des listes de souhaits**, que l'outil traite comme des exigences.
- **Aucun outil externe ne reproduit la configuration d'un employeur.**

**Ce que font les vrais ATS en 2026 :**
- **Greenhouse Talent Matching** (module Real Talent, lancé en 02/2026 selon Jobscan) :
  - critères définis par l'équipe de recrutement ;
  - catégories Strong / Good / Partial / Limited / Needs manual review ;
  - « multiple terms can map to the same calibrated skill » ;
  - **aucun rejet automatique** : « does not automatically disposition any candidates ».
- **Workday HiredScore** (rachat annoncé en 02/2024) : Workday décrit un « AI-driven candidate grading ». La notation de A à D, la déduction de compétences et l'évaluation de chaque qualification par LLM ne sont **pas confirmées** par la page officielle consultée.
- **Étude Enhancv** (25 recruteurs américains, 09–10/2025, éditeur intéressé) :
  - 92 % des **recruteurs interrogés** (23/25) disent que leur ATS ne rejette pas automatiquement sur la forme, le contenu ou le design ;
  - 100 % utilisent des questions éliminatoires (autorisation de travail, certifications, lieu) ;
  - 44 % ont un système avec score de correspondance par IA ;
  - 8 % activent un rejet automatique sur le contenu (seuil de correspondance ou compétences obligatoires).

**Conclusion pour le projet.** Viser d'abord une **lecture correcte par l'ATS** (structure), puis une **couverture lisible des exigences de l'offre**. Ne pas chercher un pourcentage « magique ». Afficher la formule du score.

### 2.2 Granularité de la sélection
- **Teal** : puce, expérience et compétence, synchronisées ou non entre versions.
- **FlowCV** (CLI non officiel) et **Reactive Resume** : entrée et section, caché/visible.
- **France Travail** : sélection des éléments du profil, plus un indicateur « privé ».
- **Huntr, Kickresume, Enhancv** : sélection ou réécriture par l'IA. Huntr la fait valider (accepter / modifier / ignorer).
- **À retenir :** une sélection automatique ne doit être qu'une **suggestion non destructive** (critique de l'Auto-Select de Teal).

### 2.3 Réordonnancement
- Sections réordonnables : FlowCV, Kickresume, CVDesignR, Enhancv. Les sources consultées ne le confirment pas en détail pour chacun.
- Ordre des entrées dans une section : FlowCV (`reorder`, via le CLI non officiel).
- Teal et Huntr : glisser-déposer non documenté dans les sources consultées.

### 2.4 Mots-clés manquants
Quatre façons de faire :
1. **Liste** couvert / manquant (Jobscan, Teal, Resume Worded) ;
2. **Puce générée** et placée sous le bon poste (Rezi) ;
3. **Suggestion avec justification**, à valider ou ignorer (Huntr) ;
4. **Exclusion manuelle** d'un mot non pertinent (Jobscan).

### 2.5 Longueur et aperçu
- Limite de pages selon la formule : Novorésumé (1 page en gratuit).
- Ajustement automatique : Reactive Resume (densité → marges → police, 9 pt minimum).
- Réglages manuels d'espacement : Teal (payant), Huntr (polices, espacements, marges).
- Règles de longueur : Rezi (400 à 1 600 mots ; 8,5 à 11 pt).
- Aperçu en direct, en écran partagé, chez la plupart des outils.
- **Risque technique :** si l'aperçu et le PDF ne viennent pas du même moteur (cas de FlowCV), le CV peut tenir sur 1 page à l'écran et 2 dans le PDF.

### 2.6 Modèles « ATS-friendly » (consensus 2026)
- **Mise en page.** Une colonne. Pas de tableau, de zone de texte, d'icône ni de barre de niveau. Coordonnées dans le corps du document, pas dans l'en-tête ou le pied de page.
- **Typographie.** Police standard de 10 à 12 pt (Arial, Calibri…). Rezi accepte de 8,5 à 11 pt.
- **Titres de sections standard**, en français : « Expérience professionnelle », « Formation », « Compétences », « Langues ».
- **Contenu.** Dates cohérentes. Intitulé du poste repris tel quel dans l'offre. Ordre antéchronologique.
- **Spécificités françaises :**
  - photo facultative, aucun effet sur l'ATS ;
  - accents à garder : cvpass.fr affirme que les bons ATS les normalisent (« stratégie = strategie ») et conseille l'orthographe correcte ; affirmation non vérifiée de façon indépendante ;
  - prétentions salariales hors du CV ;
  - ville et code postal suffisent ;
  - 1 page sous 5 ans d'expérience, 2 au maximum au-delà.

### 2.7 Export

| Outil | Formats |
|---|---|
| Teal | PDF uniquement |
| Rezi | PDF, DOCX, Google Drive (gratuit : 3 PDF) |
| Enhancv | PDF + TXT (officiel) ; aucun DOCX |
| Kickresume | PDF, DOCX (payant) |
| FlowCV | PDF (DOCX non confirmé) |
| Huntr | PDF, DOCX |
| Novorésumé | PDF texte, TXT |
| CVDesignR | PDF (lien partageable non vérifié) |
| Reactive Resume | PDF, Word, Markdown, JSON (v6) |

Rezi recommande un nom de fichier professionnel.

### 2.8 Historique des candidatures
- Teal : étapes, versions de CV rattachées, notes, contacts.
- Huntr : CV rattaché à chaque candidature, versions illimitées.
- Jobscan : score affiché pour chaque offre suivie (non revérifié).
- CVDesignR : Maestro.
- FlowCV : suivi en formule payante (Pro sur la page officielle, Basic selon resufit).
- Reactive Resume v6 : suivi de candidatures intégré.

---

## 3. Principes UX à reprendre pour l'interface à cases à cocher

1. **Arbre de cases à 3 niveaux** : section > élément (poste, diplôme, projet) > puce.
   - Une case peut être cochée, décochée ou partielle (quand seule une partie des puces est cochée).
   - Décocher masque l'élément, sans jamais le supprimer (comme Teal).
2. **Variantes d'une même puce** : plusieurs formulations d'une réalisation (courte/longue, technique/management). Un seul choix par puce et par preset.
   - Une modification de la base se propage partout, sauf aux candidatures déjà figées, qui reçoivent un indicateur « mise à jour disponible » (inspiré de Teal).
3. **Presets nommés par type de poste** (ex. « Data analyst », « Chef de projet ») :
   - contenu : sélection + ordre + intitulé + accroche + modèle ;
   - duplicables.
   - Chaque génération pour une candidature crée une **copie figée** (JSON + PDF) rattachée à l'offre.
4. **Mots-clés de l'offre affichés dans la base, pas seulement dans l'aperçu** :
   - sur chaque puce, un badge « couvre 3 mots-clés » ;
   - un tri des puces par pertinence ;
   - un bouton « cocher la sélection suggérée », réversible et visible sous forme de différences.
5. **Panneau mots-clés** :
   - pastilles couvert / manquant, avec catégorie (technique, soft, intitulé, diplôme) et nombre d'occurrences dans l'offre ;
   - boutons « ignorer » (comme Jobscan) et « ajouter aux compétences » ;
   - un dictionnaire personnel de synonymes et acronymes (« SQL Server » ↔ « MSSQL »), pour éviter le défaut de correspondance littérale reconnu par Jobscan ;
   - un conseil : écrire la forme longue puis l'acronyme.
6. **Score transparent** :
   - formule affichée, détail par catégorie ;
   - poids élevé pour les compétences techniques et l'intitulé ;
   - poids limité pour les mots-clés bruts, comme Huntr (moins de 20 %) ;
   - libellé du type « couverture des exigences » plutôt que « chance de passer l'ATS ».
7. **Jauge de page en temps réel** :
   - « 1,15 page » avec une barre de remplissage, avertissement dès que ça déborde ;
   - un bouton « ajuster à 1 page » qui réduit dans l'ordre l'interligne, puis les marges, puis la police. Le minimum reste à 10 pt, choix plus prudent que les 9 pt de Reactive Resume, en accord avec le consensus 10–12 pt ;
   - sinon, proposer de décocher les puces les moins pertinentes ;
   - l'aperçu et le PDF doivent venir du **même moteur de rendu**.
8. **Vérification ATS automatique** :
   - titres de sections standard, format de dates unique, contact hors en-tête, une colonne ;
   - puces de 100 à 150 caractères (repère Teal non vérifié sur la source), 3 à 6 puces par poste (Rezi), chiffres dans au moins la moitié des puces ;
   - pas de pronoms ni de formules creuses ;
   - nom de fichier « Prenom-Nom-CV-Poste.pdf ».
9. **Vue « texte brut / ce que voit l'ATS »** : le texte extrait du PDF généré, pour faire en un clic le test du copier-coller.
10. **Export** : PDF texte + DOCX (+ TXT), même contenu, une seule colonne.

---

## 4. Priorisation des fonctionnalités

### MVP
1. Base de contenu structurée (JSON/YAML) : expériences, puces, compétences, formations, projets, langues, certifications, centres d'intérêt, coordonnées.
2. Cases à cocher à 3 niveaux, avec état partiel.
3. Réordonnancement par glisser-déposer des sections et des éléments, avec un repli au clavier (boutons ↑/↓).
4. Aperçu en direct avec un modèle unique ATS : une colonne, titres français standard.
5. Jauge de pages en temps réel et alerte de débordement.
6. Export PDF texte, produit par le même moteur que l'aperçu.
7. Presets nommés (enregistrer, dupliquer, charger).
8. Collage d'une offre : extraction simple des mots-clés, surlignage dans la base et dans l'aperçu, liste couvert/manquant.
9. Vérification ATS de base (titres, dates, contact, longueur des puces).

### V2
1. Score transparent pondéré (technique > intitulé > diplôme > soft skills), avec « ignorer un mot-clé » et dictionnaire de synonymes/acronymes.
2. Pertinence de chaque puce (badge + tri) et suggestion de cochage réversible.
3. Variantes de puces, avec propagation des modifications et indicateur « mise à jour disponible ».
4. Historique des candidatures : copie figée du CV, offre, entreprise, date, statut (envoyé → entretien → refus/offre).
5. Export DOCX + TXT ; vue texte brut ; bouton « ajuster à 1 page ».
6. Vérifications avancées (chiffres, verbes d'action, pronoms, formules creuses, nom de fichier).

### Bonus (« nice to have »)
1. Suggestions par LLM : reformuler une puce avec un mot-clé manquant, avec justification et validation explicite (jamais d'invention de compétence).
2. Matching sémantique par embeddings, en plus des mots-clés (direction prise par Huntr, Greenhouse et HiredScore).
3. Import d'un CV existant (PDF/DOCX) ou d'un profil LinkedIn.
4. Version bilingue FR/EN liée à la même base.
5. Plusieurs modèles, dont un « design » pour le réseau, signalé comme non ATS.
6. Lettre de motivation générée à partir de la même sélection.
7. Extension de navigateur pour capturer une offre.
8. Détection de l'ATS d'après l'URL de l'offre (myworkdayjobs.com, boards.greenhouse.io, flatchr.io…) avec conseils de format (DOCX pour Taleo/SuccessFactors, selon cvpass.co).

---

## 5. À traiter avec prudence ou considérer comme obsolète
- **« 75 % des CV rejetés par les ATS »** : mythe (Preptel, 2012, entreprise fermée en 2013, aucune méthodologie).
- **« Greenhouse ne reconnaît pas les abréviations » / « Taleo ne reconnaît que les mots exacts »** : la première affirmation est contredite par la FAQ Greenhouse ; la seconde n'est pas vérifiée.
- **Taux d'échec des CV Canva (72 %, 78,4 %)** et **part de Workday au CAC 40 (30 % ou 60 %)** : non vérifiables.
- **Chiffres d'efficacité des éditeurs** (Jobscan « 3.5x » et « 3x », Huntr « 2× », CVDesignR « 4x ») : marketing sans méthodologie publiée.
- **Teal Resume Syncing** : fonction de 2023 confirmée, mais les pages d'aide n'ont pas pu être ouvertes (403). « Update Available » et le Resume Analyzer ne sont pas vérifiés sur la source.
- **Prix** : ils changent souvent (Teal+ hebdo passé de 9 $ à 13 $ ; FlowCV Basic présent chez resufit, absent de la page officielle consultée ; CVDesignR « prix prototype »).
- **Export Enhancv** : la contradiction est levée, aucun DOCX (PDF + TXT selon le site officiel).
- **Export FlowCV en DOCX** : non confirmé, à ne pas retenir.
- **Biais des sources** : beaucoup de revues sont écrites par des concurrents (Enhancv sur Teal, Rezi sur Teal et Enhancv, Jobscan sur Teal et Greenhouse, resufit, JobShinobi) ou par des éditeurs d'ATS (Taleez).
- **Dépôts GitHub** : `flowcvcli` est non officiel, peu suivi (6 étoiles) et dépend d'une API interne ; à ne pas utiliser comme référence stable. Reactive Resume est activement maintenu (v6 du 04/10/2026).

---

## Sources
- https://www.jobscan.co/jobscan-tutorial
- https://www.jobscan.co/resume-scanner
- https://www.jobscan.co/blog/jobscan-vs-teal/
- https://www.jobscan.co/blog/greenhouse-ats-what-job-seekers-need-to-know/
- https://www.jobshinobi.com/blog/jobscan-resume-scanner-limitations
- https://www.rezi.ai/rezi-docs/ai-keyword-targeting-explained
- https://www.rezi.ai/rezi-docs/the-rezi-score-explained
- https://www.rezi.ai/pricing
- https://www.rezi.ai/posts/teal-review
- https://www.rezi.ai/posts/rezi-vs-enhancv
- https://help.tealhq.com/en/collections/9568976-resume-builder (403)
- https://help.tealhq.com/en/articles/12062117-using-auto-select (403)
- https://help.tealhq.com/en/articles/9519151-export-your-resume-cover-letter (403)
- https://www.tealhq.com/tool/resume-job-description-match (403)
- https://www.linkedin.com/pulse/one-edit-multiple-resumes-learn-how-tealhq
- https://resumegenius.com/reviews/teal-resume-builder-reviews
- https://www.usesprout.com/blog/teal-review-pricing-alternatives
- https://www.wobo.ai/blog/teal-review/
- https://enhancv.com/ai-resume-builder/
- https://resumegenius.com/reviews/enhancv-reviews
- https://help.enhancv.com/en/articles/2808841-entries-on-your-resume-what-are-they
- https://enhancv.com/blog/does-ats-reject-resumes/
- https://www.kickresume.com/en/targeted-resume/
- https://stylingcv.com/blog/kickresume-review-2026-features-pricing-pros-cons-worth-it/
- https://resumeworded.com/targeted-resume
- https://huntr.co/product/resume-tailor
- https://help.huntr.co/en/articles/12241684-job-match-score
- https://help.huntr.co/en/articles/12824077-understanding-huntr-s-resume-builder
- https://flowcv.com/ et https://flowcv.com/pricing
- https://resufit.com/blog/flowcv-review-free-resume-builder-worth-trying/
- https://github.com/dannyota/flowcvcli (dépôt d'origine ; fork : https://github.com/HauseMasterZ/flowcvcli)
- https://novoresume.com/career-blog/novoresume-vs-other-resume-builders
- https://novoresume.com/tools/ats-resume-checker
- https://cvdesignr.com/fr et https://cvdesignr.com/fr/premium
- https://trajectio.fr/cv-designr-avis-fonctionnalites/
- https://www.francetravail.fr/candidat/vos-services-en-ligne/creez-un-cv-a-partir-de-votre-pr.html
- https://cvpass.fr/en/blog/optimiser-cv-ats-france
- https://cvpass.co/blog/liste-ats-france
- https://news.sap.com/2025/08/sap-to-acquire-smartrecruiters/
- https://www.smartrecruiters.com/news/
- https://www.workday.com/en-us/products/talent-management/ai-recruiting.html
- https://en.wikipedia.org/wiki/Workday,_Inc.
- https://indeedflex.com/career-hub/guides/canva-resume-builder-ats
- https://docs.rxresu.me/guides/fitting-content-on-a-page
- https://docs.rxresu.me/
- https://github.com/AmruthPillai/Reactive-Resume/releases
- https://support.greenhouse.io/hc/en-us/articles/41131886674075-Talent-Matching-FAQ
- https://jobcannon.io/research/stats/ats-myth-preptel
- Non revérifiés lors de ce contrôle : modeles-de-cv.com (comparatifs), cvcrea.fr, taleez.com, loopcv.pro, page Canva, pitchmeai.com, anygen.io, sureshortlist.com, prescreener.ai.

---

## Vérification

| # | Affirmation contrôlée | Verdict | Source |
|---|---|---|---|
| 1 | « 75 % des CV rejetés » vient d'un argument commercial de Preptel (2012), sans méthodologie | **Confirmé** (Preptel fermée en 2013) | jobcannon.io/research/stats/ats-myth-preptel |
| 2 | Greenhouse Talent Matching : catégories Strong/Good/Partial/Limited/Needs manual review, plusieurs termes pour une compétence, aucun rejet automatique | **Confirmé** | support.greenhouse.io (Talent Matching FAQ) ; jobscan.co (article Greenhouse, 24/09/2026) |
| 3 | Jobscan : ordre de pondération, fréquence, seuil 75 %, « 3.5 times », nombre de mots et résultats chiffrés hors score, exclude/predicted skills | **Confirmé** (le « 3.5x » est un chiffre de l'éditeur) | jobscan.co/jobscan-tutorial |
| 4 | Jobscan : plus de 30 contrôles, ATS Tip | **Confirmé** | jobscan.co/resume-scanner |
| 5 | Jobscan : 49,95 $/mois, 89,95 $/trimestre, 5 scans gratuits par mois | **Nuancé** : prix confirmés ; Jobscan dit « a few scans », le chiffre 5 n'est pas confirmé | jobscan.co/blog/jobscan-vs-teal |
| 6 | Teal+ : 13 $/sem, 29 $/mois, 79 $/trim. | **Confirmé** (03/2026 et 07/2026), **nuancé** : 9 $/sem selon resumegenius 01/2026 | jobscan.co/blog/jobscan-vs-teal ; wobo.ai ; resumegenius.com |
| 7 | Teal : seuil 80 %, top 5 mots-clés en gratuit, critique de l'Auto-Select | **Confirmé** | jobscan.co (03/2026) ; wobo.ai (07/2026) |
| 8 | Teal Resume Syncing annoncé le 02/08/2023, case « Save to All Resumes » | **Confirmé** (« Update Available » non vérifié) | linkedin.com/pulse/one-edit-multiple-resumes-learn-how-tealhq |
| 9 | Teal : export PDF uniquement | **Confirmé** (revue tierce ; FAQ en 403) | resumegenius.com (30/01/2026) |
| 10 | Teal Resume Analyzer (100–150 caractères, 15–20 puces) | **Non vérifiable** (pages 403) | help.tealhq.com |
| 11 | Huntr : pondération par LLM, qualifications 1/3 à 1/2, mots-clés < 20 %, 5 niveaux, Covered/Not Covered | **Confirmé**, plus correspondance sémantique explicite ; poids de l'intitulé non précisé | help.huntr.co (Job Match Score) |
| 12 | Huntr : CV base/tailored, export PDF+DOCX, accepter/ignorer avec explication, comparaison côte à côte | **Confirmé** | huntr.co/product/resume-tailor ; help.huntr.co (resume builder) |
| 13 | Rezi Score : 5 catégories, seuils, 3–6 puces, 8,5–11 pt, 400–1 600 mots | **Confirmé** | rezi.ai/rezi-docs/the-rezi-score-explained |
| 14 | Rezi : puce placée sous le poste le plus pertinent ; « 10 catégories » absentes | **Confirmé** | rezi.ai/rezi-docs/ai-keyword-targeting-explained |
| 15 | Rezi : gratuit 3 PDF à vie, DOCX illimités | **Nuancé** : 3 PDF confirmés ; DOCX illimités non confirmés (exports PDF/DOCX/Google Drive) | rezi.ai/pricing |
| 16 | Enhancv : export PDF, DOCX et TXT selon la page officielle | **Réfuté** : la page officielle dit PDF et TXT ; resumegenius dit PDF seul, sans Word | enhancv.com/ai-resume-builder ; resumegenius.com/reviews/enhancv-reviews |
| 17 | Enhancv : 27 contrôles, 15 modèles ATS-tested, essai à 15 entrées | **Confirmé** | enhancv.com/ai-resume-builder ; help.enhancv.com |
| 18 | Enhancv : surlignage accepter/refuser, « content visibility toggle » | **Non vérifiable** (absent des pages consultées) | enhancv.com ; help.enhancv.com |
| 19 | Étude Enhancv : 92 % des ATS ne rejettent pas, 8 % filtre strict | **Nuancé** : 92 % des *recruteurs* (23/25) ; 8 % activent un rejet automatique sur le contenu | enhancv.com/blog/does-ats-reject-resumes |
| 20 | Kickresume : Targeted Resume, 3 indicateurs, 40+ modèles, PDF/DOCX, pas de PDF en gratuit | **Confirmé** | kickresume.com/en/targeted-resume ; stylingcv.com |
| 21 | Kickresume : 20 000 phrases toutes faites | **Non vérifiable** | stylingcv.com (aucune mention) |
| 22 | Resume Worded : seuil 80 | **Confirmé** | resumeworded.com/targeted-resume |
| 23 | Resume Worded : avertissement « les ATS varient, pas de garantie » | **Non vérifiable** (absent de la page) | resumeworded.com/targeted-resume |
| 24 | FlowCV : export PDF et DOCX | **Réfuté / non confirmé** : seul le PDF est documenté ; DOCX seulement en import | flowcv.com ; resufit.com |
| 25 | FlowCV : Basic 36 $/an (3 CV, suivi), Pro 60 $/an | **Nuancé** : la page officielle montre Gratuit + Pro 60 €/an (suivi dans Pro) ; Basic seulement chez resufit (06/2026) | flowcv.com/pricing ; resufit.com |
| 26 | FlowCV : pas d'analyse d'offre | **Confirmé** | resufit.com (06/2026) |
| 27 | Dépôt `HauseMasterZ/flowcvcli` : commandes hide/show-entry/reorder, PDF rendu séparément | **Nuancé** : contenu confirmé, mais c'est un fork (0 étoile) de `dannyota/flowcvcli` (6 étoiles, 27 commits), non officiel, API non documentée | github.com/dannyota/flowcvcli ; github.com/HauseMasterZ/flowcvcli |
| 28 | Reactive Resume : « Fit to one page » densité → marges → police, 9 pt minimum, Free-form | **Confirmé** | docs.rxresu.me/guides/fitting-content-on-a-page |
| 29 | Reactive Resume : alerte sous un interligne de 1,15 | **Non vérifiable** | docs.rxresu.me |
| 30 | Reactive Resume : export PDF, Word, Markdown, JSON ; mode Check ; projet maintenu | **Confirmé** (v6.0.0 du 04/10/2026) | docs.rxresu.me ; github.com/AmruthPillai/Reactive-Resume/releases |
| 31 | Novorésumé : 2e page payante, alerte de débordement | **Nuancé** : gratuit limité à 1 page et plusieurs pages en Premium, confirmés ; alerte non confirmée | novoresume.com/career-blog/novoresume-vs-other-resume-builders |
| 32 | Novorésumé : checker 0–100, 5 dimensions, « A high score doesn't guarantee an interview » ; export PDF + TXT | **Confirmé** | novoresume.com/tools/ats-resume-checker ; novoresume.com (comparatif) |
| 33 | CVDesignR : Premium 9,99 €/mois | **Nuancé** : affiché, mais signalé comme « prix prototype » ; gratuit jusqu'à 8 CV | cvdesignr.com/fr/premium |
| 34 | CVDesignR : connexion France Travail, lien partageable | **Non vérifiable** | cvdesignr.com ; trajectio.fr |
| 35 | France Travail : CV générés depuis le Profil de compétences, éléments privés exclus | **Confirmé** | francetravail.fr |
| 36 | SmartRecruiters racheté par SAP en 09/2025 | **Confirmé** (annoncé le 01/08/2025, finalisé le 11/09/2025) | news.sap.com ; smartrecruiters.com/news |
| 37 | Workday HiredScore racheté en 03/2024, notation A–D, LLM par qualification | **Nuancé** : rachat annoncé en 02/2024 ; « AI-driven candidate grading » confirmé, échelle A–D et LLM non confirmés | Wikipedia (Workday) ; workday.com (AI recruiting) |
| 38 | Workday à 60 % du CAC 40 | **Non vérifiable** (affirmation de cvpass.fr sans source) | cvpass.fr |
| 39 | cvpass.co : DOCX pour Taleo/SuccessFactors, PDF pour les ATS récents | **Confirmé** (conseil d'un éditeur, pas une norme) | cvpass.co/blog/liste-ats-france |
| 40 | Indeed Flex : un CV Canva pour le réseau, un CV ATS pour les candidatures | **Confirmé** (date 04/2026 non vérifiée) | indeedflex.com |
| 41 | JobShinobi : « project management » vs « program delivery » | **Confirmé**, et appuyé par le support Jobscan | jobshinobi.com |