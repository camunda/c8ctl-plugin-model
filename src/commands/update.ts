import { loadFile, saveFile, getElementById, updateElementProperty, renameElementId } from '../bpmn.js';
import { readState, writeState } from '../state.js';
import type { CommandLogger } from '../logger.js';
import { BPMN_ID_PATTERN } from './args.js';

// Known property-name patterns for the update command.
// Used to distinguish an explicit element-ID first arg from a property name.
function looksLikeProperty(s: string): boolean {
  if (/^(?:name|id|isInterrupting|documentation|signalRef|messageRef)$/.test(s)) return true;
  if (s.startsWith('zeebe:') || s.startsWith('timer.') ||
      s.startsWith('ad-hoc.') || s.startsWith('multi-instance.')) return true;
  return false;
}

export async function update(args: string[], cwd: string, logger?: CommandLogger): Promise<void> {
  const state = readState();
  const { moddle, definitions } = await loadFile(state.file);

  let targetId: string | undefined;
  let remaining = args;

  // If first positional looks like a BPMN ID (not a property name), has at
  // least 3 args (elementId + property + value), AND actually resolves to an
  // existing element, treat it as an explicit element target. The existence
  // check prevents mis-parsing `update name id verification` as
  // elementId="name", prop="id".
  if (args.length >= 3 && BPMN_ID_PATTERN.test(args[0]) && looksLikeProperty(args[1])
      && getElementById(definitions, args[0])) {
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

  const resolvedId = targetId ?? state.cursor;
  const el = getElementById(definitions, resolvedId);
  if (!el) throw new Error(`Element '${resolvedId}' not found`);

  if (prop === 'id') {
    if (values.length !== 1) {
      throw new Error('Usage: c8ctl model update [elementId] id <new-id>');
    }
    const newId = values[0];
    if (newId === (el.id as string)) {
      logger?.info(`ID '${resolvedId}' unchanged`);
      return;
    }
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
