export function computeBattleLayout(width, height) {
  // HUD strip at top
  const hudH = Math.max(48, height * 0.068);
  const hudY = Math.floor(hudH / 2) + 4;

  // Bottom operation zone: 3-column area (player | hand | end-turn)
  const bottomH = Math.max(230, Math.min(290, height * 0.325));
  const bottomTop = height - bottomH;
  const bottomCY = height - bottomH / 2;

  // Left column: player character panel
  const leftW = Math.max(180, Math.min(210, width * 0.175));
  const leftCX = Math.floor(leftW / 2) + 8;

  // Right column: end-turn button + pile counters
  const rightW = Math.max(220, Math.min(270, width * 0.21));
  const rightCX = width - Math.floor(rightW / 2) - 8;

  // Center column: hand cards
  const handLeft = leftCX + Math.floor(leftW / 2) + 12;
  const handRight = rightCX - Math.floor(rightW / 2) - 12;
  const handCX = Math.floor((handLeft + handRight) / 2);
  const handW = Math.max(160, handRight - handLeft);

  // Stage: full space between HUD and bottom zone (enemies only)
  const stageTop = hudY + Math.ceil(hudH / 2) + 4;
  const stageCY = Math.floor((stageTop + bottomTop) / 2);
  const stageH = bottomTop - stageTop;

  return {
    hud: {
      x: width / 2,
      y: hudY,
      w: width - 80,
      h: hudH,
    },
    stage: {
      x: width / 2,
      y: stageCY,
      w: width * 0.92,
      h: stageH,
    },
    hand: {
      x: handCX,
      y: bottomTop + 90,
      w: handW,
      h: 180,
    },
    playerAnchor: {
      x: leftCX,
      y: bottomTop + Math.floor(bottomH * 0.565),
    },
    enemyArea: {
      cx: width * 0.5,
      cy: stageCY,
      w: Math.min(width * 0.6, 960),
      h: stageH * 0.4,
    },
    piles: {
      draw:    { x: rightCX - 64, y: bottomTop + Math.floor(bottomH * 0.68) },
      discard: { x: rightCX,      y: bottomTop + Math.floor(bottomH * 0.68) },
      exhaust: { x: rightCX + 64, y: bottomTop + Math.floor(bottomH * 0.68) },
    },
    releaseZoneY: bottomTop - 60,
    endTurn: {
      x: rightCX,
      y: bottomTop + Math.floor(bottomH * 0.31),
    },
    bottomZone: {
      x: width / 2,
      y: bottomCY,
      w: width,
      h: bottomH,
      top: bottomTop,
      leftCX,
      leftW,
      rightCX,
      rightW,
      handCX,
      handW,
    },
  };
}

