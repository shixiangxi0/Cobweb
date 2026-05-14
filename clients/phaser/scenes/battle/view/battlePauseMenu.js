import { COLORS } from '../../../src/constants.js';

const FONT_DISPLAY = '"Georgia", "Times New Roman", serif';
const FONT_UI = '"Trebuchet MS", "Verdana", sans-serif';

export class BattlePauseMenu {
  constructor(scene, { onResume, onRestoreTurn, onAbandon }) {
    this.scene = scene;
    this.container = null;
    this.actions = { onResume, onRestoreTurn, onAbandon };
    this._build(this.actions);
    this.hide();
  }

  _build({ onResume, onRestoreTurn, onAbandon }) {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const cx = W / 2;
    const cy = H / 2;

    // full-screen backdrop absorbs all pointer events below
    const backdrop = this.scene.add
      .rectangle(cx, cy, W, H, 0x000000, 0.54)
      .setInteractive();
    backdrop.on('pointerdown', () => onResume?.());

    const panelW = 300;
    const panelH = 272;
    const panel = this.scene.add
      .rectangle(cx, cy, panelW, panelH, COLORS.panel, 0.97)
      .setStrokeStyle(1, COLORS.frameSoft, 0.5);

    const title = this.scene.add
      .text(cx, cy - 96, '暂  停', {
        fontSize: '26px',
        color: COLORS.textMain,
        fontFamily: FONT_DISPLAY,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const divider = this.scene.add.rectangle(
      cx,
      cy - 64,
      panelW - 48,
      1,
      COLORS.frameSoft,
      0.28,
    );

    const hint = this.scene.add
      .text(cx, cy - 48, 'ESC 继续', {
        fontSize: '12px',
        color: COLORS.textDim,
        fontFamily: FONT_UI,
      })
      .setOrigin(0.5);

    const btnResume = this._makeButton(cx, cy - 20, '继续游戏', COLORS.accentTeal, onResume);
    const btnRestoreTurn = this._makeButton(cx, cy + 36, '重置本回合', COLORS.accentGold, onRestoreTurn);
    const btnAbandon = this._makeButton(cx, cy + 92, '放弃此局', COLORS.accentCoral, onAbandon);

    this.container = this.scene.add
      .container(0, 0, [
        backdrop,
        panel,
        title,
        divider,
        hint,
        ...btnResume,
        ...btnRestoreTurn,
        ...btnAbandon,
      ])
      .setDepth(900);
  }

  _makeButton(x, y, label, color, onClick) {
    const hexColor = typeof color === 'string'
      ? parseInt(color.replace('#', ''), 16)
      : color;

    const bg = this.scene.add
      .rectangle(x, y, 200, 44, COLORS.panelSoft, 0.9)
      .setStrokeStyle(1, hexColor, 0.45)
      .setInteractive({ useHandCursor: true });

    const text = this.scene.add
      .text(x, y, label, {
        fontSize: '18px',
        color,
        fontFamily: FONT_UI,
      })
      .setOrigin(0.5);

    bg.on('pointerover', () => {
      bg.setFillStyle(COLORS.shelf, 1);
      bg.setStrokeStyle(2, hexColor, 0.8);
      text.setScale(1.04);
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(COLORS.panelSoft, 0.9);
      bg.setStrokeStyle(1, hexColor, 0.45);
      text.setScale(1);
    });

    bg.on('pointerdown', () => onClick?.());

    return [bg, text];
  }

  show() {
    this.container?.setVisible(true);
  }

  hide() {
    this.container?.setVisible(false);
  }

  relayout() {
    const visible = this.container?.visible ?? false;
    this.destroy();
    this._build(this.actions);
    this.container?.setVisible(visible);
  }

  destroy() {
    this.container?.destroy();
    this.container = null;
  }
}

