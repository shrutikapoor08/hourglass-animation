import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import './Tomato.css';

const GRAIN_COUNT = 91090;
const MIN_GRAIN_RADIUS = 0.05;
const MAX_GRAIN_RADIUS = 1;
const GRAIN_COLORS = ['#d4a843', '#c89a3a', '#e0b452', '#cfa23f', '#ddd'];
const NECK_X = 100;

function topBulbHalfWidth(y) {
  return 88;
}

function bottomBulbHalfWidth(y) {
  return 88;
}

// Uniformly scatter grains throughout a container's interior. Used for the top
// bulb so it appears fully packed at the start. Grains are sorted smallest-y
// first (nearest the top surface) so the surface drains first — the sand level
// drops from the top down, matching gravity.
function fillContainer(minY, maxY, halfWidthFn) {
  const grains = [];
  for (let i = 0; i < GRAIN_COUNT; i++) {
    const finalY = minY + Math.random() * (maxY - minY);
    const halfW = Math.max(2, halfWidthFn(finalY) - 2);
    const finalX = NECK_X + (Math.random() * 2 - 1) * halfW;
    grains.push({
      finalX,
      finalY,
      radius: MIN_GRAIN_RADIUS + Math.random() * (MAX_GRAIN_RADIUS - MIN_GRAIN_RADIUS),
    });
  }
  grains.sort((a, b) => a.finalY - b.finalY);
  return grains;
}

// Builds a conical sandpile from center-floor upward. Grains are positioned
// within a cone (steeper than angle-of-repose so the triangular cross-section
// reads as 3-D) and ordered so index 0 lands first at the center floor,
// growing outward and upward until the full cone is formed.
function buildConePile(floorY, neckY, halfWidthFn) {
  const grains = [];
  const centerX = NECK_X;
  const slope = 0.2;          // y-rise per x-unit: larger = narrower/steeper cone
  const peakY = neckY + 3;   // cone tip just below the neck opening
  const coneH = floorY - peakY;

  for (let i = 0; i < GRAIN_COUNT; i++) {
    // sqrt gives area-uniform density (more samples toward wide base)
    const finalY = peakY + Math.sqrt(Math.random()) * coneH;
    const coneHalfW = (finalY - peakY) / slope;
    const glassHalfW = Math.max(2, halfWidthFn(finalY) - 2);
    const halfW = Math.min(coneHalfW, glassHalfW);
    const finalX = centerX + (Math.random() * 2 - 1) * halfW;

    grains.push({
      finalX,
      finalY,
      radius: MIN_GRAIN_RADIUS + Math.random() * (MAX_GRAIN_RADIUS - MIN_GRAIN_RADIUS),
    });
  }

  // D(x,y) = (floorY−y) + |x−center|×slope: the "cone wavefront distance."
  // Sorting ascending means any prefix of grains forms a V-shaped cone boundary,
  // so the pile visibly grows outward and upward as a cone, not a flat box.
  grains.sort((a, b) => {
    const da = (floorY - a.finalY) + Math.abs(a.finalX - centerX) * slope;
    const db = (floorY - b.finalY) + Math.abs(b.finalX - centerX) * slope;
    return da - db;
  });

  return grains;
}

// Discrete sandpile relaxation. Grains stack upward from floorY (y decreases
// with each layer). halfWidthFn keeps x within the container's curved wall at
// each grain's resulting height so the pile silhouette hugs the glass.
function buildContainerPile(floorY, halfWidthFn) {
  const numCols = 131;
  const minX = 0;
  const maxX = 200;
  const colWidth = (maxX - minX) / (numCols - 1);
  const centerCol = Math.floor(numCols / 2);
  const stepHeight = 0.05;

  const columns = new Array(numCols).fill(0);
  const grains = [];

  for (let i = 0; i < GRAIN_COUNT; i++) {
    let col = centerCol + Math.round((Math.random() - 0.25) * 16);
    col = Math.max(0, Math.min(numCols - 1, col));

    for (let iter = 0; iter < numCols; iter++) {
      const left = col > 0 ? columns[col - 1] : Infinity;
      const right = col < numCols - 1 ? columns[col + 1] : Infinity;
      const cur = columns[col];
      if (left < cur && left <= right) { col--; }
      else if (right < cur) { col++; }
      else break;
    }

    const layer = columns[col];
    columns[col]++;

    const rawX = minX + col * colWidth + (Math.random() - 0.5) * colWidth * 0.6;
    const finalY = floorY - layer * stepHeight + (Math.random() - 0.5) * 1.5;
    const halfW = Math.max(2, halfWidthFn(finalY) - 2);
    const finalX = Math.max(NECK_X - halfW, Math.min(NECK_X + halfW, rawX));

    grains.push({
      finalX,
      finalY,
      radius: MIN_GRAIN_RADIUS + Math.random() * (MAX_GRAIN_RADIUS - MIN_GRAIN_RADIUS),
    });
  }

  return grains;
}

export default function Tomato() {
  const grainRefs = useRef([]);
  const [minutes, setMinutes] = useState(5);
  const [started, setStarted] = useState(false);

  // Positions computed once: top pile is the starting state, bottom pile is
  // where each grain lands. Same sandpile algorithm, different container geometry.
  const { topPositions, bottomPositions } = useMemo(() => ({
    topPositions: fillContainer(10, 150, topBulbHalfWidth),
    bottomPositions: buildConePile(290, 150, bottomBulbHalfWidth),
  }), []);

  useEffect(() => {
    // Always reset grains to the top starting positions.
    topPositions.forEach((top, i) => {
      const el = grainRefs.current[i];
      if (el) gsap.set(el, { attr: { cx: top.finalX, cy: top.finalY } });
    });

    if (!started) return;

    const totalDuration = minutes * 60;
    const tl = gsap.timeline({ delay: 0.5 });

    // Per-grain animation phase durations.
    const grainMidDur  = 0.18;
    const grainDropDur = 0.16;
    const grainLandDur = 0.10;
    const maxTopFallDur = 0.08 + 0.3;
    const maxPerGrainDur = maxTopFallDur + grainMidDur + grainDropDur + grainLandDur;

    const fallSpan = totalDuration - maxPerGrainDur;

    topPositions.forEach((top, i) => {
      const bottom = bottomPositions[i];
      const el = grainRefs.current[i];
      if (!el) return;

      const startTime = (i / (GRAIN_COUNT - 1)) * fallSpan + (Math.random() - 0.5) * 0.05;
      const neckX = NECK_X + (Math.random() - 0.5) * 10;
      const midX = neckX + (Math.random() - 0.5) * 10;
      const midY = bottom.finalY - (bottom.finalY - 150) * (0.4 + Math.random() * 0.2);

      const dx = top.finalX - NECK_X;
      const dy = 150 - top.finalY;
      const topFallDur = 0.08 + 0.3 * Math.sqrt(dx * dx + dy * dy) / Math.sqrt(88 * 88 + 140 * 140);

      // Gravity compression: grains buried deeper get pushed further outward as
      // weight builds above them. depthFraction=1 for the first grain (deepest),
      // 0 for the last (surface). compressionDur fills the rest of the timer so
      // the pile visibly widens throughout the animation, not just at the end.
      const depthFraction = 1 - i / (GRAIN_COUNT - 1);
      const compressedX = bottom.finalX + (bottom.finalX - NECK_X) * 2.75 * depthFraction;
      const compressionDur = Math.max(0.2, totalDuration - startTime - topFallDur - grainMidDur - grainDropDur - grainLandDur);

      const grainTl = gsap.timeline();
      grainTl
        .to(el, { attr: { cx: neckX, cy: 150 }, duration: topFallDur, ease: 'power2.in' })
        .to(el, { attr: { cx: midX, cy: midY + 50 }, duration: grainMidDur, ease: 'power1.in' })
        .to(el, { attr: { cx: bottom.finalX, cy: bottom.finalY - 2 }, duration: grainDropDur, ease: 'power2.in' })
        .to(el, { attr: { cy: bottom.finalY - 4}, duration: grainLandDur, ease: 'bounce.out' })
        .to(el, { attr: { cx: compressedX }, duration: compressionDur, ease: 'power2.out' });

      tl.add(grainTl, startTime);
    });

    return () => { tl.kill(); };
  }, [topPositions, bottomPositions, minutes, started]);

  // Rounded dome top, smooth bezier taper to narrow neck — no flat edges, no gap
  const topPath = "M 100 10 C 155 10, 190 45, 190 82 C 190 120, 115 148, 108 150 L 92 150 C 85 148, 10 120, 10 82 C 10 45, 45 10, 100 10 Z";
  const bottomPath = "M 92 150 C 85 152, 10 180, 10 218 C 10 255, 45 290, 100 290 C 155 290, 190 255, 190 218 C 190 180, 115 152, 108 150 Z";

  return (
    <div className="tomato-wrapper">
      <div className="timer-controls">
        <button className="timer-btn" onClick={() => { setMinutes(m => Math.max(1, m - 1)); setStarted(false); }}>−</button>
        <span className="timer-label">{minutes} min</span>
        <button className="timer-btn" onClick={() => { setMinutes(m => m + 1); setStarted(false); }}>+</button>
      </div>
      <button className="start-btn" onClick={() => setStarted(true)} disabled={started}>
        Start
      </button>
      {/* viewBox extended: -12 left/right for pillars, -24 top / +24 bottom for disc platforms */}
      <svg viewBox="-12 -24 224 348" width="280" height="435" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="glass-interior-clip">
            <path d={topPath} />
            <path d={bottomPath} />
          </clipPath>

          {/* Pillar: horizontal gradient — lit on left, shadow on right */}
          <linearGradient id="pillar-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#B07838" />
            <stop offset="28%"  stopColor="#7A5020" />
            <stop offset="72%"  stopColor="#4A2E0E" />
            <stop offset="100%" stopColor="#1E0E04" />
          </linearGradient>

          {/* Platform front face: vertical gradient — lit on top, shadow on bottom */}
          <linearGradient id="platform-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#9B6830" />
            <stop offset="30%"  stopColor="#7A4E1E" />
            <stop offset="80%"  stopColor="#4A2C0C" />
            <stop offset="100%" stopColor="#221206" />
          </linearGradient>
        </defs>

        {/* Side pillars — behind glass */}
        <rect x="-6"  y="0"  width="10" height="300" rx="5" fill="url(#pillar-grad)" />
        <rect x="195" y="0"  width="10" height="300" rx="5" fill="url(#pillar-grad)" />

        {/* All grains */}
        <g clipPath="url(#glass-interior-clip)">
          {topPositions.map((pos, i) => (
            <circle
              key={i}
              ref={(el) => (grainRefs.current[i] = el)}
              cx={pos.finalX}
              cy={pos.finalY}
              r={pos.radius}
              fill={GRAIN_COLORS[i % GRAIN_COLORS.length]}
              opacity={1}
            />
          ))}
        </g>

        {/* Top glass bulb */}
        <path d={topPath} fill="rgba(180,220,255,0.10)" stroke="#aaa" strokeWidth="1.5" />

        {/* Bottom glass bulb */}
        <path d={bottomPath} fill="rgba(180,220,255,0.10)" stroke="#aaa" strokeWidth="1.5" />

        {/* Glass shine highlights */}
        <path d="M 42 22 Q 14 55 12 88 Q 10 122 34 148"
              fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="9" strokeLinecap="round" />
        <path d="M 34 152 Q 10 182 12 218 Q 14 252 40 278"
              fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="8" strokeLinecap="round" />

        {/* ── Top platform ── */}
        {/* Top face of disc (ellipse on top — catches most light) */}
        {/* <ellipse cx="100" cy="-7" rx="112" ry="7" fill="#C08840" /> */}
        {/* Front face of disc */}
        <rect x="-12" y="-6" width="224" height="16" rx="5" fill="url(#platform-grad)" />

        {/* ── Bottom platform ── */}
        {/* Top face of disc */}
        <ellipse cx="100" cy="298" rx="112" ry="7" fill="#B07830" />
        {/* Front face of disc */}
        <rect x="-12" y="298" width="224" height="16" rx="5" fill="url(#platform-grad)" />
        {/* Bottom edge shadow line */}
        <line x1="-7" y1="313" x2="207" y2="315" stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
      </svg>
    </div>
  );
}
