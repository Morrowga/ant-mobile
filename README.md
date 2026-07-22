# Ants — Employee Mobile App

Employee-facing app (Expo / React Native) for the Ants workforce platform.
Serves the `employee` and `manager` roles — managers get the same personal
screens; their team views live on the web dashboard. Owners don't use this app.

## Stack

Expo SDK 51 (managed), Expo Router (file-based), TanStack Query, NativeWind
(Tailwind in RN, same coffee design tokens as the dashboard), Axios client
with central JWT + refresh-rotation handling, expo-secure-store for tokens,
expo-location + expo-task-manager for on-the-clock GPS, expo-camera for the
optional check-in selfie, expo-notifications for FCM push.

## Running it

```bash
npm install
cp .env.example .env          # set EXPO_PUBLIC_API_BASE_URL to your backend
npx expo start                # scan the QR with Expo Go
```

**Expo Go covers almost everything** — auth, onboarding, attendance,
reports, overtime, health, knowledge, feedback, certificates, notifications
UI, offline queueing.

**Background location and real push need a custom dev build.** Expo Go
cannot run background location tasks or use your own FCM credentials. Build
a development client once and use it instead of Expo Go:

```bash
npm install -g eas-cli
eas build --profile development --platform android   # or ios
```

Install the resulting build on a device, then `npx expo start --dev-client`.
This is not optional for testing rules 1–2 below — plan for it, it's a
one-time ~15-minute cloud build, not a surprise at release time.

On Android, note that the OS shows a **persistent notification** the entire
time location tracking runs. That is deliberate and required (see rule 2);
the consent screen discloses it before the permission is ever requested.

Point the app at a backend reachable from the phone (your machine's LAN IP,
not `localhost`, when testing on a real device).

## Where the business rules live

1. **Tracking only between check-in and check-out** — `src/lib/location.ts`.
   `startTracking()` is called only after a successful check-in;
   `stopTracking()` (a hard `stopLocationUpdatesAsync`, not a pause) is the
   first thing check-out does, before the network call. The backend
   independently 409s pings outside a session.
2. **Persistent notification while tracking** — the foreground-service
   notification is configured in `startLocationUpdatesAsync` and disclosed
   verbatim on the consent screen.
3. **Explicit consent** — `app/(onboarding)/consent.tsx` records each type
   via `POST /consent` *before* any OS permission prompt, and the Today
   screen shows a visible "location tracking active" badge during a session.
4. **Overtime can't close without a report** — `app/(app)/overtime.tsx` has
   no end-without-report path at all; the End button *is* the report form,
   and `/overtime/end` fires only after `/overtime/{id}/report` succeeds.
5. **Same-day report edits** — edit/delete disable once `editable_until`
   passes, with an explanation, so the server's 403 is never a surprise.
6. **Health is self-only** — the Health tab renders only `/health/me/*`;
   there is no team-health UI anywhere.
7. **Offline queueing** — `src/lib/offline-queue.ts`. Check-in, check-out,
   and report submission queue to AsyncStorage on connectivity failure
   (never on server rejection) and replay in order on reconnect/app start.
   The Today screen shows a "waiting to sync" banner while anything is queued.
8. **FCM registration** — `src/lib/push.ts` registers on login and
   re-registers via `addPushTokenListener` when the token rotates;
   unregisters on sign-out.
9. **Presence heartbeat** — `src/lib/presence.ts` posts
   `/presence/heartbeat` every 60s while foregrounded so the backend routes
   pushes to whichever surface is active.

**Plan gating:** the backend applies `RequireActivePlan` to every feature
router, so if the company's subscription lapses, every request 402s. The
shared `QueryBoundary` renders a "ask your company admin — plans are managed
on the web dashboard" state for that, since employees can't fix billing here.
The AI pace field on report detail is Mid+ only and renders a graceful
explanation when absent (Startup tier).

## Deliberate deviations from the Part B doc (verified against the actual backend)

- **Report detail:** Part B says `GET /reports/me/{id}`; the backend route is
  `GET /reports/{id}` (permission-checked, flat shape per Changes_Summary
  A1). The app calls the real route.
- **Change password:** Part B says `POST /me/change-password`; the backend
  serves `POST /auth/me/change-password`. The app calls the real route.
- **Forgot/reset password:** screens are built and wired to
  `POST /auth/forgot-password` / `POST /auth/reset-password`, but those
  endpoints **do not exist in the backend yet** (same known gap the
  dashboard has). They'll work as soon as the backend adds them.
- **Check-in selfie:** captured with expo-camera and uploaded via
  `POST /uploads`, but the backend's check-in accepts only `lat`/`lng` — the
  photo isn't linked to the session server-side yet. The selfie is optional
  and skippable; linking it needs a small backend change (e.g. a `photo_url`
  field on check-in).
- **Steps:** the backend only exposes `GET /health/steps/me` (no write
  endpoint), so steps display as read-only "synced" data.

## Layout

```
app/
  (auth)/         login, accept-invite, forgot/reset password
  (onboarding)/   consent → desk-location pin → checklist
  (app)/
    (tabs)/       Today · Reports · Health · Knowledge · Profile
    report/       new, [id] (pace + comments + same-day edit)
    knowledge/    [id], new
    leave, overtime, attendance-history, certificates,
    recognitions, feedback, notifications, notification-preferences,
    change-password
src/
  lib/            api-client, auth, location task, offline-queue,
                  push, presence, query-client, types
  components/     ui kit (coffee palette), QueryBoundary
```

Deep links: `ants://accept-invite?token=…` and `ants://reset-password?token=…`.
