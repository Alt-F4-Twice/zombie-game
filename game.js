const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ===================== GAME STATE =====================
let state = "menu"; // menu, playing, paused, gameover

// ===================== PLAYER =====================
const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 20,
  speed: 4,
  hp: 100,
  maxHp: 100
};

// ===================== GLOBALS =====================
let bullets = [];
let zombies = [];
let particles = [];
let grenades = [];
let loot = [];

let score = 0;
let wave = 1;
let xp = 0;
let level = 1;

let highScore = localStorage.getItem("zombieHS") || 0;

let keys = {};
let mouse = { x: 0, y: 0 };

let firing = false;
let isReloading = false;
let reloadTimer = 0;

let shake = 0;

// ===================== WEAPONS =====================
const weapons = {
  pistol:  { fireRate: 300, damage: 25, bullets: 1, spread: 0.05, mag: 12, reloadTime: 3, recoil: 2 },
  shotgun: { fireRate: 900, damage: 12, bullets: 6, spread: 0.4, mag: 6, reloadTime: 5, recoil: 6 },
  rifle:   { fireRate: 100, damage: 18, bullets: 1, spread: 0.02, mag: 30, reloadTime: 4, recoil: 1 }
};

let currentWeapon = "pistol";

// ===================== NEW AMMO SYSTEM (PER GUN SAVE) =====================
let ammoStore = {
  pistol: weapons.pistol.mag,
  shotgun: weapons.shotgun.mag,
  rifle: weapons.rifle.mag
};

let lastShot = 0;

// ===================== INPUT =====================
window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;

  if (e.key.toLowerCase() === "e") firing = true;

  if (state === "menu" && e.code === "Space") startGame();
  if (state === "gameover" && e.code === "Space") restartGame();

  if (e.key === "1") switchWeapon("pistol");
  if (e.key === "2") switchWeapon("shotgun");
  if (e.key === "3") switchWeapon("rifle");

  if (e.key.toLowerCase() === "r") reload();
  if (e.key.toLowerCase() === "g") throwGrenade();

  if (e.key === "Escape") {
    state = state === "playing" ? "paused" : "playing";
  }
});

window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
  if (e.key.toLowerCase() === "e") firing = false;
});

canvas.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

// ===================== WEAPON SYSTEM =====================
function switchWeapon(name) {
  currentWeapon = name;
}

// ===================== SMART RELOAD (YOUR MATH SYSTEM) =====================
function reload() {
  const w = weapons[currentWeapon];
  const currentAmmo = ammoStore[currentWeapon];

  // already full mag
  if (currentAmmo >= w.mag) return;

  if (isReloading) return;

  const missing = w.mag - currentAmmo;
  const fraction = missing / w.mag;

  const totalFrames = w.reloadTime * 60;
  reloadTimer = Math.floor(totalFrames * fraction);

  isReloading = true;
}

// ===================== SHOOT =====================
function shoot() {
  if (state !== "playing") return;
  if (isReloading) return;

  const w = weapons[currentWeapon];
  const now = Date.now();

  if (now - lastShot < w.fireRate) return;
  if (ammoStore[currentWeapon] <= 0) return;

  ammoStore[currentWeapon]--;
  lastShot = now;

  for (let i = 0; i < w.bullets; i++) {
    let angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    angle += (Math.random() - 0.5) * w.spread;

    bullets.push({
      x: player.x,
      y: player.y,
      dx: Math.cos(angle) * 10,
      dy: Math.sin(angle) * 10,
      damage: w.damage
    });
  }

  shake = w.recoil;
}

// ===================== GRENADE =====================
function throwGrenade() {
  if (state !== "playing") return;

  grenades.push({
    x: player.x,
    y: player.y,
    timer: 60
  });
}

// ===================== ZOMBIES =====================
function spawnZombie() {
  zombies.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: 20,
    hp: 50,
    speed: 1
  });
}

// ===================== WAVES =====================
function startWave() {
  for (let i = 0; i < wave * 5; i++) spawnZombie();
}

// ===================== GAME LOOP =====================
function update() {
  requestAnimationFrame(update);

  if (state === "menu") return drawMenu();
  if (state === "paused") return drawPause();
  if (state === "gameover") return drawGameOver();

  // movement
  if (keys["w"]) player.y -= player.speed;
  if (keys["s"]) player.y += player.speed;
  if (keys["a"]) player.x -= player.speed;
  if (keys["d"]) player.x += player.speed;

  if (firing) shoot();

  // reload logic
  if (isReloading) {
    reloadTimer--;
    if (reloadTimer <= 0) {
      ammoStore[currentWeapon] = weapons[currentWeapon].mag;
      isReloading = false;
    }
  }

  // bullets
  bullets.forEach((b, i) => {
    b.x += b.dx;
    b.y += b.dy;
    if (b.x < 0 || b.y < 0 || b.x > canvas.width || b.y > canvas.height)
      bullets.splice(i, 1);
  });

  // zombies AI
  zombies.forEach((z, zi) => {
    let dx = player.x - z.x;
    let dy = player.y - z.y;
    let dist = Math.hypot(dx, dy);

    z.x += (dx / dist) * z.speed;
    z.y += (dy / dist) * z.speed;

    if (dist < 20) player.hp -= 0.5;

    bullets.forEach((b, bi) => {
      if (Math.hypot(b.x - z.x, b.y - z.y) < 15) {
        z.hp -= b.damage;
        bullets.splice(bi, 1);

        if (z.hp <= 0) {
          zombies.splice(zi, 1);
          score += 10;
          xp += 20;
        }
      }
    });
  });

  // grenades
  grenades.forEach((g, gi) => {
    g.timer--;

    if (g.timer <= 0) {
      zombies.forEach((z, zi) => {
        if (Math.hypot(z.x - g.x, z.y - g.y) < 120) {
          z.hp -= 100;
        }
      });

      grenades.splice(gi, 1);
    }
  });

  // level system
  if (xp >= level * 100) {
    xp = 0;
    level++;
    player.hp = player.maxHp;
  }

  // wave system
  if (zombies.length === 0) {
    wave++;
    startWave();
  }

  if (player.hp <= 0) {
    state = "gameover";
    highScore = Math.max(highScore, score);
    localStorage.setItem("zombieHS", highScore);
  }

  draw();
}

// ===================== DRAW =====================
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // player
  ctx.fillStyle = "cyan";
  ctx.fillRect(player.x, player.y, player.size, player.size);

  // zombies
  ctx.fillStyle = "green";
  zombies.forEach(z => ctx.fillRect(z.x, z.y, z.size, z.size));

  // bullets
  ctx.fillStyle = "yellow";
  bullets.forEach(b => ctx.fillRect(b.x, b.y, 4, 4));

  // grenades
  ctx.fillStyle = "red";
  grenades.forEach(g => ctx.fillRect(g.x, g.y, 6, 6));

  let reloadText = isReloading
    ? ` Reload(${Math.ceil(reloadTimer / 60)})`
    : "";

  document.getElementById("stats").innerText =
    `HP:${player.hp} Score:${score} HS:${highScore} Wave:${wave} Lvl:${level}
Ammo:${ammoStore[currentWeapon]}/${weapons[currentWeapon].mag}${reloadText}`;
}

// ===================== MENUS =====================
function drawMenu() {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.font = "40px Arial";
  ctx.fillText("ZOMBIE SURVIVAL", 300, 300);
  ctx.fillText("Press SPACE", 350, 360);
}

function drawPause() {
  draw();
  ctx.fillStyle = "white";
  ctx.fillText("PAUSED", 400, 300);
}

function drawGameOver() {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  ctx.font = "40px Arial";
  ctx.fillText("GAME OVER", 350, 300);
  ctx.fillText("Score: " + score, 350, 350);
  ctx.fillText("Press SPACE", 350, 400);
}

// ===================== CONTROL =====================
function startGame() {
  state = "playing";
  startWave();
}

function restartGame() {
  player.hp = 100;
  score = 0;
  wave = 1;
  xp = 0;
  level = 1;

  bullets = [];
  zombies = [];
  grenades = [];

  ammoStore = {
    pistol: weapons.pistol.mag,
    shotgun: weapons.shotgun.mag,
    rifle: weapons.rifle.mag
  };

  state = "playing";
  startWave();
}

update();
