'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useCoachStore } from '@/store/matchStore';
import { TEAMS } from '@/lib/simulation/data';

export default function PitchCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    animationFrames,
    currentFrame,
    teamAId,
    teamBId,
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
    // Left
    ctx.strokeRect(pad, h / 2 - penAreaH / 2, penAreaW, penAreaH);
    // Right
    ctx.strokeRect(w - pad - penAreaW, h / 2 - penAreaH / 2, penAreaW, penAreaH);

    // Goal areas
    const goalAreaW = w * 0.06;
    const goalAreaH = h * 0.22;
    // Left
    ctx.strokeRect(pad, h / 2 - goalAreaH / 2, goalAreaW, goalAreaH);
    // Right
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

    // Draw players
    const drawTeam = (
      positions: { playerId: string; currentX: number; currentY: number; hasBall: boolean }[],
      color: string,
      textColor: string,
      team: typeof teamA
    ) => {
      for (const pos of positions) {
        const px = scaleX(pos.currentX);
        const py = scaleY(pos.currentY);
        const player = team.players.find(p => p.id === pos.playerId);
        const radius = 12;

        // Player circle
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Shirt number / initials
        const label = player ? player.name.split(' ').pop()?.[0] || '' + (player.name.split(' ').pop()?.slice(1, 2) || '') : '';
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

    // Draw ball
    const ballX = scaleX(frame.ballX);
    const ballY = scaleY(frame.ballY);

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
      draw();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [draw]);

  useEffect(() => {
    draw();
  }, [currentFrame, draw]);

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
