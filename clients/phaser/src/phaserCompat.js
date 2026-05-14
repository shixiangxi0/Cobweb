import Phaser from 'phaser';

if (!globalThis.Phaser) {
  globalThis.Phaser = Phaser;
}

export class BaseScene extends Phaser.Scene {}

export const RENDERER_AUTO = Phaser.AUTO;
export const SCALE_MODE_FIT = Phaser.Scale.FIT;
export const SCALE_MODE_RESIZE = Phaser.Scale.RESIZE;
export const SCALE_CENTER_BOTH = Phaser.Scale.CENTER_BOTH;

export function createGame(config) {
  return new Phaser.Game(config);
}

export function degToRad(value) {
  return Phaser.Math.DegToRad(value);
}

export function createVector2(x, y) {
  return new Phaser.Math.Vector2(x, y);
}
