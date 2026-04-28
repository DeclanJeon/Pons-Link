import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/home', label: 'Home' },
  { href: '/me/profile', label: 'Profile' },
  { href: '/me/traits', label: 'Traits' },
  { href: '/me/relationships', label: 'Relationships' },
  { href: '/me/growth', label: 'Growth' },
  { href: '/me/archive', label: 'Archive' },
  { href: '/me/settings', label: 'Settings' },
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
