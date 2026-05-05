import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadFile, getProcess, getElementById } from '../bpmn.js';
import { readState, writeState } from '../state.js';
import type { CommandLogger } from '../logger.js';

export async function selectFile(args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const name = args[0];
  if (!name) throw new Error('Usage: c8ctl model select-file <path>');

  const withExt = name.endsWith('.bpmn') ? name : `${name}.bpmn`;
  const filePath = resolve(cwd, withExt);

  if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const { definitions } = await loadFile(filePath);
  const process = getProcess(definitions);

  const state = readState(cwd);

  let cursor = state.cursor;
  if (!getElementById(definitions, cursor)) {
    const first = (process.flowElements ?? []).find(
      (e: { $type: string }) => e.$type !== 'bpmn:SequenceFlow',
    );
    if (!first) throw new Error(`No elements found in ${filePath}`);
    cursor = first.id as string;
    logger?.warn(`Cursor '${state.cursor}' not found in new file — reset to ${cursor}`);
  }

  writeState(cwd, { file: filePath, cursor });
  logger?.info(`File: ${filePath}`);
  logger?.info(`Cursor: ${cursor}`);
}
