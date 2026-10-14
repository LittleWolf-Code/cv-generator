// Photo of the identity (§5.2, ADR 0012): import with a 3:4 crop zone chosen by the user (centred by
// default, moved with the mouse or the arrow keys, sized with a slider), then cropped and scaled to
// 600 × 800 at most in a canvas, and sent as base64 JSON (NF-01: under the 1 MB body limit). The server
// re-encodes it with sharp (quality 85, 300 KB at most, metadata removed). Replace and remove (with a
// confirmation) are offered once a photo exists. No dependency: a canvas and pointer events.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ApiError, api, type Identity } from '../api';
import { buttonClass } from './fields';

const OUT_MAX_WIDTH = 600;
const MIN_WIDTH = 150;
const VIEW_MAX = 320;
/** Base64 budget of the JSON body (1 MB limit, the envelope included). */
const MAX_BASE64 = 950_000;

interface Source {
  img: HTMLImageElement;
  url: string;
  width: number;
  height: number;
}

/** Crop zone in source pixels; its height is always width × 4/3. */
interface Zone {
  x: number;
  y: number;
  w: number;
}

const maxWidthOf = (s: Source) => Math.min(s.width, Math.floor((s.height * 3) / 4));

function clampZone(s: Source, z: Zone): Zone {
  const w = Math.max(Math.min(z.w, maxWidthOf(s)), Math.min(MIN_WIDTH, maxWidthOf(s)));
  const h = (w * 4) / 3;
  return { w, x: Math.min(Math.max(0, z.x), s.width - w), y: Math.min(Math.max(0, z.y), s.height - h) };
}

function centred(s: Source): Zone {
  const w = maxWidthOf(s);
  return { w, x: (s.width - w) / 2, y: (s.height - (w * 4) / 3) / 2 };
}

/** Crops the zone into a 3:4 canvas of 600 × 800 at most, on white (transparent PNG). */
function cropToBase64(s: Source, z: Zone): string {
  const width = Math.min(OUT_MAX_WIDTH, Math.round(z.w));
  const height = Math.round((width * 4) / 3);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(s.img, z.x, z.y, z.w, (z.w * 4) / 3, 0, 0, width, height);
  for (const quality of [0.95, 0.9, 0.85]) {
    const base64 = canvas.toDataURL('image/jpeg', quality).replace(/^data:[^,]*,/, '');
    if (base64.length <= MAX_BASE64) return base64;
  }
  throw new Error("photo trop lourde pour l'envoi : choisissez une zone plus petite");
}

function errorText(e: unknown): string {
  if (e instanceof ApiError) return e.message + (e.hint ? ` : ${e.hint}` : '');
  return (e as Error).message;
}

function Cropper({ source, onCancel, onSave }: { source: Source; onCancel: () => void; onSave: (z: Zone) => void }) {
  const [zone, setZone] = useState<Zone>(() => centred(source));
  const drag = useRef<{ px: number; py: number; zone: Zone } | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const helpId = useId();
  const scale = Math.min(VIEW_MAX / source.width, VIEW_MAX / source.height, 1);
  const maxW = maxWidthOf(source);
  const minW = Math.min(MIN_WIDTH, maxW);

  useEffect(() => {
    const c = preview.current?.getContext('2d');
    if (!c) return;
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, 90, 120);
    c.drawImage(source.img, zone.x, zone.y, zone.w, (zone.w * 4) / 3, 0, 0, 90, 120);
  }, [source, zone]);

  const move = (dx: number, dy: number) => setZone((z) => clampZone(source, { ...z, x: z.x + dx, y: z.y + dy }));
  const resize = (w: number) =>
    setZone((z) => {
      // Keep the centre of the zone while resizing.
      const cx = z.x + z.w / 2;
      const cy = z.y + (z.w * 2) / 3;
      return clampZone(source, { w, x: cx - w / 2, y: cy - (w * 2) / 3 });
    });

  const onKey = (e: KeyboardEvent) => {
    const step = (e.shiftKey ? 0.1 : 0.02) * source.width;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      move(...moves[e.key]!);
    } else if (e.key === '+' || e.key === '-') {
      e.preventDefault();
      resize(zone.w * (e.key === '+' ? 1.05 : 0.95));
    }
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, zone };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    setZone(
      clampZone(source, {
        ...d.zone,
        x: d.zone.x + (e.clientX - d.px) / scale,
        y: d.zone.y + (e.clientY - d.py) / scale,
      }),
    );
  };

  return (
    <div className="space-y-3 rounded border border-slate-200 p-3">
      <p id={helpId} className="text-xs text-slate-600">
        Placez le cadre 3:4 sur votre visage : glissez-le à la souris, ou utilisez les flèches (Maj : plus vite) et les
        touches + et −. Seule la zone encadrée sera conservée.
      </p>
      <div className="flex flex-wrap items-start gap-4">
        <div
          className="relative overflow-hidden bg-slate-200"
          style={{ width: source.width * scale, height: source.height * scale }}
        >
          <img src={source.url} alt="" className="block h-full w-full select-none" draggable={false} />
          <div
            role="group"
            aria-label="Zone de recadrage de la photo"
            aria-describedby={helpId}
            tabIndex={0}
            onKeyDown={onKey}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            className="absolute cursor-move touch-none outline-offset-2 ring-2 ring-white focus-visible:outline-2 focus-visible:outline-[#1F4E79]"
            style={{
              left: zone.x * scale,
              top: zone.y * scale,
              width: zone.w * scale,
              height: ((zone.w * 4) / 3) * scale,
              boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)',
            }}
          />
        </div>
        <div className="space-y-2">
          <canvas
            ref={preview}
            width={90}
            height={120}
            className="ring-1 ring-slate-300"
            role="img"
            aria-label="Aperçu du recadrage"
          />
          <p className="text-xs text-slate-500">
            {Math.min(OUT_MAX_WIDTH, Math.round(zone.w))} ×{' '}
            {Math.round((Math.min(OUT_MAX_WIDTH, Math.round(zone.w)) * 4) / 3)} px
          </p>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        Taille de la zone
        <input
          type="range"
          min={minW}
          max={maxW}
          step={1}
          value={Math.round(zone.w)}
          disabled={minW === maxW}
          onChange={(e) => resize(Number(e.target.value))}
        />
      </label>
      <div className="flex gap-2">
        <button type="button" className={buttonClass.primary} onClick={() => onSave(zone)}>
          Enregistrer la photo
        </button>
        <button type="button" className={buttonClass.secondary} onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  );
}

export function PhotoEditor({
  identity,
  revision,
  onWritten,
}: {
  identity: Identity | null;
  revision: number;
  onWritten: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const hasPhoto = !!identity?.photo;

  // Thumbnail of the stored photo, fetched with the token; reloaded at each new revision.
  useEffect(() => {
    let cancelled = false;
    let current: string | null = null;
    if (hasPhoto) {
      api
        .photoUrl()
        .then((u) => {
          if (cancelled) {
            if (u) URL.revokeObjectURL(u);
            return;
          }
          current = u;
          setUrl(u);
        })
        .catch(() => setUrl(null));
    } else setUrl(null);
    return () => {
      cancelled = true;
      if (current) URL.revokeObjectURL(current);
    };
  }, [hasPhoto, revision]);

  useEffect(() => () => (source ? URL.revokeObjectURL(source.url) : undefined), [source]);

  const choose = async (file: File | undefined) => {
    setNotice(null);
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setNotice({ tone: 'error', text: 'Format non pris en charge : choisissez un JPEG, un PNG ou un WebP.' });
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    // load rather than decode(): decode() waits for a rendered frame, which never comes in a hidden window.
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('image illisible'));
    });
    img.src = objectUrl;
    try {
      await loaded;
    } catch {
      URL.revokeObjectURL(objectUrl);
      setNotice({ tone: 'error', text: 'Image illisible : choisissez une autre photo.' });
      return;
    }
    const s = { img, url: objectUrl, width: img.naturalWidth, height: img.naturalHeight };
    if (maxWidthOf(s) < MIN_WIDTH) {
      URL.revokeObjectURL(objectUrl);
      setNotice({
        tone: 'error',
        text: `Photo trop petite (${s.width} × ${s.height} px) : il faut au moins ${MIN_WIDTH} × ${(MIN_WIDTH * 4) / 3} px une fois recadrée en 3:4.`,
      });
      return;
    }
    setSource(s);
  };

  const save = async (zone: Zone) => {
    if (!source) return;
    setBusy(true);
    try {
      const r = await api.uploadPhoto(cropToBase64(source, zone), revision);
      setSource(null);
      setNotice({
        tone: 'ok',
        text: r.photo
          ? `Photo enregistrée : ${r.photo.width} × ${r.photo.height} px, ${Math.round(r.photo.bytes / 1024)} Ko, métadonnées supprimées.`
          : 'Photo enregistrée.',
      });
      onWritten();
    } catch (e) {
      setNotice({ tone: 'error', text: `Photo non enregistrée : ${errorText(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Retirer la photo ? Son fichier sera supprimé de data/assets.')) return;
    setBusy(true);
    try {
      await api.removePhoto(revision);
      setNotice({ tone: 'ok', text: 'Photo retirée.' });
      onWritten();
    } catch (e) {
      setNotice({ tone: 'error', text: `Photo non retirée : ${errorText(e)}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 border-t border-slate-200 pt-4" aria-labelledby="photo-title">
      <h3 id="photo-title" className="text-sm font-semibold">
        Photo <span className="font-normal text-slate-500">(facultative)</span>
      </h3>
      <p className="text-xs text-slate-500">
        Ignorée par les ATS et déconseillée hors de France. Elle n'apparaît que si la case « Photo » du preset est
        cochée (feu orange T-ATS-16) et n'est jamais transmise à Claude. Recadrage 3:4, 600 × 800 px au plus, JPEG de
        300 Ko au plus, métadonnées (EXIF, GPS) supprimées.
      </p>
      {!identity ? (
        <p className="text-sm text-slate-600">Enregistrez d'abord l'identité pour ajouter une photo.</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            {url ? (
              <img src={url} alt="Photo actuelle" className="h-24 w-18 object-cover ring-1 ring-slate-300" />
            ) : (
              <span className="text-sm text-slate-500">{hasPhoto ? 'Chargement…' : 'Aucune photo.'}</span>
            )}
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Choisir une photo"
              onChange={(e) => {
                void choose(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className={buttonClass.secondary}
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              {hasPhoto ? 'Remplacer…' : 'Importer une photo…'}
            </button>
            {hasPhoto && (
              <button type="button" className={buttonClass.secondary} disabled={busy} onClick={() => void remove()}>
                Retirer
              </button>
            )}
          </div>
          {source && <Cropper source={source} onCancel={() => setSource(null)} onSave={(z) => void save(z)} />}
        </>
      )}
      {notice && (
        <p className={`text-sm ${notice.tone === 'ok' ? 'text-green-800' : 'text-red-800'}`} role="status">
          {notice.text}
        </p>
      )}
    </section>
  );
}
