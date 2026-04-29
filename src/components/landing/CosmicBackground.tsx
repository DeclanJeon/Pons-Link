import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  layer: number;
  size: number;
  speed: number;
  opacity: number;
  phase: number;
  drift: number;
};

type BurstParticle = {
  angle: number;
  distance: number;
  speed: number;
  size: number;
  life: number;
  color: string;
};

type RelationBurst = {
  x: number;
  y: number;
  born: number;
  life: number;
  major: boolean;
  particles: BurstParticle[];
};

export const CosmicBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const effectCanvasRef = useRef<HTMLCanvasElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const effectCanvas = effectCanvasRef.current;
    if (!canvas || !effectCanvas) return;

    const ctx = canvas.getContext("2d");
    const effectCtx = effectCanvas.getContext("2d");
    if (!ctx || !effectCtx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = window.devicePixelRatio || 1;
    const stars: Star[] = [];
    const bursts: RelationBurst[] = [];
    const starCount = 260;

    const createStar = (resetFromTop = false): Star => {
      const layer = Math.pow(Math.random(), 1.6);
      return {
        x: Math.random() * width,
        y: resetFromTop ? -20 - Math.random() * 120 : Math.random() * height,
        layer,
        size: 0.35 + layer * 1.9,
        speed: 0.08 + layer * 0.42,
        opacity: 0.22 + layer * 0.64,
        phase: Math.random() * Math.PI * 2,
        drift: (Math.random() - 0.5) * (0.08 + layer * 0.28),
      };
    };

    const createBurst = (x: number, y: number, major = false) => {
      const particleCount = major ? 28 : 15;
      const colors = ["#7DD3FC", "#A78BFA", "#F8FAFC", "#5EEAD4"];

      bursts.push({
        x,
        y,
        born: performance.now(),
        life: major ? 1500 : 1200,
        major,
        particles: Array.from({ length: particleCount }, (_, index) => ({
          angle: (Math.PI * 2 * index) / particleCount + (Math.random() - 0.5) * 0.45,
          distance: 14 + Math.random() * (major ? 74 : 44),
          speed: 0.35 + Math.random() * (major ? 0.7 : 0.45),
          size: 0.8 + Math.random() * (major ? 2.1 : 1.4),
          life: 0.58 + Math.random() * 0.42,
          color: colors[index % colors.length],
        })),
      });
    };

    const drawSpaceDepth = () => {
      const base = ctx.createLinearGradient(0, 0, 0, height);
      base.addColorStop(0, "#02030A");
      base.addColorStop(0.46, "#05070F");
      base.addColorStop(1, "#010103");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, width, height);

      const distantGlow = ctx.createRadialGradient(width * 0.5, height * 0.22, 0, width * 0.5, height * 0.22, Math.max(width, height) * 0.72);
      distantGlow.addColorStop(0, "rgba(79, 70, 229, 0.16)");
      distantGlow.addColorStop(0.38, "rgba(14, 165, 233, 0.06)");
      distantGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = distantGlow;
      ctx.fillRect(0, 0, width, height);
    };

    const drawStars = (now: number) => {
      stars.forEach((star, index) => {
        const twinkle = 0.72 + Math.sin(now * 0.0012 + star.phase) * 0.28;
        const alpha = Math.max(0.08, star.opacity * twinkle);
        const tailLength = star.layer > 0.5 ? 9 + star.layer * 22 : 0;
        const drift = Math.sin(now * 0.00018 + star.phase) * star.layer * 0.25;

        if (tailLength) {
          const tail = ctx.createLinearGradient(star.x, star.y - tailLength, star.x, star.y);
          tail.addColorStop(0, "rgba(125, 211, 252, 0)");
          tail.addColorStop(1, `rgba(125, 211, 252, ${alpha * 0.34})`);
          ctx.beginPath();
          ctx.moveTo(star.x - drift, star.y - tailLength);
          ctx.lineTo(star.x, star.y);
          ctx.strokeStyle = tail;
          ctx.lineWidth = 0.45 + star.layer * 0.9;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(210, 232, 255, ${alpha})`;
        ctx.shadowColor = "rgba(96, 165, 250, 0.55)";
        ctx.shadowBlur = 4 + star.layer * 10;
        ctx.fill();
        ctx.shadowBlur = 0;

        star.y += star.speed;
        star.x += star.drift + drift * 0.025;

        if (star.y > height + 32 || star.x < -40 || star.x > width + 40) {
          stars[index] = createStar(true);
        }
      });
    };

    const drawBursts = (now: number) => {
      for (let i = bursts.length - 1; i >= 0; i -= 1) {
        const burst = bursts[i];
        const age = now - burst.born;
        const progress = Math.min(1, Math.max(0, age / burst.life));
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const alpha = 1 - progress;

        if (progress >= 1) {
          bursts.splice(i, 1);
          continue;
        }

        effectCtx.save();
        effectCtx.globalCompositeOperation = "screen";

        const ringRadius = (burst.major ? 112 : 76) * easeOut;
        const halo = effectCtx.createRadialGradient(burst.x, burst.y, 0, burst.x, burst.y, ringRadius * 1.15);
        halo.addColorStop(0, `rgba(167, 139, 250, ${alpha * (burst.major ? 0.24 : 0.16)})`);
        halo.addColorStop(0.4, `rgba(94, 234, 212, ${alpha * (burst.major ? 0.12 : 0.08)})`);
        halo.addColorStop(1, "rgba(0, 0, 0, 0)");
        effectCtx.fillStyle = halo;
        effectCtx.fillRect(burst.x - ringRadius * 1.2, burst.y - ringRadius * 1.2, ringRadius * 2.4, ringRadius * 2.4);

        effectCtx.beginPath();
        effectCtx.arc(burst.x, burst.y, ringRadius, 0, Math.PI * 2);
        effectCtx.strokeStyle = `rgba(125, 211, 252, ${alpha * (burst.major ? 0.48 : 0.38)})`;
        effectCtx.lineWidth = burst.major ? 1.8 : 1.35;
        effectCtx.stroke();

        const nodeA = {
          x: burst.x + Math.cos(-0.72) * ringRadius * 0.62,
          y: burst.y + Math.sin(-0.72) * ringRadius * 0.62,
        };
        const nodeB = {
          x: burst.x + Math.cos(0.88) * ringRadius * 0.72,
          y: burst.y + Math.sin(0.88) * ringRadius * 0.72,
        };
        const relationGradient = effectCtx.createLinearGradient(nodeA.x, nodeA.y, nodeB.x, nodeB.y);
        relationGradient.addColorStop(0, `rgba(167, 139, 250, ${alpha * 0.95})`);
        relationGradient.addColorStop(1, `rgba(94, 234, 212, ${alpha * 0.95})`);
        effectCtx.beginPath();
        effectCtx.moveTo(nodeA.x, nodeA.y);
        effectCtx.lineTo(nodeB.x, nodeB.y);
        effectCtx.strokeStyle = relationGradient;
        effectCtx.lineWidth = burst.major ? 1.5 : 0.9;
        effectCtx.stroke();

        [nodeA, nodeB, { x: burst.x, y: burst.y }].forEach((node, index) => {
          effectCtx.beginPath();
          effectCtx.arc(node.x, node.y, index === 2 ? 2.1 : 1.8, 0, Math.PI * 2);
          effectCtx.fillStyle = `rgba(248, 250, 252, ${alpha * 0.92})`;
          effectCtx.shadowColor = index === 0 ? "#A78BFA" : "#5EEAD4";
          effectCtx.shadowBlur = burst.major ? 24 : 16;
          effectCtx.fill();
          effectCtx.shadowBlur = 0;
        });

        burst.particles.forEach((particle) => {
          const particleProgress = Math.min(1, progress / particle.life);
          const distance = particle.distance * easeOut * particle.speed;
          const x = burst.x + Math.cos(particle.angle) * distance;
          const y = burst.y + Math.sin(particle.angle) * distance;

          effectCtx.beginPath();
          effectCtx.arc(x, y, particle.size * (1 - particleProgress * 0.55), 0, Math.PI * 2);
          effectCtx.fillStyle = `${particle.color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
          effectCtx.fill();
        });

        effectCtx.restore();
      }
    };

    const resizeCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      effectCanvas.width = Math.floor(width * dpr);
      effectCanvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      effectCanvas.style.width = `${width}px`;
      effectCanvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      effectCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button || button.hasAttribute("data-cosmic-major")) return;

      createBurst(event.clientX, event.clientY);
    };

    const handleRelationBurst = (event: Event) => {
      const detail = (event as CustomEvent<{ x?: number; y?: number; major?: boolean }>).detail;
      createBurst(detail?.x ?? width / 2, detail?.y ?? height / 2, detail?.major ?? true);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("ponslink:relation-burst", handleRelationBurst);

    for (let i = 0; i < starCount; i++) {
      stars.push(createStar());
    }

    // Animation loop
    let animationFrame: number;
    const animate = (now: number) => {
      drawSpaceDepth();
      drawStars(now);
      effectCtx.clearRect(0, 0, width, height);
      drawBursts(now);
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("ponslink:relation-burst", handleRelationBurst);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    const svgContainer = svgContainerRef.current;
    if (!svgContainer) return;

    // --- 빛의 경로 인터랙션 (Light Path Interaction) ---
    // 원리: 사용자의 마우스 위치를 추적하여 SVG path를 동적으로 생성.
    //       데이터가 사용자의 의도에 따라 직접적으로 흐르는 PonsLink의
    //       P2P 철학을 시각적으로 은유.
    const svgNS = "http://www.w3.org/2000/svg";
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'url(#line-gradient)');
    path.setAttribute('stroke-width', '2');
    
    const defs = document.createElementNS(svgNS, 'defs');
    const gradient = document.createElementNS(svgNS, 'linearGradient');
    gradient.id = 'line-gradient';
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '0%');
    
    const stop1 = document.createElementNS(svgNS, 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#A855F7'); // Accent
    
    const stop2 = document.createElementNS(svgNS, 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', '#00A9FF'); // Primary
    
    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);

    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.appendChild(defs);
    svg.appendChild(path);
    svgContainer.appendChild(svg);

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    const pathPoints = [{x: 0, y: window.innerHeight / 2}];
    const maxPoints = 30;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    window.addEventListener('mousemove', handleMouseMove);

    let lightPathAnimation: number;
    function animateLightPath() {
      // 현재 마우스 위치를 향해 부드럽게 이동
      const lastPoint = pathPoints[pathPoints.length - 1];
      pathPoints.push({
        x: lastPoint.x + (mouseX - lastPoint.x) * 0.1,
        y: lastPoint.y + (mouseY - lastPoint.y) * 0.1
      });

      // 오래된 포인트 제거
      if (pathPoints.length > maxPoints) {
        pathPoints.shift();
      }
      
      // SVG path 데이터 생성
      let d = `M ${pathPoints[0].x} ${pathPoints[0].y}`;
      for (let i = 1; i < pathPoints.length; i++) {
        d += ` L ${pathPoints[i].x} ${pathPoints[i].y}`;
      }
      path.setAttribute('d', d);
      
      lightPathAnimation = requestAnimationFrame(animateLightPath);
    }
    animateLightPath();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(lightPathAnimation);
      // Clean up SVG elements
      while (svgContainer.firstChild) {
        svgContainer.removeChild(svgContainer.firstChild);
      }
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-0"
        style={{ opacity: 0.72 }}
      />
      <canvas
        ref={effectCanvasRef}
        className="pointer-events-none fixed inset-0 z-30"
      />
      <div
        ref={svgContainerRef}
        id="light-path-container"
        className="pointer-events-none fixed inset-0 z-0"
        style={{ opacity: 0.8 }}
      />
    </>
  );
};
