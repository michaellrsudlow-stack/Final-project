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
  20: {name:'ICSPARK',         sub:'— The Final Spark —',    color:'#0a1a3a',glow:'#00f5ff',hp:160, sz:115,spd:2.2,atkRate:1100,shots:8,shotSpd:5.2,pattern:'chaos',final:true,icspark:true},
};

// ── Difficulty ────────────────────────────────────────────
let currentDiff = 'normal';
let endlessMode  = false;   // true when playing endless
let endlessWave  = 1;       // endless wave counter (goes beyond 20)

const DIFF = {
  easy:   { lives:5, meteorSpd:0.7, meteorBase:8,  meteorGrow:2, bossHpMult:0.6, puProb:0.38, spawnIvMult:1.4, label:'EASY',   scoreMult:0.75 },
  normal: { lives:3, meteorSpd:1.0, meteorBase:12, meteorGrow:3, bossHpMult:1.0, puProb:0.26, spawnIvMult:1.0, label:'NORMAL', scoreMult:1.0  },
  hard:   { lives:2, meteorSpd:1.5, meteorBase:16, meteorGrow:4, bossHpMult:1.5, puProb:0.16, spawnIvMult:0.7, label:'HARD',   scoreMult:1.5  },
};
function setDiff(d){
  currentDiff=d;
  ['easy','normal','hard'].forEach(k=>{
    const btn=document.getElementById('d'+k.charAt(0).toUpperCase()+k.slice(1));
    if(btn){btn.classList.toggle('active',k===d);btn.className=btn.className.replace(/\b(easy|normal|hard)\b/g,'').trim()+' '+k;btn.classList.toggle('active',k===d);}
  });
}
window.setDiff=setDiff;

// ── Leaderboard filter state ──────────────────────────────
let lbFilter='all', lbDiffFilter='all';
function setLBFilter(f){ lbFilter=f; document.getElementById('lbAllBtn').classList.toggle('active',f==='all'); document.getElementById('lbMineBtn').classList.toggle('active',f==='mine'); renderLB(); }
function setLBDiff(d){ lbDiffFilter=d; ['All','Easy','Norm','Hard','End'].forEach(k=>{ const el=document.getElementById('lbDiff'+k); if(el) el.classList.toggle('active', d===k.toLowerCase()||(d==='normal'&&k==='Norm')||(d==='endless'&&k==='End')||(d==='all'&&k==='All')); }); renderLB(); }
window.setLBFilter=setLBFilter; window.setLBDiff=setLBDiff;


// ── Boss Kill Tracking & Custom Bosses ───────────────────
let bossKills    = 0;
let customBosses = [];
const BOSS_CREATOR_UNLOCK = 5;

function loadBossData(){
  try{ bossKills=parseInt(localStorage.getItem('mb_bossKills')||'0'); }catch(e){}
  try{ const c=localStorage.getItem('mb_customBosses'); if(c) customBosses=JSON.parse(c); }catch(e){}
}
function saveBossData(){
  try{ localStorage.setItem('mb_bossKills',bossKills); }catch(e){}
  try{ localStorage.setItem('mb_customBosses',JSON.stringify(customBosses)); }catch(e){}
}
function checkCreatorUnlock(){
  const btn=document.getElementById('bossCreatorBtn');
  if(!btn) return;
  const unlocked=bossKills>=BOSS_CREATOR_UNLOCK;
  btn.classList.toggle('hidden',!unlocked);
  btn.title=unlocked?`Boss Creator — ${customBosses.length} saved`:`Defeat ${BOSS_CREATOR_UNLOCK} bosses in Endless to unlock`;
}

const SUPPORT_POOL = [
  {
    id:'companion', icon:'🛸', name:'WING COMPANION', rarity:'epic',
    desc:'A fighter drone joins your side and auto-shoots nearby enemies.',
    maxStack:3, stackLabel: n => `${n}/3 companions`,
    apply(gs){ gs.companions.push({slot:gs.companions.length,x:gs.p.x,y:gs.p.y,shootCD:0,pulse:0}); }
  },
  {
    id:'afterburner', icon:'🔥', name:'AFTERBURNER', rarity:'rare',
    desc:'Increases ship speed by 2. Stacks up to 4×.',
    maxStack:4, stackLabel: n => `+${n*2} speed`,
    apply(gs){ gs.upgrades.speed=(gs.upgrades.speed||0)+2; }
  },
  {
    id:'overclock', icon:'⚡', name:'OVERCLOCK', rarity:'rare',
    desc:'Permanently reduces shoot cooldown by 20ms.',
    maxStack:5, stackLabel: n => `-${n*20}ms cooldown`,
    apply(gs){ gs.upgrades.cooldown=(gs.upgrades.cooldown||0)+20; }
  },
  {
    id:'triplecore', icon:'✦', name:'TRIPLE CORE', rarity:'rare',
    desc:'Permanently fires 3 bullets instead of 1.',
    maxStack:1, stackLabel: ()=>'active',
    apply(gs){ gs.upgrades.tripleShot=true; }
  },
  {
    id:'missilepod', icon:'🚀', name:'MISSILE POD', rarity:'epic',
    desc:'Launches a homing missile at the nearest enemy every 4s.',
    maxStack:2, stackLabel: n=>`${n} pod${n>1?'s':''}`,
    apply(gs){ gs.upgrades.missiles=(gs.upgrades.missiles||0)+1; }
  },
  {
    id:'pointdefense', icon:'🛡', name:'POINT DEFENSE', rarity:'rare',
    desc:'Destroys boss projectiles that come within 70px.',
    maxStack:1, stackLabel: ()=>'active',
    apply(gs){ gs.upgrades.pointDefense=true; }
  },
  {
    id:'salvager', icon:'💎', name:'SALVAGER', rarity:'common',
    desc:'Power-up duration increased by 3 seconds.',
    maxStack:4, stackLabel: n=>`+${n*3}s duration`,
    apply(gs){ gs.upgrades.puBonus=(gs.upgrades.puBonus||0)+3000; }
  },
  {
    id:'scoremult', icon:'⭐', name:'SCORE AMPLIFIER', rarity:'common',
    desc:'Earn +25% score for all destroyed enemies.',
    maxStack:4, stackLabel: n=>`+${n*25}% score`,
    apply(gs){ gs.upgrades.scoreMult=(gs.upgrades.scoreMult||0)+0.25; }
  },
  {
    id:'reactor', icon:'☢', name:'REACTOR CORE', rarity:'common',
    desc:'Regenerate 1 life at the start of every 3rd boss level.',
    maxStack:1, stackLabel: ()=>'active',
    apply(gs){ gs.upgrades.reactor=true; }
  },
  {
    id:'shieldgen', icon:'🔵', name:'SHIELD GENERATOR', rarity:'rare',
    desc:'Start every level with a shield already active.',
    maxStack:1, stackLabel: ()=>'active',
    apply(gs){ gs.upgrades.autoShield=true; }
  },
];

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

// ── Profanity Filter ─────────────────────────────────────
// Common slurs and offensive terms — add more to the list as needed
const BAD_WORDS = [
  'fuck','shit','ass','bitch','cunt','dick','cock','pussy','faggot','fag',
  'nigger','nigga','chink','spic','kike','wetback','retard','whore','slut',
  'bastard','piss','crap','damn','hell','sex','porn','nazi','rape','kill',
  'fucker','asshole','motherfucker','bullshit','jackass','dumbass','dipshit',
  'shithead','fuckhead','goddamn','twat','wanker','tosser','prick','arse',
  'bollocks','bugger','bloody','hitler','satan','666','homo','tranny',
];

function containsBadWord(str) {
  const clean = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  // Also catch l33tspeak substitutions: 4=a, 3=e, 1=i, 0=o, 5=s
  const unleet = clean
    .replace(/4/g,'a').replace(/3/g,'e').replace(/1/g,'i')
    .replace(/0/g,'o').replace(/5/g,'s').replace(/\$/g,'s');
  return BAD_WORDS.some(w => clean.includes(w) || unleet.includes(w));
}

function sanitizeName(raw) {
  const trimmed = raw.trim().slice(0, 12);
  if (!trimmed) return 'PILOT';
  if (containsBadWord(trimmed)) return null; // null = rejected
  // Strip non-alphanumeric except spaces and hyphens
  return trimmed.replace(/[^a-zA-Z0-9 \-_]/g, '').trim() || 'PILOT';
}

function addLBEntry(name,score,level){
  const clean=sanitizeName(name);
  if(clean===null){
    const inp=document.getElementById('nameInput');
    const err=document.getElementById('nameError');
    if(inp){inp.style.borderColor='var(--red)';inp.value='';}
    if(err){err.textContent='⚠ Name not allowed — please choose another';err.style.display='block';}
    return false;
  }
  const entry={name:clean||'PILOT',score,level,diff:endlessMode?'endless':currentDiff,date:new Date().toLocaleDateString()};
  try{localStorage.setItem('mb_pilot',entry.name);}catch(e){}
  leaderboard.push(entry);
  leaderboard.sort((a,b)=>b.score-a.score);
  if(leaderboard.length>MAX_LB)leaderboard.length=MAX_LB;
  saveLB();
  pushOnlineLB(entry);
  return true;
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
  endlessWave=1;
  GS={
    p:{x:canvas.width/2,y:canvas.height-60,w:36,h:40,damage:0,dead:false},
    bullets:[],meteors:[],powerups:[],particles:[],explosions:[],bproj:[],
    companions:[], missiles:[],
    score:0,lives:endlessMode?3:DIFF[currentDiff].lives,level:1,
    timer:LEVEL_SECS*1000,quota:0,spawned:0,destroyed:0,
    spawnIv:0,spawnT:0,shootCD:0,
    effects:{},invincible:false,invT:0,boss:null,
    upgrades:{}, pickedUpgrades:{},
  };
  setupLevel();
}

function setupLevel(){
  const lv=GS.level;
  const wave=endlessMode?endlessWave:lv; // use endlessWave for scaling in endless
  GS.bullets=[];GS.meteors=[];GS.powerups=[];GS.bproj=[];GS.missiles=[];
  GS.timer=LEVEL_SECS*1000;GS.destroyed=0;
  if(endlessMode) initEventState(GS);  // fresh event state each wave
  // Apply auto-shield upgrade
  if(GS.upgrades.autoShield) GS.effects.shield=PU_DUR+(GS.upgrades.puBonus||0);
  // Reactor: regen 1 life every 3rd boss (endless: every 3rd boss wave)
  const isBossWave = endlessMode && (endlessWave % 5 === 0);
  if(GS.upgrades.reactor && isBossWave && (endlessMode?endlessWave:lv)%3===0 && GS.lives<(endlessMode?3:DIFF[currentDiff].lives)+3){
    GS.lives=Math.min(GS.lives+1,(endlessMode?3:DIFF[currentDiff].lives)+3); GS.p.damage=Math.max(0,GS.p.damage-1);
  }

  if(isBossWave){
    GS.quota=0;GS.spawned=0;
    phase='bossIntro';
    Music.play('boss');
    if(endlessMode){
      showEndlessBossIntro(endlessWave);
    } else {
      showBossIntro(lv);
    }
  } else {
    // Scaling: endless escalates indefinitely past normal cap
    const scaledWave=endlessMode?endlessWave:lv;
    const diffMod=endlessMode?1:DIFF[currentDiff].meteorBase/METEOR_BASE;
    GS.quota=Math.round((METEOR_BASE+(scaledWave-1)*METEOR_GROW)*diffMod);
    GS.spawned=0;
    const ivMult=endlessMode?Math.max(0.4,1-endlessWave*0.02):DIFF[currentDiff].spawnIvMult;
    GS.spawnIv=Math.max(280, (2600-scaledWave*90)*ivMult);
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

// ── Endless Boss Intro (cycles through bosses, scales HP) ─
function showEndlessBossIntro(wave){
  SFX.bossWarn();
  const tier=[5,10,15,20];
  const def=BOSSES[tier[(Math.floor((wave/5)-1))%4]];
  document.getElementById('biName').textContent=def.name;
  const tierNum=Math.floor((wave/5-1)/4)+1;
  document.getElementById('biSub').textContent=tierNum>1?`Tier ${tierNum} — ${def.sub}`:def.sub;
  const fill=document.getElementById('biFill');
  fill.style.animation='none';void fill.offsetWidth;fill.style.animation='biLoad 2.8s linear forwards';
  showScreen('game');showOv('bossIntro');
  setTimeout(()=>{hideOv('bossIntro');spawnEndlessBoss(wave);phase='bossActive';setBossBar(true);updateHUD();},3100);
}

function spawnEndlessBoss(wave){
  // 40% chance to spawn a player-created boss after wave 10
  if(wave>10 && customBosses.length>0 && Math.random()<0.4){
    const cb=customBosses[Math.floor(Math.random()*customBosses.length)];
    const scaleMult=1+Math.floor(wave/10)*0.3;
    const hp=Math.round(cb.hp*scaleMult);
    GS.boss={...cb,x:canvas.width/2,y:-cb.sz,maxHp:hp,hp,entering:true,
      targetY:cb.sz+25,vx:cb.spd,atkT:cb.atkRate,phase:1,pulse:0,lv:0,custom:true};
    return;
  }
  const tier=[5,10,15,20];
  const def=BOSSES[tier[(Math.floor((wave/5)-1))%4]];
  const scaleMult=1+Math.floor((wave/5-1)/4)*0.6;
  const hp=Math.round(def.hp*scaleMult);
  const sz=Math.min(def.sz+Math.floor(wave/20)*8,140);
  GS.boss={...def,x:canvas.width/2,y:-sz,sz,maxHp:hp,hp,entering:true,
    targetY:sz+25,vx:def.spd+wave*0.04,atkT:Math.max(600,def.atkRate-wave*30),
    shots:Math.min(def.shots+Math.floor(wave/10),12),
    shotSpd:Math.min(def.shotSpd+wave*0.05,8),
    phase:1,pulse:0,lv:tier[(Math.floor((wave/5)-1))%4]};
}

function spawnBoss(lv){
  const def=BOSSES[lv];
  const hp=Math.round(def.hp*DIFF[currentDiff].bossHpMult);
  GS.boss={...def,x:canvas.width/2,y:-def.sz,maxHp:hp,hp,entering:true,
    targetY:def.sz+25,vx:def.spd,atkT:def.atkRate,phase:1,pulse:0,lv};
}

// ── Game Loop ────────────────────────────────────────
function gameLoop(ts){
  animId=requestAnimationFrame(gameLoop);
  const rawDt=Math.min(ts-(lastTs||ts),50);
  const dt=DEV.slowmo?rawDt*0.3:rawDt;
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

  const moveSpd=9+(GS.upgrades.speed||0);
  if(keys['ArrowLeft']||keys['a'])  GS.p.x=Math.max(GS.p.w/2,GS.p.x-moveSpd);
  if(keys['ArrowRight']||keys['d']) GS.p.x=Math.min(canvas.width-GS.p.w/2,GS.p.x+moveSpd);

  // Ultra-rapid = rapid power-up + overclock upgrade stacked
  const isUltraRapid = GS.effects.rapid && GS.upgrades.overclock;
  const baseCooldown = isUltraRapid
    ? Math.max(40, SHOOT_RAPID - (GS.upgrades.cooldown||0) - 30)
    : GS.effects.rapid
      ? SHOOT_RAPID - (GS.upgrades.cooldown||0)
      : SHOOT_NORM  - (GS.upgrades.cooldown||0);
  if((keys[' ']||keys['ArrowUp'])&&GS.shootCD<=0){
    shoot();GS.shootCD=Math.max(60,baseCooldown);
  }

  updateCompanions(dt);
  updateMissiles(dt);
  updatePointDefense();

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

  // Endless special events
  if(endlessMode&&!DEV.noEvents) tickEvents(dt);

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
  if(!GS.invincible&&!DEV.god&&!DEV.inv){
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
  if(DEV.ohk&&!b.dead)b.hp=Math.min(b.hp,1);

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
  if(!GS.invincible&&!DEV.god&&!DEV.inv){
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
  // Track endless boss kills for creator unlock
  if(endlessMode){ bossKills++; saveBossData(); checkCreatorUnlock(); }
  for(let i=0;i<6;i++)setTimeout(()=>{spawnParts(b.x+(Math.random()-.5)*b.sz,b.y+(Math.random()-.5)*b.sz/2,b.glow,18);addExp(b.x+(Math.random()-.5)*b.sz,b.y,b.glow);},i*150);
  GS.score+=b.lv===20?3000:1000;
  if(settings.flash)doFlash(b.glow+'44');
  setTimeout(()=>{b.lv===20?triggerVictory():bossDone();},1000);
}

function shoot(){
  SFX.shoot();
  const{x,y}=GS.p;
  const hasPUTriple   = !!GS.effects.triple;
  const hasUpgTriple  = !!GS.upgrades.tripleShot;
  const hasPURapid    = !!GS.effects.rapid;
  const hasUpgRapid   = !!GS.upgrades.overclock; // overclock = permanent speed upgrade
  const spd = 10;

  // ── Stacked: power-up triple ON TOP of permanent triple core
  // → 5-way spread instead of redundant 3-shot
  if(hasPUTriple && hasUpgTriple){
    GS.bullets.push(
      {x:x-22,y:y-14,vx:-3,  vy:-spd,  color:'#ff9d00'},
      {x:x-11,y:y-20,vx:-1.2,vy:-spd,  color:'#ffd600'},
      {x,      y:y-24,vx:0,   vy:-spd,  color:'#ffd600'},
      {x:x+11,y:y-20,vx:1.2, vy:-spd,  color:'#ffd600'},
      {x:x+22,y:y-14,vx:3,   vy:-spd,  color:'#ff9d00'}
    );
  }
  // ── Power-up triple only, or upgrade triple only → standard 3-shot
  else if(hasPUTriple || hasUpgTriple){
    GS.bullets.push(
      {x:x-14,y:y-20,vx:-1.5,vy:-spd},
      {x,      y:y-24,vx:0,   vy:-spd},
      {x:x+14,y:y-20,vx:1.5, vy:-spd}
    );
  }
  // ── No triple → single shot
  else{
    GS.bullets.push({x,y:y-24,vx:0,vy:-spd});
  }
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
  const lv=GS.level,d=DIFF[currentDiff];
  const spd=(1.3+lv*0.18)*d.meteorSpd,sz=13+Math.random()*22;
  const hp=sz>28?Math.min(3,1+Math.floor(lv/5)):sz>20?Math.min(2,1+Math.floor(lv/8)):1;
  const cols=['#b46a2e','#8a4e20','#c07030','#7a3d18','#d4854a'];
  GS.meteors.push({x:Math.random()*(canvas.width-sz*2)+sz,y:-sz,r:sz,vx:(Math.random()-.5)*1.6,vy:spd+Math.random()*spd*.8,rot:0,rotSpd:(Math.random()-.5)*.05,color:cols[Math.floor(Math.random()*cols.length)],hp,maxHp:hp});
}
function destroyMeteor(mi,m){
  const mult = getScoreMultiplier() * DIFF[endlessMode?'normal':currentDiff].scoreMult;
  const pts = m.golden ? (m.points||2000) : Math.round(m.r*3*mult);
  GS.score += pts; GS.destroyed++;
  SFX.explode();spawnParts(m.x,m.y,m.color,18);addExp(m.x,m.y,'#ff6a00');
  GS.meteors.splice(mi,1);
  if(Math.random()<DIFF[currentDiff].puProb)spawnPU(m.x,m.y);
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
  const bonus = GS.upgrades.puBonus || 0;
  const dur   = PU_DUR + bonus;

  if(type==='bomb'){
    // Bomb always clears everything regardless
    GS.meteors.forEach(m=>{spawnParts(m.x,m.y,m.color,12);addExp(m.x,m.y,'#ff6a00');GS.score+=Math.round(m.r*2);GS.destroyed++;});
    GS.meteors=[];
    if(settings.flash)doFlash('#ff2d5530');

  } else if(type==='triple'){
    // Already have permanent triple core → upgrade to 5-way by setting 'triple5' flag
    // If already have power-up triple active, just refresh & extend duration
    if(GS.upgrades.tripleShot){
      // Mark as "super triple" so shoot() fires 5-way
      GS.effects.triple = dur; // still uses same flag — shoot() checks both upgrade + effect
      announce('5-WAY SPREAD!', 1200);
    } else {
      GS.effects.triple = dur;
    }

  } else if(type==='rapid'){
    // Overclock upgrade already reduces cooldown permanently.
    // Stacking rapid power-up on top → push cooldown even lower for duration (ultra-rapid)
    if(GS.upgrades.overclock){
      GS.effects.rapid = dur;
      announce('ULTRA RAPID!', 1200);
    } else {
      GS.effects.rapid = dur;
    }

  } else if(type==='shield'){
    // Auto-shield upgrade means shield is always present — power-up refreshes + extends it
    if(GS.upgrades.autoShield){
      GS.effects.shield = Math.max(GS.effects.shield||0, dur) + dur;
      announce('SHIELD EXTENDED!', 1200);
    } else {
      GS.effects.shield = dur;
    }

  } else {
    GS.effects[type] = dur;
  }
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
  const nextBoss=endlessMode&&((endlessWave+1)%5===0);
  const title=endlessMode?`WAVE ${endlessWave} CLEAR!`:`LEVEL ${GS.level} CLEAR!`;
  showLC(title,[{l:'Meteors Destroyed',v:GS.destroyed},{l:'Time Bonus',v:`+${tb}`},{l:'Total Score',v:GS.score}],nextBoss);
}
function bossDone(){
  if(phase!=='bossActive')return;
  phase='levelComplete';setBossBar(false);
  const nextBoss=endlessMode&&((endlessWave+1)%5===0);
  showLC('BOSS DEFEATED!',[{l:'Boss Bonus',v:'+1000'},{l:'Total Score',v:GS.score}],nextBoss);
  if(!nextBoss) Music.play('game');
}
function showLC(title,stats,nextBoss){
  document.getElementById('lcTitle').textContent=title;
  document.getElementById('lcStats').innerHTML=stats.map(s=>`<div class="stat-row"><span class="stat-label">${s.l}</span><span class="stat-val">${s.v}</span></div>`).join('');
  document.getElementById('bossWarnEl').classList.toggle('hidden',!nextBoss);
  showScreen('game');showOv('levelComplete');
  const go=()=>{
    hideOv('levelComplete');
    document.removeEventListener('keydown',spKey);
    document.getElementById('continueBtn').removeEventListener('click',go);
    showSupportScreen();
  };
  const spKey=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();go();}};
  document.addEventListener('keydown',spKey);
  document.getElementById('continueBtn').addEventListener('click',go,{once:true});
}
// ── Support Screen ───────────────────────────────────────
function showSupportScreen(){
  const pool = buildSupportPool();
  const cards = document.getElementById('supportCards');
  cards.innerHTML = pool.map((up,i)=>`
    <div class="support-card rarity-${up.rarity}" onclick="pickSupport(${i})">
      <div class="sc-key">${i+1}</div>
      <div class="sc-icon">${up.icon}</div>
      <div class="sc-name">${up.name}</div>
      <div class="sc-rarity ${up.rarity}">${up.rarity.toUpperCase()}</div>
      <div class="sc-desc">${up.desc}</div>
      ${(GS.pickedUpgrades[up.id]||0)>0?`<div class="sc-stacks">${up.stackLabel(GS.pickedUpgrades[up.id])}</div>`:''}
    </div>`).join('');
  showOv('support');
  window._supportPool=pool;
  const keyPick=e=>{
    const n=parseInt(e.key);
    if(n>=1&&n<=pool.length){document.removeEventListener('keydown',keyPick);pickSupport(n-1);}
  };
  document.addEventListener('keydown',keyPick);
  window._supportKeyPick=keyPick;
}
function buildSupportPool(){
  // Pick 3 distinct upgrades from pool, weighted by rarity, filtered by maxStack
  const available=SUPPORT_POOL.filter(u=>(GS.pickedUpgrades[u.id]||0)<u.maxStack);
  const weights={common:5,rare:3,epic:1};
  const weighted=[];
  available.forEach(u=>{for(let i=0;i<weights[u.rarity];i++)weighted.push(u);});
  // Shuffle and pick 3 unique
  const shuffled=[...weighted].sort(()=>Math.random()-.5);
  const seen=new Set();
  const out=[];
  for(const u of shuffled){if(!seen.has(u.id)){seen.add(u.id);out.push(u);}if(out.length===3)break;}
  // Fill to 3 if pool is small
  while(out.length<3&&out.length<available.length) out.push(available[out.length]);
  return out;
}
window.pickSupport=function(i){
  document.removeEventListener('keydown',window._supportKeyPick);
  const up=window._supportPool[i];
  if(!up)return;
  GS.pickedUpgrades[up.id]=(GS.pickedUpgrades[up.id]||0)+1;
  up.apply(GS);
  hideOv('support');
  updateUpgradeBar();
  advLevel();
};

function advLevel(){
  if(endlessMode){
    endlessWave++;
    GS.level=endlessWave;
    setupLevel();
    if(phase==='playing'){showScreen('game');announce(`WAVE ${endlessWave}`);}
    return;
  }
  GS.level++;
  if(GS.level>MAX_LEVELS){triggerVictory();return;}
  setupLevel();
  if(phase==='playing'){showScreen('game');announce(`LEVEL ${GS.level}`);}
}

// ── Companion AI ─────────────────────────────────────────
function updateCompanions(dt){
  if(!GS.companions||GS.companions.length===0)return;
  const slots=[{ox:-48,oy:10},{ox:48,oy:10},{ox:0,oy:24}];
  GS.companions.forEach((c,idx)=>{
    const slot=slots[idx]||{ox:(idx%2===0?-1:1)*(50+idx*20),oy:20};
    const tx=GS.p.x+slot.ox, ty=GS.p.y+slot.oy;
    // Smooth follow
    c.x+=(tx-c.x)*0.1; c.y+=(ty-c.y)*0.1;
    c.pulse+=dt*0.004;
    // Find nearest threat
    c.shootCD-=dt;
    if(c.shootCD<=0){
      const target=nearestThreat(c.x,c.y);
      if(target){
        const a=Math.atan2(target.y-c.y,target.x-c.x);
        const spd=11;
        GS.bullets.push({x:c.x,y:c.y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,companion:true});
        c.shootCD = getCompanionShootCD();
        tone(600,0.05,'square',0.06);
      }else c.shootCD=200;
    }
  });
}
function nearestThreat(cx,cy){
  let best=null,bd=9999;
  if(GS.boss&&!GS.boss.dead&&!GS.boss.entering){
    const d=dist(cx,cy,GS.boss.x,GS.boss.y);if(d<bd){bd=d;best={x:GS.boss.x,y:GS.boss.y};}
  }
  GS.meteors.forEach(m=>{const d=dist(cx,cy,m.x,m.y);if(d<bd){bd=d;best={x:m.x,y:m.y};}});
  return bd<600?best:null;
}

// ── Missile System ───────────────────────────────────────
function updateMissiles(dt){
  if(!GS.upgrades.missiles)return;
  GS.p._missileT=(GS.p._missileT||0)-dt;
  if(GS.p._missileT<=0){
    const count=GS.upgrades.missiles;
    for(let i=0;i<count;i++){
      GS.missiles.push({x:GS.p.x+(i*20-count*10),y:GS.p.y-20,vx:0,vy:-3,life:4000,trail:[]});
    }
    GS.p._missileT=4000;
    tone(300,0.12,'sawtooth',0.1);
  }
  GS.missiles=GS.missiles.filter(m=>m.life>0);
  GS.missiles.forEach(m=>{
    m.life-=dt;
    m.trail.push({x:m.x,y:m.y,a:1});
    if(m.trail.length>12) m.trail.shift();
    m.trail.forEach(t=>{t.a-=0.08;});
    // Home on nearest threat
    const tgt=nearestThreat(m.x,m.y);
    if(tgt){
      const a=Math.atan2(tgt.y-m.y,tgt.x-m.x);
      m.vx+=(Math.cos(a)*3-m.vx)*0.12;
      m.vy+=(Math.sin(a)*3-m.vy)*0.12;
    }
    m.x+=m.vx; m.y+=m.vy;
    // Hit check
    for(let mi=GS.meteors.length-1;mi>=0;mi--){
      const me=GS.meteors[mi];
      if(dist(m.x,m.y,me.x,me.y)<me.r+6){
        me.hp-=2;spawnParts(m.x,m.y,'#ff6a00',12);addExp(m.x,m.y,'#ff6a00');
        if(me.hp<=0)destroyMeteor(mi,me);
        m.life=0;return;
      }
    }
    if(GS.boss&&!GS.boss.dead&&dist(m.x,m.y,GS.boss.x,GS.boss.y)<GS.boss.sz/2+6){
      GS.boss.hp-=3;spawnParts(m.x,m.y,GS.boss.glow,16);setBossBar(true);
      if(GS.boss.hp<=0)killBoss();
      m.life=0;
    }
  });
}

// ── Point Defense ────────────────────────────────────────
function updatePointDefense(){
  if(!GS.upgrades.pointDefense)return;
  for(let i=GS.bproj.length-1;i>=0;i--){
    const p=GS.bproj[i];
    if(dist(p.x,p.y,GS.p.x,GS.p.y)<70){
      spawnParts(p.x,p.y,'#39ff14',8);GS.bproj.splice(i,1);
    }
  }
}

// ── Upgrade HUD ──────────────────────────────────────────
function updateUpgradeBar(){
  const bar=document.getElementById('upgradeBar');
  if(!bar)return;
  bar.innerHTML='';
  const icons={companion:'🛸',afterburner:'🔥',overclock:'⚡',triplecore:'✦',missilepod:'🚀',
    pointdefense:'🛡',salvager:'💎',scoremult:'⭐',reactor:'☢',shieldgen:'🔵'};
  Object.entries(GS.pickedUpgrades).forEach(([id,n])=>{
    if(n>0){
      const el=document.createElement('div');
      el.className='upg-pill';
      el.textContent=`${icons[id]||'?'} ${n>1?'×'+n:''}`;
      el.title=SUPPORT_POOL.find(u=>u.id===id)?.name||id;
      bar.appendChild(el);
    }
  });
}

// ── Draw Companions ──────────────────────────────────────
function drawCompanions(){
  if(!GS.companions||GS.companions.length===0)return;
  GS.companions.forEach(c=>{
    ctx.save();
    // Glow
    ctx.shadowBlur=12+Math.sin(c.pulse)*4;ctx.shadowColor='#00c8ff';
    // Mini ship body
    ctx.fillStyle='#00c8ff';
    const s=0.6; // scale factor relative to player ship
    const{x,y}=c;
    ctx.beginPath();
    ctx.moveTo(x,         y-14*s);
    ctx.lineTo(x+10*s,    y+8*s);
    ctx.lineTo(x+5*s,     y+12*s);
    ctx.lineTo(x,         y+6*s);
    ctx.lineTo(x-5*s,     y+12*s);
    ctx.lineTo(x-10*s,    y+8*s);
    ctx.closePath();ctx.fill();
    // Cockpit
    ctx.fillStyle='#001a2e';ctx.beginPath();ctx.ellipse(x,y-2*s,3*s,5*s,0,0,Math.PI*2);ctx.fill();
    // Engine pulse
    const ep=['#00f5ff','#00c8ff','#0099cc'][Math.floor(Date.now()/120)%3];
    ctx.fillStyle=ep;ctx.shadowColor=ep;
    ctx.beginPath();ctx.ellipse(x,y+12*s,3*s,5*s+Math.sin(c.pulse*3)*2,0,0,Math.PI*2);ctx.fill();
    ctx.restore();
  });
}

// ── Draw Missiles ────────────────────────────────────────
function drawMissiles(){
  GS.missiles&&GS.missiles.forEach(m=>{
    ctx.save();
    // Trail
    m.trail.forEach(t=>{
      ctx.globalAlpha=Math.max(0,t.a)*0.4;
      ctx.fillStyle='#ff6a00';
      ctx.beginPath();ctx.arc(t.x,t.y,2,0,Math.PI*2);ctx.fill();
    });
    ctx.globalAlpha=1;
    // Missile body
    const a=Math.atan2(m.vy,m.vx);
    ctx.translate(m.x,m.y);ctx.rotate(a+Math.PI/2);
    ctx.shadowColor='#ff6a00';ctx.shadowBlur=10;
    ctx.fillStyle='#ff9d00';
    ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(3,4);ctx.lineTo(-3,4);ctx.closePath();ctx.fill();
    ctx.fillStyle='#ff2d55';
    ctx.beginPath();ctx.arc(0,5,3,0,Math.PI*2);ctx.fill();
    ctx.restore();
  });
}

function triggerGameOver(){
  phase='gameOver';Music.play('gameover');
  cancelAnimationFrame(animId);animId=0;
  document.getElementById('goScore').textContent=GS.score;
  const lvRow=document.getElementById('goLevelRow');
  const endRow=document.getElementById('goEndlessRow');
  if(endlessMode){
    if(lvRow)lvRow.classList.add('hidden');
    if(endRow){endRow.classList.remove('hidden');document.getElementById('goEndlessWave').textContent=endlessWave;}
  }else{
    if(lvRow)lvRow.classList.remove('hidden');
    if(endRow)endRow.classList.add('hidden');
    document.getElementById('goLevel').textContent=GS.level;
  }
  const lvForLB=endlessMode?endlessWave:GS.level;
  if(!DEV.used&&qualifies(GS.score))showNameEntry(GS.score,lvForLB,()=>showScreen('gameOver'));
  else{if(DEV.used)announce('DEV RUN — score not saved',2400);showScreen('gameOver');}
}
function triggerVictory(){
  phase='victory';Music.play('victory');
  cancelAnimationFrame(animId);animId=0;
  document.getElementById('vicScore').textContent=GS.score;
  if(settings.flash)doFlash('#ffd60055');
  if(!DEV.used)showNameEntry(GS.score,MAX_LEVELS,()=>showScreen('victory'));
  else{announce('DEV RUN — score not saved',2400);setTimeout(()=>showScreen('victory'),800);}
}
function showNameEntry(score,level,cb){
  document.getElementById('entryScore').textContent=score;
  document.getElementById('nameInput').value='';
  showScreen('nameEntry');
  document.getElementById('nameInput').style.borderColor='';
  const errEl=document.getElementById('nameError');
  if(errEl) errEl.style.display='none';
  document.getElementById('submitBtn').onclick=()=>{
    const ok=addLBEntry(document.getElementById('nameInput').value,score,level);
    if(ok!==false) cb();
  };
}

// ── Leaderboard ──────────────────────────────────────
async function renderLB(){
  const el=document.getElementById('lbList');
  el.innerHTML='<div class="lb-empty">Loading scores…</div>';
  await fetchOnlineLB();
  let all=mergedLB();
  // Apply "my scores" filter
  const myPilot=(()=>{try{return localStorage.getItem('mb_pilot');}catch(e){return null;}})();
  if(lbFilter==='mine'&&myPilot) all=all.filter(e=>e.name===myPilot);
  // Apply difficulty filter
  if(lbDiffFilter!=='all') all=all.filter(e=>(e.diff||'normal')===lbDiffFilter);
  if(!all.length){el.innerHTML='<div class="lb-empty">'+(lbFilter==='mine'?'No scores found for your pilot name.':'No scores yet. Be the first!')+'</div>';return;}
  const onlineNote=ONLINE_BOARD?'<div class="lb-online-note">🌐 Global Leaderboard</div>':'<div class="lb-online-note local">💾 Local Scores Only</div>';
  const diffBadge=d=>d?`<span class="lb-diff-badge ${d||'normal'}">${d==='endless'?'∞':( d||'NRM').toUpperCase().slice(0,3)}</span>`:''; 
  el.innerHTML=onlineNote+all.map((e,i)=>`
    <div class="lb-row ${['gold','silver','bronze'][i]||''}">
      <span class="lb-rank">${['🥇','🥈','🥉'][i]||'#'+(i+1)}</span>
      <span class="lb-name">${e.name}</span>
      <span class="lb-score">${Number(e.score).toLocaleString()}</span>
      ${diffBadge(e.diff)}
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
  const devWarn=document.getElementById('devWarnHUD');
  if(devWarn) devWarn.style.display=DEV.used?'block':'none';
  document.getElementById('scoreDisplay').textContent=GS.score.toLocaleString();
  document.getElementById('levelDisplay').textContent=endlessMode?`WAVE ${endlessWave} ∞`:`${GS.level} / ${MAX_LEVELS}`;
  const lvEl=document.getElementById('levelDisplay');if(lvEl)lvEl.className=endlessMode?'hv endless-hud':'hv';
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
  // Active event indicators
  if(GS.events){
    const evLabels={doubleScore:'⭐×2',gravitySurge:'🌊GRAV',companionBoost:'🛸BOOST',freeze:'❄FREEZE',mirror:'🪞MIRROR',ghostMode:'👻GHOST'};
    for(let k in evLabels){
      if(GS.events[k]>0){
        const el=document.createElement('div');
        el.className='event-indicator';
        el.textContent=`${evLabels[k]} ${Math.ceil(GS.events[k]/1000)}s`;
        bar.appendChild(el);
      }
    }
  }
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
  drawMissiles();
  GS.bullets.forEach(b=>{
    const col=b.companion?'#00c8ff':b.color||'#ffd600';
    ctx.save();ctx.shadowColor=col;ctx.shadowBlur=10;ctx.fillStyle=col;
    ctx.beginPath();ctx.ellipse(b.x,b.y,3,8,0,0,Math.PI*2);ctx.fill();ctx.restore();
  });
  drawCompanions();
  if(DEV.hitbox) drawHitboxes();
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

  // Golden meteor glow
  if(m.golden){
    ctx.shadowColor='#ffd600';
    ctx.shadowBlur=20+Math.sin(Date.now()/200)*8;
  } else if(m.frozen){
    ctx.shadowColor='#00f5ff';ctx.shadowBlur=14;
  } else if(m.hp<m.maxHp){
    ctx.shadowColor='#ff4400';ctx.shadowBlur=16;
  }

  ctx.beginPath();
  for(let i=0;i<7;i++){const a=(i/7)*Math.PI*2,j=.72+((i*13+m.r*7)%100)/250;i===0?ctx.moveTo(Math.cos(a)*m.r*j,Math.sin(a)*m.r*j):ctx.lineTo(Math.cos(a)*m.r*j,Math.sin(a)*m.r*j);}
  ctx.closePath();

  const baseColor = m.golden?'#b8860b': m.frozen?'#446688':m.color;
  const g=ctx.createRadialGradient(-m.r*.3,-m.r*.3,0,0,0,m.r);
  g.addColorStop(0,cshift(baseColor,m.golden?80:50));
  g.addColorStop(1,cshift(baseColor,m.frozen?-20:-40));
  ctx.fillStyle=g;ctx.fill();

  ctx.fillStyle=cshift(baseColor,-60);
  [.3,.65,.15].forEach((s,i)=>{ctx.beginPath();ctx.arc(Math.cos(s*Math.PI*2)*m.r*.45,Math.sin(s*Math.PI*2)*m.r*.45,m.r*(.12+i*.04),0,Math.PI*2);ctx.fill();});

  // Golden sparkle overlay
  if(m.golden){
    ctx.globalAlpha=0.5+Math.sin(Date.now()/150)*0.5;
    ctx.fillStyle='#ffd600';
    ctx.beginPath();ctx.arc(0,0,m.r*0.35,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
    // HP dots for golden
    for(let i=0;i<m.maxHp;i++){ctx.fillStyle=i<m.hp?'#ffd600':'rgba(255,255,255,.15)';ctx.beginPath();ctx.arc(-m.r*.5+i*(m.r*1.1/m.maxHp),-m.r-10,3,0,Math.PI*2);ctx.fill();}
  } else if(m.maxHp>1){
    for(let i=0;i<m.maxHp;i++){ctx.fillStyle=i<m.hp?'#ffd600':'rgba(255,255,255,.2)';ctx.beginPath();ctx.arc(-m.r*.3+i*12,-m.r-8,3,0,Math.PI*2);ctx.fill();}
  }

  // Frozen ice crystal overlay
  if(m.frozen){
    ctx.globalAlpha=0.35;
    ctx.fillStyle='#00f5ff';
    ctx.beginPath();ctx.arc(0,0,m.r,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
  }

  ctx.restore();
}
function drawBoss(b){
  ctx.save();ctx.translate(b.x,b.y);
  ctx.shadowColor=b.glow;ctx.shadowBlur=30+Math.sin(b.pulse)*10;

  if(b.icspark){
    // ICSpark: hexagonal circuit-board boss
    drawICSpark(b);
    ctx.restore();
    return;
  }

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

function drawICSpark(b){
  const t=Date.now(), sz=b.sz, p=b.pulse;
  const phase=b.phase||1;

  // Outer ring (phase-colored)
  const ringCol=phase===3?'#ff2d55':phase===2?'#ffd600':'#00f5ff';
  ctx.strokeStyle=ringCol;ctx.lineWidth=3;
  ctx.shadowColor=ringCol;ctx.shadowBlur=20+Math.sin(p)*8;
  ctx.beginPath();ctx.arc(0,0,sz/2+6+Math.sin(p*2)*4,0,Math.PI*2);ctx.stroke();

  // Hexagon body
  ctx.fillStyle='#0a1a3a';ctx.strokeStyle='#00f5ff';ctx.lineWidth=2;
  ctx.beginPath();
  for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2-Math.PI/6,r=sz/2;
    i===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
  ctx.closePath();ctx.fill();ctx.stroke();

  // Circuit lines radiating from center
  ctx.strokeStyle='rgba(0,245,255,0.25)';ctx.lineWidth=1;
  for(let i=0;i<6;i++){
    const a=(i/6)*Math.PI*2+p*0.3;
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*sz*.4,Math.sin(a)*sz*.4);ctx.stroke();
  }

  // Pulsing core
  const corePhase=phase===3?'#ff0040':phase===2?'#ffd600':'#00f5ff';
  const cr=sz/5+Math.sin(p*3)*4;
  const cg=ctx.createRadialGradient(0,0,0,0,0,cr);
  cg.addColorStop(0,'#ffffff');cg.addColorStop(.5,corePhase);cg.addColorStop(1,'transparent');
  ctx.fillStyle=cg;ctx.globalAlpha=0.9;ctx.beginPath();ctx.arc(0,0,cr,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=1;

  // Spark bolts when damaged
  if(phase>1){
    ctx.strokeStyle=phase===3?'#ff2d55':'#ffd600';ctx.lineWidth=1.5;
    ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=10;
    for(let i=0;i<(phase===3?4:2);i++){
      const a=(i/(phase===3?4:2))*Math.PI*2+t/300;
      const x1=Math.cos(a)*sz*0.3,y1=Math.sin(a)*sz*0.3;
      const x2=Math.cos(a+0.4)*sz*0.48,y2=Math.sin(a+0.4)*sz*0.48;
      const xm=(x1+x2)/2+(Math.random()-.5)*12,ym=(y1+y2)/2+(Math.random()-.5)*12;
      ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(xm,ym);ctx.lineTo(x2,y2);ctx.stroke();
    }
  }

  // Name label
  ctx.shadowBlur=0;ctx.shadowColor='#00f5ff';ctx.shadowBlur=12;
  ctx.fillStyle='#00f5ff';
  ctx.font=`bold ${Math.max(11,Math.floor(sz/6))}px Orbitron,sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(phase>1?`⚡ ICSPARK ⚡`:'ICSPARK',0,sz/2+18);
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
  DEV.used=false;DEV.god=false;DEV.inv=false;DEV.ohk=false;
  initGame();showScreen('game');announce('LEVEL 1');
  updateUpgradeBar();
  lastTs=0;animId=requestAnimationFrame(gameLoop);
}

document.getElementById('startBtn').onclick=()=>{endlessMode=false;startFresh();};
document.getElementById('endlessBtn').onclick=()=>{endlessMode=true;startFresh();};
document.getElementById('bossCreatorBtn').onclick=()=>{bcInit();showScreen('bossCreator');};
document.getElementById('bossCreatorBackBtn').onclick=()=>showScreen('start');
document.getElementById('restartBtn').onclick=()=>{endlessMode=false;startFresh();};
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

// ═══════════════════════════════════════════════════════════
//   DEVELOPER CONSOLE
// ═══════════════════════════════════════════════════════════
const DEV = { god:false, inv:false, ohk:false, used:false };
let devUnlocked = false;

// Secret unlock: type "DEV" on keyboard anywhere
let devSeq='';
document.addEventListener('keypress',e=>{
  devSeq=(devSeq+e.key).slice(-3);
  if(devSeq.toUpperCase()==='DEV'){
    devUnlocked=true;
    devLog('🔓 Dev console unlocked — press ` (backtick) to open');
  }
});
document.addEventListener('keydown',e=>{
  if(e.key==='`'&&devUnlocked){
    if(document.getElementById('devOverlay').classList.contains('hidden')){
      if(phase==='playing'||phase==='bossActive'){prePause=phase;phase='paused';}
      showOv('dev');
    } else hideOv('dev');
  }
});

function devLog(msg){
  const log=document.getElementById('devLog'); if(!log)return;
  const line=document.createElement('div');line.className='dev-log-line';
  line.textContent='> '+msg; log.appendChild(line);
  log.scrollTop=log.scrollHeight;
  if(log.children.length>20)log.removeChild(log.firstChild);
}
function devToggle(key){
  if(key!=='inv'&&key!=='god') DEV.used=true; else DEV.used=true;
  DEV[key]=!DEV[key];
  const el=document.getElementById(key+'Toggle');
  if(el){el.textContent=DEV[key]?'ON':'OFF';el.classList.toggle('off',!DEV[key]);}
  if(key==='god'&&DEV.god){GS.lives=DIFF[currentDiff].lives;GS.p.damage=0;updateHUD();}
  devLog(`${key.toUpperCase()} mode ${DEV[key]?'enabled':'disabled'}`);
}
function devJumpLevel(){
  DEV.used=true;
  const n=parseInt(document.getElementById('devLvInput').value);
  if(!n||n<1||n>MAX_LEVELS){devLog('Invalid level');return;}
  hideOv('dev');GS.level=n;
  GS.effects={};GS.boss=null;
  setupLevel();if(phase==='playing'){showScreen('game');announce(`JUMP → LEVEL ${n}`);}
  devLog(`Jumped to level ${n}`);
}
function devSkipLevel(){
  DEV.used=true;
  hideOv('dev');
  if(phase==='playing') levelDone();
  else if(phase==='bossActive'){if(GS.boss)killBoss();}
  devLog('Level skipped');
}
function devKillAll(){
  GS.meteors.forEach(m=>{spawnParts(m.x,m.y,m.color,8);addExp(m.x,m.y,'#ff6a00');});
  GS.meteors=[];devLog('All meteors cleared');
}
function devKillBoss(){
  DEV.used=true;
  if(GS.boss&&!GS.boss.dead){killBoss();devLog('Boss defeated');}
  else devLog('No active boss');
}
function devAddLife(){
  DEV.used=true;
  GS.lives=Math.min(GS.lives+1,9);GS.p.damage=Math.max(0,3-GS.lives);updateHUD();devLog('+1 life → '+GS.lives);
}
function devAddScore(){
  DEV.used=true;
  GS.score+=5000;updateHUD();devLog('+5000 score → '+GS.score);
}
function devAllPU(){
  DEV.used=true;
  ['rapid','triple','shield'].forEach(t=>{GS.effects[t]=30000;});
  devLog('All power-ups granted (30s)');updatePUBar();
}
function devAllUpgrades(){
  DEV.used=true;
  const up=id=>{GS.pickedUpgrades[id]=(GS.pickedUpgrades[id]||0)+1;};
  SUPPORT_POOL.forEach(u=>{if((GS.pickedUpgrades[u.id]||0)<u.maxStack){up(u.id);u.apply(GS);}});
  updateUpgradeBar();devLog('All upgrades granted');
}
function devSpawnMeteor(){
  for(let i=0;i<5;i++)spawnMeteor();devLog('5 meteors spawned');
}
function devSpawnPU(){
  const cx=GS.p.x+(Math.random()-.5)*200,cy=GS.p.y-100;
  const sel=document.getElementById('devPUType')?.value;
  const types=['rapid','triple','shield','bomb'];
  const cols={rapid:'#ffd600',triple:'#00f5ff',shield:'#39ff14',bomb:'#ff2d55'};
  const lbls={rapid:'⚡',triple:'✦',shield:'🛡',bomb:'💥'};
  const type=sel||types[Math.floor(Math.random()*types.length)];
  GS.powerups.push({x:cx,y:cy,r:14,spd:1.4,type,color:cols[type],label:lbls[type],pulse:0});
  devLog(`Power-up spawned: ${type}`);
}
function devAddComp(){
  if(GS.companions.length<3){
    GS.companions.push({slot:GS.companions.length,x:GS.p.x,y:GS.p.y,shootCD:0,pulse:0});
    GS.pickedUpgrades.companion=(GS.pickedUpgrades.companion||0)+1;
    updateUpgradeBar();devLog('Companion added → '+GS.companions.length);
  } else devLog('Max companions reached (3)');
}
function devTriggerBoss(){
  DEV.used=true;
  const lv=BOSS_LEVELS.has(GS.level)?GS.level:[...BOSS_LEVELS].find(l=>l>=GS.level)||5;
  hideOv('dev');GS.boss=null;GS.bproj=[];
  phase='bossIntro';Music.play('boss');showBossIntro(lv);devLog(`Boss triggered for level ${lv}`);
}
// Override hitPlayer to respect god/inv
const _origHitPlayer=window.hitPlayer;

// Patch invincibility into collision checks via wrapper
const _devGuardHit=()=>{ if(DEV.god||DEV.inv)return; hitPlayer(); };
// Also one-hit-kill bosses
window.devCheckOHK=()=>{ if(DEV.ohk&&GS.boss&&!GS.boss.dead){GS.boss.hp=1;} };
window.devToggle=devToggle;
window.devJumpLevel=devJumpLevel;
window.devSkipLevel=devSkipLevel;
window.devKillAll=devKillAll;
window.devKillBoss=devKillBoss;
window.devAddLife=devAddLife;
window.devAddScore=devAddScore;
window.devAllPU=devAllPU;
window.devAllUpgrades=devAllUpgrades;
window.devSpawnMeteor=devSpawnMeteor;
window.devSpawnPU=devSpawnPU;
window.devAddComp=devAddComp;
window.devTriggerBoss=devTriggerBoss;

// ── Dev Console Tabs ─────────────────────────────────────
function devTab(name){
  ['game','endless','bosses','lb'].forEach(n=>{
    const panel=document.getElementById('devPanel'+n.charAt(0).toUpperCase()+n.slice(1));
    const tab=document.getElementById('dt'+n.charAt(0).toUpperCase()+n.slice(1));
    if(panel) panel.classList.toggle('hidden',n!==name);
    if(tab)   tab.classList.toggle('active',n===name);
  });
  if(name==='lb') devLBRefresh();
  if(name==='endless') devRefreshEndless();
  if(name==='bosses') devRefreshBosses();
}
window.devTab=devTab;

// ── Endless Panel ─────────────────────────────────────────
function devRefreshEndless(){
  const wd=document.getElementById('devWaveDisplay');
  if(wd) wd.textContent=endlessMode?`Wave ${endlessWave}`:'Not in Endless';
  const bki=document.getElementById('devBossKillsInput');
  if(bki) bki.value=bossKills;
  // Populate event selector
  const sel=document.getElementById('devEventSel');
  if(sel){
    sel.innerHTML=EVENTS.map((e,i)=>`<option value="${i}">${e.id}</option>`).join('');
  }
}
function devJumpWave(){
  const n=parseInt(document.getElementById('devWaveInput').value);
  if(!n||n<1){devLog('Invalid wave');return;}
  if(!endlessMode){devLog('Not in Endless mode');return;}
  DEV.used=true;
  hideOv('dev');
  endlessWave=n; GS.level=n;
  GS.effects={}; GS.boss=null; GS.bproj=[];
  setupLevel();
  if(phase==='playing'){showScreen('game');announce(`WAVE ${n}`);}
  devLog(`Jumped to endless wave ${n}`);
}
function devSetBossKills(){
  const n=parseInt(document.getElementById('devBossKillsInput').value)||0;
  bossKills=Math.max(0,n);
  saveBossData(); checkCreatorUnlock();
  devLog(`Boss kills set to ${bossKills}`);
}
function devUnlockCreator(){
  bossKills=Math.max(bossKills,BOSS_CREATOR_UNLOCK);
  saveBossData(); checkCreatorUnlock();
  devLog(`Boss Creator unlocked (${bossKills} kills)`);
}
function devFireEvent(){
  if(!endlessMode){devLog('Events only fire in Endless mode');return;}
  DEV.used=true; fireEvent();
  devLog('Random event fired');
}
function devFireSpecificEvent(){
  if(!endlessMode){devLog('Events only fire in Endless mode');return;}
  DEV.used=true;
  const idx=parseInt(document.getElementById('devEventSel').value)||0;
  const ev=EVENTS[idx];
  if(!ev){devLog('Invalid event');return;}
  ev.trigger(GS); showEventBanner(ev);
  devLog(`Fired event: ${ev.name}`);
}
function devSpeedEvent(){
  if(!GS.eventTimer){devLog('No event timer active');return;}
  GS.eventTimer=3000;
  devLog('Next event in 3s');
}
function devClearEvents(){
  if(!GS.events){devLog('No active events');return;}
  // Unfreeze meteors if frozen
  if(GS.events.freeze) GS.meteors.forEach(m=>{if(m.frozen){m.vx=m._frozenVx||0;m.vy=m._frozenVy||1.5;m.frozen=false;}});
  // Restore mirror
  GS.events={};
  updatePUBar(); devLog('All active events cleared');
}
function devFreezeAll(){
  if(!endlessMode){devLog('Events only in Endless');return;}
  DEV.used=true;
  GS.events=GS.events||{};
  GS.events.freeze=5000;
  GS.meteors.forEach(m=>{m._frozenVx=m.vx;m._frozenVy=m.vy;m.vx=0;m.vy=0;m.frozen=true;});
  if(settings.flash)doFlash('#00f5ff22');
  devLog('All meteors frozen for 5s');
}
window.devJumpWave=devJumpWave; window.devSetBossKills=devSetBossKills;
window.devUnlockCreator=devUnlockCreator; window.devFireEvent=devFireEvent;
window.devFireSpecificEvent=devFireSpecificEvent; window.devSpeedEvent=devSpeedEvent;
window.devClearEvents=devClearEvents; window.devFreezeAll=devFreezeAll;

// ── Bosses Panel ──────────────────────────────────────────
function devRefreshBosses(){
  const cnt=document.getElementById('devCustomBossCount');
  if(cnt) cnt.textContent=customBosses.length;
  ['devCustomBossSel','devCustomBossDelSel'].forEach(id=>{
    const sel=document.getElementById(id);
    if(!sel)return;
    sel.innerHTML=customBosses.length
      ?customBosses.map((b,i)=>`<option value="${i}">${b.name}</option>`).join('')
      :'<option value="">None saved</option>';
  });
}
function devSpawnCustomBoss(){
  const idx=parseInt(document.getElementById('devCustomBossSel').value);
  if(!customBosses[idx]){devLog('No custom boss selected');return;}
  DEV.used=true;
  const cb=customBosses[idx];
  hideOv('dev');
  GS.boss={...cb,x:canvas.width/2,y:-cb.sz,maxHp:cb.hp,hp:cb.hp,entering:true,
    targetY:cb.sz+25,atkT:cb.atkRate,phase:1,pulse:0,lv:0,custom:true};
  phase='bossActive'; setBossBar(true); updateHUD();
  Music.play('boss');
  devLog(`Spawned custom boss: ${cb.name}`);
}
function devSpawnPresetBoss(lv){
  DEV.used=true;
  hideOv('dev');
  GS.boss=null; GS.bproj=[];
  phase='bossIntro'; Music.play('boss');
  showBossIntro(lv);
  devLog(`Spawned preset boss LV${lv}: ${BOSSES[lv].name}`);
}
function devDeleteCustomBoss(){
  const idx=parseInt(document.getElementById('devCustomBossDelSel').value);
  if(!customBosses[idx]){devLog('No custom boss selected');return;}
  const name=customBosses[idx].name;
  customBosses.splice(idx,1);
  saveBossData(); devRefreshBosses(); checkCreatorUnlock();
  devLog(`Deleted custom boss: ${name}`);
}
function devClearCustomBosses(){
  customBosses=[]; saveBossData(); devRefreshBosses(); checkCreatorUnlock();
  devLog('All custom bosses deleted');
}
function devSetBossHP(){
  if(!GS.boss||GS.boss.dead){devLog('No active boss');return;}
  const pct=parseInt(document.getElementById('devBossHPInput').value)||50;
  GS.boss.hp=Math.max(1,Math.round(GS.boss.maxHp*(pct/100)));
  setBossBar(true); devLog(`Boss HP set to ${pct}% (${GS.boss.hp}/${GS.boss.maxHp})`);
}
function devSetBossSpd(){
  if(!GS.boss||GS.boss.dead){devLog('No active boss');return;}
  const mult=parseFloat(document.getElementById('devBossSpdInput').value)||2;
  GS.boss.vx=(GS.boss.vx<0?-1:1)*Math.abs(BOSSES[GS.boss.lv]?.spd||2)*mult;
  devLog(`Boss speed ×${mult}`);
}
window.devSpawnCustomBoss=devSpawnCustomBoss; window.devSpawnPresetBoss=devSpawnPresetBoss;
window.devDeleteCustomBoss=devDeleteCustomBoss; window.devClearCustomBosses=devClearCustomBosses;
window.devSetBossHP=devSetBossHP; window.devSetBossSpd=devSetBossSpd;
window.devRefreshBosses=devRefreshBosses; window.devRefreshEndless=devRefreshEndless;

// ── New GAME panel functions ──────────────────────────────
function devSetTimer(){
  const s=parseInt(document.getElementById('devTimerInput').value)||30;
  GS.timer=s*1000; devLog(`Timer set to ${s}s`);
}
function devSetDiff(){
  const d=document.getElementById('devDiffSel').value;
  setDiff(d); devLog(`Difficulty set to ${d}`);
}
function devRemoveLife(){
  if(GS.lives>1){GS.lives--;GS.p.damage=Math.min(2,GS.p.damage+1);updateHUD();devLog(`-1 life → ${GS.lives}`);}
  else devLog('Already at 1 life');
}
function devSetScore(){
  const n=parseInt(document.getElementById('devSetScoreAmt').value)||0;
  GS.score=Math.max(0,n); updateHUD(); DEV.used=true; devLog(`Score set to ${n}`);
}
function devClearPU(){
  GS.effects={}; updatePUBar(); devLog('All power-ups cleared');
}
function devResetUpgrades(){
  GS.upgrades={}; GS.pickedUpgrades={}; GS.companions=[];
  updateUpgradeBar(); DEV.used=true; devLog('All upgrades reset');
}
function devSpawnGolden(){
  DEV.used=true;
  GS.meteors.push({x:Math.random()*(canvas.width-100)+50,y:-50,r:40,
    vx:(Math.random()-.5)*1.2,vy:1.8,rot:0,rotSpd:0.015,
    color:'#b8860b',glowing:true,hp:8,maxHp:8,golden:true,points:2000});
  devLog('Golden meteor spawned');
}
function devClearComps(){
  GS.companions=[]; GS.pickedUpgrades.companion=0; updateUpgradeBar(); devLog('Companions cleared');
}
function devFireMissiles(){
  DEV.used=true;
  for(let i=0;i<3;i++) GS.missiles.push({x:GS.p.x+(i*20-20),y:GS.p.y-20,vx:0,vy:-3,life:5000,trail:[]});
  devLog('3 missiles fired');
}
window.devSetTimer=devSetTimer; window.devSetDiff=devSetDiff;
window.devRemoveLife=devRemoveLife; window.devSetScore=devSetScore;
window.devClearPU=devClearPU; window.devResetUpgrades=devResetUpgrades;
window.devSpawnGolden=devSpawnGolden; window.devClearComps=devClearComps;
window.devFireMissiles=devFireMissiles;

// Also expose new devToggle flags: hitbox, slowmo, noEvents
const _origDevToggle=devToggle;
// Patch toggle to handle new flags
window.devToggle=function(key){
  DEV[key]=!DEV[key];
  const el=document.getElementById(key==='hitbox'?'hbToggle':key==='slowmo'?'slowToggle':key==='noEvents'?'noEventsToggle':key+'Toggle');
  if(el){el.textContent=DEV[key]?'ON':'OFF';el.classList.toggle('off',!DEV[key]);}
  if(key==='god'&&DEV.god){GS.lives=endlessMode?3:DIFF[currentDiff].lives;GS.p.damage=0;updateHUD();}
  if(key!=='hitbox'&&key!=='slowmo'&&key!=='noEvents') DEV.used=true;
  devLog(`${key.toUpperCase()} ${DEV[key]?'enabled':'disabled'}`);
};

// ── Dev Leaderboard Management ───────────────────────────
// We store hidden entries separately so they can be restored
let lbHidden=[];
try{ const h=localStorage.getItem('mb_lb_hidden'); if(h) lbHidden=JSON.parse(h); }catch(e){}
function saveLBHidden(){ try{localStorage.setItem('mb_lb_hidden',JSON.stringify(lbHidden));}catch(e){} }

function devLBRefresh(){
  const table=document.getElementById('devLBTable');
  if(!table) return;
  const src=document.getElementById('devLBSource')?.value||'local';
  const search=(document.getElementById('devLBSearch')?.value||'').toLowerCase().trim();
  let entries=src==='all'?mergedLB():[...leaderboard];
  if(search) entries=entries.filter(e=>e.name.toLowerCase().includes(search));

  if(!entries.length&&!lbHidden.length){
    table.innerHTML='<div class="dev-lb-empty">No entries found</div>'; return;
  }

  const diffBadge=d=>`<span class="dev-lb-badge ${d||'normal'}">${(d||'NRM').slice(0,3).toUpperCase()}</span>`;

  // Active entries
  let html=entries.map((e,i)=>`
    <div class="dev-lb-row" id="devlbr_${i}">
      <span class="dev-lb-idx">#${i+1}</span>
      <input class="dev-lb-name-input" value="${e.name}" id="devlbn_${i}" title="Edit name"/>
      <input class="dev-lb-score-input" value="${e.score}" id="devlbs_${i}" title="Edit score" type="number"/>
      ${diffBadge(e.diff)}
      <span style="font-family:'Share Tech Mono',monospace;font-size:.6rem;color:var(--dim)">${e.level?'LV'+e.level:''}</span>
      <button class="dev-lb-icon-btn save" onclick="devLBSave(${i})" title="Save changes">✓</button>
      <button class="dev-lb-icon-btn hide" onclick="devLBHide(${i})" title="Hide (temporary)">◌</button>
      <button class="dev-lb-icon-btn del" onclick="devLBDelete(${i})" title="Delete permanently">✕</button>
    </div>`).join('');

  // Hidden entries (shown as ghost rows)
  if(lbHidden.length){
    html+=`<div style="font-family:'Share Tech Mono',monospace;font-size:.6rem;color:var(--dim);letter-spacing:3px;padding:8px 4px 4px">HIDDEN (${lbHidden.length})</div>`;
    html+=lbHidden.map((e,i)=>`
      <div class="dev-lb-row hidden-row">
        <span class="dev-lb-idx">–</span>
        <span style="color:var(--dim);font-family:'Share Tech Mono',monospace;font-size:.68rem">${e.name}</span>
        <span style="color:var(--dim);font-family:'Share Tech Mono',monospace;font-size:.68rem;text-align:right">${Number(e.score).toLocaleString()}</span>
        ${diffBadge(e.diff)}
        <span style="font-family:'Share Tech Mono',monospace;font-size:.6rem;color:var(--dim)">${e.level?'LV'+e.level:''}</span>
        <button class="dev-lb-icon-btn restore" onclick="devLBRestoreOne(${i})" title="Restore">↩</button>
        <button class="dev-lb-icon-btn del" onclick="devLBDeleteHidden(${i})" title="Delete permanently">✕</button>
      </div>`).join('');
  }

  table.innerHTML=html;
}

function devLBSave(i){
  const nameEl=document.getElementById(`devlbn_${i}`);
  const scoreEl=document.getElementById(`devlbs_${i}`);
  if(!nameEl||!scoreEl) return;
  const rawName=nameEl.value.trim()||leaderboard[i].name;
  const newName=sanitizeName(rawName);
  if(newName===null){ devLog(`Save rejected: "${rawName}" contains inappropriate language`); return; }
  const newScore=parseInt(scoreEl.value)||leaderboard[i].score;
  const old={...leaderboard[i]};
  leaderboard[i].name=newName;
  leaderboard[i].score=newScore;
  leaderboard.sort((a,b)=>b.score-a.score);
  saveLB();
  devLog(`Saved: "${old.name}" → "${newName}", ${old.score} → ${newScore}`);
  devLBRefresh();
}

function devLBHide(i){
  if(i<0||i>=leaderboard.length) return;
  const entry=leaderboard.splice(i,1)[0];
  lbHidden.push(entry);
  saveLB(); saveLBHidden();
  devLog(`Hidden: "${entry.name}" (${entry.score}) — restore anytime`);
  devLBRefresh();
}

function devLBDelete(i){
  if(i<0||i>=leaderboard.length) return;
  const entry=leaderboard.splice(i,1)[0];
  saveLB();
  devLog(`Deleted permanently: "${entry.name}" (${entry.score})`);
  devLBRefresh();
}

function devLBRestoreOne(i){
  if(i<0||i>=lbHidden.length) return;
  const entry=lbHidden.splice(i,1)[0];
  leaderboard.push(entry);
  leaderboard.sort((a,b)=>b.score-a.score);
  if(leaderboard.length>MAX_LB) leaderboard.length=MAX_LB;
  saveLB(); saveLBHidden();
  devLog(`Restored: "${entry.name}" (${entry.score})`);
  devLBRefresh();
}

function devLBDeleteHidden(i){
  if(i<0||i>=lbHidden.length) return;
  const entry=lbHidden.splice(i,1)[0];
  saveLBHidden();
  devLog(`Deleted hidden entry permanently: "${entry.name}"`);
  devLBRefresh();
}

function devLBRestoreHidden(){
  if(!lbHidden.length){ devLog('No hidden entries to restore'); return; }
  lbHidden.forEach(e=>leaderboard.push(e));
  lbHidden=[];
  leaderboard.sort((a,b)=>b.score-a.score);
  if(leaderboard.length>MAX_LB) leaderboard.length=MAX_LB;
  saveLB(); saveLBHidden();
  devLog(`Restored all hidden entries`);
  devLBRefresh();
}

function devLBClearAll(){
  if(!leaderboard.length){ devLog('Leaderboard already empty'); return; }
  const count=leaderboard.length;
  // Move all to hidden so they can be recovered
  lbHidden.push(...leaderboard);
  leaderboard=[];
  saveLB(); saveLBHidden();
  devLog(`Cleared ${count} entries (moved to hidden — use Restore Hidden to recover)`);
  devLBRefresh();
}

function devLBAddDummy(){
  const names=['ACE','NOVA','BLAZE','ECHO','VIPER','ZERO','FLUX'];
  const diffs=['easy','normal','hard'];
  const entry={
    name:names[Math.floor(Math.random()*names.length)]+Math.floor(Math.random()*99),
    score:Math.floor(Math.random()*50000)+1000,
    level:Math.floor(Math.random()*20)+1,
    diff:diffs[Math.floor(Math.random()*diffs.length)],
    date:new Date().toLocaleDateString()
  };
  leaderboard.push(entry);
  leaderboard.sort((a,b)=>b.score-a.score);
  if(leaderboard.length>MAX_LB) leaderboard.length=MAX_LB;
  saveLB();
  devLog(`Added test entry: ${entry.name} — ${entry.score}`);
  devLBRefresh();
}

window.devLBRefresh=devLBRefresh;
window.devLBSave=devLBSave;
window.devLBHide=devLBHide;
window.devLBDelete=devLBDelete;
window.devLBRestoreOne=devLBRestoreOne;
window.devLBDeleteHidden=devLBDeleteHidden;
window.devLBRestoreHidden=devLBRestoreHidden;
window.devLBClearAll=devLBClearAll;
window.devLBAddDummy=devLBAddDummy;

// ═══════════════════════════════════════════════════════════
//   ENDLESS SPECIAL EVENTS
// ═══════════════════════════════════════════════════════════

const EVENTS = [

  {
    id: 'meteor_storm',
    name: '☄ METEOR STORM',
    color: '#ff6a00',
    weight: 10,
    desc: 'Meteors rain from all angles!',
    trigger(gs) {
      for(let i=0;i<18;i++){
        const angle = (i/18)*Math.PI; // semicircle across top
        const sz = 10+Math.random()*14;
        gs.meteors.push({
          x: Math.random()*canvas.width,
          y: -sz-Math.random()*120,
          r: sz, vx: (Math.random()-.5)*3,
          vy: 3+Math.random()*3,
          rot:0, rotSpd:(Math.random()-.5)*.06,
          color:['#b46a2e','#c07030','#8a4e20'][Math.floor(Math.random()*3)],
          hp:1, maxHp:1
        });
      }
    }
  },

  {
    id: 'golden_meteor',
    name: '✦ GOLDEN METEOR',
    color: '#ffd600',
    weight: 6,
    desc: 'A legendary meteor — worth massive points!',
    trigger(gs) {
      gs.meteors.push({
        x: Math.random()*(canvas.width-80)+40, y:-45,
        r:40, vx:(Math.random()-.5)*1.2, vy:1.8,
        rot:0, rotSpd:0.015,
        color:'#b8860b', glowing:true,
        hp:8, maxHp:8, golden:true,
        points:2000
      });
      announce('✦ GOLDEN METEOR ✦', 2000);
    },
    // Override destroyMeteor to give bonus — handled via golden flag in destroyMeteor
  },

  {
    id: 'powerup_rain',
    name: '⚡ POWER-UP RAIN',
    color: '#00f5ff',
    weight: 7,
    desc: 'Power-ups shower from the sky!',
    trigger(gs) {
      const types=['rapid','triple','shield','bomb'];
      const cols={rapid:'#ffd600',triple:'#00f5ff',shield:'#39ff14',bomb:'#ff2d55'};
      const lbls={rapid:'⚡',triple:'✦',shield:'🛡',bomb:'💥'};
      for(let i=0;i<6;i++){
        const type=types[Math.floor(Math.random()*types.length)];
        gs.powerups.push({
          x:80+Math.random()*(canvas.width-160), y:-20-i*60,
          r:14, spd:1.8, type, color:cols[type], label:lbls[type], pulse:0
        });
      }
    }
  },

  {
    id: 'double_score',
    name: '⭐ DOUBLE SCORE',
    color: '#ffd600',
    weight: 6,
    desc: '2× score multiplier for 12 seconds!',
    trigger(gs) {
      gs.events.doubleScore = 12000;
    }
  },

  {
    id: 'the_swarm',
    name: '🐝 THE SWARM',
    color: '#ff2d55',
    weight: 8,
    desc: 'Tiny fast meteors flood the screen!',
    trigger(gs) {
      for(let i=0;i<30;i++){
        gs.meteors.push({
          x: Math.random()*canvas.width,
          y: -8-Math.random()*200,
          r:6+Math.random()*4, vx:(Math.random()-.5)*4,
          vy:4+Math.random()*4,
          rot:0, rotSpd:(Math.random()-.5)*.1,
          color:'#8a4e20', hp:1, maxHp:1
        });
      }
    }
  },

  {
    id: 'gravity_surge',
    name: '🌊 GRAVITY SURGE',
    color: '#c800ff',
    weight: 6,
    desc: 'Meteors accelerate downward for 8 seconds!',
    trigger(gs) {
      gs.events.gravitySurge = 8000;
    }
  },

  {
    id: 'companion_boost',
    name: '🛸 SQUADRON BOOST',
    color: '#00c8ff',
    weight: 5,
    desc: 'Companions go into overdrive for 10 seconds!',
    trigger(gs) {
      gs.events.companionBoost = 10000;
    }
  },

  {
    id: 'shield_gift',
    name: '🛡 GUARDIAN ANGEL',
    color: '#39ff14',
    weight: 7,
    desc: 'A full shield appears — stay alive!',
    trigger(gs) {
      gs.effects.shield = 12000 + (gs.upgrades.puBonus||0);
      spawnParts(gs.p.x, gs.p.y, '#39ff14', 30);
      addExp(gs.p.x, gs.p.y, '#39ff14');
    }
  },

  {
    id: 'meteor_freeze',
    name: '❄ DEEP FREEZE',
    color: '#00f5ff',
    weight: 5,
    desc: 'All meteors frozen for 3 seconds!',
    trigger(gs) {
      gs.events.freeze = 3000;
      gs.meteors.forEach(m=>{m._frozenVx=m.vx;m._frozenVy=m.vy;m.vx=0;m.vy=0;m.frozen=true;});
      if(settings.flash) doFlash('#00f5ff22');
    }
  },

  {
    id: 'asteroid_belt',
    name: '💫 ASTEROID BELT',
    color: '#ff9d00',
    weight: 7,
    desc: 'Meteors march in tight formation rows!',
    trigger(gs) {
      const cols = Math.floor(canvas.width/60);
      for(let row=0;row<3;row++){
        for(let col=0;col<cols;col++){
          const sz = 14+Math.random()*8;
          gs.meteors.push({
            x: 40+col*(canvas.width-80)/(cols-1),
            y: -sz - row*80,
            r:sz, vx:0, vy:2.5+row*.4,
            rot:0, rotSpd:(Math.random()-.5)*.04,
            color:['#b46a2e','#8a4e20','#c07030'][row%3],
            hp:1, maxHp:1
          });
        }
      }
    }
  },

  {
    id: 'ghost_mode',
    name: '👻 GHOST MODE',
    color: '#c800ff',
    weight: 4,
    desc: 'Your ship phases out — invisible for 5 seconds!',
    trigger(gs) {
      gs.events.ghostMode = 5000;
      gs.invincible = true;
      gs.invT = 5000;
    }
  },

  {
    id: 'life_bonus',
    name: '♥ SECOND CHANCE',
    color: '#ff2d55',
    weight: 4,
    desc: 'A life restored — don\'t waste it!',
    trigger(gs) {
      const max = endlessMode ? 6 : DIFF[currentDiff].lives + 3;
      if(gs.lives < max){
        gs.lives++;
        gs.p.damage = Math.max(0, gs.p.damage-1);
        updateHUD();
        spawnParts(gs.p.x, gs.p.y, '#ff2d55', 25);
        if(settings.flash) doFlash('#ff2d5530');
      } else {
        gs.score += 3000;
        announce('+3000 BONUS', 1500);
      }
    }
  },

  {
    id: 'wormhole',
    name: '🌀 WORMHOLE',
    color: '#c800ff',
    weight: 4,
    desc: 'Ship teleports to a random position!',
    trigger(gs) {
      gs.p.x = 80 + Math.random()*(canvas.width-160);
      gs.invincible = true; gs.invT = 800;
      spawnParts(gs.p.x, gs.p.y, '#c800ff', 30);
      addExp(gs.p.x, gs.p.y, '#c800ff');
      if(settings.flash) doFlash('#c800ff33');
    }
  },

  {
    id: 'score_jackpot',
    name: '💰 JACKPOT',
    color: '#ffd600',
    weight: 3,
    desc: 'Random score bonus — could be huge!',
    trigger(gs) {
      const bonus = (Math.floor(Math.random()*8)+3)*500 * (endlessWave > 10 ? 2 : 1);
      gs.score += bonus;
      announce(`+${bonus.toLocaleString()} JACKPOT!`, 2200);
      updateHUD();
      spawnParts(gs.p.x, gs.p.y-30, '#ffd600', 35);
    }
  },

  {
    id: 'mirror',
    name: '🪞 MIRROR WORLD',
    color: '#00f5ff',
    weight: 3,
    desc: 'Controls are reversed for 6 seconds! ←→',
    trigger(gs) {
      gs.events.mirror = 6000;
    }
  },

];

// ── Event State & Scheduler ───────────────────────────────
function initEventState(gs) {
  gs.events = {};            // active timed effects
  gs.eventTimer = getNextEventTime(); // ms until next event fires
  gs.lastEventId = null;
}

function getNextEventTime() {
  // Fire between 15–35 seconds into a wave
  return 15000 + Math.random() * 20000;
}

function getWeightedEvent() {
  const pool = EVENTS.filter(e => e.id !== GS.lastEventId);
  const total = pool.reduce((s,e)=>s+e.weight,0);
  let r = Math.random()*total;
  for(const e of pool){ r-=e.weight; if(r<=0) return e; }
  return pool[0];
}

function tickEvents(dt) {
  if(!endlessMode) return;

  // Countdown to next event
  GS.eventTimer -= dt;
  if(GS.eventTimer <= 0) {
    fireEvent();
    GS.eventTimer = getNextEventTime();
  }

  // Tick timed effects
  const ev = GS.events;

  if(ev.doubleScore > 0) {
    ev.doubleScore -= dt;
    if(ev.doubleScore <= 0) { delete ev.doubleScore; announce('DOUBLE SCORE ENDED', 1200); }
  }

  if(ev.gravitySurge > 0) {
    ev.gravitySurge -= dt;
    GS.meteors.forEach(m => { if(!m.frozen) m.vy = Math.min(m.vy + 0.04, 14); });
    if(ev.gravitySurge <= 0) delete ev.gravitySurge;
  }

  if(ev.companionBoost > 0) {
    ev.companionBoost -= dt;
    if(ev.companionBoost <= 0) delete ev.companionBoost;
  }

  if(ev.freeze > 0) {
    ev.freeze -= dt;
    if(ev.freeze <= 0) {
      delete ev.freeze;
      GS.meteors.forEach(m=>{ if(m.frozen){ m.vx=m._frozenVx; m.vy=m._frozenVy; m.frozen=false; } });
    }
  }

  if(ev.mirror > 0) {
    ev.mirror -= dt;
    if(ev.mirror <= 0) { delete ev.mirror; announce('MIRROR ENDED', 1000); }
  }

  if(ev.ghostMode > 0) {
    ev.ghostMode -= dt;
    if(ev.ghostMode <= 0) delete ev.ghostMode;
  }
}

function fireEvent() {
  const ev = getWeightedEvent();
  GS.lastEventId = ev.id;
  ev.trigger(GS);
  // Show event banner
  showEventBanner(ev);
  devLog(`Event fired: ${ev.name}`);
}

function showEventBanner(ev) {
  const banner = document.getElementById('eventBanner');
  if(!banner) return;
  banner.querySelector('.eb-name').textContent = ev.name;
  banner.querySelector('.eb-desc').textContent = ev.desc;
  banner.style.borderColor = ev.color;
  banner.style.boxShadow = `0 0 30px ${ev.color}44`;
  banner.querySelector('.eb-name').style.color = ev.color;
  banner.classList.remove('hidden');
  banner.classList.add('eb-show');
  clearTimeout(banner._hideT);
  banner._hideT = setTimeout(()=>{ banner.classList.remove('eb-show'); setTimeout(()=>banner.classList.add('hidden'),500); }, 3000);
}

// ── Event Hooks (called from existing functions) ──────────
function applyEventModifiers() {
  // Mirror controls
  if(GS.events && GS.events.mirror > 0) {
    [keys['ArrowLeft'], keys['ArrowRight']] = [keys['ArrowRight'], keys['ArrowLeft']];
    [keys['a'], keys['d']] = [keys['d'], keys['a']];
  }
}

function getScoreMultiplier() {
  let m = 1 + (GS.upgrades.scoreMult||0);
  if(GS.events && GS.events.doubleScore > 0) m *= 2;
  return m;
}

function getCompanionShootCD() {
  return (GS.events && GS.events.companionBoost > 0) ? 120 : 380;
}

// ═══════════════════════════════════════════════════════════
//   BOSS CREATOR
// ═══════════════════════════════════════════════════════════
const BC_COLORS = [
  {hex:'#b46a2e',glow:'#ff6a00'},{hex:'#4070a0',glow:'#00c8ff'},
  {hex:'#702098',glow:'#c800ff'},{hex:'#1a6b3a',glow:'#39ff14'},
  {hex:'#8b0000',glow:'#ff2d55'},{hex:'#4a4a0a',glow:'#ffd600'},
  {hex:'#0a1a4a',glow:'#00f5ff'},{hex:'#6b2060',glow:'#ff69b4'},
  {hex:'#1a3a5c',glow:'#4499ff'},{hex:'#3a1a00',glow:'#ff9d00'},
];
let bcColorIdx = 0;
let bcPrevPattern = 'aimed';

function bcInit(){
  // Build color swatches
  const pal = document.getElementById('bcPalette');
  if(!pal) return;
  pal.innerHTML = BC_COLORS.map((c,i)=>`
    <div class="bc-swatch${i===0?' active':''}" style="background:${c.hex};box-shadow:0 0 6px ${c.glow}"
         onclick="bcPickColor(${i})" title="${c.hex}"></div>`).join('');
  bcColorIdx = 0;
  bcPreview();
  bcRenderSaved();
}

function bcPickColor(i){
  bcColorIdx = i;
  document.querySelectorAll('.bc-swatch').forEach((s,si)=>s.classList.toggle('active',si===i));
  bcPreview();
}

function bcPat(btn){
  document.querySelectorAll('.bc-pat').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  bcPrevPattern = btn.dataset.pat;
  bcPreview();
}
window.bcPat = bcPat;
window.bcPickColor = bcPickColor;

function bcGetValues(){
  const sz    = parseInt(document.getElementById('bcSz')?.value||70);
  const hp    = parseInt(document.getElementById('bcHp')?.value||60);
  const spdRaw= parseInt(document.getElementById('bcSpd')?.value||20);
  const atkRaw= parseInt(document.getElementById('bcAtk')?.value||20);
  const shots = parseInt(document.getElementById('bcShots')?.value||3);
  const ssRaw = parseInt(document.getElementById('bcSSpd')?.value||40);
  const name  = (document.getElementById('bcName')?.value||'THE DESTROYER').toUpperCase().trim()||'THE DESTROYER';
  const tagline=(document.getElementById('bcTagline')?.value||'A player creation').trim();
  const col   = BC_COLORS[bcColorIdx];
  return {
    name, sub:tagline||'A player creation',
    color:col.hex, glow:col.glow,
    sz, hp,
    spd: spdRaw/10,
    atkRate: Math.round(atkRaw*100),
    shots, shotSpd: ssRaw/10,
    pattern: bcPrevPattern,
    custom:true,
  };
}

function bcPreview(){
  // Update labels
  const g = (id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=val; };
  const sz    = parseInt(document.getElementById('bcSz')?.value||70);
  const hp    = parseInt(document.getElementById('bcHp')?.value||60);
  const spdRaw= parseInt(document.getElementById('bcSpd')?.value||20);
  const atkRaw= parseInt(document.getElementById('bcAtk')?.value||20);
  const shots = parseInt(document.getElementById('bcShots')?.value||3);
  const ssRaw = parseInt(document.getElementById('bcSSpd')?.value||40);
  g('bcSzVal', sz+'px');
  g('bcHpVal', hp);
  g('bcSpdVal', (spdRaw/10).toFixed(1));
  g('bcAtkVal', (atkRaw/10).toFixed(1)+'s');
  g('bcShotsVal', shots);
  g('bcSSpdVal', (ssRaw/10).toFixed(1));

  // Difficulty rating
  const score = Math.round((hp*0.4 + spdRaw*1.5 + (35-atkRaw)*2 + shots*8 + ssRaw*0.8 + sz*0.3));
  const pct   = Math.min(100, Math.round(score/3));
  const col   = pct<33?'#39ff14':pct<66?'#ffd600':'#ff2d55';
  const label = pct<25?'TOO EASY':pct<50?'BALANCED':pct<75?'TOUGH':'BRUTAL';
  const fill  = document.getElementById('bcMeterFill');
  const sc    = document.getElementById('bcMeterScore');
  if(fill){ fill.style.width=pct+'%'; fill.style.background=col; fill.style.boxShadow=`0 0 8px ${col}`; }
  if(sc) sc.textContent = label+' ('+pct+'%)';

  // Canvas preview
  const cv = document.getElementById('bcCanvas');
  if(!cv) return;
  const c  = cv.getContext('2d');
  const W  = cv.width, H = cv.height;
  c.clearRect(0,0,W,H);
  c.fillStyle='#02020f'; c.fillRect(0,0,W,H);

  const bCol = BC_COLORS[bcColorIdx];
  const t    = Date.now();

  c.save(); c.translate(W/2, H/2);
  c.shadowColor=bCol.glow; c.shadowBlur=20+Math.sin(t/300)*6;

  // Body
  c.fillStyle=bCol.hex; c.beginPath();
  for(let i=0;i<10;i++){const a=(i/10)*Math.PI*2,r=sz/2*(.85+((i*7+17)%10)/40);i===0?c.moveTo(Math.cos(a)*r,Math.sin(a)*r):c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
  c.closePath(); c.fill();

  // Core
  const cr=sz/5+Math.sin(t/200)*3;
  const cg=c.createRadialGradient(0,0,0,0,0,cr);
  cg.addColorStop(0,'#fff'); cg.addColorStop(.4,bCol.glow); cg.addColorStop(1,'transparent');
  c.fillStyle=cg; c.globalAlpha=.9; c.beginPath(); c.arc(0,0,cr,0,Math.PI*2); c.fill();
  c.globalAlpha=1;

  // Name label
  c.shadowBlur=0; c.fillStyle=bCol.glow;
  c.font=`bold ${Math.max(8,Math.floor(sz/7))}px Orbitron,sans-serif`;
  c.textAlign='center'; c.textBaseline='middle';
  const displayName=(document.getElementById('bcName')?.value||'THE DESTROYER').toUpperCase().trim()||'THE DESTROYER';
  c.fillText(displayName, 0, sz/2+14);
  c.restore();

  // Animate
  if(document.getElementById('bossCreatorScreen')&&!document.getElementById('bossCreatorScreen').classList.contains('hidden'))
    requestAnimationFrame(bcPreview);
}

function bcSave(){
  const vals = bcGetValues();
  if(!vals.name||vals.name==='THE DESTROYER'&&!document.getElementById('bcName').value.trim()){
    alert('Give your boss a name first!'); return;
  }
  if(containsBadWord(vals.name)||containsBadWord(vals.sub)){
    alert('Boss name or tagline contains inappropriate language.'); return;
  }
  customBosses.push(vals);
  saveBossData();
  bcRenderSaved();
  devLog(`Boss "${vals.name}" saved (${customBosses.length} total)`);
  checkCreatorUnlock();
}
window.bcSave = bcSave;

function bcDeleteSaved(i){
  customBosses.splice(i,1);
  saveBossData(); bcRenderSaved(); checkCreatorUnlock();
}
window.bcDeleteSaved = bcDeleteSaved;

function bcRenderSaved(){
  const el=document.getElementById('bcSavedList');
  if(!el) return;
  if(!customBosses.length){
    el.innerHTML='<div style="font-family:\'Share Tech Mono\',monospace;font-size:.68rem;color:var(--dim);text-align:center;padding:8px">No bosses saved yet</div>';
    return;
  }
  el.innerHTML=customBosses.map((b,i)=>`
    <div class="bc-saved-row">
      <div class="bc-saved-dot" style="background:${b.color};box-shadow:0 0 5px ${b.glow}"></div>
      <span class="bc-saved-name">${b.name}</span>
      <span style="font-family:'Share Tech Mono',monospace;font-size:.6rem;color:var(--dim)">HP:${b.hp}</span>
      <button class="bc-saved-del" onclick="bcDeleteSaved(${i})" title="Delete">✕</button>
    </div>`).join('');
}

function drawHitboxes(){
  ctx.save();ctx.strokeStyle='rgba(255,0,0,0.6)';ctx.lineWidth=1;
  // Player hitbox
  ctx.beginPath();ctx.arc(GS.p.x,GS.p.y,14,0,Math.PI*2);ctx.stroke();
  // Meteor hitboxes
  ctx.strokeStyle='rgba(255,165,0,0.5)';
  GS.meteors.forEach(m=>{ctx.beginPath();ctx.arc(m.x,m.y,m.r,0,Math.PI*2);ctx.stroke();});
  // Boss hitbox
  if(GS.boss&&!GS.boss.dead){ctx.strokeStyle='rgba(255,0,255,0.6)';ctx.beginPath();ctx.arc(GS.boss.x,GS.boss.y,GS.boss.sz/2,0,Math.PI*2);ctx.stroke();}
  // Boss projectile hitboxes
  ctx.strokeStyle='rgba(255,50,50,0.4)';
  GS.bproj.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.stroke();});
  ctx.restore();
}

// ── Boot ─────────────────────────────────────────────
loadPersist();loadBossData();resize();showScreen('start');checkCreatorUnlock();
if(settings.music) setTimeout(()=>Music.play('menu'),300);
requestAnimationFrame(()=>{
  ctx.fillStyle='#02020f';ctx.fillRect(0,0,canvas.width,canvas.height);
  stars.forEach(s=>{ctx.globalAlpha=s.a;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;
});