// GPU proof for the shader minifier (plans/T02-glslmin.md, M3). Owner: T02.
//
//   node tools/glslmin/browser-test.mjs            run the corpus; exit 1 on any failure
//   node tools/glslmin/browser-test.mjs --dump     also write every assembled shader to .tmp/T02/
//   node tools/glslmin/browser-test.mjs --png      also write each reference image to shots/T02/
//
// For every program in the corpus (src/common.glsl, read fresh, plus tests/glslmin/fixtures/), these
// variants are compiled, linked and drawn in Chromium on the GPU with fixed uniforms, attributes and
// textures: the original text, the strip-only text, the renamed text (renamed and pruned, the
// default), and the renamed text joined to the common chunk with no newline ("tight"). Shaders are
// assembled as prog() in src/gl.ts does, with the header read from that file. Every minified variant
// must compile, link and give bit-identical pixels to the original in a float target. A mutant (one
// literal changed in the renamed text) must differ, to show the comparison can fail.
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { minifyShaders } from './index.mjs';
import { loadCorpus, assemble, ROOT, COMMON } from './corpus.mjs';
import { launchGpu } from './chromium.mjs';
import { lex, isPlainFloat } from './lex.mjs';

const W = 160, H = 120;

/** Runs in the page. Everything it needs comes in `job`. */
function gpuRun(job) {
  const { W, H, programs } = job;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const gl = canvas.getContext('webgl2', { antialias: false });
  if (!gl) return { error: 'no WebGL2' };
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const cbf = gl.getExtension('EXT_color_buffer_float');
  const floatBlend = gl.getExtension('EXT_float_blend');
  if (!cbf) return { error: 'no EXT_color_buffer_float', renderer };
  const format = floatBlend ? gl.RGBA32F : gl.RGBA16F;

  // Render target: float colour plus depth.
  const colour = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, colour);
  gl.texStorage2D(gl.TEXTURE_2D, 1, format, W, H);
  const depth = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, W, H);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colour, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return { error: 'fbo incomplete', renderer };
  gl.viewport(0, 0, W, H);

  // Deterministic numbers.
  let seed = 12345;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

  // The uniform block F (architecture.md 10.2): 16 + 12 * 4 floats.
  const camX = 2048, camY = 120, camZ = 2048, pitch = -0.25, fovy = Math.PI / 3, aspect = W / H;
  const cp = Math.cos(pitch), sp = Math.sin(pitch), t = Math.tan(fovy / 2);
  // View (row-major rows), camera at (0, camY, 0) in render space, yaw 0 looking down -z.
  const V = [[1, 0, 0, 0], [0, cp, sp, -cp * camY], [0, -sp, cp, sp * camY], [0, 0, 0, 1]];
  const near = 1, far = 5000;
  const P = [[1 / (t * aspect), 0, 0, 0], [0, 1 / t, 0, 0],
    [0, 0, -(far + near) / (far - near), -2 * far * near / (far - near)], [0, 0, -1, 0]];
  const ub = new Float32Array(64);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += P[r][k] * V[k][c];
    ub[c * 4 + r] = s; // column-major
  }
  ub.set([camX, camY, camZ, 0], 16);                 // uCam
  ub.set([12.5, 12.5 / 256, 17, 0.6], 20);           // uTime
  ub.set([W, H, 2, 1], 24);                          // uRes
  ub.set([1500, 1950, 0.0012, 1.0], 28);             // uFade
  ub.set([1, 0, 0, t * aspect], 32);                 // uRight
  ub.set([0, cp, sp, t], 36);                        // uUp
  ub.set([0, sp, -cp, 0], 40);                       // uFwd
  const sun = [0.3, 0.12, -1], sl = Math.hypot(...sun);
  ub.set([sun[0] / sl, sun[1] / sl, sun[2] / sl, 0], 44); // uSun
  ub.set([0.8, 0.5, 0.3, 1], 48);                    // uMix
  ub.set([0.7, 0, 0, 0], 52);                        // uMood
  ub.set([0.25, 0.5, 0.75, 1, 1, 2, 3, 4], 56);      // uX0, uX1
  const ubo = gl.createBuffer();
  gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
  gl.bufferData(gl.UNIFORM_BUFFER, ub, gl.STATIC_DRAW);
  gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo);

  // Per-instance attributes: location 0 anchor, location 1 size and seed.
  const N = 64;
  const inst = new Float32Array(N * 8);
  for (let i = 0; i < N; i++) {
    inst.set([camX + (rnd() - 0.5) * 700, 0, camZ - 60 - rnd() * 900, rnd(),
      5 + rnd() * 25, 20 + rnd() * 140, 5 + rnd() * 25, Math.floor(rnd() * 1000)], i * 8);
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW);
  for (let l = 0; l < 2; l++) {
    gl.enableVertexAttribArray(l);
    gl.vertexAttribPointer(l, 4, gl.FLOAT, false, 32, l * 16);
    gl.vertexAttribDivisor(l, 1);
  }
  const emptyVao = gl.createVertexArray();

  // Textures on units 0..3.
  const texData = new Uint8Array(64 * 64 * 4);
  for (let i = 0; i < texData.length; i++) texData[i] = Math.floor(rnd() * 256);
  for (let u = 0; u < 4; u++) {
    gl.activeTexture(gl.TEXTURE0 + u);
    const tx = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 64, 64, 0, gl.RGBA, gl.UNSIGNED_BYTE, texData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  }

  function build(vsText, fsText) {
    const sh = (type, text) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, text);
      gl.compileShader(s);
      return s;
    };
    const vs = sh(gl.VERTEX_SHADER, vsText), fs = sh(gl.FRAGMENT_SHADER, fsText);
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs);
    gl.linkProgram(p);
    return {
      p,
      vsOk: gl.getShaderParameter(vs, gl.COMPILE_STATUS),
      fsOk: gl.getShaderParameter(fs, gl.COMPILE_STATUS),
      linkOk: gl.getProgramParameter(p, gl.LINK_STATUS),
      logs: [gl.getShaderInfoLog(vs), gl.getShaderInfoLog(fs), gl.getProgramInfoLog(p)].filter((s) => s && s.trim()),
    };
  }

  function draw(prog, spec) {
    const p = prog.p;
    gl.useProgram(p);
    const bi = gl.getUniformBlockIndex(p, 'F');
    if (bi !== gl.INVALID_INDEX) gl.uniformBlockBinding(p, bi, 0);
    for (let u = 0; u < 8; u++) {
      const loc = gl.getUniformLocation(p, 'T' + u);
      if (loc) gl.uniform1i(loc, u);
    }
    const x0 = gl.getUniformLocation(p, 'X0');
    if (x0) gl.uniform4f(x0, 0.37, -1.25, 2.5, 0.125);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
    gl.clearBufferfv(gl.DEPTH, 0, [1]);
    if (spec.depth) { gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); } else gl.disable(gl.DEPTH_TEST);
    if (spec.cull) { gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); } else gl.disable(gl.CULL_FACE);
    if (spec.blend) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); } else gl.disable(gl.BLEND);
    if (spec.draw === 'tri') {
      gl.bindVertexArray(emptyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
      gl.bindVertexArray(vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, spec.verts, spec.instances);
    }
    const px = new Float32Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.FLOAT, px);
    const err = gl.getError();
    const bits = new Uint32Array(px.buffer);
    let lit = 0, hash = 2166136261;
    for (let i = 0; i < bits.length; i += 4) {
      if (bits[i] | bits[i + 1] | bits[i + 2] | bits[i + 3]) lit++;
      for (let c = 0; c < 4; c++) hash = Math.imul(hash ^ bits[i + c], 16777619) >>> 0;
    }
    return { bits, lit, hash, err };
  }

  // A look at a float image: |x| / (1 + |x|), gamma 2, flipped to top-down; NaN shows as green.
  function toPng(px) {
    const c2 = document.createElement('canvas');
    c2.width = W; c2.height = H;
    const ctx = c2.getContext('2d');
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const s = ((H - 1 - y) * W + x) * 4, d = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v = Math.abs(px[s + c]);
        img.data[d + c] = Number.isNaN(px[s + c]) ? (c === 1 ? 255 : 0) : Math.round(Math.sqrt(v / (1 + v)) * 255);
      }
      img.data[d + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c2.toDataURL('image/png');
  }

  const results = [];
  for (const spec of programs) {
    const row = { name: spec.name, variants: {} };
    let ref = null;
    for (const [variant, texts] of Object.entries(spec.variants)) {
      const b = build(texts.vs, texts.fs);
      const v = { vsOk: b.vsOk, fsOk: b.fsOk, linkOk: b.linkOk, logs: b.logs };
      if (b.linkOk && !spec.compileOnly) {
        const d = draw(b, spec);
        v.lit = d.lit; v.hash = d.hash.toString(16); v.glError = d.err;
        if (job.png && variant === 'original') v.png = toPng(new Float32Array(d.bits.buffer));
        if (!ref) ref = d.bits;
        else {
          let diff = 0;
          for (let i = 0; i < ref.length; i += 4) {
            if (ref[i] !== d.bits[i] || ref[i + 1] !== d.bits[i + 1] || ref[i + 2] !== d.bits[i + 2] || ref[i + 3] !== d.bits[i + 3]) diff++;
          }
          v.diffPixels = diff;
        }
      }
      row.variants[variant] = v;
    }
    results.push(row);
  }
  return { renderer, format: format === gl.RGBA32F ? 'RGBA32F' : 'RGBA16F', results };
}

/** Every .glsl under src/ and dev/, path -> text. */
function realSources() {
  const out = {};
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.glsl')) out[relative(ROOT, p).split(sep).join('/')] = readFileSync(p, 'utf8');
    }
  };
  walk(join(ROOT, 'src'));
  walk(join(ROOT, 'dev'));
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** The renamed text with its first float literal changed, for the negative control. */
function mutate(text) {
  const toks = lex(text);
  const t = toks.find((x) => x.t === 'num' && isPlainFloat(x.v));
  const at = text.indexOf(t.v);
  return text.slice(0, at) + t.v + '7' + text.slice(at + t.v.length);
}

async function main() {
  const dump = process.argv.includes('--dump');
  const png = process.argv.includes('--png');
  const { sources, programs } = loadCorpus();
  const renamed = minifyShaders(sources);
  const stripped = minifyShaders(sources, { rename: false });
  const jobs = programs.map((p) => {
    const variants = {
      original: assemble(sources, p),
      strip: assemble(stripped.out, p),
      renamed: assemble(renamed.out, p),
      tight: assemble(renamed.out, p, ''), // renamed, with nothing between common and body
    };
    if (p.name === 'boxes') {
      const fsBody = { ...renamed.out, [p.fs]: mutate(renamed.out[p.fs]) };
      variants.mutant = assemble(fsBody, p);
    }
    return { ...p, variants };
  });

  // Real shaders on disk (src/ and dev/, read-only here): every file minified in one call as
  // scripts/lib/bundle.mjs does, each built as prog(file, file). Compile and link only.
  const real = realSources();
  const realMin = minifyShaders(real);
  for (const path of Object.keys(real)) {
    if (path === COMMON) continue;
    const p = { vs: path, fs: path };
    jobs.push({ name: path, compileOnly: true, variants: { original: assemble(real, p), renamed: assemble(realMin.out, p) } });
  }
  if (dump) {
    const dir = join(ROOT, '.tmp', 'T02', 'assembled');
    mkdirSync(dir, { recursive: true });
    for (const j of jobs) for (const [v, t] of Object.entries(j.variants)) {
      writeFileSync(join(dir, `${j.name}.${v}.vert`), t.vs);
      writeFileSync(join(dir, `${j.name}.${v}.frag`), t.fs);
    }
    console.log(`assembled shaders written to ${dir}`);
  }

  const { browser, executablePath } = await launchGpu();
  let res;
  try {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
    await page.goto('about:blank');
    res = await page.evaluate(gpuRun, { W, H, programs: jobs, png });
    res.consoleErrors = consoleErrors;
  } finally {
    await browser.close();
  }

  console.log(`chromium: ${executablePath}`);
  console.log(`renderer: ${res.renderer}`);
  if (res.error) { console.log(`FAIL: ${res.error}`); process.exit(1); }
  console.log(`target:   ${res.format} ${W}x${H}, compared bit for bit`);
  let failures = 0;
  for (const row of res.results) {
    for (const [name, v] of Object.entries(row.variants)) {
      const built = v.vsOk && v.fsOk && v.linkOk;
      let verdict;
      const job = jobs.find((j) => j.name === row.name);
      if (job.compileOnly) {
        const o = row.variants.original;
        const origOk = o.vsOk && o.fsOk && o.linkOk;
        if (name === 'original') verdict = origOk ? 'ok (compiles)' : 'NOTE (the original does not build; not a minifier result)';
        else verdict = !origOk ? 'skipped (original does not build)' : built ? 'ok (compiles and links)' : 'FAIL (compile/link)';
      } else if (name === 'mutant') verdict = built && v.diffPixels > 0 ? 'ok (differs, gate can fail)' : 'FAIL (mutant not detected)';
      else if (!built) verdict = 'FAIL (compile/link)';
      else if (v.glError) verdict = `FAIL (gl error ${v.glError})`;
      else if (name === 'original') verdict = v.lit > 0 ? 'ok (reference)' : 'FAIL (reference drew nothing)';
      else verdict = v.diffPixels === 0 ? 'ok (identical)' : `FAIL (${v.diffPixels} pixels differ)`;
      if (verdict.startsWith('FAIL')) failures++;
      console.log(`${row.name.padEnd(9)} ${name.padEnd(9)} compile ${v.vsOk ? 'y' : 'n'}${v.fsOk ? 'y' : 'n'} link ${v.linkOk ? 'y' : 'n'}` +
        `  lit ${String(v.lit ?? '-').padStart(5)}/${W * H}  hash ${String(v.hash ?? '-').padStart(8)}` +
        `  diff ${String(v.diffPixels ?? '-').padStart(5)}  ${verdict}`);
      for (const log of v.logs) console.log(`    log: ${log.trim().replace(/\n/g, '\n         ')}`);
      if (v.png) {
        const dir = join(ROOT, 'shots', 'T02');
        mkdirSync(dir, { recursive: true });
        const file = join(dir, `${row.name}.png`);
        writeFileSync(file, Buffer.from(v.png.split(',')[1], 'base64'));
        console.log(`    image: ${file}`);
      }
    }
  }
  for (const e of res.consoleErrors) console.log(`console ${e}`);
  console.log(failures ? `FAIL: ${failures} check(s) failed` : `PASS: ${res.results.length} programs, every variant compiled, linked and matched`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
