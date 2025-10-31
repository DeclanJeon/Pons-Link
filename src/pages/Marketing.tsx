import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence, useAnimation, PanInfo } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDeviceType, getResponsiveClasses } from '@/hooks/useDeviceType';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  Play,
  Sparkles,
  Users,
  Heart,
  Zap,
  ArrowRight,
  MousePointer2,
  Smartphone,
  Monitor,
  Globe,
  Lock,
  Infinity,
  TrendingUp
} from 'lucide-react';

interface StorySection {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  valueProps: string[];
  images: string[];
  icon: React.ReactNode;
  color: string;
  gradient: string;
  stats?: { value: string; label: string; prefix?: string; suffix?: string }[];
  cta: { primary: string; secondary?: string };
}

const storySections: StorySection[] = [
  {
    id: 'hero',
    title: 'True Connection Begins',
    subtitle: 'PonsLink',
    description: 'Beyond meetings and social media - a revolutionary way to share experiences',
    valueProps: [
      'Real-time synchronized experiences',
      'Privacy-first design',
      'Zero learning curve'
    ],
    images: [
      '/img/hero/1.webp',
      '/img/hero/2.webp',
      '/img/hero/3.webp',
    ],
    icon: <Sparkles className="w-6 h-6 md:w-8 md:h-8" />,
    color: 'from-blue-600 to-cyan-600',
    gradient: 'from-blue-500/20 via-cyan-500/20 to-blue-500/20',
    cta: {
      primary: 'Start Your Journey',
      secondary: 'Learn More'
    }
  },
  {
    id: 'ponscast',
    title: 'Stream Experiences',
    subtitle: 'PonsCast',
    description: 'Not screen sharing, but experience sharing. Feel videos and documents together in real-time.',
    valueProps: [
      'Ultra-low latency streaming',
      '4K quality support',
      'Unlimited concurrent sessions'
    ],
    images: [
      '/img/ponscast/1.webp',
      '/img/ponscast/2.webp',
      '/img/ponscast/3.webp',
    ],
    icon: <Play className="w-6 h-6 md:w-8 md:h-8" />,
    color: 'from-purple-600 to-pink-600',
    gradient: 'from-purple-500/20 via-pink-500/20 to-purple-500/20',
    stats: [
      { value: '0', label: 'Latency', suffix: 'ms' },
      { value: '4', label: 'Quality', suffix: 'K' },
      { value: '∞', label: 'Sessions' }
    ],
    cta: {
      primary: 'Try PonsCast',
      secondary: 'View Demo'
    }
  },
  {
    id: 'cowatch',
    title: 'Watch Together',
    subtitle: 'CoWatch',
    description: 'Same video, same timing, same emotions. Experience unity beyond distance.',
    valueProps: [
      'Perfect synchronization',
      'Multi-device support',
      'Real-time reactions'
    ],
    images: [
      '/img/cowatch/1.webp',
      '/img/cowatch/2.webp',
      '/img/cowatch/3.webp',
    ],
    icon: <Users className="w-6 h-6 md:w-8 md:h-8" />,
    color: 'from-green-600 to-emerald-600',
    gradient: 'from-green-500/20 via-emerald-500/20 to-green-500/20',
    stats: [
      { value: '100', label: 'Sync Rate', suffix: '%' },
      { value: '4', label: 'Participants', suffix: '+' },
      { value: '∞', label: 'Reactions' }
    ],
    cta: {
      primary: 'Start Watching',
      secondary: 'See Features'
    }
  },
  {
    id: 'connection',
    title: 'Deep Relationships',
    subtitle: 'Deep Connection',
    description: 'Slow but deep conversations, lasting memories. A private space for the select few.',
    valueProps: [
      'End-to-end encryption',
      'Unlimited message history',
      'Forever free'
    ],
    images: [
      '/img/connection/1.webp',
      '/img/connection/2.webp',
      '/img/connection/3.webp',
    ],
    icon: <Heart className="w-6 h-6 md:w-8 md:h-8" />,
    color: 'from-orange-600 to-red-600',
    gradient: 'from-orange-500/20 via-red-500/20 to-orange-500/20',
    stats: [
      { value: '100', label: 'Privacy', suffix: '%' },
      { value: '∞', label: 'Storage' },
      { value: '0', label: 'Cost', prefix: '$' }
    ],
    cta: {
      primary: 'Join Community',
      secondary: 'Read Stories'
    }
  }
];

const FloatingParticles = ({ color, density = 30 }: { color: string; density?: number }) => {
  const particles = Array.from({ length: density }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    duration: Math.random() * 6 + 4,
    delay: Math.random() * 2
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className={cn("absolute rounded-full", color)}
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size
          }}
          animate={{
            y: [0, -40, 0],
            opacity: [0.1, 0.5, 0.1],
            scale: [1, 1.2, 1]
          }}
          transition={{
            duration: p.duration,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'easeInOut',
            delay: p.delay
          }}
        />
      ))}
    </div>
  );
};

const ParallaxImage = ({ 
  src, 
  index, 
  total, 
  mouseX, 
  mouseY,
  isActive 
}: { 
  src: string; 
  index: number; 
  total: number;
  mouseX: any;
  mouseY: any;
  isActive: boolean;
}) => {
  const depth = (index + 1) / total;
  const x = useTransform(mouseX, [-500, 500], [-25 * depth, 25 * depth]);
  const y = useTransform(mouseY, [-500, 500], [-25 * depth, 25 * depth]);
  const scale = useTransform(mouseX, [-500, 500], [1, 1 + 0.08 * depth]);
  const rotate = useTransform(mouseX, [-500, 500], [-3 * depth, 3 * depth]);

  return (
    <motion.div
      style={{ x, y, scale, rotate, zIndex: index }}
      className="absolute inset-0"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: isActive ? 1 : 0, scale: isActive ? 1 : 1.1 }}
      transition={{ delay: index * 0.15, duration: 0.6 }}
    >
      <img
        src={src}
        alt=""
        className="w-full h-full object-cover"
        style={{
          filter: `brightness(${0.75 - index * 0.12}) blur(${index * 1.5}px)`
        }}
      />
    </motion.div>
  );
};

const AnimatedCounter = ({ 
  value, 
  prefix = '', 
  suffix = '',
  isActive 
}: { 
  value: string; 
  prefix?: string; 
  suffix?: string;
  isActive: boolean;
}) => {
  const [displayValue, setDisplayValue] = useState('0');
  const numericValue = parseFloat(value.replace(/[^0-9.]/g, ''));
  const isNumeric = !isNaN(numericValue);

  useEffect(() => {
    if (!isActive || !isNumeric) {
      setDisplayValue(value);
      return;
    }

    let current = 0;
    const increment = numericValue / 50;
    const timer = setInterval(() => {
      current += increment;
      if (current >= numericValue) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current).toString());
      }
    }, 30);

    return () => clearInterval(timer);
  }, [isActive, value, numericValue, isNumeric]);

  return (
    <span>
      {prefix}{displayValue}{suffix}
    </span>
  );
};

const InteractiveCard = ({ 
  children, 
  className = '' 
}: { 
  children: React.ReactNode; 
  className?: string;
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    setRotateY((x - centerX) / 10);
    setRotateX((centerY - y) / 10);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ rotateX, rotateY }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{ transformStyle: 'preserve-3d' }}
      className={cn('relative', className)}
    >
      {children}
    </motion.div>
  );
};

const ValuePropsList = ({ 
  items, 
  isActive 
}: { 
  items: string[]; 
  isActive: boolean;
}) => {
  return (
    <div className="space-y-3 md:space-y-4">
      {items.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -30 }}
          animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
          transition={{ delay: 1.2 + i * 0.15, duration: 0.5 }}
          className="flex items-center gap-3 group"
        >
          <motion.div
            whileHover={{ scale: 1.2, rotate: 90 }}
            className="flex-shrink-0 w-6 h-6 md:w-7 md:h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
          >
            <Zap className="w-3 h-3 md:w-4 md:h-4 text-white" />
          </motion.div>
          <span className="text-sm md:text-base lg:text-lg text-white/90 font-medium group-hover:text-white transition-colors">
            {item}
          </span>
        </motion.div>
      ))}
    </div>
  );
};

const ImmersiveSection = ({ 
  section, 
  index, 
  isActive, 
  onNext,
  totalSections 
}: { 
  section: StorySection; 
  index: number; 
  isActive: boolean;
  onNext: () => void;
  totalSections: number;
}) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  const smoothMouseX = useSpring(mouseX, { stiffness: 50, damping: 30 });
  const smoothMouseY = useSpring(mouseY, { stiffness: 50, damping: 30 });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!isActive) return;
    
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % section.images.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isActive, section.images.length]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMobile) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  const handleDragEnd = (event: any, info: PanInfo) => {
    if (info.offset.y < -50) {
      onNext();
    }
  };

  return (
    <motion.section
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      drag={isMobile ? "y" : false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
      className="relative min-h-screen w-full flex items-center justify-center overflow-hidden snap-start"
      initial={{ opacity: 0 }}
      animate={{ opacity: isActive ? 1 : 0.4 }}
      transition={{ duration: 0.6 }}
    >
      <div className="absolute inset-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentImageIndex}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 1.2 }}
            className="absolute inset-0"
          >
            {section.images.map((img, imgIndex) => (
              imgIndex === currentImageIndex && (
                <ParallaxImage
                  key={imgIndex}
                  src={img}
                  index={imgIndex}
                  total={section.images.length}
                  mouseX={smoothMouseX}
                  mouseY={smoothMouseY}
                  isActive={isActive}
                />
              )
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
      
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/90" />
      
      <motion.div
        className={cn("absolute inset-0 bg-gradient-to-br opacity-20", section.gradient)}
        animate={{
          backgroundPosition: ['0% 0%', '100% 100%', '0% 0%']
        }}
        transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
        style={{ backgroundSize: '200% 200%' }}
      />
      
      <FloatingParticles color={`bg-gradient-to-r ${section.color}`} density={isMobile ? 15 : 30} />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-0">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="text-white space-y-6 md:space-y-8"
          >
            <motion.div
              className={cn(
                "inline-flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-3",
                "rounded-full bg-gradient-to-r backdrop-blur-sm",
                section.color
              )}
              whileHover={{ scale: 1.05 }}
              animate={{
                boxShadow: [
                  '0 0 20px rgba(255,255,255,0.3)',
                  '0 0 35px rgba(255,255,255,0.5)',
                  '0 0 20px rgba(255,255,255,0.3)'
                ]
              }}
              transition={{ duration: 2.5, repeat: Number.POSITIVE_INFINITY }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
              >
                {section.icon}
              </motion.div>
              <span className="text-sm md:text-base lg:text-lg font-bold tracking-wide">
                {section.subtitle}
              </span>
            </motion.div>
            
            <motion.h1 
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-tight"
              style={{
                textShadow: '0 4px 20px rgba(0,0,0,0.6)'
              }}
            >
              {section.title.split(' ').map((word, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="inline-block mr-3 md:mr-4"
                  whileHover={{ 
                    scale: 1.1, 
                    color: '#60a5fa',
                    textShadow: '0 0 25px rgba(96,165,250,0.9)'
                  }}
                >
                  {word}
                </motion.span>
              ))}
            </motion.h1>
            
            <motion.p 
              className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/90 leading-relaxed font-medium max-w-2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ delay: 0.7 }}
              style={{
                textShadow: '0 2px 12px rgba(0,0,0,0.6)'
              }}
            >
              {section.description}
            </motion.p>
            
            <ValuePropsList items={section.valueProps} isActive={isActive} />
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ delay: 1.5 }}
              className="flex flex-col sm:flex-row gap-3 md:gap-4 pt-4"
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  size={isMobile ? "default" : "lg"}
                  className={cn(
                    "bg-white text-black hover:bg-white/90 font-bold",
                    "text-sm md:text-base lg:text-lg px-6 md:px-8 py-4 md:py-6",
                    "shadow-2xl w-full sm:w-auto"
                  )}
                  onClick={onNext}
                >
                  {section.cta.primary}
                  <ArrowRight className="ml-2 w-4 h-4 md:w-5 md:h-5" />
                </Button>
              </motion.div>
              
              {section.cta.secondary && (
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button 
                    size={isMobile ? "default" : "lg"}
                    variant="outline"
                    className={cn(
                      "border-2 border-white/30 text-white hover:bg-white/10",
                      "backdrop-blur-sm font-bold",
                      "text-sm md:text-base lg:text-lg px-6 md:px-8 py-4 md:py-6",
                      "w-full sm:w-auto"
                    )}
                  >
                    {section.cta.secondary}
                  </Button>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
          
          {section.stats && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
              transition={{ delay: 0.8, duration: 0.7 }}
              className="grid grid-cols-3 gap-3 md:gap-6"
            >
              {section.stats.map((stat, i) => (
                <InteractiveCard key={i}>
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                    transition={{ delay: 1 + i * 0.15, type: 'spring', stiffness: 150 }}
                    whileHover={{ 
                      scale: 1.08,
                      transition: { duration: 0.2 }
                    }}
                    className="relative group cursor-pointer"
                  >
                    <motion.div
                      className="absolute inset-0 bg-white/10 rounded-xl md:rounded-2xl blur-xl"
                      animate={{
                        scale: [1, 1.15, 1],
                        opacity: [0.3, 0.6, 0.3]
                      }}
                      transition={{ duration: 2.5, repeat: Number.POSITIVE_INFINITY }}
                    />
                    <div className="relative p-3 md:p-6 rounded-xl md:rounded-2xl bg-white/5 backdrop-blur-md border border-white/20 group-hover:border-white/40 transition-colors">
                      <motion.div 
                        className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black mb-1 md:mb-2"
                        animate={{
                          textShadow: [
                            '0 0 10px rgba(255,255,255,0.5)',
                            '0 0 25px rgba(255,255,255,0.8)',
                            '0 0 10px rgba(255,255,255,0.5)'
                          ]
                        }}
                        transition={{ duration: 2.5, repeat: Number.POSITIVE_INFINITY }}
                      >
                        <AnimatedCounter 
                          value={stat.value}
                          prefix={stat.prefix}
                          suffix={stat.suffix}
                          isActive={isActive}
                        />
                      </motion.div>
                      <div className="text-xs md:text-sm lg:text-base text-white/80 font-medium">
                        {stat.label}
                      </div>
                    </div>
                  </motion.div>
                </InteractiveCard>
              ))}
            </motion.div>
          )}
        </div>
      </div>
      
      {index < totalSections - 1 && !isMobile && (
        <motion.button
          onClick={onNext}
          className="absolute bottom-8 md:bottom-12 left-1/2 -translate-x-1/2 z-20 p-3 md:p-4 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 group"
          animate={{ 
            y: [0, 12, 0],
            boxShadow: [
              '0 0 20px rgba(255,255,255,0.3)',
              '0 0 35px rgba(255,255,255,0.5)',
              '0 0 20px rgba(255,255,255,0.3)'
            ]
          }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
          whileHover={{ scale: 1.15, backgroundColor: 'rgba(255,255,255,0.2)' }}
          whileTap={{ scale: 0.9 }}
        >
          <ChevronDown className="w-6 h-6 md:w-8 md:h-8 text-white group-hover:text-white/90" />
        </motion.button>
      )}
      
      <div className="absolute bottom-6 md:bottom-12 left-4 md:left-12 z-20 flex gap-2 md:gap-3">
        {storySections.map((_, i) => (
          <motion.div
            key={i}
            className={cn(
              "h-1.5 md:h-2 rounded-full transition-all duration-500",
              i === index ? "w-12 md:w-16 bg-white" : "w-6 md:w-8 bg-white/30"
            )}
            whileHover={{ scale: 1.2, backgroundColor: 'rgba(255,255,255,0.8)' }}
            layoutId={`progress-${i}`}
          />
        ))}
      </div>

      <div className="absolute top-6 md:top-12 right-4 md:right-12 z-20 flex gap-1.5 md:gap-2">
        {section.images.map((_, i) => (
          <motion.div
            key={i}
            className={cn(
              "w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-all",
              i === currentImageIndex ? "bg-white scale-125 md:scale-150" : "bg-white/40"
            )}
            whileHover={{ scale: isMobile ? 1.5 : 2 }}
          />
        ))}
      </div>
    </motion.section>
  );
};

const ImmersiveMarketing = () => {
  const [activeSection, setActiveSection] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const deviceInfo = useDeviceType();
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleNext = useCallback(() => {
    if (activeSection < storySections.length - 1) {
      setActiveSection(activeSection + 1);
      const container = containerRef.current;
      if (container) {
        container.scrollTo({
          top: (activeSection + 1) * window.innerHeight,
          behavior: 'smooth'
        });
      }
    } else {
      navigate('/home');
    }
  }, [activeSection, navigate]);

  useEffect(() => {
    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;
      
      const scrollPosition = container.scrollTop;
      const sectionHeight = window.innerHeight;
      const newSection = Math.round(scrollPosition / sectionHeight);
      
      if (newSection !== activeSection && newSection >= 0 && newSection < storySections.length) {
        setActiveSection(newSection);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [activeSection]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      }
      if (e.key === 'ArrowUp' && activeSection > 0) {
        e.preventDefault();
        setActiveSection(activeSection - 1);
        const container = containerRef.current;
        if (container) {
          container.scrollTo({
            top: (activeSection - 1) * window.innerHeight,
            behavior: 'smooth'
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSection, handleNext]);

  return (
    <div 
      ref={containerRef}
      className="h-screen overflow-y-scroll snap-y snap-mandatory scroll-smooth bg-black"
    >
      {storySections.map((section, index) => (
        <ImmersiveSection
          key={section.id}
          section={section}
          index={index}
          isActive={activeSection === index}
          onNext={handleNext}
          totalSections={storySections.length}
        />
      ))}
      
      <motion.div
        className="fixed top-4 md:top-8 left-4 md:left-8 z-50"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        whileHover={{ scale: 1.08 }}
      >
        <motion.div 
          className="text-xl md:text-2xl lg:text-3xl font-black text-white drop-shadow-2xl cursor-pointer"
          animate={{
            textShadow: [
              '0 0 20px rgba(255,255,255,0.5)',
              '0 0 35px rgba(255,255,255,0.8)',
              '0 0 20px rgba(255,255,255,0.5)'
            ]
          }}
          transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY }}
          onClick={() => navigate('/home')}
        >
          PonsLink
        </motion.div>
      </motion.div>
      
      <motion.div
        className="fixed top-4 md:top-8 right-4 md:right-8 z-50"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button 
            onClick={() => navigate('/home')}
            size={isMobile ? "default" : "lg"}
            className={cn(
              "bg-white text-black hover:bg-white/90 font-bold",
              "text-sm md:text-base lg:text-lg px-4 md:px-6 lg:px-8 py-3 md:py-4 lg:py-6",
              "shadow-2xl"
            )}
          >
            Get Started
            <ArrowRight className="ml-2 w-4 h-4 md:w-5 md:h-5" />
          </Button>
        </motion.div>
      </motion.div>

      {!isMobile && (
        <motion.div
          className="fixed bottom-8 right-8 z-50 text-white/60 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
            <span className="hidden md:inline">Scroll or press Space</span>
            <span className="md:hidden">Scroll</span>
            <ChevronDown className="w-4 h-4 animate-bounce" />
          </div>
        </motion.div>
      )}

      {isMobile && (
        <motion.div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 text-white/60 text-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm px-3 py-2 rounded-full border border-white/10">
            <MousePointer2 className="w-3 h-3" />
            <span>Swipe up to continue</span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ImmersiveMarketing;
