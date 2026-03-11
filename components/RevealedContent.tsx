"use client";
import React, { useState, useEffect, useRef } from 'react';

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#%&*!<>{}[]|/\\^~-_+=?";

const ScrambleLetter = ({ letter, trigger }: { letter: string, trigger?: boolean }) => {
  const [displayLetter, setDisplayLetter] = useState(letter);
  const [isScrambling, setIsScrambling] = useState(false);
  const [isSerif, setIsSerif] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [rand, setRand] = useState({ rx: 0.5, ry: 0.5, rr: 0.5, rs: 0.5 });

  useEffect(() => {
    setRand({ rx: Math.random(), ry: Math.random(), rr: Math.random(), rs: Math.random() });
    setIsSerif(Math.random() < 0.15 && letter !== ' ');
  }, [letter]);

  const startScramble = () => {
    if (isScrambling || letter === ' ') return;
    setIsScrambling(true);
    
    // Re-roll serif status on hover
    setIsSerif(Math.random() < 0.15);

    let count = 0;
    const maxCount = Math.floor(Math.random() * 6) + 8; // 8 to 14 iterations

    const step = () => {
      if (count >= maxCount) {
        setDisplayLetter(letter);
        setIsScrambling(false);
      } else {
        const randomChar = CHARS[Math.floor(Math.random() * CHARS.length)];
        setDisplayLetter(randomChar);
        count++;
        timerRef.current = setTimeout(step, 30 + Math.random() * 40);
      }
    };
    step();
  };

  useEffect(() => {
    if (trigger) {
      const delay = Math.random() * 150;
      const t = setTimeout(startScramble, delay);
      return () => clearTimeout(t);
    }
  }, [trigger, letter]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <span 
      onMouseEnter={startScramble} 
      style={{ 
        display: 'inline-block',
        cursor: 'inherit',
        userSelect: 'none',
        fontFamily: isScrambling ? 'ScrambleMono' : (isSerif ? '"Playfair Display", serif' : 'inherit'),
        fontWeight: isScrambling ? 900 : (isSerif ? 600 : 'inherit'),
        fontStyle: (!isScrambling && isSerif) ? 'italic' : 'inherit',
        fontSize: (isSerif && !isScrambling) ? '1.18em' : 'inherit',
        transform: (isSerif && !isScrambling) ? 'translateY(0.03em)' : 'none',
        textShadow: isScrambling ? '0 0 1px white, 0 0 1px white' : 'none',
        transition: 'font-weight 0.1s ease',
        verticalAlign: 'baseline',
        '--rx': rand.rx,
        '--ry': rand.ry,
        '--rr': rand.rr,
        '--rs': rand.rs,
      } as React.CSSProperties}
    >
      {displayLetter}
    </span>
  );
};

const ScrambleText = ({ text, trigger }: { text: string, trigger?: boolean }) => {
  return (
    <>
      {text.split('').map((char, i) => (
        <ScrambleLetter key={i} letter={char} trigger={trigger} />
      ))}
    </>
  );
};

const SocialLinkReveal = ({ text, href, onHoverChange, style, isVisible }: { 
  text: string, 
  href: string, 
  onHoverChange?: (h: boolean) => void,
  style?: React.CSSProperties,
  isVisible?: boolean
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <a 
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => {
        setIsHovered(true);
        onHoverChange?.(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onHoverChange?.(false);
      }}
      style={{
        display: "block",
        color: isHovered ? "#fff" : "#000",
        textDecoration: "none",
        fontSize: "3.5vw", // Reduced base size
        fontFamily: "Bheltyne",
        transition: "color 0.4s ease",
        cursor: isHovered ? "none" : "default",
        pointerEvents: isVisible ? "auto" : "none",
        zIndex: 20,
        padding: "10px 20px",
        whiteSpace: "nowrap",
        ...style
      }}
    >
      <ScrambleText text={text} trigger={isHovered} />
    </a>
  );
};

const RotatingScrambleText = ({ words }: { words: string[] }) => {
  const [wordIndex, setWordIndex] = useState(0);
  const [hoveredIndices, setHoveredIndices] = useState<Set<number>>(new Set());
  
  const currentWord = words[wordIndex];
  const nextWord = words[(wordIndex + 1) % words.length];
  const maxLength = Math.max(currentWord.length, nextWord.length);

  const isTransitioning = hoveredIndices.size >= 4;

  const handleLetterComplete = (index: number) => {
    setHoveredIndices((prev) => {
      const newSet = new Set(prev);
      newSet.add(index);
      
      if (newSet.size >= maxLength) {
        setWordIndex((wordIndex + 1) % words.length);
        return new Set();
      }
      return newSet;
    });
  };

  return (
    <div style={{ display: 'inline-block' }}>
      {Array.from({ length: maxLength }).map((_, i) => {
        const isTransitioned = hoveredIndices.has(i);
        const char = isTransitioned 
          ? (nextWord[i] || ' ') 
          : (currentWord[i] || ' ');
        
        return (
          <RotatingLetter 
            key={`${wordIndex}-${i}`} 
            letter={char} 
            locked={isTransitioned}
            isGlitching={isTransitioning && !isTransitioned}
            onComplete={() => handleLetterComplete(i)}
          />
        );
      })}
    </div>
  );
};

const RotatingLetter = ({ letter, locked, onComplete, isGlitching }: { letter: string, locked: boolean, onComplete: () => void, isGlitching: boolean }) => {
  const [displayLetter, setDisplayLetter] = useState(letter);
  const [isScrambling, setIsScrambling] = useState(false);
  const [isSerif, setIsSerif] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const glitchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [rand, setRand] = useState({ rx: 0.5, ry: 0.5, rr: 0.5, rs: 0.5 });

  useEffect(() => {
    setRand({ rx: Math.random(), ry: Math.random(), rr: Math.random(), rs: Math.random() });
    setIsSerif(Math.random() < 0.2 && letter !== ' ');
  }, [letter]);

  const startScramble = () => {
    if (isScrambling) return;
    setIsScrambling(true);
    
    // Re-roll serif status on hover
    setIsSerif(Math.random() < 0.2);

    let count = 0;
    const maxCount = 8 + Math.floor(Math.random() * 6);

    const step = () => {
      if (count >= maxCount) {
        setDisplayLetter(letter);
        setIsScrambling(false);
        if (!locked) onComplete();
      } else {
        const randomChar = CHARS[Math.floor(Math.random() * CHARS.length)];
        setDisplayLetter(randomChar);
        count++;
        timerRef.current = setTimeout(step, 40 + Math.random() * 30);
      }
    };
    step();
  };

  useEffect(() => {
    // If the entire word is in transition but this letter isn't 'locked' (hovered) yet,
    // we scramble it periodically to prevent forming words.
    if (isGlitching && !locked && !isScrambling) {
      const glitchStep = () => {
        const randomChar = CHARS[Math.floor(Math.random() * CHARS.length)];
        setDisplayLetter(randomChar);
        glitchTimerRef.current = setTimeout(glitchStep, 100 + Math.random() * 200);
      };
      glitchStep();
      return () => {
        if (glitchTimerRef.current) clearTimeout(glitchTimerRef.current);
      }
    } else if (!isScrambling) {
      setDisplayLetter(letter);
    }
  }, [isGlitching, locked, isScrambling, letter]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (glitchTimerRef.current) clearTimeout(glitchTimerRef.current);
    };
  }, []);

  return (
    <span 
      onMouseEnter={startScramble} 
      style={{ 
        display: 'inline-block',
        cursor: 'inherit',
        userSelect: 'none',
        minWidth: '0.6em',
        textAlign: 'center',
        fontFamily: (isScrambling || isGlitching) ? 'ScrambleMono' : (isSerif ? '"Playfair Display", serif' : 'inherit'),
        fontWeight: (isScrambling || isGlitching) ? 900 : (isSerif ? 600 : 'inherit'),
        fontStyle: (!isScrambling && !isGlitching && isSerif) ? 'italic' : 'inherit',
        fontSize: (isSerif && !isScrambling && !isGlitching) ? '1.18em' : 'inherit',
        transform: (isSerif && !isScrambling && !isGlitching) ? 'translateY(0.04em)' : 'none',
        textShadow: (isScrambling || isGlitching) ? '0 0 1px white, 0 0 1px white' : 'none',
        transition: 'font-weight 0.1s ease',
        verticalAlign: 'baseline',
        '--rx': rand.rx,
        '--ry': rand.ry,
        '--rr': rand.rr,
        '--rs': rand.rs,
      } as React.CSSProperties}
    >
      {displayLetter === ' ' ? '\u00A0' : displayLetter}
    </span>
  );
};

const StrayChar = ({ isVisible, onAbsorb }: { isVisible?: boolean, onAbsorb: () => void }) => {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [char, setChar] = useState('*');
  const vel = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: 0, y: 0 });
  const orbitTime = useRef(0);
  const initialized = useRef(false);

  useEffect(() => {
    if (!isVisible) return;
    if (!initialized.current) {
      posRef.current = { 
        x: window.innerWidth * 0.2 + Math.random() * window.innerWidth * 0.6, 
        y: window.innerHeight * 0.2 + Math.random() * window.innerHeight * 0.6 
      };
      setPos({ ...posRef.current });
      setChar(CHARS[Math.floor(Math.random() * CHARS.length)]);
      initialized.current = true;
    }
    
    let raf: number;
    let lastTime = performance.now();
    let mouse = { x: -1000, y: -1000 };
    let mouseVel = { x: 0, y: 0 };
    
    const onMouse = (e: MouseEvent) => {
      mouseVel.x = e.clientX - mouse.x;
      mouseVel.y = e.clientY - mouse.y;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener('mousemove', onMouse);
    
    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 16, 2);
      lastTime = time;
      
      const p = posRef.current;
      const v = vel.current;
      
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      // Drift
      v.x += (Math.random() - 0.5) * 0.15 * dt;
      v.y += (Math.random() - 0.5) * 0.15 * dt;

      // Cursor interaction
      if (dist < 180) {
        // Pull towards cursor a bit stronger
        const pull = 1.6 / (dist + 5);
        v.x += dx * pull * dt;
        v.y += dy * pull * dt;
        
        // Perpendicular orbital force
        const orbitDirX = dy / dist;
        const orbitDirY = -dx / dist;
        v.x += orbitDirX * 1.5 * dt;
        v.y += orbitDirY * 1.5 * dt;
        
        // Mouse velocity pushes it if moving fast (simulate blowing it away)
        const mSpeed = Math.sqrt(mouseVel.x**2 + mouseVel.y**2);
        if (mSpeed > 35) {
           v.x += mouseVel.x * 0.05 * dt;
           v.y += mouseVel.y * 0.05 * dt;
        }
        
        // Extremely easy capture conditions
        if (dist < 120) {
           orbitTime.current += dt;
           if (orbitTime.current > 20) {
             // Absorbed!
             onAbsorb();
             orbitTime.current = 0;
             p.x = window.innerWidth * 0.1 + Math.random() * window.innerWidth * 0.8;
             p.y = window.innerHeight * 0.1 + Math.random() * window.innerHeight * 0.8;
             v.x = 0; v.y = 0;
             setChar(CHARS[Math.floor(Math.random() * CHARS.length)]);
           }
        } else {
           orbitTime.current = Math.max(0, orbitTime.current - dt * 0.8);
        }
      } else {
        orbitTime.current = Math.max(0, orbitTime.current - dt * 2);
      }
      
      // Damping
      v.x *= 0.94;
      v.y *= 0.94;
      
      p.x += v.x * dt;
      p.y += v.y * dt;
      
      if (p.x < 0) { p.x = 0; v.x *= -1; }
      if (p.x > window.innerWidth) { p.x = window.innerWidth; v.x *= -1; }
      if (p.y < 0) { p.y = 0; v.y *= -1; }
      if (p.y > window.innerHeight) { p.y = window.innerHeight; v.y *= -1; }
      
      setPos({ ...p });
      
      mouseVel.x *= 0.8;
      mouseVel.y *= 0.8;
      
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame((time) => { lastTime = time; loop(time); });
    
    return () => {
       window.removeEventListener('mousemove', onMouse);
       cancelAnimationFrame(raf);
    };
  }, [isVisible, onAbsorb]);
  
  return (
    <div style={{
      position: 'absolute',
      left: pos.x,
      top: pos.y,
      transform: 'translate(-50%, -50%)',
      fontFamily: 'ScrambleMono, "JetBrains Mono", "Fira Code", monospace',
      fontSize: '18px',
      color: `rgba(255, 255, 255, ${0.15 + (Math.min(orbitTime.current, 100) / 100) * 0.85})`,
      textShadow: orbitTime.current > 20 ? `0 0 ${orbitTime.current / 5}px white` : 'none',
      zIndex: 1,
      pointerEvents: 'none',
      userSelect: 'none',
    }}>
      {char}
    </div>
  );
};

export default function RevealedContent({ 
  onHoverChange,
  isVisible = false
}: { 
  onHoverChange?: (isHovering: boolean) => void,
  isVisible?: boolean
}) {
  const [absorbCount, setAbsorbCount] = useState(0);
  const [demonRealm, setDemonRealm] = useState(false);

  useEffect(() => {
    const handleDemon = () => setDemonRealm(true);
    window.addEventListener('summon-demon', handleDemon);
    return () => window.removeEventListener('summon-demon', handleDemon);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('power-up', { detail: absorbCount }));
    
    if (absorbCount >= 5) {
      const hijackClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        window.dispatchEvent(new CustomEvent('shatter-the-world', { detail: { x: e.clientX, y: e.clientY } }));
        
        const shatterRadius = 250;
        const els = document.querySelectorAll('.shattered-world span, .shattered-world img, .shattered-world svg, .shattered-world a');
        els.forEach(el => {
           const rect = el.getBoundingClientRect();
           const cx = rect.left + rect.width/2;
           const cy = rect.top + rect.height/2;
           const dist = Math.hypot(cx - e.clientX, cy - e.clientY);
           if (dist < shatterRadius) {
              el.classList.add('shattered-active');
              if (!(el as HTMLElement).style.getPropertyValue('--rx')) {
                 (el as HTMLElement).style.setProperty('--rx', Math.random().toString());
                 (el as HTMLElement).style.setProperty('--ry', Math.random().toString());
                 (el as HTMLElement).style.setProperty('--rr', Math.random().toString());
                 (el as HTMLElement).style.setProperty('--rs', Math.random().toString());
              }
           }
        });
      };
      
      window.addEventListener('click', hijackClick, true);
      return () => {
        window.removeEventListener('click', hijackClick, true);
      };
    }
  }, [absorbCount]);

  return (
    <>
    {demonRealm && (
      <div style={{
         position: 'fixed',
         top: 0, left: 0, width: '100vw', height: '100vh',
         backgroundColor: 'rgba(50, 0, 0, 0.4)',
         mixBlendMode: 'color-burn',
         pointerEvents: 'none',
         zIndex: 99999,
         animation: 'demonPulse 0.15s infinite alternate, demonVignette 2s infinite alternate',
      }}>
        <style>{`
          @keyframes demonPulse { 
             0% { opacity: 0.9; backdrop-filter: blur(0px); background-color: rgba(50, 0, 0, 0.4); mix-blend-mode: color-burn; } 
             25% { opacity: 1; backdrop-filter: blur(4px); background-color: rgba(150, 0, 0, 0.6); mix-blend-mode: color-dodge; } 
             48% { opacity: 1; backdrop-filter: blur(0px); background-color: rgba(255, 255, 255, 0.9); mix-blend-mode: difference; } /* Flashbang */
             50% { opacity: 0.5; backdrop-filter: blur(0px); background-color: rgba(0, 0, 0, 0.9); mix-blend-mode: difference; }
             75% { opacity: 1; backdrop-filter: blur(2px); background-color: rgba(255, 0, 0, 0.3); mix-blend-mode: hard-light; }
             100% { opacity: 0.8; backdrop-filter: blur(8px); background-color: rgba(100, 0, 0, 0.8); mix-blend-mode: exclusion; } 
          }
          @keyframes demonVignette { 
             0% { box-shadow: inset 0 0 100px #ff0000; } 
             50% { box-shadow: inset 0 0 800px #000000; }
             100% { box-shadow: inset 0 0 300px #ff0000; } 
          }
          @keyframes textGlitch {
             0% { transform: translate(0, 0) scale(1) skew(0deg); opacity: 1; }
             20% { transform: translate(-20px, 10px) scale(1.1) skew(10deg); opacity: 0.8; filter: hue-rotate(90deg); }
             40% { transform: translate(30px, -30px) scale(0.9) skew(-20deg); opacity: 1; filter: contrast(200%); }
             42% { transform: translate(-100px, 50px) scale(3) skew(50deg); opacity: 0; } /* Disappear momentarily */
             60% { transform: translate(-10px, 40px) scale(1.5) skew(5deg); opacity: 1; filter: invert(100%); }
             80% { transform: translate(40px, -10px) scale(0.8) skew(-15deg); opacity: 0.9; filter: blur(2px); }
             100% { transform: translate(0, 0) scale(1.2) skew(30deg); opacity: 1; }
          }
          @keyframes jumpScareFlash {
             0%, 80%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
             85% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.1) rotate(2deg); filter: invert(1); }
             90% { opacity: 1; transform: translate(-50%, -50%) scale(2) rotate(-5deg); filter: saturate(5) drop-shadow(0 0 50px red); }
             95% { opacity: 0.9; transform: translate(-50%, -50%) scale(1.5) rotate(1deg); filter: contrast(5) invert(1); }
          }
          @keyframes violentShake {
             0% { transform: translate(0, 0) rotate(0deg); }
             25% { transform: translate(-15px, 15px) rotate(-2deg); }
             50% { transform: translate(15px, -15px) rotate(2deg); }
             75% { transform: translate(-15px, -15px) rotate(1deg); }
             100% { transform: translate(15px, 15px) rotate(-1deg); }
          }
          body { 
            filter: contrast(300%) saturate(400%) hue-rotate(-20deg) invert(10%); 
            background-color: #1a0000 !important; 
            overflow: hidden !important; 
            animation: violentShake 0.1s infinite;
          }
        `}</style>
        {Array.from({length: 80}).map((_, i) => (
          <div key={i} style={{
             position: 'absolute',
             top: (Math.random()*110 - 5) + '%',
             left: (Math.random()*110 - 5) + '%',
             color: Math.random() > 0.8 ? '#ffffff' : '#ff0000', // occasional blinding white
             fontFamily: 'ScrambleMono, "JetBrains Mono", monospace',
             fontWeight: 900,
             fontSize: Math.random() > 0.9 ? (80 + Math.random()*100) + 'px' : (20 + Math.random()*40) + 'px', // occasional massive text
             whiteSpace: 'nowrap',
             textShadow: '0 0 10px #ff0000, 0 0 40px #aa0000',
             opacity: Math.random() * 0.9 + 0.1,
             animation: 'textGlitch ' + (0.05 + Math.random()*0.2) + 's infinite random'
          }}>
             <span style={{ 
                display: 'inline-block',
                transform: 'rotate(' + ((Math.random()-0.5)*180) + 'deg)'
             }}>
                {["I SEE YOU", "ERROR", "SYSTEM FAILURE", "666", "SUFFER", "CANNOT ESCAPE", "\u2620", "\uD83E\uDE78", "NO ESCAPE", "YOU DID THIS", "WAKE UP", "IT HURTS", "WHY", "THEY ARE LOOKING", "DONT LOOK BEHIND YOU", "RUN", "IT IS IN THE WALLS", "NULL", "DELETING...", "0x0000DEAD", "F L E S H", "DO NOT SLEEP", "WHERE ARE YOU", "TEETH", "LOOK AT ME", "STOP", "NOT REAL", "LET ME IN", "TOO LATE"][Math.floor(Math.random()*29)]}
             </span>
          </div>
        ))}
        {/* Horrifying Subliminal Flash Image */}
        <div style={{
           position: 'fixed',
           top: '50%', left: '50%',
           width: '100vw', height: '100vh',
           transform: 'translate(-50%, -50%)',
           display: 'flex',
           alignItems: 'center',
           justifyContent: 'center',
           zIndex: 2147483647, // Max z-index
           mixBlendMode: 'plus-lighter',
           animation: 'jumpScareFlash 3s infinite',
           pointerEvents: 'none',
           opacity: 0 // Default to 0, managed by animation
        }}>
           <img 
              src="/assets/haunted_face.png" 
              alt=""
              style={{
                 width: '120vw', // Extra wide to obscure edges
                 height: '120vh',
                 objectFit: 'cover',
                 filter: 'contrast(300%) grayscale(100%)',
                 opacity: 0.9
              }} 
           />
        </div>
        
        {/* Massive flashing screen-covering horror faces/symbols */}
        <div style={{
           position: 'fixed',
           top: '50%', left: '50%',
           transform: 'translate(-50%, -50%) scale(1)',
           fontSize: '800px',
           color: 'rgba(255, 0, 0, 0.4)',
           textShadow: '0 0 100px red, 0 0 200px darkred',
           mixBlendMode: 'screen',
           animation: 'demonPulse 0.1s infinite alternate-reverse, violentShake 0.05s infinite',
           pointerEvents: 'none'
        }}>
           \u2620
        </div>
      </div>
    )}
    <style>{`
      .shattered-world span {
         transition: transform 1.5s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 1.5s ease, filter 1.5s ease !important;
      }
      .shattered-world span.shattered-active {
         transform: translate(calc(100vw * (var(--rx) - 0.5) * 2.5), calc(100vh * (var(--ry) - 0.5) * 2.5)) 
                    rotate(calc(720deg * (var(--rr) - 0.5))) scale(calc(var(--rs) * 3 + 0.5)) !important;
         opacity: 0 !important;
         filter: blur(10px) !important;
         pointer-events: none !important;
      }
      .shattered-world img {
         transition: all 1.5s ease-in !important;
      }
      .shattered-world img.shattered-active {
         transform: scale(0.6) translateY(120vh) rotate(-15deg) !important;
         opacity: 0 !important;
      }
      .shattered-world svg {
         transition: all 2s ease-out !important;
      }
      .shattered-world svg.shattered-active {
         transform: scale(5) rotate(360deg) !important;
         opacity: 0 !important;
      }
      /* When in shattering mode, prevent hovering and show regular cursor over buttons to trick user */
      .shattering-mode a, .shattering-mode button, .shattering-mode span {
         cursor: inherit !important;
      }
    `}</style>
    <div
      className={"shattered-world" + (absorbCount >= 5 ? " shattering-mode" : "")}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        justifyContent: "left",
        alignItems: "start",
        background: "#000",
        zIndex: 0,
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? "auto" : "none",
        transition: "opacity 0.3s ease-in-out",
        userSelect: "none",
      }}
    >
      <div style={{ position: "relative", display: "inline-block" }}>
        <img
          src="/profile.jpg"
          alt="Profile"
          style={{
            maxWidth: "80vw",
            maxHeight: "60vh",
            filter: "grayscale(100%)",
            aspectRatio: "4 / 5",
            objectFit: "cover",
            display: "block",
          }}
        />
        <a 
          href="mailto:krishnavyshakr@gmail.com" 
          onMouseEnter={() => onHoverChange?.(true)}
          onMouseLeave={() => onHoverChange?.(false)}
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: '100%', 
            fontSize: '1.2vw', 
            color: '#fff', 
            textDecoration: 'none',
            fontFamily: "Bheltyne",
            fontWeight: 300,
            zIndex: 10,
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            cursor: 'none',
            pointerEvents: isVisible ? 'auto' : 'none',
          }}
        >
          CONTACT
        </a>
        
        {/* Rotating Badge */}
        <div style={{
          position: "absolute",
          bottom: "-40px", 
          right: "-40px",
          width: "120px",  
          height: "120px",
          zIndex: 10,
          background: "transparent"
        }}>
          <div className="rotating-badge" style={{
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}>
            <svg viewBox="0 0 120 120" style={{ width: "100%", height: "100%", padding: "10px"}}>
              <defs>
                <path id="badgePath" d="M 60, 60 m -42, 0 a 42,42 0 1,1 84,0 a 42,42 0 1,1 -84,0" />
              </defs>
              <circle cx="60" cy="60" r="55" fill="none" />
              <text 
                fontFamily="system-ui, -apple-system, sans-serif" 
                fontSize="19" 
                fontWeight="900" 
                fill="white"
                letterSpacing="1"
              >
                <textPath href="#badgePath">
                  HIRE NOW • AVAILABLE •
                </textPath>
              </text>
              <circle cx="60" cy="60" r="32" fill="none"  />
            </svg>
          </div>
        </div>
      </div>
      
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          margin: 0,
          padding: 0,
          fontFamily: "Bheltyne",
          fontSize: "6.6vw",
          lineHeight: 2.47,
          color: "#fff",
          zIndex: 5,
        }}
      >
        <ScrambleText text="KRISHNA" />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          margin: 0,
          padding: 0,
          fontFamily: "Bheltyne",
          fontSize: "8vw",
          lineHeight: 0.45,
          color: "#fff",
          zIndex: 5,
        }}
      >
        <ScrambleText text="VYSHAK" />
      </div>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "100%",
          margin: 0,
          padding: 0,
          fontFamily: "Bheltyne",
          fontSize: "min(8vw, 11.5vh)",
          lineHeight: 1.2,
          color: "#fff",
          transform: "rotate(90deg)",
          transformOrigin: "0 0",
          whiteSpace: "nowrap",
          zIndex: 5,
        }}
      >
        <RotatingScrambleText words={["FREELANCER", "DESIGNER", "DEVELOPER", "THINKER"]} />
      </div>

      {/* Chaotic Ambience Texts */}
      <div style={{
        position: "absolute",
        top: "30px",
        left: "30px",
        fontFamily: "Bheltyne",
        fontSize: "0.8vw",
        color: "#fff",
        zIndex: 5,
        opacity: 0.6,
        display: "flex",
        flexDirection: "column",
        gap: "2px"
      }}>
        <div><ScrambleText text="FOLIO  2026" /></div>
        <div style={{ fontSize: "0.5vw", opacity: 0.5 }}><ScrambleText text="VOL. 01" /></div>
      </div>

      <a 
        href="/archive"
        onMouseEnter={() => onHoverChange?.(true)}
        onMouseLeave={() => onHoverChange?.(false)}
        style={{
          position: "absolute",
          bottom: "30px",
          right: "30px",
          fontFamily: "Bheltyne",
          fontSize: "0.7vw",
          color: "#fff",
          zIndex: 5,
          letterSpacing: "0.2em",
          opacity: 0.8,
          textDecoration: "none",
          cursor: "none",
          pointerEvents: isVisible ? "auto" : "none"
        }}
      >
        <ScrambleText text="( ARCHIVE )" />
      </a>

      <div style={{
        position: "absolute",
        bottom: "15%",
        left: "30%",
        fontFamily: "Bheltyne",
        fontSize: "0.5vw",
        color: "#fff",
        zIndex: 1,
        opacity: 0.15,
        pointerEvents: "none",
        transition: "text-shadow 0.2s ease"
      }}>
        <ScrambleText text={`SYSTEM_INIT_COMPLETE // 0x${(1911 + absorbCount).toString(16).toUpperCase()}`} />
      </div>

      {absorbCount > 0 && (
        <div style={{
          position: "absolute",
          bottom: "13%", // slightly below the init string
          left: "30%",
          fontFamily: "Bheltyne",
          fontSize: "0.4vw",
          color: "#fff",
          zIndex: 1,
          opacity: 0.3,
          pointerEvents: "none",
          animation: "fadeIn 0.5s ease"
        }}>
          <ScrambleText text={`ORBITAL_ANOMALIES_CLEARED :: ${absorbCount}`} />
        </div>
      )}

      <div style={{
        position: "absolute",
        top: "10%",
        left: "40%",
        fontFamily: "Bheltyne",
        fontSize: "0.4vw",
        color: "#fff",
        zIndex: 1,
        opacity: 0.1,
        pointerEvents: "none",
        whiteSpace: "nowrap"
      }}>
        <ScrambleText text="LOADING_CREATIVE_ASSETS... SUCCESS" />
      </div>

      <StrayChar 
        isVisible={isVisible} 
        onAbsorb={() => {
          setAbsorbCount(c => c + 1);
          onHoverChange?.(true);
          setTimeout(() => onHoverChange?.(false), 300);
        }} 
      />

      {/* Social Links Reveal Area - Random & Large */}
      <div style={{
        position: "absolute",
        top: "45%",
        left: "55%",
        transform: "translate(-50%, -50%)",
        width: "40vw", // Slightly wider
        height: "50vh", // Taller to prevent vertical overlap
        zIndex: 10,
        pointerEvents: "none",
      }}>
        <SocialLinkReveal 
          text="LINKEDIN" 
          href="https://linkedin.com/in/krishnavyshak" 
          onHoverChange={onHoverChange}
          isVisible={isVisible}
          style={{ 
            position: 'absolute', 
            top: '5%', 
            left: '0%', 
            fontSize: '4.2vw'
          }} 
        />
        <SocialLinkReveal 
          text="INSTAGRAM" 
          href="https://instagram.com/navyshark_" 
          onHoverChange={onHoverChange}
          isVisible={isVisible}
          style={{ 
            position: 'absolute', 
            top: '38%', 
            right: '5%', 
            fontSize: '4.7vw'
          }} 
        />
        <SocialLinkReveal 
          text="GITHUB" 
          href="https://github.com/krishnavyshakr" 
          onHoverChange={onHoverChange}
          isVisible={isVisible}
          style={{ 
            position: 'absolute', 
            bottom: '5%', 
            left: '10%', 
            fontSize: '4vw'
          }} 
        />
      </div>
    </div>
    </>
  );
}

