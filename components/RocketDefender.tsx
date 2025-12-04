import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Trail, Alien, Particle, GameState, SmokePuff } from '../types';
import { Play, RotateCcw, ShieldAlert, Rocket as RocketIcon } from 'lucide-react';

const SPAWN_RATE_INITIAL = 120; // Frames between spawns
const ALIEN_SPEED_BASE = 1.5;
const GROUND_HEIGHT_PERCENT = 0.15; // Bottom 15% is ground

const RocketDefender: React.FC = () => {
  // UI State
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();

  // Game Entities Refs (Mutable for performance in game loop)
  const trails = useRef<Trail[]>([]);
  const aliens = useRef<Alien[]>([]);
  const particles = useRef<Particle[]>([]);
  const frameCount = useRef(0);
  const scoreRef = useRef(0); // Ref for loop access
  const spawnRate = useRef(SPAWN_RATE_INITIAL);
  const difficultyMultiplier = useRef(1);

  // Initialize Game
  const startGame = () => {
    trails.current = [];
    aliens.current = [];
    particles.current = [];
    scoreRef.current = 0;
    setScore(0);
    frameCount.current = 0;
    spawnRate.current = SPAWN_RATE_INITIAL;
    difficultyMultiplier.current = 1;
    setGameState('PLAYING');
  };

  // Helper: Create Explosion
  const createExplosion = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      particles.current.push({
        id: Math.random(),
        pos: { x, y },
        vel: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed,
        },
        color,
        life: 1.0,
        maxLife: 1.0,
        size: Math.random() * 3 + 1,
      });
    }
  };

  // Game Loop
  const loop = useCallback(() => {
    if (gameState !== 'PLAYING') return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    
    if (!canvas || !ctx) return;

    // Clear Canvas
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Stars (Static Background Effect)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for(let i=0; i<20; i++) {
        // Simple procedural stars based on frame to save state
        const sx = ((frameCount.current * 0.1 + i * 137) % canvas.width);
        const sy = ((i * 313) % canvas.height);
        ctx.fillRect(sx, sy, 2, 2);
    }

    const groundY = canvas.height * (1 - GROUND_HEIGHT_PERCENT);

    // --- Update Logic ---

    // 1. Spawning Aliens
    if (frameCount.current % Math.floor(spawnRate.current) === 0) {
      const radius = 20;
      // Ensure they stay within bounds
      const x = Math.random() * (canvas.width - radius * 2) + radius;
      aliens.current.push({
        id: Date.now() + Math.random(),
        pos: { x, y: -radius * 2 },
        vel: { x: 0, y: ALIEN_SPEED_BASE * difficultyMultiplier.current },
        radius,
        hp: 2,
        maxHp: 2,
        active: true,
        pulseOffset: Math.random() * Math.PI,
      });

      // Increase difficulty slightly
      if (spawnRate.current > 30) spawnRate.current -= 0.5;
      if (difficultyMultiplier.current < 2.5) difficultyMultiplier.current += 0.002;
    }

    // 2. Update Trails
    trails.current.forEach(t => {
      // Significantly slower fade for longer lasting smoke (was 0.03)
      t.life -= 0.005; 
    });
    trails.current = trails.current.filter(t => t.life > 0);

    // 3. Update Aliens
    let gameOverTriggered = false;

    aliens.current.forEach(alien => {
      alien.pos.y += alien.vel.y;

      // Check Game Over (Alien hit ground)
      if (alien.pos.y + alien.radius >= groundY && alien.active) {
        gameOverTriggered = true;
      }
    });

    if (gameOverTriggered) {
      setGameState('GAME_OVER');
      if (scoreRef.current > highScore) setHighScore(scoreRef.current);
      setScore(scoreRef.current); // Sync final score
      return; // Stop loop
    }

    // 4. Update Particles
    particles.current.forEach(p => {
      p.pos.x += p.vel.x;
      p.pos.y += p.vel.y;
      p.life -= 0.02;
      p.vel.y += 0.05; // Gravity
    });

    // Filter inactive entities
    aliens.current = aliens.current.filter(a => a.active);
    particles.current = particles.current.filter(p => p.life > 0);

    // Sync score to UI every 10 frames (optimization)
    if (frameCount.current % 10 === 0) {
      setScore(scoreRef.current);
    }

    frameCount.current++;

    // --- Draw Logic ---

    // Draw Ground
    const gradient = ctx.createLinearGradient(0, groundY, 0, canvas.height);
    gradient.addColorStop(0, '#10b981'); // Emerald 500
    gradient.addColorStop(1, '#064e3b'); // Emerald 900
    ctx.fillStyle = gradient;
    ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
    
    // Ground Pattern/Texture
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let x = 0; x < canvas.width; x += 40) {
        ctx.fillRect(x + 10, groundY, 10, canvas.height - groundY);
    }
    
    // Draw "Launch Zone" Text
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '700 12px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText("TAP HERE TO LAUNCH", canvas.width / 2, groundY + 30);


    // Draw Smoke Trails (Puff based)
    trails.current.forEach(t => {
      // "Threshold" moves from Ground (startY) to Top (endY) as life goes 1 -> 0.
      // We calculate a "cutoff line" that rises up the screen.
      // Using Math.pow to make it start slow and speed up slightly, or linear.
      // Linear is better for "equal amount of time".
      const trailHeight = t.startY - t.endY;
      const progress = 1 - t.life;
      
      // The cutoff line: anything below this Y (physically lower on screen, higher Y value) fades out.
      // We want the fade to travel UP.
      const cutoffY = t.startY - (trailHeight * (progress * 1.1)); // 1.1 ensures it finishes fully
      
      t.puffs.forEach(p => {
        const puffY = t.endY + p.yOffset;
        
        // If the puff is above the cutoff (numerically smaller Y), it's fully visible.
        // If it's below, we check how far below to soft fade.
        if (puffY < cutoffY + 100) { // +100 acts as the fade tail length
            
            let puffAlpha = 1.0;
            
            // Soft fade logic based on distance to cutoff
            // If puffY is greater than cutoffY, it should be fading out
            if (puffY > cutoffY) {
                const distance = puffY - cutoffY;
                const fadeLength = 100; // The band of fading smoke
                puffAlpha = 1 - (distance / fadeLength);
            }
            
            // Apply global life fade as well so the very top eventually fades too
            puffAlpha *= Math.min(1, t.life * 2);
            
            if (puffAlpha > 0) {
                ctx.beginPath();
                // Expansion: Grows as it ages. 
                // Since life is slow (0.005), (1-life) grows slowly 0->1.
                // We multiply by 20 to get significant puff growth over time.
                const expansion = (1 - t.life) * 20;
                
                ctx.arc(t.x + p.xOffset, puffY, p.size + expansion, 0, Math.PI * 2);
                
                // Color: Starts white-ish, turns grey
                const greyLevel = Math.floor(150 + (t.life * 105)); // 150 (grey) -> 255 (white)
                // Reduced max opacity from 0.6 to 0.25 for fainter smoke
                ctx.fillStyle = `rgba(${greyLevel}, ${greyLevel}, ${greyLevel}, ${puffAlpha * 0.25})`;
                ctx.fill();
            }
        }
      });
    });

    // Draw Aliens
    aliens.current.forEach(a => {
      // Pulse effect
      const pulse = Math.sin(frameCount.current * 0.1 + a.pulseOffset) * 2;

      // Inner Core (Vulnerable part)
      ctx.fillStyle = '#a21caf'; // Fuchsia 700
      ctx.beginPath();
      ctx.arc(a.pos.x, a.pos.y, a.radius - 5, 0, Math.PI * 2);
      ctx.fill();

      // Outer Shield (If HP > 1)
      if (a.hp > 1) {
        ctx.strokeStyle = '#06b6d4'; // Cyan 500
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(a.pos.x, a.pos.y, a.radius + pulse, 0, Math.PI * 2);
        ctx.stroke();
        
        // Shield Glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#06b6d4';
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Damaged effect (smoke/cracks)
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(a.pos.x + 5, a.pos.y - 5, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw Particles
    particles.current.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    });

    requestRef.current = requestAnimationFrame(loop);
  }, [gameState]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle User Input (Launch)
  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const groundY = canvas.height * (1 - GROUND_HEIGHT_PERCENT);

    // Only fire if clicking in the "Ground" area
    if (y >= groundY) {
      // Instant Hit / Raycast Logic
      const launchX = x;
      const launchY = groundY;
      
      // Find aliens that intersect with the vertical beam
      const hitCandidates = aliens.current.filter(a => {
        if (!a.active) return false;
        // Check horizontal overlap with some tolerance
        return Math.abs(a.pos.x - launchX) < (a.radius + 10);
      });

      // Sort by vertical position descending (closest to the ground first)
      hitCandidates.sort((a, b) => b.pos.y - a.pos.y);

      const target = hitCandidates[0];
      let endY = 0; // Default to top of screen if miss

      if (target) {
        endY = target.pos.y + target.radius; // Hit the bottom of the alien
        
        // Damage Logic
        target.hp -= 1;
        
        if (target.hp === 1) {
            // Shield broken
            createExplosion(target.pos.x, target.pos.y, '#06b6d4', 8); // Cyan sparks
            scoreRef.current += 50;
        } else if (target.hp <= 0) {
            // Destroyed
            createExplosion(target.pos.x, target.pos.y, '#d946ef', 15); // Magenta explosion
            target.active = false;
            scoreRef.current += 150;
        }
      }

      // Create Smoke Puffs
      const dist = launchY - endY;
      // High density for better smoke look (every 6px)
      const steps = Math.ceil(dist / 6); 
      const puffs: SmokePuff[] = [];
      
      for(let i=0; i <= steps; i++) {
        puffs.push({
            yOffset: i * 6, // Relative to endY (top), increasing downwards
            xOffset: (Math.random() - 0.5) * 12, // Wiggle
            size: 4 + Math.random() * 6 // Varied puff size
        });
      }

      // Add Smoke Trail
      trails.current.push({
        id: Date.now(),
        x: launchX,
        startY: launchY,
        endY: endY,
        life: 1.0,
        maxLife: 1.0,
        puffs: puffs,
      });

      // Muzzle Flash
      createExplosion(launchX, launchY, '#fbbf24', 5);
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full relative font-sans select-none">
      <canvas
        ref={canvasRef}
        className="block w-full h-full cursor-crosshair touch-none"
        onMouseDown={handleTap}
        onTouchStart={handleTap}
      />

      {/* UI Overlay: Score */}
      <div className="absolute top-4 left-0 w-full flex justify-between px-6 pointer-events-none">
        <div className="flex flex-col text-cyan-400">
            <span className="text-xs uppercase tracking-widest opacity-80">Score</span>
            <span className="text-2xl font-bold">{score.toString().padStart(6, '0')}</span>
        </div>
        <div className="flex flex-col text-fuchsia-400 text-right">
            <span className="text-xs uppercase tracking-widest opacity-80">Best</span>
            <span className="text-2xl font-bold">{highScore.toString().padStart(6, '0')}</span>
        </div>
      </div>

      {/* UI Overlay: Start Screen */}
      {gameState === 'START' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-8 backdrop-blur-sm z-10 text-center">
            <div className="mb-8 p-4 rounded-full bg-cyan-900/30 ring-4 ring-cyan-500/20 animate-pulse">
                <RocketIcon size={48} className="text-cyan-400" />
            </div>
            <h1 className="text-4xl font-black text-white mb-2 tracking-tighter uppercase">Rocket<br/><span className="text-cyan-400">Defender</span></h1>
            <p className="text-zinc-400 mb-8 max-w-[200px] leading-relaxed">
                Tap the <span className="text-emerald-400 font-bold">GREEN GROUND</span> zone to launch rockets. 
                <br/><br/>
                Break enemy shields <span className="text-cyan-400">(Blue)</span> then destroy the core <span className="text-fuchsia-400">(Purple)</span>.
            </p>
            <button 
                onClick={startGame}
                className="group relative px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xl rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(6,182,212,0.5)] flex items-center gap-2"
            >
                <Play size={24} className="fill-current" />
                START MISSION
            </button>
        </div>
      )}

      {/* UI Overlay: Game Over */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center p-8 backdrop-blur-md z-10 text-center animate-in fade-in duration-300">
             <div className="mb-6 p-4 rounded-full bg-red-500/20 ring-4 ring-red-500/40">
                <ShieldAlert size={48} className="text-red-500" />
            </div>
            <h2 className="text-4xl font-black text-white mb-2">BREACH DETECTED</h2>
            <p className="text-red-200 mb-6">The aliens reached the surface.</p>
            
            <div className="bg-black/40 p-6 rounded-2xl mb-8 w-full max-w-[280px] border border-white/10">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-zinc-400 text-sm">FINAL SCORE</span>
                    <span className="text-3xl font-bold text-white">{score}</span>
                </div>
                {score >= highScore && score > 0 && (
                    <div className="text-yellow-400 text-xs font-bold uppercase tracking-wider bg-yellow-400/10 py-1 px-2 rounded w-fit mx-auto">
                        New High Score!
                    </div>
                )}
            </div>

            <button 
                onClick={startGame}
                className="px-8 py-4 bg-white hover:bg-zinc-200 text-black font-bold text-xl rounded-full transition-all hover:scale-105 active:scale-95 shadow-xl flex items-center gap-2"
            >
                <RotateCcw size={24} />
                RETRY
            </button>
        </div>
      )}
    </div>
  );
};

export default RocketDefender;