# Lounge UI work order

## Objective

Turn the lounge from a dashboard-only sidebar into a consistent workspace shell across all primary sidebar destination pages.

## Implementation steps

1. Add a shared `LoungeShell` component.
2. Centralize the primary lounge navigation items inside that shell.
3. Include `/lounge/email-deliveries` in primary navigation.
4. Add active route styling for desktop and mobile navigation.
5. Add a mobile sticky nav so sidebar destinations are not hidden below `lg`.
6. Wrap the primary lounge workspace pages with `LoungeShell`.
7. Remove duplicated top logo/back bars from wrapped pages.
8. Keep request and booking detail pages outside the first pass because they are reused by `/me/*` routes.

## Files to change

- `src/components/lounge/LoungeShell.tsx`
- `src/pages/LoungeSimple.tsx`
- `src/pages/LoungeRequests.tsx`
- `src/pages/LoungeBookings.tsx`
- `src/pages/LoungeConversations.tsx`
- `src/pages/LoungeAliases.tsx`
- `src/pages/LoungeProfile.tsx`
- `src/pages/LoungeFriends.tsx`
- `src/pages/LoungeEmailDeliveries.tsx`

## Follow-up work

- Decide whether request and booking detail pages should use the lounge shell, route-aware breadcrumbs, or a focused detail layout.
- Replace `navigate(-1)` with explicit return targets where deep links are expected.
- Add tests that assert shared lounge navigation coverage once the shell behavior is stable.
