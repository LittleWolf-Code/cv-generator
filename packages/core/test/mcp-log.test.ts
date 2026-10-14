// Journal of the MCP requests (ADR 0024): contact check of a response, monthly file name, line schema.
import { describe, expect, it } from 'vitest';
import { findContactLeaks, mcpLogEntry, mcpLogFileName, MCP_LOG_FILE_RE } from '@cv/core';

const identity = { email: 'camille.martin@example.com', phone: '06 39 98 12 34' };

describe('findContactLeaks', () => {
  it('ne trouve rien dans une réponse masquée', () => {
    expect(findContactLeaks('{"email":"{{email}}","phone":"{{phone}}"}', identity)).toEqual([]);
  });

  it("trouve l'e-mail, quelle que soit la casse", () => {
    expect(findContactLeaks('écrire à Camille.Martin@Example.com', identity)).toEqual(['email']);
  });

  it('trouve le téléphone sous toutes ses formes', () => {
    for (const written of ['06 39 98 12 34', '0639981234', '+33 6 39 98 12 34', '06.39.98.12.34']) {
      expect(findContactLeaks(`tél. ${written}`, identity), written).toEqual(['phone']);
    }
  });

  it("ignore les autres numéros et l'absence d'identité", () => {
    expect(findContactLeaks('IEC 60601-1-2, 2019 - 2021, 01 23 45 67 89', identity)).toEqual([]);
    expect(findContactLeaks('camille.martin@example.com 06 39 98 12 34', { email: null, phone: null })).toEqual([]);
  });

  it('ne compare pas une valeur trop courte pour être un numéro', () => {
    expect(findContactLeaks('12 rue des Lilas', { phone: '12' })).toEqual([]);
  });
});

describe('fichier du journal', () => {
  it('un fichier par mois (UTC)', () => {
    const name = mcpLogFileName(new Date('2026-10-31T23:30:00Z'));
    expect(name).toBe('mcp-2026-10.jsonl');
    expect(MCP_LOG_FILE_RE.exec(name)?.[1]).toBe('2026-10');
  });

  it('valide une ligne', () => {
    const line = {
      v: 1,
      at: '2026-10-08T09:00:00.000Z',
      session: 'a1b2c3d4',
      seq: 3,
      ip: '203.0.113.7',
      via: 'ssh',
      client: 'claude-code 2.1.0',
      method: 'tools/call',
      name: 'get_overview',
      args: {},
      outcome: 'ok',
      code: null,
      ms: 12,
      bytes: 345,
      leaks: [],
    };
    expect(mcpLogEntry.safeParse(line).success).toBe(true);
    expect(mcpLogEntry.safeParse({ ...line, leaks: ['address'] }).success).toBe(false);
  });
});
