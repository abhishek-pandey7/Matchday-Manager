'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useCoachStore } from '@/store/matchStore';
import { TEAMS } from '@/lib/simulation/data';

export default function PitchCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const prevFrameRef = useRef<number>(-1);
  const transitionRef = useRef<{ startX: number; startY: number; endX: number; endY: number; progress: number }>({
    startX: 50, startY: 50, endX: 50, endY: 50, progress: 1,
  });
  const playerTransitionsRef = useRef<Map<string, { startX: number; startY: number; endX: number; endY: number }>>(new Map());

  const {
    animationFrames,
    currentFrame,
    teamAId,
    teamBId,
    isAnimating,
    animationSpeed,
  } = useCoachStore();

  const teamA = TEAMS.find(t => t.id === teamAId)!;
  const teamB = TEAMS.find(t => t.id === teamBId)!;

  const drawPitch = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // Pitch background
    ctx.fillStyle = '#2d8a4e';
    ctx.fillRect(0, 0, w, h);

    // Stripes
    const stripeWidth = w / 16;
    for (let i = 0; i < 16; i += 2) {
      ctx.fillStyle = '#34965a';
      ctx.fillRect(i * stripeWidth, 0, stripeWidth, h);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;

    // Outer boundary
    const pad = 20;
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
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
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

    // Goals
    const goalW = 8;
    const goalH = h * 0.12;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(pad - goalW, h / 2 - goalH / 2, goalW, goalH);
    ctx.fillRect(w - pad, h / 2 - goalH / 2, goalW, goalH);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeRect(pad - goalW, h / 2 - goalH / 2, goalW, goalH);
    ctx.strokeRect(w - pad, h / 2 - goalH / 2, goalW, goalH);

    // Penalty spots
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(pad + w * 0.12, h / 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w - pad - w * 0.12, h / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Penalty arcs
    ctx.beginPath();
    ctx.arc(pad + w * 0.12, h / 2, h * 0.14, -0.7, 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w - pad - w * 0.12, h / 2, h * 0.14, Math.PI - 0.7, Math.PI + 0.7);
    ctx.stroke();

    // Corner arcs
    const cornerR = 12;
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

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  // Easing function for smooth transitions
  const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const pad = 20;

    // Clear and draw pitch
    ctx.clearRect(0, 0, w, h);
    drawPitch(ctx, w, h);

    const frame = animationFrames[currentFrame];
    if (!frame) return;

    const scaleX = (x: number) => pad + (x / 100) * (w - pad * 2);
    const scaleY = (y: number) => pad + (y / 100) * (h - pad * 2);

    // Calculate interpolated ball position
    const tr = transitionRef.current;
    const ballProgress = easeInOut(Math.min(1, tr.progress));
    const interpBallX = lerp(tr.startX, tr.endX, ballProgress);
    const interpBallY = lerp(tr.startY, tr.endY, ballProgress);

    // Draw players with interpolation
    const drawTeam = (
      positions: { playerId: string; currentX: number; currentY: number; hasBall: boolean }[],
      color: string,
      textColor: string,
      team: typeof teamA
    ) => {
      for (const pos of positions) {
        let px: number, py: number;
        const pTr = playerTransitionsRef.current.get(pos.playerId);
        if (pTr) {
          px = scaleX(lerp(pTr.startX, pTr.endX, ballProgress));
          py = scaleY(lerp(pTr.startY, pTr.endY, ballProgress));
        } else {
          px = scaleX(pos.currentX);
          py = scaleY(pos.currentY);
        }

        const player = team.players.find(p => p.id === pos.playerId);
        const radius = 12;

        // Player circle with slight glow
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Short name label
        const shortLabel = player ? player.name.split(' ').pop()?.substring(0, 3) || '?' : '?';
        ctx.fillStyle = textColor;
        ctx.font = 'bold 7px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(shortLabel, px, py);
      }
    };

    // Draw Team A (left side)
    drawTeam(frame.teamAPositions, teamA.color, teamA.textColor, teamA);
    // Draw Team B (right side)
    drawTeam(frame.teamBPositions, teamB.color, teamB.textColor, teamB);

    // Draw ball with trail effect
    const ballX = scaleX(interpBallX);
    const ballY = scaleY(interpBallY);

    // Ball trail (when moving)
    if (tr.progress < 0.95) {
      const trailX = scaleX(tr.startX);
      const trailY = scaleY(tr.startY);
      ctx.beginPath();
      ctx.moveTo(trailX, trailY);
      ctx.lineTo(ballX, ballY);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Ball glow
    const gradient = ctx.createRadialGradient(ballX, ballY, 2, ballX, ballY, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,0.6)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(ballX, ballY, 16, 0, Math.PI * 2);
    ctx.fill();

    // Ball
    ctx.beginPath();
    ctx.arc(ballX, ballY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw event flash for current frame
    const frameEvents = frame.events;
    for (const evt of frameEvents) {
      if (evt.type === 'goal') {
        // Goal flash effect
        ctx.fillStyle = 'rgba(255,215,0,0.15)';
        ctx.fillRect(0, 0, w, h);

        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFD700';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText('⚽ GOAL!', w / 2, h / 2 - 20);
        ctx.fillText('⚽ GOAL!', w / 2, h / 2 - 20);
      }
    }

    // Score overlay
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(w / 2 - 80, 2, 160, 24);
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(
      `${teamA.shortName} ${frame.score[0]} - ${frame.score[1]} ${teamB.shortName}  |  ${frame.minute}'`,
      w / 2,
      18
    );

  }, [animationFrames, currentFrame, teamA, teamB, drawPitch]);

  // Handle frame transitions with smooth interpolation
  useEffect(() => {
    if (currentFrame !== prevFrameRef.current) {
      const prevFrame = animationFrames[prevFrameRef.current];
      const newFrame = animationFrames[currentFrame];

      if (prevFrame && newFrame) {
        // Set up ball transition
        transitionRef.current = {
          startX: prevFrame.ballX,
          startY: prevFrame.ballY,
          endX: newFrame.ballX,
          endY: newFrame.ballY,
          progress: 0,
        };

        // Set up player transitions
        const newPlayerTransitions = new Map<string, { startX: number; startY: number; endX: number; endY: number }>();

        for (const pos of newFrame.teamAPositions) {
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

        for (const pos of newFrame.teamBPositions) {
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
      }

      prevFrameRef.current = currentFrame;
    }
  }, [currentFrame, animationFrames]);

  // Animation loop with requestAnimationFrame for smooth transitions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let lastTime = 0;
    const transitionDuration = isAnimating ? Math.max(80, 600 / animationSpeed) : 150; // ms

    const animate = (timestamp: number) => {
      if (lastTime === 0) lastTime = timestamp;
      const delta = timestamp - lastTime;
      lastTime = timestamp;

      // Update transition progress
      const tr = transitionRef.current;
      if (tr.progress < 1) {
        tr.progress = Math.min(1, tr.progress + (delta / transitionDuration));
      }

      draw();
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [draw, isAnimating, animationSpeed]);

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
