export class AnimationQueue {
  constructor(scene, { onBusyChange, onDrained } = {}) {
    this.scene = scene;
    this.onBusyChange = onBusyChange;
    this.onDrained = onDrained;

    this.items = [];
    this.running = false;
    this.paused = false;
    this.activeTimers = new Set();
    this.activeTweens = new Set();
    this.activeFallbacks = new Set();
    this.resumeWaiters = new Set();
  }

  enqueue(task) {
    this.items.push(task);
    if (!this.running) {
      void this._drain();
    }
  }

  enqueueMany(tasks = []) {
    for (const task of tasks) this.items.push(task);
    if (!this.running && this.items.length > 0) {
      void this._drain();
    }
  }

  clear() {
    this.items.length = 0;
  }

  setPaused(paused) {
    const next = !!paused;
    if (this.paused === next) return;

    this.paused = next;

    for (const timer of this.activeTimers) {
      if (!timer) continue;
      timer.paused = next;
    }

    for (const tween of this.activeTweens) {
      if (!tween) continue;
      if (next) tween.pause?.();
      else tween.resume?.();
    }

    for (const fallback of this.activeFallbacks) {
      if (next) fallback.pause();
      else fallback.resume();
    }

    if (!next) {
      for (const resolve of this.resumeWaiters) {
        resolve();
      }
      this.resumeWaiters.clear();
    }
  }

  async _drain() {
    this.running = true;
    this.onBusyChange?.(true);

    while (this.items.length > 0) {
      if (this.paused) {
        await this._waitUntilResumed();
        continue;
      }

      const task = this.items.shift();
      try {
        await task();
      } catch (error) {
        console.error('[AnimationQueue] task failed:', error);
      }
    }

    this.running = false;
    this.onBusyChange?.(false);
    this.onDrained?.();
  }

  _waitUntilResumed() {
    if (!this.paused) return Promise.resolve();
    return new Promise((resolve) => {
      this.resumeWaiters.add(resolve);
    });
  }

  delayCall(ms, callback = () => {}) {
    if (!(ms > 0)) {
      callback();
      return null;
    }

    if (this.scene?.time?.delayedCall) {
      let timer = null;
      timer = this.scene.time.delayedCall(ms, () => {
        this.activeTimers.delete(timer);
        callback();
      });
      this.activeTimers.add(timer);
      timer.paused = this.paused;
      return timer;
    }

    return this._createFallbackTimer(ms, callback);
  }

  wait(ms) {
    return new Promise((resolve) => {
      this.delayCall(ms, resolve);
    });
  }

  tween(config) {
    return new Promise((resolve) => {
      let settled = false;
      let tween = null;
      let fallback = null;
      const userComplete = config.onComplete;
      const userStop = config.onStop;
      const finish = (callback, args = []) => {
        if (settled) return;
        settled = true;
        if (fallback) fallback.cancel();
        if (tween) this.activeTweens.delete(tween);
        try {
          if (typeof callback === 'function') {
            callback(...args);
          }
        } catch (error) {
          console.error('[AnimationQueue] tween callback failed:', error);
        }
        resolve();
      };

      tween = this.scene?.tweens?.add({
        ...config,
        onComplete: (...args) => {
          finish(userComplete, args);
        },
        onStop: (...args) => {
          finish(userStop, args);
        },
      });

      if (!tween) {
        finish(userComplete);
        return;
      }

      this.activeTweens.add(tween);
      if (this.paused) tween.pause?.();

      fallback = this._createFallbackTimer(this._estimateTweenTimeout(config), () => {
        finish();
      });
    });
  }

  _createFallbackTimer(ms, callback) {
    let remaining = Math.max(0, Number(ms) || 0);
    let timeoutId = null;
    let startedAt = null;
    let settled = false;

    const cleanup = () => {
      if (timeoutId != null) {
        globalThis.clearTimeout(timeoutId);
        timeoutId = null;
      }
      startedAt = null;
      this.activeFallbacks.delete(handle);
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const handle = {
      pause: () => {
        if (settled || timeoutId == null || startedAt == null) return;
        remaining = Math.max(0, remaining - (Date.now() - startedAt));
        globalThis.clearTimeout(timeoutId);
        timeoutId = null;
        startedAt = null;
      },
      resume: () => {
        if (settled || timeoutId != null) return;
        if (remaining <= 0) {
          finish();
          return;
        }
        startedAt = Date.now();
        timeoutId = globalThis.setTimeout(() => {
          finish();
        }, remaining);
      },
      cancel: () => {
        if (settled) return;
        settled = true;
        cleanup();
      },
    };

    this.activeFallbacks.add(handle);
    if (!this.paused) handle.resume();
    return handle;
  }

  _estimateTweenTimeout(config = {}) {
    const delay = Number(config.delay) || 0;
    const duration = Number(config.duration) || 0;
    const hold = Number(config.hold) || 0;
    const repeatDelay = Number(config.repeatDelay) || 0;
    const completeDelay = Number(config.completeDelay) || 0;
    const repeat = Math.max(0, Number(config.repeat) || 0);
    const loop = Math.max(0, Number(config.loop) || 0);
    const cycles = Math.max(repeat, loop, 0) + 1;
    const leg = duration + hold + (config.yoyo ? duration : 0);
    return delay + completeDelay + cycles * leg + Math.max(0, cycles - 1) * repeatDelay + 240;
  }
}

