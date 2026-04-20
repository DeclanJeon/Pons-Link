import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/home', label: '홈' },
  { href: '/me/profile', label: '프로필' },
  { href: '/me/traits', label: '내 기질' },
  { href: '/me/relationships', label: '관계' },
  { href: '/me/growth', label: '성장' },
  { href: '/me/archive', label: '보관함' },
  { href: '/me/settings', label: '설정' },
] as const;

export function SelfUnderstandingNav() {
  const location = useLocation();

  return (
    <nav className="overflow-x-auto rounded-xl border border-border/60 bg-card/70 p-2 backdrop-blur-sm">
      <div className="flex min-w-max gap-2">
        {navItems.map((item) => {
          const active = location.pathname === item.href;
          return (
            <Button
              key={item.href}
              asChild
              size="sm"
              variant={active ? 'default' : 'ghost'}
              className={cn('whitespace-nowrap', active && 'shadow-sm')}
            >
              <Link to={item.href}>{item.label}</Link>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
