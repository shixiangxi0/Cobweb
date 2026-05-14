import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * CheckpointStore — CLI 多槽位检查点持久化。
 *
 * 单文件格式：{ version: 1, slots: [{ name, snapshot, playTime, turn, createdAt }, ...] }
 * 默认最多 3 个槽位，以运行时间命名。
 */
export class CheckpointStore {
  constructor({ filePath = resolve('cobweb-saves.json'), maxSlots = 3 } = {}) {
    this.filePath = filePath;
    this.maxSlots = maxSlots;
    this.slots = Array.from({ length: maxSlots }, () => null);
    this._load();
  }

  _load() {
    if (!existsSync(this.filePath)) return;
    try {
      const data = JSON.parse(readFileSync(this.filePath, 'utf-8'));
      if (data?.version === 1 && Array.isArray(data.slots)) {
        const loaded = data.slots.slice(0, this.maxSlots);
        for (let i = 0; i < this.maxSlots; i++) {
          this.slots[i] = loaded[i] ?? null;
        }
      }
    } catch {
      // 忽略损坏文件，从空槽位开始
    }
  }

  _persist() {
    writeFileSync(this.filePath, JSON.stringify({ version: 1, slots: this.slots }));
  }

  /** 返回所有槽位（null 表示空槽位） */
  list() {
    return this.slots.map((slot, index) =>
      slot
        ? {
            index,
            name: slot.name,
            playTime: slot.playTime,
            turn: slot.turn,
            createdAt: slot.createdAt,
          }
        : null,
    );
  }

  saveSlot(index, { snapshot, name, playTime, turn }) {
    if (index < 0 || index >= this.maxSlots) return false;
    this.slots[index] = {
      snapshot,
      name,
      playTime,
      turn,
      createdAt: Date.now(),
    };
    this._persist();
    return true;
  }

  loadSlot(index) {
    if (index < 0 || index >= this.maxSlots) return null;
    return this.slots[index]?.snapshot ?? null;
  }
}
