import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadFile, getProcess, getElementById } from '../bpmn.js';
import { readState, writeState, stateExists } from '../state.js';
import type { CommandLogger } from '../logger.js';

export async function selectFile(args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const name = args[0];
  if (!name) throw new Error('Usage: c8ctl model select-file <path>');

  const withExt = name.endsWith('.bpmn') ? name : `${name}.bpmn`;
  const filePath = resolve(cwd, withExt);

  if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const { definitions } = await loadFile(filePath);
  const process = getProcess(definitions);

  const existingCursor = stateExists() ? readState().cursor : undefined;

  let cursor = existingCursor && getElementById(definitions, existingCursor) ? existingCursor : undefined;
  if (!cursor) {
    const first = (process.flowElements ?? []).find(
      (e: { $type: string }) => e.$type !== 'bpmn:SequenceFlow',
    );
    if (!first) throw new Error(`No elements found in ${filePath}`);
    cursor = first.id as string;
    if (existingCursor) logger?.warn(`Cursor '${existingCursor}' not found in new file — reset to ${cursor}`);
  }

  writeState({ file: filePath, cursor });
  logger?.info(`File: ${filePath}`);
  logger?.info(`Cursor: ${cursor}`);
}
