import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

// Retro pixel-art hourglass. Everything snaps to a 12px grid inside a
// 400x600 viewBox: stepped glass walls, flat colors, square grains.
const PX = 12; // one art "pixel"
const HALF = PX / 2;
const CX = 200; // horizontal center of the glass
const GLASS_TOP = 108; // glass meets the top cap here
const NECK_TOP = 276; // first of the two pinch rows
const FLOOR_Y = 468; // interior floor (top of bottom cap)
const TOP_FULL_Y = 132; // sand surface when the top bulb is full
const PEAK_MAX_RISE = 132; // how tall the finished pile gets
const SVG_NS = "http://www.w3.org/2000/svg";

const PALETTE = {
  outline: "#7a4a28",
  wood: "#a26b3b",
  woodLight: "#bd8a52",
  interior: "#f6efdc",
  sand: "#ddc48f",
  sandDark: "#c9ab72",
  stream: "#d2b67f",
};

const GRAIN_COLORS = ["#d6ba82", "#cbb076", "#e0cb99", "#c2a468"];

const DEFAULT_DURATIONS = [
  { label: "30s", secs: 30 },
  { label: "5 min", secs: 300 },
  { label: "25 min", secs: 1500 },
];

const snap = (v) => Math.round(v / PX) * PX;
// Half-widths are always HALF + PX*k so a single cell sits centered on CX.
const quantHW = (v) => HALF + PX * Math.max(0, Math.round((v - HALF) / PX));

// Bulb profile in cells, one entry per row: short vertical walls under the
// cap, then a straight 45-degree staircase (one cell per row) to the neck.
const TOP_KS = [11, 11, 11, 11, 10, 10, 9, 8, 7, 6, 5, 4, 3, 2];

// One row per 12px of glass height; out/inn are half-widths of the outer
// wall and the interior. The bottom bulb mirrors the top.
const ROWS = [...TOP_KS, 1, 1, ...[...TOP_KS].reverse()].map((k, i) => ({
  y: GLASS_TOP + i * PX,
  out: HALF + PX * k,
  inn: HALF + PX * (k - 1),
}));

const innerHW = (y) => ROWS[(y - GLASS_TOP) / PX]?.inn ?? HALF;

const cell = (x, y, w = PX, h = PX) => `M ${x} ${y} h ${w} v ${h} h ${-w} Z `;
const rowsToPath = (rows, key) =>
  rows.map((r) => cell(CX - r[key], r.y, r[key] * 2)).join("");

const GLASS_OUTLINE_D = rowsToPath(ROWS, "out");
const GLASS_INTERIOR_D = rowsToPath(ROWS, "inn");
const CLIP_TOP_D = rowsToPath(ROWS.slice(0, 16), "inn"); // top bulb + neck
const CLIP_BOTTOM_D = rowsToPath(ROWS.slice(14), "inn"); // neck + bottom bulb

// A one-cell white glint hugging the left interior wall of each bulb
const SHEEN_D = ROWS.filter(
  (r) => (r.y >= 120 && r.y <= 252) || (r.y >= 324 && r.y <= 444)
)
  .map((r) => cell(CX - r.inn, r.y))
  .join("");

const pilePeakY = (p) => FLOOR_Y - PEAK_MAX_RISE * Math.pow(p, 0.7);
const sandLevelY = (p) => snap(TOP_FULL_Y + (NECK_TOP - TOP_FULL_Y) * p);

const grainColor = () =>
  GRAIN_COLORS[Math.floor(Math.random() * GRAIN_COLORS.length)];

export default function Tomato({
  durations = DEFAULT_DURATIONS,
  defaultDuration = 1500,
  autoFlip = true,
  onComplete,
}) {
  const [durationSecs, setDurationSecs] = useState(defaultDuration);
  const [status, setStatus] = useState("idle"); // idle | running | paused | done

  // Everything the animation touches at 60fps lives in refs. Putting p or the
  // clock text in useState would re-render the component on every tick.
  const glassWrapRef = useRef(null);
  const topSandRef = useRef(null);
  const craterShadeRef = useRef(null);
  const pileRef = useRef(null);
  const pileShadeRef = useRef(null);
  const streamRef = useRef(null);
  const grainsRef = useRef(null);
  const topGrainsRef = useRef(null);
  const clockRef = useRef(null);

  const progressRef = useRef({ p: 0 });
  const tweenRef = useRef(null);
  const runningRef = useRef(false);
  const durationRef = useRef(defaultDuration);
  const reduceMotionRef = useRef(false);

  durationRef.current = durationSecs;

  // ---------- drawing ----------

  const drawTopSand = (p) => {
    const topSand = topSandRef.current;
    const craterShade = craterShadeRef.current;
    if (!topSand || !craterShade) return;

    const level = sandLevelY(p);
    let d = "";
    for (let y = level; y < NECK_TOP; y += PX) {
      const hw = innerHW(y);
      d += cell(CX - hw, y, hw * 2);
    }
    topSand.setAttribute("d", d);

    // crater: a stepped V notch carved out of the surface, one cell deeper
    // per step, deepening as the bulb drains
    const dip = Math.min(3, 1 + Math.floor(p * 4));
    let notch = "";
    for (let k = 0; k < dip; k++) {
      const y = level + k * PX;
      if (y >= NECK_TOP) break;
      const hw = Math.min(HALF + PX * (dip - 1 - k), innerHW(y));
      notch += cell(CX - hw, y, hw * 2);
    }
    craterShade.setAttribute("d", notch);

    const empty = p >= 1;
    topSand.style.display = empty ? "none" : "";
    craterShade.style.display = empty ? "none" : "";
  };

  const drawPile = (p) => {
    const pile = pileRef.current;
    const pileShade = pileShadeRef.current;
    if (!pile || !pileShade) return;

    if (p <= 0.004) {
      pile.setAttribute("d", "");
      pileShade.setAttribute("d", "");
      return;
    }
    const peak = Math.min(snap(pilePeakY(p)), FLOOR_Y - PX);
    const baseHW = Math.min(
      quantHW(26 + 118 * Math.pow(p, 0.55)),
      innerHW(FLOOR_Y - PX)
    );
    const span = FLOOR_Y - PX - peak;

    let d = "";
    let shade = "";
    for (let y = peak; y < FLOOR_Y; y += PX) {
      const t = span ? (y - peak) / span : 1;
      const hw = Math.min(quantHW(HALF + (baseHW - HALF) * t), innerHW(y));
      d += cell(CX - hw, y, hw * 2);
      if (hw >= HALF + PX) shade += cell(CX + hw - PX, y); // shaded right slope
    }
    pile.setAttribute("d", d);
    pileShade.setAttribute("d", shade);
  };

  const drawStream = (p) => {
    const stream = streamRef.current;
    if (!stream) return;
    if (p <= 0 || p >= 1 || !runningRef.current) {
      stream.setAttribute("d", "");
      return;
    }
    // dotted column of cells; the alternating phase makes the dots march
    const bottom = snap(pilePeakY(p));
    const phase = Math.floor(Date.now() / 90) % 2;
    let d = "";
    for (let y = NECK_TOP; y < bottom; y += PX) {
      if ((y / PX + phase) % 2 === 0) d += cell(CX - HALF, y);
    }
    stream.setAttribute("d", d);
  };

  const render = () => {
    const p = progressRef.current.p;
    drawTopSand(p);
    drawPile(p);
    drawStream(p);
    if (clockRef.current) {
      const remaining = Math.max(0, Math.ceil(durationRef.current * (1 - p)));
      const m = String(Math.floor(remaining / 60)).padStart(2, "0");
      const s = String(remaining % 60).padStart(2, "0");
      clockRef.current.textContent = `${m}:${s}`;
    }
  };

  // ---------- falling grains ----------

  const spawnGrain = () => {
    const grains = grainsRef.current;
    if (!grains || reduceMotionRef.current) return;

    const count = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const g = document.createElementNS(SVG_NS, "rect");
      const x0 = CX - HALF + HALF * Math.floor(Math.random() * 2);
      g.setAttribute("x", x0);
      g.setAttribute("y", NECK_TOP + HALF * Math.floor(Math.random() * 4));
      g.setAttribute("width", HALF);
      g.setAttribute("height", HALF);
      g.setAttribute("fill", grainColor());
      grains.appendChild(g);

      const landY = snap(pilePeakY(progressRef.current.p)) - HALF;
      gsap.to(g, {
        attr: { y: landY },
        duration: 0.3 + Math.random() * 0.2,
        ease: `steps(${5 + Math.floor(Math.random() * 4)})`, // chunky descent
        onComplete: () => {
          // a one-step sideways hop on impact, then absorb into the pile
          gsap.to(g, {
            attr: { x: x0 + (Math.random() < 0.5 ? -PX : PX), y: landY + HALF },
            opacity: 0,
            duration: 0.16,
            ease: "steps(2)",
            onComplete: () => g.remove(),
          });
        },
      });
    }
  };

  // Grains tumbling down the crater walls inside the top bulb
  const spawnTopGrain = () => {
    const topGrains = topGrainsRef.current;
    if (!topGrains || reduceMotionRef.current) return;

    const level = sandLevelY(progressRef.current.p);
    const g = document.createElementNS(SVG_NS, "rect");
    const side = Math.random() < 0.5 ? -1 : 1;
    const x0 = CX + side * (PX + HALF * Math.floor(Math.random() * 5));
    g.setAttribute("x", x0);
    g.setAttribute("y", Math.min(level + PX, NECK_TOP - PX));
    g.setAttribute("width", HALF);
    g.setAttribute("height", HALF);
    g.setAttribute("fill", grainColor());
    topGrains.appendChild(g);

    gsap.to(g, {
      attr: { x: CX - HALF, y: NECK_TOP - HALF },
      duration: 0.5 + Math.random() * 0.3,
      ease: "steps(4)",
      opacity: 0.25,
      onComplete: () => g.remove(),
    });
  };

  // ---------- run control ----------

  const start = () => {
    if (progressRef.current.p >= 1) progressRef.current.p = 0;
    runningRef.current = true;
    setStatus("running");
    tweenRef.current?.kill();
    tweenRef.current = gsap.to(progressRef.current, {
      p: 1,
      duration: durationRef.current * (1 - progressRef.current.p),
      ease: "none", // sand drains at a constant rate
      onUpdate: render,
      onComplete: finish,
    });
  };

  const pause = () => {
    runningRef.current = false;
    setStatus("paused");
    tweenRef.current?.pause();
    render();
  };

  const resume = () => {
    runningRef.current = true;
    setStatus("running");
    tweenRef.current?.resume();
  };

  function finish() {
    runningRef.current = false;
    setStatus("done");
    render();
    // the pile settles with a single-step nudge
    if (pileRef.current) {
      gsap.fromTo(
        pileRef.current,
        { y: -HALF },
        { y: 0, duration: 0.25, ease: "steps(1)" }
      );
    }
    onComplete?.();
    if (autoFlip && !reduceMotionRef.current) gsap.delayedCall(0.9, flip);
  }

  function flip() {
    tweenRef.current?.kill();
    runningRef.current = false;
    gsap.to(glassWrapRef.current, {
      rotation: 180,
      duration: 0.8,
      ease: "steps(9)", // the flip snaps through frames like a sprite
      onComplete: () => {
        gsap.set(glassWrapRef.current, { rotation: 0 });
        progressRef.current.p = 0;
        grainsRef.current?.replaceChildren();
        topGrainsRef.current?.replaceChildren();
        render();
        start();
      },
    });
  }

  const selectDuration = (secs) => {
    tweenRef.current?.kill();
    runningRef.current = false;
    progressRef.current.p = 0;
    setDurationSecs(secs);
    durationRef.current = secs;
    setStatus("idle");
    grainsRef.current?.replaceChildren();
    topGrainsRef.current?.replaceChildren();
    render();
  };

  const handlePlayClick = () => {
    if (status === "running") pause();
    else if (status === "paused") resume();
    else start();
  };

  // ---------- lifecycle ----------

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Grain spawner. gsap.ticker gives us delta in ms and pauses with the tab,
    // so grains never pile up in a background tab.
    let grainClock = 0;
    let topGrainClock = 0;
    const tick = (_, delta) => {
      if (!runningRef.current || progressRef.current.p >= 1) return;
      grainClock += delta;
      topGrainClock += delta;
      if (grainClock > 60) {
        grainClock = 0;
        spawnGrain();
      }
      if (topGrainClock > 160) {
        topGrainClock = 0;
        spawnTopGrain();
      }
    };
    gsap.ticker.add(tick);
    render();

    return () => {
      gsap.ticker.remove(tick);
      tweenRef.current?.kill();
      gsap.killTweensOf(glassWrapRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- styles ----------

  const styles = {
    stage: {
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 20,
      padding: "48px 16px",
      boxSizing: "border-box",
      background: "#f6eedb",
      // concentric cream frames, like the reference art
      boxShadow:
        "inset 0 0 0 16px #e3d5b0, inset 0 0 0 40px #e9dec1, inset 0 0 0 72px #efe6cf",
      fontFamily: '"Press Start 2P", "Courier New", monospace',
      color: "#7b5b36",
    },
    glassWrap: {
      width: "min(320px, 74vw)",
    },
    clock: {
      fontSize: 26,
      letterSpacing: "0.08em",
      fontVariantNumeric: "tabular-nums",
      color: status === "done" ? "#a3612e" : "#6d4a28",
    },
    controls: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      flexWrap: "wrap",
      justifyContent: "center",
    },
    chip: (active) => ({
      appearance: "none",
      border: "3px solid #7a4a28",
      background: active ? "#a26b3b" : "#f4ecd9",
      color: active ? "#f7f0dd" : "#7b5b36",
      borderRadius: 0,
      padding: "10px 14px",
      fontSize: 10,
      fontFamily: "inherit",
      cursor: "pointer",
      boxShadow: active ? "2px 2px 0 #5f3a1e" : "4px 4px 0 #7a4a28",
    }),
    btn: (primary) => ({
      appearance: "none",
      border: "3px solid #7a4a28",
      background: primary ? "#a3612e" : "#f4ecd9",
      color: primary ? "#f7f0dd" : "#7b5b36",
      borderRadius: 0,
      padding: "10px 14px",
      fontSize: 10,
      fontFamily: "inherit",
      cursor: "pointer",
      boxShadow: "4px 4px 0 #7a4a28",
    }),
  };

  return (
    <div style={styles.stage}>
      <div style={styles.glassWrap} ref={glassWrapRef}>
        <svg
          viewBox="0 0 400 600"
          role="img"
          aria-label="Pixel-art hourglass with sand draining from the top bulb to the bottom bulb"
          style={{ width: "100%", height: "auto", display: "block" }}
          shapeRendering="crispEdges"
        >
          <defs>
            {/* flat sand with a sparse two-dot dither */}
            <pattern
              id="tm-sand"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <rect width="24" height="24" fill={PALETTE.sand} />
              <rect width="6" height="6" fill={PALETTE.sandDark} />
              <rect x="12" y="12" width="6" height="6" fill={PALETTE.sandDark} />
            </pattern>
            <clipPath id="tm-clipTop">
              <path d={CLIP_TOP_D} />
            </clipPath>
            <clipPath id="tm-clipBottom">
              <path d={CLIP_BOTTOM_D} />
            </clipPath>
          </defs>

          {/* ground shadow: a single darker row under the base */}
          <rect x={38} y={516} width={324} height={PX} fill="#d9c79c" />

          {/* glass: dark stepped silhouette with the interior laid on top */}
          <path d={GLASS_OUTLINE_D} fill={PALETTE.outline} />
          <path d={GLASS_INTERIOR_D} fill={PALETTE.interior} />

          {/* sand: bottom pile */}
          <g clipPath="url(#tm-clipBottom)">
            <path ref={pileRef} fill="url(#tm-sand)" d="" />
            <path ref={pileShadeRef} fill={PALETTE.sandDark} d="" />
          </g>

          {/* sand: dotted falling stream + loose grains */}
          <path ref={streamRef} fill={PALETTE.stream} d="" />
          <g ref={grainsRef} />

          {/* sand: top reservoir with stepped crater */}
          <g clipPath="url(#tm-clipTop)">
            <path ref={topSandRef} fill="url(#tm-sand)" d="" />
            <path ref={craterShadeRef} fill={PALETTE.interior} d="" />
            <g ref={topGrainsRef} />
          </g>

          {/* glass glint down the left interior wall */}
          <path d={SHEEN_D} fill="#ffffff" opacity=".45" />

          {/* wooden caps: overhanging bars with end tabs, like the reference */}
          <g>
            <rect x={50} y={60} width={300} height={48} fill={PALETTE.outline} />
            <rect x={62} y={72} width={276} height={24} fill={PALETTE.wood} />
            <rect x={62} y={72} width={276} height={PX} fill={PALETTE.woodLight} />
            <rect x={50} y={108} width={24} height={PX} fill={PALETTE.outline} />
            <rect x={326} y={108} width={24} height={PX} fill={PALETTE.outline} />
          </g>
          <g>
            <rect x={50} y={468} width={300} height={48} fill={PALETTE.outline} />
            <rect x={62} y={480} width={276} height={24} fill={PALETTE.wood} />
            <rect x={62} y={480} width={276} height={PX} fill={PALETTE.woodLight} />
            <rect x={50} y={456} width={24} height={PX} fill={PALETTE.outline} />
            <rect x={326} y={456} width={24} height={PX} fill={PALETTE.outline} />
          </g>
        </svg>
      </div>

      <div style={styles.clock} ref={clockRef} aria-live="polite">
        25:00
      </div>

      <div style={styles.controls}>
        {durations.map((d) => (
          <button
            key={d.secs}
            style={styles.chip(durationSecs === d.secs)}
            aria-pressed={durationSecs === d.secs}
            onClick={() => selectDuration(d.secs)}
          >
            {d.label}
          </button>
        ))}
        <button style={styles.btn(true)} onClick={handlePlayClick}>
          {status === "running" ? "Pause" : status === "paused" ? "Resume" : "Start"}
        </button>
        <button style={styles.btn(false)} onClick={flip}>
          Flip &amp; restart
        </button>
      </div>
      <p style={{ fontSize: 10, color: "#967952", lineHeight: 1.8 }}>
        The glass flips itself over when the sand runs out.
      </p>
    </div>
  );
}
