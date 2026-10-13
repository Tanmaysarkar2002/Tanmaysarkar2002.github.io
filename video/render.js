// Renders video/index.html into an MP4, one frame at a time, with generated sound effects.
//
//   npm i playwright        (once; Chromium comes with `npx playwright install chromium`)
//   node video/render.js    -> video/claude-chat.mp4
//
// Needs ffmpeg on your PATH.
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const FPS = 30;
const OUT = path.join(__dirname, "claude-chat.mp4");
const RATE = 44100;

// ---- Sound effects, synthesised straight into a WAV file. ----
function makeAudio(tl) {
  const pcm = new Float32Array(Math.ceil(tl.duration * RATE));
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const add = (at, len, fn) => {
    const s0 = Math.floor(at * RATE);
    for (let i = 0; i < len * RATE && s0 + i < pcm.length; i++) pcm[s0 + i] += fn(i / RATE);
  };
  // Keyboard tick: a very short burst of filtered noise.
  tl.keys.forEach((k, n) => {
    let prev = 0;
    const amp = 0.18 + 0.08 * Math.abs(Math.sin(n * 3.7));
    add(k, 0.03, t => { const x = rand(); const y = x - prev; prev = x; return amp * y * Math.exp(-t / 0.005); });
  });
  // Send: a quick upward "pop".
  tl.sends.forEach(at => add(at, 0.12, t => 0.32 * Math.sin(2 * Math.PI * (420 * t + 2600 * t * t)) * Math.exp(-t / 0.035)));
  // Claude starts answering: two soft notes.
  tl.replies.forEach(at => {
    add(at, 0.25, t => 0.14 * Math.sin(2 * Math.PI * 660 * t) * Math.exp(-t / 0.06));
    add(at + 0.09, 0.3, t => 0.14 * Math.sin(2 * Math.PI * 990 * t) * Math.exp(-t / 0.08));
  });
  // End card: a little chord.
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    add(tl.end + i * 0.06, 1.6, t => 0.09 * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.45)));

  const buf = Buffer.alloc(44 + pcm.length * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + pcm.length * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(pcm.length * 2, 40);
  pcm.forEach((v, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  return buf;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto(pathToFileURL(path.join(__dirname, "index.html")).href + "?render");
  await page.evaluate(() => document.fonts.ready);
  const tl = await page.evaluate(() => window.TIMELINE);

  const wav = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "claude-video-")), "sfx.wav");
  fs.writeFileSync(wav, makeAudio(tl));

  const ffmpeg = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(FPS), "-i", "-",
    "-i", wav,
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", OUT,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((ok, fail) => ffmpeg.on("close", c => (c ? fail(new Error("ffmpeg exited " + c)) : ok())));

  const frames = Math.ceil(tl.duration * FPS);
  for (let f = 0; f < frames; f++) {
    await page.evaluate(t => window.render(t), f / FPS);
    const jpg = await page.screenshot({ type: "jpeg", quality: 95 });
    if (!ffmpeg.stdin.write(jpg)) await new Promise(r => ffmpeg.stdin.once("drain", r));
    if (f % FPS === 0) process.stdout.write(`\rframe ${f}/${frames}`);
  }
  ffmpeg.stdin.end();
  await done;
  await browser.close();
  console.log(`\nwrote ${OUT} (${tl.duration.toFixed(1)}s)`);
})();
