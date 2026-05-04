import { loadFile, saveFile, getElementById, updateElementProperty } from '../bpmn.js';
import { readState } from '../state.js';

const ELEMENT_ID_PATTERN = /^[A-Za-z]+_\d+$/;

export async function update(args: string[], cwd: string): Promise<void> {
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
        'Properties: name, zeebe:taskDefinition.type, zeebe:taskDefinition.retries,\n' +
        '            zeebe:input <source> <target>, zeebe:output <source> <target>,\n' +
        '            zeebe:header <key> <value>, zeebe:property <name> <value>',
    );
  }

  const state = readState(cwd);
  const resolvedId = targetId ?? state.cursor;

  const { moddle, definitions } = await loadFile(state.file);
  const el = getElementById(definitions, resolvedId);
  if (!el) throw new Error(`Element '${resolvedId}' not found`);

  updateElementProperty(moddle, el, prop, values);
  await saveFile(state.file, moddle, definitions);

  console.log(`Updated '${prop}' on ${el.id}`);
}
