import type { C8ctlPluginRuntime } from '@camunda8/cli/runtime';
import { init } from './commands/init.js';
import { append } from './commands/append.js';
import { appendFreezeCursor } from './commands/append-freeze-cursor.js';
import { update } from './commands/update.js';
import { select } from './commands/select.js';
import { status } from './commands/status.js';
import { reset } from './commands/reset.js';
import { boundaryAppend } from './commands/boundary-append.js';

const c8ctl = globalThis.c8ctl as C8ctlPluginRuntime;

export const metadata = {
  name: 'c8ctl-plugin-model',
  description: 'Build BPMN process models incrementally from the CLI',
  commands: {
    model: {
      description: 'Model a BPMN process from the CLI',
      examples: [
        { command: 'c8ctl model init my-process', description: 'Create a new process model' },
        { command: 'c8ctl model append userTask "Review"', description: 'Append a task after cursor; cursor moves to new element' },
        { command: 'c8ctl model append-freeze-cursor endEvent Done Gateway_1', description: 'Append from Gateway_1 without moving cursor' },
        { command: 'c8ctl model update zeebe:taskDefinition.type my-job', description: 'Set job type on cursor element' },
        { command: 'c8ctl model update Activity_2 name "New Name"', description: 'Set name on a specific element' },
        { command: 'c8ctl model select Task_1', description: 'Move cursor to element' },
        { command: 'c8ctl model status', description: 'Print compact JSON model view' },
        { command: 'c8ctl model reset', description: 'Clear model cursor state' },
        { command: 'c8ctl model boundary-append timer Timeout', description: 'Add interrupting timer boundary event to cursor element' },
        { command: 'c8ctl model boundary-append non-interrupting-message Escalation Activity_1', description: 'Add non-interrupting boundary event to specific element' },
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
