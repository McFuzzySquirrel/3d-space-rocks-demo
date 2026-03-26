import { Observable, type Observer, type Scene } from "@babylonjs/core";
import {
  AdvancedDynamicTexture,
  Container,
  Control,
  Image,
  Rectangle,
  StackPanel,
  TextBlock,
} from "@babylonjs/gui";

import { APP_CONFIG } from "../utils/Constants";
import { gameStateEvents, GameState } from "./Game";
import { playerEvents } from "./Player";
import { scoreEvents } from "./ScoreSystem";
import { waveManagerEvents } from "./WaveManager";

const HIGH_SCORE_STORAGE_KEY = "3dSpaceRocks_highScore";

const HUD_THEME = {
  textPrimary: "#FFFFFF",
  textMuted: "#B7D9FF",
  textCyan: "#7DE7FF",
  textDanger: "#FF4D5D",
  textVictory: "#FFD95A",
  panelBg: "#020812CC",
  overlayBg: "#01050ED9",
  transitionBg: "#01050EB3",
  focusStroke: "#7DE7FF",
  lifeOn: "#7DE7FF",
  lifeOff: "#395064",
};

const FONT_FAMILY = "Verdana, Geneva, sans-serif";

export class HUD {
  private readonly _scene: Scene;
  private readonly _ui: AdvancedDynamicTexture;
  private readonly _subscriptions: Array<() => void> = [];
  private readonly _timeouts: number[] = [];
  private readonly _rafHandles = new Set<number>();

  private _currentScore = 0;
  private _currentLives = APP_CONFIG.gameplay.playerCombat.maxLives;
  private _currentWave = 1;
  private _currentArea = 1;
  private _highScore = this.readHighScore();

  // Gameplay HUD
  private readonly _hudRoot: Container;
  private readonly _scoreValue: TextBlock;
  private readonly _waveAreaValue: TextBlock;
  private readonly _livesText: TextBlock;
  private readonly _lifeIcons: TextBlock[] = [];

  // Start/menu screen
  private readonly _menuRoot: Rectangle;
  private readonly _menuHighScore: TextBlock;
  private readonly _menuPrompt: TextBlock;
  private _menuPulseObserver: Observer<Scene> | null = null;

  // Transition overlay
  private readonly _transitionRoot: Rectangle;
  private readonly _transitionText: TextBlock;

  // Area complete overlay
  private readonly _areaCompleteRoot: Rectangle;
  private readonly _areaCompleteText: TextBlock;

  // Pause menu
  private readonly _pauseRoot: Rectangle;
  private readonly _pauseResume: Rectangle;
  private readonly _pauseRestart: Rectangle;

  // End screens
  private readonly _gameOverRoot: Rectangle;
  private readonly _gameOverScore: TextBlock;
  private readonly _gameOverHighScore: TextBlock;

  private readonly _victoryRoot: Rectangle;
  private readonly _victoryScore: TextBlock;
  private readonly _victoryHighScore: TextBlock;

  // Loading overlay (H-07)
  private readonly _loadingRoot: Rectangle;
  private readonly _loadingLabel: TextBlock;
  private readonly _loadingBarFill: Rectangle;

  public onResume: (() => void) | null = null;
  public onRestart: (() => void) | null = null;

  public constructor(scene: Scene) {
    this._scene = scene;
    this._ui = AdvancedDynamicTexture.CreateFullscreenUI("HUD", true, scene);

    this._hudRoot = this.createGameplayHud();
    this._menuRoot = this.createMenuScreen();
    this._transitionRoot = this.createTransitionOverlay();
    this._areaCompleteRoot = this.createAreaCompleteOverlay();
    this._pauseRoot = this.createPauseOverlay();
    this._gameOverRoot = this.createGameOverScreen();
    this._victoryRoot = this.createVictoryScreen();
    this._loadingRoot = this.createLoadingOverlay();

    this._scoreValue = this.findNamedTextBlock(this._hudRoot, "hud-score-value");
    this._waveAreaValue = this.findNamedTextBlock(this._hudRoot, "hud-wave-area-value");
    this._livesText = this.findNamedTextBlock(this._hudRoot, "hud-lives-text");

    this._menuHighScore = this.findNamedTextBlock(this._menuRoot, "menu-high-score");
    this._menuPrompt = this.findNamedTextBlock(this._menuRoot, "menu-prompt");

    this._transitionText = this.findNamedTextBlock(this._transitionRoot, "transition-text");
    this._areaCompleteText = this.findNamedTextBlock(this._areaCompleteRoot, "area-complete-text");

    this._gameOverScore = this.findNamedTextBlock(this._gameOverRoot, "game-over-score");
    this._gameOverHighScore = this.findNamedTextBlock(this._gameOverRoot, "game-over-high-score");

    this._victoryScore = this.findNamedTextBlock(this._victoryRoot, "victory-score");
    this._victoryHighScore = this.findNamedTextBlock(this._victoryRoot, "victory-high-score");

    this._loadingLabel = this.findNamedTextBlock(this._loadingRoot, "loading-label");
    this._loadingBarFill = this.findNamedRectangle(this._loadingRoot, "loading-fill");

    this._pauseResume = this.findNamedRectangle(this._pauseRoot, "pause-resume");
    this._pauseRestart = this.findNamedRectangle(this._pauseRoot, "pause-restart");

    this._lifeIcons.push(
      this.findNamedTextBlock(this._hudRoot, "life-icon-1"),
      this.findNamedTextBlock(this._hudRoot, "life-icon-2"),
      this.findNamedTextBlock(this._hudRoot, "life-icon-3")
    );

    this.registerEventSubscriptions();

    this.updateScore(0);
    this.updateLives(APP_CONFIG.gameplay.playerCombat.maxLives);
    this.updateWaveArea(1, 1);
    this.setLoadingProgress(0, "Loading Assets...");

    this.showMenu();
  }

  public showMenu(): void {
    this._highScore = this.readHighScore();
    this._menuHighScore.text = `HIGH SCORE: ${this.formatScore(this._highScore)}`;

    this.hideHUD();
    this.hidePauseMenu();
    this.hideLoading();

    this._gameOverRoot.isVisible = false;
    this._victoryRoot.isVisible = false;
    this._transitionRoot.isVisible = false;
    this._areaCompleteRoot.isVisible = false;

    this._menuRoot.isVisible = true;
    this.startMenuPromptPulse();
  }

  public hideMenu(): void {
    this._menuRoot.isVisible = false;
    this.stopMenuPromptPulse();
  }

  public showHUD(): void {
    this._hudRoot.isVisible = true;
    this._transitionRoot.isVisible = false;
    this._areaCompleteRoot.isVisible = false;
  }

  public hideHUD(): void {
    this._hudRoot.isVisible = false;
  }

  public showWaveTransition(waveNum: number, areaNum: number): void {
    this.updateWaveArea(waveNum, areaNum);
    this._transitionText.text = `WAVE ${waveNum} COMPLETE`;
    this._transitionRoot.isVisible = true;
    this._transitionRoot.alpha = 0;

    this.clearTransientTimers();
    this.animateAlpha(this._transitionRoot, 0, 1, 200);

    this.addTimeout(() => {
      this.addTimeout(() => {
        this.animateAlpha(this._transitionRoot, 1, 0, 300, () => {
          this._transitionRoot.isVisible = false;
        });
      }, 1500);
    }, 200);
  }

  public showAreaComplete(areaNum: number): void {
    this._areaCompleteText.text = `AREA ${areaNum} COMPLETE`;
    this._areaCompleteRoot.alpha = 1;
    this._areaCompleteRoot.isVisible = true;
  }

  public showPauseMenu(): void {
    this._pauseRoot.isVisible = true;
    this.setPauseFocus("resume");
  }

  public hidePauseMenu(): void {
    this._pauseRoot.isVisible = false;
  }

  public showGameOver(finalScore: number, highScore: number): void {
    this.hideMenu();
    this.hideHUD();
    this.hidePauseMenu();

    this._highScore = Math.max(this._highScore, highScore);
    this._gameOverScore.text = `SCORE: ${this.formatScore(finalScore)}`;
    this._gameOverHighScore.text = `HIGH SCORE: ${this.formatScore(this._highScore)}`;
    this._gameOverRoot.isVisible = true;
  }

  public showVictory(finalScore: number, highScore: number): void {
    this.hideMenu();
    this.hideHUD();
    this.hidePauseMenu();

    this._highScore = Math.max(this._highScore, highScore);
    this._victoryScore.text = `SCORE: ${this.formatScore(finalScore)}`;
    this._victoryHighScore.text = `HIGH SCORE: ${this.formatScore(this._highScore)}`;
    this._victoryRoot.isVisible = true;
  }

  public updateScore(score: number): void {
    this._currentScore = Math.max(0, score);
    this._scoreValue.text = this.formatScore(this._currentScore);
  }

  public updateLives(lives: number): void {
    this._currentLives = Math.max(0, Math.min(APP_CONFIG.gameplay.playerCombat.maxLives, lives));
    this._livesText.text = `${this._currentLives} ${this._currentLives === 1 ? "life" : "lives"}`;

    for (let i = 0; i < this._lifeIcons.length; i++) {
      this._lifeIcons[i].color = i < this._currentLives ? HUD_THEME.lifeOn : HUD_THEME.lifeOff;
      this._lifeIcons[i].alpha = i < this._currentLives ? 1 : 0.4;
    }
  }

  public updateWaveArea(wave: number, area: number): void {
    this._currentWave = Math.max(1, wave);
    this._currentArea = Math.max(1, area);
    this._waveAreaValue.text = `AREA ${this._currentArea}    WAVE ${this._currentWave}/3`;
  }

  public setPauseFocus(option: "resume" | "restart"): void {
    const selected = option === "resume" ? this._pauseResume : this._pauseRestart;
    const unselected = option === "resume" ? this._pauseRestart : this._pauseResume;

    selected.thickness = 2;
    selected.color = HUD_THEME.focusStroke;
    selected.background = "#113247CC";

    unselected.thickness = 1;
    unselected.color = "#4C6177";
    unselected.background = "#0B1828CC";
  }

  public setLoadingProgress(progress: number, label = "Loading Assets..."): void {
    const pct = Math.max(0, Math.min(1, progress));
    this._loadingLabel.text = `${label} ${Math.round(pct * 100)}%`;
    this._loadingBarFill.width = `${Math.round(pct * 100)}%`;
  }

  public showLoading(): void {
    this.hideMenu();
    this.hideHUD();
    this.hidePauseMenu();
    this._loadingRoot.isVisible = true;
  }

  public hideLoading(): void {
    this._loadingRoot.isVisible = false;
  }

  public dispose(): void {
    for (const unsubscribe of this._subscriptions) {
      unsubscribe();
    }
    this._subscriptions.length = 0;

    this.stopMenuPromptPulse();
    this.clearTransientTimers();

    for (const handle of this._rafHandles) {
      cancelAnimationFrame(handle);
    }
    this._rafHandles.clear();

    this._ui.dispose();
  }

  private registerEventSubscriptions(): void {
    const stateObserver = gameStateEvents.stateChanged$.add(({ from, to }) => {
      if (to === GameState.LOADING) {
        this.showLoading();
        return;
      }

      if (from === GameState.LOADING) {
        this.hideLoading();
      }

      switch (to) {
        case GameState.MENU:
          this._gameOverRoot.isVisible = false;
          this._victoryRoot.isVisible = false;
          this.showMenu();
          break;
        case GameState.PLAYING:
          this.hideMenu();
          this.hidePauseMenu();
          this.showHUD();
          if (from === GameState.MENU) {
            this.updateScore(0);
            this.updateLives(APP_CONFIG.gameplay.playerCombat.maxLives);
            this.updateWaveArea(1, 1);
          }
          break;
        case GameState.WAVE_TRANSITION:
          this.showHUD();
          break;
        case GameState.AREA_COMPLETE:
          this.showHUD();
          break;
        case GameState.AREA_TRANSITION:
          this.showHUD();
          this._areaCompleteRoot.isVisible = false;
          break;
        case GameState.PAUSED:
          this.showHUD();
          this.showPauseMenu();
          break;
        case GameState.GAME_OVER:
          this.hidePauseMenu();
          this.hideHUD();
          break;
        case GameState.VICTORY:
          this.hidePauseMenu();
          this.hideHUD();
          break;
        default:
          break;
      }
    });
    this.registerObserver(gameStateEvents.stateChanged$, stateObserver);

    const scoreObserver = scoreEvents.scoreChanged$.add((event) => {
      this.updateScore(event.currentScore);
      this._highScore = Math.max(this._highScore, event.currentScore);
      this._menuHighScore.text = `HIGH SCORE: ${this.formatScore(this._highScore)}`;
    });
    this.registerObserver(scoreEvents.scoreChanged$, scoreObserver);

    const highScoreObserver = scoreEvents.highScoreUpdated$.add((event) => {
      this._highScore = event.newHighScore;
      this._menuHighScore.text = `HIGH SCORE: ${this.formatScore(this._highScore)}`;
    });
    this.registerObserver(scoreEvents.highScoreUpdated$, highScoreObserver);

    const waveStartedObserver = waveManagerEvents.waveStarted$.add((event) => {
      this.updateWaveArea(event.wave, event.area);
      this._areaCompleteRoot.isVisible = false;
    });
    this.registerObserver(waveManagerEvents.waveStarted$, waveStartedObserver);

    const playerDamagedObserver = playerEvents.damaged$.add((event) => {
      this.updateLives(event.lives);
    });
    this.registerObserver(playerEvents.damaged$, playerDamagedObserver);

    const waveTransitionObserver = gameStateEvents.waveTransitionStart$.add((event) => {
      this.showWaveTransition(event.wave, event.area);
    });
    this.registerObserver(gameStateEvents.waveTransitionStart$, waveTransitionObserver);

    const areaCompleteObserver = gameStateEvents.areaCompleteStart$.add((event) => {
      this.showAreaComplete(event.area);
    });
    this.registerObserver(gameStateEvents.areaCompleteStart$, areaCompleteObserver);

    const gameOverObserver = gameStateEvents.gameOverStart$.add((event) => {
      this.showGameOver(event.finalScore, this._highScore);
    });
    this.registerObserver(gameStateEvents.gameOverStart$, gameOverObserver);

    const victoryObserver = gameStateEvents.victoryStart$.add((event) => {
      this.showVictory(event.finalScore, this._highScore);
    });
    this.registerObserver(gameStateEvents.victoryStart$, victoryObserver);
  }

  private createGameplayHud(): Container {
    const root = new Container("hud-root");
    root.isVisible = false;
    this._ui.addControl(root);

    const scorePanel = new StackPanel("hud-score-panel");
    scorePanel.width = "220px";
    scorePanel.isVertical = true;
    scorePanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    scorePanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    scorePanel.paddingLeft = "18px";
    scorePanel.paddingTop = "18px";

    const scoreLabel = this.makeText("hud-score-label", "SCORE", "15px", HUD_THEME.textMuted, "left");
    const scoreValue = this.makeText("hud-score-value", "000000", "26px", HUD_THEME.textPrimary, "left");
    scoreValue.fontWeight = "700";

    scorePanel.addControl(scoreLabel);
    scorePanel.addControl(scoreValue);
    root.addControl(scorePanel);

    const wavePanel = new Rectangle("hud-wave-panel");
    wavePanel.width = "360px";
    wavePanel.height = "54px";
    wavePanel.background = HUD_THEME.panelBg;
    wavePanel.cornerRadius = 8;
    wavePanel.thickness = 1;
    wavePanel.color = "#3B526C";
    wavePanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    wavePanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    wavePanel.paddingTop = "16px";

    const waveText = this.makeText("hud-wave-area-value", "AREA 1    WAVE 1/3", "22px", HUD_THEME.textPrimary, "center");
    waveText.fontWeight = "700";
    wavePanel.addControl(waveText);
    root.addControl(wavePanel);

    const livesPanel = new StackPanel("hud-lives-panel");
    livesPanel.width = "250px";
    livesPanel.isVertical = true;
    livesPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    livesPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    livesPanel.paddingRight = "18px";
    livesPanel.paddingTop = "18px";

    const livesLabel = this.makeText("hud-lives-label", "LIVES", "15px", HUD_THEME.textMuted, "right");

    const iconRow = new StackPanel("hud-life-icon-row");
    iconRow.isVertical = false;
    iconRow.height = "28px";
    iconRow.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;

    for (let i = 1; i <= APP_CONFIG.gameplay.playerCombat.maxLives; i++) {
      const icon = this.makeText(`life-icon-${i}`, "●", "24px", HUD_THEME.lifeOn, "center");
      icon.width = "30px";
      icon.paddingLeft = "4px";
      icon.paddingRight = "4px";
      iconRow.addControl(icon);
    }

    const livesText = this.makeText("hud-lives-text", "3 lives", "15px", HUD_THEME.textPrimary, "right");

    livesPanel.addControl(livesLabel);
    livesPanel.addControl(iconRow);
    livesPanel.addControl(livesText);
    root.addControl(livesPanel);

    return root;
  }

  private createMenuScreen(): Rectangle {
    const overlay = this.makeFullscreenOverlay("menu-root", HUD_THEME.overlayBg, 0.72);

    const panel = new Rectangle("menu-panel");
    panel.width = "70%";
    panel.height = "68%";
    panel.background = HUD_THEME.panelBg;
    panel.cornerRadius = 16;
    panel.thickness = 1;
    panel.color = "#3D5770";

    const stack = new StackPanel("menu-stack");
    stack.isVertical = true;
    stack.spacing = 14;

    const titleImage = new Image("menu-title-image", "/title-screen.png");
    titleImage.width = "780px";
    titleImage.height = "300px";
    titleImage.stretch = Image.STRETCH_UNIFORM;
    titleImage.paddingBottom = "8px";
    titleImage.alpha = 0.95;

    const title = this.makeText("menu-title", "3D SPACE ROCKS", "64px", HUD_THEME.textPrimary, "center");
    title.fontWeight = "800";
    title.shadowBlur = 22;
    title.shadowColor = "#7DE7FF";

    const subtitle = this.makeText("menu-subtitle", "a Babylon.js demo", "24px", HUD_THEME.textMuted, "center");
    subtitle.alpha = 0.95;

    const prompt = this.makeText("menu-prompt", "Press ENTER to Start", "30px", HUD_THEME.textCyan, "center");
    prompt.fontWeight = "700";

    const highScore = this.makeText("menu-high-score", "HIGH SCORE: 000000", "24px", HUD_THEME.textPrimary, "center");
    highScore.paddingTop = "12px";

    stack.addControl(titleImage);
    stack.addControl(title);
    stack.addControl(subtitle);
    stack.addControl(prompt);
    stack.addControl(highScore);

    panel.addControl(stack);
    overlay.addControl(panel);
    this._ui.addControl(overlay);
    return overlay;
  }

  private createTransitionOverlay(): Rectangle {
    const overlay = this.makeFullscreenOverlay("transition-root", HUD_THEME.transitionBg, 0.58);
    overlay.isVisible = false;
    overlay.alpha = 0;

    const panel = new Rectangle("transition-panel");
    panel.width = "58%";
    panel.height = "28%";
    panel.cornerRadius = 12;
    panel.background = "#040B1ACC";
    panel.color = "#3B526C";
    panel.thickness = 1;

    const text = this.makeText("transition-text", "WAVE COMPLETE", "56px", HUD_THEME.textPrimary, "center");
    text.fontWeight = "800";
    panel.addControl(text);

    overlay.addControl(panel);
    this._ui.addControl(overlay);
    return overlay;
  }

  private createAreaCompleteOverlay(): Rectangle {
    const overlay = new Rectangle("area-complete-root");
    overlay.width = "58%";
    overlay.height = "16%";
    overlay.cornerRadius = 12;
    overlay.background = "#081A2ACC";
    overlay.color = "#5E8A4E";
    overlay.thickness = 2;
    overlay.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    overlay.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    overlay.paddingTop = "84px";
    overlay.isVisible = false;

    const text = this.makeText("area-complete-text", "AREA COMPLETE", "48px", "#C6FF8B", "center");
    text.fontWeight = "800";
    overlay.addControl(text);

    this._ui.addControl(overlay);
    return overlay;
  }

  private createPauseOverlay(): Rectangle {
    const overlay = this.makeFullscreenOverlay("pause-root", "#01050EB8", 0.64);
    overlay.isVisible = false;

    const panel = new Rectangle("pause-panel");
    panel.width = "42%";
    panel.height = "42%";
    panel.background = "#020A16E6";
    panel.cornerRadius = 12;
    panel.color = "#44607D";
    panel.thickness = 1;

    const stack = new StackPanel("pause-stack");
    stack.isVertical = true;
    stack.spacing = 14;

    const title = this.makeText("pause-title", "PAUSED", "48px", HUD_THEME.textPrimary, "center");
    title.fontWeight = "700";

    const resumeOption = this.makePauseOption("pause-resume", "Resume", () => {
      this.onResume?.();
    });

    const restartOption = this.makePauseOption("pause-restart", "Restart", () => {
      this.onRestart?.();
    });

    stack.addControl(title);
    stack.addControl(resumeOption);
    stack.addControl(restartOption);

    panel.addControl(stack);
    overlay.addControl(panel);
    this._ui.addControl(overlay);

    return overlay;
  }

  private createGameOverScreen(): Rectangle {
    const overlay = this.makeFullscreenOverlay("game-over-root", "#04060ECC", 0.7);
    overlay.isVisible = false;

    const stack = new StackPanel("game-over-stack");
    stack.isVertical = true;
    stack.spacing = 12;

    const title = this.makeText("game-over-title", "GAME OVER", "66px", HUD_THEME.textDanger, "center");
    title.fontWeight = "800";

    const score = this.makeText("game-over-score", "SCORE: 000000", "30px", HUD_THEME.textPrimary, "center");
    const highScore = this.makeText("game-over-high-score", "HIGH SCORE: 000000", "28px", HUD_THEME.textPrimary, "center");
    const prompt = this.makeText("game-over-prompt", "Press ENTER to Return to Menu", "24px", HUD_THEME.textMuted, "center");

    stack.addControl(title);
    stack.addControl(score);
    stack.addControl(highScore);
    stack.addControl(prompt);

    overlay.addControl(stack);
    this._ui.addControl(overlay);
    return overlay;
  }

  private createVictoryScreen(): Rectangle {
    const overlay = this.makeFullscreenOverlay("victory-root", "#020511BF", 0.68);
    overlay.isVisible = false;

    const panel = new Rectangle("victory-panel");
    panel.width = "68%";
    panel.height = "64%";
    panel.background = "#071429DE";
    panel.color = "#6E8FB8";
    panel.cornerRadius = 14;
    panel.thickness = 1;

    const stack = new StackPanel("victory-stack");
    stack.isVertical = true;
    stack.spacing = 12;

    const title = this.makeText("victory-title", "VICTORY!", "68px", HUD_THEME.textVictory, "center");
    title.fontWeight = "900";
    title.shadowBlur = 20;
    title.shadowColor = "#FFE27A";

    const score = this.makeText("victory-score", "SCORE: 000000", "30px", HUD_THEME.textPrimary, "center");
    const highScore = this.makeText("victory-high-score", "HIGH SCORE: 000000", "28px", HUD_THEME.textPrimary, "center");
    const prompt = this.makeText(
      "victory-prompt",
      "All areas cleared! Press ENTER for Menu",
      "24px",
      HUD_THEME.textCyan,
      "center"
    );

    stack.addControl(title);
    stack.addControl(score);
    stack.addControl(highScore);
    stack.addControl(prompt);

    panel.addControl(stack);
    overlay.addControl(panel);
    this._ui.addControl(overlay);
    return overlay;
  }

  private createLoadingOverlay(): Rectangle {
    const overlay = this.makeFullscreenOverlay("loading-root", "#01050EB3", 0.6);
    overlay.isVisible = false;

    const panel = new Rectangle("loading-panel");
    panel.width = "60%";
    panel.height = "26%";
    panel.background = "#020A16E0";
    panel.cornerRadius = 10;
    panel.color = "#3B526C";
    panel.thickness = 1;

    const stack = new StackPanel("loading-stack");
    stack.isVertical = true;
    stack.spacing = 10;

    const label = this.makeText("loading-label", "Loading Assets... 0%", "24px", HUD_THEME.textPrimary, "center");

    const barOuter = new Rectangle("loading-bar-outer");
    barOuter.width = "88%";
    barOuter.height = "28px";
    barOuter.cornerRadius = 8;
    barOuter.thickness = 1;
    barOuter.color = "#4A5F76";
    barOuter.background = "#0A1526";

    const barFill = new Rectangle("loading-fill");
    barFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    barFill.width = "0%";
    barFill.height = "100%";
    barFill.cornerRadius = 8;
    barFill.thickness = 0;
    barFill.background = "#7DE7FF";

    barOuter.addControl(barFill);
    stack.addControl(label);
    stack.addControl(barOuter);

    panel.addControl(stack);
    overlay.addControl(panel);

    this._ui.addControl(overlay);
    return overlay;
  }

  private makeText(
    name: string,
    text: string,
    fontSize: string,
    color: string,
    horizontal: "left" | "center" | "right"
  ): TextBlock {
    const block = new TextBlock(name, text);
    block.fontFamily = FONT_FAMILY;
    block.fontSize = fontSize;
    block.color = color;
    block.height = "42px";
    block.resizeToFit = true;

    if (horizontal === "left") {
      block.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    } else if (horizontal === "right") {
      block.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    } else {
      block.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    }

    return block;
  }

  private makeFullscreenOverlay(name: string, background: string, alpha: number): Rectangle {
    const overlay = new Rectangle(name);
    overlay.width = 1;
    overlay.height = 1;
    overlay.thickness = 0;
    overlay.background = background;
    overlay.alpha = alpha;
    overlay.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    overlay.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    return overlay;
  }

  private makePauseOption(name: string, label: string, onClick: () => void): Rectangle {
    const option = new Rectangle(name);
    option.width = "62%";
    option.height = "64px";
    option.cornerRadius = 8;
    option.background = "#0B1828CC";
    option.color = "#4C6177";
    option.thickness = 1;

    const text = this.makeText(`${name}-text`, label, "28px", HUD_THEME.textPrimary, "center");
    text.fontWeight = "700";
    option.addControl(text);

    option.onPointerClickObservable.add(() => {
      onClick();
    });

    return option;
  }

  private registerObserver<T>(observable: Observable<T>, observer: Observer<T>): void {
    this._subscriptions.push(() => observable.remove(observer));
  }

  private addTimeout(callback: () => void, delayMs: number): void {
    const handle = window.setTimeout(() => {
      const idx = this._timeouts.indexOf(handle);
      if (idx >= 0) {
        this._timeouts.splice(idx, 1);
      }
      callback();
    }, delayMs);
    this._timeouts.push(handle);
  }

  private clearTransientTimers(): void {
    while (this._timeouts.length > 0) {
      const timeout = this._timeouts.pop();
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  }

  private animateAlpha(control: Control, from: number, to: number, durationMs: number, onComplete?: () => void): void {
    const start = performance.now();
    control.alpha = from;
    let frameHandle = 0;

    const step = (now: number): void => {
      this._rafHandles.delete(frameHandle);

      const elapsed = now - start;
      const t = Math.max(0, Math.min(1, elapsed / durationMs));
      control.alpha = from + (to - from) * t;

      if (t < 1) {
        frameHandle = requestAnimationFrame(step);
        this._rafHandles.add(frameHandle);
      } else {
        onComplete?.();
      }
    };

    frameHandle = requestAnimationFrame(step);
    this._rafHandles.add(frameHandle);
  }

  private startMenuPromptPulse(): void {
    this.stopMenuPromptPulse();

    this._menuPulseObserver = this._scene.onBeforeRenderObservable.add(() => {
      const pulse = 0.65 + (Math.sin(performance.now() * 0.005) + 1) * 0.175;
      this._menuPrompt.alpha = pulse;
    });
  }

  private stopMenuPromptPulse(): void {
    if (this._menuPulseObserver !== null) {
      this._scene.onBeforeRenderObservable.remove(this._menuPulseObserver);
      this._menuPulseObserver = null;
    }
    this._menuPrompt.alpha = 1;
  }

  private formatScore(score: number): string {
    return score.toString().padStart(6, "0");
  }

  private readHighScore(): number {
    try {
      const stored = window.localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
      if (stored === null) {
        return 0;
      }
      const parsed = Number.parseInt(stored, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private findNamedTextBlock(root: Control, name: string): TextBlock {
    const control = this.findNamedControl(root, name);
    if (!(control instanceof TextBlock)) {
      throw new Error(`Expected TextBlock '${name}'`);
    }
    return control;
  }

  private findNamedRectangle(root: Control, name: string): Rectangle {
    const control = this.findNamedControl(root, name);
    if (!(control instanceof Rectangle)) {
      throw new Error(`Expected Rectangle '${name}'`);
    }
    return control;
  }

  private findNamedControl(root: Control, name: string): Control {
    const resolved = this.findNamedControlInternal(root, name);
    if (resolved === null) {
      throw new Error(`Missing GUI control '${name}'`);
    }
    return resolved;
  }

  private findNamedControlInternal(root: Control, name: string): Control | null {
    if (root.name === name) {
      return root;
    }

    if (root instanceof Container) {
      for (const child of root.children) {
        const nested = this.findNamedControlInternal(child, name);
        if (nested !== null) {
          return nested;
        }
      }
    }

    return null;
  }
}
