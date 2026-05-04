import type { C8ctlPluginRuntime } from '@camunda8/cli/runtime';
import { init } from './commands/init.js';
import { append } from './commands/append.js';
import { appendFreezeCursor } from './commands/append-freeze-cursor.js';
import { update } from './commands/update.js';
import { select } from './commands/select.js';
import { status } from './commands/status.js';
import { reset } from './commands/reset.js';
import { boundaryAppend } from './commands/boundary-append.js';
import { cursorStatus } from './commands/cursor-status.js';

const c8ctl = globalThis.c8ctl as C8ctlPluginRuntime;

export const metadata = {
  name: 'c8ctl-plugin-model',
  description: 'Build BPMN process models incrementally from the CLI',
  commands: {
    model: {
      description: 'Build a BPMN process model incrementally; cursor tracks the last-touched element',
      subcommands: [
        { name: 'init', description: 'Create a new process model' },
        { name: 'append', description: 'Append a BPMN element after cursor; cursor moves to new element' },
        { name: 'append-freeze-cursor', description: 'Append a BPMN element without moving the cursor' },
        { name: 'boundary-append', description: 'Attach a boundary event to an activity; cursor moves to new event' },
        { name: 'update', description: 'Update a BPMN or Zeebe property on the cursor element' },
        { name: 'select', description: 'Move the cursor to a specific element by ID' },
        { name: 'status', description: 'Print a compact JSON view of the semantic model' },
        { name: 'cursor-status', description: 'Print the current cursor element (id, type, name, file)' },
        { name: 'reset', description: 'Clear the cursor state file (keeps the .bpmn file)' },
      ],
      examples: [
        { command: 'c8ctl model init my-process', description: 'Create my-process.bpmn with a start event' },
        { command: 'c8ctl model append userTask "Review Application"', description: 'Append user task after cursor; cursor moves' },
        { command: 'c8ctl model append exclusiveGateway "Approved?"', description: 'Append gateway after cursor' },
        { command: 'c8ctl model append-freeze-cursor endEvent Rejected Gateway_1', description: 'Append end event from Gateway_1; cursor stays' },
        { command: 'c8ctl model boundary-append timer Timeout', description: 'Add interrupting timer boundary to cursor element' },
        { command: 'c8ctl model boundary-append non-interrupting-message Escalation Activity_1', description: 'Add non-interrupting message boundary to Activity_1' },
        { command: 'c8ctl model update zeebe:taskDefinition.type my-job-type', description: 'Set Zeebe job type on cursor element' },
        { command: 'c8ctl model update Activity_2 name "Send Approval"', description: 'Rename a specific element' },
        { command: 'c8ctl model update zeebe:input "=vars.x" localX', description: 'Add input mapping to cursor element' },
        { command: 'c8ctl model select Gateway_1', description: 'Move cursor to Gateway_1' },
        { command: 'c8ctl model status', description: 'Print compact JSON view of all elements and flows' },
        { command: 'c8ctl model cursor-status', description: 'Print current cursor element id, type and name' },
        { command: 'c8ctl model reset', description: 'Clear cursor state; .bpmn file is kept' },
      ],
    },
  },
};

export const commands = {
  model: async (args: string[]) => {
    const [subcommand, ...rest] = args;
    const cwd = c8ctl.cwd;

    try {
      switch (subcommand) {
        case 'init':
          await init(rest, cwd);
          break;
        case 'append':
          await append(rest, cwd);
          break;
        case 'append-freeze-cursor':
          await appendFreezeCursor(rest, cwd);
          break;
        case 'update':
          await update(rest, cwd);
          break;
        case 'select':
          await select(rest, cwd);
          break;
        case 'status':
          await status(rest, cwd);
          break;
        case 'cursor-status':
          await cursorStatus(rest, cwd);
          break;
        case 'reset':
          await reset(rest, cwd);
          break;
        case 'boundary-append':
          await boundaryAppend(rest, cwd);
          break;
        default:
          printHelp();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  },
};

function printHelp(): void {
  console.log(`c8ctl model — BPMN process modeler

Subcommands:
  init <name>                         Create a new process model
  append <type> <label> [sourceId]    Append element after cursor (or sourceId); cursor moves
  append-freeze-cursor <type> <label> Append element without moving the cursor
    [sourceId]                        Source element (defaults to cursor)
  update [elementId] <property> <value...>
                                      Update cursor element (or elementId) property
  select <id>                         Move cursor to element
  status                              Print compact JSON model view
  cursor-status                       Print current cursor element (id, type, name, file)
  reset                               Clear model cursor state (keeps .bpmn file)
  boundary-append <type> <label>      Attach boundary event to cursor element
    [hostElementId]                   Attach to specific element instead of cursor
                                      Cursor always moves to the new boundary event

Boundary event types:
  timer, error, message, signal, escalation, compensation, conditional, cancel
  Prefix with non-interrupting- for non-interrupting variants (where applicable)

Element types (append):
  startEvent, endEvent, task, userTask, serviceTask, scriptTask,
  exclusiveGateway, parallelGateway, inclusiveGateway, callActivity,
  subProcess, intermediateCatchEvent, intermediateThrowEvent

Update properties:
  name                                Element name
  zeebe:taskDefinition.type           Zeebe job type
  zeebe:taskDefinition.retries        Zeebe job retries
  zeebe:input <source> <target>       Add/update input mapping
  zeebe:output <source> <target>      Add/update output mapping
  zeebe:header <key> <value>          Add/update task header
  zeebe:property <name> <value>       Add/update Zeebe property`);
}
