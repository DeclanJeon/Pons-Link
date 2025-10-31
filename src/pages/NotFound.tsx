import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useDeviceType, getResponsiveClasses } from '@/hooks/useDeviceType';
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const deviceInfo = useDeviceType();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className={`
        text-center
        ${getResponsiveClasses(deviceInfo, {
          mobile: 'p-6',
          tablet: 'p-8',
          desktop: 'p-12',
          largeDesktop: 'p-16'
        })}
      `}>
        <div className={`
          ${getResponsiveClasses(deviceInfo, {
            mobile: 'mb-6',
            tablet: 'mb-8',
            desktop: 'mb-10',
            largeDesktop: 'mb-12'
          })}
        `}>
          <h1 className={`
            font-bold text-foreground mb-4
            ${getResponsiveClasses(deviceInfo, {
              mobile: 'text-5xl',
              tablet: 'text-6xl',
              desktop: 'text-7xl',
              largeDesktop: 'text-8xl'
            })}
          `}>
            404
          </h1>
          <p className={`
            text-muted-foreground mb-6
            ${getResponsiveClasses(deviceInfo, {
              mobile: 'text-base',
              tablet: 'text-lg',
              desktop: 'text-xl',
              largeDesktop: 'text-2xl'
            })}
          `}>
            Oops! Page not found
          </p>
          <p className={`
            text-muted-foreground/70 mb-8
            ${getResponsiveClasses(deviceInfo, {
              mobile: 'text-sm',
              tablet: 'text-base',
              desktop: 'text-lg',
              largeDesktop: 'text-xl'
            })}
          `}>
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        
        <Button
          onClick={handleGoHome}
          className={`
            ${getResponsiveClasses(deviceInfo, {
              mobile: 'px-4 py-2 text-sm',
              tablet: 'px-6 py-3 text-base',
              desktop: 'px-8 py-4 text-lg',
              largeDesktop: 'px-10 py-5 text-xl'
            })}
          `}
        >
          <Home className={`
            mr-2
            ${getResponsiveClasses(deviceInfo, {
              mobile: 'w-4 h-4',
              tablet: 'w-5 h-5',
              desktop: 'w-6 h-6',
              largeDesktop: 'w-7 h-7'
            })}
          `} />
          Return to Home
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
