// MCP server "cv" (§7): the lot 0 tools MCP-01, 02, 03, 19 and 20 here; the read, application and
// proposal tools of lot 5 and the prompt adapter-a-une-offre in their own modules. Reads data/ through
// packages/store, renders through packages/render. No tool deletes anything: render and check_ats add
// timestamped files in out/ (and, on request, an export in the application), the other writes are
// additions (application, analysis, proposals, new preset: ADR 0022). The identity photo never leaves the interface (§7.5):
// every render made here uses a grey placeholder of the same size.
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  AVAILABLE_LAYOUTS,
  COLLECTIONS,
  guidelines,
  libraryIndex,
  SCHEMA_VERSION,
  untranslatedFields,
  type AtsReport,
  type CollectionName,
} from '@cv/core';
import {
  renderCv,
  renderLetter,
  resolveLetterTarget,
  resolveTarget,
  type LetterRenderOutput,
  type RenderOutput,
  type RenderTarget,
} from '@cv/render';
import { addApplicationExport, DataStore } from '@cv/store';
import {
  atsSummary,
  criteriaLine,
  errorResult,
  FILE_WRITE,
  makeContext,
  mcpAssets,
  previewImage,
  READ_ONLY,
  summarize,
  target,
  type CvServerOptions,
} from './context.js';
import { SERVER_INSTRUCTIONS } from './instructions.js';
import { registerPrompts } from './prompts.js';
import { registerApplicationTools } from './tools-application.js';
import { registerImportTools } from './tools-import.js';
import { registerLetterTools } from './tools-letter.js';
import { registerPresetTools } from './tools-preset.js';
import { registerProposalTools } from './tools-propose.js';
import { registerReadTools } from './tools-read.js';
import { ok, toolError, type Masker, type ToolResult } from './results.js';

export type { CvServerOptions } from './context.js';

export const SERVER_NAME = 'cv';
export const SERVER_VERSION = '0.1.0';

function timestamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Creates `out/<AAAAMMJJ-HHmmss>_<id>[-n]/` without ever reusing a folder. */
async function newRunDir(outDir: string, id: string, suffix = ''): Promise<{ renderId: string; dir: string }> {
  const stamp = timestamp();
  for (let n = 1; ; n++) {
    const renderId = `${stamp}${n > 1 ? `-${n}` : ''}_${id}${suffix}`;
    const dir = path.join(outDir, renderId);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
      return { renderId, dir };
    }
  }
}

function blockingError(mask: Masker, out: RenderOutput): ToolResult {
  const r = out.report;
  const pages = r.criteria.find((c) => c.id === 'T-ATS-01');
  const untranslated = r.projection.blocking.filter((b) => b.code === 'UNTRANSLATED');
  let code = 'ATS_BLOCKING';
  let message = 'export refusé : au moins un critère bloquant est rouge';
  let hint = 'corrigez les critères rouges listés dans le rapport, puis relancez render';
  if (pages?.status === 'red') {
    code = 'PAGE_OVERFLOW';
    message = `le CV dépasse 1 page d'environ ${r.overflowLines} ligne(s)`;
    hint =
      "décochez des puces (voir le coût en lignes dans get_library) ou passez en densité compacte, dans l'interface";
  } else if (untranslated.length > 0) {
    code = 'UNTRANSLATED';
    message = `${untranslated.length} champ(s) non traduit(s) dans la langue demandée`;
    hint = "proposez les traductions manquantes (lot 6) ou rendez dans l'autre langue";
  } else if (r.projection.blocking.length > 0) {
    code = r.projection.blocking[0]!.code;
    message = r.projection.blocking.map((b) => b.message).join(' ; ');
    hint = "complétez les données signalées dans l'interface";
  }
  return toolError(mask, { code, message, details: { atsReport: summarize(r) }, hint });
}

/** A refused letter (MCP-19): overflow, red criterion or missing identity, with the report. */
function letterBlockingError(mask: Masker, out: LetterRenderOutput): ToolResult {
  const r = out.report;
  const pages = r.criteria.find((c) => c.id === 'T-ATS-01');
  if (pages?.status === 'red') {
    return toolError(mask, {
      code: 'PAGE_OVERFLOW',
      message: `la lettre dépasse 1 page d'environ ${r.overflowLines} ligne(s)`,
      details: { atsReport: summarize(r) },
      hint: 'raccourcissez un paragraphe et enregistrez une nouvelle version (save_letter_draft)',
    });
  }
  const issue = r.projection.blocking[0];
  return toolError(mask, {
    code: issue ? issue.code : 'ATS_BLOCKING',
    message: issue ? issue.message : 'export refusé : au moins un critère bloquant est rouge',
    details: { atsReport: summarize(r) },
    hint: issue
      ? "complétez les données signalées dans l'interface"
      : 'corrigez les critères rouges listés dans le rapport',
  });
}

const notApplication = (mask: Masker) =>
  toolError(mask, {
    code: 'INVALID_TARGET',
    message: 'une lettre appartient à une candidature',
    details: {},
    hint: 'ciblez { applicationId }',
  });

export function createCvServer(opts: CvServerOptions): McpServer {
  const store = DataStore.open(opts.dataDir);
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, { instructions: SERVER_INSTRUCTIONS });

  const ctx = makeContext(store, opts);
  const masker = ctx.masker;

  // MCP-01
  server.registerTool(
    'get_overview',
    {
      title: 'Synthèse des données',
      description:
        'Synthèse de la bibliothèque de CV : dossier de données, effectifs par collection, presets, candidatures, propositions en attente, champs non traduits, version du schéma. À appeler en premier.',
      inputSchema: z.object({}),
      outputSchema: z.object({
        dataDir: z.string(),
        schemaVersion: z.number(),
        identityPresent: z.boolean(),
        counts: z.record(z.string(), z.number()),
        presets: z.array(z.object({ id: z.string(), name: z.string(), isDefault: z.boolean(), lang: z.string() })),
        applications: z.array(z.object({ id: z.string(), company: z.string(), jobTitle: z.string() })),
        pendingProposals: z.number(),
        untranslated: z.object({ fr: z.number(), en: z.number() }),
        integrity: z.object({ errors: z.number(), warnings: z.number() }),
      }),
      annotations: READ_ONLY,
    },
    async () => {
      const mask = await masker();
      try {
        const snap = await store.loadSnapshot();
        const counts = Object.fromEntries(COLLECTIONS.map((c) => [c, snap.library[c].length]));
        counts.bullets = ['experiences', 'education', 'projects'].reduce(
          (n, c) =>
            n +
            (snap.library[c as 'experiences'] as Array<{ bullets: unknown[] }>).reduce(
              (m, i) => m + i.bullets.length,
              0,
            ),
          0,
        );
        const applications = [];
        for (const id of await store.listApplicationIds()) {
          const a = await store.loadApplication(id);
          applications.push({ id, company: a.application.company, jobTitle: a.application.jobTitle });
        }
        const proposals = await store.listProposals();
        const data = {
          dataDir: opts.dataDir,
          schemaVersion: SCHEMA_VERSION,
          identityPresent: snap.profile.identity !== null,
          counts,
          presets: snap.presets.map((p) => ({ id: p.id, name: p.name, isDefault: p.isDefault, lang: p.lang })),
          applications,
          pendingProposals: proposals.filter((p) => p.status === 'pending').length,
          untranslated: {
            fr: untranslatedFields(snap.library, 'fr').length,
            en: untranslatedFields(snap.library, 'en').length,
          },
          integrity: { errors: snap.integrity.errors.length, warnings: snap.integrity.warnings.length },
        };
        const summary = `Données : ${data.dataDir}\n${counts.experiences} expériences, ${counts.bullets} puces, ${counts.skills} compétences ; ${data.presets.length} preset(s), ${applications.length} candidature(s), ${data.pendingProposals} proposition(s) en attente ; non traduits : FR ${data.untranslated.fr}, EN ${data.untranslated.en}.`;
        return ok(mask, data, summary);
      } catch (err) {
        return errorResult(mask, err);
      }
    },
  );

  // MCP-02
  server.registerTool(
    'get_guidelines',
    {
      title: 'Règles de rédaction',
      description:
        'Règles complètes à respecter : ATS (§4), conventions FR/EN (§5), lettre (§6.10), garde-fous anti-invention (annexe C), éditions de normes autorisées (A.2). À appeler avant toute rédaction ou reformulation.',
      inputSchema: z.object({ topic: z.enum(['cv', 'letter', 'guardrails', 'all']).default('all') }),
      outputSchema: z.object({ topic: z.string(), text: z.string() }),
      annotations: READ_ONLY,
    },
    async ({ topic }) => {
      const mask = await masker();
      const text = guidelines(topic);
      return ok(mask, { topic, text }, text);
    },
  );

  // MCP-03
  const MAX_CHARS = 30_000; // ≈ 8,000 tokens
  server.registerTool(
    'get_library',
    {
      title: 'Bibliothèque',
      description:
        "Bibliothèque de contenus. Vue `index` par défaut : une ligne par élément (id, type, intitulé ou variante tronquée à 120 caractères, dates, tags, compétences liées, verrou, champs non traduits, coût estimé en lignes, termes de l'offre si applicationId). Vue `full` : éléments complets. Réponse plafonnée (~8 000 tokens) avec nextCursor. Ne renvoie jamais e-mail, téléphone, photo ni adresse.",
      inputSchema: z.object({
        lang: z.enum(['fr', 'en']).default('fr'),
        view: z.enum(['index', 'full']).default('index'),
        collections: z.array(z.enum(COLLECTIONS)).optional(),
        tags: z.array(z.string()).optional(),
        ids: z.array(z.string()).optional(),
        applicationId: z.string().optional(),
        variants: z.enum(['chosen', 'all']).default('chosen'),
        includeArchived: z.boolean().default(false),
        cursor: z.string().optional().describe('Valeur nextCursor de la réponse précédente'),
        limit: z.number().int().min(1).max(500).default(200),
      }),
      outputSchema: z.object({
        view: z.enum(['index', 'full']),
        lang: z.enum(['fr', 'en']),
        total: z.number(),
        returned: z.number(),
        items: z.array(z.record(z.string(), z.unknown())),
        nextCursor: z.string().nullable(),
        note: z.string().nullable(),
      }),
      annotations: READ_ONLY,
    },
    async (args) => {
      const mask = await masker();
      try {
        const snap = await store.loadSnapshot();
        let variantChoice: Record<string, string> =
          snap.presets.find((p) => p.isDefault)?.selection.variantChoice ?? {};
        let offerTerms;
        if (args.applicationId) {
          const app = await store.loadApplication(args.applicationId);
          variantChoice = app.selection.selection.variantChoice;
          offerTerms = app.analysis?.current?.terms;
        }
        let items: Array<Record<string, unknown>>;
        if (args.view === 'index') {
          items = libraryIndex(snap.library, {
            lang: args.lang,
            variants: args.variants,
            variantChoice,
            includeArchived: args.includeArchived,
            ...(args.collections ? { collections: args.collections as CollectionName[] } : {}),
            ...(args.tags ? { tags: args.tags } : {}),
            ...(args.ids ? { ids: args.ids } : {}),
            ...(offerTerms ? { offerTerms } : {}),
          }) as unknown as Array<Record<string, unknown>>;
        } else {
          items = [];
          for (const c of args.collections ?? COLLECTIONS) {
            for (const item of snap.library[c] as Array<{ id: string; tags?: string[]; archived?: boolean }>) {
              if (args.ids && !args.ids.includes(item.id)) continue;
              if (args.tags && !(item.tags ?? []).some((t) => args.tags!.includes(t))) continue;
              if (!args.includeArchived && item.archived) continue;
              items.push({ collection: c, ...item });
            }
          }
        }
        const start = args.cursor ? Number.parseInt(args.cursor, 10) || 0 : 0;
        const page: Array<Record<string, unknown>> = [];
        let size = 0;
        for (let i = start; i < items.length && page.length < args.limit; i++) {
          const len = JSON.stringify(items[i]).length;
          if (page.length > 0 && size + len > MAX_CHARS) break;
          page.push(items[i]!);
          size += len;
        }
        const next = start + page.length < items.length ? String(start + page.length) : null;
        const note = next
          ? 'Réponse tronquée : filtrez par collections, tags ou ids, ou rappelez get_library avec cursor = nextCursor.'
          : null;
        const data = {
          view: args.view,
          lang: args.lang,
          total: items.length,
          returned: page.length,
          items: page,
          nextCursor: next,
          note,
        };
        const summary =
          args.view === 'index'
            ? page
                .map(
                  (r) =>
                    `${String(r.id)} [${String(r.type)}] ${String(r.label)}${r.dates ? ` (${String(r.dates)})` : ''} ~${String(r.lineCost)} l.`,
                )
                .join('\n') + (note ? `\n${note}` : '')
            : `${page.length} élément(s) sur ${items.length}${note ? `. ${note}` : ''}`;
        return ok(mask, data, summary);
      } catch (err) {
        return errorResult(mask, err);
      }
    },
  );

  // MCP-19
  server.registerTool(
    'render',
    {
      title: 'Générer le CV',
      description:
        "Compile le contenu VALIDÉ d'un preset ou d'une candidature (PDF Typst ou DOCX) et l'écrit dans out/<AAAAMMJJ-HHmmss>_<id>/, sans rien écraser. Exécute le contrôle de lisibilité ATS. Un refus (dépassement d'une page, critère bloquant, traduction manquante) est une erreur d'outil avec le rapport et une action suggérée. kind letter : la lettre de motivation d'une candidature, dans sa version active (ou version, pour un aperçu) ; avec saveToApplication, seule la version active s'exporte.",
      inputSchema: z.object({
        target,
        kind: z.enum(['cv', 'letter']).default('cv'),
        format: z.enum(['pdf', 'docx']).default('pdf'),
        lang: z.enum(['fr', 'en']).optional(),
        layout: z
          .enum(AVAILABLE_LAYOUTS)
          .optional()
          .describe('visuel : deux colonnes, destiné à une lecture humaine, déconseillé pour les portails ATS'),
        saveToApplication: z.boolean().default(false),
        includePreviewImage: z.boolean().default(false),
        version: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            'Lettre : version à rendre pour un aperçu ; par défaut, et toujours avec saveToApplication, la version active',
          ),
      }),
      outputSchema: z.object({
        renderId: z.string(),
        absolutePath: z.string(),
        fileUri: z.string(),
        pages: z.number(),
        fillRatio: z.number(),
        overflowLines: z.number(),
        atsReport: atsSummary,
        savedToApplication: z.string().nullable(),
      }),
      annotations: FILE_WRITE,
    },
    async (args) => {
      const mask = await masker();
      try {
        if (args.kind === 'letter') {
          if (!('applicationId' in args.target)) return notApplication(mask);
          const t = await resolveLetterTarget(store, {
            applicationId: args.target.applicationId,
            ...(args.lang ? { lang: args.lang } : {}),
            version: args.version ?? null,
            requireActive: args.saveToApplication,
          });
          const out = await renderLetter(await store.loadSnapshot(), t, { format: args.format });
          if (out.report.blocking) return letterBlockingError(mask, out);
          const { renderId, dir } = await newRunDir(opts.outDir, t.application.id, '-lettre');
          const fileName = out.fileName ?? `LM_${t.application.id}.${args.format}`;
          const bytes = args.format === 'pdf' ? out.compiled.pdf : out.docx!;
          const absolutePath = path.join(dir, fileName);
          await writeFile(absolutePath, bytes);
          await writeFile(path.join(dir, 'ats-report.json'), JSON.stringify(out.report, null, 2));
          let savedToApplication: string | null = null;
          if (args.saveToApplication) {
            const saved = await addApplicationExport(store, t.application.id, {
              kind: 'letter',
              fileName,
              bytes,
              format: args.format,
              lang: t.lang,
              layout: t.selection.template.layout,
              pages: out.compiled.pages,
              atsCheck: out.report.criteria.some((c) => c.status === 'orange') ? 'avertissements' : 'ok',
            });
            savedToApplication = saved.file;
          }
          const data = {
            renderId,
            absolutePath,
            fileUri: pathToFileURL(absolutePath).href,
            pages: out.compiled.pages,
            fillRatio: Math.round(out.compiled.measure.fillRatio * 1000) / 1000,
            overflowLines: out.compiled.measure.overflowLines,
            atsReport: summarize(out.report),
            savedToApplication,
          };
          const summary = `Lettre ${t.lang.toUpperCase()} v${t.version.version} générée : ${absolutePath}\n1 page, remplissage ${Math.round(data.fillRatio * 100)} %. Lisibilité : ${criteriaLine(out.report)}.`;
          return ok(mask, data, summary);
        }
        const snap = await store.loadSnapshot();
        const resolved = await resolveTarget(store, snap, args.target as RenderTarget);
        const out = await renderCv(
          snap,
          resolved,
          {
            format: args.format,
            ...(args.lang ? { lang: args.lang } : {}),
            ...(args.layout ? { layout: args.layout } : {}),
          },
          await mcpAssets(snap),
        );
        if (out.report.blocking) return blockingError(mask, out);
        if (args.saveToApplication && resolved.kind !== 'application') {
          return toolError(mask, {
            code: 'INVALID_TARGET',
            message: 'saveToApplication exige une candidature',
            details: {},
            hint: 'ciblez { applicationId }',
          });
        }

        const { renderId, dir } = await newRunDir(opts.outDir, resolved.id);
        const fileName = out.fileName ?? `CV_${resolved.id}.${args.format}`;
        const bytes = args.format === 'pdf' ? out.compiled.pdf : out.docx!;
        const absolutePath = path.join(dir, fileName);
        await writeFile(absolutePath, bytes);
        await writeFile(path.join(dir, 'ats-report.json'), JSON.stringify(out.report, null, 2));

        let savedToApplication: string | null = null;
        if (args.saveToApplication) {
          // F-CAN-03: the same function (and the same trace) as the export from the interface.
          const saved = await addApplicationExport(store, resolved.id, {
            fileName,
            bytes,
            format: args.format,
            lang: out.projection.lang,
            layout: out.projection.layout,
            pages: out.compiled.pages,
            atsCheck: out.report.criteria.some((c) => c.status === 'orange') ? 'avertissements' : 'ok',
          });
          savedToApplication = saved.file;
        }

        const images = args.includePreviewImage ? [await previewImage(out)].filter((x) => x !== null) : [];
        const data = {
          renderId,
          absolutePath,
          fileUri: pathToFileURL(absolutePath).href,
          pages: out.compiled.pages,
          fillRatio: Math.round(out.compiled.measure.fillRatio * 1000) / 1000,
          overflowLines: out.compiled.measure.overflowLines,
          atsReport: summarize(out.report),
          savedToApplication,
        };
        const summary = `CV généré : ${absolutePath}\n1 page, remplissage ${Math.round(data.fillRatio * 100)} %. Lisibilité ATS : ${criteriaLine(out.report)}.`;
        return ok(mask, data, summary, images);
      } catch (err) {
        return errorResult(mask, err);
      }
    },
  );

  // MCP-20
  const MAX_TEXT = 4000;
  server.registerTool(
    'check_ats',
    {
      title: 'Contrôle de lisibilité ATS',
      description:
        'Critères de lisibilité ATS (§12.3) et texte extrait (pdf.js), tronqué à 4 000 caractères ; le rapport complet est écrit dans out/. E-mail et téléphone sont masqués. Accepte un renderId (rendu précédent) ou une cible à compiler.',
      inputSchema: z.object({
        renderId: z.string().optional(),
        target: target.optional(),
        kind: z.enum(['cv', 'letter']).default('cv'),
        lang: z.enum(['fr', 'en']).optional(),
        format: z.enum(['pdf', 'docx']).default('pdf'),
        layout: z
          .enum(AVAILABLE_LAYOUTS)
          .optional()
          .describe('CV : mise en page à contrôler (visuel : critères de mise en page en orange)'),
      }),
      outputSchema: z.object({
        renderId: z.string(),
        reportPath: z.string(),
        atsReport: atsSummary,
        text: z.string(),
        textTruncated: z.boolean(),
      }),
      annotations: FILE_WRITE,
    },
    async (args) => {
      const mask = await masker();
      try {
        let report: AtsReport;
        let renderId: string;
        let reportPath: string;
        if (args.renderId) {
          if (!/^\d{8}-\d{6}(?:-\d+)?_[a-z0-9-]+$/.test(args.renderId)) {
            return toolError(mask, {
              code: 'NOT_FOUND',
              message: `renderId invalide : ${args.renderId}`,
              details: {},
              hint: 'utilisez le renderId renvoyé par render',
            });
          }
          renderId = args.renderId;
          reportPath = path.join(opts.outDir, renderId, 'ats-report.json');
          if (!existsSync(reportPath)) {
            return toolError(mask, {
              code: 'NOT_FOUND',
              message: `rendu introuvable : ${renderId}`,
              details: {},
              hint: 'relancez render',
            });
          }
          report = JSON.parse(await readFile(reportPath, 'utf8')) as AtsReport;
        } else if (args.target) {
          if (args.kind === 'letter') {
            if (!('applicationId' in args.target)) return notApplication(mask);
            const t = await resolveLetterTarget(store, {
              applicationId: args.target.applicationId,
              ...(args.lang ? { lang: args.lang } : {}),
            });
            const out = await renderLetter(await store.loadSnapshot(), t, { format: args.format });
            report = out.report;
            const run = await newRunDir(opts.outDir, t.application.id, '-lettre-controle');
            renderId = run.renderId;
            reportPath = path.join(run.dir, 'ats-report.json');
            await writeFile(reportPath, JSON.stringify(report, null, 2));
          } else {
            const snap = await store.loadSnapshot();
            const resolved = await resolveTarget(store, snap, args.target as RenderTarget);
            const out = await renderCv(
              snap,
              resolved,
              {
                format: args.format,
                ...(args.lang ? { lang: args.lang } : {}),
                ...(args.layout ? { layout: args.layout } : {}),
              },
              await mcpAssets(snap),
            );
            report = out.report;
            const run = await newRunDir(opts.outDir, resolved.id, '-controle');
            renderId = run.renderId;
            reportPath = path.join(run.dir, 'ats-report.json');
            await writeFile(reportPath, JSON.stringify(report, null, 2));
          }
        } else {
          return toolError(mask, {
            code: 'INVALID_ARGUMENTS',
            message: 'renderId ou target requis',
            details: {},
            hint: 'passez le renderId de render, ou { target: { presetId } }',
          });
        }
        const text = report.text.pdfjs;
        const data = {
          renderId,
          reportPath,
          atsReport: summarize(report),
          text: text.slice(0, MAX_TEXT),
          textTruncated: text.length > MAX_TEXT,
        };
        const summary = `Lisibilité ATS : ${criteriaLine(report)}${report.blocking ? ' — export bloqué' : ''}.\nRapport complet : ${reportPath}\n--- Texte extrait (pdf.js) ---\n${data.text}`;
        return ok(mask, data, summary);
      } catch (err) {
        return errorResult(mask, err);
      }
    },
  );

  // Lot 5 (MCP-04 to 07, 09 to 13, 15 to 17) and the prompt adapter-a-une-offre (§7.3).
  registerReadTools(server, ctx);
  registerApplicationTools(server, ctx);
  registerProposalTools(server, ctx);
  registerImportTools(server, ctx);
  registerLetterTools(server, ctx);
  registerPresetTools(server, ctx);
  registerPrompts(server);

  return server;
}
