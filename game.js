const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ---------------- PLAYER ----------------
const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 20,
  speed: 4,
  hp: 100
};

// ---------------- STATE ----------------
let bullets = [];
let zombies = [];
let particles = [];
let grenades = [];
let keys = {};
let mouse = { x: 0, y: 0 };

let score = 0;
let wave = 1;
let shake = 0;
let gameOver = false;

// shooting / reload state
let firing = false;
let isReloading = false;
let reloadTimer = 0;

let ammo = 0;
let lastShot = 0;

// ---------------- MAP ----------------
const walls = [
  { x: 300, y: 200, w: 200, h: 20 },
  { x: 600, y: 400, w: 20, h: 200 },
  { x: 900, y: 150, w: 150, h: 20 }
];

// ---------------- WEAPONS ----------------
const weapons = {
  pistol:  { fireRate: 300, damage: 25, bullets: 1, spread: 0.05, mag: 12, reloadTime: 3 },
  shotgun: { fireRate: 900, damage: 12, bullets: 6, spread: 0.4, mag: 6, reloadTime: 5 },
  rifle:   { fireRate: 100, damage: 18, bullets: 1, spread: 0.02, mag: 30, reloadTime: 4 }
};

let currentWeapon = "pistol";
ammo = weapons[currentWeapon].mag;

// ---------------- INPUT ----------------
window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;

  if (e.key.toLowerCase() === "e") firing = true;

  if (e.key === "1") switchWeapon("pistol");
  if (e.key === "2") switchWeapon("shotgun");
  if (e.key === "3") switchWeapon("rifle");

  if (e.key.toLowerCase() === "r") reload();
  if (e.key.toLowerCase() === "g") throwGrenade();

  if (gameOver && e.code === "Space") restartGame();
});

window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
  if (e.key.toLowerCase() === "e") firing = false;
});

canvas.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

// ---------------- WEAPON CONTROL ----------------
function switchWeapon(name) {
  currentWeapon = name;
  ammo = weapons[name].mag;
}

function reload() {
  if (isReloading) return;

  isReloading = true;
  reloadTimer = weapons[currentWeapon].reloadTime * 60;
}

function shoot() {
  if (gameOver || isReloading) return;

  const now = Date.now();
  const w = weapons[currentWeapon];

  if (now - lastShot < w.fireRate) return;
  if (ammo <= 0) return;

  ammo--;
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
}

// ---------------- GRENADE ----------------
function throwGrenade() {
  if (gameOver) return;

  grenades.push({
    x: player.x,
    y: player.y,
    timer: 60
  });
}

// ---------------- ZOMBIES ----------------
function spawnZombie() {
  let side = Math.floor(Math.random() * 4);
  let speed = Math.random() < 0.2 ? 2 : 1;

  let x, y;
  if (side === 0) { x = 0; y = Math.random() * canvas.height; }
  if (side === 1) { x = canvas.width; y = Math.random() * canvas.height; }
  if (side === 2) { x = Math.random() * canvas.width; y = 0; }
  if (side === 3) { x = Math.random() * canvas.width; y = canvas.height; }

  zombies.push({ x, y, size: 20, speed, hp: 50 });
}

function spawnBoss() {
  zombies.push({
    x: 100,
    y: 100,
    size: 60,
    speed: 0.6,
    hp: 500,
    boss: true
  });
}

function startWave() {
  for (let i = 0; i < wave * 5; i++) spawnZombie();
  if (wave % 5 === 0) spawnBoss();
}

setInterval(() => {
  if (!gameOver && zombies.length === 0) {
    wave++;
    startWave();
  }
}, 2000);

startWave();

// ---------------- COLLISION ----------------
function isCollidingWithWall(x, y) {
  return walls.some(w =>
    x < w.x + w.w &&
    x + player.size > w.x &&
    y < w.y + w.h &&
    y + player.size > w.y
  );
}

// ---------------- UPDATE ----------------
function update() {
  if (gameOver) {
    drawGameOver();
    requestAnimationFrame(update);
    return;
  }

  // movement
  let nx = player.x;
  let ny = player.y;

  if (keys["w"]) ny -= player.speed;
  if (keys["s"]) ny += player.speed;
  if (keys["a"]) nx -= player.speed;
  if (keys["d"]) nx += player.speed;

  if (!isCollidingWithWall(nx, player.y)) player.x = nx;
  if (!isCollidingWithWall(player.x, ny)) player.y = ny;

  // auto fire
  if (firing) shoot();

  // reload timer
  if (isReloading) {
    reloadTimer--;

    if (reloadTimer <= 0) {
      ammo = weapons[currentWeapon].mag;
      isReloading = false;
    }
  }

  // bullets
  bullets.forEach((b, i) => {
    b.x += b.dx;
    b.y += b.dy;

    if (b.x < 0 || b.y < 0 || b.x > canvas.width || b.y > canvas.height) {
      bullets.splice(i, 1);
    }
  });

  // grenades
  grenades.forEach((g, gi) => {
    g.timer--;

    if (g.timer <= 0) {
      shake = 10;

      zombies.forEach((z, zi) => {
        let d = Math.hypot(g.x - z.x, g.y - z.y);
        if (d < 120) {
          z.hp -= 100;
          createBlood(z.x, z.y);

          if (z.hp <= 0) {
            zombies.splice(zi, 1);
            score += 20;
          }
        }
      });

      grenades.splice(gi, 1);
    }
  });

  // zombies
  zombies.forEach((z, zi) => {
    let angle = Math.atan2(player.y - z.y, player.x - z.x);
    z.x += Math.cos(angle) * z.speed;
    z.y += Math.sin(angle) * z.speed;

    if (Math.hypot(player.x - z.x, player.y - z.y) < 20) {
      player.hp -= z.boss ? 1.5 : 0.5;
      shake = 5;
    }

    bullets.forEach((b, bi) => {
      if (Math.hypot(b.x - z.x, b.y - z.y) < 15) {
        z.hp -= b.damage;
        bullets.splice(bi, 1);
        createBlood(z.x, z.y);

        if (z.hp <= 0) {
          zombies.splice(zi, 1);
          score += z.boss ? 100 : 10;
        }
      }
    });
  });

  // particles
  particles.forEach((p, pi) => {
    p.x += p.dx;
    p.y += p.dy;
    p.life--;

    if (p.life <= 0) particles.splice(pi, 1);
  });

  if (player.hp <= 0) gameOver = true;

  draw();
  requestAnimationFrame(update);
}

// ---------------- BLOOD ----------------
function createBlood(x, y) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x,
      y,
      dx: (Math.random() - 0.5) * 4,
      dy: (Math.random() - 0.5) * 4,
      life: 30
    });
  }
}

// ---------------- DRAW ----------------
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (shake > 0) {
    ctx.save();
    ctx.translate(Math.random() * shake, Math.random() * shake);
    shake -= 0.3;
  }

  // walls
  ctx.fillStyle = "#444";
  walls.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));

  // player
  ctx.fillStyle = "cyan";
  ctx.fillRect(player.x, player.y, player.size, player.size);

  // bullets
  ctx.fillStyle = "yellow";
  bullets.forEach(b => ctx.fillRect(b.x, b.y, 4, 4));

  // zombies
  zombies.forEach(z => {
    ctx.fillStyle = z.boss ? "purple" : "green";
    ctx.fillRect(z.x, z.y, z.size, z.size);

    ctx.fillStyle = "black";
    ctx.fillRect(z.x, z.y - 6, z.size, 4);

    ctx.fillStyle = "lime";
    ctx.fillRect(z.x, z.y - 6, (z.hp / (z.boss ? 500 : 50)) * z.size, 4);
  });

  // particles
  ctx.fillStyle = "red";
  particles.forEach(p => ctx.fillRect(p.x, p.y, 2, 2));

  if (shake > 0) ctx.restore();

  let reloadText = isReloading ? ` | Reloading (${Math.ceil(reloadTimer / 60)})` : "";

  document.getElementById("stats").innerText =
    `HP: ${Math.floor(player.hp)} | Score: ${score} | Wave: ${wave} | Ammo: ${ammo}${reloadText}`;
}

// ---------------- GAME OVER ----------------
function drawGameOver() {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  ctx.font = "50px Arial";
  ctx.fillText("GAME OVER", canvas.width / 2 - 150, canvas.height / 2);

  ctx.font = "25px Arial";
  ctx.fillText("Score: " + score, canvas.width / 2 - 60, canvas.height / 2 + 50);
  ctx.fillText("Press SPACE to restart", canvas.width / 2 - 140, canvas.height / 2 + 100);
}

// ---------------- RESTART ----------------
function restartGame() {
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  player.hp = 100;

  bullets = [];
  zombies = [];
  particles = [];
  grenades = [];

  score = 0;
  wave = 1;
  gameOver = false;

  ammo = weapons[currentWeapon].mag;
  isReloading = false;
  reloadTimer = 0;

  startWave();
}

update();
