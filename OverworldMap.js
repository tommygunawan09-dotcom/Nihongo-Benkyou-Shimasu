// Helper untuk mengulang perintah walk (Aman dari referensi objek)
function repeatWalk(direction, count) {
  return Array.from({ length: count }, () => ({ type: "walk", direction: direction }));
}

class OverworldMap {
  constructor(config) {
    this.overworld = null;
    this.gameObjects = {}; // Live objects are in here
    this.configObjects = config.configObjects; // Configuration content

    this.rumahUtama = config.rumahUtama || {};
    this.walls = config.walls || {};

    this.lowerImage = new Image();
    this.lowerImage.src = config.lowerSrc;

    this.upperImage = new Image();
    this.upperImage.src = config.upperSrc;

    this.isCutscenePlaying = false;
    this.isPaused = false;
  }

  drawLowerImage(ctx, cameraPerson) {
    ctx.drawImage(
      this.lowerImage, 
      utils.withGrid(10.5) - cameraPerson.x, 
      utils.withGrid(6) - cameraPerson.y
    );
  }

  drawUpperImage(ctx, cameraPerson) {
    ctx.drawImage(
      this.upperImage, 
      utils.withGrid(10.5) - cameraPerson.x, 
      utils.withGrid(6) - cameraPerson.y
    );
  } 

  isSpaceTaken(currentX, currentY, direction) {
    const {x,y} = utils.nextPosition(currentX, currentY, direction);
    
    // 1. Cek tabrakan dengan Dinding (Walls)
    if (this.walls[`${x},${y}`]) {
      return true;
    }

    // 2. Cek tabrakan dengan Karakter/Objek Lain (Termasuk Hero & NPC)
    return Object.values(this.gameObjects).find(obj => {
      if (obj.x === x && obj.y === y) { return true; }
      if (obj.intentPosition && obj.intentPosition[0] === x && obj.intentPosition[1] === y ) {
        return true;
      }
      return false;
    });
  }

  // Mengembalikan objek/dinding spesifik yang menghalangi jalan
  getBlockingObject(currentX, currentY, direction, selfObj) {
    const {x,y} = utils.nextPosition(currentX, currentY, direction);
    
    // Cek apakah objek ini adalah Mobil atau Pedestrian
    const isVehicleOrPedestrian = selfObj && (
      selfObj.id.startsWith("car") || 
      selfObj.id.includes("vehicle") || 
      selfObj.isPedestrian
    );

    // 1. Cek Dinding (Hanya memblokir jika BUKAN mobil/pedestrian)
    if (!isVehicleOrPedestrian && this.walls[`${x},${y}`]) {
      return { isWall: true };
    }

    // 2. Cek Karakter / Objek lain (Mobil & Pedestrian TETAP mengecek Hero & NPC)
    return Object.values(this.gameObjects).find(obj => {
      if (obj === selfObj) return false; // Abaikan diri sendiri

      // Antar sesama Pedestrian -> Tetap tembus
      if (selfObj.isPedestrian && obj.isPedestrian) {
        return false;
      }

      if (obj.x === x && obj.y === y) { return true; }
      if (obj.intentPosition && obj.intentPosition[0] === x && obj.intentPosition[1] === y) {
        return true;
      }
      return false;
    });
  }

  mountObjects() {
    Object.keys(this.configObjects).forEach(key => {
      let object = JSON.parse(JSON.stringify(this.configObjects[key]));
      object.id = key;

      if (this.configObjects[key].animations) {
        object.animations = this.configObjects[key].animations;
      }
      if (this.configObjects[key].isPedestrian) {
        object.isPedestrian = this.configObjects[key].isPedestrian;
      }

      let instance;
      if (object.type === "Person") {
        instance = new Person(object);
      }
      if (object.type === "PizzaStone") {
        instance = new PizzaStone(object);
      }
      this.gameObjects[key] = instance;
      this.gameObjects[key].id = key;
      instance.mount(this);
    });
  }

  async startCutscene(events) {
    this.isCutscenePlaying = true;

    for (let i=0; i<events.length; i++) {
      const eventHandler = new OverworldEvent({
        event: events[i],
        map: this,
      });
      const result = await eventHandler.init();
      if (result === "LOST_BATTLE") {
        break;
      }
    }
    this.isCutscenePlaying = false;
  }

  checkForActionCutscene() {
    const hero = this.gameObjects["hero"];
    const nextCoords = utils.nextPosition(hero.x, hero.y, hero.direction);
    const match = Object.values(this.gameObjects).find(object => {
      return `${object.x},${object.y}` === `${nextCoords.x},${nextCoords.y}`;
    });
    if (!this.isCutscenePlaying && match && match.talking.length) {

      const relevantScenario = match.talking.find(scenario => {
        return (scenario.required || []).every(sf => {
          return playerState.storyFlags[sf];
        });
      });
      relevantScenario && this.startCutscene(relevantScenario.events);
    }
  }

  checkForFootstepCutscene() {
    const hero = this.gameObjects["hero"];
    const match = this.rumahUtama[ `${hero.x},${hero.y}` ];
    if (!this.isCutscenePlaying && match) {
      this.startCutscene( match[0].events );
    }
  }
}

window.OverworldMaps = {
  DemoRoom: {
    id: "DemoRoom",
    lowerSrc: "images/maps/DemoLower.png",
    upperSrc: "images/maps/DemoUpper.png",
    configObjects: {
      hero: {
        type: "Person",
        isPlayerControlled: true,
        x: utils.withGrid(5),
        y: utils.withGrid(6),
        src: "images/characters/people/hero.png",
        drawSizeX: 32,
        drawSizeY: 32,
        cols: 4,
        rows: 4,
      },
      npcA: {
        type: "Person",
        x: utils.withGrid(10),
        y: utils.withGrid(8),
        src: "images/characters/people/npc1.png",
        behaviorLoop: [
          { type: "walk", direction: "left", },
          { type: "walk", direction: "down", },
          { type: "walk", direction: "right", },
          { type: "walk", direction: "up", },
          { type: "stand", direction: "up", time: 400, },
        ],
        talking: [
          {
            required: ["TALKED_TO_ERIO"],
            events: [
              { type: "textMessage", text: "Isn't Erio the coolest?", faceHero: "npcA" },
            ]
          },
          {
            events: [
              { type: "textMessage", text: "I'm going to crush you!", faceHero: "npcA" },
              { type: "battle", enemyId: "beth" },
              { type: "addStoryFlag", flag: "DEFEATED_BETH"},
              { type: "textMessage", text: "You crushed me like weak pepper.", faceHero: "npcA" },
              { type: "textMessage", text: "Go away!"},
            ]
          }
        ]
      },
      npcC: {
        type: "Person",
        x: utils.withGrid(4),
        y: utils.withGrid(8),
        src: "images/characters/people/npc1.png",
        behaviorLoop: [
          { type: "stand", direction: "left", time: 500, },
          { type: "stand", direction: "down", time: 500, },
          { type: "stand", direction: "right", time: 500, },
          { type: "stand", direction: "up", time: 500, },
          { type: "walk", direction: "left",  },
          { type: "walk", direction: "down",  },
          { type: "walk", direction: "right",  },
          { type: "walk", direction: "up",  },
        ],
      },
      npcB: {
        type: "Person",
        x: utils.withGrid(8),
        y: utils.withGrid(5),
        src: "images/characters/people/erio.png",
        talking: [
          {
            events: [
              { type: "textMessage", text: "Bahaha!", faceHero: "npcB" },
              { type: "addStoryFlag", flag: "TALKED_TO_ERIO"}
            ]
          }
        ]
      },
      pizzaStone: {
        type: "PizzaStone",
        x: utils.withGrid(2),
        y: utils.withGrid(7),
        storyFlag: "USED_PIZZA_STONE",
        pizzas: ["v001", "f001"],
      },
    },
    walls: {
      [utils.asGridCoord(7,6)] : true,
      [utils.asGridCoord(8,6)] : true,
      [utils.asGridCoord(7,7)] : true,
      [utils.asGridCoord(8,7)] : true,
    },
    rumahUtama: {
      [utils.asGridCoord(7,4)]: [
        {
          events: [
            { who: "npcB", type: "walk",  direction: "left" },
            { who: "npcB", type: "stand",  direction: "up", time: 500 },
            { type: "textMessage", text:"You can't be in there!"},
            { who: "npcB", type: "walk",  direction: "right" },
            { who: "hero", type: "walk",  direction: "down" },
            { who: "hero", type: "walk",  direction: "left" },
          ]
        }
      ],
      [utils.asGridCoord(5,10)]: [
        {
          events: [
            { 
              type: "changeMap", 
              map: "Kitchen",
              x: utils.withGrid(2),
              y: utils.withGrid(2), 
              direction: "down"
            }
          ]
        }
      ]
    }
  },
  Kitchen: {
    id: "Kitchen",
    lowerSrc: "images/maps/KitchenLower.png",
    upperSrc: "images/maps/KitchenUpper.png",
    configObjects: {
      hero: {
        type: "Person",
        isPlayerControlled: true,
        x: utils.withGrid(10),
        y: utils.withGrid(10),
        src: "images/characters/people/hero.png",
        drawSizeX: 32,
        drawSizeY: 32,
        cols: 4,
        rows: 4,
      },
      kitchenNpcA: {
        type: "Person",
        x: utils.withGrid(5),
        y: utils.withGrid(12),
        direction: "up",
        src: "images/characters/people/npc8.png",
        talking: [
          {
            events: [
              { type: "textMessage", text: "** They don't want to talk to you **",},
            ]
          }
        ]
      },
      kitchenNpcB: {
        type: "Person",
        x: utils.withGrid(10),  // Pastikan koordinat awal tidak menabrak tembok dapur
        y: utils.withGrid(7),
        src: "images/characters/people/npc3.png",
        talking: [
          {
            events: [
              { type: "textMessage", text: "People take their jobs here very seriously.", faceHero: "kitchenNpcB" },
            ]
          }
        ],
        behaviorLoop: [
          ...utils.repeatWalk("right", 2, "kitchenNpcB"),
          { type: "stand", direction: "right", time: 200 },
          ...utils.repeatWalk("down", 2, "kitchenNpcB"),
          { type: "stand", direction: "down", time: 200 },
          ...utils.repeatWalk("left", 2, "kitchenNpcB"),
          { type: "stand", direction: "left", time: 200 },
          ...utils.repeatWalk("up", 2, "kitchenNpcB"),
          { type: "stand", direction: "up", time: 500 },
          { type: "stand", direction: "left", time: 500 },
        ]
      },
    },
rumahUtama: {
      [utils.asGridCoord(3,14)]: [
        {
          events: [
            { 
              type: "changeMap", 
              map: "DiningRoom",
              x: utils.withGrid(7),
              y: utils.withGrid(3),
              direction: "down"
            }
          ]
        }
      ],
      [utils.asGridCoord(10,15)]: [{
        disqualify: ["SEEN_INTRO"],
        events: [
          { type: "addStoryFlag", flag: "SEEN_INTRO" },
          
          utils.msg("* You are chopping ingredients on your first day as a Pizza Chef at a famed establishment in town. *"),
          
          ...utils.repeatWalk("right", 5, "kitchenNpcA"),
          ...utils.repeatWalk("down", 2, "kitchenNpcA"),
          { type: "stand", who: "kitchenNpcA", direction: "down", time: 200 },
          { type: "stand", who: "hero", direction: "up", time: 200 },

          ...utils.dialogGroup([
            ["Ahem. Is this your best work?", "kitchenNpcA"],
            ["These pepperonis are completely unstable! The pepper shapes are all wrong!", "kitchenNpcA"],
            ["Don't even get me started on the mushrooms.", "kitchenNpcA"],
            ["You will never make it in pizza!", "kitchenNpcA"],
          ]),

          { type: "stand", who: "kitchenNpcA", direction: "down", time: 200 },
          ...utils.repeatWalk("up", 1, "kitchenNpcA"),
          { type: "stand", who: "kitchenNpcA", direction: "up", time: 300 },
          { type: "stand", who: "hero", direction: "down", time: 400 },

          utils.msg("* The competition is fierce! You should spend some time leveling up your Pizza lineup and skills. *"),

          {
            type: "changeMap",
            map: "Street",
            x: utils.withGrid(21),
            y: utils.withGrid(12),
            direction: "down"
          },
        ]
      }]
    },
    walls: function() {
      let walls = {};

      // 1. Dinding Batas Luar Ruangan (X = 3 sampai 18, Y = 6 sampai 14)
      for (let x = 3; x <= 18; x++) {
        walls[utils.asGridCoord(x, 5)] = true;  // Batas Atas (Y = 5)

        // Batas Bawah (Y = 15): Diberi tembok kecuali pintu masuk/pintu keluar (misal di X = 10 dan 11)

      }
      for (let x = 8; x <= 13; x++) { walls[utils.asGridCoord(x, 16)] = true; }

      for (let y = 6; y <= 14; y++) {
        walls[utils.asGridCoord(2, y)] = true;   // Batas Kiri (X = 2)
        walls[utils.asGridCoord(19, y)] = true;  // Batas Kanan (X = 19)
      }

      // 2. Tembok/Halangan Perabotan Bagian Atas (Dapur, Meja, Kulkas)
      for (let x = 3; x <= 12; x++) {
        walls[utils.asGridCoord(x, 6)] = true;  // Area Dapur & Kabinet
      }

      // 3. Tembok Lemari Buku Kiri Tengah
      for (let x = 3; x <= 8; x++) { walls[utils.asGridCoord(x, 10)] = true; }

      // 4. Pembatas Pintu Geser / Kamar Tatami di Kanan Atas
      for (let y = 6; y <= 8; y++) {
        walls[utils.asGridCoord(14, y)] = true; // Sekat kayu vertikal
      }

      // 5. Sofa & Meja Ruang Tamu Kanan Bawah
      for (let y = 11; y <= 12; y++) {
        walls[utils.asGridCoord(13, y)] = true; // Sofa
      }
      walls[utils.asGridCoord(15, 11)] = true;  // Meja Tamu
      walls[utils.asGridCoord(15, 12)] = true;

      return walls;
    }()
  },
  Street: {
    id: "Street",
    lowerSrc: "images/maps/StreetLower.png",
    upperSrc: "images/maps/StreetUpper.png",
    configObjects: {
      hero: {
        type: "Person",
        isPlayerControlled: true,
        x: utils.withGrid(30),
        y: utils.withGrid(10),
        src: "images/characters/people/hero.png",
        drawSizeX: 32,
        drawSizeY: 32,
        cols: 4,
        rows: 4,
      },

      officeWorker: {
        type: "Person",
        x: utils.withGrid(-1),
        y: utils.withGrid(16),
        src: "images/characters/people/officeWorker.png",
        
        drawSizeX: 32,
        drawSizeY: 32,
        cols: 4,
        rows: 4,

        isPedestrian: true,

        behaviorLoop: [
          ...repeatWalk("right", 50),
          { type: "stand", direction: "right", time: 3000 },
          ...repeatWalk("left", 50),
          { type: "stand", direction: "left", time: 3000 },
        ],

        talking: [
          {
            events: [
              { type: "textMessage", text: "Aduh, jam istirahat makan siang saya sudah mau habis!", faceHero: "officeWorker" },
            ]
          }
        ]
      },
      npcSchool: {
        type: "Person",
        x: utils.withGrid(40),
        y: utils.withGrid(16),
        src: "images/characters/people/npcSchool.png",
        
        drawSizeX: 32,
        drawSizeY: 32,
        cols: 4,
        rows: 4,

        isPedestrian: true,

        behaviorLoop: [
          ...repeatWalk("left", 70),
          { type: "stand", direction: "left", time: 5000 },
          ...repeatWalk("right", 70),
          { type: "stand", direction: "right", time: 5000 },
        ],

        talking: [
          {
            events: [
              { type: "textMessage", text: "Permisi, mau lewat dulu ya!", faceHero: "officeWorker2" },
            ]
          }
        ]
      },
      carA: {
        type: "Person",
        x: utils.withGrid(-10),
        y: utils.withGrid(19),
        src: "images/characters/Cars/carBlue.png",
        useShadow: false,
        
        cutSizeX: 334,
        cutSizeY: 186,
        drawSizeX: 64,
        drawSizeY: 36,
        
        animations: {
          "idle-up"   : [ [0,0] ],
          "idle-down" : [ [1,0] ],
          "idle-left" : [ [0,1] ],
          "idle-right": [ [1,1] ],
          "walk-up"   : [ [0,0] ],
          "walk-down" : [ [1,0] ],
          "walk-left" : [ [0,1] ],
          "walk-right": [ [1,1] ],
        },
        
        behaviorLoop: [
          ...repeatWalk("right", 60),
          { type: "stand", direction: "right", time: 5000 },
          ...repeatWalk("down", 2),
          ...repeatWalk("left", 60),
          { type: "stand", direction: "left", time: 5000 },
          ...repeatWalk("up", 2),
        ]
      },

      carB: {
        type: "Person",
        x: utils.withGrid(-30),
        y: utils.withGrid(19),
        src: "images/characters/Cars/carBus.png",
        useShadow: false,
        
        drawSizeX: 110, 
        drawSizeY: 45,
        
        animations: {
          "idle-up"   : [ [0,0] ],
          "idle-down" : [ [1,0] ],
          "idle-left" : [ [0,1] ],
          "idle-right": [ [1,1] ],
          "walk-up"   : [ [0,0] ],
          "walk-down" : [ [1,0] ],
          "walk-left" : [ [0,1] ],
          "walk-right": [ [1,1] ],
        },
        behaviorLoop: [
          ...repeatWalk("right", 100),
          { type: "stand", direction: "right", time: 3000 },
          ...repeatWalk("down", 2),
          ...repeatWalk("left", 100),
          { type: "stand", direction: "left", time: 3000 },
          ...repeatWalk("up", 2),
        ]
      }, 

      carC: {
        type: "Person",
        x: utils.withGrid(36),
        y: utils.withGrid(18),
        src: "images/characters/Cars/carRed2.png",
        useShadow: false,
        
        cutSizeX: 334,
        cutSizeY: 186,
        drawSizeX: 64,
        drawSizeY: 36,
        
        animations: {
          "idle-up"   : [ [0,0] ],
          "idle-down" : [ [1,0] ],
          "idle-left" : [ [0,1] ],
          "idle-right": [ [1,1] ],
          "walk-up"   : [ [0,0] ],
          "walk-down" : [ [1,0] ],
          "walk-left" : [ [0,1] ],
          "walk-right": [ [1,1] ],
        },
        
        behaviorLoop: [
          ...repeatWalk("left", 90),
          { type: "stand", direction: "left", time: 2000 },
          ...repeatWalk("up", 2),
          ...repeatWalk("right", 90),
          { type: "stand", direction: "right", time: 2000 },
          ...repeatWalk("down", 2),
        ]
      },

      carSport: {
        type: "Person",
        x: utils.withGrid(40),
        y: utils.withGrid(21),
        src: "images/characters/Cars/carRed.png",
        useShadow: false,

        drawSizeX: 64,
        drawSizeY: 40,

        animations: {
          "idle-down" : [ [0,0] ],
          "idle-up"   : [ [1,0] ],
          "idle-left" : [ [0,1] ],
          "idle-right": [ [1,1] ],
          "walk-down" : [ [0,0] ],
          "walk-up"   : [ [1,0] ],
          "walk-left" : [ [0,1] ],
          "walk-right": [ [1,1] ],
        },

        behaviorLoop: [
          ...repeatWalk("left", 80),
          { type: "stand", direction: "left", time: 2000 },
          ...repeatWalk("up", 2),
          ...repeatWalk("right", 100),
          { type: "stand", direction: "right", time: 2000 },
          ...repeatWalk("down", 2),
        ]
      },

      streetNpcA: {
        type: "Person",
        x: utils.withGrid(9),
        y: utils.withGrid(11),
        src: "images/characters/people/npc2.png",
        behaviorLoop: [
          { type: "stand", direction: "right", time: 1400, },
          { type: "stand", direction: "up", time: 900, },
        ],
        talking: [
          {
            events: [
              { type: "textMessage", text: "All ambitious pizza chefs gather on Anchovy Avenue.", faceHero: "streetNpcA" },
            ]
          }
        ]
      },
      streetNpcB: {
        type: "Person",
        x: utils.withGrid(31),
        y: utils.withGrid(12),
        src: "images/characters/people/npc7.png",
        behaviorLoop: [
          { type: "stand", direction: "up", time: 400, },
          { type: "stand", direction: "left", time: 800, },
          { type: "stand", direction: "down", time: 400, },
          { type: "stand", direction: "left", time: 800, },
          { type: "stand", direction: "right", time: 800, },
        ],
        talking: [
          {
            events: [
              { type: "textMessage", text: "I can't decide on my favorite toppings.", faceHero: "streetNpcB" },
            ]
          }
        ]
      },
      streetNpcC: {
        type: "Person",
        x: utils.withGrid(22),
        y: utils.withGrid(10),
        src: "images/characters/people/npc8.png",
        talking: [
          {
            required: ["streetBattle"],
            events: [
              { type: "textMessage", text: "You are quite capable.", faceHero: "streetNpcC" },
            ]
          },
          {
            events: [
              { type: "textMessage", text: "You should have just stayed home!", faceHero: "streetNpcC" },
              { type: "battle", enemyId: "streetBattle" },
              { type: "addStoryFlag", flag: "streetBattle"},
            ]
          }
        ]
      },
    },
    walls: function() {
      let walls = {};

      // Tempelkan (paste) semua baris kode 'for' / 'walls[...]' hasil dari marker tool kamu di sini:
      for (let x = 0; x <= 39; x++) {
        walls[utils.asGridCoord(x, 6)] = true;   // Atas
        walls[utils.asGridCoord(x, 22)] = true;
      }
      for (let y = 6; y <= 15; y++) { walls[utils.asGridCoord(13, y)] = true; }
      for (let y = 6; y <= 15; y++) { walls[utils.asGridCoord(26, y)] = true; }
      for (let y = 0; y <= 15; y++) {
        walls[utils.asGridCoord(-1, y)] = true;   // Kiri
        walls[utils.asGridCoord(40, y)] = true;  // Kanan
      }
      for (let y = 18; y <= 22; y++) { walls[utils.asGridCoord(-1, y)] = true; }
      for (let x = 0; x <= 39; x++) {
  // Daftarkan koordinat X tempat gerbang berada
  const gerbangX = [7, 19, 20, 33]; 

  // Jika X saat ini BUKAN bagian dari gerbang, pasang tembok
  if (!gerbangX.includes(x)) {
    walls[utils.asGridCoord(x, 15)] = true;
  }
}

      // Tambahkan baris tembok untuk bangunan / pagar / tiang rumah Jepang baru kamu...

      return walls;
    }(),
    rumahUtama: {
      [utils.asGridCoord(5,9)]: [
        {
          events: [
            { 
              type: "changeMap",
              map: "DiningRoom",
              x: utils.withGrid(6),
              y: utils.withGrid(12),
              direction: "up"
            }
          ]
        }
      ],
      [utils.asGridCoord(29,9)]: [
        {
          events: [
            {
              type: "changeMap",
              map: "Shop",
              x: utils.withGrid(5),
              y: utils.withGrid(12),
              direction: "up"
            }
          ]
        }
      ],
      [utils.asGridCoord(25,5)]: [
        {
          events: [
            {
              type: "changeMap",
              map: "StreetNorth",
              x: utils.withGrid(7),
              y: utils.withGrid(16),
              direction: "up"
            }
          ]
        }
      ],
      // TRIGGER KE PARK UPPER DI POJOK KANAN TROTOAR (34,13)
      [utils.asGridCoord(39,16)]: [
        {
          events: [
            {
              type: "changeMap",
              map: "ParkUpper",
              x: utils.withGrid(0),
              y: utils.withGrid(15),
              direction: "right"
            }
          ]
        }
      ]
    }
  },

  ParkUpper: {
    id: "ParkUpper",
    lowerSrc: "images/maps/ParkLower.png", // Menggunakan file asli di folder maps
    upperSrc: "images/maps/ParkUpper.png", // Menggunakan file asli di folder maps
    configObjects: {
      hero: {
        type: "Person",
        isPlayerControlled: true,
        x: utils.withGrid(0),
        y: utils.withGrid(15),
        src: "images/characters/people/hero.png",
        drawSizeX: 32,
        drawSizeY: 32,
        cols: 4,
        rows: 4,
      },
    },
    walls: function() {
      let walls = {};

      // 1. Dinding Batas Luar Peta (Sesuaian Map Kamu)
      for (let x = 0; x <= 39; x++) {
        walls[utils.asGridCoord(x, -1)] = true;   // Atas

        // Bawah: Buka jalan khusus di Zebra Cross Tengah (X = 17 sampai 20)
        if (x < 17 || x > 23) {
          walls[utils.asGridCoord(x, 21)] = true;
        }
      }
      for (let y = 0; y <= 21; y++) {
        walls[utils.asGridCoord(-1, y)] = true;   // Kiri
        walls[utils.asGridCoord(40, y)] = true;  // Kanan
      }
      for (let x = 15; x <= 24; x++) { walls[utils.asGridCoord(x, 22)] = true; }
      // 2. Dinding Depan Bangunan Ke-1 (Atas: X=1..16 pada Y=4)
      for (let x = 1; x <= 16; x++) {
        if (x !== 8 && x !== 12) { // Pintu di X=5 dan X=11
          walls[utils.asGridCoord(x, 4)] = true;
        }
      }

      // 3. Dinding Samping Bangunan Ke-1 (Vertikal di X=16, Y=0..4)
      for (let y = 0; y <= 4; y++) {
        walls[utils.asGridCoord(16, y)] = true;
      }

      // 4. Dinding Depan Bangunan Ke-2 (Mendatar di Y=8, X=3..15)
      for (let x = 3; x <= 15; x++) {
        walls[utils.asGridCoord(x, 8)] = true;
      }
      for (let x = 4; x <= 14; x++) { 
        if (x !== 8 && x !== 12) {
          walls[utils.asGridCoord(x, 9)] = true; 
        }
      }
      // 5. Dinding Samping Bangunan Ke-2 (Vertikal X=3 & X=15)
      for (let y = 7; y <= 9; y++) {
        walls[utils.asGridCoord(3, y)] = true;  // Sisi Kiri
      }
      for (let y = 8; y <= 13; y++) {
        walls[utils.asGridCoord(15, y)] = true; // Sisi Kanan
      }

      // 6. Semak-Semak Bawah Bangunan Kiri (Y=13, dengan celah pintu di X=8)
      for (let x = 1; x <= 15; x++) {
        if (x < 7 || x > 9) {
          walls[utils.asGridCoord(x, 13)] = true;
        }
      }

      // 7. TEMBOK AREA TAMAN & SISI KANAN MAP
      for (let x = 24; x <= 28; x++) { walls[utils.asGridCoord(x, 13)] = true; } // Bawah Taman
      for (let x = 25; x <= 29; x++) { walls[utils.asGridCoord(x, 12)] = true; } // Tengah Taman
      for (let x = 23; x <= 24; x++) { walls[utils.asGridCoord(x, 8)] = true; }  // Atas Taman

      // Tembok Samping/Vertikal Kanan
      for (let y = 8; y <= 13; y++) {
        walls[utils.asGridCoord(23, y)] = true; // Sisi Kiri Taman
      }
      for (let x = 32; x <= 39; x++) { walls[utils.asGridCoord(x, 13)] = true; }
      for (let x = 36; x <= 39; x++) { walls[utils.asGridCoord(x, 5)] = true; }
      for (let y = 6; y <= 12; y++) { walls[utils.asGridCoord(36, y)] = true; }
      for (let y = 1; y <= 4; y++) { walls[utils.asGridCoord(36, y)] = true; }
      for (let y = 0; y <= 5; y++) { walls[utils.asGridCoord(23, y)] = true; }
      for (let y = 0; y <= 4; y++) { walls[utils.asGridCoord(39, y)] = true; }
      for (let x = 24; x <= 38; x++) { walls[utils.asGridCoord(x, 0)] = true; }
      return walls;
    }(),
    rumahUtama: {
      // Kembali ke Street jika berjalan keluar ke paling kiri (0, 10)
      [utils.asGridCoord(0,15)]: [
        {
          events: [
            {
              type: "changeMap",
              map: "Street",
              x: utils.withGrid(39),
              y: utils.withGrid(16),
              direction: "left"
            }
          ]
        }
      ]
    }
  },

  Shop: {
    id: "Shop",
    lowerSrc: "images/maps/PizzaShopLower.png",
    upperSrc: "images/maps/PizzaShopUpper.png",
    configObjects: {
      hero: {
        type: "Person",
        isPlayerControlled: true,
        x: utils.withGrid(3),
        y: utils.withGrid(7),
        src: "images/characters/people/hero.png",
        drawSizeX: 32,
        drawSizeY: 32,
        cols: 4,
        rows: 4,
      },
      shopNpcA: {
        type: "Person",
        x: utils.withGrid(6),
        y: utils.withGrid(5),
        src: "images/characters/people/erio.png",
        talking: [
          {
            events: [
              { type: "textMessage", text: "All of the chef rivalries have been good for business.", faceHero: "shopNpcA" },
            ]
          }
        ]
      },
      shopNpcB: {
        type: "Person",
        x: utils.withGrid(5),
        y: utils.withGrid(9),
        src: "images/characters/people/npc2.png",
        behaviorLoop: [
          { type: "stand", direction: "left", time: 400, },
        ],
        talking: [
          {
            events: [
              { type: "textMessage", text: "Which peel will make me a better chef?", faceHero: "shopNpcB" },
            ]
          }
        ]
      },
      pizzaStone: {
        type: "PizzaStone",
        x: utils.withGrid(1),
        y: utils.withGrid(4),
        storyFlag: "STONE_SHOP",
        pizzas: ["v002", "f002"],
      },
    },
    rumahUtama: {
      [utils.asGridCoord(5,12)]: [
        {
          events: [
            {
              type: "changeMap",
              map: "Street",
              x: utils.withGrid(29),
              y: utils.withGrid(9),
              direction: "down"
            }
          ]
        }
      ],
    },
    walls: {
      [utils.asGridCoord(2,4)]: true,
    }
  },
  GreenKitchen: {
    id: "GreenKitchen",
    lowerSrc: "images/maps/GreenKitchenLower.png",
    upperSrc: "images/maps/GreenKitchenUpper.png",
    configObjects: {
      hero: {
        type: "Person",
        isPlayerControlled: true,
        x: utils.withGrid(3),
        y: utils.withGrid(8),
        src: "images/characters/people/hero.png",
        drawSizeX: 32,
        drawSizeY: 32,
        cols: 4,
        rows: 4,
      },
      greenKitchenNpcA: {
        type: "Person",
        x: utils.withGrid(8),
        y: utils.withGrid(8),
        src: "images/characters/people/npc2.png",
        behaviorLoop: [
          { type: "stand", direction: "up", time: 400, },
          { type: "stand", direction: "left", time: 800, },
          { type: "stand", direction: "down", time: 400, },
          { type: "stand", direction: "left", time: 800, },
        ],
        talking: [
          {
            events: [
              { type: "textMessage", text: "Chef Rootie uses the best seasoning.", faceHero: "greenKitchenNpcA" },
            ]
          }
        ]
      },
      greenKitchenNpcB: {
        type: "Person",
        x: utils.withGrid(1),
        y: utils.withGrid(8),
        src: "images/characters/people/npc3.png",
        behaviorLoop: [
          { type: "stand", direction: "up", time: 900, },
          { type: "walk", direction: "down"},
          { type: "walk", direction: "down"},
          { type: "stand", direction: "right", time: 800, },
          { type: "stand", direction: "down", time: 400, },
          { type: "stand", direction: "right", time: 800, },
          { type: "walk", direction: "up"},
          { type: "walk", direction: "up"},
          { type: "stand", direction: "up", time: 600, },
          { type: "stand", direction: "right", time: 900, },
        ],
        talking: [
          {
            events: [
              { type: "textMessage", text: "Finally... a pizza place that gets me!", faceHero: "greenKitchenNpcB" },
            ]
          }
        ]
      },
      greenKitchenNpcC: {
        type: "Person",
        x: utils.withGrid(3),
        y: utils.withGrid(5),
        src: "images/characters/people/secondBoss.png",
        talking: [
          {
            required: ["chefRootie"],
            events: [ {type: "textMessage", faceHero:["greenKitchenNpcC"], text: "My veggies need more growth."} ]
          },
          {
            events: [
              { type: "textMessage", text: "Veggies are the fuel for the heart and soul!", faceHero: "greenKitchenNpcC" },
              { type: "battle", enemyId: "chefRootie", arena: "green-kitchen" },
              { type: "addStoryFlag", flag: "chefRootie"},
            ]
          }
        ]
      },
    },
    rumahUtama: {
      [utils.asGridCoord(5,12)]: [
        {
          events: [
            {
              type: "changeMap",
              map: "StreetNorth",
              x: utils.withGrid(7),
              y: utils.withGrid(5),
              direction: "down"
            }
          ]
        }
      ],
    },
    walls: {
      [utils.asGridCoord(1,4)]: true,
    }
  },
  StreetNorth: {
    id: "StreetNorth",
    lowerSrc: "images/maps/StreetNorthLower.png",
    upperSrc: "images/maps/StreetNorthUpper.png",
    configObjects: {
      hero: {
        type: "Person",
        isPlayerControlled: true,
        x: utils.withGrid(3),
        y: utils.withGrid(8),
        src: "images/characters/people/hero.png",
        drawSizeX: 32,
        drawSizeY: 32,
        cols: 4,
        rows: 4,
      },
      streetNorthNpcA: {
        type: "Person",
        x: utils.withGrid(9),
        y: utils.withGrid(6),
        src: "images/characters/people/npc1.png",
        behaviorLoop: [
          { type: "walk", direction: "left", },
          { type: "walk", direction: "down", },
          { type: "walk", direction: "right", },
          { type: "stand", direction: "right", time: 800, },
          { type: "walk", direction: "up", },
          { type: "stand", direction: "up", time: 400, },
        ],
        talking: [
          {
            events: [
              { type: "textMessage", text: "This place is famous for veggie pizzas!", faceHero: "streetNorthNpcA" },
            ]
          }
        ]
      },
      streetNorthNpcB: {
        type: "Person",
        x: utils.withGrid(4),
        y: utils.withGrid(12),
        src: "images/characters/people/npc3.png",
        behaviorLoop: [
          { type: "stand", direction: "up", time: 400, },
          { type: "stand", direction: "left", time: 800, },
          { type: "stand", direction: "down", time: 400, },
          { type: "stand", direction: "left", time: 800, },
          { type: "stand", direction: "right", time: 800, },
        ],
        talking: [
          {
            events: [
              { type: "textMessage", text: "I love the fresh smell of garlic in the air.", faceHero: "streetNorthNpcB" },
            ]
          }
        ]
      },
      streetNorthNpcC: {
        type: "Person",
        x: utils.withGrid(12),
        y: utils.withGrid(9),
        src: "images/characters/people/npc8.png",
        talking: [
          {
            required: ["streetNorthBattle"],
            events: [
              { type: "textMessage", text: "Could you be the Legendary one?", faceHero: "streetNorthNpcC" },
            ]
          },
          {
            events: [
              { type: "textMessage", text: "This is my turf!", faceHero: "streetNorthNpcC" },
              { type: "battle", enemyId: "streetNorthBattle" },
              { type: "addStoryFlag", flag: "streetNorthBattle"},
            ]
          }
        ]
      },
      pizzaStone: {
        type: "PizzaStone",
        x: utils.withGrid(2),
        y: utils.withGrid(9),
        storyFlag: "STONE_STREET_NORTH",
        pizzas: ["v001", "f001"],
      },
    },
    walls: {
      [utils.asGridCoord(2,7)]: true,
    },
    rumahUtama: {
      [utils.asGridCoord(7,5)]: [
        {
          events: [
            {
              type: "changeMap",
              map: "GreenKitchen",
              x: utils.withGrid(5),
              y: utils.withGrid(12),
              direction: "up"
            }
          ]
        }
      ],
      [utils.asGridCoord(7,16)]: [
        {
          events: [
            {
              type: "changeMap",
              map: "Street",
              x: utils.withGrid(25),
              y: utils.withGrid(5),
              direction: "down"
            }
          ]
        }
      ],
    }
  },
  DiningRoom: {
    id: "DiningRoom",
    lowerSrc: "images/maps/DiningRoomLower.png",
    upperSrc: "images/maps/DiningRoomUpper.png",
    configObjects: {
      hero: {
        type: "Person",
        isPlayerControlled: true,
        x: utils.withGrid(5),
        y: utils.withGrid(8),
        src: "images/characters/people/hero.png",
        drawSizeX: 32,
        drawSizeY: 32,
        cols: 4,
        rows: 4,
      },
      diningRoomNpcA: {
        type: "Person",
        x: utils.withGrid(12),
        y: utils.withGrid(8),
        src: "images/characters/people/npc8.png",
        talking: [
          {
            required: ["diningRoomBattle"],
            events: [
              { type: "textMessage", text: "Maybe I am not ready for this place.", faceHero: "diningRoomNpcA" },
            ]
          },
          {
            events: [
              { type: "textMessage", text: "You think you have what it takes to cook here?!", faceHero: "diningRoomNpcA" },
              { type: "battle", enemyId: "diningRoomBattle", arena: "dining-room" },
              { type: "addStoryFlag", flag: "diningRoomBattle"},
            ]
          }
        ]
      },
      diningRoomNpcB: {
        type: "Person",
        x: utils.withGrid(9),
        y: utils.withGrid(5),
        src: "images/characters/people/npc4.png",
        talking: [
          {
            events: [
              { type: "textMessage", text: "People come from all over to dine here.", faceHero: "diningRoomNpcB" },
            ]
          }
        ]
      },
      diningRoomNpcC: {
        type: "Person",
        x: utils.withGrid(2),
        y: utils.withGrid(8),
        src: "images/characters/people/npc7.png",
        behaviorLoop: [
          { type: "stand", direction: "right", time: 800, },
          { type: "stand", direction: "down", time: 700, },
          { type: "stand", direction: "right", time: 800, },
        ],
        talking: [
          {
            events: [
              { type: "textMessage", text: "I was so lucky to score a reservation!", faceHero: "diningRoomNpcC" },
            ]
          }
        ]
      },
      diningRoomNpcD: {
        type: "Person",
        x: utils.withGrid(8),
        y: utils.withGrid(9),
        src: "images/characters/people/npc1.png",
        behaviorLoop: [
          { type: "stand", direction: "right", time: 1200, },
          { type: "stand", direction: "down", time: 900, },
          { type: "stand", direction: "left", time: 800, },
          { type: "stand", direction: "down", time: 700, },
          { type: "stand", direction: "right", time: 400, },
          { type: "stand", direction: "up", time: 800, },
        ],
        talking: [
          {
            events: [
              { type: "textMessage", text: "I've been dreaming of this pizza for weeks!", faceHero: "diningRoomNpcD" },
            ]
          }
        ]
      },
    },
    rumahUtama: {
      [utils.asGridCoord(7,3)]: [
        {
          events: [
            {
              type: "changeMap",
              map: "Kitchen",
              x: utils.withGrid(5),
              y: utils.withGrid(10),
              direction: "up"
            }
          ]
        }
      ],
      [utils.asGridCoord(6,12)]: [
        {
          events: [
            {
              type: "changeMap",
              map: "Street",
              x: utils.withGrid(5),
              y: utils.withGrid(9),
              direction: "down"
            }
          ]
        }
      ],
    },
    walls: {
      [utils.asGridCoord(6,3)]: true,
    }
  },
};