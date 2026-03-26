import type { Observer, Scene } from "@babylonjs/core";

import { asteroidEvents } from "../game/Asteroid";
import { GameState, gameStateEvents } from "../game/Game";
import { type PlayerController, playerEvents } from "../game/Player";
import { waveManagerEvents } from "../game/WaveManager";

const SILENT_GAIN = 0.0001;
const THRUSTER_FREQUENCY_HZ = 80;
const THRUSTER_GAIN = 0.05;
const MUSIC_GAIN = 0.03;

export class AudioManager {
  private readonly _scene: Scene;
  private readonly _subscriptions: Array<() => void> = [];
  private readonly _unlockCleanup: Array<() => void> = [];

  private _player: PlayerController | null = null;
  private _audioContext: AudioContext | null = null;
  private _masterGain: GainNode | null = null;
  private _sfxBus: GainNode | null = null;
  private _musicBus: GainNode | null = null;
  private _thrusterOscillator: OscillatorNode | null = null;
  private _thrusterGain: GainNode | null = null;
  private _musicOscillators: OscillatorNode[] = [];
  private _noiseBuffer: AudioBuffer | null = null;
  private _sceneObserver: Observer<Scene> | null = null;

  private _initialized = false;
  private _audioEnabled = false;
  private _thrusterActive = false;

  public constructor(scene: Scene) {
    this._scene = scene;
  }

  public setPlayer(player: PlayerController): void {
    this._player = player;
  }

  public init(): void {
    if (this._initialized) {
      return;
    }

    this._initialized = true;

    const audioContext = this.createAudioContext();
    if (!audioContext) {
      return;
    }

    this._audioContext = audioContext;
    this._noiseBuffer = this.createNoiseBuffer(audioContext);

    const masterGain = audioContext.createGain();
    masterGain.gain.value = 0.9;
    masterGain.connect(audioContext.destination);
    this._masterGain = masterGain;

    const sfxBus = audioContext.createGain();
    sfxBus.gain.value = 1;
    sfxBus.connect(masterGain);
    this._sfxBus = sfxBus;

    const musicBus = audioContext.createGain();
    musicBus.gain.value = SILENT_GAIN;
    musicBus.connect(masterGain);
    this._musicBus = musicBus;

    this.createThrusterLoop(audioContext, sfxBus);
    this.createBackgroundDrone(audioContext, musicBus);
    this.registerEventSubscriptions();
    this.registerUnlockHandlers();

    this._sceneObserver = this._scene.onBeforeRenderObservable.add(() => {
      this.updateThrusterLoop();
    });
  }

  public dispose(): void {
    this._audioEnabled = false;
    this.setThrusterLoop(false);
    this.setBackgroundMusic(false);

    if (this._sceneObserver) {
      this._scene.onBeforeRenderObservable.remove(this._sceneObserver);
      this._sceneObserver = null;
    }

    for (const unsubscribe of this._subscriptions) {
      unsubscribe();
    }
    this._subscriptions.length = 0;

    for (const cleanup of this._unlockCleanup) {
      cleanup();
    }
    this._unlockCleanup.length = 0;

    this.stopOscillator(this._thrusterOscillator);
    this._thrusterOscillator = null;
    this.safeDisconnect(this._thrusterGain);
    this._thrusterGain = null;

    for (const oscillator of this._musicOscillators) {
      this.stopOscillator(oscillator);
    }
    this._musicOscillators = [];

    this.safeDisconnect(this._musicBus);
    this._musicBus = null;
    this.safeDisconnect(this._sfxBus);
    this._sfxBus = null;
    this.safeDisconnect(this._masterGain);
    this._masterGain = null;

    if (this._audioContext && this._audioContext.state !== "closed") {
      void this._audioContext.close().catch(() => undefined);
    }

    this._audioContext = null;
    this._noiseBuffer = null;
  }

  private createAudioContext(): AudioContext | null {
    const canvas = this._scene.getEngine().getRenderingCanvas();
    const doc = canvas?.ownerDocument ?? globalThis.document;
    const view = doc?.defaultView ?? globalThis.window;

    if (!("AudioContext" in view)) {
      return null;
    }

    return new view.AudioContext();
  }

  private createThrusterLoop(audioContext: AudioContext, destination: AudioNode): void {
    const gainNode = audioContext.createGain();
    gainNode.gain.value = SILENT_GAIN;
    gainNode.connect(destination);

    const oscillator = audioContext.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = THRUSTER_FREQUENCY_HZ;
    oscillator.connect(gainNode);
    oscillator.start();

    this._thrusterGain = gainNode;
    this._thrusterOscillator = oscillator;
  }

  private createBackgroundDrone(audioContext: AudioContext, destination: AudioNode): void {
    const droneFrequencies = [55, 110];
    const partialLevels = [0.7, 0.35];

    for (let index = 0; index < droneFrequencies.length; index += 1) {
      const toneGain = audioContext.createGain();
      toneGain.gain.value = partialLevels[index];
      toneGain.connect(destination);

      const oscillator = audioContext.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = droneFrequencies[index];
      oscillator.connect(toneGain);
      oscillator.start();

      this._musicOscillators.push(oscillator);
    }
  }

  private createNoiseBuffer(audioContext: AudioContext): AudioBuffer {
    const durationSeconds = 0.25;
    const frameCount = Math.max(1, Math.floor(audioContext.sampleRate * durationSeconds));
    const noiseBuffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
    const channelData = noiseBuffer.getChannelData(0);

    for (let index = 0; index < frameCount; index += 1) {
      channelData[index] = (Math.random() * 2 - 1) * 0.75;
    }

    return noiseBuffer;
  }

  private registerUnlockHandlers(): void {
    const audioContext = this._audioContext;
    const canvas = this._scene.getEngine().getRenderingCanvas();
    const doc = canvas?.ownerDocument ?? globalThis.document;

    if (!audioContext || !doc) {
      return;
    }

    const unlock = (): void => {
      if (audioContext.state === "suspended") {
        void audioContext.resume().catch(() => undefined);
      }
    };

    const eventNames: Array<keyof DocumentEventMap> = ["keydown", "pointerdown", "touchstart"];

    for (const eventName of eventNames) {
      doc.addEventListener(eventName, unlock, { passive: true });
      this._unlockCleanup.push(() => doc.removeEventListener(eventName, unlock));
    }
  }

  private registerEventSubscriptions(): void {
    const firedObserver = playerEvents.fired$.add(() => {
      this.playShoot();
    });
    this._subscriptions.push(() => playerEvents.fired$.remove(firedObserver));

    const asteroidDestroyedObserver = asteroidEvents.destroyed$.add(() => {
      this.playAsteroidExplosion();
    });
    this._subscriptions.push(() => asteroidEvents.destroyed$.remove(asteroidDestroyedObserver));

    const damagedObserver = playerEvents.damaged$.add(() => {
      this.playDamage(false);
    });
    this._subscriptions.push(() => playerEvents.damaged$.remove(damagedObserver));

    const diedObserver = playerEvents.died$.add(() => {
      this.playDamage(true);
    });
    this._subscriptions.push(() => playerEvents.died$.remove(diedObserver));

    const waveCompleteObserver = waveManagerEvents.waveComplete$.add(() => {
      this.playWaveCompleteJingle();
    });
    this._subscriptions.push(() => waveManagerEvents.waveComplete$.remove(waveCompleteObserver));

    const stateChangedObserver = gameStateEvents.stateChanged$.add(({ to }) => {
      this.handleGameStateChange(to);
    });
    this._subscriptions.push(() => gameStateEvents.stateChanged$.remove(stateChangedObserver));
  }

  private handleGameStateChange(nextState: GameState): void {
    switch (nextState) {
      case GameState.PLAYING:
        this._audioEnabled = true;
        void this.ensureAudioReady();
        this.setBackgroundMusic(true);
        this.updateThrusterLoop();
        break;
      case GameState.LOADING:
      case GameState.MENU:
      case GameState.PAUSED:
      case GameState.GAME_OVER:
      case GameState.VICTORY:
        this._audioEnabled = false;
        this.setThrusterLoop(false);
        this.setBackgroundMusic(false);
        break;
      case GameState.WAVE_TRANSITION:
      case GameState.AREA_COMPLETE:
      case GameState.AREA_TRANSITION:
        this.setThrusterLoop(false);
        break;
    }
  }

  private updateThrusterLoop(): void {
    const shouldPlayThruster = this._audioEnabled && this._player?.isThrusting === true;

    if (shouldPlayThruster !== this._thrusterActive) {
      this.setThrusterLoop(shouldPlayThruster);
    }
  }

  private setThrusterLoop(enabled: boolean): void {
    const audioContext = this._audioContext;
    const gainNode = this._thrusterGain;

    if (!audioContext || !gainNode) {
      this._thrusterActive = false;
      return;
    }

    this._thrusterActive = enabled;
    const now = audioContext.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(Math.max(gainNode.gain.value, SILENT_GAIN), now);
    gainNode.gain.exponentialRampToValueAtTime(enabled ? THRUSTER_GAIN : SILENT_GAIN, now + 0.04);
  }

  private setBackgroundMusic(enabled: boolean): void {
    const audioContext = this._audioContext;
    const musicBus = this._musicBus;

    if (!audioContext || !musicBus) {
      return;
    }

    const now = audioContext.currentTime;
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setValueAtTime(Math.max(musicBus.gain.value, SILENT_GAIN), now);
    musicBus.gain.exponentialRampToValueAtTime(enabled ? MUSIC_GAIN : SILENT_GAIN, now + 0.4);
  }

  private playShoot(): void {
    const audioContext = this._audioContext;
    const destination = this._sfxBus;

    if (!audioContext || !destination) {
      return;
    }

    void this.ensureAudioReady();

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(800, now);

    gainNode.gain.setValueAtTime(SILENT_GAIN, now);
    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(SILENT_GAIN, now + 0.05);

    oscillator.connect(gainNode);
    gainNode.connect(destination);

    oscillator.start(now);
    oscillator.stop(now + 0.07);
    oscillator.onended = () => {
      this.safeDisconnect(oscillator);
      this.safeDisconnect(gainNode);
    };
  }

  private playAsteroidExplosion(): void {
    const audioContext = this._audioContext;
    const destination = this._sfxBus;
    const noiseBuffer = this._noiseBuffer;

    if (!audioContext || !destination || !noiseBuffer) {
      return;
    }

    void this.ensureAudioReady();

    const now = audioContext.currentTime;
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gainNode = audioContext.createGain();

    source.buffer = noiseBuffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(420, now);
    filter.Q.setValueAtTime(1, now);

    gainNode.gain.setValueAtTime(0.18, now);
    gainNode.gain.exponentialRampToValueAtTime(SILENT_GAIN, now + 0.2);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(destination);

    source.start(now);
    source.stop(now + 0.22);
    source.onended = () => {
      this.safeDisconnect(source);
      this.safeDisconnect(filter);
      this.safeDisconnect(gainNode);
    };
  }

  private playDamage(isDeath: boolean): void {
    const audioContext = this._audioContext;
    const destination = this._sfxBus;

    if (!audioContext || !destination) {
      return;
    }

    void this.ensureAudioReady();

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const durationSeconds = isDeath ? 0.35 : 0.15;
    const attackGain = isDeath ? 0.22 : 0.14;
    const startFrequency = isDeath ? 500 : 400;
    const endFrequency = isDeath ? 120 : 200;

    oscillator.type = isDeath ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + durationSeconds);

    gainNode.gain.setValueAtTime(SILENT_GAIN, now);
    gainNode.gain.linearRampToValueAtTime(attackGain, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(SILENT_GAIN, now + durationSeconds);

    oscillator.connect(gainNode);
    gainNode.connect(destination);

    oscillator.start(now);
    oscillator.stop(now + durationSeconds + 0.02);
    oscillator.onended = () => {
      this.safeDisconnect(oscillator);
      this.safeDisconnect(gainNode);
    };
  }

  private playWaveCompleteJingle(): void {
    const audioContext = this._audioContext;
    const destination = this._sfxBus;

    if (!audioContext || !destination) {
      return;
    }

    void this.ensureAudioReady();

    const notes = [523, 659, 784];
    const noteDurationSeconds = 0.1;
    const startTime = audioContext.currentTime;

    for (let index = 0; index < notes.length; index += 1) {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const noteStart = startTime + index * noteDurationSeconds;
      const noteEnd = noteStart + noteDurationSeconds;

      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(notes[index], noteStart);

      gainNode.gain.setValueAtTime(SILENT_GAIN, noteStart);
      gainNode.gain.linearRampToValueAtTime(0.12, noteStart + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(SILENT_GAIN, noteEnd);

      oscillator.connect(gainNode);
      gainNode.connect(destination);

      oscillator.start(noteStart);
      oscillator.stop(noteEnd + 0.02);
      oscillator.onended = () => {
        this.safeDisconnect(oscillator);
        this.safeDisconnect(gainNode);
      };
    }
  }

  private async ensureAudioReady(): Promise<void> {
    const audioContext = this._audioContext;

    if (!audioContext || audioContext.state !== "suspended") {
      return;
    }

    try {
      await audioContext.resume();
    } catch {
      // Browser autoplay policies can still reject resume outside a user gesture.
    }
  }

  private stopOscillator(oscillator: OscillatorNode | null): void {
    if (!oscillator) {
      return;
    }

    try {
      oscillator.stop();
    } catch {
      // Oscillator may already be stopped during teardown.
    }

    this.safeDisconnect(oscillator);
  }

  private safeDisconnect(node: AudioNode | null): void {
    if (!node) {
      return;
    }

    try {
      node.disconnect();
    } catch {
      // Node may already be disconnected.
    }
  }
}