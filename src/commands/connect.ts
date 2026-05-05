import { connectElements, loadFile, saveFile } from '../bpmn.js';
import { readState, writeState } from '../state.js';

export async function connect(args: string[], cwd: string): Promise<void> {
  const [sourceId, targetId, ...conditionParts] = args;
  if (!sourceId || !targetId) {
    throw new Error('Usage: c8ctl model connect <sourceId> <targetId> [conditionExpression]');
  }

  const conditionExpression = conditionParts.length > 0 ? conditionParts.join(' ') : undefined;
  const state = readState(cwd);

  const { moddle, definitions } = await loadFile(state.file);
  connectElements(moddle, definitions, sourceId, targetId, conditionExpression);
  await saveFile(state.file, moddle, definitions);

  writeState(cwd, { ...state, cursor: targetId });
  console.log(`Connected ${sourceId} → ${targetId}${conditionExpression ? ` [${conditionExpression}]` : ''}`);
  console.log(`Cursor: ${targetId}`);
}
