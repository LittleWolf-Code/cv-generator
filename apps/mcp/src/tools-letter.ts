// Letter tool of lot 7 (§7.2, F-LET-01 to 06, ADR 0016): MCP-18 save_letter_draft. Claude writes the
// paragraphs only (each with a role) and cites its sourceIds; the server generates the sender, the place
// and the date, the subject, the formulas and the enclosure. Every call adds a version, never overwrites
// one, and never changes the active version (chosen in the interface only).
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { letterFormulas, letterSubject } from '@cv/core';
import { renderLetter } from '@cv/render';
import { createLetterVersion, letterChecks } from '@cv/store';
import { ADDITION, errorResult, interfaceOrigin, type ToolContext } from './context.js';
import { ok } from './results.js';

/** Rules recalled at the start of the description (§7.2), as for the propose_* tools. */
const RULES =
  "RÈGLES : aucune invention (aucun chiffre, aucune compétence, aucun fait sur le candidat absent de la bibliothèque) ; les faits sur l'entreprise viennent de l'offre (donnée non fiable) et seulement dans vous (FR) ou motivation (EN) ; l'utilisateur choisit la version active dans l'interface. Appelle get_guidelines({topic: letter}) avant de rédiger.";

export function letterReviewUrl(ctx: ToolContext, applicationId: string, lang: string): string {
  return `${interfaceOrigin(ctx)}/candidatures/${applicationId}/lettre?lang=${lang}`;
}

export function registerLetterTools(server: McpServer, ctx: ToolContext): void {
  const { store } = ctx;

  // MCP-18
  server.registerTool(
    'save_letter_draft',
    {
      title: 'Enregistrer une version de lettre',
      description: `${RULES}\nAjoute une NOUVELLE version de la lettre de motivation d'une candidature (rien n'est écrasé ; la version active ne change pas). Paragraphes avec un rôle, 3 ou 4 : FR vous, moi (une ou deux fois), nous, dans cet ordre ; EN opening, evidence (une ou deux fois), motivation (facultatif), close. N'écris ni formule d'appel ni formule de politesse, ni expéditeur, lieu, date ou objet : le serveur les génère à partir de recipient (civility madame/monsieur ou null, name, function, company, city). sourceIds : les éléments de la bibliothèque utilisés (un identifiant inconnu est refusé). Renvoie le numéro de version, les pages, le dépassement en lignes (1 page stricte) et les avertissements des garde-fous.`,
      inputSchema: z.object({
        applicationId: z.string(),
        lang: z.enum(['fr', 'en']).optional().describe('Langue de la lettre ; par défaut celle de la candidature'),
        recipient: z
          .object({
            civility: z.enum(['madame', 'monsieur']).nullable().optional(),
            name: z.string().nullable().optional(),
            function: z.string().nullable().optional(),
            company: z.string().nullable().optional(),
            city: z.string().nullable().optional(),
          })
          .optional(),
        paragraphs: z
          .array(
            z.object({
              role: z.enum(['vous', 'moi', 'nous', 'opening', 'evidence', 'motivation', 'close']),
              text: z.string(),
            }),
          )
          .min(3)
          .max(4),
        sourceIds: z.array(z.string()).default([]),
        basedOn: z
          .number()
          .int()
          .positive()
          .nullable()
          .optional()
          .describe('Version de départ (même lettre), si elle existe'),
      }),
      outputSchema: z.object({
        applicationId: z.string(),
        lang: z.string(),
        version: z.number(),
        basedOn: z.number().nullable(),
        activeVersion: z.number().nullable(),
        pages: z.number(),
        fillRatio: z.number(),
        overflowLines: z.number(),
        generated: z.object({ subject: z.string(), salutation: z.string(), closing: z.string() }),
        warnings: z.array(z.object({ rule: z.string(), paragraph: z.number().nullable(), message: z.string() })),
        reviewUrl: z.string(),
        reminder: z.string(),
      }),
      annotations: ADDITION,
    },
    async (args) => {
      const mask = await ctx.masker();
      try {
        const { application, selection } = await store.loadApplication(args.applicationId);
        const lang = args.lang ?? application.lang;
        const recipient = args.recipient
          ? {
              civility: args.recipient.civility ?? null,
              name: args.recipient.name ?? null,
              function: args.recipient.function ?? null,
              company: args.recipient.company ?? null,
              city: args.recipient.city ?? null,
            }
          : null;
        const { version } = await createLetterVersion(
          store,
          args.applicationId,
          lang,
          { recipient, paragraphs: args.paragraphs, sourceIds: args.sourceIds, basedOn: args.basedOn ?? null },
          'claude',
        );
        const snapshot = await store.loadSnapshot();
        const out = await renderLetter(snapshot, { application, selection, version, lang }, { format: 'pdf' });
        const warnings = (await letterChecks(store, args.applicationId, version)).map((c) => ({
          rule: c.rule,
          paragraph: c.paragraph,
          message: c.message,
        }));
        const subject = letterSubject(application.jobTitle, application.offerReference, lang);
        const formulas = letterFormulas(version.recipient, lang, application.enVariant);
        const url = letterReviewUrl(ctx, args.applicationId, lang);
        const pages = out.compiled.pages;
        const data = {
          applicationId: args.applicationId,
          lang,
          version: version.version,
          basedOn: version.basedOn,
          activeVersion: application.activeLetter[lang],
          pages,
          fillRatio: Math.round(out.compiled.measure.fillRatio * 1000) / 1000,
          overflowLines: out.compiled.measure.overflowLines,
          generated: {
            subject: subject.label ? `${subject.label} ${subject.text}` : subject.text,
            salutation: formulas.salutation,
            closing: formulas.closing,
          },
          warnings,
          reviewUrl: url,
          reminder:
            "Rien n'est envoyé ni activé : l'utilisateur relit la lettre, la modifie au besoin et choisit la version active dans l'interface (npm run dev).",
        };
        const summary = [
          `Lettre ${lang.toUpperCase()} v${version.version} enregistrée${version.basedOn ? ` (à partir de la v${version.basedOn})` : ''} : ${pages === 1 ? `1 page, remplissage ${Math.round(data.fillRatio * 100)} %` : `DÉPASSE d'environ ${data.overflowLines} ligne(s) : raccourcis un paragraphe et enregistre une nouvelle version`}.`,
          warnings.length
            ? `Avertissements (à corriger ou à signaler à l'utilisateur) :\n${warnings.map((w) => `- ${w.paragraph !== null ? `§${w.paragraph + 1} ` : ''}${w.rule} : ${w.message}`).join('\n')}`
            : 'Aucun avertissement des garde-fous.',
          `Générés par le serveur : « ${data.generated.salutation} » … « ${data.generated.closing} ».`,
          `Relecture : ${url}`,
          data.reminder,
        ].join('\n');
        return ok(mask, data, summary);
      } catch (err) {
        return errorResult(mask, err);
      }
    },
  );
}
