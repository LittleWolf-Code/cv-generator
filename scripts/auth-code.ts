// `npm run auth:code`: one-time code to register a security key on the sign-in page of the online
// instance (ADR 0018). Run on the server, over SSH: only the person who can open an SSH session (with
// the YubiKey) can read it. Valid 15 minutes, 5 attempts; a new code replaces the previous one.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEnrolmentCode } from '@cv/server';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));

async function main(): Promise<void> {
  const override = process.env.CV_AUTH_DIR;
  if (override && !path.isAbsolute(override)) throw new Error(`CV_AUTH_DIR doit être un chemin absolu : ${override}`);
  const { code, expiresAt } = await createEnrolmentCode(override ?? path.join(ROOT, 'auth'));
  console.log(`Code d'enregistrement : ${code}`);
  console.log(
    `Valable 15 minutes (jusqu'à ${expiresAt.toISOString().slice(11, 16)} UTC), une seule fois, 5 essais au plus.`,
  );
  console.log(
    `À saisir sur la page de connexion${process.env.CV_PUBLIC_ORIGIN ? ` : ${process.env.CV_PUBLIC_ORIGIN}/connexion` : ''}.`,
  );
}

main().catch((err: unknown) => {
  console.error(`auth:code : ${(err as Error).message}`);
  process.exit(1);
});
