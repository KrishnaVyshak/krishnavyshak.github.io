"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { LOGO_MAP, LOGO_ROWS, LOGO_COLS } from "./logoMap";
import RevealedContent from "./RevealedContent";

// ─── ASCII charset ───────────────────────────────────────────────────────────
const CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#%&*!<>{}[]|/\\^~-_+=?";

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

// ─── Physics state per cell ───────────────────────────────────────────────────
interface CellState {
  char: string;
  ox: number;  // origin x (canvas px)
  oy: number;  // origin y (canvas px)
  x: number;   // current offset x
  y: number;   // current offset y
  vx: number;
  vy: number;
  timeOffset: number; // accumulated local time distortions
  fontType: "mono" | "fancy" | "serif";
  isShattered?: boolean;
}

// Physics constants
const SPRING_K    = 0.07;
const DAMPING     = 0.78;
const HOVER_RADIUS = 110;  // px from cursor
const HOVER_FORCE  = 320;  // repulsion strength
const CLICK_FORCE  = 700;  // burst strength

export default function AsciiLogo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null);
  const cellsRef     = useRef<CellState[]>([]);
  const mouseRef     = useRef<{ x: number; y: number } | null>(null);
  const cursorStateRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const trailRef     = useRef<{ x: number; y: number }[]>([]);
  const lastClickTimeRef = useRef<number>(0);
  const rafRef       = useRef<number>(0);
  const clickCountRef = useRef<number>(0);
  const transitionStartRef = useRef<number | null>(null);
  const startTransitionReady = useRef(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [konamiActive, setKonamiActive] = useState(false);
  const konamiSeqRef = useRef<string[]>([]);
  const secretMapRef = useRef<number[][] | null>(null);
  const secretModeRef = useRef<"none" | "filling" | "showingText">("none");
  const powerLevelRef = useRef(0);
  const worldShatteredRef = useRef(false);

  const cellWRef = useRef(0);
  const cellHRef = useRef(0);
  const isHoveringLinkRef = useRef(false);
  const hoverFactorRef = useRef(0);
  const numColsRef = useRef(0);
  const numRowsRef = useRef(0);
  const accumulatedAngleRef = useRef(0);
  const prevAngleRef = useRef(0);
  const demonModeRef = useRef(false);
  const portalRef = useRef({ active: false, x: 0, y: 0, scale: 0, timeOffset: 0 });
  const demonRealmRef = useRef(false);
  
  const sparksRef = useRef<{x:number, y:number, vx:number, vy:number, life:number, color:string}[]>([]);

  // ── Layout: map each cell to a canvas coordinate ──────────────────────────
  const calcLayout = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width;
    const H = canvas.height;

    // ASPECT = cellH / cellW. Monospace is ~2.0 but we use 1.3 to make the
    // logo thicker/wider horizontally while still fitting the viewport.
    const ASPECT = 0.58;
    const maxW  = W * 1.44;
    const maxH  = H * 0.48;
    const cwByW = maxW / LOGO_COLS;
    const cwByH = (maxH / LOGO_ROWS) / ASPECT;
    const cw    = Math.min(cwByW, cwByH);
    const ch    = cw * ASPECT;
    const lineSpacing = 3;
    const gridH = ch + lineSpacing;

    cellWRef.current = cw;
    cellHRef.current = gridH;

    const totalW = LOGO_COLS * cw;
    const totalH = LOGO_ROWS * gridH;
    const ox0 = (W - totalW) / 2;
    const oy0 = (H - totalH) / 2;

    const newCells: CellState[] = [];

    // Full screen bounds
    const startCol = Math.floor(-ox0 / cw) - 1;
    const endCol = Math.ceil((W - ox0) / cw) + 1;
    const startRow = Math.floor(-oy0 / gridH) - 1;
    const endRow = Math.ceil((H - oy0) / gridH) + 1;

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        let isLogo = false;
        // In Konami mode, we ignore the initial logo map to fill the whole screen
        if (!konamiActive && r >= 0 && r < LOGO_ROWS && c >= 0 && c < LOGO_COLS) {
          if (LOGO_MAP[r][c]) {
            isLogo = true;
          }
        }
        
        // Inverse: add ascii everywhere except inside the logo shape
        // Reduce density by only randomly adding characters
        // In Konami mode, we'll manually add missing cells later to avoid blinks
        if (!isLogo && Math.random() < 1.3) {
          newCells.push({
            char: randomChar(),
            ox: ox0 + c * cw + cw / 2,
            oy: oy0 + r * gridH + gridH / 2,
            x: 0, y: 0, vx: 0, vy: 0, timeOffset: 0,
            fontType: "mono"
          });
        }
      }
    }

    cellsRef.current = newCells;
  }, []);

  // ── Draw all cells onto the canvas ────────────────────────────────────────
  const draw = useCallback((timeNow: number) => {
    const canvas = canvasRef.current;
    const cursorCanvas = cursorCanvasRef.current;
    if (!canvas || !cursorCanvas) return;
    const ctx = canvas.getContext("2d");
    const cursorCtx = cursorCanvas.getContext("2d");
    if (!ctx || !cursorCtx) return;

    const ch = cellHRef.current;
    const cw = cellWRef.current;

    // Transition Logic
    if (startTransitionReady.current && transitionStartRef.current === null) {
      transitionStartRef.current = timeNow;
    }
    
    const transitionStart = transitionStartRef.current;
    let sweepRadius = 0;
    let transitionActive = false;
    let innerSweepRadius = 0;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    if (transitionStart !== null) {
      transitionActive = true;
      const elapsed = timeNow - transitionStart;
      const maxRadius = Math.max(cx, cy) * 1.25 + 400;
      sweepRadius = Math.max(0, (elapsed / 4000) * maxRadius);
      const bandWidth = 350; 
      innerSweepRadius = Math.max(0, sweepRadius - bandWidth);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
    
    if (demonRealmRef.current) {
        ctx.save();
        ctx.translate((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30);
    }
    
    // Fill background: Always black EXCEPT for revealed areas
    ctx.fillStyle = demonRealmRef.current && Math.random() > 0.95 ? "#220000" : "#000";
    ctx.fillRect(-100, -100, canvas.width + 200, canvas.height + 200);

    // Punch holes ONLY during the click-to-reveal transition
    if (transitionActive && !demonRealmRef.current) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "#fff";
      const step = 20; 
      for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
          const testX = x + step/2;
          const testY = y + step/2;
          const dx = testX - cx;
          const dy = testY - cy;
          const qy = Math.floor(testY / 50) * 50;
          const qx = Math.floor(testX / 50) * 50;
          const blockHash = Math.sin(qx * 12.9898 + qy * 78.233) * 43758.5453;
          const blockNoise = blockHash - Math.floor(blockHash);
          const hash = Math.sin(testX * 12.9898 + testY * 78.233) * 43758.5453;
          const staticNoise = hash - Math.floor(hash);
          const distBase = Math.max(Math.abs(dx), Math.abs(dy)) * 1.25; 
          const glitchOffset = blockNoise * 260 + staticNoise * 80;
          if (distBase + glitchOffset < innerSweepRadius + 20) {
             ctx.fillRect(x - 1, y - 1, step + 2, step + 2);
          }
        }
      }
      ctx.globalCompositeOperation = "source-over";
    }

    ctx.textAlign   = "center";
    ctx.textBaseline = "middle";
    
    const monoFont = `${Math.round((ch - 3) * 1.5)}px "JetBrains Mono", "Fira Code", "Roboto Mono", ui-monospace, SFMono-Regular, monospace`;
    const fancyFont = `${Math.round((ch - 3) * 1.5)}px "Bheltyne", "Times New Roman", Times, Georgia, serif`;
    const serifFont = `italic 600 ${Math.round((ch - 3) * 1.5 * 1.18)}px "Playfair Display", serif`;

    let currentFontAttr: "mono" | "fancy" | "serif" = "mono";
    ctx.font = monoFont;

    for (const cell of cellsRef.current) {
      const px = cell.ox + cell.x;
      const py = cell.oy + cell.y;
      
      if (cell.fontType !== currentFontAttr) {
        if (cell.fontType === "fancy") ctx.font = fancyFont;
        else if (cell.fontType === "serif") ctx.font = serifFont;
        else ctx.font = monoFont;
        currentFontAttr = cell.fontType;
      }

      if (transitionActive) {
        const dx = cell.ox - cx; 
        const dy = cell.oy - cy;
        
        // Glitchy non-circular distance metric
        const qy = Math.floor(cell.oy / 50) * 50;
        const qx = Math.floor(cell.ox / 50) * 50;
        const blockHash = Math.sin(qx * 12.9898 + qy * 78.233) * 43758.5453;
        const blockNoise = blockHash - Math.floor(blockHash);
        
        const hash = Math.sin(cell.ox * 12.9898 + cell.oy * 78.233) * 43758.5453;
        const staticNoise = hash - Math.floor(hash);

        // Square-like expansion
        const distBase = Math.max(Math.abs(dx), Math.abs(dy)) * 1.25; 
        const glitchOffset = blockNoise * 260 + staticNoise * 80;
        const dist = distBase + glitchOffset;
        
        if (dist < innerSweepRadius) {
          continue; 
        } else if (dist < sweepRadius) {
          const glitchX = (staticNoise - 0.5) * 12;
          const glitchY = (blockNoise - 0.5) * 12;
          const angle = Math.atan2(dy, dx);
          const hue = (angle * 180 / Math.PI + distBase * 0.1 - timeNow * 0.1 + blockNoise * 60) % 360;
          ctx.fillStyle = `hsl(${hue}, 90%, 75%)`;
          ctx.fillText(cell.char, px + glitchX, py + glitchY, cw * 1.3);
          continue;
        }
      }

      if (demonRealmRef.current && cell.isShattered) {
         ctx.fillStyle = Math.random() > 0.8 ? "#ff0000" : "#880000"; // blood red
         if (Math.random() > 0.95) ctx.fillStyle = "#fff"; // terrifying flashes
         ctx.fillText(cell.char, px + (Math.random() - 0.5) * 8, py + (Math.random() - 0.5) * 8, cw * 1.5);
      } else {
         ctx.fillStyle = "#fff";
         ctx.fillText(cell.char, px, py, cw * 1.3);
      }
    }
    
    if (demonRealmRef.current) {
        ctx.restore();
    }

    // NEW: Secret reveal punch-out for Konami show-state
    if (konamiActive && secretModeRef.current === "showingText") {
      // If we want a solid black background that only reveals text as holes...
      // logic here if needed
    }

    // Draw Dynamic Custom Cursor
    if (mouseRef.current) {
      const time = timeNow * 0.001 || 0;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      
      // Calculate smoothed cursor velocity
      const cState = cursorStateRef.current;
      const dx = mx - cState.x;
      const dy = my - cState.y;

      // Smooth hover scale transition
      const targetHover = isHoveringLinkRef.current ? 1 : 0;
      hoverFactorRef.current += (targetHover - hoverFactorRef.current) * 0.15;
      const hf = hoverFactorRef.current;
      
      // Update trail for the tail effect
      trailRef.current.unshift({ x: mx, y: my });
      if (trailRef.current.length > 20) {
        trailRef.current.pop();
      }

      // If distance is huge (e.g., initial entry), don't spike velocity
      if (Math.abs(dx) > 100 || Math.abs(dy) > 100) {
        cState.vx = 0; cState.vy = 0;
        trailRef.current = [{ x: mx, y: my }];
      } else {
        cState.vx = cState.vx * 0.7 + dx * 0.3;
        cState.vy = cState.vy * 0.7 + dy * 0.3;
      }
      cState.x = mx;
      cState.y = my;

      const speed = Math.sqrt(cState.vx ** 2 + cState.vy ** 2);
      const vAngle = Math.atan2(cState.vy, cState.vx);
      const power = powerLevelRef.current;
      
      // Detect 20 full circles
      if (speed > 4) {
         let dTheta = vAngle - prevAngleRef.current;
         dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
         accumulatedAngleRef.current += dTheta;
      }
      accumulatedAngleRef.current *= 0.9995; // decay slowly
      prevAngleRef.current = vAngle;
      
      if (Math.abs(accumulatedAngleRef.current) > 20 * 2 * Math.PI) {
         if (!demonModeRef.current) {
            demonModeRef.current = true;
            // Lock portal location to the center of the screen
            portalRef.current = { active: true, x: window.innerWidth / 2, y: window.innerHeight / 2, scale: 0, timeOffset: Math.random() * 1000 };
         }
      }
      const isDemon = demonModeRef.current;
      
      // Draw Doctor Strange Portal
      if (portalRef.current.active) {
         const p = portalRef.current as any;
         // Chaotic, stuttering growth
         const targetScale = 1.0;
         const currentScale = p.scale;
         const growthSpeed = 0.005 + (Math.random() * 0.02);
         p.scale = Math.min(targetScale, currentScale + growthSpeed);
         
         const pTime = time * 2 + p.timeOffset;
         
         // Base radius with massive chaotic pulse
         const pulse = Math.sin(pTime * 15) * 15 + Math.cos(pTime * 23) * 15;
         const radBase = (p.scale * 280) + pulse * p.scale; 
         
         cursorCtx.save();
         cursorCtx.translate(p.x, p.y);
         
         // Inner portal void / glowing base shifts erratically
         const voidGlitchX = (Math.random() - 0.5) * 15 * p.scale;
         const voidGlitchY = (Math.random() - 0.5) * 15 * p.scale;
         const grad = cursorCtx.createRadialGradient(voidGlitchX, voidGlitchY, radBase * 0.4, 0, 0, radBase * 1.4);
         grad.addColorStop(0, "rgba(0, 0, 0, 0.95)"); // Darkish void center
         grad.addColorStop(0.5, `rgba(255, ${Math.random()*50}, 0, ${0.3 + Math.random()*0.2})`); 
         grad.addColorStop(1, "rgba(255, 0, 0, 0)");
         
         cursorCtx.beginPath();
         cursorCtx.arc(0, 0, radBase * 1.5, 0, Math.PI * 2);
         cursorCtx.fillStyle = grad;
         cursorCtx.fill();
         
         // Base glowing ring - erratic
         cursorCtx.globalCompositeOperation = "screen";
         
         // Multiple unstable rings to scatter spark emission points
         const NUM_RINGS = 3;
         const ringRadii: number[] = [];
         
         for (let ri = 0; ri < NUM_RINGS; ri++) {
            const ringJitter = Math.sin(pTime * (10 + ri * 5)) * 30 * p.scale;
            const ringRad = radBase + ringJitter + (ri * 15 * p.scale);
            ringRadii.push(ringRad);
            
            cursorCtx.beginPath();
            for(let a=0; a<=Math.PI*2; a+=0.2) {
               const r = ringRad + (Math.random() - 0.5) * 20 * p.scale;
               const px = Math.cos(a) * r;
               const py = Math.sin(a) * r;
               if(a===0) cursorCtx.moveTo(px,py);
               else cursorCtx.lineTo(px,py);
            }
            cursorCtx.closePath();
            cursorCtx.lineWidth = 2 + Math.random() * 8;
            cursorCtx.strokeStyle = `rgba(255, ${Math.random()*150}, 0, ${0.1 + Math.random()*0.15})`;
            cursorCtx.stroke();
         }
         
         // Doctor Strange dense tangential sparks
         const spawnRate = Math.floor((30 + Math.random() * 20) * p.scale); // Erratic dense spawns
         for (let s = 0; s < spawnRate; s++) {
            const ang = Math.random() * Math.PI * 2;
            // Pick a random chaotic ring to emanate from
            const sourceRad = ringRadii[Math.floor(Math.random() * ringRadii.length)];
            const ringThick = (Math.random() - 0.5) * 30;
            const dist = sourceRad + ringThick;
            
            const sx = Math.cos(ang) * dist;
            const sy = Math.sin(ang) * dist;
            
            // Tangential vector
            const tangVx = Math.cos(ang + Math.PI / 2);
            const tangVy = Math.sin(ang + Math.PI / 2);

            
            // Outward vector
            const outVx = Math.cos(ang);
            const outVy = Math.sin(ang);
            
            const speedTang = (24 + Math.random() * 30) * p.scale; 
            const speedOut = (Math.random() * 6) * p.scale; 

            // Brighter White/Yellow/Orange hot sparks
            const hue = Math.random() > 0.8 ? 60 : (Math.random() * 30 + 15);
            const light = Math.random() > 0.9 ? 100 : (70 + Math.random() * 30); // Raised minimum lightness to 70

            sparksRef.current.push({
               x: p.x + sx,
               y: p.y + sy,
               vx: tangVx * speedTang + outVx * speedOut + (Math.random()-0.5)*2,
               vy: tangVy * speedTang + outVy * speedOut + (Math.random()-0.5)*2,
               life: Math.random() * 0.5 + 0.3, // Longer-lived inner sparks to let them travel tangentially
               color: `hsl(${hue}, 100%, ${light}%)`
            });
         }
         
         // Larger, longer lasting falling embers that drip off the portal erratically
         const dropRate = Math.floor((1 + Math.random() * 5) * p.scale);
         for (let s = 0; s < dropRate; s++) {
            const ang = Math.random() * Math.PI * 2;
            const sourceRad = ringRadii[Math.floor(Math.random() * ringRadii.length)];
            const sx = Math.cos(ang) * sourceRad;
            const sy = Math.sin(ang) * sourceRad;
            sparksRef.current.push({
               x: p.x + sx,
               y: p.y + sy,
               vx: (Math.random() - 0.5) * 8, // More horizontal scatter for embers
               vy: (Math.random() - 0.5) * 5,
               life: Math.random() * 0.8 + 0.4,
               color: `hsl(${Math.random() * 30 + 10}, 100%, 75%)` // Brighter dripping embers
            });
         }
         
         cursorCtx.restore();
      }
      
      // Draw Tail first (behind the cursor) on the cursor canvas
      if (speed > 0.5) {
        // Draw multiple segments of the tail using past positions
        for (let j = 1; j < Math.min(trailRef.current.length, 16); j++) {
           const pos = trailRef.current[j];
           const opacity = 0.4 * (1 - j / 16);
           const scale = 1 - (j / 20);
           
           const jitterX = (Math.sin(time * 10 + j) * 2) + (power >= 3 ? (Math.random() - 0.5) * (power*1.5) : 0);
           const jitterY = (Math.cos(time * 10 + j) * 2) + (power >= 3 ? (Math.random() - 0.5) * (power*1.5) : 0);

           cursorCtx.save();
           cursorCtx.translate(pos.x + jitterX, pos.y + jitterY);
           cursorCtx.rotate(time * 3 + j * 0.4); 
           cursorCtx.scale(scale, scale);
           
           if (isDemon) {
              const hue = Math.random() * 20;
              cursorCtx.strokeStyle = `hsla(${hue}, 100%, 50%, ${opacity * 1.5})`;
           } else {
              cursorCtx.strokeStyle = power >= 3 ? `rgba(255, 255, 255, ${opacity * 1.5})` : `rgba(255, 255, 255, ${opacity})`;
           }
           
           cursorCtx.lineWidth = 1.2 * (1 - j / 20) + ((power >= 3 || isDemon) ? Math.max(power, 3) * 0.3 : 0);
           
           cursorCtx.beginPath();
           const radius = 10 + Math.sin(time * 12 + j * 0.5) * 4;
           for (let i = 0; i < 7; i++) {
             const theta = (i / 7) * Math.PI * 2 + Math.sin(time * 4 + i + j * 0.3) * 0.8;
             const r = radius + (Math.sin(time * 8 + i * 2 + j) * 6);
             if (i === 0) cursorCtx.moveTo(Math.cos(theta) * r, Math.sin(theta) * r);
             else cursorCtx.lineTo(Math.cos(theta) * r, Math.sin(theta) * r);
           }
           cursorCtx.closePath();
           cursorCtx.stroke();
           cursorCtx.restore();
         }
      }
      
      // Update and Draw Sparks For Evil Mode
      if (power >= 3 || isDemon) {
         // Emit new sparks based on power
         const emitPower = Math.max(power, isDemon ? 5 : 0);
         const sparkCount = Math.floor(emitPower * (Math.random() * 1.5 + 0.5));
         for (let i = 0; i < sparkCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = Math.random() * (2 + emitPower);
            sparksRef.current.push({
               x: mx + (Math.random() - 0.5) * (10 + emitPower*2),
               y: my + (Math.random() - 0.5) * (10 + emitPower*2),
               vx: Math.cos(angle) * spd - cState.vx * 0.1,
               vy: Math.sin(angle) * spd - cState.vy * 0.1 - (Math.random() * 2), // tend upward
               life: 1.0,
               color: isDemon ? `hsl(${Math.random()*20}, 100%, ${60 + Math.random()*40}%)` : `rgba(255, 255, 255, ${0.7 + Math.random() * 0.3})`
            });
         }
      }

      cursorCtx.save();
      cursorCtx.globalCompositeOperation = "screen";
      for (let i = sparksRef.current.length - 1; i >= 0; i--) {
         const s = sparksRef.current[i];
         s.life -= 0.02 + Math.random() * 0.02;
         
         // Realistic particle physics
         s.vx *= 0.96; // Air resistance (drag), heavily reduced to shoot far
         s.vy *= 0.96;
         s.vy += 0.35; // Gravity pulls embers downward
         
         s.x += s.vx + (Math.random() - 0.5);
         s.y += s.vy + (Math.random() - 0.5);
         
         if (s.life <= 0) {
            sparksRef.current.splice(i, 1);
            continue;
         }
         
         cursorCtx.globalAlpha = Math.max(0, s.life);
         cursorCtx.fillStyle = s.color;
         // Draw slightly larger rect instead of relying on extremely expensive shadowBlur
         const size = (power >= 5 || isDemon ? 4.5 : 3.5) + Math.random() * 2;
         cursorCtx.fillRect(s.x, s.y, size, size);
      }
      cursorCtx.restore();

      cursorCtx.save();
      // Apply main jitter to entire cursor head based on power
      const applyJitter = power >= 3 || isDemon;
      const jitterAmount = Math.max(power * 1.5, isDemon ? 6 : 0);
      const mainJitterX = applyJitter ? (Math.random() - 0.5) * jitterAmount : 0;
      const mainJitterY = applyJitter ? (Math.random() - 0.5) * jitterAmount : 0;
      cursorCtx.translate(mx + mainJitterX, my + mainJitterY);
      
      // Core dot
      cursorCtx.fillStyle = isDemon ? "red" : "white";
      cursorCtx.beginPath();
      cursorCtx.arc(0, 0, 3, 0, Math.PI * 2);
      cursorCtx.fill();

      // Velocity-based stretching for shapes
      cursorCtx.save();
      if (speed > 0.5) {
        cursorCtx.rotate(vAngle);
        const stretchX = 1 + Math.min(speed * 0.035, 2.0);
        const squashY = 1 - Math.min(speed * 0.015, 0.45);
        cursorCtx.scale(stretchX, squashY);
        cursorCtx.translate(Math.min(speed * 0.2, 10), 0);
        cursorCtx.rotate(-vAngle);
      }

      // Chaotic orbiting shapes (main cursor shape)
      const clickElapsed = (timeNow - lastClickTimeRef.current);
      const clickFactor = Math.max(0, 1 - clickElapsed / 600); 
      const pulseSize = clickFactor * 12;
      
      if (clickFactor > 0) {
        cursorCtx.fillStyle = isDemon 
           ? `rgba(255, 50, 50, ${clickFactor * 0.6})` 
           : `rgba(255, 255, 255, ${clickFactor * 0.45})`;
      }
      
      const strokeColor = isDemon 
          ? `hsla(${Math.random()*20}, 100%, 60%, ${0.8 + clickFactor * 0.2 + hf * 0.2})` 
          : `rgba(255, 255, 255, ${0.8 + clickFactor * 0.2 + hf * 0.2})`;
      cursorCtx.strokeStyle = strokeColor;
      
      // The cursor's physical shape becomes aggressively chaotic and jagged
      const evilSpikiness = power >= 3 || isDemon ? Math.max(power * 2, isDemon ? 10 : 0) : 0;
      cursorCtx.lineWidth = (1.6 + clickFactor * 1.4 + ((power >= 3 || isDemon) ? Math.max(power, 5) * 0.4 : 0)) * (1 + hf * 0.8);
      
      if (hf > 0.1 || power >= 3 || isDemon) {
        cursorCtx.shadowColor = isDemon ? "red" : "white";
        cursorCtx.shadowBlur = (hf * 15) + ((power >= 3 || isDemon) ? Math.max(power, 5) * 6 : 0);
      }
      
      cursorCtx.rotate(time * 3 + clickFactor * 2 + hf * 1.5); 
      cursorCtx.beginPath();
      const radius = (10 + Math.sin(time * 12) * 4 + pulseSize + power * 3) * (1 + hf * 0.8);
      for (let i = 0; i < 7; i++) {
        const theta = (i / 7) * Math.PI * 2 + Math.sin(time * 4 + i) * 0.8;
        const spike = Math.random() * evilSpikiness; // Random jaggedness
        const r = radius + (Math.sin(time * 8 + i * 2) * 5) + Math.min(speed * 0.15, 5) + spike;
        if (i === 0) cursorCtx.moveTo(Math.cos(theta) * r, Math.sin(theta) * r);
        else cursorCtx.lineTo(Math.cos(theta) * r, Math.sin(theta) * r);
      }
      cursorCtx.closePath();
      
      if (clickFactor > 0 || hf > 0.05) {
        cursorCtx.fillStyle = hf > 0.05 
          ? (isDemon ? `rgba(255, 0, 0, ${Math.max(clickFactor * 0.5, hf * 0.4)})` : `rgba(255, 255, 255, ${Math.max(clickFactor * 0.45, hf * 0.4)})`)
          : (isDemon ? `rgba(255, 0, 0, ${clickFactor * 0.5})` : `rgba(255, 255, 255, ${clickFactor * 0.45})`);
        cursorCtx.fill();
      }
      cursorCtx.stroke();
      
      // Draw massive extra rings if power >= 1
      for (let p = 1; p <= power; p++) {
        cursorCtx.save();
        cursorCtx.rotate(time * (1.5 + p * 0.5) * p * (p % 2 === 0 ? 1 : -1));
        const pRadius = radius + p * 15 + Math.sin(time * 10 + p) * 10;
        cursorCtx.setLineDash([Math.random() * 20 + 5, Math.random() * 20 + 5]);
        cursorCtx.beginPath();
        
        // Draw jagged rings instead of perfect circles ONLY if power >= 3
        if (power >= 3 || isDemon) {
           for (let j = 0; j < 12; j++) {
              const theta = (j / 12) * Math.PI * 2;
              const jRad = pRadius + (Math.random() * (Math.max(power, isDemon ? 5 : 0) * 3));
              if (j === 0) cursorCtx.moveTo(Math.cos(theta) * jRad, Math.sin(theta) * jRad);
              else cursorCtx.lineTo(Math.cos(theta) * jRad, Math.sin(theta) * jRad);
           }
        } else {
           cursorCtx.arc(0, 0, pRadius, 0, Math.PI * 2);
        }
        cursorCtx.closePath();

        cursorCtx.strokeStyle = isDemon 
          ? `hsla(${Math.random()*20}, 100%, 50%, ${Math.max(0.1, 0.8 - p * 0.1)})` 
          : `rgba(255, 255, 255, ${Math.max(0.1, 0.8 - p * 0.1)})`;
        cursorCtx.stroke();
        cursorCtx.restore();
      }
      
      // Reset shadow for subsequent rings
      cursorCtx.shadowBlur = 0;

      cursorCtx.restore(); 

      // Outer dashed/dotted ring
      cursorCtx.rotate(-time * 5 - hf * 0.8);
      cursorCtx.setLineDash([2, 6, 8, 4]);
      cursorCtx.beginPath();
      const outerRingR = (22 + Math.cos(time * 15) * 6 + Math.min(speed * 0.2, 8)) * (1 + hf * 0.5);
      cursorCtx.arc(0, 0, outerRingR, 0, Math.PI * 2);
      cursorCtx.stroke();

      cursorCtx.restore();
    }
  }, []);

  // ── Physics + render loop (RAF) ───────────────────────────────────────────
  const loop = useCallback((timeNow: number) => {
    const mouse = mouseRef.current;
    const time = timeNow * 0.001; // in seconds
    const cSpeed = Math.sqrt(cursorStateRef.current.vx ** 2 + cursorStateRef.current.vy ** 2);

    for (const cell of cellsRef.current) {
      let timeBoost = 0;

      // Hover repulsion
      if (mouse) {
        const px = cell.ox + cell.x;
        const py = cell.oy + cell.y;
        const dx = px - mouse.x;
        const dy = py - mouse.y;
        const dSq = dx * dx + dy * dy;
        // Hover effect still active
        if (dSq < HOVER_RADIUS * HOVER_RADIUS * 2.5 && dSq > 0.01) {
          const dist     = Math.sqrt(dSq);
          const maxDist  = HOVER_RADIUS * 1.5;
          const strength = (HOVER_FORCE / Math.max(dist, 10)) * Math.max(0, 1 - dist / maxDist) * 0.15;
          
          timeBoost = cSpeed * 0.02 * Math.max(0, 1 - dist / maxDist);

          const chaos = Math.sin(cell.ox * 0.015 + time * 3) * Math.cos(cell.oy * 0.015 + time * 2.5);
          const tx = -dy / dist;
          const ty = dx / dist;

          cell.vx += ((dx / dist) + tx * 2 * chaos) * strength;
          cell.vy += ((dy / dist) + ty * 2 * chaos) * strength;
          
          if (dist < HOVER_RADIUS * 0.5) {
             cell.vx += (Math.random() - 0.5) * 6;
             cell.vy += (Math.random() - 0.5) * 6;
          }
        }
      }

      cell.timeOffset += timeBoost;
      const effectiveTime = time + cell.timeOffset;

      const n1 = Math.sin(cell.ox * 0.013 + effectiveTime * 0.4);
      const n2 = Math.cos(cell.oy * 0.017 - effectiveTime * 0.3);
      const n3 = Math.sin((cell.ox * 0.005 - cell.oy * 0.008) + effectiveTime * 0.6);
      
      const hash = Math.sin(cell.ox * 12.9898 + cell.oy * 78.233) * 43758.5453;
      const staticNoise = hash - Math.floor(hash);
      
      const val = n1 + n2 + n3 + Math.sin(staticNoise * 15 + effectiveTime);
      let normalized = (val + 4) / 8;
      normalized = Math.max(0, Math.min(0.999, normalized));

      const displacementSq = cell.x * cell.x + cell.y * cell.y;
      
      let finalChar: string;
      let finalFont: "mono" | "fancy" | "serif";

      if (displacementSq > 400 * 400) {
        finalChar = ' ';
        finalFont = "mono"; 
      } else if (displacementSq > 200 * 200) {
        const fadeChars = " .";
        finalChar = fadeChars[Math.floor(normalized * fadeChars.length)];
        finalFont = "mono";
      } else if (displacementSq > 100 * 100) {
        const smallChars = ".,-_'`· ";
        finalChar = smallChars[Math.floor(normalized * smallChars.length)];
        finalFont = "mono";
      } else {
        finalChar = CHARS[Math.floor(normalized * CHARS.length)];
        // Mix all three fonts: mostly mono, some Playfair (serif), and very rare Bheltyne (fancy)
        if (normalized > 0.98 || (staticNoise > 0.99 && normalized > 0.8)) {
          finalFont = "fancy";
        } else if (staticNoise > 0.93 && normalized > 0.35) {
          finalFont = "serif";
        } else if (staticNoise > 0.975 && normalized > 0.7) {
          finalFont = "fancy";
        } else {
          finalFont = "mono";
        }
      }

      // ── Secret Text Reveal Logic (Negative Mapping) ────────────────────
      if (secretModeRef.current === "showingText" && secretMapRef.current) {
        const sMap = secretMapRef.current;
        const sRows = sMap.length;
        const sCols = sMap[0].length;
        
        // Use pre-calculated cell sizes to find grid indices
        const cw = cellWRef.current;
        const ch = cellHRef.current;
        const canvas = canvasRef.current;
        if (canvas && cw > 0 && ch > 0) {
          // Find grid center indices
          const screenCols = Math.ceil(canvas.width / cw);
          const screenRows = Math.ceil(canvas.height / ch);
          
          const ox0 = (canvas.width - screenCols * cw) / 2;
          const oy0 = (canvas.height - screenRows * ch) / 2;
          
          const colIndex = Math.floor((cell.ox - ox0) / cw);
          const rowIndex = Math.floor((cell.oy - oy0) / ch);
          
          const sr = rowIndex - Math.floor((screenRows - sRows) / 2);
          const sc = colIndex - Math.floor((screenCols - sCols) / 2);

          if (sr >= 0 && sr < sRows && sc >= 0 && sc < sCols) {
            if (sMap[sr][sc] === 1) {
              finalChar = ' '; // Create the hole for the text
            }
          }
        }
      }

      cell.char = finalChar;
      cell.fontType = finalFont;

      // Spring back to origin (Slower recovery for destruction)
      // When cells are heavily displaced (e.g. from a click destruction), we reduce the spring force significantly so it recovers slowly
      const MAX_DISP_SQ = 150 * 150; // Threshold to start reducing spring force
      
      let currentSpringK = SPRING_K;
      
      if (cell.isShattered) {
        currentSpringK = 0; // Never return!
      } else if (displacementSq > MAX_DISP_SQ) {
        // Drop spring force dramatically the further away it is, mapping it towards a minimum spring K
        const factor = Math.max(0.08, MAX_DISP_SQ / displacementSq); 
        currentSpringK = SPRING_K * factor * 0.7; 
      }

      if (cell.isShattered) {
         cell.vx += (Math.random() - 0.5) * 6;
         cell.vy += (Math.random() - 0.5) * 6 + 1.2; // Chaos and gravity
      } else {
         cell.vx += -cell.x * currentSpringK;
         cell.vy += -cell.y * currentSpringK;
      }

      // Damping
      cell.vx *= DAMPING;
      cell.vy *= DAMPING;

      // Integrate position
      cell.x += cell.vx;
      cell.y += cell.vy;
    }

    draw(timeNow);
    rafRef.current = requestAnimationFrame(loop);
  }, [draw]);


  // ── Click: Localized Destruction ───────────────────────────────────────────
  const handleClick = useCallback((e: MouseEvent) => {
    lastClickTimeRef.current = performance.now();
    clickCountRef.current++;
    if (clickCountRef.current >= 5 && !startTransitionReady.current) {
      startTransitionReady.current = true;
      setIsTransitioning(true);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Random seed to make each click's destruction shape unique
    const clickSeed = Math.random() * 100;

    if (portalRef.current.active && demonModeRef.current && !demonRealmRef.current) {
       const dx = mx - portalRef.current.x;
       const dy = my - portalRef.current.y;
       if (dx * dx + dy * dy < Math.pow(portalRef.current.scale * 280, 2)) {
          demonRealmRef.current = true;
          window.dispatchEvent(new CustomEvent('summon-demon'));
          
          // Corrupt ALL ASCII cells into a terrifying blood rain
          for (const cell of cellsRef.current) {
             cell.char = Math.random() > 0.7 ? '☠' : Math.random() > 0.5 ? '🩸' : '6';
             cell.fontType = 'fancy';
             cell.isShattered = true; 
             cell.vx = (Math.random() - 0.5) * 20;
             cell.vy = (Math.random() - 0.5) * 20 - 10;
          }
          return; // Stop normal click processing
       }
    }

    for (const cell of cellsRef.current) {
      const dx   = cell.ox + cell.x - mx;
      const dy   = cell.oy + cell.y - my;
      // Calculate a highly angular, non-circular distance metric
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const glitchDist = Math.max(absDx, absDy) * 1.2 + (absDx * absDy) * 0.003;
      const angle = Math.atan2(dy, dx);
      
      // Create a random jagged, cross-like or blocky glitch shape
      // Using sharp angles and vertical/horizontal banding emphasis
      const verticalBand = Math.sin(dx * 0.05) * 60;
      const horizontalBand = Math.cos(dy * 0.05) * 60;
      const shapeDistortion = Math.sin(angle * 4 + clickSeed) * 120 + verticalBand + horizontalBand;
      
      const destructionRadius = 300 + shapeDistortion + (Math.random() * 60); 

      // Only affect cells inside this chaotic, non-circular shape
      if (glitchDist > destructionRadius) continue; 

      const normDist = glitchDist / destructionRadius; // 0 to 1
      const falloff = Math.pow(1 - normDist, 1.2); 
      
      const chaosX = (Math.random() - 0.5) * 2;
      const chaosY = (Math.random() - 0.5) * 2;
      
      // Increased base impulse so they scatter farther and trigger fade
      const baseImpulse = CLICK_FORCE * 0.55; 
      
      // Scatter roughly outwards, heavily mixed with randomness
      const impulseX = (Math.cos(angle) * 0.3 + chaosX * 1.4) * baseImpulse * falloff;
      const impulseY = (Math.sin(angle) * 0.3 + chaosY * 1.4) * baseImpulse * falloff;
      
      cell.vx += impulseX;
      cell.vy += impulseY;
      
      // Jumble them from their spot slightly, but maintain proximity
      cell.x += impulseX * 0.2;
      cell.y += impulseY * 0.2;
      
      // Randomize characters instantly via time displacement
      cell.timeOffset += (Math.random() * 200) * falloff;
    }
  }, []);

  // ── Konami Logic ────────────────────────────────────────────────────────
  const triggerKonami = useCallback(() => {
    if (isTransitioning) return;
    
    setKonamiActive(true);
    secretModeRef.current = "filling";

    // 1. Initial Destruction of everything on screen
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    for (const cell of cellsRef.current) {
      const dx = cell.ox - cx;
      const dy = cell.oy - cy;
      const angle = Math.atan2(dy, dx);
      const force = 1800 + Math.random() * 1200;
      
      cell.vx += Math.cos(angle) * force;
      cell.vy += Math.sin(angle) * force;
      cell.timeOffset += Math.random() * 1500;
    }

    // 2. Additive fill for the logo hole (Spawn new cells exactly in the hole)
    const cw = cellWRef.current;
    const ch = cellHRef.current;
    if (cw > 0 && ch > 0) {
      const canvas = canvasRef.current;
      if (canvas) {
        const W = canvas.width;
        const H = canvas.height;
        const totalW = LOGO_COLS * cw;
        const totalH = LOGO_ROWS * ch;
        const ox0 = (W - totalW) / 2;
        const oy0 = (H - totalH) / 2;

        for (let r = 0; r < LOGO_ROWS; r++) {
          for (let c = 0; c < LOGO_COLS; c++) {
            if (LOGO_MAP[r][c]) {
              const ox = ox0 + c * cw + cw / 2;
              const oy = oy0 + r * ch + ch / 2;
              
              // Give them initial velocity so they burst from their "spawning" spot or towards center
              const angle = Math.atan2(oy - cy, ox - cx);
              const force = 1000 + Math.random() * 1000;
              
              cellsRef.current.push({
                char: randomChar(),
                ox, oy,
                x: (Math.random() - 0.5) * 50, // Slight offset
                y: (Math.random() - 0.5) * 50,
                vx: Math.cos(angle) * force,
                vy: Math.sin(angle) * force,
                timeOffset: Math.random() * 2000,
                fontType: "mono"
              });
            }
          }
        }
      }
    }

    // 3. Generate the secret text map
    const text = "I AIN'T\nEXACTLY GAY\nBUT I AIN'T\nEXACTLY NOT GAY";
    const tempCanvas = document.createElement("canvas");
    const tCtx = tempCanvas.getContext("2d");
    if (tCtx) {
      // Each pixel in this bitmask will be one ASCII character on screen.
      // So use a font size that results in a reasonable number of "pixels".
      // Let's aim for a total width of ~80 cells.
      const fontSize = 11; 
      tCtx.font = `900 ${fontSize}px "JetBrains Mono", system-ui, sans-serif`;
      const lines = text.split("\n");
      let maxWidth = 0;
      lines.forEach(line => {
        const m = tCtx.measureText(line).width;
        if (m > maxWidth) maxWidth = Math.ceil(m);
      });
      
      const tH = lines.length * fontSize * 1.3;
      const tW = maxWidth;
      tempCanvas.width = tW;
      tempCanvas.height = Math.ceil(tH);
      
      tCtx.fillStyle = "black";
      tCtx.fillRect(0, 0, tW, tH);
      tCtx.fillStyle = "white";
      tCtx.font = `900 ${fontSize}px "JetBrains Mono", system-ui, sans-serif`;
      tCtx.textBaseline = "top";
      lines.forEach((line, i) => {
        tCtx.fillText(line, 0, i * fontSize * 1.3);
      });
      
      const imgData = tCtx.getImageData(0, 0, tW, tH);
      const map: number[][] = [];
      for (let r = 0; r < tH; r++) {
        const row: number[] = [];
        for (let c = 0; c < tW; c++) {
          const idx = (r * tW + c) * 4;
          row.push(imgData.data[idx] > 128 ? 1 : 0);
        }
        map.push(row);
      }
      secretMapRef.current = map;
    }

    // 4. Reveal the text after a few seconds
    setTimeout(() => {
      secretModeRef.current = "showingText";
      
      // Trigger a violent blast at the center to scatter cells before reveals
      for (const cell of cellsRef.current) {
        const dx = cell.ox - cx;
        const dy = cell.oy - cy;
        const angle = Math.atan2(dy, dx);
        const force = 1200 + Math.random() * 1500;
        cell.vx += Math.cos(angle) * force;
        cell.vy += Math.sin(angle) * force;
      }
    }, 4500);

  }, [calcLayout, isTransitioning]);

  useEffect(() => {
    const sequence = [
      "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", 
      "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", 
      "b", "a"
    ];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTransitioning) return;
      
      const key = e.key.toLowerCase();
      konamiSeqRef.current.push(key);
      
      if (konamiSeqRef.current.length > sequence.length) {
        konamiSeqRef.current.shift();
      }

      const match = sequence.every((k, i) => k.toLowerCase() === konamiSeqRef.current[i]);
      if (match) {
        triggerKonami();
        konamiSeqRef.current = [];
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [triggerKonami, isTransitioning]);

  // Ensure layout is recalculated when konamiActive or secretMode changes
  useEffect(() => {
    // Only recalc if we haven't started the easter egg yet
    if (konamiActive && secretModeRef.current === "none") {
      calcLayout();
    }
  }, [konamiActive, calcLayout]);

  // ── Mouse tracking ────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleMouseLeave = useCallback(() => { mouseRef.current = null; }, []);

  // ── Resize ────────────────────────────────────────────────────────────────
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const cursorCanvas = cursorCanvasRef.current;
    if (!canvas || !cursorCanvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    cursorCanvas.width  = window.innerWidth;
    cursorCanvas.height = window.innerHeight;
    calcLayout();
  }, [calcLayout]);

  // ── Mount / unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const cursorCanvas = cursorCanvasRef.current;
    if (!canvas || !cursorCanvas) return;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    cursorCanvas.width  = window.innerWidth;
    cursorCanvas.height = window.innerHeight;

    calcLayout();
    rafRef.current = requestAnimationFrame(loop);

    window.addEventListener("click",      handleClick);
    window.addEventListener("mousemove",  handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("resize",     handleResize);

    const onPowerUp = (e: Event) => {
      const ce = e as CustomEvent;
      powerLevelRef.current = ce.detail || 0;
    };
    const onShatter = (e: Event) => {
      const ce = e as CustomEvent;
      const { x, y } = ce.detail || {};
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = x !== undefined ? x - rect.left : canvas.width / 2;
      const cy = y !== undefined ? y - rect.top : canvas.height / 2;
      const SHATTER_RADIUS = 250;
      let shatteredAny = false;
      for (const cell of cellsRef.current) {
         const dx = cell.ox - cx; 
         const dy = cell.oy - cy;
         const dist = Math.hypot(dx, dy);
         if (dist < SHATTER_RADIUS) {
            cell.isShattered = true;
            shatteredAny = true;
            const angle = Math.atan2(dy, dx);
            const force = 1000 + Math.random() * 2000;
            cell.vx += Math.cos(angle) * force;
            cell.vy += Math.sin(angle) * force;
            cell.timeOffset += Math.random() * 5000;
         }
      }
      if (shatteredAny) {
         worldShatteredRef.current = true;
      }
    };
    
    window.addEventListener('power-up', onPowerUp);
    window.addEventListener('shatter-the-world', onShatter);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("click",      handleClick);
      window.removeEventListener("mousemove",  handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize",     handleResize);
      window.removeEventListener('power-up', onPowerUp);
      window.removeEventListener('shatter-the-world', onShatter);
    };
  }, [calcLayout, loop, handleClick, handleMouseMove, handleMouseLeave, handleResize]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000",
        overflow: "hidden",
        position: "relative",
        cursor: "none"
      }}
    >
      {/* Background section to be revealed */}
      <RevealedContent 
        isVisible={isTransitioning} 
        onHoverChange={(h) => isHoveringLinkRef.current = h} 
      />

      <canvas
        ref={canvasRef}
        style={{ display: "block", cursor: "none", position: "relative", zIndex: 1, pointerEvents: "none" }}
      />
      
      {/* High-frequency logic-driven cursor layer with color inversion */}
      <canvas
        ref={cursorCanvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 10,
          mixBlendMode: "difference"
        }}
      />
      
      {/* Vignette Overlay - Only shown before transition */}
      {(!isTransitioning && !konamiActive) && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            background: "radial-gradient(circle, transparent 60%, rgba(0,0,0,0.85) 120%)",
            zIndex: 2
          }}
        />
      )}
    </div>
  );
}
