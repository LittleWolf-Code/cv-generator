// Live updates (§8.4, F-PRO-05): the SSE stream is read with fetch, because EventSource cannot send
// the X-CV-Token header. Reconnects after an interruption (server restart, sleep).
import { signInAgainIfNeeded, token } from './api';

export interface DataChange {
  file: string;
  revision: number | null;
  deleted: boolean;
}

/** `rechargez la page`: the server restarted with a new token (NF-01), the page still holds the old one. */
export type LiveStatus = 'connexion' | 'en direct' | 'interrompu' | 'rechargez la page';

function parseFrame(frame: string): { event: string; data: string } {
  let event = 'message';
  const data: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }
  return { event, data: data.join('\n') };
}

export function subscribeEvents(
  onChange: (change: DataChange) => void,
  onStatus: (status: LiveStatus) => void,
): () => void {
  const controller = new AbortController();
  let retry: ReturnType<typeof setTimeout> | null = null;

  const connect = async () => {
    onStatus('connexion');
    try {
      const res = await fetch('/api/events', {
        headers: { 'X-CV-Token': token(), Accept: 'text/event-stream' },
        signal: controller.signal,
        cache: 'no-store',
      });
      signInAgainIfNeeded(res);
      if (res.status === 403 || res.status === 401) {
        onStatus('rechargez la page');
        return;
      }
      if (!res.ok || !res.body) throw new Error(`flux indisponible (${res.status})`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value.replace(/\r\n?/g, '\n');
        let end: number;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const frame = parseFrame(buffer.slice(0, end));
          buffer = buffer.slice(end + 2);
          if (frame.event === 'ready') onStatus('en direct');
          else if (frame.event === 'change') onChange(JSON.parse(frame.data) as DataChange);
        }
      }
    } catch {
      if (controller.signal.aborted) return;
    }
    if (controller.signal.aborted) return;
    onStatus('interrompu');
    retry = setTimeout(() => void connect(), 2000);
  };

  void connect();
  return () => {
    controller.abort();
    if (retry) clearTimeout(retry);
  };
}
