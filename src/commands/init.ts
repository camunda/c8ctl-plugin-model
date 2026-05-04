import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createModdle, createMinimalBpmn, saveFile } from '../bpmn.js';
import { writeState, stateExists } from '../state.js';

export async function init(args: string[], cwd: string): Promise<void> {
  const name = args[0];
  if (!name) throw new Error('Usage: c8ctl model init <name>');

  const filePath = resolve(cwd, `${name}.bpmn`);

  if (existsSync(filePath)) {
    throw new Error(`File already exists: ${filePath}`);
  }
  if (stateExists(cwd)) {
    throw new Error(`A model is already active in this directory. Run 'c8ctl model reset' first.`);
  }

  const moddle = createModdle();
  const definitions = createMinimalBpmn(moddle, name);
  await saveFile(filePath, moddle, definitions);
  writeState(cwd, { file: filePath, cursor: 'StartEvent_1' });

  console.log(`Created ${name}.bpmn`);
  console.log(`Cursor: StartEvent_1`);
}
