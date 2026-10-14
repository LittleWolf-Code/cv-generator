// Interface state (ADR 0011), with Zustand + Immer: the library, the presets, and the preset being
// edited as two versions, the one saved on the server and the draft. Every change applies at once to
// the draft; it is saved 250 ms after the last change, one save at a time, with the revision read
// (409 → conflict banner). The preview compiles the draft 250 ms after the last change, without any
// write (F-SEL-06, NF-04). The browser is never the source of truth (§8.4): localStorage only keeps
// the id of the preset shown. Export (F-EXP-01 to 04, ADR 0012): the preset is saved, the preview is
// brought up to date, the reasons of a refusal are listed with their fix, then the file handed to the
// browser is the preview buffer itself (T-ATS-13: same SHA-256 as the preview shown). An application
// (ADR 0013) is edited the same way: it is shown as a « virtual preset » built from application.json
// (language, file label) and selection.json (selection, options, template); its saves go to
// selection.json, its preview carries the coverage of the offer terms, its exports go to its folder.
import { exportBlockers, type ExportBlocker } from '@cv/core/export';
import type { AtsCriterion, AtsReport } from '@cv/core';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  ApiError,
  api,
  type ApplicationDetail,
  type ApplicationFile,
  type ApplicationSelectionFile,
  type ApplicationSummary,
  type EditTarget,
  decodeBase64,
  saveBlob,
  sha256Hex,
  type ExportResponse,
  type LibraryResponse,
  type PresetDraft,
  type PresetFile,
  type RenderResponse,
} from '../api';

export type SaveStatus = 'enregistré' | 'en attente' | 'enregistrement' | 'erreur' | 'conflit';

export interface PreviewState {
  response: RenderResponse | null;
  error: string | null;
  busy: boolean;
  /** `performance.now()` of the change the shown preview comes from. */
  since: number | null;
  /** Milliseconds between that change and the painted preview (NF-04: under 1 s). */
  latencyMs: number | null;
}

/** The preview shown: its response, the PDF buffer loaded by the pdf.js viewer and its SHA-256. */
export interface DisplayedPreview {
  response: RenderResponse;
  bytes: Uint8Array<ArrayBuffer>;
  sha256: string;
}

export type ExportFormat = 'pdf' | 'docx';

export interface ExportDone {
  format: ExportFormat;
  fileName: string;
  savedTo: string | null;
  /** The copy is in the application folder (F-CAN-03), traced in application.json. */
  inApplication: boolean;
  sha256: string;
  at: string;
}

export interface ExportState {
  busy: ExportFormat | null;
  /** Last successful export of the preset shown. */
  last: ExportDone | null;
  /** Why the last attempt was refused (F-EXP-03), each reason with its fix (F-UI-06). */
  refused: { message: string; blockers: ExportBlocker[] } | null;
  /** Report of the last attempt per format, with the preview it was made from (T-ATS-13, T-DOCX). */
  reports: Partial<Record<ExportFormat, { previewSha256: string; report: AtsReport }>>;
}

export interface CvState {
  library: LibraryResponse | null;
  libraryError: string | null;
  presets: PresetFile[];
  /** Preset shown in preset mode (kept while an application is open, to come back to it). */
  activeId: string | null;
  /** `application`: the draft is the open application, shown as a preset. */
  mode: 'preset' | 'application';
  applications: ApplicationSummary[];
  /** The open application: meta, saved selection, analysis and offer. */
  application: ApplicationDetail | null;
  /** Last version known on the server. */
  saved: PresetFile | null;
  /** Version being edited: what the tree, the settings and the preview show. */
  draft: PresetFile | null;
  save: { status: SaveStatus; message: string | null; conflict: PresetFile | null };
  preview: PreviewState;
  displayed: DisplayedPreview | null;
  exporting: ExportState;

  reloadLibrary(): Promise<void>;
  reloadApplications(): Promise<void>;
  /** Opens an application in the selection screen; the current edits are saved first. */
  openApplication(id: string): Promise<boolean>;
  /** Reloads the open application (live event, analysis import) without losing unsaved changes. */
  reloadApplication(): Promise<void>;
  /** Recompiles the preview now (the coverage depends on the saved analysis). */
  refreshPreview(): void;
  /** Reloads the presets (start, live event, own action) without losing unsaved changes. */
  reloadPresets(): Promise<void>;
  /** Shows a preset (and leaves the application mode); the current changes are saved first. False if that save fails. */
  activate(id: string): Promise<boolean>;
  /** Applies a change to the draft (Immer recipe), then schedules the save and the preview. */
  edit(recipe: (preset: PresetFile) => void): void;
  resolveConflict(choice: 'reload' | 'keep'): void;
  createPreset(name: string, from: string | null): Promise<PresetFile>;
  /** Renames the preset shown; a refused name (422) is thrown to the dialog, the draft is untouched. */
  renamePreset(name: string): Promise<void>;
  archivePreset(id: string, archived: boolean): Promise<void>;
  setDefaultPreset(id: string): Promise<void>;
  /** Called once the preview canvas is painted: measures the latency of the change (NF-04). */
  previewPainted(since: number): void;
  /** Records the buffer pdf.js shows, with its SHA-256 (T-ATS-13). */
  previewDisplayed(response: RenderResponse, bytes: Uint8Array<ArrayBuffer>): Promise<void>;
  /** Saves the preset, then exports the preview shown (PDF) or the DOCX of the same projection. */
  exportCv(format: ExportFormat): Promise<void>;
  dismissExport(): void;
}

const ACTIVE_KEY = 'cv.preset';
const APPLICATION_KEY = 'cv.application';
const UNSAVED = "enregistrez ou résolvez d'abord les modifications du preset actuel";
const DEBOUNCE_MS = 250;
const PREVIEW_WAIT_MS = 15_000;
const MIME: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
const EMPTY_EXPORT: ExportState = { busy: null, last: null, refused: null, reports: {} };

export const draftOf = (p: PresetFile): PresetDraft => ({
  lang: p.lang,
  enVariant: p.enVariant,
  template: p.template,
  selection: p.selection,
  options: p.options,
});

/** An application shown as a preset: its edits go back to selection.json and application.json. */
export function virtualPreset(app: ApplicationFile, sel: ApplicationSelectionFile): PresetFile {
  return {
    schemaVersion: 1,
    revision: sel.revision,
    id: app.id,
    name: `${app.company} – ${app.jobTitle}`,
    isDefault: false,
    archived: false,
    lang: app.lang,
    enVariant: app.enVariant,
    template: sel.template,
    selection: sel.selection,
    options: sel.options,
    fileLabel: app.fileLabel,
  };
}

/** Same content (the revision, default flag and archived state change through their own actions). */
function sameContent(a: PresetFile | null, b: PresetFile | null): boolean {
  if (!a || !b) return a === b;
  const content = (p: PresetFile) =>
    JSON.stringify([p.id, p.name, p.lang, p.enVariant, p.template, p.selection, p.options, p.fileLabel]);
  return content(a) === content(b);
}

function message(e: unknown): string {
  if (e instanceof ApiError) {
    const issues = e.issues.map((i) => (i.path ? `${i.path} : ${i.message}` : i.message));
    return [e.message, ...issues].join(' ; ');
  }
  return (e as Error).message;
}

function remember(key: string, id: string | null): void {
  try {
    if (id === null) localStorage.removeItem(key);
    else localStorage.setItem(key, id);
  } catch {
    // Private mode: the default preset is shown next time.
  }
}

function remembered(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function initialPreset(presets: PresetFile[]): PresetFile | null {
  let remembered: string | null = null;
  try {
    remembered = localStorage.getItem(ACTIVE_KEY);
  } catch {
    // Interface state only.
  }
  const live = presets.filter((p) => !p.archived);
  return live.find((p) => p.id === remembered) ?? live.find((p) => p.isDefault) ?? live[0] ?? presets[0] ?? null;
}

// Timers and sequence numbers live outside the state: they are not rendered.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveChain: Promise<boolean> = Promise.resolve(true);
let saving = false;
let previewTimer: ReturnType<typeof setTimeout> | null = null;
let previewSeq = 0;
let lastChange: number | null = null;
/**
 * The application remembered in localStorage is reopened once, at the first load. Its id is read before
 * anything is shown: the first preset shown forgets it (`show`), and the presets may load before the
 * applications (recette of lot 8).
 */
let restored = false;
const rememberedApplication = remembered(APPLICATION_KEY);

export const useCv = create<CvState>()(
  immer((set, get, store) => {
    const schedulePreview = (delay = DEBOUNCE_MS) => {
      lastChange = performance.now();
      if (previewTimer) clearTimeout(previewTimer);
      previewTimer = setTimeout(() => {
        previewTimer = null;
        void runPreview();
      }, delay);
    };

    /** Resolves with the preview shown once it is the one of the latest draft (no change pending). */
    const waitForDisplayed = (): Promise<DisplayedPreview> =>
      new Promise((resolve, reject) => {
        const settled = (s: CvState): boolean => {
          if (previewTimer || s.preview.busy) return false;
          if (s.preview.error) {
            reject(new Error(`aperçu impossible : ${s.preview.error}`));
            return true;
          }
          if (s.preview.response && s.displayed?.response === s.preview.response) {
            resolve(s.displayed);
            return true;
          }
          return false;
        };
        if (settled(get())) return;
        const timer = setTimeout(() => {
          unsubscribe();
          reject(new Error("l'aperçu n'a pas pu être mis à jour à temps : réessayez"));
        }, PREVIEW_WAIT_MS);
        const unsubscribe = store.subscribe((s) => {
          if (settled(s)) {
            clearTimeout(timer);
            unsubscribe();
          }
        });
      });

    /** The target of the preview, the saves and the exports. */
    const targetOf = (st: CvState, draft: PresetFile): EditTarget =>
      st.mode === 'application' ? { kind: 'application', id: draft.id } : { kind: 'preset', id: draft.id };

    const runPreview = async () => {
      const { draft } = get();
      if (!draft) return;
      const target = targetOf(get(), draft);
      const seq = ++previewSeq;
      const since = lastChange ?? performance.now();
      set((s) => {
        s.preview.busy = true;
      });
      try {
        const response = await api.render(target, draftOf(draft));
        if (seq !== previewSeq) return;
        set((s) => {
          s.preview.response = response;
          s.preview.error = null;
          s.preview.busy = false;
          s.preview.since = since;
        });
      } catch (e) {
        if (seq !== previewSeq) return;
        set((s) => {
          s.preview.error = message(e);
          s.preview.busy = false;
        });
      }
    };

    const doSave = async (): Promise<boolean> => {
      const { draft, saved, save } = get();
      if (!draft || !saved) return true;
      if (save.status === 'conflit') return false;
      if (sameContent(draft, saved)) {
        set((s) => {
          if (s.save.status !== 'erreur') s.save.status = 'enregistré';
        });
        return true;
      }
      saving = true;
      set((s) => {
        s.save.status = 'enregistrement';
      });
      const isApplication = get().mode === 'application';
      try {
        let next: PresetFile;
        if (isApplication) {
          // Selection, options and template go to selection.json; language and file label to application.json.
          const r = await api.saveApplicationSelection(
            draft.id,
            { ...draftOf(draft), fileLabel: draft.fileLabel },
            saved.revision,
          );
          next = virtualPreset(r.application, r.selection);
          set((s) => {
            if (s.application?.application.id === r.application.id) {
              s.application.application = r.application;
              s.application.selection = r.selection;
            }
          });
        } else next = (await api.savePreset(draft, saved.revision)).preset;
        const unchanged = get().draft === draft;
        set((s) => {
          s.saved = next;
          if (unchanged) s.draft = next;
          if (!isApplication) s.presets = s.presets.map((p) => (p.id === next.id ? next : p));
          s.save = { status: unchanged ? 'enregistré' : 'en attente', message: null, conflict: null };
        });
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.code === 'STALE_REVISION') {
          const raw = e.details.current as
            PresetFile | { application: ApplicationFile; selection: ApplicationSelectionFile };
          const current =
            'selection' in raw && 'application' in raw
              ? virtualPreset(raw.application, raw.selection)
              : (raw as PresetFile);
          set((s) => {
            s.save = { status: 'conflit', message: e.message, conflict: current };
          });
        } else {
          set((s) => {
            s.save.status = 'erreur';
            s.save.message = message(e);
          });
        }
        return false;
      } finally {
        saving = false;
      }
    };

    /** Saves are chained: never two at a time, each one sends the latest draft. */
    const saveNow = (): Promise<boolean> => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      saveChain = saveChain.then(doSave, doSave);
      return saveChain;
    };

    const show = (preset: PresetFile | null, application: ApplicationDetail | null = null) => {
      set((s) => {
        s.mode = application ? 'application' : 'preset';
        s.application = application;
        if (!application) s.activeId = preset?.id ?? null;
        s.saved = preset;
        s.draft = preset;
        s.save = { status: 'enregistré', message: null, conflict: null };
        s.preview.latencyMs = null;
        s.displayed = null;
        s.exporting = EMPTY_EXPORT;
      });
      remember(APPLICATION_KEY, application ? application.application.id : null);
      if (preset) {
        if (!application) remember(ACTIVE_KEY, preset.id);
        schedulePreview(0);
      }
    };

    /**
     * A newer version of the document shown arrived (live event): silent reload without pending changes,
     * nothing to merge when only the revision or a flag changed, conflict banner otherwise (ADR 0011).
     */
    const reconcile = (fresh: PresetFile) => {
      const st = get();
      if (!st.saved) return;
      if (fresh.revision === st.saved.revision && sameContent(fresh, st.saved)) return;
      if (sameContent(fresh, st.saved)) {
        set((s) => {
          s.saved = fresh;
          if (s.draft) {
            s.draft.revision = fresh.revision;
            s.draft.isDefault = fresh.isDefault;
            s.draft.archived = fresh.archived;
          }
        });
        return;
      }
      if (!saving && sameContent(st.draft, st.saved)) {
        set((s) => {
          s.saved = fresh;
          s.draft = fresh;
        });
        schedulePreview();
        return;
      }
      set((s) => {
        s.save = {
          status: 'conflit',
          message:
            s.mode === 'application'
              ? 'Cette candidature a été modifiée ailleurs pendant votre saisie.'
              : 'Ce preset a été modifié ailleurs pendant votre saisie.',
          conflict: fresh,
        };
      });
    };

    return {
      library: null,
      libraryError: null,
      presets: [],
      activeId: null,
      mode: 'preset',
      applications: [],
      application: null,
      saved: null,
      draft: null,
      save: { status: 'enregistré', message: null, conflict: null },
      preview: { response: null, error: null, busy: false, since: null, latencyMs: null },
      displayed: null,
      exporting: EMPTY_EXPORT,

      async reloadLibrary() {
        try {
          const library = await api.library();
          set((s) => {
            s.library = library;
            s.libraryError = null;
          });
          // The library feeds the preview: recompile with the new content.
          if (get().draft) schedulePreview();
        } catch (e) {
          set((s) => {
            s.libraryError = message(e);
          });
        }
      },

      async reloadPresets() {
        const { presets } = await api.presets();
        set((s) => {
          s.presets = presets;
        });
        const st = get();
        if (st.mode === 'application') return; // the open application is reconciled on its own
        const fresh = presets.find((p) => p.id === st.activeId) ?? null;
        if (!fresh || !st.saved) {
          show(initialPreset(presets));
          return;
        }
        reconcile(fresh);
      },

      async reloadApplications() {
        const { applications } = await api.applications();
        set((s) => {
          s.applications = applications;
        });
        if (!restored) {
          restored = true;
          const id = rememberedApplication;
          if (id && applications.some((a) => a.id === id) && get().mode === 'preset') await get().openApplication(id);
        }
      },

      async openApplication(id) {
        if (get().mode === 'application' && get().application?.application.id === id) return true;
        if (!(await saveNow())) return false;
        const detail = await api.application(id);
        show(virtualPreset(detail.application, detail.selection), detail);
        return true;
      },

      async reloadApplication() {
        const st = get();
        if (st.mode !== 'application' || !st.application) return;
        const id = st.application.application.id;
        const detail = await api.application(id);
        const current = get();
        if (current.mode !== 'application' || current.application?.application.id !== id) return;
        // The coverage is computed with the saved analysis: a new one needs a new preview.
        const analysisChanged = current.application.analysis?.revision !== detail.analysis?.revision;
        set((s) => {
          s.application = detail;
        });
        reconcile(virtualPreset(detail.application, detail.selection));
        if (analysisChanged) schedulePreview(0);
      },

      refreshPreview() {
        if (get().draft) schedulePreview(0);
      },

      async activate(id) {
        if (get().mode === 'preset' && id === get().activeId) return true;
        if (!(await saveNow())) return false;
        show(get().presets.find((p) => p.id === id) ?? null);
        return true;
      },

      edit(recipe) {
        if (!get().draft) return;
        set((s) => {
          if (s.draft) recipe(s.draft);
          if (s.save.status !== 'conflit') s.save.status = 'en attente';
        });
        schedulePreview();
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => void saveNow(), DEBOUNCE_MS);
      },

      resolveConflict(choice) {
        const current = get().save.conflict;
        if (!current) return;
        if (choice === 'reload') {
          set((s) => {
            s.saved = current;
            s.draft = current;
            if (s.mode === 'preset') s.presets = s.presets.map((p) => (p.id === current.id ? current : p));
            s.save = { status: 'enregistré', message: null, conflict: null };
          });
          schedulePreview(0);
          return;
        }
        // Keep my changes: they are saved over the current version, on purpose.
        set((s) => {
          s.saved = current;
          s.save = { status: 'en attente', message: null, conflict: null };
        });
        void saveNow();
      },

      async createPreset(name, from) {
        if (!(await saveNow())) throw new Error(UNSAVED);
        const r = await api.createPreset(name, from);
        await get().reloadPresets();
        show(get().presets.find((p) => p.id === r.preset.id) ?? r.preset);
        return r.preset;
      },

      async renamePreset(name) {
        if (!(await saveNow())) throw new Error(UNSAVED);
        const { draft, saved } = get();
        if (!draft || !saved) return;
        const r = await api.savePreset({ ...draft, name }, saved.revision);
        set((s) => {
          s.saved = r.preset;
          if (s.draft) s.draft.name = r.preset.name;
          s.presets = s.presets.map((p) => (p.id === r.preset.id ? r.preset : p));
        });
      },

      async archivePreset(id, archived) {
        await saveNow();
        await api.archivePreset(id, archived);
        await get().reloadPresets();
        if (archived && get().activeId === id) show(initialPreset(get().presets));
      },

      async setDefaultPreset(id) {
        await api.setDefaultPreset(id);
        await get().reloadPresets();
      },

      previewPainted(since) {
        set((s) => {
          if (s.preview.since === since) s.preview.latencyMs = Math.round(performance.now() - since);
        });
      },

      async previewDisplayed(response, bytes) {
        const sha256 = await sha256Hex(bytes);
        // A newer response may have arrived while hashing: only the one still current is recorded.
        if (get().preview.response !== response) return;
        set((s) => {
          s.displayed = { response, bytes, sha256 };
        });
      },

      async exportCv(format) {
        if (get().exporting.busy) return;
        set((s) => {
          s.exporting.busy = format;
          s.exporting.refused = null;
          s.exporting.last = null;
        });
        const refuse = (text: string, blockers: ExportBlocker[] = []) =>
          set((s) => {
            s.exporting.busy = null;
            s.exporting.refused = { message: text, blockers };
          });
        const label = format.toUpperCase();
        try {
          // 1. The preset is saved first: the server exports the saved version.
          if (!(await saveNow())) {
            refuse(
              "Export impossible : le preset n'est pas enregistré. Résolvez d'abord le conflit ou l'erreur d'enregistrement affichés ci-dessus.",
            );
            return;
          }
          // 2. The preview shown (the buffer loaded by the viewer) must be the one of the saved preset.
          const shown = await waitForDisplayed();
          const draft = get().draft;
          if (!draft) return;
          const density = draft.template.theme.density;
          // 3. Reasons already known from the preview (F-EXP-03): nothing is sent.
          const known = exportBlockers(shown.response.report, density);
          if (known.length > 0) {
            refuse(`Export ${label} bloqué`, known);
            return;
          }
          let r: ExportResponse;
          try {
            r = await api.exportCv(targetOf(get(), draft), format, shown.sha256);
          } catch (e) {
            if (e instanceof ApiError && (e.code === 'PREVIEW_MISMATCH' || e.code === 'EXPORT_BLOCKED')) {
              const report = e.details.report as AtsReport;
              set((s) => {
                s.exporting.reports[format] = { previewSha256: shown.sha256, report };
              });
              if (e.code === 'PREVIEW_MISMATCH') schedulePreview(0);
              refuse(
                e.code === 'PREVIEW_MISMATCH'
                  ? "Export refusé : l'aperçu affiché ne correspondait pas au preset enregistré. Il se met à jour : exportez à nouveau."
                  : `Export ${label} bloqué`,
                exportBlockers(report, density),
              );
              return;
            }
            throw e;
          }
          // 4. T-ATS-13 in the browser: the PDF handed to the download is the buffer pdf.js shows, and
          // the copy written by the server has the same SHA-256.
          const bytes = format === 'pdf' ? shown.bytes : decodeBase64(r.fileBase64 ?? '');
          const blob = new Blob([bytes], { type: MIME[format] });
          if (format === 'pdf') {
            const blobSha = await sha256Hex(await blob.arrayBuffer());
            const differing = [blobSha, r.sha256].find((h) => h !== shown.sha256);
            if (differing) {
              const red: AtsCriterion = {
                id: 'T-ATS-13',
                label: 'Aperçu = export',
                status: 'red',
                message: `Le fichier exporté (SHA-256 ${differing.slice(0, 12)}…) diffère de l'aperçu affiché (${shown.sha256.slice(0, 12)}…)`,
              };
              const report = { ...r.report, criteria: r.report.criteria.map((c) => (c.id === 'T-ATS-13' ? red : c)) };
              set((s) => {
                s.exporting.reports.pdf = { previewSha256: shown.sha256, report };
              });
              refuse('Export PDF refusé', exportBlockers(report, density));
              return;
            }
          }
          saveBlob(blob, r.fileName);
          set((s) => {
            s.exporting.busy = null;
            s.exporting.reports[format] = { previewSha256: shown.sha256, report: r.report };
            s.exporting.last = {
              format,
              fileName: r.fileName,
              savedTo: r.savedTo,
              inApplication: r.entry !== null,
              sha256: r.sha256,
              at: r.createdAt,
            };
          });
          // The trace is in application.json (own write, ignored by the live stream): reload it.
          if (r.entry) {
            void get().reloadApplication();
            void get().reloadApplications();
          }
        } catch (e) {
          refuse(`Export ${label} impossible : ${message(e)}`);
        }
      },

      dismissExport() {
        set((s) => {
          s.exporting.refused = null;
          s.exporting.last = null;
        });
      },
    };
  }),
);
