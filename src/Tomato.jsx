import { useEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import './Tomato.css';

const GRAIN_COUNT = 71090;
const MIN_GRAIN_RADIUS = 0.05;
const MAX_GRAIN_RADIUS = 1;
const GRAIN_COLORS = ['#d4a843', '#c89a3a', '#e0b452', '#cfa23f', '#ddd', '#444', '#ccf'];
const NECK_X = 100;
const TOTAL_DURATION = 7;

// Interior half-width of the top bulb at y.
// Rim (y=20): 38 → bulge (y=80): 84 → neck (y=148): 20
function topBulbHalfWidth(y) {
return 138;
}

// Interior half-width of the bottom bulb at y.
// Neck (y=152): 20 → bulge (y=220): 84 → rim (y=280): 38
function bottomBulbHalfWidth(y) {
  return 138;
}

// Uniformly scatter grains throughout a container's interior. Used for the top
// bulb so it appears fully packed at the start. Grains are sorted largest-y
// first (nearest the neck) so the lowest ones drain first, matching physics.
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
  grains.sort((a, b) => b.finalY - a.finalY);
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

  // Positions computed once: top pile is the starting state, bottom pile is
  // where each grain lands. Same sandpile algorithm, different container geometry.
  const { topPositions, bottomPositions } = useMemo(() => ({
    topPositions: fillContainer(20, 148, topBulbHalfWidth),
    bottomPositions: fillContainer(152, 282, bottomBulbHalfWidth),
  }), []);

  useEffect(() => {
    const tl = gsap.timeline({ delay: 0.5 });
    const fallSpan = TOTAL_DURATION - 0.6;

    // Grains near the neck (low index, placed first by buildContainerPile) fall
    // first — matching real hourglass physics where the bottom layer drains earliest.
    topPositions.forEach((top, i) => {
      const bottom = bottomPositions[i];
      const el = grainRefs.current[i];
      if (!el) return;

      const startTime = (i / (GRAIN_COUNT - 1)) * fallSpan + (Math.random() - 0.5) * 0.05;
      const neckX = NECK_X + (Math.random() - 0.5) * 10;
      const midX = neckX + (Math.random() - 0.5) * 10;
      const midY = bottom.finalY - (bottom.finalY - 150) * (0.4 + Math.random() * 0.2);

      // Grains far from the neck take proportionally longer to reach it.
      const topFallDur = 0.08 + 0.3 * (150 - top.finalY) / 130;

      const grainTl = gsap.timeline();
      grainTl
        .to(el, { attr: { cx: neckX, cy: 150 }, duration: topFallDur, ease: 'power2.in' })
        .to(el, { attr: { cx: midX, cy: midY }, duration: 0.18, ease: 'power1.in' })
        .to(el, { attr: { cx: bottom.finalX, cy: bottom.finalY - 2 }, duration: 0.16, ease: 'power2.in' })
        .to(el, { attr: { cy: bottom.finalY }, duration: 0.1, ease: 'bounce.out' });

      tl.add(grainTl, startTime);
    });
  }, [topPositions, bottomPositions]);

  const topPath = "M 62 20 L 138 20 Q 188 45 184 80 Q 176 133 120 148 L 80 148 Q 24 133 16 80 Q 12 45 62 20 Z";
  const bottomPath = "M 80 152 L 120 152 Q 176 167 184 220 Q 188 255 138 280 L 62 280 Q 12 255 16 220 Q 24 167 80 152 Z";

  return (
    <div className="tomato-wrapper">
      <svg viewBox="0 0 200 300" width="280" height="420" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Single clip covering both bulbs + the 4 px neck gap so grains
              stay visible while passing through the constriction. */}
          <clipPath id="glass-interior-clip">
            <path d={topPath} />
            <rect x="80" y="148" width="40" height="4" />
            <path d={bottomPath} />
          </clipPath>
        </defs>

        {/* All grains — start packed in the top container, animate to bottom pile */}
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
        <path d={topPath} fill="rgba(180,220,255,0.10)" stroke="#888" strokeWidth="2.5" />

        {/* Bottom glass bulb */}
        <path d={bottomPath} fill="rgba(180,220,255,0.10)" stroke="#888" strokeWidth="2.5" />

        {/* Rim lines */}
        <line x1="60" y1="20"  x2="140" y2="20"  stroke="#888" strokeWidth="3" strokeLinecap="round" />
        <line x1="60" y1="280" x2="140" y2="280" stroke="#888" strokeWidth="3" strokeLinecap="round" />

        {/* Glass shine highlights */}
        <path d="M 52 36 Q 24 72 20 108 Q 17 132 38 147"
              fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="9" strokeLinecap="round" />
        <path d="M 48 158 Q 22 190 18 222 Q 15 252 42 272"
              fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="8" strokeLinecap="round" />
      </svg>
    </div>
  );
}
