#!/usr/bin/env node
// Entry point of the MCP server "cv" (stdio). Launched by Claude Code (.mcp.json) or Claude Desktop,
// locally or on the server of the online instance over SSH (ADR 0018).
// stdout carries only JSON-RPC messages; logs go to stderr (§7.6). Every request is journaled in
// out/logs/ (ADR 0024).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { MCP_LOG_DIR } from '@cv/core';
import { DataStore } from '@cv/store';
import { log } from './log.js';
import { LoggedTransport, peerFromEnv, RequestJournal } from './request-log.js';
import { resolveRoot } from './root.js';
import { createCvServer } from './server.js';

async function main(): Promise<void> {
  const resolved = resolveRoot();
  log(`racine du projet : ${resolved.root} (source : ${resolved.source})`);
  log(`données : ${resolved.dataDir}`);
  if (!existsSync(path.join(resolved.dataDir, 'profile.json'))) {
    log(`dossier de données introuvable : ${resolved.dataDir}. Lancez « npm run data:init » à la racine du projet.`);
    process.exit(1);
  }
  const server = createCvServer({
    dataDir: resolved.dataDir,
    outDir: resolved.outDir,
    importDir: resolved.importDir,
    uiPort: Number(process.env.CV_PORT ?? 4310),
    ...(process.env.CV_PUBLIC_ORIGIN ? { publicOrigin: process.env.CV_PUBLIC_ORIGIN.replace(/\/+$/, '') } : {}),
  });
  // Journal of the requests (ADR 0024), read in the « Journal MCP » screen of the interface.
  const store = DataStore.open(resolved.dataDir);
  const peer = peerFromEnv(process.env);
  const journal = new RequestJournal({
    dir: path.join(resolved.outDir, MCP_LOG_DIR),
    peer,
    identity: async () => (await store.loadProfile()).identity,
  });
  await server.connect(new LoggedTransport(new StdioServerTransport(), journal));
  log(
    `serveur MCP « cv » prêt (stdio) ; session ${journal.session}, ${peer.ip ? `client ${peer.ip}` : peer.via === 'ssh' ? 'client SSH sans adresse' : 'poste local'}`,
  );
}

main().catch((err: unknown) => {
  log(`arrêt sur erreur : ${(err as Error).stack ?? String(err)}`);
  process.exit(1);
});
