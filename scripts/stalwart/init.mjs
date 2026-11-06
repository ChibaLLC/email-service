#!/usr/bin/env node

import { mkdir, writeFile, chown } from 'node:fs/promises';
import { buildStalwartArtifacts } from './config.mjs';

const configDir = process.env.STALWART_CONFIG_DIR || '/etc/stalwart';
await mkdir(configDir, { recursive: true });
const artifacts = buildStalwartArtifacts(process.env);
await writeFile(`${configDir}/datastore.json`, `${JSON.stringify(artifacts.config, null, 2)}\n`, 'utf8');
await writeFile(`${configDir}/bootstrap.json`, `${JSON.stringify(artifacts.bootstrap, null, 2)}\n`, { mode: 0o600 });
await writeFile(`${configDir}/apply-plan.ndjson`, `${artifacts.applyPlan.map(item => JSON.stringify(item)).join('\n')}\n`, 'utf8');
// Stalwart enters bootstrap only when config.json is absent. Never create or
// overwrite that live pointer; the bootstrap API writes it after initializing.
await chown(configDir, Number(process.env.STALWART_UID || 2000), Number(process.env.STALWART_UID || 2000));
console.log(`Wrote datastore template, bootstrap input, and safe settings plan to ${configDir}`);
console.log('After initial setup, run node /scripts/apply.mjs to apply and reload hostname/CORS settings.');
