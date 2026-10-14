// MCP-22 create_preset (ADR 0022): an addition, like create_application, through the same function as
// the interface (createPreset). A blank preset or a copy of a preset; no other preset changes. The
// content of the new preset then goes through propose_selection, which the user accepts in the interface.
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { AVAILABLE_LAYOUTS, HUMAN_READING_NOTICE, LAYOUT_LABELS, lowerFirst } from '@cv/core';
import { createPreset } from '@cv/store';
import { ADDITION, errorResult, type ToolContext } from './context.js';
import { ok } from './results.js';

export function registerPresetTools(server: McpServer, ctx: ToolContext): void {
  const { store } = ctx;

  // MCP-22
  server.registerTool(
    'create_preset',
    {
      title: 'Créer un preset',
      description:
        "Crée un preset (ajout : aucun autre preset ne change), vide (rien de coché) ou copie d'un preset existant (from : sélection, options, modèle, thème, langue et libellé des fichiers). L'identifiant est attribué par le serveur. language et layout fixent la langue et le modèle de départ, avec les règles de l'interface (photo décochée en anglais, normes en section dédiée dans le visuel). Le contenu se choisit ensuite par preview_selection, puis propose_selection (baseRevision : la révision renvoyée), que l'utilisateur valide dans l'interface. Thème, densité et options se règlent dans l'interface.",
      inputSchema: z.object({
        name: z.string().describe('Nom du preset, par exemple « Ingénieur logiciel DM »'),
        from: z
          .string()
          .optional()
          .describe('Identifiant du preset à dupliquer (get_overview ou list kind presets) ; absent : preset vide'),
        language: z
          .enum(['fr', 'en-GB', 'en-US'])
          .optional()
          .describe('Langue de départ ; par défaut celle du preset copié, sinon fr'),
        layout: z
          .enum(AVAILABLE_LAYOUTS)
          .optional()
          .describe('visuel : deux colonnes, destiné à une lecture humaine, déconseillé pour les portails ATS'),
      }),
      outputSchema: z.object({
        presetId: z.string(),
        name: z.string(),
        revision: z.number(),
        lang: z.enum(['fr', 'en']),
        enVariant: z.enum(['en-GB', 'en-US']),
        layout: z.string(),
        fileLabel: z.string(),
        isDefault: z.boolean(),
        duplicatedFrom: z.string().nullable(),
        checked: z.number(),
        notes: z.array(z.string()),
      }),
      annotations: ADDITION,
    },
    async (args) => {
      const mask = await ctx.masker();
      try {
        const { preset: p, changes } = await createPreset(store, {
          name: args.name,
          from: args.from ?? null,
          language: args.language ?? null,
          layout: args.layout ?? null,
        });
        const notes = [
          changes.photoUnchecked
            ? "Photo décochée pour l'anglais (peu d'usage hors de France) : l'utilisateur peut la recocher dans l'interface."
            : null,
          changes.regulatoryPlacement === 'own-section'
            ? '« Normes et réglementation » passe en section dédiée (défaut du modèle visuel).'
            : changes.regulatoryPlacement === 'skills-subgroup'
              ? '« Normes et réglementation » revient en ligne dans Compétences (défaut des modèles ATS).'
              : null,
          p.isDefault ? "Aucun preset n'était par défaut : celui-ci le devient." : null,
        ].filter((n): n is string => n !== null);
        const layout = p.template.layout;
        const data = {
          presetId: p.id,
          name: p.name,
          revision: p.revision,
          lang: p.lang,
          enVariant: p.enVariant,
          layout,
          fileLabel: p.fileLabel,
          isDefault: p.isDefault,
          duplicatedFrom: args.from ?? null,
          checked: p.selection.include.length,
          notes,
        };
        const langLabel = p.lang === 'fr' ? 'FR' : p.enVariant.toUpperCase();
        const layoutLabel = (LAYOUT_LABELS as Record<string, string>)[layout] ?? layout;
        const summary = [
          `Preset créé : ${p.id} « ${p.name} » (${data.duplicatedFrom ? `copie de ${data.duplicatedFrom}, ${data.checked} élément(s) coché(s)` : 'vide, rien de coché'}), ${langLabel}, modèle ${layoutLabel}${layout === 'visuel' ? ` (${lowerFirst(HUMAN_READING_NOTICE)})` : ''}, révision ${p.revision}. L'utilisateur le retrouve dans la liste des presets de l'interface.`,
          ...notes,
          `Étape suivante : get_preset et get_library, puis preview_selection (target { presetId: "${p.id}" }) jusqu'à 1 page, puis propose_selection avec baseRevision ${p.revision}.`,
        ].join('\n');
        return ok(mask, data, summary);
      } catch (err) {
        return errorResult(mask, err);
      }
    },
  );
}
