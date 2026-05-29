import { loadFile, saveFile, getElementById, updateElementProperty, renameElementId } from '../bpmn.js';
import { readState, writeState } from '../state.js';
import type { CommandLogger } from '../logger.js';
import { ELEMENT_ID_PATTERN } from './args.js';

export async function update(args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  let targetId: string | undefined;
  let remaining = args;

  // If first positional matches element ID pattern, it's the explicit target
  if (args.length > 0 && ELEMENT_ID_PATTERN.test(args[0])) {
    targetId = args[0];
    remaining = args.slice(1);
  }

  const [prop, ...values] = remaining;
  if (!prop || values.length === 0) {
    throw new Error(
      'Usage: c8ctl model update [elementId] <property> <value...>\n' +
        'Properties: name, id, signalRef <name>, messageRef <name>,\n' +
        '            zeebe:taskDefinition.type, zeebe:taskDefinition.retries,\n' +
        '            zeebe:input <source> <target>, zeebe:output <source> <target>,\n' +
        '            zeebe:header <key> <value>, zeebe:property <name> <value>,\n' +
        '            timer.timeDuration <ISO-8601>, timer.timeCycle <ISO-8601>, timer.timeDate <ISO-8601>',
    );
  }

  const state = readState();
  const resolvedId = targetId ?? state.cursor;

  const { moddle, definitions } = await loadFile(state.file);
  const el = getElementById(definitions, resolvedId);
  if (!el) throw new Error(`Element '${resolvedId}' not found`);

  if (prop === 'id') {
    const newId = values[0];
    renameElementId(definitions, el, newId);
    await saveFile(state.file, moddle, definitions);
    const newState = state.cursor === resolvedId ? { ...state, cursor: newId } : state;
    writeState(newState);
    logger?.success(`Renamed ID '${resolvedId}' to '${newId}'`);
    logger?.info(`Cursor: ${newState.cursor}`);
  } else {
    updateElementProperty(moddle, el, prop, values, definitions, logger);
    await saveFile(state.file, moddle, definitions);
    logger?.success(`Updated '${prop}' on ${el.id}`);
  }
}
