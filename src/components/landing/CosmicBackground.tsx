import { useEffect, useRef } from 'react';

/**
 * 우주 배경 렌더링 컴포넌트 (우주 현상 시뮬레이션)
 *
 * 구현된 우주 현상:
 * - ✨ 별의 랜덤 반짝임 (기본)
 * - ☄️ 유성 (Meteor) - 빠르게 지나가는 작은 별똥별
 * - 🪐 혹성 통과 (Planet Transit) - 천천히 이동하는 큰 천체
 * - 💥 초신성 폭발 (Supernova) - 갑작스런 빛의 확장
 * - 🌀 블랙홀 효과 (Black Hole) - 주변 빛을 빨아들이는 효과
 * - 🌟 별 탄생 (Star Birth) - 성운에서 새로운 별 생성
 *
 * @component
 */
export const CosmicBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const starsRef = useRef<Star[]>([]);
  const cosmicEventsRef = useRef<CosmicEvent[]>([]);
  const lastEventTimeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 캔버스 크기 설정
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    // 별 초기화 - 랜덤 반짝임만
    const initStars = () => {
      starsRef.current = [];
      const starCount = 200; // 적당한 개수

      for (let i = 0; i < starCount; i++) {
        starsRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 1.5 + 0.5,
          baseOpacity: Math.random() * 0.3 + 0.5,
          twinkleTimer: Math.random() * 100,
          twinkleInterval: Math.random() * 50 + 30, // 30-80 프레임마다 반짝임
          isTwinkling: false,
          twinkleProgress: 0,
        });
      }
    };

    // 🎲 랜덤 우주 현상 생성
    const createRandomCosmicEvent = () => {
      const eventTypes: CosmicEventType[] = [
        'meteor',
        'meteor', // 유성은 더 자주
        'planet',
        'supernova',
        'blackhole',
        'starbirth',
      ];

      const randomType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

      switch (randomType) {
        case 'meteor':
          createMeteor();
          break;
        case 'planet':
          createPlanet();
          break;
        case 'supernova':
          createSupernova();
          break;
        case 'blackhole':
          createBlackHole();
          break;
        case 'starbirth':
          createStarBirth();
          break;
      }
    };

    // ☄️ 유성 생성
    const createMeteor = () => {
      const startX = Math.random() * canvas.width;
      const startY = -50;
      const angle = Math.PI / 4 + Math.random() * Math.PI / 6;
      const speed = Math.random() * 6 + 10;

      cosmicEventsRef.current.push({
        type: 'meteor',
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        opacity: 1,
        size: Math.random() * 2 + 1,
        trailLength: Math.random() * 40 + 30,
        life: 100,
      });
    };

    // 🪐 혹성 통과 생성
    const createPlanet = () => {
      const side = Math.random() > 0.5 ? 'left' : 'top';
      const startX = side === 'left' ? -100 : Math.random() * canvas.width;
      const startY = side === 'left' ? Math.random() * canvas.height : -100;
      const targetX = canvas.width + 100;
      const targetY = canvas.height + 100;
      const speed = Math.random() * 0.5 + 0.3;

      const dx = targetX - startX;
      const dy = targetY - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      cosmicEventsRef.current.push({
        type: 'planet',
        x: startX,
        y: startY,
        vx: (dx / distance) * speed,
        vy: (dy / distance) * speed,
        opacity: 0.8,
        size: Math.random() * 30 + 40, // 큰 크기
        color: ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a8dadc'][Math.floor(Math.random() * 4)],
        life: 300,
      });
    };

    // 💥 초신성 폭발 생성
    const createSupernova = () => {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;

      cosmicEventsRef.current.push({
        type: 'supernova',
        x,
        y,
        opacity: 1,
        size: 5,
        maxSize: Math.random() * 150 + 100,
        expansionSpeed: Math.random() * 3 + 2,
        life: 80,
      });
    };

    // 🌀 블랙홀 효과 생성
    const createBlackHole = () => {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;

      cosmicEventsRef.current.push({
        type: 'blackhole',
        x,
        y,
        opacity: 0,
        size: Math.random() * 60 + 40,
        rotationAngle: 0,
        life: 200,
      });
    };

    // 🌟 별 탄생 생성
    const createStarBirth = () => {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;

      cosmicEventsRef.current.push({
        type: 'starbirth',
        x,
        y,
        opacity: 0,
        size: 0,
        maxSize: Math.random() * 30 + 20,
        particles: Array.from({ length: 12 }, (_, i) => ({
          angle: (i / 12) * Math.PI * 2,
          distance: 0,
          maxDistance: Math.random() * 50 + 30,
        })),
        life: 150,
      });
    };

    // ✨ 별 렌더링 - 랜덤 반짝임
    const renderStars = () => {
      starsRef.current.forEach((star) => {
        // 반짝임 타이머 업데이트
        star.twinkleTimer++;

        if (star.twinkleTimer >= star.twinkleInterval && !star.isTwinkling) {
          star.isTwinkling = true;
          star.twinkleProgress = 0;
          star.twinkleTimer = 0;
          star.twinkleInterval = Math.random() * 50 + 30; // 다음 반짝임까지 랜덤 간격
        }

        // 반짝임 애니메이션
        let opacity = star.baseOpacity;
        if (star.isTwinkling) {
          star.twinkleProgress += 0.1;
          const twinkle = Math.sin(star.twinkleProgress * Math.PI);
          opacity = star.baseOpacity + twinkle * 0.5;

          if (star.twinkleProgress >= 1) {
            star.isTwinkling = false;
          }
        }

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.shadowBlur = 3;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    };

    // 🎨 우주 현상 렌더링
    const renderCosmicEvents = () => {
      cosmicEventsRef.current = cosmicEventsRef.current.filter((event) => {
        event.life--;

        if (event.life <= 0) {
          return false;
        }

        switch (event.type) {
          case 'meteor':
            renderMeteor(event);
            break;
          case 'planet':
            renderPlanet(event);
            break;
          case 'supernova':
            renderSupernova(event);
            break;
          case 'blackhole':
            renderBlackHole(event);
            break;
          case 'starbirth':
            renderStarBirth(event);
            break;
        }

        return true;
      });
    };

    // ☄️ 유성 렌더링
    const renderMeteor = (event: CosmicEvent) => {
      event.x! += event.vx!;
      event.y! += event.vy!;
      event.opacity -= 0.01;

      const gradient = ctx.createLinearGradient(
        event.x!,
        event.y!,
        event.x! - event.vx! * event.trailLength!,
        event.y! - event.vy! * event.trailLength!
      );

      gradient.addColorStop(0, `rgba(255, 255, 255, ${event.opacity})`);
      gradient.addColorStop(0.5, `rgba(200, 220, 255, ${event.opacity * 0.5})`);
      gradient.addColorStop(1, 'rgba(138, 43, 226, 0)');

      ctx.beginPath();
      ctx.strokeStyle = gradient;
      ctx.lineWidth = event.size!;
      ctx.lineCap = 'round';
      ctx.moveTo(event.x!, event.y!);
      ctx.lineTo(
        event.x! - event.vx! * event.trailLength!,
        event.y! - event.vy! * event.trailLength!
      );
      ctx.stroke();
    };

    // 🪐 혹성 렌더링
    const renderPlanet = (event: CosmicEvent) => {
      event.x! += event.vx!;
      event.y! += event.vy!;

      // 행성 본체
      ctx.beginPath();
      ctx.arc(event.x!, event.y!, event.size!, 0, Math.PI * 2);

      const gradient = ctx.createRadialGradient(
        event.x!, event.y!, 0,
        event.x!, event.y!, event.size!
      );
      gradient.addColorStop(0, event.color!);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.shadowBlur = 20;
      ctx.shadowColor = event.color!;
      ctx.fill();
      ctx.shadowBlur = 0;

      // 행성 고리 (50% 확률)
      if (event.size! > 50) {
        ctx.beginPath();
        ctx.ellipse(event.x!, event.y!, event.size! * 1.5, event.size! * 0.3, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${event.opacity * 0.3})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    // 💥 초신성 렌더링
    const renderSupernova = (event: CosmicEvent) => {
      event.size! += event.expansionSpeed!;
      event.opacity -= 0.012;

      // 내부 밝은 코어
      ctx.beginPath();
      ctx.arc(event.x!, event.y!, event.size! * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${event.opacity})`;
      ctx.shadowBlur = 30;
      ctx.shadowColor = 'rgba(255, 255, 255, 1)';
      ctx.fill();

      // 확장하는 충격파
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(event.x!, event.y!, event.size! + i * 20, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, ${200 - i * 50}, ${100 - i * 30}, ${event.opacity * (1 - i * 0.3)})`;
        ctx.lineWidth = 3 - i;
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
    };

    // 🌀 블랙홀 렌더링
    const renderBlackHole = (event: CosmicEvent) => {
      event.rotationAngle! += 0.05;

      // 페이드 인/아웃
      if (event.life > 150) {
        event.opacity = Math.min(1, event.opacity + 0.02);
      } else if (event.life < 50) {
        event.opacity -= 0.02;
      }

      // 블랙홀 중심
      ctx.beginPath();
      ctx.arc(event.x!, event.y!, event.size! * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 1)';
      ctx.fill();

      // 강착 원반 (회전하는 링)
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.translate(event.x!, event.y!);
        ctx.rotate(event.rotationAngle! + i * 0.3);

        ctx.beginPath();
        ctx.ellipse(0, 0, event.size! + i * 10, (event.size! + i * 10) * 0.2, 0, 0, Math.PI * 2);

        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, event.size! + i * 10);
        gradient.addColorStop(0, `rgba(138, 43, 226, ${event.opacity * 0.6})`);
        gradient.addColorStop(0.5, `rgba(74, 144, 226, ${event.opacity * 0.4})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
      }
    };

    // 🌟 별 탄생 렌더링
    const renderStarBirth = (event: CosmicEvent) => {
      // 페이드 인/아웃
      if (event.life > 100) {
        event.opacity = Math.min(1, event.opacity + 0.03);
        event.size! = Math.min(event.maxSize!, event.size! + 0.5);
      } else if (event.life < 50) {
        event.opacity -= 0.02;
      }

      // 중심 별
      ctx.beginPath();
      ctx.arc(event.x!, event.y!, event.size!, 0, Math.PI * 2);

      const gradient = ctx.createRadialGradient(
        event.x!, event.y!, 0,
        event.x!, event.y!, event.size!
      );
      gradient.addColorStop(0, `rgba(255, 255, 255, ${event.opacity})`);
      gradient.addColorStop(0.5, `rgba(255, 200, 100, ${event.opacity * 0.7})`);
      gradient.addColorStop(1, `rgba(255, 100, 50, 0)`);

      ctx.fillStyle = gradient;
      ctx.shadowBlur = 25;
      ctx.shadowColor = 'rgba(255, 200, 100, 0.8)';
      ctx.fill();

      // 방사형 파티클
      event.particles!.forEach((particle) => {
        particle.distance = Math.min(particle.maxDistance, particle.distance + 0.5);

        const px = event.x! + Math.cos(particle.angle) * particle.distance;
        const py = event.y! + Math.sin(particle.angle) * particle.distance;

        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 200, ${event.opacity * 0.6})`;
        ctx.fill();
      });

      ctx.shadowBlur = 0;
    };

    // 메인 애니메이션 루프
    const animate = (time: number) => {
      // 배경 클리어
      ctx.fillStyle = 'rgba(10, 14, 39, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      renderStars();
      renderCosmicEvents();

      // 랜덤 우주 현상 생성 (2-6초 사이 랜덤)
      const minInterval = 2000;
      const maxInterval = 6000;
      const randomInterval = Math.random() * (maxInterval - minInterval) + minInterval;

      if (time - lastEventTimeRef.current > randomInterval) {
        createRandomCosmicEvent();
        lastEventTimeRef.current = time;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // 초기화
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    animationFrameRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed top-0 left-0 w-full h-full -z-10"
        aria-hidden="true"
      />
      {/* 은하수 그라디언트 오버레이 */}
      <div
        className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 30% 50%, rgba(138, 43, 226, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 50%, rgba(75, 0, 130, 0.06) 0%, transparent 50%),
            linear-gradient(180deg, transparent 0%, rgba(45, 27, 105, 0.15) 50%, transparent 100%)
          `
        }}
        aria-hidden="true"
      />
    </>
  );
};

// TypeScript 타입 정의
interface Star {
  x: number;
  y: number;
  radius: number;
  baseOpacity: number;
  twinkleTimer: number;
  twinkleInterval: number;
  isTwinkling: boolean;
  twinkleProgress: number;
}

type CosmicEventType = 'meteor' | 'planet' | 'supernova' | 'blackhole' | 'starbirth';

interface CosmicEvent {
  type: CosmicEventType;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  opacity: number;
  size?: number;
  life: number;

  // Meteor specific
  trailLength?: number;

  // Planet specific
  color?: string;

  // Supernova specific
  maxSize?: number;
  expansionSpeed?: number;

  // Black Hole specific
  rotationAngle?: number;

  // Star Birth specific
  particles?: Array<{
    angle: number;
    distance: number;
    maxDistance: number;
  }>;
}
