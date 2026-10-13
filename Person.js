class Person extends GameObject {
  constructor(config) {
    super(config);
    this.movingProgressRemaining = 0;
    this.isStanding = false;
    this.intentPosition = null; // [x,y]

    this.isPlayerControlled = config.isPlayerControlled || false;
    this.isPedestrian = config.isPedestrian || false;

    // Timer untuk fitur tembus ala Stardew Valley
    this.blockedTime = 0;
    this.blockedTimer = null;

    this.directionUpdate = {
      "up": ["y", -1],
      "down": ["y", 1],
      "left": ["x", -1],
      "right": ["x", 1],
    };
    this.standBehaviorTimeout;
  }

  update(state) {
    if (this.movingProgressRemaining > 0) {
      this.updatePosition();
    } else {
      if (!state.map.isCutscenePlaying && this.isPlayerControlled && state.arrow) {
        this.startBehavior(state, {
          type: "walk",
          direction: state.arrow
        });
      }
      this.updateSprite(state);
    }
  }

startBehavior(state, behavior) {
    if (!this.isMounted) {
      return;
    }

    this.direction = behavior.direction;
    
    if (behavior.type === "walk") {
      // Cek apakah posisi tujuan terhalang
      const blockingObject = state.map.getBlockingObject(this.x, this.y, this.direction, this);

      // Logika khusus Pejalan Kaki (isPedestrian)
      if (this.isPedestrian) {
        // Jika terhalang Hero & belum lewat 3 detik, NPC wajib menunggu
        if (blockingObject && blockingObject.isPlayerControlled && this.blockedTime < 3000) {
          if (!this.blockedTimer) {
            const startTime = Date.now();
            this.blockedTimer = setInterval(() => {
              this.blockedTime = Date.now() - startTime;
            }, 100);
          }

          // Coba melangkah lagi secara berkala sampai Hero geser / timer 3 detik habis
          behavior.retry && setTimeout(() => {
            this.startBehavior(state, behavior);
          }, 10);
          return;
        }

        // Jika tidak terhalang Hero ATAU waktu tunggu sudah > 3 detik -> Reset timer & LANGSUNG JALAN
        if (this.blockedTimer) {
          clearInterval(this.blockedTimer);
          this.blockedTimer = null;
        }
        this.blockedTime = 0;
      } 
      // Logika untuk Karakter Biasa, Mobil, & Hero
      else if (blockingObject) {
        behavior.retry && setTimeout(() => {
          this.startBehavior(state, behavior);
        }, 500);
        return;
      }

      // Mulai berjalan!
      this.movingProgressRemaining = 16;

      const intentPosition = utils.nextPosition(this.x, this.y, this.direction);
      this.intentPosition = [
        intentPosition.x,
        intentPosition.y,
      ];

      this.updateSprite(state);
    }

    if (behavior.type === "stand") {
      this.isStanding = true;
      
      if (this.standBehaviorTimeout) {
        clearTimeout(this.standBehaviorTimeout);
      }
      this.standBehaviorTimeout = setTimeout(() => {
        utils.emitEvent("PersonStandComplete", {
          whoId: this.id
        });
        this.isStanding = false;
      }, behavior.time);
    }
  }

  updatePosition() {
    const [property, change] = this.directionUpdate[this.direction];
    this[property] += change;
    this.movingProgressRemaining -= 1;

    if (this.movingProgressRemaining === 0) {
      this.intentPosition = null;
      utils.emitEvent("PersonWalkingComplete", {
        whoId: this.id
      });
    }
  }

  updateSprite() {
    if (this.movingProgressRemaining > 0) {
      this.sprite.setAnimation("walk-"+this.direction);
      return;
    }
    this.sprite.setAnimation("idle-"+this.direction);    
  }
}