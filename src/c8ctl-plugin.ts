import type { C8ctlPluginRuntime } from '@camunda8/cli/runtime';
import { init } from './commands/init.js';
import { append } from './commands/append.js';
import { create } from './commands/create.js';
import { connect } from './commands/connect.js';
import { update } from './commands/update.js';
import { select } from './commands/select.js';
import { status } from './commands/status.js';
import { reset } from './commands/reset.js';
import { cursorStatus } from './commands/cursor-status.js';
import { selectFile } from './commands/select-file.js';
import { annotate } from './commands/annotate.js';
import { document } from './commands/document.js';

const c8ctl = globalThis.c8ctl as C8ctlPluginRuntime;

export const metadata = {
  name: 'c8ctl-plugin-model',
  description: 'Build BPMN process models incrementally from the CLI',
  commands: {
    model: {
      description: 'Build a BPMN process model incrementally; cursor tracks the last-touched element',
      subcommands: [
        { name: 'init', description: 'Create a new process model' },
        { name: 'append', description: 'Append a BPMN element after cursor; --boundary for boundary events; --freeze-cursor to keep cursor; --name for label' },
        { name: 'create', description: 'Create a standalone element (no sequence flow); --parent to add inside cursor sub-process; --freeze-cursor to keep cursor' },
        { name: 'connect', description: 'Create a sequence flow between two elements; cursor moves to target' },
        { name: 'annotate', description: 'Add a text annotation artifact to an element' },
        { name: 'document', description: 'Set the bpmn:documentation docstring on an element' },
        { name: 'update', description: 'Update a BPMN or Zeebe property on the cursor element (positional or flag style)' },
        { name: 'select', description: 'Move the cursor to a specific element by ID; --parent to move to parent sub-process' },
        { name: 'status', description: 'Print a compact JSON view of the semantic model' },
        { name: 'cursor-status', description: 'Print the current cursor element (id, type, name, file)' },
        { name: 'select-file', description: 'Switch the active BPMN file; cursor is preserved or reset to first element' },
        { name: 'reset', description: 'Clear the cursor state file (keeps the .bpmn file)' },
      ],
      examples: [
        { command: 'c8ctl model init my-process', description: 'Create my-process.bpmn with a start event' },
        { command: 'c8ctl model append user-task "Review Application"', description: 'Append user task after cursor; cursor moves' },
        { command: 'c8ctl model append exclusive-gateway "Approved?"', description: 'Append gateway after cursor' },
        { command: 'c8ctl model append end-event Rejected Gateway_1 --freeze-cursor', description: 'Append end event from Gateway_1; cursor stays' },
        { command: 'c8ctl model append --boundary timer Timeout', description: 'Add interrupting timer boundary to cursor element' },
        { command: 'c8ctl model append --boundary non-interrupting-message Escalation Activity_1', description: 'Add non-interrupting message boundary to Activity_1' },
        { command: 'c8ctl model create event-sub-process "Handle Error"', description: 'Create event sub-process with no incoming flow; cursor moves' },
        { command: 'c8ctl model create end-event "Alternate End" --freeze-cursor', description: 'Create standalone end event; cursor stays' },
        { command: 'c8ctl model create start-event Start --parent', description: 'Add start event inside cursor sub-process; cursor moves' },
        { command: 'c8ctl model create end-event End --parent --freeze-cursor', description: 'Add end event inside cursor sub-process; cursor stays' },
        { command: 'c8ctl model select --parent', description: 'Move cursor to the parent sub-process of the current element' },
        { command: 'c8ctl model connect Gateway_1 EndEvent_1 "=approved"', description: 'Connect Gateway_1 to EndEvent_1 with condition' },
        { command: 'c8ctl model annotate "Must complete within 24h" Activity_1', description: 'Add text annotation to Activity_1' },
        { command: 'c8ctl model document "Reviewer must approve within 24h" Activity_1', description: 'Set bpmn:documentation on Activity_1' },
        { command: 'c8ctl model document --format text/markdown "**Important**" Activity_1', description: 'Set markdown documentation on Activity_1' },
        { command: 'c8ctl model update zeebe:taskDefinition.type my-job-type', description: 'Set Zeebe job type on cursor element (positional style)' },
        { command: 'c8ctl model update --task-type my-job-type', description: 'Set Zeebe job type on cursor element (flag style)' },
        { command: 'c8ctl model update Activity_2 --name "Send Approval"', description: 'Rename a specific element' },
        { command: 'c8ctl model update --input "=vars.x" localX --input "=vars.y" localY', description: 'Add multiple input mappings to cursor element' },
        { command: 'c8ctl model update --assignee "=user.name" --due-date "=now()"', description: 'Set user task assignment and due date' },
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
    const logger = c8ctl.getLogger();

    try {
      switch (subcommand) {
        case 'init':
          await init(rest, cwd, logger);
          break;
        case 'append':
          await append(rest, cwd, logger);
          break;
        case 'create':
          await create(rest, cwd, logger);
          break;
        case 'connect':
          await connect(rest, cwd, logger);
          break;
        case 'update':
          await update(rest, cwd, logger);
          break;
        case 'select':
          await select(rest, cwd, logger);
          break;
        case 'status':
          await status(rest, cwd, logger);
          break;
        case 'cursor-status':
          await cursorStatus(rest, cwd, logger);
          break;
        case 'select-file':
          await selectFile(rest, cwd, logger);
          break;
        case 'reset':
          await reset(rest, cwd, logger);
          break;
        case 'annotate':
          await annotate(rest, cwd, logger);
          break;
        case 'document':
          await document(rest, cwd, logger);
          break;
        default:
          printHelp(logger);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(message);
      process.exit(1);
    }
  },
};

function printHelp(logger: ReturnType<typeof c8ctl.getLogger>): void {
  logger.output(`c8ctl model — BPMN process modeler

Subcommands:
  init <name>                          Create a new process model
  append <type> [label] [sourceId]     Append element after cursor (or sourceId); cursor moves
    --name <label>                     Element label (alternative to positional)
    --freeze-cursor                    Keep cursor on current element after append
    --boundary                         Attach as boundary event to host element
    --id <id>                          Set custom element ID
  create <type> [label]                Create standalone element (no flow); cursor moves
    --name <label>                     Element label (alternative to positional)
    --parent                           Add inside cursor sub-process instead of process root
    --freeze-cursor                    Keep cursor on current element after create
    --id <id>                          Set custom element ID
  connect <sourceId> <targetId>        Create sequence flow; cursor moves to target
    [conditionExpression]              Optional FEEL condition on the flow
  update [elementId] <property> <value...>
                                       Update cursor element (or elementId) property
  update [elementId] --<flag> <value>  Update using flag style (see flags below)
  select <id>                          Move cursor to element by ID
  select --parent                      Move cursor to parent sub-process of active element
  status                               Print compact JSON model view
  cursor-status                        Print current cursor element (id, type, name, file)
  select-file <path>                   Switch the active BPMN file; cursor preserved or reset
  reset                                Clear model cursor state (keeps .bpmn file)
  annotate <text> [elementId]          Add text annotation to cursor element (or elementId)
  document <text> [elementId]          Set bpmn:documentation on cursor element (or elementId)
    [--format <mime>]                  Optional textFormat attribute (e.g. text/markdown)

Boundary event types (append --boundary):
  timer, error, message, signal, escalation, compensation, conditional, cancel
  Prefix with non-interrupting- for non-interrupting variants (where applicable)

Signal/message flags (append / create):
  --signal-name <name>                 Set signalRef inline (auto-declares bpmn:Signal)
  --message-name <name>                Set messageRef inline (auto-declares bpmn:Message)

Element types (append / create):
  start-event, end-event, task, user-task, service-task, script-task,
  exclusive-gateway, parallel-gateway, inclusive-gateway, event-based-gateway, call-activity,
  sub-process, ad-hoc-sub-process, event-sub-process

Zeebe property flags (append / create / update):
  --task-type <type>                   zeebe:taskDefinition.type
  --task-retries <n>                   zeebe:taskDefinition.retries
  --input <source=target>              zeebe:input (repeatable)
  --output <source=target>             zeebe:output (repeatable)
  --header <key=value>                 zeebe:header (repeatable)
  --ext-property <name=value>          zeebe:property (repeatable)
  --assignee <expr>                    zeebe:assignmentDefinition.assignee
  --candidate-groups <expr>            zeebe:assignmentDefinition.candidateGroups
  --candidate-users <expr>             zeebe:assignmentDefinition.candidateUsers
  --due-date <expr>                    zeebe:taskSchedule.dueDate
  --follow-up-date <expr>              zeebe:taskSchedule.followUpDate
  --priority <expr>                    zeebe:priorityDefinition.priority
  --user-task-disabled <true|false>    zeebe:userTask.disabled
  --form-id <id>                       zeebe:formDefinition.formId
  --form-key <key>                     zeebe:formDefinition.formKey
  --form-external-ref <ref>            zeebe:formDefinition.externalReference
  --form-binding-type <type>           zeebe:formDefinition.bindingType
  --form-version-tag <tag>             zeebe:formDefinition.versionTag
  --script-expression <expr>           zeebe:script.expression
  --script-result-var <name>           zeebe:script.resultVariable
  --decision-id <id>                   zeebe:calledDecision.decisionId
  --decision-result <var>              zeebe:calledDecision.resultVariable
  --decision-binding-type <type>       zeebe:calledDecision.bindingType
  --decision-version-tag <tag>         zeebe:calledDecision.versionTag
  --called-process-id <id>             zeebe:calledElement.processId
  --called-process-id-expr <expr>      zeebe:calledElement.processIdExpression
  --propagate-all-child-vars <bool>    zeebe:calledElement.propagateAllChildVariables
  --propagate-all-parent-vars <bool>   zeebe:calledElement.propagateAllParentVariables
  --called-binding-type <type>         zeebe:calledElement.bindingType
  --called-version-tag <tag>           zeebe:calledElement.versionTag
  --execution-listener <eventType=type>  zeebe:executionListener (repeatable)
  --task-listener <eventType=type>     zeebe:taskListener (repeatable, user-task only)
  --signal-name <name>                 signalRef
  --message-name <name>                messageRef
  --correlation-key <expr>             zeebe:subscription.correlationKey
  --is-interrupting <true|false>       isInterrupting
  --time-duration <ISO>                timer.timeDuration
  --time-cycle <ISO>                   timer.timeCycle
  --time-date <ISO>                    timer.timeDate
  --condition-variable-names <names>   zeebe:conditionalFilter.variableNames
  --condition-variable-events <events> zeebe:conditionalFilter.variableEvents
  --multi-instance <parallel|sequential>  multi-instance.type
  --loop-input-collection <expr>       zeebe:loopCharacteristics.inputCollection
  --loop-input-element <expr>          zeebe:loopCharacteristics.inputElement
  --loop-output-collection <expr>      zeebe:loopCharacteristics.outputCollection
  --loop-output-element <expr>         zeebe:loopCharacteristics.outputElement
  --linked-resource <resourceId=resourceType>  zeebe:linkedResource (repeatable)
  --adhoc-ordering <Sequential|Parallel>  ad-hoc.ordering
  --adhoc-cancel-remaining <true|false>   ad-hoc.cancelRemainingInstances
  --adhoc-output-collection <expr>     zeebe:adHoc.outputCollection
  --adhoc-output-element <expr>        zeebe:adHoc.outputElement
  --adhoc-active-elements <expr>       zeebe:adHoc.activeElementsCollection

Update properties (positional style):
  name                                 Element name
  id <new-id>                          Rename element ID
  signalRef <signalName>               Set/change signal reference on signal events
  messageRef <messageName>             Set/change message reference on message events
  isInterrupting <true|false>          Set interrupting flag on start events
  zeebe:taskDefinition.type            Zeebe job type
  zeebe:taskDefinition.retries         Zeebe job retries
  zeebe:input <source> <target>        Add/update input mapping
  zeebe:output <source> <target>       Add/update output mapping
  zeebe:header <key> <value>           Add/update task header
  zeebe:property <name> <value>        Add/update Zeebe property
  multi-instance.type <parallel|sequential>
  zeebe:loopCharacteristics.inputCollection <expr>
  zeebe:loopCharacteristics.inputElement <var>
  zeebe:loopCharacteristics.outputCollection <var>
  zeebe:loopCharacteristics.outputElement <expr>
  ad-hoc.ordering <Sequential|Parallel>
  ad-hoc.cancelRemainingInstances <true|false>
  timer.timeDuration <ISO-8601>
  timer.timeCycle <ISO-8601>
  timer.timeDate <ISO-8601>`);
}
