'use strict';
// ═══════════════════════════════════════════════════════════
//   METEOR BLASTER — Full Game Script
// ═══════════════════════════════════════════════════════════

// ── ONLINE LEADERBOARD CONFIG ────────────────────────────
// Sign up free at https://jsonbin.io, create a bin, then
// paste your Master Key and Bin ID below.
const JSONBIN_KEY   = 'YOUR_JSONBIN_MASTER_KEY';  // $2b$10$...
const JSONBIN_BIN   = 'YOUR_BIN_ID';               // 6abc123...
const ONLINE_BOARD  = JSONBIN_KEY !== 'YOUR_JSONBIN_MASTER_KEY' && JSONBIN_BIN !== 'YOUR_BIN_ID';

// ── Game Config ──────────────────────────────────────────
const MAX_LEVELS  = 20;
const BOSS_LEVELS = new Set([5,10,15,20]);
const LEVEL_SECS  = 140;
const METEOR_BASE = 12;
const METEOR_GROW = 3;
const SHOOT_NORM  = 300;
const SHOOT_RAPID = 110;
const PU_DUR      = 7000;
const PU_PROB     = 0.26;
const MAX_LB      = 10;

// ── Boss Defs ────────────────────────────────────────────
const BOSSES = {
  5:  {name:'GRANITE GUARDIAN',sub:'The Ancient Destroyer',  color:'#b46a2e',glow:'#ff6a00',hp:35,  sz:65, spd:1.5,atkRate:2600,shots:1,shotSpd:3.5,pattern:'aimed'},
  10: {name:'IRON STORM',      sub:'Forged in Chaos',        color:'#4070a0',glow:'#00c8ff',hp:60,  sz:78, spd:2.2,atkRate:2000,shots:3,shotSpd:4,  pattern:'spread'},
  15: {name:'VOID CRUSHER',    sub:'Devourer of Stars',      color:'#702098',glow:'#c800ff',hp:90,  sz:90, spd:2.8,atkRate:1500,shots:5,shotSpd:4.5,pattern:'spiral'},
  20: {name:'COSMIC TITAN',    sub:'— END OF ALL THINGS —',  color:'#aa1800',glow:'#ff2d55',hp:140, sz:108,spd:2.0,atkRate:1200,shots:7,shotSpd:5,  pattern:'chaos',final:true},
};

// ═══════════════════════════════════════════════════════════
//   MUSIC ENGINE
// ═══════════════════════════════════════════════════════════
const Music = (() => {
  let ac, masterGain, track = null, trackName = '';
  let compressor;

  // Note frequencies
  const NOTE = {
    C3:130.81,D3:146.83,E3:164.81,F3:174.61,G3:196,A3:220,B3:246.94,
    C4:261.63,D4:293.66,E4:329.63,F4:349.23,G4:392,A4:440,B4:493.88,
    C5:523.25,D5:587.33,E5:659.25,F5:698.46,G5:783.99,A5:880,
    Bb3:233.08,Eb4:311.13,Ab4:415.3,Bb4:466.16,Db5:554.37,Eb5:622.25,
    _:0
  };

  // ── Patterns ──
  const TRACKS = {

    menu: {
      bpm: 80, loop: true,
      channels: [
        { // Pad chords
          type:'sine', vol:0.09, attack:0.6, release:1.2, detune:0,
          seq: [
            ['C4','E4','G4',3],['_',3],['A3','C4','E4',3],['_',3],
            ['F3','A3','C4',3],['_',3],['G3','B3','D4',3],['_',3],
          ]
        },
        { // Slow arpeggio
          type:'triangle', vol:0.06, attack:0.04, release:0.3, detune:0,
          seq:[
            ['C5',1],['G4',1],['E4',1],['C4',1],['G3',1],['E4',1],['G4',1],['C5',1],
            ['A4',1],['E4',1],['C4',1],['A3',1],['C4',1],['E4',1],['A4',1],['E5',1],
            ['F4',1],['C4',1],['A3',1],['F3',1],['A3',1],['C4',1],['F4',1],['C5',1],
            ['G4',1],['D4',1],['B3',1],['G3',1],['B3',1],['D4',1],['G4',1],['B4',1],
          ]
        },
        { // Bass
          type:'sawtooth', vol:0.06, attack:0.02, release:0.5, detune:-1200,
          seq:[
            ['C3',4],['_',4],['A3',4],['_',4],
            ['F3',4],['_',4],['G3',4],['_',4],
          ]
        }
      ]
    },

    game: {
      bpm: 148, loop: true,
      channels: [
        { // Lead melody
          type:'square', vol:0.07, attack:0.01, release:0.15, detune:0,
          seq:[
            ['E5',1],['_',1],['E5',1],['_',1],['G5',2],['_',2],
            ['D5',1],['_',1],['D5',1],['_',1],['F5',2],['_',2],
            ['C5',1],['_',1],['E5',1],['D5',1],['C5',4],
            ['G4',2],['A4',2],['B4',2],['C5',2],
          ]
        },
        { // Counter melody
          type:'triangle', vol:0.055, attack:0.01, release:0.1, detune:0,
          seq:[
            ['C4',2],['E4',2],['G4',2],['E4',2],
            ['B3',2],['D4',2],['F4',2],['D4',2],
            ['A3',2],['C4',2],['E4',2],['C4',2],
            ['G3',2],['B3',2],['D4',2],['B3',2],
          ]
        },
        { // Bass line
          type:'sawtooth', vol:0.07, attack:0.01, release:0.2, detune:-1200,
          seq:[
            ['C3',1],['_',1],['C3',1],['G3',1],['_',2],['C3',2],
            ['B2',1],['_',1],['B2',1],['F3',1],['_',2],['B2',2],
            ['A2',1],['_',1],['A2',1],['E3',1],['_',2],['A2',2],
            ['G2',1],['_',1],['G2',1],['D3',1],['G3',1],['_',1],['G2',2],
          ]
        },
        { // Drums (white noise bursts)
          type:'noise', vol:0.05, attack:0.001, release:0.08,
          seq:[
            [1,1],[0,1],[1,1],[0,1],[1,1],[0,1],[1,1],[0,1],
            [1,1],[0,1],[1,1],[0,1],[1,1],[0,1],[1,1],[0,1],
          ]
        }
      ]
    },

    boss: {
      bpm: 170, loop: true,
      channels: [
        { // Aggressive lead
          type:'sawtooth', vol:0.07, attack:0.005, release:0.1, detune:0,
          seq:[
            ['E5',1],['Eb5',1],['D5',1],['Db5',1],['C5',2],['_',2],
            ['G4',1],['Ab4',1],['A4',1],['Bb4',1],['B4',2],['C5',2],
            ['E5',1],['_',1],['D5',1],['_',1],['C5',1],['_',1],['B4',1],['_',1],
            ['Bb4',2],['Ab4',2],['G4',4],
          ]
        },
        { // Low pulse
          type:'square', vol:0.06, attack:0.02, release:0.15, detune:-1200,
          seq:[
            ['C3',1],['C3',1],['_',2],['G3',1],['_',3],
            ['C3',1],['C3',1],['_',2],['F3',1],['_',3],
            ['C3',1],['C3',1],['C3',1],['_',1],['Eb4',1],['_',3],
            ['G2',1],['G2',1],['_',6],
          ]
        },
        { // Chaos arpeggio
          type:'triangle', vol:0.05, attack:0.005, release:0.05, detune:0,
          seq:[
            ['C5',1],['Eb5',1],['G5',1],['Bb4',1],['C5',1],['Eb5',1],['G5',1],['_',1],
            ['B4',1],['D5',1],['F5',1],['Ab4',1],['B4',1],['D5',1],['F5',1],['_',1],
            ['Bb4',1],['Db5',1],['F5',1],['G4',1],['Bb4',1],['Db5',1],['F5',1],['_',1],
            ['A4',1],['C5',1],['Eb5',1],['G4',1],['A4',1],['C5',1],['Eb5',1],['_',1],
          ]
        },
        { // Heavy drums
          type:'noise', vol:0.07, attack:0.001, release:0.06,
          seq:[
            [1,1],[1,1],[0,1],[1,1],[1,1],[0,1],[1,1],[0,1],
            [1,1],[1,1],[0,1],[1,1],[1,1],[0,1],[1,1],[0,1],
          ]
        }
      ]
    },

    victory: {
      bpm: 140, loop: false,
      channels: [
        { type:'square',   vol:0.1,  attack:0.01, release:0.2, detune:0,
          seq:[['C4',1],['E4',1],['G4',1],['C5',2],['_',1],['G4',1],['E4',1],
               ['C4',1],['D4',1],['E4',1],['F4',1],['G4',2],['_',2],
               ['C5',1],['B4',1],['A4',1],['G4',1],['F4',1],['E4',1],['D4',1],['C4',2]] },
        { type:'triangle', vol:0.06, attack:0.01, release:0.15, detune:0,
          seq:[['E4',2],['G4',2],['C5',4],['D5',2],['E5',2],['_',4],
               ['C5',1],['D5',1],['E5',1],['F5',1],['G5',4]] }
      ]
    },

    gameover: {
      bpm: 70, loop: false,
      channels: [
        { type:'sine',    vol:0.09, attack:0.05, release:0.8, detune:0,
          seq:[['E4',2],['D4',2],['C4',4],['B3',4],['_',4],['G3',6],['_',2]] },
        { type:'triangle',vol:0.05, attack:0.05, release:0.5, detune:-1200,
          seq:[['C3',4],['G3',4],['F3',4],['E3',4]] }
      ]
    }
  };

  // ── Note → freq helper ──
  function nfreq(n) {
    if(n==='_'||n===0) return 0;
    return NOTE[n] || 440;
  }

  // ── Build audio graph for a track ──
  function buildChannel(ch, bps, loopLen) {
    if(!ac) return null;
    const notes = [];
    let t = 0;
    ch.seq.forEach(step => {
      const noteName = step[0], beats = step[step.length-1];
      const dur = beats / bps;
      if(ch.type === 'noise') {
        if(noteName === 1 || noteName === true) notes.push({t, dur, freq: -1});
        else notes.push({t, dur, freq: 0});
      } else {
        const freqs = Array.isArray(noteName) ? noteName.map(nfreq) : [nfreq(noteName)];
        notes.push({t, dur, freqs});
      }
      t += dur;
    });
    return {ch, notes, loopLen: t};
  }

  function scheduleChannel(chData, startAt, vol, loop) {
    if(!ac||!chData) return [];
    const {ch, notes, loopLen} = chData;
    const scheduled = [];
    const playOnce = (offset) => {
      notes.forEach(n => {
        const st = startAt + offset + n.t;
        if(st < ac.currentTime - 0.05) return;
        const g = ac.createGain();
        g.connect(masterGain);
        g.gain.setValueAtTime(0, st);
        g.gain.linearRampToValueAtTime(ch.vol * vol, st + (ch.attack||0.02));
        g.gain.setValueAtTime(ch.vol * vol, st + n.dur - (ch.release||0.1));
        g.gain.exponentialRampToValueAtTime(0.0001, st + n.dur);

        if(ch.type === 'noise' && n.freq === -1) {
          const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate*n.dur), ac.sampleRate);
          const d = buf.getChannelData(0);
          for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
          const src = ac.createBufferSource();
          src.buffer = buf; src.connect(g); src.start(st);
          scheduled.push(src);
        } else if(n.freqs) {
          n.freqs.forEach(f => {
            if(f === 0) return;
            const o = ac.createOscillator();
            o.type = ch.type; o.frequency.value = f;
            if(ch.detune) o.detune.value = ch.detune;
            o.connect(g); o.start(st); o.stop(st + n.dur + 0.05);
            scheduled.push(o);
          });
        }
      });
    };

    if(loop) {
      for(let i=0;i<16;i++) playOnce(i * loopLen);
    } else {
      playOnce(0);
    }
    return scheduled;
  }

  function init() {
    if(ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ac.createGain();
    compressor = ac.createDynamicsCompressor();
    masterGain.connect(compressor); compressor.connect(ac.destination);
    masterGain.gain.value = 0.85;
  }

  function play(name) {
    if(!settings || !settings.music) return;
    if(trackName === name) return;
    stop();
    if(!ac) init();
    if(ac.state === 'suspended') ac.resume();
    trackName = name;
    const def = TRACKS[name]; if(!def) return;
    const bps = def.bpm / 60;
    const startAt = ac.currentTime + 0.05;
    const chDatas = def.channels.map(ch => buildChannel(ch, bps));
    track = { nodes: chDatas.flatMap(cd => scheduleChannel(cd, startAt, 1, def.loop)) };
  }

  function stop() {
    if(track) {
      track.nodes.forEach(n => { try{ n.stop(0); }catch(e){} });
      track = null;
    }
    trackName = '';
  }

  function setVol(v) { if(masterGain) masterGain.gain.value = v; }
  function resume() { if(ac && ac.state==='suspended') ac.resume(); }

  return { play, stop, setVol, resume, init };
})();

// ── Canvas & State ───────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
let stars = [];
let audioCtx;
const getAC = () => {
  if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  return audioCtx;
};

// ── Persist ──────────────────────────────────────────
let settings = {sfx:true, particles:true, flash:true, music:true, musicVol:0.85};
let leaderboard = [];
function loadPersist() {
  try { const s=localStorage.getItem('mb_s2'); if(s) settings={...settings,...JSON.parse(s)}; } catch(e){}
  try { const l=localStorage.getItem('mb_lb'); if(l) leaderboard=JSON.parse(l); } catch(e){}
  applySUI();
}
function saveSett() { try { localStorage.setItem('mb_s2',JSON.stringify(settings)); } catch(e){} }
function saveLB()   { try { localStorage.setItem('mb_lb',JSON.stringify(leaderboard)); } catch(e){} }

// ── Online Leaderboard ───────────────────────────────
let onlineLB  = [];
let lbLoading = false;

async function fetchOnlineLB() {
  if(!ONLINE_BOARD) return;
  lbLoading = true;
  try {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN}/latest`, {
      headers: {'X-Master-Key': JSONBIN_KEY}
    });
    const data = await r.json();
    onlineLB = data.record?.scores || [];
  } catch(e) { onlineLB = []; }
  lbLoading = false;
}

async function pushOnlineLB(entry) {
  if(!ONLINE_BOARD) return;
  try {
    // Fetch latest first
    const r1 = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN}/latest`, {
      headers:{'X-Master-Key':JSONBIN_KEY}
    });
    const d = await r1.json();
    let scores = d.record?.scores || [];
    scores.push(entry);
    scores.sort((a,b)=>b.score-a.score);
    if(scores.length>MAX_LB) scores.length=MAX_LB;
    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN}`, {
      method:'PUT',
      headers:{'Content-Type':'application/json','X-Master-Key':JSONBIN_KEY},
      body: JSON.stringify({scores})
    });
    onlineLB = scores;
  } catch(e){}
}

function mergedLB() {
  const all = [...leaderboard];
  onlineLB.forEach(e => {
    if(!all.find(x=>x.name===e.name&&x.score===e.score)) all.push(e);
  });
  all.sort((a,b)=>b.score-a.score);
  return all.slice(0,MAX_LB);
}

function addLBEntry(name,score,level) {
  const entry = {name:name.trim()||'PILOT',score,level,date:new Date().toLocaleDateString()};
  leaderboard.push(entry);
  leaderboard.sort((a,b)=>b.score-a.score);
  if(leaderboard.length>MAX_LB) leaderboard.length=MAX_LB;
  saveLB();
  pushOnlineLB(entry);
}
function qualifies(score) {
  const all=mergedLB();
  return all.length<MAX_LB || score>all[all.length-1]?.score;
}

// ── State ────────────────────────────────────────────
let phase='start', prePause='playing', prevPhase='start';
let animId=0, lastTs=0;
let GS={};
const keys={};

// ── Input ────────────────────────────────────────────
document.addEventListener('keydown',e=>{
  keys[e.key]=true;
  if(e.key===' ') e.preventDefault();
  if(e.key==='Escape') handleEsc();
});
document.addEventListener('keyup',e=>{keys[e.key]=false;});
function handleEsc(){
  if(phase==='playing'||phase==='bossActive') togglePause();
  else if(phase==='paused') togglePause();
  else if(phase==='settings') backFromSettings();
  else if(phase==='leaderboard') showScreen('start');
}

// ── Screen Mgmt ──────────────────────────────────────
function showScreen(name){
  document.querySelectorAll('.screen,.overlay').forEach(el=>el.classList.add('hidden'));
  document.getElementById('gameUI').classList.add('hidden');
  if(name==='game'){document.getElementById('gameUI').classList.remove('hidden');}
  else{document.getElementById(name+'Screen').classList.remove('hidden');}
}
function showOv(id){document.getElementById(id+'Overlay').classList.remove('hidden');}
function hideOv(id){document.getElementById(id+'Overlay').classList.add('hidden');}

// ── Resize ───────────────────────────────────────────
function resize(){
  const maxW=window.innerWidth;
  const hudEl=document.querySelector('.hud'), barEl=document.getElementById('powerupBar');
  const bossEl=document.getElementById('bossBar');
  const hudH=(hudEl?.offsetHeight||46)+(barEl?.offsetHeight||26)+
             (bossEl?.classList.contains('hidden')?0:(bossEl?.offsetHeight||0));
  canvas.width=maxW;
  canvas.height=Math.min(window.innerHeight-hudH,680);
  genStars();
}
window.addEventListener('resize',resize);
function genStars(){
  stars=Array.from({length:140},()=>({
    x:Math.random()*canvas.width,y:Math.random()*canvas.height,
    r:Math.random()*1.4+0.2,spd:Math.random()*0.5+0.15,a:Math.random()*0.5+0.3
  }));
}

// ── Audio SFX ────────────────────────────────────────
function tone(freq,dur,type='square',vol=0.12){
  if(!settings.sfx) return;
  try{
    const ac=getAC(),o=ac.createOscillator(),g=ac.createGain();
    o.connect(g);g.connect(ac.destination);
    o.type=type;o.frequency.value=freq;
    g.gain.setValueAtTime(vol,ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+dur);
    o.start();o.stop(ac.currentTime+dur);
  }catch(e){}
}
function noise(dur,vol=0.2){
  if(!settings.sfx) return;
  try{
    const ac=getAC(),buf=ac.createBuffer(1,ac.sampleRate*dur,ac.sampleRate);
    const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    const src=ac.createBufferSource(),g=ac.createGain();
    g.gain.setValueAtTime(vol,ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+dur);
    src.buffer=buf;src.connect(g);g.connect(ac.destination);src.start();
  }catch(e){}
}
const SFX={
  shoot:  ()=>tone(800,0.07,'square',0.09),
  explode:()=>noise(0.14,0.18),
  bossHit:()=>tone(180,0.09,'sawtooth',0.14),
  pu:     ()=>{tone(500,0.08,'sine',0.1);setTimeout(()=>tone(750,0.1,'sine',0.12),90);setTimeout(()=>tone(1000,0.12,'sine',0.14),180);},
  die:    ()=>{[400,300,200,120].forEach((f,i)=>setTimeout(()=>tone(f,0.14,'sawtooth',0.18),i*100));},
  level:  ()=>{[350,450,600,800].forEach((f,i)=>setTimeout(()=>tone(f,0.1,'sine',0.18),i*75));},
  bossWarn:()=>{[220,160,220,160].forEach((f,i)=>setTimeout(()=>tone(f,0.18,'sawtooth',0.22),i*200));},
};

// ── Init ─────────────────────────────────────────────
function initGame(){
  resize();
  GS={
    p:{x:canvas.width/2,y:canvas.height-60,w:36,h:40,damage:0,dead:false},
    bullets:[],meteors:[],powerups:[],particles:[],explosions:[],bproj:[],
    score:0,lives:3,level:1,
    timer:LEVEL_SECS*1000,quota:0,spawned:0,destroyed:0,
    spawnIv:0,spawnT:0,shootCD:0,
    effects:{},invincible:false,invT:0,boss:null,
  };
  setupLevel();
}

function setupLevel(){
  const lv=GS.level;
  GS.bullets=[];GS.meteors=[];GS.powerups=[];GS.bproj=[];
  GS.timer=LEVEL_SECS*1000;GS.destroyed=0;
  if(BOSS_LEVELS.has(lv)){
    GS.quota=0;GS.spawned=0;
    phase='bossIntro';
    Music.play('boss');
    showBossIntro(lv);
  } else {
    GS.quota=METEOR_BASE+(lv-1)*METEOR_GROW;
    GS.spawned=0;
    GS.spawnIv=Math.max(450,2600-lv*90);
    GS.spawnT=500;
    setBossBar(false);
    phase='playing';
    Music.play('game');
    updateHUD();
  }
}

// ── Boss Intro ───────────────────────────────────────
function showBossIntro(lv){
  SFX.bossWarn();
  const b=BOSSES[lv];
  document.getElementById('biName').textContent=b.name;
  document.getElementById('biSub').textContent=b.sub;
  const fill=document.getElementById('biFill');
  fill.style.animation='none';void fill.offsetWidth;fill.style.animation='biLoad 2.8s linear forwards';
  showScreen('game');showOv('bossIntro');
  setTimeout(()=>{hideOv('bossIntro');spawnBoss(lv);phase='bossActive';setBossBar(true);updateHUD();},3100);
}
function spawnBoss(lv){
  const def=BOSSES[lv];
  GS.boss={...def,x:canvas.width/2,y:-def.sz,maxHp:def.hp,entering:true,
    targetY:def.sz+25,vx:def.spd,atkT:def.atkRate,phase:1,pulse:0,lv};
}

// ── Game Loop ────────────────────────────────────────
function gameLoop(ts){
  animId=requestAnimationFrame(gameLoop);
  const dt=Math.min(ts-(lastTs||ts),50);
  lastTs=ts;
  stars.forEach(s=>{s.y+=s.spd;if(s.y>canvas.height){s.y=0;s.x=Math.random()*canvas.width;}});
  if(phase==='playing'||phase==='bossActive') update(dt);
  draw();
}

// ── Update ───────────────────────────────────────────
function update(dt){
  if(GS.shootCD>0) GS.shootCD-=dt;
  if(GS.invT>0){GS.invT-=dt;if(GS.invT<=0)GS.invincible=false;}
  for(let k in GS.effects){GS.effects[k]-=dt;if(GS.effects[k]<=0)delete GS.effects[k];}

  if(keys['ArrowLeft']||keys['a'])  GS.p.x=Math.max(GS.p.w/2,GS.p.x-9);
  if(keys['ArrowRight']||keys['d']) GS.p.x=Math.min(canvas.width-GS.p.w/2,GS.p.x+9);

  if((keys[' ']||keys['ArrowUp'])&&GS.shootCD<=0){
    shoot();GS.shootCD=GS.effects.rapid?SHOOT_RAPID:SHOOT_NORM;
  }

  GS.bullets=GS.bullets.filter(b=>b.y>-10);
  GS.bullets.forEach(b=>{b.x+=b.vx;b.y+=b.vy;});

  if(settings.particles){
    GS.particles=GS.particles.filter(p=>p.life>0);
    GS.particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.05;p.life-=dt/700;p.a=Math.max(0,p.life);});
  }
  GS.explosions=GS.explosions.filter(e=>e.life>0);
  GS.explosions.forEach(e=>{e.r+=3.5;e.life-=dt/350;e.a=Math.max(0,e.life);});

  GS.powerups=GS.powerups.filter(p=>p.y<canvas.height+40);
  GS.powerups.forEach(p=>{p.y+=p.spd;p.pulse+=0.08;});
  for(let i=GS.powerups.length-1;i>=0;i--){
    const p=GS.powerups[i];
    if(dist(p.x,p.y,GS.p.x,GS.p.y)<p.r+20){collectPU(p.type);spawnParts(p.x,p.y,p.color,16);GS.powerups.splice(i,1);}
  }

  if(phase==='playing') updateNormal(dt);
  if(phase==='bossActive') updateBoss(dt);
  updateHUD();updatePUBar();
}

function updateNormal(dt){
  GS.timer-=dt;
  if(GS.timer<=0){GS.timer=0;GS.meteors.forEach(m=>spawnParts(m.x,m.y,m.color,8));GS.meteors=[];levelDone();return;}
  if(GS.spawned<GS.quota){GS.spawnT-=dt;if(GS.spawnT<=0){spawnMeteor();GS.spawned++;GS.spawnT=GS.spawnIv+Math.random()*300;}}
  GS.meteors=GS.meteors.filter(m=>m.y<canvas.height+60);
  GS.meteors.forEach(m=>{m.x+=m.vx;m.y+=m.vy;m.rot+=m.rotSpd;if(m.x<m.r||m.x>canvas.width-m.r)m.vx*=-1;});

  outer: for(let bi=GS.bullets.length-1;bi>=0;bi--){
    for(let mi=GS.meteors.length-1;mi>=0;mi--){
      const m=GS.meteors[mi],b=GS.bullets[bi];
      if(dist(b.x,b.y,m.x,m.y)<m.r+4){
        m.hp--;spawnParts(b.x,b.y,'#ffd600',5);GS.bullets.splice(bi,1);
        if(m.hp<=0)destroyMeteor(mi,m);continue outer;
      }
    }
  }
  if(!GS.invincible){
    for(let mi=GS.meteors.length-1;mi>=0;mi--){
      const m=GS.meteors[mi];
      if(dist(m.x,m.y,GS.p.x,GS.p.y)<m.r+14){
        if(GS.effects.shield){useShield();GS.meteors.splice(mi,1);}
        else{hitPlayer();GS.meteors.splice(mi,1);}break;
      }
    }
  }
  if(GS.spawned>=GS.quota&&GS.meteors.length===0)levelDone();
}

function updateBoss(dt){
  const b=GS.boss;if(!b||b.dead)return;
  b.pulse+=dt*0.003;
  if(b.entering){b.y+=3;if(b.y>=b.targetY){b.y=b.targetY;b.entering=false;}return;}
  if(b.final){
    const pct=b.hp/b.maxHp;
    if(pct<0.33&&b.phase<3){b.phase=3;b.vx*=1.5;b.atkRate=700;}
    else if(pct<0.66&&b.phase<2){b.phase=2;b.vx*=1.3;b.atkRate=1000;}
  }
  b.x+=b.vx;if(b.x<b.sz/2||b.x>canvas.width-b.sz/2)b.vx*=-1;
  if(b.final&&b.phase===3)b.x+=(Math.random()-.5)*3;
  b.atkT-=dt;if(b.atkT<=0){bossAttack();b.atkT=b.atkRate;}

  GS.bproj=GS.bproj.filter(p=>p.y<canvas.height+20&&p.x>-20&&p.x<canvas.width+20);
  GS.bproj.forEach(p=>{p.x+=p.vx;p.y+=p.vy;});

  for(let bi=GS.bullets.length-1;bi>=0;bi--){
    const bul=GS.bullets[bi];
    if(dist(bul.x,bul.y,b.x,b.y)<b.sz/2+4){
      b.hp--;SFX.bossHit();spawnParts(bul.x,bul.y,b.glow,6);
      GS.bullets.splice(bi,1);setBossBar(true);
      if(b.hp<=0){killBoss();return;}break;
    }
  }
  if(!GS.invincible){
    for(let pi=GS.bproj.length-1;pi>=0;pi--){
      const p=GS.bproj[pi];
      if(dist(p.x,p.y,GS.p.x,GS.p.y)<p.r+14){
        if(GS.effects.shield){useShield();GS.bproj.splice(pi,1);}
        else{hitPlayer();GS.bproj.splice(pi,1);}break;
      }
    }
  }
}

function bossAttack(){
  const b=GS.boss,px=b.x,py=b.y+b.sz/2;
  const spd=b.shotSpd+(b.phase||1)*0.25,cnt=b.shots+(b.phase||1)-1;
  if(b.pattern==='aimed'){
    const a=Math.atan2(GS.p.y-py,GS.p.x-px);addBP(px,py,Math.cos(a)*spd,Math.sin(a)*spd,b.glow);
  } else if(b.pattern==='spread'){
    for(let i=0;i<cnt;i++){const a=Math.PI/2+(i-(cnt-1)/2)*0.28;addBP(px,py,Math.cos(a)*spd,Math.sin(a)*spd,b.glow);}
  } else if(b.pattern==='spiral'){
    const base=Date.now()/600;
    for(let i=0;i<cnt;i++){const a=base+(i/cnt)*Math.PI*2;addBP(px,py,Math.cos(a)*spd,Math.sin(a)*spd,b.glow);}
  } else if(b.pattern==='chaos'){
    if(b.phase===1){const a=Math.atan2(GS.p.y-py,GS.p.x-px);for(let i=0;i<3;i++)addBP(px,py,Math.cos(a+(i-1)*.2)*spd,Math.sin(a+(i-1)*.2)*spd,b.glow);}
    else if(b.phase===2){for(let i=0;i<5;i++){const a=Math.PI/2+(i-2)*.22;addBP(px,py,Math.cos(a)*spd,Math.sin(a)*spd,b.glow);}}
    else{const base=Date.now()/400;for(let i=0;i<8;i++){const a=base+(i/8)*Math.PI*2;addBP(px,py,Math.cos(a)*spd,Math.sin(a)*spd,b.glow);}const a=Math.atan2(GS.p.y-py,GS.p.x-px);addBP(px,py,Math.cos(a)*spd*1.2,Math.sin(a)*spd*1.2,b.glow);}
  }
}
function addBP(x,y,vx,vy,color){GS.bproj.push({x,y,vx,vy,r:6,color});}

function killBoss(){
  const b=GS.boss;b.dead=true;
  SFX.explode();
  for(let i=0;i<6;i++)setTimeout(()=>{spawnParts(b.x+(Math.random()-.5)*b.sz,b.y+(Math.random()-.5)*b.sz/2,b.glow,18);addExp(b.x+(Math.random()-.5)*b.sz,b.y,b.glow);},i*150);
  GS.score+=b.lv===20?3000:1000;
  if(settings.flash)doFlash(b.glow+'44');
  setTimeout(()=>{b.lv===20?triggerVictory():bossDone();},1000);
}

function shoot(){
  SFX.shoot();
  const{x,y}=GS.p;
  if(GS.effects.triple){GS.bullets.push({x:x-14,y:y-20,vx:-1.5,vy:-10},{x,y:y-24,vx:0,vy:-10},{x:x+14,y:y-20,vx:1.5,vy:-10});}
  else{GS.bullets.push({x,y:y-24,vx:0,vy:-10});}
}
function hitPlayer(){
  GS.lives--;SFX.die();
  GS.p.damage=3-GS.lives; // 0=pristine,1=dented,2=critical
  spawnParts(GS.p.x,GS.p.y,'#ff2d55',25);addExp(GS.p.x,GS.p.y,'#ff2d55');
  if(settings.flash)doFlash('#ff2d5540');
  GS.invincible=true;GS.invT=1800;
  if(GS.lives<=0){
    shipDeathExplosion();
    setTimeout(triggerGameOver,1400);
  }
}
function shipDeathExplosion(){
  GS.p.dead=true;
  const{x,y}=GS.p;
  // Wave of expanding rings + debris bursts
  for(let i=0;i<5;i++){
    setTimeout(()=>{
      spawnParts(x+(Math.random()-.5)*40,y+(Math.random()-.5)*30,'#ff6a00',22);
      spawnParts(x+(Math.random()-.5)*30,y+(Math.random()-.5)*20,'#ffd600',14);
      addExp(x+(Math.random()-.5)*50,y+(Math.random()-.5)*30,'#ff2d55');
      addExp(x+(Math.random()-.5)*40,y+(Math.random()-.5)*25,'#ff6a00');
      SFX.explode();
    },i*200);
  }
  // Final big bang
  setTimeout(()=>{
    spawnParts(x,y,'#ffffff',40);
    spawnParts(x,y,'#ff6a00',30);
    spawnParts(x,y,'#ffd600',20);
    addExp(x,y,'#ffffff');addExp(x,y,'#ff6a00');
    if(settings.flash)doFlash('#ff6a0066');
  },1000);
}
function useShield(){spawnParts(GS.p.x,GS.p.y,'#39ff14',20);addExp(GS.p.x,GS.p.y,'#39ff14');delete GS.effects.shield;GS.invincible=true;GS.invT=600;}

function spawnMeteor(){
  const lv=GS.level,spd=1.3+lv*0.18,sz=13+Math.random()*22;
  const hp=sz>28?Math.min(3,1+Math.floor(lv/5)):sz>20?Math.min(2,1+Math.floor(lv/8)):1;
  const cols=['#b46a2e','#8a4e20','#c07030','#7a3d18','#d4854a'];
  GS.meteors.push({x:Math.random()*(canvas.width-sz*2)+sz,y:-sz,r:sz,vx:(Math.random()-.5)*1.6,vy:spd+Math.random()*spd*.8,rot:0,rotSpd:(Math.random()-.5)*.05,color:cols[Math.floor(Math.random()*cols.length)],hp,maxHp:hp});
}
function destroyMeteor(mi,m){
  GS.score+=Math.round(m.r*3);GS.destroyed++;
  SFX.explode();spawnParts(m.x,m.y,m.color,18);addExp(m.x,m.y,'#ff6a00');
  GS.meteors.splice(mi,1);
  if(Math.random()<PU_PROB)spawnPU(m.x,m.y);
}

function spawnPU(x,y){
  const types=['rapid','triple','shield','bomb'];
  const cols={rapid:'#ffd600',triple:'#00f5ff',shield:'#39ff14',bomb:'#ff2d55'};
  const lbls={rapid:'⚡',triple:'✦',shield:'🛡',bomb:'💥'};
  const type=types[Math.floor(Math.random()*types.length)];
  GS.powerups.push({x,y,r:14,spd:1.4,type,color:cols[type],label:lbls[type],pulse:0});
}
function collectPU(type){
  SFX.pu();
  if(type==='bomb'){
    GS.meteors.forEach(m=>{spawnParts(m.x,m.y,m.color,12);addExp(m.x,m.y,'#ff6a00');GS.score+=Math.round(m.r*2);GS.destroyed++;});
    GS.meteors=[];if(settings.flash)doFlash('#ff2d5530');
  } else{GS.effects[type]=PU_DUR;}
}

function spawnParts(x,y,color,n){
  if(!settings.particles)return;
  for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=Math.random()*3+.5;
    GS.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,a:1,r:Math.random()*3+1,color});}
}
function addExp(x,y,color){GS.explosions.push({x,y,r:4,life:1,a:1,color});}
function doFlash(col){
  if(!settings.flash)return;
  const d=document.createElement('div');
  d.style.cssText=`position:fixed;inset:0;background:${col};pointer-events:none;z-index:999;transition:opacity .4s`;
  document.body.appendChild(d);
  requestAnimationFrame(()=>{d.style.opacity='0';setTimeout(()=>d.remove(),500);});
}
function announce(text,dur=1800,cls=''){
  const el=document.getElementById('announceEl');
  el.textContent=text;el.className='show'+(cls?' '+cls:'');
  setTimeout(()=>el.className='',dur);
}

// ── Level Flow ───────────────────────────────────────
function levelDone(){
  if(phase!=='playing')return;
  phase='levelComplete';SFX.level();
  const tb=Math.floor((GS.timer/1000)*10);GS.score+=tb;
  const nextBoss=BOSS_LEVELS.has(GS.level+1);
  showLC(`LEVEL ${GS.level} CLEAR!`,[{l:'Meteors Destroyed',v:GS.destroyed},{l:'Time Bonus',v:`+${tb}`},{l:'Total Score',v:GS.score}],nextBoss);
}
function bossDone(){
  if(phase!=='bossActive')return;
  phase='levelComplete';setBossBar(false);
  const nextBoss=BOSS_LEVELS.has(GS.level+1);
  showLC('BOSS DEFEATED!',[{l:'Boss Bonus',v:'+1000'},{l:'Total Score',v:GS.score}],nextBoss);
  if(!nextBoss) Music.play('game');
}
function showLC(title,stats,nextBoss){
  document.getElementById('lcTitle').textContent=title;
  document.getElementById('lcStats').innerHTML=stats.map(s=>`<div class="stat-row"><span class="stat-label">${s.l}</span><span class="stat-val">${s.v}</span></div>`).join('');
  document.getElementById('bossWarnEl').classList.toggle('hidden',!nextBoss);
  showScreen('game');showOv('levelComplete');
  const go=()=>{hideOv('levelComplete');document.removeEventListener('keydown',spKey);document.getElementById('continueBtn').removeEventListener('click',go);advLevel();};
  const spKey=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();go();}};
  document.addEventListener('keydown',spKey);
  document.getElementById('continueBtn').addEventListener('click',go,{once:true});
}
function advLevel(){GS.level++;if(GS.level>MAX_LEVELS){triggerVictory();return;}setupLevel();if(phase==='playing'){showScreen('game');announce(`LEVEL ${GS.level}`);}}

function triggerGameOver(){
  phase='gameOver';Music.play('gameover');
  cancelAnimationFrame(animId);animId=0;
  document.getElementById('goScore').textContent=GS.score;
  document.getElementById('goLevel').textContent=GS.level;
  if(qualifies(GS.score))showNameEntry(GS.score,GS.level,()=>showScreen('gameOver'));
  else showScreen('gameOver');
}
function triggerVictory(){
  phase='victory';Music.play('victory');
  cancelAnimationFrame(animId);animId=0;
  document.getElementById('vicScore').textContent=GS.score;
  if(settings.flash)doFlash('#ffd60055');
  showNameEntry(GS.score,MAX_LEVELS,()=>showScreen('victory'));
}
function showNameEntry(score,level,cb){
  document.getElementById('entryScore').textContent=score;
  document.getElementById('nameInput').value='';
  showScreen('nameEntry');
  document.getElementById('submitBtn').onclick=()=>{addLBEntry(document.getElementById('nameInput').value,score,level);cb();};
}

// ── Leaderboard ──────────────────────────────────────
async function renderLB(){
  const el=document.getElementById('lbList');
  el.innerHTML='<div class="lb-empty">Loading scores…</div>';
  await fetchOnlineLB();
  const all=mergedLB();
  if(!all.length){el.innerHTML='<div class="lb-empty">No scores yet. Be the first!</div>';return;}
  const onlineNote=ONLINE_BOARD?'<div class="lb-online-note">🌐 Global Leaderboard</div>':'<div class="lb-online-note local">💾 Local Scores Only</div>';
  el.innerHTML=onlineNote+all.map((e,i)=>`
    <div class="lb-row ${['gold','silver','bronze'][i]||''}">
      <span class="lb-rank">${['🥇','🥈','🥉'][i]||`#${i+1}`}</span>
      <span class="lb-name">${e.name}</span>
      <span class="lb-score">${Number(e.score).toLocaleString()}</span>
      <span class="lb-level">LV${e.level}</span>
    </div>`).join('');
}

// ── Settings ─────────────────────────────────────────
function applySUI(){
  const t=(id,val)=>{const el=document.getElementById(id);if(!el)return;el.textContent=val?'ON':'OFF';el.classList.toggle('off',!val);};
  t('sfxToggle',settings.sfx);t('particlesToggle',settings.particles);
  t('flashToggle',settings.flash);t('musicToggle',settings.music);
  const vs=document.getElementById('volSlider');if(vs)vs.value=Math.round(settings.musicVol*100);
  Music.setVol(settings.music?settings.musicVol:0);
}
function toggleS(key,id){settings[key]=!settings[key];saveSett();applySUI();
  if(key==='music'){if(settings.music){Music.resume();if(phase==='playing')Music.play('game');else if(phase==='bossActive')Music.play('boss');}else Music.stop();}
}
function backFromSettings(){
  if(prevPhase==='paused'){showScreen('game');showOv('pause');phase='paused';}
  else{showScreen('start');phase='start';}
}

// ── Pause ────────────────────────────────────────────
function togglePause(){
  if(phase==='playing'||phase==='bossActive'){prePause=phase;phase='paused';showOv('pause');}
  else if(phase==='paused'){hideOv('pause');phase=prePause;lastTs=0;Music.resume();}
}

// ── HUD ──────────────────────────────────────────────
function updateHUD(){
  document.getElementById('scoreDisplay').textContent=GS.score.toLocaleString();
  document.getElementById('levelDisplay').textContent=`${GS.level} / ${MAX_LEVELS}`;
  document.getElementById('livesDisplay').textContent='♥'.repeat(Math.max(0,GS.lives));
  const secs=Math.max(0,Math.ceil(GS.timer/1000)),m=Math.floor(secs/60),s=secs%60;
  const tEl=document.getElementById('timerDisplay');
  tEl.textContent=`${m}:${s.toString().padStart(2,'0')}`;
  tEl.className='hv'+(secs<=20&&phase==='playing'?' danger':'');
  tEl.parentElement.style.display=(phase==='bossActive')?'none':'';
}
function updatePUBar(){
  const bar=document.getElementById('powerupBar');bar.innerHTML='';
  const lbs={rapid:'⚡ RAPID',triple:'✦ TRIPLE',shield:'🛡 SHIELD'};
  for(let k in GS.effects){if(lbs[k]){const el=document.createElement('div');el.className=`pu-indicator ${k}`;el.textContent=`${lbs[k]} ${Math.ceil(GS.effects[k]/1000)}s`;bar.appendChild(el);}}
}
function setBossBar(show){
  const bar=document.getElementById('bossBar');
  if(!show||!GS.boss){bar.classList.add('hidden');return;}
  bar.classList.remove('hidden');
  document.getElementById('bossBarName').textContent=GS.boss.name;
  const pct=Math.max(0,GS.boss.hp/GS.boss.maxHp);
  const fill=document.getElementById('bossHpFill');
  fill.style.width=(pct*100)+'%';
  const col=GS.boss.final&&GS.boss.phase===3?'#ff2d55':GS.boss.final&&GS.boss.phase===2?'#ff6a00':GS.boss.glow;
  fill.style.background=col;fill.style.boxShadow=`0 0 10px ${col}`;
  document.getElementById('bossHpText').textContent=Math.round(pct*100)+'%';
}

// ── Draw ──────────────────────────────────────────────
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#02020f';ctx.fillRect(0,0,canvas.width,canvas.height);
  stars.forEach(s=>{ctx.globalAlpha=s.a;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();});
  ctx.globalAlpha=1;
  GS.explosions.forEach(e=>{ctx.globalAlpha=e.a*.35;ctx.fillStyle=e.color;ctx.beginPath();ctx.arc(e.x,e.y,e.r,0,Math.PI*2);ctx.fill();});
  ctx.globalAlpha=1;
  if(settings.particles){GS.particles.forEach(p=>{ctx.globalAlpha=p.a;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;}
  GS.meteors.forEach(drawMeteor);
  if(GS.boss&&!GS.boss.dead)drawBoss(GS.boss);
  GS.bproj.forEach(p=>{ctx.save();ctx.shadowColor=p.color;ctx.shadowBlur=14;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.restore();});
  GS.powerups.forEach(drawPU);
  GS.bullets.forEach(b=>{ctx.save();ctx.shadowColor='#ffd600';ctx.shadowBlur=10;ctx.fillStyle='#ffd600';ctx.beginPath();ctx.ellipse(b.x,b.y,3,8,0,0,Math.PI*2);ctx.fill();ctx.restore();});
  drawPlayer();
}
function drawPlayer(){
  const{x,y,w,h}=GS.p;
  if(GS.p.dead) return;
  if(GS.invincible&&Math.floor(Date.now()/100)%2===0)return;
  const dmg=GS.p.damage||0; // 0=pristine 1=dented 2=critical
  const t=Date.now();
  ctx.save();

  // ── Engine exhaust (shrinks with damage) ──
  const exhaustColors=dmg===2?['#ff2d55','#ff6a00','#ff4400']:['#ff6a00','#ff9d00','#ffd600'];
  const ec=exhaustColors[Math.floor(t/80)%3];
  const exhaustH=dmg===2?6+Math.random()*6:12+Math.sin(t/80)*4;
  ctx.shadowBlur=15;ctx.shadowColor=ec;ctx.fillStyle=ec;
  ctx.beginPath();
  ctx.moveTo(x-8,y+h/2-10);
  ctx.lineTo(x,y+h/2+exhaustH);
  ctx.lineTo(x+8,y+h/2-10);
  ctx.fill();

  // Extra sputtering flames on critical damage
  if(dmg===2){
    ctx.fillStyle='#ff4400';
    ctx.globalAlpha=0.5+Math.random()*.5;
    ctx.beginPath();ctx.moveTo(x-14,y+4);ctx.lineTo(x-10,y+4+Math.random()*8);ctx.lineTo(x-6,y+4);ctx.fill();
    ctx.beginPath();ctx.moveTo(x+6,y+2);ctx.lineTo(x+10,y+2+Math.random()*8);ctx.lineTo(x+14,y+2);ctx.fill();
    ctx.globalAlpha=1;
  }

  // ── Ship color by damage state ──
  const shipColor = dmg===0?'#00f5ff': dmg===1?'#88ccdd':'#556677';
  const glowColor = dmg===0?'#00f5ff': dmg===1?'#ff8844':'#ff4400';
  ctx.shadowBlur=dmg===2?8:22;
  ctx.shadowColor=glowColor;
  ctx.fillStyle=shipColor;

  // ── Main hull ──
  ctx.beginPath();
  ctx.moveTo(x,          y-h/2);
  ctx.lineTo(x+w/2,      y+h/2-8);
  ctx.lineTo(x+w/4,      y+h/2);
  ctx.lineTo(x,          y+h/2-8);
  ctx.lineTo(x-w/4,      y+h/2);
  ctx.lineTo(x-w/2,      y+h/2-8);
  ctx.closePath();
  ctx.fill();

  // ── Damage 1: cracked left wing ──
  if(dmg>=1){
    ctx.strokeStyle='#ff4400';ctx.lineWidth=1.5;ctx.shadowBlur=6;ctx.shadowColor='#ff4400';
    ctx.beginPath();
    ctx.moveTo(x-w/2+4,  y+h/2-10);
    ctx.lineTo(x-w/4-2,  y);
    ctx.lineTo(x-w/4+4,  y-8);
    ctx.stroke();
    // scorch mark
    ctx.fillStyle='rgba(255,80,0,0.35)';
    ctx.beginPath();ctx.arc(x-w/2+6,y+h/2-12,5,0,Math.PI*2);ctx.fill();
  }

  // ── Damage 2: cracked right wing + hull burn ──
  if(dmg>=2){
    ctx.strokeStyle='#ff2d55';ctx.lineWidth=1.5;ctx.shadowBlur=8;ctx.shadowColor='#ff2d55';
    ctx.beginPath();
    ctx.moveTo(x+w/2-4,  y+h/2-10);
    ctx.lineTo(x+w/4+2,  y-2);
    ctx.lineTo(x+w/4-4,  y-12);
    ctx.stroke();
    // hull burn / charring
    ctx.fillStyle='rgba(255,0,40,0.25)';
    ctx.beginPath();ctx.arc(x+w/2-6,y+h/2-12,6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,100,0,0.2)';
    ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fill();
    // flicker glow on hull
    ctx.globalAlpha=0.3+Math.sin(t/60)*0.3;
    ctx.fillStyle='#ff2d55';
    ctx.beginPath();ctx.arc(x,y+4,8,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
  }

  // ── Cockpit ──
  ctx.shadowBlur=0;
  ctx.fillStyle = dmg===2?'#331000': dmg===1?'#002233':'#001a2e';
  ctx.beginPath();ctx.ellipse(x,y-5,6,9,0,0,Math.PI*2);ctx.fill();
  // cracked cockpit on critical
  if(dmg>=2){
    ctx.strokeStyle='rgba(255,60,0,0.7)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x-3,y-12);ctx.lineTo(x+2,y-2);ctx.lineTo(x-1,y+2);ctx.stroke();
  }

  // ── Shield ring ──
  if(GS.effects.shield){
    ctx.strokeStyle='#39ff14';ctx.lineWidth=2;ctx.shadowColor='#39ff14';ctx.shadowBlur=16;
    ctx.globalAlpha=0.7+Math.sin(t/200)*.3;
    ctx.beginPath();ctx.arc(x,y,32,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=1;
  }

  ctx.restore();
}
function drawMeteor(m){
  ctx.save();ctx.translate(m.x,m.y);ctx.rotate(m.rot);
  if(m.hp<m.maxHp){ctx.shadowColor='#ff4400';ctx.shadowBlur=16;}
  ctx.beginPath();
  for(let i=0;i<7;i++){const a=(i/7)*Math.PI*2,j=.72+((i*13+m.r*7)%100)/250;i===0?ctx.moveTo(Math.cos(a)*m.r*j,Math.sin(a)*m.r*j):ctx.lineTo(Math.cos(a)*m.r*j,Math.sin(a)*m.r*j);}
  ctx.closePath();
  const g=ctx.createRadialGradient(-m.r*.3,-m.r*.3,0,0,0,m.r);
  g.addColorStop(0,cshift(m.color,50));g.addColorStop(1,cshift(m.color,-40));
  ctx.fillStyle=g;ctx.fill();
  ctx.fillStyle=cshift(m.color,-60);
  [.3,.65,.15].forEach((s,i)=>{ctx.beginPath();ctx.arc(Math.cos(s*Math.PI*2)*m.r*.45,Math.sin(s*Math.PI*2)*m.r*.45,m.r*(.12+i*.04),0,Math.PI*2);ctx.fill();});
  if(m.maxHp>1)for(let i=0;i<m.maxHp;i++){ctx.fillStyle=i<m.hp?'#ffd600':'rgba(255,255,255,.2)';ctx.beginPath();ctx.arc(-m.r*.3+i*12,-m.r-8,3,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
function drawBoss(b){
  ctx.save();ctx.translate(b.x,b.y);
  ctx.shadowColor=b.glow;ctx.shadowBlur=30+Math.sin(b.pulse)*10;
  ctx.fillStyle=b.color;ctx.beginPath();
  for(let i=0;i<10;i++){const a=(i/10)*Math.PI*2,r=b.sz/2*(.85+((i*7+17)%10)/40);i===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
  ctx.closePath();ctx.fill();
  const coreC=b.final&&b.phase===3?'#ff0040':b.glow,cr=b.sz/4+Math.sin(b.pulse*2)*5;
  const cg=ctx.createRadialGradient(0,0,0,0,0,cr);
  cg.addColorStop(0,'#ffffff');cg.addColorStop(.4,coreC);cg.addColorStop(1,'transparent');
  ctx.fillStyle=cg;ctx.globalAlpha=.85;ctx.beginPath();ctx.arc(0,0,cr,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  ctx.fillStyle=cshift(b.color,-55);
  [[-b.sz*.2,-b.sz*.15,b.sz*.1],[b.sz*.18,-b.sz*.05,b.sz*.07],[0,b.sz*.2,b.sz*.09]].forEach(([cx,cy,cr])=>{ctx.beginPath();ctx.arc(cx,cy,cr,0,Math.PI*2);ctx.fill();});
  if(b.final&&b.phase>1){ctx.strokeStyle=b.phase===3?'#ff2d55':'#ff6a00';ctx.lineWidth=3;ctx.shadowBlur=22;ctx.beginPath();ctx.arc(0,0,b.sz/2+8+Math.sin(b.pulse)*4,0,Math.PI*2);ctx.stroke();}
  ctx.shadowBlur=0;ctx.fillStyle=b.glow;ctx.font=`bold ${Math.max(10,Math.floor(b.sz/5))}px Orbitron,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(b.final&&b.phase>1?`☠ ${b.name} ☠`:b.name,0,b.sz/2+18);
  ctx.restore();
}
function drawPU(p){
  const pulse=Math.sin(p.pulse)*3;ctx.save();ctx.shadowBlur=18+pulse;ctx.shadowColor=p.color;ctx.strokeStyle=p.color;ctx.lineWidth=2;
  ctx.globalAlpha=.85+Math.sin(p.pulse)*.15;ctx.fillStyle=p.color+'33';ctx.beginPath();ctx.arc(p.x,p.y,p.r+pulse*.5,0,Math.PI*2);ctx.stroke();ctx.fill();
  ctx.globalAlpha=1;ctx.fillStyle=p.color;ctx.font=`${p.r}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p.label,p.x,p.y);ctx.restore();
}

function dist(x1,y1,x2,y2){const dx=x1-x2,dy=y1-y2;return Math.sqrt(dx*dx+dy*dy);}
function cshift(hex,a){
  let r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.max(0,Math.min(255,r+a))},${Math.max(0,Math.min(255,g+a))},${Math.max(0,Math.min(255,b+a))})`;
}

// ── Touch ────────────────────────────────────────────
let touchX=null;
canvas.addEventListener('touchstart',e=>{touchX=e.touches[0].clientX;keys[' ']=true;Music.resume();getAC();},{passive:true});
canvas.addEventListener('touchmove',e=>{const nx=e.touches[0].clientX;if(touchX!==null){const d=nx-touchX;GS.p&&(GS.p.x=Math.max(GS.p.w/2,Math.min(canvas.width-GS.p.w/2,GS.p.x+d*1.5)));}touchX=nx;keys[' ']=true;},{passive:true});
canvas.addEventListener('touchend',()=>{keys[' ']=false;touchX=null;});

// ── Buttons ──────────────────────────────────────────
function startFresh(){
  Music.resume();getAC();
  cancelAnimationFrame(animId);animId=0;
  initGame();showScreen('game');announce('LEVEL 1');
  lastTs=0;animId=requestAnimationFrame(gameLoop);
}

document.getElementById('startBtn').onclick=startFresh;
document.getElementById('restartBtn').onclick=startFresh;
document.getElementById('lbBtn').onclick=async()=>{phase='leaderboard';showScreen('leaderboard');await renderLB();};
document.getElementById('settingsBtn').onclick=()=>{prevPhase='start';phase='settings';showScreen('settings');};
document.getElementById('lbBackBtn').onclick=()=>{phase='start';showScreen('start');};
document.getElementById('settingsBackBtn').onclick=backFromSettings;
document.getElementById('sfxToggle').onclick=()=>toggleS('sfx','sfxToggle');
document.getElementById('particlesToggle').onclick=()=>toggleS('particles','particlesToggle');
document.getElementById('flashToggle').onclick=()=>toggleS('flash','flashToggle');
document.getElementById('musicToggle').onclick=()=>toggleS('music','musicToggle');
document.getElementById('volSlider').addEventListener('input',e=>{settings.musicVol=e.target.value/100;saveSett();Music.setVol(settings.music?settings.musicVol:0);});
document.getElementById('pauseBtn').onclick=togglePause;
document.getElementById('resumeBtn').onclick=togglePause;
document.getElementById('pauseSettingsBtn').onclick=()=>{hideOv('pause');prevPhase='paused';phase='settings';showScreen('settings');};
document.getElementById('quitBtn').onclick=()=>{cancelAnimationFrame(animId);animId=0;hideOv('pause');phase='start';Music.play('menu');showScreen('start');};
document.getElementById('goMenuBtn').onclick=()=>{phase='start';Music.play('menu');showScreen('start');};
document.getElementById('vicMenuBtn').onclick=()=>{phase='start';Music.play('menu');showScreen('start');};

// ── Boot ─────────────────────────────────────────────
loadPersist();resize();showScreen('start');
if(settings.music) setTimeout(()=>Music.play('menu'),300);
requestAnimationFrame(()=>{
  ctx.fillStyle='#02020f';ctx.fillRect(0,0,canvas.width,canvas.height);
  stars.forEach(s=>{ctx.globalAlpha=s.a;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;
});