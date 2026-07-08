import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

// Geometry constants for the SVG hourglass (viewBox 0 0 400 600)
const CX = 200; // horizontal center of the glass
const NECK_Y = 294; // where the two bulbs meet
const TOP_FULL_Y = 148; // sand surface when the top bulb is full
const TOP_EMPTY_Y = 290; // sand surface when the top bulb is empty
const FLOOR_Y = 488; // inside floor of the bottom bulb
const PEAK_MAX_RISE = 132; // how tall the finished pile gets
const SVG_NS = "http://www.w3.org/2000/svg";

const DEFAULT_DURATIONS = [
  { label: "30s", secs: 30 },
  { label: "5 min", secs: 300 },
  { label: "25 min", secs: 1500 },
];

// Half-width of the top bulb interior at a given y. Matches the clip path
// closely enough that overdrawn sand gets trimmed by the clip.
function topHalfWidth(y) {
  const t = Math.min(Math.max((y - 98) / (288 - 98), 0), 1);
  return 80 * (1 - t * t * 0.92) + 7; // wide up high, ~7px at the neck
}

const pilePeakY = (p) => FLOOR_Y - PEAK_MAX_RISE * Math.pow(p, 0.7);
const pileHalfWidth = (p) => 26 + 118 * Math.pow(p, 0.55);

export default function HourglassTimer({
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

    const level = TOP_FULL_Y + (TOP_EMPTY_Y - TOP_FULL_Y) * p;
    const dip = 14 + 26 * Math.min(p * 2.5 + 0.15, 1); // crater deepens as it drains
    const hw = topHalfWidth(level) + 20; // overdraw; clip trims it

    topSand.setAttribute(
      "d",
      `M ${CX - hw} ${level}
       C ${CX - hw * 0.4} ${level}, ${CX - 16} ${level + dip * 0.55}, ${CX} ${level + dip}
       C ${CX + 16} ${level + dip * 0.55}, ${CX + hw * 0.4} ${level}, ${CX + hw} ${level}
       L ${CX + hw} ${NECK_Y + 8} L ${CX - hw} ${NECK_Y + 8} Z`
    );
    craterShade.setAttribute(
      "d",
      `M ${CX - 22} ${level + dip * 0.35}
       Q ${CX} ${level + dip + 6} ${CX + 22} ${level + dip * 0.35}
       Q ${CX} ${level + dip * 0.8} ${CX - 22} ${level + dip * 0.35} Z`
    );
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
    const peak = pilePeakY(p);
    const hw = pileHalfWidth(p);
    const shoulder = peak + (FLOOR_Y - peak) * 0.42;

    pile.setAttribute(
      "d",
      `M ${CX - hw} ${FLOOR_Y + 4}
       Q ${CX - hw * 0.42} ${shoulder}, ${CX} ${peak}
       Q ${CX + hw * 0.42} ${shoulder}, ${CX + hw} ${FLOOR_Y + 4} Z`
    );
    pileShade.setAttribute(
      "d",
      `M ${CX - hw * 0.5} ${FLOOR_Y + 4}
       Q ${CX - hw * 0.18} ${shoulder + 8}, ${CX} ${peak + 4}
       L ${CX} ${FLOOR_Y + 4} Z`
    );
  };

  const drawStream = (p) => {
    const stream = streamRef.current;
    if (!stream) return;
    if (p <= 0 || p >= 1 || !runningRef.current) {
      stream.setAttribute("d", "");
      return;
    }
    const bottom = pilePeakY(p) + 4;
    stream.setAttribute(
      "d",
      `M ${CX - 2.4} ${NECK_Y - 6} L ${CX + 2.4} ${NECK_Y - 6}
       L ${CX + 1.1} ${bottom} L ${CX - 1.1} ${bottom} Z`
    );
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

    const g = document.createElementNS(SVG_NS, "circle");
    const r = 0.9 + Math.random() * 1.1;
    const x0 = CX + (Math.random() * 5 - 2.5);
    g.setAttribute("cx", x0);
    g.setAttribute("cy", NECK_Y - 4);
    g.setAttribute("r", r);
    g.setAttribute("fill", Math.random() < 0.5 ? "#d7b26b" : "#b08948");
    grains.appendChild(g);

    const landY = pilePeakY(progressRef.current.p) + Math.random() * 8;
    gsap.to(g, {
      attr: { cy: landY, cx: x0 + (Math.random() * 8 - 4) },
      duration: 0.36 + Math.random() * 0.2,
      ease: "power2.in", // gravity: accelerate on the way down
      onComplete: () => {
        // a brief scatter on impact, then absorb into the pile
        gsap.to(g, {
          attr: { cx: x0 + (Math.random() * 22 - 11), cy: landY + 3 },
          opacity: 0,
          duration: 0.22,
          ease: "power1.out",
          onComplete: () => g.remove(),
        });
      },
    });
  };

  // Grains tumbling down the crater walls inside the top bulb
  const spawnTopGrain = () => {
    const topGrains = topGrainsRef.current;
    if (!topGrains || reduceMotionRef.current) return;

    const level = TOP_FULL_Y + (TOP_EMPTY_Y - TOP_FULL_Y) * progressRef.current.p;
    const g = document.createElementNS(SVG_NS, "circle");
    const side = Math.random() < 0.5 ? -1 : 1;
    const x0 = CX + side * (10 + Math.random() * 24);
    g.setAttribute("cx", x0);
    g.setAttribute("cy", level + 4 + Math.random() * 8);
    g.setAttribute("r", 0.8 + Math.random());
    g.setAttribute("fill", "#8f6a33");
    topGrains.appendChild(g);

    gsap.to(g, {
      attr: { cx: CX + side * 2, cy: NECK_Y - 2 },
      duration: 0.5 + Math.random() * 0.3,
      ease: "power1.in",
      opacity: 0.2,
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
    // the pile settles with a tiny shrug
    if (pileRef.current) {
      gsap.fromTo(
        pileRef.current,
        { scaleY: 1.02, transformOrigin: "200px 488px" },
        { scaleY: 1, duration: 0.5, ease: "elastic.out(1, 0.5)" }
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
      duration: 0.9,
      ease: "power2.inOut",
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
      if (grainClock > 80) {
        grainClock = 0;
        spawnGrain();
      }
      if (topGrainClock > 220) {
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
      padding: "32px 16px",
      background: "radial-gradient(120% 90% at 50% 20%, #2b241a, #1d1913 70%)",
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      color: "#efe6d4",
    },
    glassWrap: {
      width: "min(340px, 78vw)",
      filter: "drop-shadow(0 24px 40px rgba(0,0,0,.45))",
    },
    clock: {
      fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
      fontSize: 34,
      fontWeight: 500,
      letterSpacing: "0.06em",
      fontVariantNumeric: "tabular-nums",
      color: status === "done" ? "#e8b45a" : "#efe6d4",
    },
    controls: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
      justifyContent: "center",
    },
    chip: (active) => ({
      appearance: "none",
      border: `1px solid ${active ? "#c9a35e" : "rgba(239,230,212,.22)"}`,
      background: active ? "#c9a35e" : "rgba(239,230,212,.04)",
      color: active ? "#221a0e" : "#9c8f77",
      fontWeight: active ? 600 : 400,
      borderRadius: 999,
      padding: "8px 16px",
      fontSize: 14,
      fontFamily: "inherit",
      cursor: "pointer",
    }),
    btn: (primary) => ({
      appearance: "none",
      border: `1px solid ${primary ? "#e8b45a" : "rgba(239,230,212,.22)"}`,
      background: primary ? "#e8b45a" : "rgba(239,230,212,.04)",
      color: primary ? "#221a0e" : "#9c8f77",
      fontWeight: primary ? 600 : 400,
      borderRadius: 999,
      padding: "8px 16px",
      fontSize: 14,
      fontFamily: "inherit",
      cursor: "pointer",
    }),
  };

  return (
    <div style={styles.stage}>
      <div style={styles.glassWrap} ref={glassWrapRef}>
        <svg
          viewBox="0 0 400 600"
          role="img"
          aria-label="Hourglass with sand draining from the top bulb to the bottom bulb"
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          <defs>
            <linearGradient id="hg-wood" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#8a5c26" />
              <stop offset=".18" stopColor="#d9ab63" />
              <stop offset=".5" stopColor="#c89a52" />
              <stop offset=".82" stopColor="#9a6c30" />
              <stop offset="1" stopColor="#7c521f" />
            </linearGradient>
            <linearGradient id="hg-woodTop" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e3b76e" />
              <stop offset="1" stopColor="#b1813d" />
            </linearGradient>
            <linearGradient id="hg-sandFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#d7b26b" />
              <stop offset="1" stopColor="#a97f3f" />
            </linearGradient>
            <linearGradient id="hg-glassSheen" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ffffff" stopOpacity=".28" />
              <stop offset=".22" stopColor="#ffffff" stopOpacity=".05" />
              <stop offset=".78" stopColor="#ffffff" stopOpacity=".03" />
              <stop offset="1" stopColor="#ffffff" stopOpacity=".22" />
            </linearGradient>

            {/* Interior of the top bulb: everything sandy up top clips to this */}
            <clipPath id="hg-clipTop">
              <path
                d="M 120 98
                   C 120 196, 154 252, 193 288
                   L 193 300 L 207 300 L 207 288
                   C 246 252, 280 196, 280 98 Z"
              />
            </clipPath>

            {/* Interior of the bottom bulb */}
            <clipPath id="hg-clipBottom">
              <path
                d="M 193 300 L 207 300
                   C 246 336, 280 392, 280 490
                   L 120 490
                   C 120 392, 154 336, 193 300 Z"
              />
            </clipPath>
          </defs>

          {/* soft contact shadow under the base */}
          <ellipse cx="200" cy="556" rx="132" ry="14" fill="#000" opacity=".35" />

          {/* sand: bottom pile */}
          <g clipPath="url(#hg-clipBottom)">
            <path ref={pileRef} fill="url(#hg-sandFill)" d="" />
            <path ref={pileShadeRef} fill="#8f6a33" opacity=".35" d="" />
          </g>

          {/* sand: falling stream + particles */}
          <g>
            <path ref={streamRef} fill="#c9a35e" opacity=".9" d="" />
            <g ref={grainsRef} />
          </g>

          {/* sand: top reservoir with funnel crater */}
          <g clipPath="url(#hg-clipTop)">
            <path ref={topSandRef} fill="url(#hg-sandFill)" d="" />
            <path ref={craterShadeRef} fill="#8f6a33" opacity=".4" d="" />
            <g ref={topGrainsRef} />
          </g>

          {/* glass body tint */}
          <path
            d="M 116 96
               C 116 198, 152 254, 191 290
               C 152 326, 116 382, 116 492
               L 284 492
               C 284 382, 248 326, 209 290
               C 248 254, 284 198, 284 96 Z"
            fill="url(#hg-glassSheen)"
          />
          {/* glass walls */}
          <path
            d="M 116 96 C 116 198, 152 254, 191 290 C 152 326, 116 382, 116 492"
            fill="none"
            stroke="#f4efe6"
            strokeOpacity=".65"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M 284 96 C 284 198, 248 254, 209 290 C 248 326, 284 382, 284 492"
            fill="none"
            stroke="#f4efe6"
            strokeOpacity=".65"
            strokeWidth="5"
            strokeLinecap="round"
          />
          {/* inner edge glints */}
          <path
            d="M 128 108 C 128 190, 158 244, 190 276"
            fill="none"
            stroke="#ffffff"
            strokeOpacity=".5"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M 128 476 C 130 404, 156 348, 186 316"
            fill="none"
            stroke="#ffffff"
            strokeOpacity=".35"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* wooden caps */}
          <g>
            <rect x="72" y="66" width="256" height="30" rx="14" fill="url(#hg-wood)" />
            <ellipse cx="200" cy="66" rx="128" ry="17" fill="url(#hg-woodTop)" />
            <ellipse cx="200" cy="63" rx="112" ry="12" fill="#c9985077" />
          </g>
          <g>
            <rect x="72" y="486" width="256" height="30" rx="14" fill="url(#hg-wood)" />
            <ellipse cx="200" cy="516" rx="128" ry="17" fill="url(#hg-wood)" />
            <ellipse cx="200" cy="486" rx="128" ry="16" fill="url(#hg-woodTop)" />
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
      <p style={{ fontSize: 13, color: "#9c8f77" }}>
        The glass flips itself over when the sand runs out.
      </p>
    </div>
  );
}
