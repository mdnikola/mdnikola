'use strict';
// ffmpeg-based effects: image overlays, text logos, audio effects. No network needed.
const fs = require('fs');
const path = require('path');
const { ASSETS, tmpFile, unlink, ff, ffBuffer } = require('./nk-utils.js');

const A = (f) => path.join(ASSETS, f).replace(/\\/g, '/');
const FONT = A('Poppins-Bold.ttf');

// ---------- image effects ----------
const SEPIA = 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131';
const IMG = {
  wasted:  { overlay: 'wasted.png',  pre: 'hue=s=0,eq=contrast=1.1:brightness=-0.05' },
  jail:    { overlay: 'jail.png',    pre: 'hue=s=0.35' },
  wanted:  { overlay: 'wanted.png',  pre: SEPIA },
  rainbow: { overlay: 'rainbow.png', pre: 'null' },
};

async function imageEffect(buffer, name) {
  const cfg = IMG[name];
  if (!cfg) throw new Error('Unknown effect');
  const inp = tmpFile('img'), out = tmpFile('png');
  fs.writeFileSync(inp, buffer);
  try {
    await ff(['-i', inp, '-i', A(cfg.overlay), '-filter_complex',
      `[0:v]scale='min(1080,iw)':-2,${cfg.pre},format=rgba[bg];[1:v]format=rgba[ov0];[ov0][bg]scale2ref=w=iw:h=ih[ov][bg2];[bg2][ov]overlay=0:0:format=auto`,
      '-frames:v', '1', out]);
    return fs.readFileSync(out);
  } finally { unlink(inp, out); }
}

// Shaking red "TRIGGERED" clip -> mp4 buffer
async function triggerClip(buffer) {
  const inp = tmpFile('img'), out = tmpFile('mp4');
  fs.writeFileSync(inp, buffer);
  try {
    await ff(['-loop', '1', '-t', '1.4', '-framerate', '20', '-i', inp, '-loop', '1', '-t', '1.4', '-framerate', '20', '-i', A('trigger.png'), '-filter_complex',
      `[0:v]scale=560:560:force_original_aspect_ratio=increase,crop=560:560,crop=512:512:x='24+(random(0)-0.5)*28':y='24+(random(1)-0.5)*28',colorchannelmixer=rr=1:gg=0.75:bb=0.75,format=rgba[bg];` +
      `[1:v]scale=512:512,format=rgba[ov];[bg][ov]overlay=0:0:format=auto,format=yuv420p`,
      '-r', '20', '-movflags', 'faststart', out]);
    return fs.readFileSync(out);
  } finally { unlink(inp, out); }
}

async function enhance(buffer) {
  return ffBuffer(buffer, 'img', 'jpg', (i, o) => ['-i', i, '-vf',
    "scale='min(2048,iw*2)':-2:flags=lanczos,hqdn3d=1.5:1.5:6:6,unsharp=5:5:1.1:5:5:0.0,eq=contrast=1.06:saturation=1.1", '-q:v', '2', '-frames:v', '1', o]);
}

// ---------- text logos ----------
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const STYLES = {
  neon:      { c1: '#7df9ff', c2: '#00a2ff', glow: '#00d9ff', bg: '#05050f', stroke: '#ffffff' },
  fire:      { c1: '#fff176', c2: '#e53900', glow: '#ff6a00', bg: '#120400' },
  gold:      { c1: '#fff3b0', c2: '#b8860b', glow: '#d4a017', bg: '#0e0a02' },
  silver:    { c1: '#ffffff', c2: '#7d8794', glow: '#b9c4d2', bg: '#0b0d12' },
  rainbow:   { rainbow: true, glow: '#ffffff', bg: '#0a0a0f' },
  dragon:    { c1: '#9dff6b', c2: '#0b6e1e', glow: '#27d43f', bg: '#030d05' },
  phoenix:   { c1: '#ffd24d', c2: '#d1005e', glow: '#ff5a2a', bg: '#10030a' },
  moon:      { c1: '#ffffff', c2: '#8fa4ff', glow: '#b4c2ff', bg: '#070a1c' },
  lightning: { c1: '#ffffff', c2: '#6a5cff', glow: '#8f7bff', bg: '#05030f' },
  crystal:   { c1: '#e8ffff', c2: '#35c2d8', glow: '#7ae8ff', bg: '#041016' },
};

async function makeLogo(textRaw, style) {
  const st = STYLES[style];
  if (!st) throw new Error('Unknown logo style');
  const text = String(textRaw).replace(/\s+/g, ' ').trim().slice(0, 24);
  const W = 1000, H = 420;
  const size = Math.max(50, Math.min(220, Math.floor(880 / (Math.max(text.length, 4) * 0.72))));
  const tf = tmpFile('txt'), out = tmpFile('png');
  fs.writeFileSync(tf, text);
  let grad;
  if (st.rainbow) {
    grad = `geq=r='127+127*sin(X/W*6.2832)':g='127+127*sin(X/W*6.2832+2.0944)':b='127+127*sin(X/W*6.2832+4.1888)'`;
  } else {
    const [r1, g1, b1] = hex(st.c1), [r2, g2, b2] = hex(st.c2);
    const L = (a, b) => `${a}+(${b}-${a})*Y/H`;
    grad = `geq=r='${L(r1, r2)}':g='${L(g1, g2)}':b='${L(b1, b2)}'`;
  }
  const [gr, gg, gb] = hex(st.glow);
  const strokeOpt = st.stroke ? `:borderw=3:bordercolor=${st.stroke.replace('#', '0x')}` : '';
  const draw = `drawtext=fontfile='${FONT}':textfile='${tf.replace(/\\/g, '/')}':fontsize=${size}:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2`;
  const fc =
    `color=c=${st.bg.replace('#', '0x')}:s=${W}x${H},format=rgba[bg];` +
    `color=c=black:s=${W}x${H},${draw}${strokeOpt},format=gray,split=3[m1][m2][m3];` +
    `color=c=black:s=${W}x${H},format=rgb24,${grad},format=rgba[grad];` +
    `[grad][m1]alphamerge[txt];` +
    `color=c=${'0x' + st.glow.slice(1)}:s=${W}x${H},format=rgba[gc1];` +
    `[m2]gblur=sigma=20[b1];[gc1][b1]alphamerge,colorchannelmixer=aa=0.65[glow1];` +
    `color=c=${'0x' + st.glow.slice(1)}:s=${W}x${H},format=rgba[gc2];` +
    `[m3]gblur=sigma=7[b2];[gc2][b2]alphamerge[glow2];` +
    `[bg][glow1]overlay=format=auto[l1];[l1][glow2]overlay=format=auto[l2];[l2][txt]overlay=format=auto`;
  try {
    await ff(['-filter_complex', fc, '-frames:v', '1', out], 60000);
    return fs.readFileSync(out);
  } finally { unlink(tf, out); }
}

// ---------- audio effects ----------
const AUDIO = {
  bassboost: 'bass=g=18,volume=1.2',
  deep:      'asetrate=44100*0.78,aresample=44100,atempo=1.12,bass=g=6',
  echo:      'aecho=0.8:0.9:700|1100:0.4|0.3',
  fast:      'atempo=1.5',
  nightcore: 'asetrate=44100*1.25,aresample=44100,atempo=1.0',
  reverse:   'areverse',
  robot:     "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75",
  slow:      'atempo=0.7',
};
async function audioEffect(buffer, name, ptt = false) {
  const f = AUDIO[name];
  if (!f) throw new Error('Unknown audio effect');
  return ffBuffer(buffer, 'bin', ptt ? 'ogg' : 'mp3', (i, o) => ptt
    ? ['-i', i, '-vn', '-af', f, '-c:a', 'libopus', '-b:a', '48k', '-ar', '48000', '-ac', '1', o]
    : ['-i', i, '-vn', '-af', f, '-c:a', 'libmp3lame', '-q:a', '3', o]);
}
const toMp3 = (b) => ffBuffer(b, 'bin', 'mp3', (i, o) => ['-i', i, '-vn', '-c:a', 'libmp3lame', '-q:a', '3', o]);
const toPttOgg = (b) => ffBuffer(b, 'bin', 'ogg', (i, o) => ['-i', i, '-vn', '-c:a', 'libopus', '-b:a', '48k', '-ar', '48000', '-ac', '1', o]);

module.exports = { imageEffect, triggerClip, enhance, makeLogo, audioEffect, toMp3, toPttOgg, STYLES, AUDIO, IMG };
