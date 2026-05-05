# c8ctl-plugin-model

A [c8ctl](https://github.com/camunda/c8ctl) plugin for building BPMN process models incrementally from the CLI.

The plugin exposes a `model` command with subcommands for creating, navigating, and updating a BPMN file. A cursor tracks the last-touched element so that `append` and `update` work without supplying an element ID every time. The `.bpmn` file is always the source of truth; `.c8ctl-model.json` stores only the cursor position and active file path.

## Installation

```sh
c8ctl load plugin --from file://${PWD}
```

## Usage

```sh
c8ctl model <subcommand> [args]
```

### Subcommands

| Subcommand | Description |
| --- | --- |
| `init <name>` | Create a new process model |
| `append <type> <label> [sourceId]` | Append an element after cursor; cursor moves to new element |
| `append-freeze-cursor <type> <label> [sourceId]` | Append an element without moving the cursor |
| `boundary-append <type> <label> [hostId]` | Attach a boundary event to an activity; cursor moves to new event |
| `update [elementId] <property> <value...>` | Update a BPMN or Zeebe property on the cursor element |
| `select <elementId>` | Move the cursor to a specific element |
| `select-file <path>` | Switch the active BPMN file |
| `cursor-status` | Print the current cursor element |
| `status` | Print a compact JSON view of the semantic model |
| `reset` | Clear the cursor state file (keeps the `.bpmn` file) |

### Examples

```sh
c8ctl model init my-process
c8ctl model append user-task "Review Application"
c8ctl model append exclusive-gateway "Approved?"
c8ctl model append-freeze-cursor end-event Rejected Gateway_1
c8ctl model boundary-append timer Timeout
c8ctl model boundary-append non-interrupting-message Escalation Activity_1
c8ctl model update zeebe:taskDefinition.type my-job-type
c8ctl model update Activity_2 name "Send Approval"
c8ctl model update zeebe:input "=vars.x" localX
c8ctl model select Gateway_1
c8ctl model select-file other-process
c8ctl model cursor-status
c8ctl model status
c8ctl model reset
```

## Development

```sh
npm install
npm run build
npm test
```

## Coverage

### Element types — `append` / `append-freeze-cursor`

| Type | ID prefix |
| --- | --- |
| `start-event` | `StartEvent` |
| `end-event` | `EndEvent` |
| `message-end-event` | `EndEvent` |
| `signal-end-event` | `EndEvent` |
| `error-end-event` | `EndEvent` |
| `escalation-end-event` | `EndEvent` |
| `terminate-end-event` | `EndEvent` |
| `compensation-end-event` | `EndEvent` |
| `cancel-end-event` | `EndEvent` |
| `task` | `Activity` |
| `user-task` | `Activity` |
| `service-task` | `Activity` |
| `script-task` | `Activity` |
| `exclusive-gateway` | `Gateway` |
| `parallel-gateway` | `Gateway` |
| `inclusive-gateway` | `Gateway` |
| `call-activity` | `Activity` |
| `sub-process` | `Activity` |
| `intermediate-catch-event` | `Event` |
| `timer-intermediate-catch-event` | `Event` |
| `message-intermediate-catch-event` | `Event` |
| `signal-intermediate-catch-event` | `Event` |
| `conditional-intermediate-catch-event` | `Event` |
| `link-intermediate-catch-event` | `Event` |
| `intermediate-throw-event` | `Event` |
| `message-intermediate-throw-event` | `Event` |
| `signal-intermediate-throw-event` | `Event` |
| `escalation-intermediate-throw-event` | `Event` |
| `compensation-intermediate-throw-event` | `Event` |
| `link-intermediate-throw-event` | `Event` |

### Boundary event types — `boundary-append`

| Type | Interrupting |
| --- | --- |
| `timer` | yes (default) |
| `non-interrupting-timer` | no |
| `error` | always |
| `message` | yes (default) |
| `non-interrupting-message` | no |
| `signal` | yes (default) |
| `non-interrupting-signal` | no |
| `escalation` | yes (default) |
| `non-interrupting-escalation` | no |
| `non-interrupting-compensation` | always |
| `conditional` | yes (default) |
| `non-interrupting-conditional` | no |
| `cancel` | always |

Host element must be an activity (`task`, `user-task`, `service-task`, `script-task`, `call-activity`, `sub-process`, etc.). Gateways and events are rejected.

### Update properties — `update`

| Property | Value args | Upsert key |
| --- | --- | --- |
| `name` | `<name>` | — |
| `zeebe:taskDefinition.type` | `<type>` | — |
| `zeebe:taskDefinition.retries` | `<count>` | — |
| `zeebe:input` | `<source> <target>` | target |
| `zeebe:output` | `<source> <target>` | source |
| `zeebe:header` | `<key> <value>` | key |
| `zeebe:property` | `<name> <value>` | name |

### Command behavior summary

| Command | Supported inputs | Notes |
| --- | --- | --- |
| `model init` | — | Creates process + `StartEvent_1`; throws if `.bpmn` or state already exists |
| `model select` | any element id | Validates existence; throws if not found |
| `model select-file` | name or path | Auto-appends `.bpmn`; cursor preserved if element exists in new file, reset to first element otherwise |
| `model cursor-status` | — | JSON: `cursor`, `type`, `name`, `file` |
| `model status` | — | JSON: elements + flows + Zeebe extensions |
| `model reset` | — | Removes state file; keeps `.bpmn` |
