// Using phaser to create the Neocities Simulator
// Author: Swapnil Srivastava
import './style.css';
import Phaser from 'phaser';
import io from 'socket.io-client';

// Accessing HTML elements by their IDs
const startButton = document.getElementById('startButton');
const gameStart = document.getElementById('gameStart');
const characterSelect = document.getElementById('characterSelect');
const police = document.getElementById('police');
const hazmat = document.getElementById('hazmat');
const fire = document.getElementById('fire');
const ready = document.getElementById('ready');
const gameCanvas = document.getElementById('gameCanvas');
const gameContainer = document.getElementById('game-container');
const eventsContainer = document.getElementById('events-container');

//Game canvas size
const sizes = {
    width: 100*16, //60 tiles of 16px width each
    height: 60*16 //60 tiles of 16px height each
  };
  
  //Locations
  const locations = {
    university: {
      x: 100,
      y: 0
    },
    policeStation: {
      x: 0,
      y: sizes.height*0.8
    },
    fireStation: {
      x: 0,
      y: sizes.height/2
    },
    hospital: {
      x: 0,
      y: sizes.height
    },
  }
  
  //Speeds
  const speedDown = 0;
  const carSpeed = 200;

  //Game timer
  let timer = 0;

  //Players
  let players = {};

  //Character selection
  let character = '';

  // This player's resources
  let resources = [];
  let resourceList;

  //Chat messages
  let chatMessages = [];
  
  export default class NeocitiesGame extends Phaser.Scene {
      preload() {
          console.log("Preloading assets...");
          
          // Load assets
          this.load.image('cityParts', 'assets/city_parts.png');
          this.load.tilemapTiledJSON('l1', 'assets/level_1.tmj');
          
          this.load.image('university', 'assets/university.png');
          this.load.image('policeStation', 'assets/police_station.png');
          this.load.image('fireStation', 'assets/fire_station.png');
          this.load.image('hospital', 'assets/hospital.png');
          this.load.image('burgerShop', 'assets/burger_shop.png');
          this.load.image('pond', 'assets/koipond2.png');

          // Load car sprite
          this.load.image('policeCar', 'assets/police_car.png');

          // Load html
          this.load.html('chatInput', 'assets/html/chat_input.html');
          this.load.html('resourceList', 'assets/html/resource_list.html');
          
      }
  
      create() {
          console.log("Creating the game...");

          this.socket = io('http://localhost:3000'); // Connect to the server
          // Listen for the current players
          this.socket.on('currentPlayers', (data) => {
            console.log('currentPlayers', data);
            players[data.id] = data;
          })

          this.resourceList = this.add.dom(sizes.width - (18*16), 50).createFromCache('resourceList');
          // Listen for the player selected event
          this.socket.on('resourcesAssigned', (data) => {
            console.log('resourcesAssigned', data);
            resources = data;
            resources.forEach(resource => {
              this.resourceList.getChildByID('resourceList').appendChild(document.createElement('p')).textContent = resource.name;
            })
          })

          // Create the tilemap
          const map = this.make.tilemap({ key: 'l1' })
          console.log("Tilemap created:", map);
          
          // Check if the tileset name matches the name in your Tiled map
          const tileset = map.addTilesetImage('city_parts', 'cityParts',16, 16,1,1);
          console.log("Tileset added:", tileset);
          
          // Create layers
          this.grass = map.createLayer('grass', tileset);
          this.water = map.createLayer('water', tileset);
          this.roads = map.createLayer('roads', tileset);
          this.sidewalks = map.createLayer('sidewalks', tileset);
          
          // Create buildings and other objects
          this.university = map.createFromObjects('buildings', {
              gid: 973,
              key: 'university'
          });
          this.policeStation = map.createFromObjects('buildings', {
              gid: 974,
              key: 'policeStation'
          });
          this.fireStation = map.createFromObjects('buildings', {
              gid: 975,
              key: 'fireStation'
          });
          this.hospital = map.createFromObjects('buildings', {
              gid: 976,
              key: 'hospital'
          });
          this.burgerShop = map.createFromObjects('buildings', {
              gid: 977,
              key: 'burgerShop'
          });
          this.pond = map.createFromObjects('buildings', {
              gid: 978,
              key: 'pond'
          });
          
          this.buildingsArray = [...this.university, ...this.policeStation, ...this.fireStation, ...this.hospital, ...this.burgerShop, ...this.pond];
          this.buildingsGroup = this.physics.add.group({
            collideWorldBounds: true,
            allowGravity: false,
            immovable: true
          });
          this.buildingsArray.forEach(building => {
            this.buildingsGroup.add(building);
            });
          
          this.buildingsGroup.children.iterate(building => { console.log("Building:", building.body.setSize(16,16));});

          console.log("Buildings and objects created.", this.buildingsGroup);

          // Create car sprite
          // Use methods to abstract the creation of different resources
          this.policeCar = this.physics.add.sprite(this.policeStation[0].x, this.policeStation[0].y - 80, 'policeCar').setDisplaySize(map.tileWidth * 1.7,map.tileHeight * 1.2).setFlipX(true).setOrigin(0, 0);
          this.policeCar.setCollideWorldBounds(true);
          this.policeCar.body.setSize(100,100);

          this.cursors = this.input.keyboard.createCursorKeys();

          // World
          this.physics.world.setBounds(0, 0, sizes.width, sizes.height);
          this.cameras.main.setBounds(0, 0, sizes.width, sizes.height);

          // Collider for sidewalks
          console.log("Adding collider for sidewalks...");
          this.physics.add.collider(this.policeCar, this.sidewalks);
          this.sidewalks.setCollisionByExclusion([-1]);

         //colliders for buildings
         this.physics.add.collider(this.policeCar, this.buildingsGroup, this.reachedBuilding, null, this);


         //Game clock
         this.gameClock = this.add.text(10,10, `Time: ${timer}`, { font: '20px Roboto', fill: '#000000', backgroundColor: '#ffffff', padding: 5});
         this.characterText = this.add.text(sizes.width-100,10, `${character}`, { font: '20px Roboto', fill: '#000000', backgroundColor: '#ffffff', padding: 5});

         // Chat box
        this.chatInput = this.add.dom(sizes.width - (40*16), sizes.height- (16*21)).createFromCache('chatInput');
        this.chatInput.addListener('click');
        this.chatInput.on('click', (event) => {
          if (event.target.name === 'sendChat') {
            console.log('Send chat clicked');
            const message = this.chatInput.getChildByName('chatInput').value;
            this.chatInput.getChildByName('chatInput').value = '';
            this.socket.emit('chatMessage', {message});
          }
        });
        
        this.socket.on('receiveMessage', ({sender, message}) => {
          console.log('receiveMessage', sender, message);
          chatMessages.push({sender, message});
          this.chatInput.getChildByID('chatMessages').appendChild(document.createElement('p')).textContent = `${sender.character}: ${message}`;
        })

         this.socket.on('timerUpdate', (time) => {
            this.gameClock.setText(`Time: ${time}`);
         });

         // Button callbacks
          startButton.addEventListener('click', () => {
            gameStart.style.display = 'none';
            characterSelect.style.display = 'block';
          });
          police.addEventListener('click', () => {
            character = 'police';
            this.characterText.setText(character.toUpperCase());
            this.socket.emit('playerSelected', 'police');
            ready.style.display = 'block';
          })
          hazmat.addEventListener('click', () => {
            character = 'hazmat';
            this.characterText.setText(character.toUpperCase());
            this.socket.emit('playerSelected', 'hazmat');
            ready.style.display = 'block';
          })
          fire.addEventListener('click', () => {
            character = 'fire';
            this.characterText.setText(character.toUpperCase());
            this.socket.emit('playerSelected', 'fire');
            ready.style.display = 'block';
          })
          // Ready button
          ready.addEventListener('click', () => {
            this.socket.emit('playerReady');
            characterSelect.style.display = 'none';
            gameContainer.style.display = 'flex';
            gameCanvas.style.display = 'block';
          })
      }
  
      update() {
          // Game update logic
          this.policeCar.body.velocity.x = 0;
          this.policeCar.body.velocity.y = 0;

          if (this.cursors.left.isDown) {
              this.policeCar.body.velocity.x = -carSpeed;
          } else if (this.cursors.right.isDown) {
              this.policeCar.body.velocity.x = carSpeed;
          }
            if (this.cursors.up.isDown) {
                this.policeCar.body.velocity.y = -carSpeed;
            } else if (this.cursors.down.isDown) {
                this.policeCar.body.velocity.y = carSpeed;
            }

      }
  }
  
  const config = {
      type: Phaser.WEBGL,
      width: sizes.width,
      height: sizes.height,
      parent: 'gameCanvas',
      physics: {
          default: 'arcade',
          arcade: {
              gravity: { y: 0 },
              debug: true
          }
      },
      dom: {
        createContainer: true
      },
      scene: [NeocitiesGame]
  };
  
  const game = new Phaser.Game(config);



