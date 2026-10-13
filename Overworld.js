// Helper fungsi untuk menggambar kotak overlay koordinat & status penanda tembok
function drawDebugOverlay(ctx, map, overworld) {
  const hero = map?.gameObjects?.hero;
  if (!hero) return;

  const gridX = Math.floor(hero.x / 16);
  const gridY = Math.floor(hero.y / 16);

  // Geser posisi X dari 6 ke 120 agar tidak bertabrakan dengan D-Pad
  const startX = 120;
  const startY = 6;
  const boxWidth = 160;
  const boxHeight = 58;

  ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
  ctx.fillRect(startX, startY, boxWidth, boxHeight);

  ctx.strokeStyle = "#00FF00";
  ctx.lineWidth = 1;
  ctx.strokeRect(startX, startY, boxWidth, boxHeight);

  ctx.fillStyle = "#00FF00";
  ctx.font = "bold 11px monospace";
  ctx.fillText(`Grid : X:${gridX}, Y:${gridY}`, startX + 6, startY + 14);

  const totalPairs = overworld?.savedCodeLines?.length || 0;
  const currentPoints = overworld?.selectedPoints?.length || 0;

  if (totalPairs > 0 || currentPoints > 0) {
    ctx.fillStyle = "#FFCC00";
    ctx.fillText(`Tersimpan: ${totalPairs} Blok Tembok`, startX + 6, startY + 29);
    ctx.fillText(`[Klik A 2x di tempat = Finish]`, startX + 6, startY + 43);
  } else {
    ctx.fillStyle = "#00FF00";
    ctx.fillText(`Mode : Multi-Marker (A Only)`, startX + 6, startY + 29);
    ctx.fillText(`[Tekan A = Tandai Titik]`, startX + 6, startY + 43);
  }
}

class Overworld {
  constructor(config) {
    this.element = config.element;
    this.canvas = this.element.querySelector(".game-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.map = null;

    this.selectedPoints = [];
    this.savedCodeLines = []; // Menyimpan semua baris kode gabungan
  }

  startGameLoop() {
    let fps = 60;
    let fpsInterval = 1000 / fps;
    let then = performance.now();

    const step = (now) => {
      if (!this.map.isPaused) {
        requestAnimationFrame(step);
      }

      let elapsed = now - then;

      // Hanya proses pergerakan & render jika sudah mencapai target interval 60 FPS
      if (elapsed > fpsInterval) {
        then = now - (elapsed % fpsInterval);

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const cameraPerson = this.map.gameObjects.hero;

        // Update semua posisi objek
        Object.values(this.map.gameObjects).forEach(object => {
          object.update({
            arrow: this.directionInput.direction,
            map: this.map,
          });
        });

        // Draw Lower Layer Map
        this.map.drawLowerImage(this.ctx, cameraPerson);

        const mapCanvasX = utils.withGrid(10.5) - cameraPerson.x;

        // Draw Karakter, Mobil, & NPC (Z-indexing berdasarkan posisi Y)
        Object.values(this.map.gameObjects).sort((a,b) => a.y - b.y).forEach(object => {
          if (object.id.startsWith("car") || object.id.includes("vehicle") || object.isPedestrian) {
            const screenX = object.x - 8 + mapCanvasX;
            
            // PERBAIKAN: Perlebar batas culling kiri & kanan agar tidak memotong NPC di X=4 / X=33
            const leftBoundary = mapCanvasX + utils.withGrid(-1);  // Luar layar sebelah kiri
            const rightBoundary = mapCanvasX + utils.withGrid(39); // Luar layar sebelah kanan
            
            if (screenX < leftBoundary || screenX > rightBoundary) return;
          }
          object.sprite.draw(this.ctx, cameraPerson);
        });

        // Draw Upper Layer Map & Debug Tool Overlay
        this.map.drawUpperImage(this.ctx, cameraPerson);
        drawDebugOverlay(this.ctx, this.map, this);
      }
    };

    requestAnimationFrame(step);
  }

  bindActionInput() {
    new KeyPressListener("Enter", () => {
      const hero = this.map?.gameObjects?.hero;
      if (!hero) return;

      const gridX = Math.floor(hero.x / 16);
      const gridY = Math.floor(hero.y / 16);

      // JIKA TEKAN A 2X DI TITIK YANG SAMA = FINISH & TAMPILKAN KODE
      const lastPoint = this.selectedPoints[this.selectedPoints.length - 1];
      if (lastPoint && lastPoint.x === gridX && lastPoint.y === gridY) {
        if (this.savedCodeLines.length > 0) {
          const finalCode = this.savedCodeLines.join("\n");
          if (navigator.clipboard) {
            navigator.clipboard.writeText(finalCode);
          }
          prompt(`Semua Kode Tembok Berhasil Digabung & Disalin!`, finalCode);
          
          // Reset setelah selesai
          this.selectedPoints = [];
          this.savedCodeLines = [];
        }
        return;
      }

      // SIMPAN TITIK BARU
      this.selectedPoints.push({ x: gridX, y: gridY });

      // JIKA SUDAH DAPAT 2 TITIK (LENGKAP 1 PASANG TEMBOK)
      if (this.selectedPoints.length === 2) {
        const p1 = this.selectedPoints[0];
        const p2 = this.selectedPoints[1];

        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);

        // Pasang tembok langsung di peta
        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            this.map.walls[utils.asGridCoord(x, y)] = true;
          }
        }

        // Susun baris kode untuk pasangan ini
        if (minY === maxY && minX !== maxX) {
          this.savedCodeLines.push(`for (let x = ${minX}; x <= ${maxX}; x++) { walls[utils.asGridCoord(x, ${minY})] = true; }`);
        } else if (minX === maxX && minY !== maxY) {
          this.savedCodeLines.push(`for (let y = ${minY}; y <= ${maxY}; y++) { walls[utils.asGridCoord(${minX}, y)] = true; }`);
        } else if (minX === maxX && minY === maxY) {
          this.savedCodeLines.push(`walls[utils.asGridCoord(${minX}, ${minY})] = true;`);
        } else {
          this.savedCodeLines.push(`for (let x = ${minX}; x <= ${maxX}; x++) {\n  for (let y = ${minY}; y <= ${maxY}; y++) {\n    walls[utils.asGridCoord(x, y)] = true;\n  }\n}`);
        }

        // Reset array pasangan untuk lanjut ke pasangan tembok berikutnya
        this.selectedPoints = [];
      }

      this.map.checkForActionCutscene();
    });

    new KeyPressListener("Escape", () => {
      if (!this.map.isCutscenePlaying) {
        this.map.startCutscene([{ type: "pause" }]);
      }
    });
  }

  bindHeroPositionCheck() {
    document.addEventListener("PersonWalkingComplete", e => {
      if (e.detail.whoId === "hero") {
        this.map.checkForFootstepCutscene();
      }
    });
  }

  startMap(mapConfig, heroInitialState=null) {
    this.map = new OverworldMap(mapConfig);
    this.map.overworld = this;
    this.map.mountObjects();

    if (heroInitialState) {
      const {hero} = this.map.gameObjects;
      hero.x = heroInitialState.x;
      hero.y = heroInitialState.y;
      hero.direction = heroInitialState.direction;
    }

    this.progress.mapId = mapConfig.id;
    this.progress.startingHeroX = this.map.gameObjects.hero.x;
    this.progress.startingHeroY = this.map.gameObjects.hero.y;
    this.progress.startingHeroDirection = this.map.gameObjects.hero.direction;
  }

  async init() {
    const container = document.querySelector(".game-container");

    this.progress = new Progress();

    this.titleScreen = new TitleScreen({
      progress: this.progress
    });
    const useSaveFile = await this.titleScreen.init(container);

    let initialHeroState = null;
    if (useSaveFile) {
      this.progress.load();
      initialHeroState = {
        x: this.progress.startingHeroX,
        y: this.progress.startingHeroY,
        direction: this.progress.startingHeroDirection,
      };
    }

    this.hud = new Hud();
    this.hud.init(container);

    this.startMap(window.OverworldMaps[this.progress.mapId], initialHeroState);

    this.bindActionInput();
    this.bindHeroPositionCheck();

    this.directionInput = new DirectionInput();
    this.directionInput.init();

    this.startGameLoop();
  }
}