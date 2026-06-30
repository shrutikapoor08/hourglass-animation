import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import './Tomato.css';

export default function Tomato() {
  const wrapperRef = useRef(null);
  const topSandRef = useRef(null);
  const bottomSandRef = useRef(null);
  const sandStreamRef = useRef(null);

  useEffect(() => {
    const tl = gsap.timeline({ delay: 0.5 });

    // Top sand drains downward (height shrinks to 0)


    tl.to(topSandRef.current, {
      attr: { y: 152, height: 0 },
      duration: 6,
      ease: 'power1.inOut',
    }, 0);


    // Bottom sand fills as a cone — apex rises from bottom toward neck
    tl.to(bottomSandRef.current, {
      attr: { points: "100,152 -300,290 500,290" },
      duration: 5,
      ease: 'power1.inOut',
      delay: 0.6,
    }, 0);


    tl.to(sandStreamRef.current, {
      attr: { y: 149, height: 130, },
      duration: 1,
      ease: 'power1.inOut',
    }, 0);

    tl.to(sandStreamRef.current, {
      attr: { width: 8 },
      duration: 5,
      ease: 'power1.inOut',
    }, 0);

  }, []);

  // Top: wide rim (y=20) → bulges wide at y≈80 → narrows to neck (y=148)
  // Bottom: mirror — neck (y=152) → bulges wide at y≈220 → wide rim (y=280)
  const topPath = "M 62 20 L 138 20 Q 188 45 184 80 Q 176 133 120 148 L 80 148 Q 24 133 16 80 Q 12 45 62 20 Z";
  const bottomPath = "M 80 152 L 120 152 Q 176 167 184 220 Q 188 255 138 280 L 62 280 Q 12 255 16 220 Q 24 167 80 152 Z";

  return (
    <div ref={wrapperRef} className="tomato-wrapper">
      <svg viewBox="0 0 200 300" width="280" height="420" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="top-glass-clip">
            <path d={topPath} />
          </clipPath>
          <clipPath id="bottom-glass-clip">
            <path d={bottomPath} />
          </clipPath>
        </defs>

        {/* Top sand — rect clipped to top bulb shape; height shrinks to 0 */}
        <g clipPath="url(#top-glass-clip)">
          <rect ref={topSandRef} x="0" y="0" width="200" height="148" fill="#d4a843" />
        </g>

        {/* Bottom sand — cone clipped to bottom bulb; apex rises from bottom */}
        <g clipPath="url(#bottom-glass-clip)">
          <polygon ref={bottomSandRef} points="100,278 97,281 103,281" fill="#d4a843" />
        </g>

        {/* Thin sand stream through the neck */}
        <rect ref={sandStreamRef} x="98" y="148" width="4" height="0" fill="#d4a843" />

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
