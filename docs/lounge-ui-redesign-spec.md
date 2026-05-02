# Lounge UI redesign spec

## Scope

This redesign covers the first-class lounge workspace pages exposed by the sidebar/navigation surface:

- `/lounge`
- `/lounge/requests`
- `/lounge/bookings`
- `/lounge/conversations`
- `/lounge/aliases`
- `/lounge/profile`
- `/lounge/friends`
- `/lounge/email-deliveries`

Detail pages and onboarding stay outside the first pass because request/booking detail screens are also reused by `/me/*` routes and currently rely on history-based back behavior.

## Current problems

- The only persistent left sidebar lives in `LoungeSimple.tsx`, so users lose workspace context after leaving `/lounge`.
- Sidebar links have no active state, making the current section hard to read at a glance.
- The sidebar is hidden on mobile without an equivalent navigation pattern.
- `/lounge/friends` is effectively discoverable only from the desktop dashboard sidebar.
- `/lounge/email-deliveries` is routed but absent from the main lounge navigation.
- Child pages repeat their own top bars and quick-link clusters, producing inconsistent chrome.
- Visual language drifts between dark console screens and lighter radial card screens.

## Design direction

Use a quiet operational workspace style: dark structural shell, stable navigation, compact content density, and strong status accents only where users need attention. The lounge should feel like one control surface for repeated work, not a set of separate landing pages.

## Target experience

- Desktop users get one persistent left rail across the primary lounge workspace.
- Mobile users get a compact sticky bottom navigation with the same IA.
- Every primary lounge destination appears in the same nav model.
- The current route is visibly active.
- Page headers become content-level headers, while global navigation belongs to the shell.
- Existing page logic remains in place to keep the first pass reviewable.

## Information architecture

Primary nav:

- Dashboard
- Requests
- Reservations
- Conversations
- Aliases
- Profile
- Friends
- Email

Badges:

- Requests: pending request count.
- Reservations: reservation count.
- Conversations: conversation count.
- Friends: friend count.
- Email: currently no reliable global count without booking-specific delivery fan-out, so it remains unbadged in the first pass.

## Acceptance criteria

- All primary lounge workspace pages render inside the shared shell.
- Desktop left navigation persists across the primary lounge workspace.
- Mobile navigation exposes the same destinations instead of hiding the IA.
- `/lounge/email-deliveries` is accessible from primary nav.
- Active route styling works for each wrapped page.
- Existing page data and actions remain intact.
