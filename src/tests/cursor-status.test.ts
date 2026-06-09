import { test } from 'node:test';
import assert from 'node:assert/strict';
import { append } from '../commands/append.js';
import { cursorStatus } from '../commands/cursor-status.js';
import { loadFile, toStatusJson } from '../bpmn.js';
import { readState } from '../state.js';
import { tmpDir, cleanup, setupModel } from './helpers.js';

async function getCursorStatus(cwd: string): Promise<Record<string, unknown>> {
  const state = readState();
  const { definitions } = await loadFile(state.file);
  const { getElementById } = await import('../bpmn.js');
  const el = getElementById(definitions, state.cursor);
  const type = el ? (el.$type as string).replace('bpmn:', '') : 'unknown';
  const name = el?.name ?? '';
  return { cursor: state.cursor, type, name, file: state.file };
}

test('cursor-status shows StartEvent_1 after init', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    const cs = await getCursorStatus(cwd);
    assert.equal(cs['cursor'], 'StartEvent_1');
    assert.equal(cs['type'], 'StartEvent');
    assert.equal(cs['name'], 'Start');
    assert.ok((cs['file'] as string).endsWith('proc.bpmn'));
  } finally {
    cleanup(cwd);
  }
});

test('cursor-status reflects cursor after append', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);
    await append(['user-task', 'Review'], cwd);
    const cs = await getCursorStatus(cwd);
    assert.equal(cs['cursor'], 'Activity_1');
    assert.equal(cs['type'], 'UserTask');
    assert.equal(cs['name'], 'Review');
  } finally {
    cleanup(cwd);
  }
});

test('cursor-status output is valid JSON with required fields', async () => {
  const cwd = tmpDir();
  try {
    await setupModel('proc', cwd);

    const captured: unknown[] = [];
    const logger = {
      info() {}, warn() {}, error() {}, success() {}, output() {},
      json(data: unknown) { captured.push(data); },
    };
    await cursorStatus([], cwd, logger);

    assert.equal(captured.length, 1);
    const output = captured[0] as Record<string, unknown>;
    assert.ok('cursor' in output);
    assert.ok('type' in output);
    assert.ok('name' in output);
    assert.ok('file' in output);
  } finally {
    cleanup(cwd);
  }
});

test('cursor-status throws when no model is initialized', async () => {
  const cwd = tmpDir();
  try {
    await assert.rejects(() => cursorStatus([], cwd), /No model found/);
  } finally {
    cleanup(cwd);
  }
});
