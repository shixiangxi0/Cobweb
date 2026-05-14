import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CheckpointStore } from '../../../../../clients/ink-cli/CheckpointStore.js';

const TEST_FILE = resolve('test-checkpoint-store.json');

describe('CheckpointStore', () => {
  beforeEach(() => {
    if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
  });

  afterEach(() => {
    if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
  });

  it('round-trips a snapshot through memory', async () => {
    const store = new CheckpointStore({ filePath: TEST_FILE });
    const snapshot = { phase: 'battle', turn: 3, player: { hp: 50 } };

    await store.saveSlot(0, { snapshot, name: '05m30s', playTime: 330000, turn: 3 });

    const loaded = await store.loadSlot(0);
    expect(loaded).toEqual(snapshot);
  });

  it('round-trips a snapshot through the file system', async () => {
    const storeA = new CheckpointStore({ filePath: TEST_FILE });
    const snapshot = { phase: 'battle', turn: 1, run: { gold: 100 } };

    await storeA.saveSlot(1, { snapshot, name: '02m15s', playTime: 135000, turn: 1 });

    // Simulate process restart: new store instance reading the same file
    const storeB = new CheckpointStore({ filePath: TEST_FILE });
    const loaded = await storeB.loadSlot(1);
    expect(loaded).toEqual(snapshot);
  });

  it('returns null for an empty slot', async () => {
    const store = new CheckpointStore({ filePath: TEST_FILE });
    const loaded = await store.loadSlot(0);
    expect(loaded).toBeNull();
  });

  it('returns null for out-of-range slots', async () => {
    const store = new CheckpointStore({ filePath: TEST_FILE });
    expect(await store.loadSlot(-1)).toBeNull();
    expect(await store.loadSlot(5)).toBeNull();
  });

  it('lists all slots with metadata', async () => {
    const store = new CheckpointStore({ filePath: TEST_FILE });
    await store.saveSlot(0, { snapshot: { turn: 1 }, name: '01m00s', playTime: 60000, turn: 1 });
    await store.saveSlot(2, { snapshot: { turn: 5 }, name: '10m00s', playTime: 600000, turn: 5 });

    const list = store.list();
    expect(list[0]).toMatchObject({ index: 0, name: '01m00s', playTime: 60000, turn: 1 });
    expect(list[1]).toBeNull();
    expect(list[2]).toMatchObject({ index: 2, name: '10m00s', playTime: 600000, turn: 5 });
  });

  it('overwrites a previous slot', async () => {
    const store = new CheckpointStore({ filePath: TEST_FILE });
    await store.saveSlot(0, { snapshot: { turn: 1 }, name: 'A', playTime: 0, turn: 1 });
    await store.saveSlot(0, { snapshot: { turn: 2 }, name: 'B', playTime: 0, turn: 2 });

    const loaded = await store.loadSlot(0);
    expect(loaded).toEqual({ turn: 2 });
  });

  it('ignores corrupted files and starts empty', async () => {
    writeFileSync(TEST_FILE, 'not-json{');
    const store = new CheckpointStore({ filePath: TEST_FILE });
    expect(store.list().every((s) => s === null)).toBe(true);
  });

  it('reads legacy single-slot wrapper format for backward compatibility', async () => {
    const wrapped = { version: 1, slots: [{ snapshot: { phase: 'battle', turn: 5 }, name: 'legacy', playTime: 0, turn: 5, createdAt: Date.now() }] };
    writeFileSync(TEST_FILE, JSON.stringify(wrapped));

    const store = new CheckpointStore({ filePath: TEST_FILE });
    const loaded = await store.loadSlot(0);
    expect(loaded).toEqual({ phase: 'battle', turn: 5 });
  });
});
