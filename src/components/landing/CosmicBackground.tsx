import { useEffect, useRef } from "react";

export const CosmicBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Create stars
    const stars: { x: number; y: number; size: number; speed: number; opacity: number }[] = [];
    const starCount = 200;

    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2,
        speed: Math.random() * 0.5 + 0.1,
        opacity: Math.random(),
      });
    }

    // Animation loop
    let animationFrame: number;
    const animate = () => {
      ctx.fillStyle = "hsl(220, 25%, 8%)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw stars
      stars.forEach((star) => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100, 180, 255, ${star.opacity})`;
        ctx.fill();

        // Twinkle effect
        star.opacity += Math.random() * 0.02 - 0.01;
        star.opacity = Math.max(0.3, Math.min(1, star.opacity));

        // Move stars slowly
        star.y += star.speed;
        if (star.y > canvas.height) {
          star.y = 0;
          star.x = Math.random() * canvas.width;
        }
      });

      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
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
    let pathPoints = [{x: 0, y: window.innerHeight / 2}];
    const maxPoints = 30;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    window.addEventListener('mousemove', handleMouseMove);

    let lightPathAnimation: number;
    function animateLightPath() {
      // 현재 마우스 위치를 향해 부드럽게 이동
      let lastPoint = pathPoints[pathPoints.length - 1];
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
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{ opacity: 0.6 }}
      />
      <div
        ref={svgContainerRef}
        id="light-path-container"
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{ opacity: 0.8 }}
      />
    </>
  );
};
