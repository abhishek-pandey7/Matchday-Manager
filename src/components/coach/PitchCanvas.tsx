'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useCoachStore } from '@/store/matchStore';
import { TEAMS } from '@/lib/simulation/data';
import { MatchState, PlayerPosition } from '@/lib/simulation/types';

export default function PitchCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  // Use refs for all animation data to avoid re-renders
  const currentFrameRef = useRef(0);
  const animationFramesRef = useRef<MatchState[]>([]);
  const isAnimatingRef = useRef(false);
  const animationSpeedRef = useRef(5);
  const teamARef = useRef(TEAMS[0]);
  const teamBRef = useRef(TEAMS[1]);

  // Transition state for smooth interpolation
  const ballTransitionRef = useRef({
    startX: 50, startY: 50, endX: 50, endY: 50, progress: 1,
  });
  const playerTransitionsRef = useRef<Map<string, {
    startX: number; startY: number; endX: number; endY: number;
  }>>(new Map());
  const prevFrameIdxRef = useRef(-1);

  // Goal celebration state
  const goalFlashRef = useRef({ active: false, alpha: 0, teamIdx: 0 });

  // Ball trail history
  const ballTrailRef = useRef<{ x: number; y: number; age: number }[]>([]);

  // Player micro-movement state for idle animation
  const playerMicroMovementsRef = useRef<Map<string, {
    offsetX: number; offsetY: number;
    targetOffsetX: number; targetOffsetY: number;
    timer: number;
  }>>(new Map());

  // Subscribe to store changes and sync to refs
  useEffect(() => {
    const unsub = useCoachStore.subscribe((state) => {
      currentFrameRef.current = state.currentFrame;
      animationFramesRef.current = state.animationFrames;
      isAnimatingRef.current = state.isAnimating;
      animationSpeedRef.current = state.animationSpeed;

      const teamA = TEAMS.find(t => t.id === state.teamAId);
      const teamB = TEAMS.find(t => t.id === state.teamBId);
      if (teamA) teamARef.current = teamA;
      if (teamB) teamBRef.current = teamB;
    });

    // Initialize refs from current state
    const state = useCoachStore.getState();
    currentFrameRef.current = state.currentFrame;
    animationFramesRef.current = state.animationFrames;
    isAnimatingRef.current = state.isAnimating;
    animationSpeedRef.current = state.animationSpeed;
    const teamA = TEAMS.find(t => t.id === state.teamAId);
    const teamB = TEAMS.find(t => t.id === state.teamBId);
    if (teamA) teamARef.current = teamA;
    if (teamB) teamBRef.current = teamB;

    return unsub;
  }, []);

  // Easing functions
  const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const drawPitch = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // Pitch background with gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#2a8a4a');
    gradient.addColorStop(0.5, '#2d9a50');
    gradient.addColorStop(1, '#2a8a4a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Stripes
    const stripeWidth = w / 16;
    for (let i = 0; i < 16; i += 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(i * stripeWidth, 0, stripeWidth, h);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;

    const pad = 20;

    // Outer boundary
    ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);

    // Halfway line
    ctx.beginPath();
    ctx.moveTo(w / 2, pad);
    ctx.lineTo(w / 2, h - pad);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, h * 0.14, 0, Math.PI * 2);
    ctx.stroke();

    // Center spot
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Penalty areas
    const penAreaW = w * 0.17;
    const penAreaH = h * 0.44;
    ctx.strokeRect(pad, h / 2 - penAreaH / 2, penAreaW, penAreaH);
    ctx.strokeRect(w - pad - penAreaW, h / 2 - penAreaH / 2, penAreaW, penAreaH);

    // Goal areas
    const goalAreaW = w * 0.06;
    const goalAreaH = h * 0.22;
    ctx.strokeRect(pad, h / 2 - goalAreaH / 2, goalAreaW, goalAreaH);
    ctx.strokeRect(w - pad - goalAreaW, h / 2 - goalAreaH / 2, goalAreaW, goalAreaH);

    // Goals (net effect)
    const goalW = 10;
    const goalH = h * 0.12;
    // Left goal
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(pad - goalW, h / 2 - goalH / 2, goalW, goalH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.5;
    for (let ny = h / 2 - goalH / 2; ny < h / 2 + goalH / 2; ny += 6) {
      ctx.beginPath();
      ctx.moveTo(pad - goalW, ny);
      ctx.lineTo(pad, ny);
      ctx.stroke();
    }
    for (let nx = pad - goalW; nx < pad; nx += 6) {
      ctx.beginPath();
      ctx.moveTo(nx, h / 2 - goalH / 2);
      ctx.lineTo(nx, h / 2 + goalH / 2);
      ctx.stroke();
    }
    // Right goal
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(w - pad, h / 2 - goalH / 2, goalW, goalH);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    for (let ny = h / 2 - goalH / 2; ny < h / 2 + goalH / 2; ny += 6) {
      ctx.beginPath();
      ctx.moveTo(w - pad, ny);
      ctx.lineTo(w - pad + goalW, ny);
      ctx.stroke();
    }
    for (let nx = w - pad; nx < w - pad + goalW; nx += 6) {
      ctx.beginPath();
      ctx.moveTo(nx, h / 2 - goalH / 2);
      ctx.lineTo(nx, h / 2 + goalH / 2);
      ctx.stroke();
    }

    // Goal posts
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(pad - goalW, h / 2 - goalH / 2, goalW, goalH);
    ctx.strokeRect(w - pad, h / 2 - goalH / 2, goalW, goalH);

    // Penalty spots
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(pad + w * 0.12, h / 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w - pad - w * 0.12, h / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Penalty arcs
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(pad + w * 0.12, h / 2, h * 0.14, -0.7, 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w - pad - w * 0.12, h / 2, h * 0.14, Math.PI - 0.7, Math.PI + 0.7);
    ctx.stroke();

    // Corner arcs
    const cornerR = 10;
    ctx.beginPath();
    ctx.arc(pad, pad, cornerR, 0, Math.PI / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w - pad, pad, cornerR, Math.PI / 2, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pad, h - pad, cornerR, -Math.PI / 2, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w - pad, h - pad, cornerR, Math.PI, Math.PI * 1.5);
    ctx.stroke();
  }, []);

  // Main animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let lastTimestamp = 0;

    const animate = (timestamp: number) => {
      if (lastTimestamp === 0) lastTimestamp = timestamp;
      const delta = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const w = canvas.width;
      const h = canvas.height;
      const pad = 20;

      // Clear and draw pitch
      ctx.clearRect(0, 0, w, h);
      drawPitch(ctx, w, h);

      const frames = animationFramesRef.current;
      const frameIdx = currentFrameRef.current;
      const frame = frames[frameIdx];

      if (!frame) {
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const teamA = teamARef.current;
      const teamB = teamBRef.current;
      const speed = animationSpeedRef.current;

      // Handle frame transitions
      if (frameIdx !== prevFrameIdxRef.current) {
        const prevFrame = frames[prevFrameIdxRef.current];

        // Check for goal events
        const frameEvents = frame.events || [];
        for (const evt of frameEvents) {
          if (evt.type === 'goal') {
            const teamIdx = evt.teamId === teamA.id ? 0 : 1;
            goalFlashRef.current = { active: true, alpha: 1, teamIdx };
          }
        }

        if (prevFrame && frameIdx > prevFrameIdxRef.current && frameIdx - prevFrameIdxRef.current <= 2) {
          // Normal forward transition
          ballTransitionRef.current = {
            startX: prevFrame.ballX,
            startY: prevFrame.ballY,
            endX: frame.ballX,
            endY: frame.ballY,
            progress: 0,
          };

          // Set up player transitions
          const newPlayerTransitions = new Map<string, { startX: number; startY: number; endX: number; endY: number }>();
          for (const pos of frame.teamAPositions) {
            const prevPos = prevFrame.teamAPositions.find(p => p.playerId === pos.playerId);
            if (prevPos) {
              newPlayerTransitions.set(pos.playerId, {
                startX: prevPos.currentX,
                startY: prevPos.currentY,
                endX: pos.currentX,
                endY: pos.currentY,
              });
            }
          }
          for (const pos of frame.teamBPositions) {
            const prevPos = prevFrame.teamBPositions.find(p => p.playerId === pos.playerId);
            if (prevPos) {
              newPlayerTransitions.set(pos.playerId, {
                startX: prevPos.currentX,
                startY: prevPos.currentY,
                endX: pos.currentX,
                endY: pos.currentY,
              });
            }
          }
          playerTransitionsRef.current = newPlayerTransitions;
        } else {
          // Jump transition - instant
          ballTransitionRef.current = {
            startX: frame.ballX,
            startY: frame.ballY,
            endX: frame.ballX,
            endY: frame.ballY,
            progress: 1,
          };
          playerTransitionsRef.current = new Map();
        }

        prevFrameIdxRef.current = frameIdx;
      }

      // Update transition progress
      const transitionDuration = isAnimatingRef.current
        ? Math.max(60, 500 / speed)
        : 120;
      const tr = ballTransitionRef.current;
      if (tr.progress < 1) {
        tr.progress = Math.min(1, tr.progress + (delta / transitionDuration));
      }
      const t = easeInOut(Math.min(1, tr.progress));

      // Scaling functions
      const scaleX = (x: number) => pad + (x / 100) * (w - pad * 2);
      const scaleY = (y: number) => pad + (y / 100) * (h - pad * 2);

      // Interpolated ball position
      const interpBallX = lerp(tr.startX, tr.endX, t);
      const interpBallY = lerp(tr.startY, tr.endY, t);
      const ballScreenX = scaleX(interpBallX);
      const ballScreenY = scaleY(interpBallY);

      // Update ball trail
      ballTrailRef.current.push({ x: ballScreenX, y: ballScreenY, age: 0 });
      ballTrailRef.current = ballTrailRef.current
        .map(p => ({ ...p, age: p.age + delta }))
        .filter(p => p.age < 500);

      // Update micro-movements for idle animation
      const microMovements = playerMicroMovementsRef.current;
      for (const [playerId, mm] of microMovements) {
        mm.timer -= delta;
        if (mm.timer <= 0) {
          // Pick new target offset
          mm.targetOffsetX = (Math.random() - 0.5) * 4;
          mm.targetOffsetY = (Math.random() - 0.5) * 4;
          mm.timer = 1000 + Math.random() * 2000;
        }
        // Smooth interpolation toward target
        mm.offsetX += (mm.targetOffsetX - mm.offsetX) * 0.02;
        mm.offsetY += (mm.targetOffsetY - mm.offsetY) * 0.02;
      }

      // Draw players with enhanced movement
      const drawTeam = (
        positions: PlayerPosition[],
        color: string,
        textColor: string,
        team: typeof teamA,
        isLeft: boolean,
      ) => {
        for (const pos of positions) {
          // Ensure micro-movement exists for this player
          if (!microMovements.has(pos.playerId)) {
            microMovements.set(pos.playerId, {
              offsetX: 0, offsetY: 0,
              targetOffsetX: (Math.random() - 0.5) * 4,
              targetOffsetY: (Math.random() - 0.5) * 4,
              timer: Math.random() * 2000,
            });
          }

          let px: number, py: number;
          const pTr = playerTransitionsRef.current.get(pos.playerId);
          if (pTr && tr.progress < 1) {
            px = scaleX(lerp(pTr.startX, pTr.endX, t));
            py = scaleY(lerp(pTr.startY, pTr.endY, t));
          } else {
            px = scaleX(pos.currentX);
            py = scaleY(pos.currentY);
          }

          // Apply micro-movement offset
          const mm = microMovements.get(pos.playerId)!;
          px += mm.offsetX;
          py += mm.offsetY;

          const player = team.players.find(p => p.id === pos.playerId);
          const radius = 13;

          // Player shadow
          ctx.beginPath();
          ctx.arc(px + 2, py + 2, radius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.fill();

          // Player circle with gradient
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          const playerGrad = ctx.createRadialGradient(px - 3, py - 3, 0, px, py, radius);
          playerGrad.addColorStop(0, lightenColor(color, 20));
          playerGrad.addColorStop(1, color);
          ctx.fillStyle = playerGrad;
          ctx.fill();

          // Border - position-based color
          const playerPos = player?.position;
          let borderColor = 'rgba(0,0,0,0.4)';
          if (playerPos) {
            if (['GK'].includes(playerPos)) borderColor = 'rgba(234,179,8,0.8)';
            else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(playerPos)) borderColor = 'rgba(59,130,246,0.8)';
            else if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(playerPos)) borderColor = 'rgba(34,197,94,0.8)';
            else borderColor = 'rgba(239,68,68,0.8)';
          }

          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Has ball indicator
          if (pos.hasBall) {
            ctx.beginPath();
            ctx.arc(px, py, radius + 3, 0, Math.PI * 2);
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          // Proximity to ball indicator - players close to ball get a subtle glow
          const distToBall = Math.sqrt(Math.pow(px - ballScreenX, 2) + Math.pow(py - ballScreenY, 2));
          if (distToBall < 60) {
            const glowAlpha = (1 - distToBall / 60) * 0.3;
            ctx.beginPath();
            ctx.arc(px, py, radius + 5, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255,255,255,${glowAlpha})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          // Name label
          const shortLabel = player
            ? player.name.split(' ').pop()?.substring(0, 5) || '?'
            : '?';
          ctx.fillStyle = textColor;
          ctx.font = 'bold 7px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(shortLabel, px, py - 1);

          // Rating below name
          if (player) {
            ctx.font = '6px sans-serif';
            ctx.fillStyle = textColor + 'bb';
            ctx.fillText(String(player.rating), px, py + 5);
          }
        }
      };

      // Draw Team A (left side)
      drawTeam(frame.teamAPositions, teamA.color, teamA.textColor, teamA, true);
      // Draw Team B (right side)
      drawTeam(frame.teamBPositions, teamB.color, teamB.textColor, teamB, false);

      // Draw ball trail
      if (ballTrailRef.current.length > 2) {
        for (let i = 1; i < ballTrailRef.current.length; i++) {
          const p = ballTrailRef.current[i];
          const alpha = Math.max(0, 0.3 * (1 - p.age / 500));
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3 * (1 - p.age / 500), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx.fill();
        }
      }

      // Ball shadow
      ctx.beginPath();
      ctx.arc(ballScreenX + 2, ballScreenY + 3, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fill();

      // Ball glow
      const ballGlow = ctx.createRadialGradient(ballScreenX, ballScreenY, 2, ballScreenX, ballScreenY, 20);
      ballGlow.addColorStop(0, 'rgba(255,255,255,0.4)');
      ballGlow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = ballGlow;
      ctx.beginPath();
      ctx.arc(ballScreenX, ballScreenY, 20, 0, Math.PI * 2);
      ctx.fill();

      // Ball
      ctx.beginPath();
      ctx.arc(ballScreenX, ballScreenY, 6, 0, Math.PI * 2);
      const ballGrad = ctx.createRadialGradient(ballScreenX - 2, ballScreenY - 2, 0, ballScreenX, ballScreenY, 6);
      ballGrad.addColorStop(0, '#FFFFFF');
      ballGrad.addColorStop(1, '#DDDDDD');
      ctx.fillStyle = ballGrad;
      ctx.fill();
      ctx.strokeStyle = '#999999';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Ball pentagon pattern
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for (let a = 0; a < 5; a++) {
        const angle = (a * Math.PI * 2) / 5 - Math.PI / 2;
        const dx = Math.cos(angle) * 3;
        const dy = Math.sin(angle) * 3;
        ctx.beginPath();
        ctx.arc(ballScreenX + dx, ballScreenY + dy, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Goal celebration effect
      const gf = goalFlashRef.current;
      if (gf.active) {
        gf.alpha -= delta / 1500;
        if (gf.alpha <= 0) {
          gf.active = false;
          gf.alpha = 0;
        } else {
          const flashColor = gf.teamIdx === 0
            ? `rgba(34, 197, 94, ${gf.alpha * 0.15})`
            : `rgba(239, 68, 68, ${gf.alpha * 0.15})`;
          ctx.fillStyle = flashColor;
          ctx.fillRect(0, 0, w, h);

          const textAlpha = Math.min(1, gf.alpha * 2);
          ctx.save();
          ctx.font = `bold ${Math.min(36, w * 0.06)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          ctx.fillStyle = `rgba(0,0,0,${textAlpha * 0.5})`;
          ctx.fillText('GOAL!', w / 2 + 2, h / 2 - 10 + 2);

          ctx.strokeStyle = `rgba(0,0,0,${textAlpha * 0.8})`;
          ctx.lineWidth = 4;
          ctx.strokeText('GOAL!', w / 2, h / 2 - 10);

          ctx.fillStyle = `rgba(255, 215, 0, ${textAlpha})`;
          ctx.fillText('GOAL!', w / 2, h / 2 - 10);

          ctx.font = `${Math.min(24, w * 0.04)}px sans-serif`;
          ctx.fillText('⚽', w / 2, h / 2 + 15);
          ctx.restore();
        }
      }

      // Score overlay at top
      const overlayW = Math.min(200, w * 0.45);
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      const overlayX = w / 2 - overlayW / 2;
      roundRect(ctx, overlayX, 3, overlayW, 22, 4);
      ctx.fill();

      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      const phaseLabel = frame.currentPhase === 'first_half' ? '1H'
        : frame.currentPhase === 'half_time' ? 'HT'
        : frame.currentPhase === 'second_half' ? '2H'
        : 'FT';
      ctx.fillText(
        `${teamA.shortName} ${frame.score[0]} - ${frame.score[1]} ${teamB.shortName}  ${frame.minute}' ${phaseLabel}`,
        w / 2,
        17
      );

      // Possession indicator bar at bottom
      const possBarY = h - 8;
      const possBarH = 4;
      const possBarW = w - pad * 2;
      const possA = frame.possession[0] / 100;

      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      roundRect(ctx, pad, possBarY, possBarW, possBarH, 2);
      ctx.fill();

      ctx.fillStyle = teamA.color;
      roundRect(ctx, pad, possBarY, possBarW * possA, possBarH, 2);
      ctx.fill();

      ctx.fillStyle = teamB.color;
      roundRect(ctx, pad + possBarW * possA, possBarY, possBarW * (1 - possA), possBarH, 2);
      ctx.fill();

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [drawPitch]);

  // Resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = Math.min(w * 0.65, 500);
      canvas.width = w;
      canvas.height = h;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  return (
    <div className="w-full relative">
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg shadow-xl"
        style={{ imageRendering: 'auto' }}
      />
    </div>
  );
}

// Helper: lighten a hex color
function lightenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

// Helper: rounded rectangle
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
