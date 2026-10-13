class DirectionInput {
  constructor() {
    this.heldDirections = [];

    this.map = {
      "ArrowUp": "up",
      "KeyW": "up",
      "ArrowDown": "down",
      "KeyS": "down",
      "ArrowLeft": "left",
      "KeyA": "left",
      "ArrowRight": "right",
      "KeyD": "right",
    }
  }

  get direction() {
    return this.heldDirections[0];
  }

  init() {
    // Keyboard Input
    document.addEventListener("keydown", e => {
      const dir = this.map[e.code];
      if (dir && this.heldDirections.indexOf(dir) === -1) {
        this.heldDirections.unshift(dir);
      }
    });
    document.addEventListener("keyup", e => {
      const dir = this.map[e.code];
      const index = this.heldDirections.indexOf(dir);
      if (index > -1) {
        this.heldDirections.splice(index, 1);
      }
    });

    // Touch D-Pad Input
    const bindTouchDir = (selector, dir) => {
      const btn = document.querySelector(selector);
      if (!btn) return;

      const handlePress = (e) => {
        e.preventDefault();
        if (this.heldDirections.indexOf(dir) === -1) {
          this.heldDirections.unshift(dir);
        }
      };

      const handleRelease = (e) => {
        e.preventDefault();
        const index = this.heldDirections.indexOf(dir);
        if (index > -1) {
          this.heldDirections.splice(index, 1);
        }
      };

      btn.addEventListener("touchstart", handlePress);
      btn.addEventListener("touchend", handleRelease);
      btn.addEventListener("mousedown", handlePress);
      btn.addEventListener("mouseup", handleRelease);
    };

    bindTouchDir(".dpad-up", "up");
    bindTouchDir(".dpad-down", "down");
    bindTouchDir(".dpad-left", "left");
    bindTouchDir(".dpad-right", "right");
  }
}