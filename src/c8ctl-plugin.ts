import type { C8ctlPluginRuntime } from '@camunda8/cli/runtime';
import { init } from './commands/init.js';
import { append } from './commands/append.js';
import { appendFreezeCursor } from './commands/append-freeze-cursor.js';
import { addChild } from './commands/add-child.js';
import { addChildFreezeCursor } from './commands/add-child-freeze-cursor.js';
import { selectParent } from './commands/select-parent.js';
import { create } from './commands/create.js';
import { createFreezeCursor } from './commands/create-freeze-cursor.js';
import { connect } from './commands/connect.js';
import { update } from './commands/update.js';
import { select } from './commands/select.js';
import { status } from './commands/status.js';
import { reset } from './commands/reset.js';
import { boundaryAppend } from './commands/boundary-append.js';
import { cursorStatus } from './commands/cursor-status.js';
import { selectFile } from './commands/select-file.js';

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
        { name: 'create', description: 'Create a standalone element (no sequence flow); cursor moves to new element' },
        { name: 'create-freeze-cursor', description: 'Create a standalone element without moving the cursor' },
        { name: 'connect', description: 'Create a sequence flow between two elements; cursor moves to target' },
        { name: 'add-child', description: 'Add a child element inside the cursor sub-process; cursor moves to new element' },
        { name: 'add-child-freeze-cursor', description: 'Add a child element inside the cursor sub-process without moving the cursor' },
        { name: 'select-parent', description: 'Move the cursor to the parent sub-process of the active element' },
        { name: 'boundary-append', description: 'Attach a boundary event to an activity; cursor moves to new event' },
        { name: 'update', description: 'Update a BPMN or Zeebe property on the cursor element' },
        { name: 'select', description: 'Move the cursor to a specific element by ID' },
        { name: 'status', description: 'Print a compact JSON view of the semantic model' },
        { name: 'cursor-status', description: 'Print the current cursor element (id, type, name, file)' },
        { name: 'select-file', description: 'Switch the active BPMN file; cursor is preserved or reset to first element' },
        { name: 'reset', description: 'Clear the cursor state file (keeps the .bpmn file)' },
      ],
      examples: [
        { command: 'c8ctl model init my-process', description: 'Create my-process.bpmn with a start event' },
        { command: 'c8ctl model append user-task "Review Application"', description: 'Append user task after cursor; cursor moves' },
        { command: 'c8ctl model append exclusive-gateway "Approved?"', description: 'Append gateway after cursor' },
        { command: 'c8ctl model append-freeze-cursor end-event Rejected Gateway_1', description: 'Append end event from Gateway_1; cursor stays' },
        { command: 'c8ctl model create event-sub-process "Handle Error"', description: 'Create event sub-process with no incoming flow; cursor moves' },
        { command: 'c8ctl model create-freeze-cursor end-event "Alternate End"', description: 'Create standalone end event; cursor stays' },
        { command: 'c8ctl model connect Gateway_1 EndEvent_1 "=approved"', description: 'Connect Gateway_1 to EndEvent_1 with condition' },
        { command: 'c8ctl model add-child start-event Start', description: 'Add start event inside cursor sub-process; cursor moves to new element' },
        { command: 'c8ctl model add-child-freeze-cursor end-event End', description: 'Add end event inside cursor sub-process; cursor stays' },
        { command: 'c8ctl model select-parent', description: 'Move cursor to the parent sub-process of the current element' },
        { command: 'c8ctl model boundary-append timer Timeout', description: 'Add interrupting timer boundary to cursor element' },
        { command: 'c8ctl model boundary-append non-interrupting-message Escalation Activity_1', description: 'Add non-interrupting message boundary to Activity_1' },
        { command: 'c8ctl model update zeebe:taskDefinition.type my-job-type', description: 'Set Zeebe job type on cursor element' },
        { command: 'c8ctl model update Activity_2 name "Send Approval"', description: 'Rename a specific element' },
        { command: 'c8ctl model update zeebe:input "=vars.x" localX', description: 'Add input mapping to cursor element' },
        { command: 'c8ctl model select Gateway_1', description: 'Move cursor to Gateway_1' },
        { command: 'c8ctl model status', description: 'Print compact JSON view of all elements and flows' },
        { command: 'c8ctl model cursor-status', description: 'Print current cursor element id, type and name' },
        { command: 'c8ctl model select-file other-process', description: 'Switch active file to other-process.bpmn; cursor preserved or reset' },
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
        case 'create':
          await create(rest, cwd);
          break;
        case 'create-freeze-cursor':
          await createFreezeCursor(rest, cwd);
          break;
        case 'connect':
          await connect(rest, cwd);
          break;
        case 'add-child':
          await addChild(rest, cwd);
          break;
        case 'add-child-freeze-cursor':
          await addChildFreezeCursor(rest, cwd);
          break;
        case 'select-parent':
          await selectParent(rest, cwd);
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
        case 'select-file':
          await selectFile(rest, cwd);
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
  create <type> <label>               Create standalone element (no flow); cursor moves
  create-freeze-cursor <type> <label> Create standalone element; cursor stays
  connect <sourceId> <targetId>       Create sequence flow; cursor moves to target
    [conditionExpression]             Optional FEEL condition on the flow
  add-child <type> <label>            Add child element inside cursor sub-process; cursor moves
  add-child-freeze-cursor <type>      Add child element inside cursor sub-process; cursor stays
    <label>
  select-parent                       Move cursor to parent sub-process of active element
  update [elementId] <property> <value...>
                                      Update cursor element (or elementId) property
  select <id>                         Move cursor to element
  status                              Print compact JSON model view
  cursor-status                       Print current cursor element (id, type, name, file)
  select-file <path>                  Switch the active BPMN file; cursor preserved or reset to first element
  reset                               Clear model cursor state (keeps .bpmn file)
  boundary-append <type> <label>      Attach boundary event to cursor element
    [hostElementId]                   Attach to specific element instead of cursor
                                      Cursor always moves to the new boundary event

Boundary event types:
  timer, error, message, signal, escalation, compensation, conditional, cancel
  Prefix with non-interrupting- for non-interrupting variants (where applicable)

Element types (append / create):
  start-event, end-event, task, user-task, service-task, script-task,
  exclusive-gateway, parallel-gateway, inclusive-gateway, event-based-gateway, call-activity,
  sub-process, ad-hoc-sub-process, intermediate-catch-event, intermediate-throw-event
  event-sub-process                   Sub-process with triggeredByEvent=true (use create)

Typed start events (append / create):
  timer-start-event, message-start-event, signal-start-event,
  error-start-event, escalation-start-event, compensation-start-event,
  conditional-start-event

Typed intermediate catch events (append / create):
  timer-intermediate-catch-event, message-intermediate-catch-event,
  signal-intermediate-catch-event, conditional-intermediate-catch-event,
  link-intermediate-catch-event

Typed intermediate throw events (append / create):
  message-intermediate-throw-event, signal-intermediate-throw-event,
  escalation-intermediate-throw-event, compensation-intermediate-throw-event,
  link-intermediate-throw-event

Typed end events (append / create):
  message-end-event, signal-end-event, error-end-event, escalation-end-event,
  terminate-end-event, compensation-end-event, cancel-end-event

Update properties:
  name                                Element name
  isInterrupting <true|false>         Set interrupting flag on start events
  zeebe:taskDefinition.type           Zeebe job type
  zeebe:taskDefinition.retries        Zeebe job retries
  zeebe:input <source> <target>       Add/update input mapping
  zeebe:output <source> <target>      Add/update output mapping
  zeebe:header <key> <value>          Add/update task header
  zeebe:property <name> <value>       Add/update Zeebe property
  multi-instance.type <parallel|sequential>
                                      Set multi-instance loop (set before zeebe loop props)
  zeebe:loopCharacteristics.inputCollection <expr>
  zeebe:loopCharacteristics.inputElement <var>
  zeebe:loopCharacteristics.outputCollection <var>
  zeebe:loopCharacteristics.outputElement <expr>
  ad-hoc.ordering <Sequential|Parallel>
                                      Only on ad-hoc-sub-process elements
  ad-hoc.cancelRemainingInstances <true|false>
                                      Only on ad-hoc-sub-process elements (default true)`);
}
