# Prompt d'initialisation (lot 0)

À coller dans une **nouvelle session Claude Code** ouverte dans le dossier du projet.

---

```text
Tu initialises le projet décrit dans CAHIER_DES_CHARGES.md (v1.1) : un générateur de CV local, à cases à cocher, lisible par les ATS, avec un serveur MCP pour Claude.

PÉRIMÈTRE : uniquement le LOT 0 « Initialisation » du §13. Aucun autre lot. Arrête-toi quand les critères de fin ci-dessous sont remplis, puis fais-moi un rapport.

ÉTAPE 1 — LIRE ET PLANIFIER
- Lis CAHIER_DES_CHARGES.md EN ENTIER (par pages). Il fait foi. Les rapports de docs/recherche/ servent de référence si un point n'est pas clair.
- Concentre-toi sur : §4 (règles ATS), §7.1, §7.2 (MCP-01, 02, 03, 19, 20), §7.5, §7.6, §8 (stack, arborescence, stockage, pipeline et réglages Typst), §9 (schéma complet), §11, §12 (tests et critères), §13 (lot 0) et les annexes A à E.
- Établis une liste de tâches ordonnée PAR RISQUE : d'abord la chaîne PDF (Typst, mesure, ATS-check, test:ats), puis le reste. Montre-moi ce plan avant de coder.

ÉTAPE 2 — VERSIONS
- Pour chaque paquet de l'annexe E, vérifie avec `npm view <paquet> version` (et `engines` si utile). Fige des versions EXACTES. Règles :
  - TypeScript ~6.0.x, pas la 7 ;
  - @myriaddreamin/typst-ts-node-compiler 0.7.0, qui embarque Typst 0.14.2 ;
  - SDK MCP v2 : @modelcontextprotocol/server et @modelcontextprotocol/client ;
  - Zod 4 ;
  - --legacy-peer-deps est interdit.
- Consigne les versions et les écarts avec l'annexe E dans docs/decisions/0001-versions.md (ADR). Un ADR par choix structurant (ex. 0002-rendu-typst-node.md).
- Vérifie tout point marqué [à vérifier à l'init] et note le résultat dans un ADR. Si un point invalide le cahier, propose une correction du cahier au lieu de dévier en silence.

ÉTAPE 3 — RÉALISER LE LOT 0 (§13)
- git init. Le PREMIER commit contient .gitignore (data/, import/, out/, node_modules/, .env) et le hook guard-commit (NF-03). Ensuite, un commit par étape cohérente.
- Monorepo en npm workspaces, comme au §8.2 : packages/core, render, store ; apps/server, web, mcp ; fixtures/ ; scripts/. Fichiers .npmrc (engine-strict), .nvmrc (24), .gitattributes, .env.example.
- packages/core :
  - schéma Zod v1 COMPLET du §9, suivi des candidatures compris ;
  - sanitize, canon, normalizeForMatch (annexe B) ;
  - select() et project() (§8.5) ;
  - tests unitaires du §12.1 pour ce qui existe à ce stade.
- fixtures/ (annexe D) : personas fictives courte, debordante et pieges (FR + EN), et les 3 offres fictives. AUCUNE donnée réelle.
- packages/render :
  - gabarit Typst ats-classique avec TOUS les réglages obligatoires du §8.5 : fallback: false, smartquote désactivé, ligatures: false, hyphenate: false, blocs box, aucun texte en dur, date: none ;
  - police Carlito : TTF statiques Regular, Bold, Italic et BoldItalic, téléchargées depuis le dépôt officiel googlefonts/carlito, avec le fichier OFL ;
  - compilation par NodeCompiler, mesure <cv-end> et hauteur auto, DOCX minimal (F-EXP-02) ;
  - ATS-check : pdf.js avec disableNormalization: true, pdf-lib, pdftotext si disponible, avec les critères T-ATS du §12.3 applicables au lot 0, et T-DOCX-01/02.
- scripts/check-ats.ts et `npm run test:ats` (§12.2). Si pdftotext (Poppler) est absent, NE L'INSTALLE PAS : donne-moi la commande ou la procédure d'installation, et continue avec ATS_SINGLE_EXTRACTOR=1 en attendant.
- packages/store : lecture et écriture atomiques avec réessais Windows, verrou, revision, ids.json (§8.4). Le watch peut attendre le lot 1.
- apps/server (Hono) :
  - écoute sur 127.0.0.1 ; sécurité NF-01 complète (Host, Origin, X-CV-Token, JSON obligatoire) ;
  - endpoints : health, lecture de la bibliothèque, render (PDF + rapport ATS) ;
  - tests 403 du §12.4.
- apps/web (React + Vite + Tailwind) : arbre de la bibliothèque de la fixture, en lecture seule, et aperçu du PDF compilé avec pdfjs-dist. Proxy Vite sur /api.
- apps/mcp (SDK v2, stdio) :
  - outils MCP-01, 02, 03, 19 et 20 avec outputSchema et annotations (§7.2), et les instructions du serveur ;
  - résolution de la racine du §7.6 (jamais process.cwd()) ;
  - stdout réservé au protocole : ESLint no-console, journaux sur stderr ;
  - test en sous-processus (chaque ligne de stdout est du JSON-RPC valide) et test avec un client en mémoire ;
  - build lancé par postinstall et predev.
- scripts/data-init : crée un data/ vide et valide. Ne mets jamais de données réelles dans data/.
- .mcp.json (§7.6) et .claude/settings.json avec les règles deny sur data/** et import/**.
- README.md en français :
  - installation et lancement ;
  - configuration MCP pour Claude Code ET pour Claude Desktop (ce poste a l'installation MSIX ; chemins exacts au §7.6) ;
  - où déposer mon CV actuel et mon export LinkedIn (import/) ;
  - confidentialité (§7.5) ;
  - contrôles manuels (§12.5).
- CLAUDE.md :
  - commandes ;
  - conventions (identifiants et commentaires du code en anglais, interface et docs en français) ;
  - règles ATS non négociables (rappel des réglages Typst et de l'interdiction de html2pdf) ;
  - règle « données réelles uniquement via les outils mcp__cv__*, développement sur fixtures/ » ;
  - aucun code copié depuis un projet AGPL, PolyForm, GPL ou sans licence.

CONTRAINTES
- Windows 11, PowerShell. Le chemin du projet CONTIENT UNE ESPACE : cite-le correctement partout (scripts, .mcp.json, README).
- N'installe aucun logiciel système et ne modifie aucune configuration globale (Claude Desktop, PATH…) sans mon accord : documente-les dans le README.
- Ne pousse rien sur un dépôt distant.
- En cas de doute sur une règle, le cahier des charges l'emporte. S'il est muet, choisis l'option la plus simple qui respecte les règles ATS, et note-la dans un ADR.

CRITÈRES DE FIN (lot 0, §13) — exécute-les et montre-moi les sorties réelles
1. `npm test` passe.
2. `npm run test:ats` passe au vert pour courte et pieges, et ATTEND le refus de l'export pour debordante (critère Pages au rouge, dépassement chiffré). Indique si les deux extracteurs ont tourné, ou un seul.
3. `npm run dev` démarre. L'interface affiche l'arbre et l'aperçu PDF de la fixture courte. Une requête sans jeton reçoit 403.
4. Le serveur MCP démarre depuis un cwd quelconque. Avec le client en mémoire : get_overview, get_library (vue index), render (PDF de la fixture) puis check_ats renvoient des résultats conformes. Aucun e-mail ni téléphone dans les réponses.
5. Ouvre le PDF généré pour la fixture courte et colle-moi l'extraction texte brute (pdf.js), pour vérification à l'œil.

RAPPORT FINAL (en français, court) :
- ce qui est fait, et les critères avec leur résultat réel ;
- les écarts avec le cahier et les ADR créés ;
- les points [à vérifier] tranchés ;
- ce que je dois faire à la main (Poppler, configuration de Claude Desktop) ;
- le prompt suggéré pour lancer le lot 1.
```
