import { connectElements, loadFile, saveFile } from '../bpmn.js';
import { readState, writeState } from '../state.js';
import type { CommandLogger } from '../logger.js';

export async function connect(args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const [sourceId, targetId, ...conditionParts] = args;
  if (!sourceId || !targetId) {
    throw new Error('Usage: c8ctl model connect <sourceId> <targetId> [conditionExpression]');
  }

  const conditionExpression = conditionParts.length > 0 ? conditionParts.join(' ') : undefined;
  const state = readState();

  const { moddle, definitions } = await loadFile(state.file);
  connectElements(moddle, definitions, sourceId, targetId, conditionExpression);
  await saveFile(state.file, moddle, definitions);

  writeState({ ...state, cursor: targetId });
  logger?.success(`Connected ${sourceId} → ${targetId}${conditionExpression ? ` [${conditionExpression}]` : ''}`);
  logger?.info(`Cursor: ${targetId}`);
}
