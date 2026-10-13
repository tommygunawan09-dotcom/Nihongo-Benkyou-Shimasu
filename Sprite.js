class Sprite {
  constructor(config) {

    // Set up the image
    this.image = new Image();
    this.image.src = config.src;
    
    // Properti ukuran manual (jika diisi)
    this.manualCutSizeX = config.cutSizeX;
    this.manualCutSizeY = config.cutSizeY;
    this.manualDrawSizeX = config.drawSizeX;
    this.manualDrawSizeY = config.drawSizeY;

    // Default awal sebelum image ter-load
    this.cutSizeX = this.manualCutSizeX || 32;
    this.cutSizeY = this.manualCutSizeY || 32;
    this.drawSizeX = this.manualDrawSizeX || this.cutSizeX;
    this.drawSizeY = this.manualDrawSizeY || this.cutSizeY;

    this.image.onload = () => {
      this.isLoaded = true;

      // Jika tidak diisi manual:
      // Spritesheet kendaraan biasanya 2 kolom x 2 baris (cols: 2, rows: 2)
      // Spritesheet karakter/NPC manusia Pizza Legends adalah 4 kolom x 4 baris (cols: 4, rows: 4)
      const defaultCols = config.src.includes("/Cars/") ? 2 : 4;
      const defaultRows = config.src.includes("/Cars/") ? 2 : 4;

      const cols = config.cols || defaultCols; 
      const rows = config.rows || defaultRows;

      if (this.image.naturalWidth > 0 && this.image.naturalHeight > 0) {
        this.cutSizeX = this.manualCutSizeX || (this.image.naturalWidth / cols);
        this.cutSizeY = this.manualCutSizeY || (this.image.naturalHeight / rows);
      }

      this.drawSizeX = this.manualDrawSizeX || this.cutSizeX;
      this.drawSizeY = this.manualDrawSizeY || this.cutSizeY;
    }

    // Shadow (Bisa dimatikan jika config.useShadow = false)
    this.useShadow = config.useShadow !== undefined ? config.useShadow : true;
    if (this.useShadow) {
      this.shadow = new Image();
      this.shadow.src = "/images/characters/shadow.png";
      this.shadow.onload = () => {
        this.isShadowLoaded = true;
      }
    }

    // Configure Animation & Initial State
    this.animations = config.animations || {
      "idle-down" : [ [0,0] ],
      "idle-right": [ [0,1] ],
      "idle-up"   : [ [0,2] ],
      "idle-left" : [ [0,3] ],
      "walk-down" : [ [1,0],[0,0],[3,0],[0,0] ],
      "walk-right": [ [1,1],[0,1],[3,1],[0,1] ],
      "walk-up"   : [ [1,2],[0,2],[3,2],[0,2] ],
      "walk-left" : [ [1,3],[0,3],[3,3],[0,3] ]
    }
    this.currentAnimation = config.currentAnimation || "idle-down";
    this.currentAnimationFrame = 0;

    this.animationFrameLimit = config.animationFrameLimit || 8;
    this.animationFrameProgress = this.animationFrameLimit;

    // Reference the game object
    this.gameObject = config.gameObject;
  }

  get frame() {
    return this.animations[this.currentAnimation][this.currentAnimationFrame];
  }

  setAnimation(key) {
    if (this.currentAnimation !== key) {
      this.currentAnimation = key;
      this.currentAnimationFrame = 0;
      this.animationFrameProgress = this.animationFrameLimit;
    }
  }

  updateAnimationProgress() {
    if (this.animationFrameProgress > 0) {
      this.animationFrameProgress -= 1;
      return;
    }

    this.animationFrameProgress = this.animationFrameLimit;
    this.currentAnimationFrame += 1;

    if (this.frame === undefined) {
      this.currentAnimationFrame = 0;
    }
  }

  draw(ctx, cameraPerson) {
    const x = this.gameObject.x - 8 + utils.withGrid(10.5) - cameraPerson.x;
    const y = this.gameObject.y - 18 + utils.withGrid(6) - cameraPerson.y;

    if (this.useShadow && this.isShadowLoaded) {
      ctx.drawImage(this.shadow, x, y);
    }

    const [frameX, frameY] = this.frame;

    if (this.isLoaded && this.cutSizeX > 0 && this.cutSizeY > 0) {
      ctx.drawImage(
        this.image,
        frameX * this.cutSizeX, frameY * this.cutSizeY,
        this.cutSizeX, this.cutSizeY,
        x, y,
        this.drawSizeX, this.drawSizeY
      );
    }

    this.updateAnimationProgress();
  }
}