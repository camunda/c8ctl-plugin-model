import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createModdle, createMinimalBpmn, saveFile } from '../bpmn.js';
import { writeState, stateExists } from '../state.js';
import type { CommandLogger } from '../logger.js';

export async function init(args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const name = args[0];
  if (!name) throw new Error('Usage: c8ctl model init <name>');

  const filePath = resolve(cwd, `${name}.bpmn`);

  if (existsSync(filePath)) {
    throw new Error(`File already exists: ${filePath}`);
  }
  if (stateExists()) {
    throw new Error(`A model is already active. Run 'c8ctl model reset' first.`);
  }

  const moddle = createModdle();
  const definitions = createMinimalBpmn(moddle, name);
  await saveFile(filePath, moddle, definitions);
  writeState({ file: filePath, cursor: 'StartEvent_1' });

  logger?.success(`Created ${name}.bpmn`);
  logger?.info(`Cursor: StartEvent_1`);
}
