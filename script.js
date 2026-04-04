// ══════════════════════════════════════════════════════════════
//  ECHO PROTOCOL · script.js
//  Clone-recording puzzle platformer
//  5 levels · up to 3 simultaneous echoes
// ══════════════════════════════════════════════════════════════

// ── CONSTANTS ─────────────────────────────────────────────────
const GRAVITY     = 0.55;
const JUMP_FORCE  = -13;
const SPEED       = 4.2;
const MAX_CLONES  = 3;
const TILE        = 40;

// Clone colors matching CSS
const CLONE_COLORS = ['#bf5fff', '#ff5fa0', '#5faaff'];
const PLAYER_COLOR = '#00ffe7';

// ── DOM REFS ───────────────────────────────────────────────────
const startScreen   = document.getElementById('start-screen');
const gameScreen    = document.getElementById('game-screen');
const winScreen     = document.getElementById('win-screen');
const startBtn      = document.getElementById('start-btn');
const resetBtn      = document.getElementById('reset-btn');
const playAgainBtn  = document.getElementById('play-again-btn');
const canvas        = document.getElementById('game-canvas');
const bgCanvas      = document.getElementById('bg-canvas');
const ctx           = canvas.getContext('2d');
const hintText      = document.getElementById('hint-text');
const recBanner     = document.getElementById('recording-banner');
const levelNumEl    = document.getElementById('level-num');
const levelNameEl   = document.getElementById('level-name');
const levelClearEl  = document.getElementById('level-clear');
const wLevels       = document.getElementById('w-levels');
const wClones       = document.getElementById('w-clones');
const wResets       = document.getElementById('w-resets');

// ── STATE ──────────────────────────────────────────────────────
let state = {};
let keys  = {};
let raf;
let totalClonesCreated = 0;
let totalResets = 0;
let currentLevel = 0;

// ── LEVEL DEFINITIONS ──────────────────────────────────────────
// Each level is a grid of tiles + entity definitions
// Tile types: 0=empty, 1=solid, 2=oneway (pass through from below)
// Entities: player, buttons, door, spikes

const LEVELS = [

  // ── LEVEL 1: TUTORIAL — one button, no clones needed
  {
    name: 'ISOLATION CELL',
    hint: 'Reach the DOOR — stand on the BUTTON to open it · [E] records an echo',
    clonesNeeded: 0,
    // 26 cols × 14 rows at TILE=40 (scales to canvas)
    grid: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ],
    player: { col: 1, row: 12 },
    buttons: [{ col: 9, row: 13, id: 0 }],
    door: { col: 23, row: 12 },
    doorRequires: [0],
    spikes: []
  },

  // ── LEVEL 2: ONE CLONE — two buttons
  {
    name: 'SPLIT CORRIDOR',
    hint: '[E] to record an echo — your clone replays your moves · reach BOTH buttons',
    clonesNeeded: 1,
    grid: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,1,1,1,1,1,1,1,0,0,0,1,1,1,1,1,1,1,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ],
    player: { col: 1, row: 12 },
    buttons: [
      { col: 3,  row: 13, id: 0 },
      { col: 22, row: 13, id: 1 }
    ],
    door: { col: 12, row: 12 },
    doorRequires: [0, 1],
    spikes: []
  },

  // ── LEVEL 3: TWO CLONES — three buttons, gaps
  {
    name: 'MIRROR WING',
    hint: 'You need THREE simultaneous button presses · use 2 echoes',
    clonesNeeded: 2,
    grid: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,1,1,1,0,0,0,0,0,0,1,0,0,0,0,0,0,1,1,1,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ],
    player: { col: 1, row: 12 },
    buttons: [
      { col: 2,  row: 13, id: 0 },
      { col: 12, row: 13, id: 1 },
      { col: 23, row: 13, id: 2 }
    ],
    door: { col: 12, row: 7 },
    doorRequires: [0, 1, 2],
    spikes: [
      { col: 6, row: 13 }, { col: 7, row: 13 },
      { col: 17, row: 13 }, { col: 18, row: 13 }
    ]
  },

  // ── LEVEL 4: SPIKES + PLATFORMS — timing puzzle
  {
    name: 'HAZARD ZONE',
    hint: 'Spikes are deadly · plan your route before recording',
    clonesNeeded: 2,
    grid: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ],
    player: { col: 1, row: 12 },
    buttons: [
      { col: 1,  row: 13, id: 0 },
      { col: 13, row: 13, id: 1 },
      { col: 24, row: 13, id: 2 }
    ],
    door: { col: 13, row: 4 },
    doorRequires: [0, 1, 2],
    spikes: [
      { col: 5,  row: 13 }, { col: 6,  row: 13 },
      { col: 8,  row: 13 }, { col: 9,  row: 13 },
      { col: 16, row: 13 }, { col: 17, row: 13 },
      { col: 19, row: 13 }, { col: 20, row: 13 }
    ]
  },

  // ── LEVEL 5: FINAL — all 3 clones, complex layout
  {
    name: 'CORE BREACH',
    hint: 'FINAL LEVEL · 3 echoes · timing is everything · escape the facility',
    clonesNeeded: 3,
    grid: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,1,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,1,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ],
    player: { col: 1, row: 12 },
    buttons: [
      { col: 1,  row: 13, id: 0 },
      { col: 8,  row: 13, id: 1 },
      { col: 17, row: 13, id: 2 },
      { col: 24, row: 13, id: 3 }
    ],
    door: { col: 12, row: 3 },
    doorRequires: [0, 1, 2, 3],
    spikes: [
      { col: 4,  row: 13 }, { col: 5,  row: 13 },
      { col: 11, row: 13 }, { col: 12, row: 13 }, { col: 13, row: 13 },
      { col: 20, row: 13 }, { col: 21, row: 13 }
    ]
  }
];

// ── BG CANVAS (title screen particles) ────────────────────────
function initBgCanvas() {
  if (!bgCanvas) return;
  const bctx = bgCanvas.getContext('2d');
  bgCanvas.width  = window.innerWidth;
  bgCanvas.height = window.innerHeight;
  const particles = Array.from({ length: 80 }, () => ({
    x: Math.random() * bgCanvas.width,
    y: Math.random() * bgCanvas.height,
    r: Math.random() * 1.5 + 0.3,
    vy: Math.random() * 0.3 + 0.1,
    vx: (Math.random() - 0.5) * 0.2,
    a: Math.random()
  }));
  function drawBg() {
    bctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.y > bgCanvas.height) { p.y = 0; p.x = Math.random() * bgCanvas.width; }
      p.a = 0.3 + 0.5 * Math.abs(Math.sin(Date.now() * 0.001 + p.x));
      bctx.beginPath();
      bctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      bctx.fillStyle = `rgba(0,255,231,${p.a})`;
      bctx.fill();
    });
    requestAnimationFrame(drawBg);
  }
  drawBg();
}

// ── GAME INIT ──────────────────────────────────────────────────
function loadLevel(idx) {
  const def = LEVELS[idx];
  const COLS = def.grid[0].length;
  const ROWS = def.grid.length;

  // Scale tile to fill the canvas minus HUD (56px top + 32px bottom)
  const cw = canvas.width;
  const ch = canvas.height;
  const tileW = Math.floor(cw / COLS);
  const tileH = Math.floor(ch / ROWS);
  const tileSize = Math.min(tileW, tileH);
  const offsetX = Math.floor((cw - tileSize * COLS) / 2);
  const offsetY = Math.floor((ch - tileSize * ROWS) / 2);

  function worldX(col) { return offsetX + col * tileSize; }
  function worldY(row) { return offsetY + row * tileSize; }
  function px(col)     { return worldX(col); }
  function py(row)     { return worldY(row); }

  const ps = def.player;
  const playerW = tileSize * 0.6;
  const playerH = tileSize * 0.75;

  const player = {
    x: px(ps.col) + (tileSize - playerW) / 2,
    y: py(ps.row) + tileSize - playerH,
    w: playerW, h: playerH,
    vx: 0, vy: 0,
    onGround: false,
    alive: true,
    facing: 1
  };

  const buttons = def.buttons.map(b => ({
    ...b,
    x: px(b.col), y: py(b.row) + tileSize - tileSize * 0.25,
    w: tileSize, h: tileSize * 0.25,
    pressed: false
  }));

  const door = {
    ...def.door,
    x: px(def.door.col),
    y: py(def.door.row),
    w: tileSize, h: tileSize * 2,
    open: false
  };

  const spikes = def.spikes.map(s => ({
    x: px(s.col), y: py(s.row) + tileSize * 0.55,
    w: tileSize, h: tileSize * 0.45
  }));

  state = {
    def, tileSize, offsetX, offsetY, COLS, ROWS,
    px, py, worldX, worldY,
    player, buttons, door, spikes,
    clones: [],       // active replaying clones
    recording: false, // currently recording
    recordBuf: [],    // current recording buffer
    clonesUsed: 0,
    frame: 0,
    levelDone: false,
    playerW, playerH
  };

  updateCloneSlots();
  updateHint(def.hint);
  levelNumEl.textContent = String(idx + 1).padStart(2, '0');
  levelNameEl.textContent = def.name;
}

function resizeCanvas() {
  const hudH   = 56;
  const hintH  = 32;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight - hudH - hintH;
}

// ── INPUT ──────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
  keys[e.code] = true;

  // Jump
  if ((e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') && state.player) {
    if (state.player.onGround && state.player.alive) {
      state.player.vy = JUMP_FORCE;
      state.player.onGround = false;
    }
  }

  // Record / commit clone
  if (e.code === 'KeyE' && state.player && !state.levelDone) {
    if (!state.recording) {
      if (state.clonesUsed < MAX_CLONES) {
        startRecording();
      }
    } else {
      commitClone();
    }
  }

  // Reset
  if (e.code === 'KeyR') resetLevel();
});

window.addEventListener('keyup', e => { keys[e.code] = false; });

// ── RECORDING ─────────────────────────────────────────────────
function startRecording() {
  state.recording = true;
  state.recordBuf = [];
  recBanner.classList.remove('hidden');
  updateHint('Recording… [E] again to COMMIT the echo and replay it');
}

function commitClone() {
  if (state.recordBuf.length === 0) {
    state.recording = false;
    recBanner.classList.add('hidden');
    return;
  }

  const cloneIdx = state.clonesUsed;
  const color    = CLONE_COLORS[cloneIdx % CLONE_COLORS.length];

  // Clone starts at position of player when recording began
  const startSnap = state.recordBuf[0];
  state.clones.push({
    buf:    state.recordBuf,
    frame:  0,
    x:      startSnap.x,
    y:      startSnap.y,
    w:      state.playerW,
    h:      state.playerH,
    color,
    alive:  true,
    done:   false,
    idx:    cloneIdx
  });

  state.clonesUsed++;
  totalClonesCreated++;
  state.recording = false;
  state.recordBuf = [];
  recBanner.classList.add('hidden');

  updateCloneSlots();
  updateHint(state.def.hint);

  // Re-run all clones from beginning (including old ones restart)
  // This is the "temporal" feel — each clone loops its own recording
}

function updateCloneSlots() {
  for (let i = 0; i < MAX_CLONES; i++) {
    const el = document.getElementById(`slot-${i}`);
    el.className = 'clone-slot';
    if (i < state.clonesUsed) el.classList.add(`active-${i}`);
  }
}

// ── PHYSICS HELPERS ────────────────────────────────────────────
function rectOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function resolveVsGrid(ent, ts, ox, oy, rows, cols, grid) {
  // broad phase: which tiles can this entity touch?
  const left   = Math.max(0, Math.floor((ent.x - ox) / ts));
  const right  = Math.min(cols - 1, Math.floor((ent.x + ent.w - ox - 1) / ts));
  const top    = Math.max(0, Math.floor((ent.y - oy) / ts));
  const bottom = Math.min(rows - 1, Math.floor((ent.y + ent.h - oy - 1) / ts));

  ent.onGround = false;

  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) {
      if (!grid[r] || !grid[r][c]) continue;
      if (grid[r][c] !== 1) continue;

      const tx = ox + c * ts;
      const ty = oy + r * ts;

      // Overlap amounts
      const overlapLeft  = (ent.x + ent.w) - tx;
      const overlapRight = (tx + ts) - ent.x;
      const overlapTop   = (ent.y + ent.h) - ty;
      const overlapBot   = (ty + ts) - ent.y;

      const minH = Math.min(overlapLeft, overlapRight);
      const minV = Math.min(overlapTop, overlapBot);

      if (minV < minH) {
        if (overlapTop < overlapBot) {
          // landing on top
          ent.y = ty - ent.h;
          ent.vy = 0;
          ent.onGround = true;
        } else {
          // hitting ceiling
          ent.y = ty + ts;
          ent.vy = 0;
        }
      } else {
        if (overlapLeft < overlapRight) {
          ent.x = tx - ent.w;
          ent.vx = 0;
        } else {
          ent.x = tx + ts;
          ent.vx = 0;
        }
      }
    }
  }
}

// ── RESET ──────────────────────────────────────────────────────
function resetLevel() {
  totalResets++;
  loadLevel(currentLevel);
}

// ── UPDATE ─────────────────────────────────────────────────────
function update() {
  if (!state.player || state.levelDone) return;

  const { player, buttons, door, spikes, clones, def, tileSize: ts, offsetX: ox, offsetY: oy, ROWS, COLS } = state;

  // Player movement
  if (player.alive) {
    player.vx = 0;
    if (keys['KeyA'] || keys['ArrowLeft'])  { player.vx = -SPEED; player.facing = -1; }
    if (keys['KeyD'] || keys['ArrowRight']) { player.vx =  SPEED; player.facing =  1; }

    player.vy += GRAVITY;
    player.x  += player.vx;
    player.y  += player.vy;

    resolveVsGrid(player, ts, ox, oy, ROWS, COLS, def.grid);

    // Record frame
    if (state.recording) {
      state.recordBuf.push({ x: player.x, y: player.y });
    }

    // Spike death
    for (const s of spikes) {
      if (rectOverlap(player, s)) {
        player.alive = false;
        setTimeout(resetLevel, 600);
        return;
      }
    }

    // Check out of bounds
    if (player.y > oy + ROWS * ts + 100) {
      player.alive = false;
      setTimeout(resetLevel, 400);
      return;
    }
  }

  // Advance clones
  for (const cl of clones) {
    if (!cl.alive) continue;
    if (cl.frame < cl.buf.length) {
      cl.x = cl.buf[cl.frame].x;
      cl.y = cl.buf[cl.frame].y;
      cl.frame++;
    } else {
      // Loop the clone
      cl.frame = 0;
    }

    // Spike death for clone
    for (const s of spikes) {
      const clRect = { x: cl.x, y: cl.y, w: cl.w, h: cl.h };
      if (rectOverlap(clRect, s)) {
        cl.alive = false;
      }
    }
  }

  // Button presses — player OR alive clone
  for (const btn of buttons) {
    btn.pressed = false;
    const entities = [player, ...clones.filter(c => c.alive)];
    for (const ent of entities) {
      const entRect = { x: ent.x, y: ent.y, w: ent.w, h: ent.h };
      if (rectOverlap(entRect, btn)) { btn.pressed = true; break; }
    }
  }

  // Door logic
  const allRequired = def.doorRequires.every(id => {
    const b = buttons.find(bt => bt.id === id);
    return b && b.pressed;
  });
  door.open = allRequired;

  // Player enters door
  if (door.open && player.alive && rectOverlap(player, door)) {
    state.levelDone = true;
    showLevelClear();
  }

  state.frame++;
}

// ── DRAW ───────────────────────────────────────────────────────
function draw() {
  const { def, tileSize: ts, offsetX: ox, offsetY: oy, ROWS, COLS, player, buttons, door, spikes, clones } = state;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0,   '#050508');
  grad.addColorStop(0.5, '#08080f');
  grad.addColorStop(1,   '#050508');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid background lines (subtle)
  ctx.strokeStyle = 'rgba(30,30,51,0.4)';
  ctx.lineWidth = 0.5;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(ox + c * ts, oy);
    ctx.lineTo(ox + c * ts, oy + ROWS * ts);
    ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(ox, oy + r * ts);
    ctx.lineTo(ox + COLS * ts, oy + r * ts);
    ctx.stroke();
  }

  // Tiles
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = def.grid[r][c];
      if (t === 0) continue;
      const tx = ox + c * ts, ty = oy + r * ts;
      if (t === 1) {
        // Solid tile with lit top edge
        ctx.fillStyle = '#0f0f1a';
        ctx.fillRect(tx, ty, ts, ts);
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(tx, ty, ts, 3);
        ctx.fillStyle = '#0a0a15';
        ctx.fillRect(tx, ty + 3, ts, ts - 3);
        // subtle border
        ctx.strokeStyle = '#1e1e33';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(tx + 0.5, ty + 0.5, ts - 1, ts - 1);
      }
    }
  }

  // Spikes
  for (const s of spikes) {
    const pts = 5;
    const sw = s.w / pts;
    ctx.fillStyle = '#ff3c3c';
    for (let i = 0; i < pts; i++) {
      ctx.beginPath();
      ctx.moveTo(s.x + i * sw, s.y + s.h);
      ctx.lineTo(s.x + i * sw + sw / 2, s.y);
      ctx.lineTo(s.x + i * sw + sw, s.y + s.h);
      ctx.closePath();
      ctx.fill();
    }
    // Glow
    ctx.shadowColor = '#ff3c3c';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Buttons
  for (const btn of buttons) {
    const bh = btn.pressed ? btn.h * 0.5 : btn.h;
    const by = btn.pressed ? btn.y + btn.h * 0.5 : btn.y;
    ctx.fillStyle = btn.pressed ? '#ff3c3c' : '#4a0000';
    ctx.fillRect(btn.x + 2, by, btn.w - 4, bh);
    ctx.fillStyle = btn.pressed ? '#ff8888' : '#8b0000';
    ctx.fillRect(btn.x + 4, by, btn.w - 8, 4);
    if (btn.pressed) {
      ctx.shadowColor = '#ff3c3c';
      ctx.shadowBlur = 20;
      ctx.fillRect(btn.x + 2, by, btn.w - 4, bh);
      ctx.shadowBlur = 0;
    }
    // Label
    ctx.fillStyle = btn.pressed ? '#fff' : '#555';
    ctx.font = `bold ${ts * 0.25}px 'Share Tech Mono'`;
    ctx.textAlign = 'center';
    ctx.fillText(`B${btn.id + 1}`, btn.x + btn.w / 2, by + bh * 0.75);
  }

  // Door
  {
    const d = door;
    ctx.fillStyle = d.open ? '#332200' : '#1a1200';
    ctx.fillRect(d.x + 4, d.y, d.w - 8, d.h);
    // Frame
    ctx.strokeStyle = d.open ? '#ffcc00' : '#443300';
    ctx.lineWidth = 3;
    ctx.strokeRect(d.x + 4, d.y, d.w - 8, d.h);
    if (d.open) {
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur = 30;
      ctx.strokeRect(d.x + 4, d.y, d.w - 8, d.h);
      ctx.shadowBlur = 0;
      // Arrow exit
      ctx.fillStyle = '#ffcc00';
      ctx.font = `bold ${ts * 0.6}px serif`;
      ctx.textAlign = 'center';
      ctx.fillText('↑', d.x + d.w / 2, d.y + d.h * 0.65);
    } else {
      ctx.fillStyle = '#443300';
      ctx.font = `${ts * 0.25}px 'Share Tech Mono'`;
      ctx.textAlign = 'center';
      ctx.fillText('LOCKED', d.x + d.w / 2, d.y + d.h * 0.5);
    }
    ctx.textAlign = 'left';
  }

  // Recording trail
  if (state.recording && state.recordBuf.length > 1) {
    ctx.strokeStyle = 'rgba(0,255,231,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    state.recordBuf.forEach((f, i) => {
      const mx = f.x + state.playerW / 2;
      const my = f.y + state.playerH / 2;
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    });
    ctx.stroke();
  }

  // Clones
  for (const cl of clones) {
    if (!cl.alive) continue;
    const alpha = 0.55 + 0.25 * Math.sin(Date.now() * 0.005 + cl.idx);
    ctx.globalAlpha = alpha;

    // Ghost body
    ctx.fillStyle = cl.color;
    ctx.fillRect(cl.x + 3, cl.y, cl.w - 6, cl.h);

    // Glow
    ctx.shadowColor = cl.color;
    ctx.shadowBlur = 18;
    ctx.fillRect(cl.x + 3, cl.y, cl.w - 6, cl.h);
    ctx.shadowBlur = 0;

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = alpha * 0.9;
    const ew = cl.w * 0.15;
    ctx.fillRect(cl.x + cl.w * 0.25, cl.y + cl.h * 0.2, ew, ew * 1.4);
    ctx.fillRect(cl.x + cl.w * 0.62, cl.y + cl.h * 0.2, ew, ew * 1.4);

    // Echo label
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = cl.color;
    ctx.font = `${ts * 0.2}px 'Share Tech Mono'`;
    ctx.textAlign = 'center';
    ctx.fillText(`E${cl.idx + 1}`, cl.x + cl.w / 2, cl.y - 4);
    ctx.textAlign = 'left';

    ctx.globalAlpha = 1;
  }

  // Player
  if (player.alive) {
    // Body
    ctx.fillStyle = PLAYER_COLOR;
    ctx.shadowColor = PLAYER_COLOR;
    ctx.shadowBlur = 20;
    ctx.fillRect(player.x + 3, player.y, player.w - 6, player.h);
    ctx.shadowBlur = 0;

    // Suit stripes
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(player.x + 3, player.y + player.h * 0.35, player.w - 6, player.h * 0.08);
    ctx.fillRect(player.x + 3, player.y + player.h * 0.55, player.w - 6, player.h * 0.08);

    // Eyes (direction-aware)
    ctx.fillStyle = '#001a17';
    const ew = player.w * 0.15;
    const eyeY = player.y + player.h * 0.2;
    if (player.facing === 1) {
      ctx.fillRect(player.x + player.w * 0.3, eyeY, ew, ew * 1.4);
      ctx.fillRect(player.x + player.w * 0.58, eyeY, ew, ew * 1.4);
    } else {
      ctx.fillRect(player.x + player.w * 0.22, eyeY, ew, ew * 1.4);
      ctx.fillRect(player.x + player.w * 0.5,  eyeY, ew, ew * 1.4);
    }

    // Recording pulse ring
    if (state.recording) {
      const pulse = (Math.sin(Date.now() * 0.01) + 1) * 0.5;
      ctx.strokeStyle = `rgba(255,60,60,${0.4 + pulse * 0.6})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ff3c3c';
      ctx.shadowBlur = 10 + pulse * 10;
      ctx.strokeRect(player.x - 4, player.y - 4, player.w + 8, player.h + 8);
      ctx.shadowBlur = 0;
    }
  } else {
    // Death flash
    ctx.fillStyle = `rgba(255,60,60,${0.3 + 0.3 * Math.sin(Date.now() * 0.03)})`;
    ctx.fillRect(player.x - 10, player.y - 10, player.w + 20, player.h + 20);
  }
}

// ── LEVEL CLEAR ────────────────────────────────────────────────
function showLevelClear() {
  levelClearEl.classList.remove('hidden');
  levelClearEl.style.display = 'flex';
  setTimeout(() => {
    levelClearEl.classList.add('hidden');
    levelClearEl.style.display = '';
    currentLevel++;
    if (currentLevel >= LEVELS.length) {
      showWin();
    } else {
      loadLevel(currentLevel);
    }
  }, 2000);
}

function showWin() {
  cancelAnimationFrame(raf);
  gameScreen.classList.remove('active');
  gameScreen.style.display = '';
  winScreen.classList.add('active');
  winScreen.style.display = 'flex';
  wLevels.textContent = LEVELS.length;
  wClones.textContent = totalClonesCreated;
  wResets.textContent = totalResets;
}

// ── HINT ───────────────────────────────────────────────────────
function updateHint(text) {
  hintText.textContent = text;
}

// ── GAME LOOP ──────────────────────────────────────────────────
function loop() {
  update();
  draw();
  raf = requestAnimationFrame(loop);
}

// ── SCREEN TRANSITIONS ─────────────────────────────────────────
function showScreen(el) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = '';
  });
  el.classList.add('active');
  el.style.display = 'flex';
}

// ── START ──────────────────────────────────────────────────────
startBtn.addEventListener('click', () => {
  currentLevel = 0;
  totalClonesCreated = 0;
  totalResets = 0;
  showScreen(gameScreen);
  resizeCanvas();
  loadLevel(0);
  cancelAnimationFrame(raf);
  loop();
});

resetBtn.addEventListener('click', resetLevel);

playAgainBtn.addEventListener('click', () => {
  currentLevel = 0;
  totalClonesCreated = 0;
  totalResets = 0;
  showScreen(gameScreen);
  resizeCanvas();
  loadLevel(0);
  cancelAnimationFrame(raf);
  loop();
});

window.addEventListener('resize', () => {
  if (bgCanvas) {
    bgCanvas.width  = window.innerWidth;
    bgCanvas.height = window.innerHeight;
  }
  if (gameScreen.classList.contains('active')) {
    resizeCanvas();
    loadLevel(currentLevel);
  }
});

// Boot bg
initBgCanvas();