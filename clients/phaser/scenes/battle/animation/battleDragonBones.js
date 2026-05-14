const ENEMY_SKINS = {
  bee: {
    key: 'enemy_bee',
    armature: 'ForestBee',
    textureUrl: 'assets/dragonbones/bee/ForestBee_tex.png',
    atlasUrl: 'assets/dragonbones/bee/ForestBee_tex.json',
    boneUrl: 'assets/dragonbones/bee/ForestBee_ske.json',
    idleAnimation: 'Idle',
    attackAnimation: 'Attack A',
    damageAnimation: 'Damage',
    scale: 1.04,
    offsetX: 0,
    offsetY: -8,
  },
  mimic: {
    key: 'enemy_mimic',
    armature: 'Mimic',
    textureUrl: 'assets/dragonbones/mimic/Mimic_tex.png',
    atlasUrl: 'assets/dragonbones/mimic/Mimic_tex.json',
    boneUrl: 'assets/dragonbones/mimic/Mimic_ske.json',
    idleAnimation: 'Idle',
    attackAnimation: 'Attack A',
    damageAnimation: 'Damage',
    scale: 0.92,
    offsetX: 0,
    offsetY: -2,
  },
  ghost: {
    key: 'enemy_ghost',
    armature: 'Ghost',
    textureUrl: 'assets/dragonbones/ghost/Ghost_tex.png',
    atlasUrl: 'assets/dragonbones/ghost/Ghost_tex.json',
    boneUrl: 'assets/dragonbones/ghost/Ghost_ske.json',
    idleAnimation: 'Idle',
    attackAnimation: 'Attack A',
    damageAnimation: 'Damage',
    scale: 0.98,
    offsetX: 0,
    offsetY: -8,
  },
  mageshroom: {
    key: 'enemy_mageshroom',
    armature: 'Mageshroom',
    textureUrl: 'assets/dragonbones/mageshroom/Mageshroom_tex.png',
    atlasUrl: 'assets/dragonbones/mageshroom/Mageshroom_tex.json',
    boneUrl: 'assets/dragonbones/mageshroom/Mageshroom_ske.json',
    idleAnimation: 'Idle',
    attackAnimation: 'Attack A',
    damageAnimation: 'Damage',
    scale: 0.94,
    offsetX: 0,
    offsetY: -10,
  },
  livingArmor: {
    key: 'enemy_living_armor',
    armature: 'LivingArmor',
    textureUrl: 'assets/dragonbones/living-armor/LivingArmor_tex.png',
    atlasUrl: 'assets/dragonbones/living-armor/LivingArmor_tex.json',
    boneUrl: 'assets/dragonbones/living-armor/LivingArmor_ske.json',
    idleAnimation: 'Idle',
    attackAnimation: 'Attack A',
    damageAnimation: 'Damage',
    scale: 0.42,
    offsetX: 0,
    offsetY: -2,
  },
  gunMimic: {
    key: 'enemy_gun_mimic',
    armature: 'GunMimic',
    textureUrl: 'assets/dragonbones/gun-mimic/GunMimic_tex.png',
    atlasUrl: 'assets/dragonbones/gun-mimic/GunMimic_tex.json',
    boneUrl: 'assets/dragonbones/gun-mimic/GunMimic_ske.json',
    idleAnimation: 'Idle',
    attackAnimation: 'Attack A',
    damageAnimation: 'Damage',
    scale: 0.86,
    offsetX: 0,
    offsetY: 2,
  },
};

const PRELOAD_SKINS = Object.values(ENEMY_SKINS);

const TYPE_SKIN_OVERRIDES = {
  jaw_worm: ENEMY_SKINS.mimic.key,
  louse_red: ENEMY_SKINS.bee.key,
  louse_green: ENEMY_SKINS.bee.key,
  cultist: ENEMY_SKINS.ghost.key,
  plague_mage: ENEMY_SKINS.mageshroom.key,
  curse_weaver: ENEMY_SKINS.gunMimic.key,
  iron_golem: ENEMY_SKINS.livingArmor.key,
  forest_wolf: ENEMY_SKINS.bee.key,
  scorpion_stalker: ENEMY_SKINS.mimic.key,
  time_thief: ENEMY_SKINS.ghost.key,
  shuffle_demon: ENEMY_SKINS.mageshroom.key,
};

const SKIN_BY_KEY = Object.fromEntries(
  Object.values(ENEMY_SKINS).map((skin) => [skin.key, skin]),
);

function hasDragonBonesLoader(scene) {
  return typeof scene?.load?.dragonbone === 'function';
}

function hasDragonBonesFactory(scene) {
  return typeof scene?.add?.armature === 'function' || !!scene?.dragonbone;
}

function uniqueSkins() {
  return PRELOAD_SKINS;
}

function findSkinByKey(key) {
  return key ? SKIN_BY_KEY[key] ?? null : null;
}

function detachAvatarDisplay(node) {
  if (!node?.avatarDisplay?.active) return;
  node.avatarDisplay.destroy();
  node.avatarDisplay = null;
}

function setAvatarFallbackVisible(node, visible) {
  node?.avatarFallback?.setVisible(visible);
}

function playAnimation(display, animationName, playTimes = 0) {
  const animation = display?.animation;
  if (!animation || !animationName) return;

  try {
    if (typeof animation.play === 'function') {
      animation.play(animationName, playTimes);
      return;
    }
  } catch {}

  try {
    if (typeof animation.gotoAndPlayByTime === 'function') {
      animation.gotoAndPlayByTime(animationName, 0, playTimes);
    }
  } catch {}
}

export function preloadBattleDragonBones(scene) {
  if (!hasDragonBonesLoader(scene)) return;

  for (const skin of uniqueSkins()) {
    scene.load.dragonbone(skin.key, skin.textureUrl, skin.atlasUrl, skin.boneUrl);
  }
}

export function resolveEnemyDragonBonesSkin(enemy) {
  if (!enemy) return null;

  const explicitKey = enemy.avatarSkinKey ?? enemy.skinKey ?? TYPE_SKIN_OVERRIDES[enemy.typeId];
  return findSkinByKey(explicitKey);
}

export function playNodeAvatarAnimation(node, animationName, { loop = false } = {}) {
  if (!node?.avatarDisplay?.active) return;
  playAnimation(node.avatarDisplay, animationName, loop ? 0 : 1);
}

export function playNodeIdleAnimation(node) {
  if (!node?.avatarDisplay?.active || !node.avatarSkinKey) return;
  const skin = findSkinByKey(node.avatarSkinKey);
  if (skin) playAnimation(node.avatarDisplay, skin.idleAnimation, 0);
}

export function getEnemySkinAnimations(node) {
  if (!node?.avatarSkinKey) return null;
  const skin = findSkinByKey(node.avatarSkinKey);
  if (!skin) return null;
  return {
    idle: skin.idleAnimation,
    attack: skin.attackAnimation ?? skin.idleAnimation,
    damage: skin.damageAnimation ?? skin.idleAnimation,
  };
}

export function syncEnemyDragonBonesAvatar(scene, node, enemy) {
  if (!node?.avatarLayer || !enemy) return;

  const skin = resolveEnemyDragonBonesSkin(enemy);
  if (!skin || !hasDragonBonesFactory(scene)) {
    detachAvatarDisplay(node);
    node.avatarSkinKey = null;
    setAvatarFallbackVisible(node, true);
    return;
  }

  if (node.avatarDisplay?.active && node.avatarSkinKey === skin.key) {
    setAvatarFallbackVisible(node, false);
    return;
  }

  detachAvatarDisplay(node);
  node.avatarSkinKey = null;

  let display = null;
  try {
    display = scene.add.armature
      ? scene.add.armature(skin.armature, skin.key)
      : scene.dragonbone?.createArmature?.(skin.armature, skin.key);
  } catch {
    display = null;
  }

  if (!display) {
    setAvatarFallbackVisible(node, true);
    return;
  }

  display.setPosition(skin.offsetX ?? 0, skin.offsetY ?? 0);
  display.setScale(skin.scale ?? 1);
  node.avatarLayer.add(display);
  node.avatarDisplay = display;
  node.avatarSkinKey = skin.key;
  setAvatarFallbackVisible(node, false);
  playAnimation(display, skin.idleAnimation, 0);
}

