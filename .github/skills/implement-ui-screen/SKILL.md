---
name: implement-ui-screen
description: >
  Create UI screens and overlay components using Babylon.js GUI for the 3D Space Rocks project.
  Use this skill when building HUD elements, menu screens, game-over screens, victory screens,
  pause menus, wave transition overlays, or loading indicators.
---

# Skill: Implement a UI Screen

You are creating a UI screen or overlay component for the 3D Space Rocks game using the Babylon.js GUI system (`@babylonjs/gui`).

---

## Process

### Step 1: Set Up the GUI Texture

All UI in this project uses a single `AdvancedDynamicTexture` fullscreen overlay:

```typescript
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";

const ui = AdvancedDynamicTexture.CreateFullscreenUI("gameUI");
```

This should be created once in `src/game/HUD.ts` and shared across all screens.

### Step 2: Choose the Screen Type

| Screen | Game State | Key Elements | Reference |
|--------|------------|--------------|-----------|
| **In-Game HUD** | `PLAYING` | Score, Lives, Wave/Area | H-02, W-08 |
| **Start Menu** | `MENU` | Title, "Press ENTER to Start" | H-03 |
| **Game Over** | `GAME_OVER` | Final score, high score, restart prompt | H-04 |
| **Victory** | `VICTORY` | Congratulations, final score | H-05 |
| **Pause Menu** | `PAUSED` | Resume, Restart buttons | H-08 |
| **Wave Overlay** | `WAVE_TRANSITION` | "Wave X" / "Wave X Complete" | H-06 |
| **Loading** | `LOADING` | Progress bar | H-07 |

### Step 3: Build the Screen

Use this pattern for each screen:

```typescript
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { Button } from "@babylonjs/gui/2D/controls/button";
import { Control } from "@babylonjs/gui/2D/controls/control";

// --- In-Game HUD Example ---
function createHUD(ui: AdvancedDynamicTexture): {
  scoreText: TextBlock;
  livesText: TextBlock;
  waveText: TextBlock;
} {
  // Score — top-left
  const scoreText = new TextBlock("score", "Score: 0");
  scoreText.color = "white";
  scoreText.fontSize = 24;
  scoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  scoreText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  scoreText.paddingLeft = "20px";
  scoreText.paddingTop = "20px";
  ui.addControl(scoreText);

  // Lives — top-right
  const livesText = new TextBlock("lives", "Lives: 3");
  livesText.color = "white";
  livesText.fontSize = 24;
  livesText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  livesText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  livesText.paddingRight = "20px";
  livesText.paddingTop = "20px";
  ui.addControl(livesText);

  // Wave/Area — top-center
  const waveText = new TextBlock("wave", "Area 1 — Wave 1");
  waveText.color = "white";
  waveText.fontSize = 20;
  waveText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  waveText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  waveText.paddingTop = "20px";
  ui.addControl(waveText);

  return { scoreText, livesText, waveText };
}

// --- Menu Screen Example ---
function createMenuScreen(ui: AdvancedDynamicTexture): Rectangle {
  const container = new Rectangle("menuContainer");
  container.width = "100%";
  container.height = "100%";
  container.background = "rgba(0, 0, 0, 0.7)";
  container.thickness = 0;

  const panel = new StackPanel("menuPanel");
  panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  container.addControl(panel);

  const title = new TextBlock("title", "3D SPACE ROCKS");
  title.color = "white";
  title.fontSize = 64;
  title.height = "80px";
  panel.addControl(title);

  const prompt = new TextBlock("prompt", "Press ENTER to Start");
  prompt.color = "#AAAAAA";
  prompt.fontSize = 28;
  prompt.height = "50px";
  panel.addControl(prompt);

  ui.addControl(container);
  return container;
}
```

### Step 4: Show/Hide Pattern

Each screen should have `show()` and `hide()` methods:

```typescript
export class HUD {
  private _menuScreen: Rectangle;
  private _gameOverScreen: Rectangle;
  // ...

  public showMenu(): void {
    this._menuScreen.isVisible = true;
    this._gameOverScreen.isVisible = false;
    // Hide other screens...
  }

  public showGameOver(score: number, highScore: number): void {
    this._menuScreen.isVisible = false;
    this._gameOverScreen.isVisible = true;
    this._finalScoreText.text = `Score: ${score}`;
    this._highScoreText.text = `High Score: ${highScore}`;
  }

  public updateHUD(score: number, lives: number, area: number, wave: number): void {
    this._scoreText.text = `Score: ${score}`;
    this._livesText.text = `Lives: ${lives}`;
    this._waveText.text = `Area ${area} — Wave ${wave}`;
  }
}
```

### Step 5: Accessibility

Apply these accessibility requirements to all UI elements:

1. **Contrast**: All text must meet WCAG 2.1 AA (≥ 4.5:1 contrast ratio). Use white text (`#FFFFFF`) on dark backgrounds (ACC-01).
2. **Focus Indicators**: Interactive buttons must have visible focus indicators (ACC-03).
3. **No Color-Only Communication**: Always pair color changes with text labels (ACC-04).
4. **Font Size**: Minimum 20px for HUD text, 24px+ for menu text (ACC-08).

```typescript
// Example: Button with focus indicator
const button = Button.CreateSimpleButton("resume", "Resume");
button.width = "200px";
button.height = "50px";
button.color = "white";
button.background = "#333333";
button.fontSize = 24;
button.cornerRadius = 5;
button.thickness = 2;  // Border for focus visibility
button.onPointerEnterObservable.add(() => {
  button.background = "#555555"; // Hover state
});
```

---

## Import Best Practices

Use specific `@babylonjs/gui` subpath imports:

```typescript
// ✅ Correct
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Button } from "@babylonjs/gui/2D/controls/button";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { Control } from "@babylonjs/gui/2D/controls/control";

// ❌ Incorrect
import * as GUI from "@babylonjs/gui";
```

---

## Reference

See [docs/PRD.md](../../../docs/PRD.md):

- **Section 7.3** — `AdvancedDynamicTexture.CreateFullscreenUI`
- **Section 8.7** — HUD / UI requirements (H-01 through H-08)
- **Section 11** — Accessibility requirements (ACC-01 through ACC-08)
- **Section 14** — Game states that need UI screens
