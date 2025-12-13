# SSE Pure Broadcast Architecture - Visual Guide

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            REACT FRONTEND                                   │
│                                                                             │
│    Browser 1 (User 1)      Browser 2 (User 2)      Browser 3 (User 3)     │
│    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│    │ useSSEBroadcast()│    │ useSSEBroadcast()│    │ useSSEBroadcast()│   │
│    │       ↓          │    │       ↓          │    │       ↓          │   │
│    │  EventSource     │    │  EventSource     │    │  EventSource     │   │
│    │ /sse/broadcast   │    │ /sse/broadcast   │    │ /sse/broadcast   │   │
│    │       ↓          │    │       ↓          │    │       ↓          │   │
│    │  React Query     │    │  React Query     │    │  React Query     │   │
│    │  Cache Manager   │    │  Cache Manager   │    │  Cache Manager   │   │
│    │       ↓          │    │       ↓          │    │       ↓          │   │
│    │ Updates UI when  │    │ Updates UI when  │    │ Updates UI when  │   │
│    │  events match    │    │  events match    │    │  events match    │   │
│    │  query keys      │    │  query keys      │    │  query keys      │   │
│    └──────────────────┘    └──────────────────┘    └──────────────────┘   │
│            ▲                         ▲                        ▲             │
│            │ Event                   │ Event                 │ Event       │
│            │ message                 │ message               │ message     │
│            └─────────────────────────┼───────────────────────┘             │
│                                      │                                     │
└──────────────────────────────────────┼─────────────────────────────────────┘
                                       │
                                       │ HTTP EventSource
                                       │ (Long Polling)
                                       │
┌──────────────────────────────────────┼─────────────────────────────────────┐
│                                      │                                     │
│                          NESTJS BACKEND SERVER                             │
│                                      ▼                                     │
│                    ┌─────────────────────────────┐                         │
│                    │   SSE Broadcast Stream      │                         │
│                    │   (RxJS Subject)            │                         │
│                    │                             │                         │
│                    │  broadcastSubject.next()    │                         │
│                    │  (Single source of events)  │                         │
│                    └──────────────┬──────────────┘                         │
│                                   ▲                                       │
│                                   │                                       │
│                                   │ emit*(...)                             │
│                                   │                                       │
│                    ┌──────────────┴──────────────┐                         │
│                    │ SSEEventEmitterHelper       │                         │
│                    │                             │                         │
│                    │ - emitCreate()              │                         │
│                    │ - emitUpdate()              │                         │
│                    │ - emitDelete()              │                         │
│                    │ - emitInvalidate()          │                         │
│                    └──────────────┬──────────────┘                         │
│                                   ▲                                       │
│                                   │                                       │
│                 ┌─────────────────┼─────────────────┐                     │
│                 │                 │                 │                     │
│           UsersService      WarehouseRequirements   ReqTransactionHeaders │
│           ├─ create()       Service                 Service              │
│           ├─ update()       ├─ create()             ├─ create()          │
│           └─ delete()       ├─ update()             └─ update()          │
│                             └─ delete()             (more services...)   │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Event Flow: Step by Step

### Example: Admin Creates Renewal Type

```
Step 1: Admin Creates
┌─────────────────────────────────────────────────────────────────┐
│ Admin Browser → POST /renewal-types                            │
│ { name: "Quarterly", days: 90 }                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
Step 2: Backend Receives
                           ▼
                ┌──────────────────────────┐
                │ RenewalTypesService      │
                │ .create(createDto)       │
                │ ├─ Validate data         │
                │ ├─ Save to DB            │
                │ └─ Return created        │
                └──────────────┬───────────┘
                               │
Step 3: Emit SSE Event
                               ▼
            ┌────────────────────────────────────────┐
            │ this.sseEventEmitter.emitCreate(       │
            │   'renewal_types',                     │
            │   5,                                   │
            │   { id: 5, name: 'Quarterly', ... }   │
            │ )                                      │
            └────────────────────┬───────────────────┘
                                 │
Step 4: Helper Formats Event
                                 ▼
                    ┌────────────────────────────┐
                    │ SSEEventEmitterHelper      │
                    │ .emitCreate()              │
                    │ ├─ Create SSEEvent         │
                    │ ├─ type: 'CREATE'          │
                    │ ├─ resource: 'renewal_...' │
                    │ ├─ resourceId: 5           │
                    │ ├─ data: {...}             │
                    │ └─ timestamp: '...'        │
                    └────────────────┬───────────┘
                                     │
Step 5: Broadcast to All Clients
                                     ▼
                       ┌─────────────────────────┐
                       │ broadcastSubject.next() │
                       └──────────────┬──────────┘
                                      │
        ┌─────────────────────────────┼──────────────────────────┐
        │                             │                          │
Step 6: All Browsers Receive Event
        ▼                             ▼                          ▼
   ┌─────────┐                  ┌─────────┐                ┌─────────┐
   │ User 1  │                  │ User 2  │                │ User 3  │
   │ Browser │                  │ Browser │                │ Browser │
   └────┬────┘                  └────┬────┘                └────┬────┘
        │                            │                         │
        │ Event received             │ Event received          │ Event received
        │ resource: 'renewal_types'  │ resource: 'renewal_...' │ resource: 'renewal_...'
        │                            │                        │
Step 7: React Query Smart Matching
        │                            │                        │
        ▼                            ▼                        ▼
    Has query                    Has query                 Has query
    ['renewal_types']?           ['renewal_types']?        ['renewal_types']?
        │ YES                        │ YES                      │ YES
        ▼                            ▼                         ▼
    Invalidate                   Invalidate               Invalidate
    ['renewal_types']            ['renewal_types']        ['renewal_types']
        │                            │                        │
        ▼                            ▼                        ▼
    Refetch API                  Refetch API              Refetch API
        │                            │                        │
        ▼                            ▼                        ▼
    GET /renewal-types          GET /renewal-types      GET /renewal-types
        │                            │                        │
        ▼                            ▼                        ▼
    Receives new list            Receives new list        Receives new list
    (with Quarterly!)            (with Quarterly!)        (with Quarterly!)
        │                            │                        │
        ▼                            ▼                        ▼
    Update cache                 Update cache             Update cache
        │                            │                        │
        ▼                            ▼                        ▼
    React component               React component          React component
    re-renders                    re-renders               re-renders
        │                            │                        │
        ▼                            ▼                        ▼
    ┌─────────────────────────────────────────────────────────────┐
    │ All users see:                                              │
    │                                                             │
    │ Renewal Type 1 - Monthly    Renewal Type 2 - Weekly        │
    │ Renewal Type 3 - Bi-Weekly  Renewal Type 4 - Annual        │
    │ Renewal Type 5 - Quarterly  ← NEW! (instant, no refresh!)  │
    └─────────────────────────────────────────────────────────────┘
```

## Method Signature Changes

### Before (Per-User)

```typescript
// Had to pass userId
this.sseEventEmitter.emitUserCreate(userId, "renewal_types", 5, data);
this.sseEventEmitter.emitUserUpdate(userId, "users", 10, data);
this.sseEventEmitter.emitUserDelete(userId, "warehouse_requirements", 7);
```

### After (Pure Broadcast)

```typescript
// No userId needed - goes to all users
this.sseEventEmitter.emitCreate("renewal_types", 5, data);
this.sseEventEmitter.emitUpdate("users", 10, data);
this.sseEventEmitter.emitDelete("warehouse_requirements", 7);
```

## React Query Cache Matching Engine

```
Event arrives:
{ type: 'CREATE', resource: 'renewal_types', resourceId: 5, data: {...} }

React Query checks ALL cached queries:
┌─────────────────────────────────────┐
│ Cached Query                        │ Match? │ Action
├─────────────────────────────────────┼────────┼──────────────────────────
│ ['renewal_types']                   │ ✅ YES │ Invalidate → Refetch
│ ['renewal_types', 5]                │ ✅ YES │ Update + Invalidate
│ ['renewal_types', 6]                │ ❌ NO  │ Ignore
│ ['renewal_types', { filter: 'x' }]  │ ✅ YES │ Invalidate → Refetch
│ ['users']                           │ ❌ NO  │ Ignore
│ ['dashboard']                       │ ❌ NO  │ Ignore
│ ['warehouse_requirements']          │ ❌ NO  │ Ignore
└─────────────────────────────────────┴────────┴──────────────────────────

Result: Only relevant caches updated
        No wasted bandwidth or CPU
```

## Performance: Single Broadcast vs Per-User

```
10 Connected Users, 1 Event

PER-USER ROUTING (Old):
Event → Service → Loop 10 times → Send to user 1, 2, 3... 10
Time: O(n) = O(10)
Code: Complex routing logic
Failure: If one user connection breaks, event still sent to others

PURE BROADCAST (New):
Event → Service → broadcastSubject.next() → ALL users at once
Time: O(1) = Constant
Code: Simple, one line
Failure: If broadcast fails, fails for all (which is correct)

100 Connected Users, 1 Event:
Per-user: O(100) - slower
Pure: O(1) - same speed ✅

1000 Connected Users, 1 Event:
Per-user: O(1000) - much slower
Pure: O(1) - same speed ✅
```

## Real-Time Sync Scenarios

### Scenario 1: Admin Changes User Permissions

```
Admin Panel (Browser 1)
↓
PUT /users/25/permissions { ... }
↓
Backend: UsersService.update(userId=25)
↓
emitUpdate('users', 25, userData)
↓
All browsers receive event
↓
User 25's browser matches:
  ✅ ['users', 25] → Updates profile
  ✅ ['users'] → Invalidates user list if shown
↓
User 25 sees permission changes immediately
(Without clicking refresh!)

Other users' browsers:
  ❌ ['users', 25] - don't have this cached
  ❌ ['users'] - don't have this cached
  → No wasted updates
```

### Scenario 2: Admin Adds Renewal Type

```
Admin Panel (Browser 1)
↓
POST /renewal-types { name: 'Quarterly' }
↓
Backend: RenewalTypesService.create()
↓
emitCreate('renewal_types', 5, newType)
↓
All browsers receive event
↓
Browser 1 (Admin): ['renewal_types'] matches → Refetch
Browser 2 (User 2): ['renewal_types'] matches → Refetch
Browser 3 (User 3): ['renewal_types'] matches → Refetch
↓
All dropdowns instantly update
(All without manual refresh!)
```

### Scenario 3: User Changes Own Password

```
User 1's Profile (Browser 1)
↓
POST /auth/change-password { ... }
↓
Backend: UsersService.update(userId=1)
↓
emitUpdate('users', 1, userData)
↓
All browsers receive event
↓
Browser 1: ['users', 1] matches → Updates cache
Browser 2: ['users', 1] doesn't exist → Ignored
Browser 3: ['users', 5] exists but doesn't match → Ignored
↓
Only User 1's browser updates
(No unnecessary updates for other users)
```

## Endpoints Reference

| Endpoint         | Method | Purpose               | Auth   |
| ---------------- | ------ | --------------------- | ------ |
| `/sse/broadcast` | GET    | Main broadcast stream | JWT ✅ |
| `/sse/users/:id` | GET    | Backward compatible   | JWT ✅ |
| `/sse/health`    | GET    | Health check          | JWT ✅ |

## Resource Types Reference

| Resource                  | Type        | Who Sees                                 |
| ------------------------- | ----------- | ---------------------------------------- |
| `users`                   | User data   | All users via ['users'] or ['users', id] |
| `renewal_types`           | Master data | All users with this query                |
| `requirements`            | Master data | All users with this query                |
| `warehouse_requirements`  | Transaction | All users with this query                |
| `req_transaction_headers` | Transaction | All users with this query                |
| `locations`               | Master data | All users with this query                |
| `roles`                   | Master data | All users with this query                |
| `status`                  | Master data | All users with this query                |

## Configuration

### Backend

No configuration needed - pure broadcast is built-in!

### Frontend

```typescript
useSSEBroadcast({
  baseUrl: process.env.REACT_APP_API_URL, // Customize if needed
  maxRetries: 5, // Auto-reconnect attempts
  initialRetryDelay: 3000, // Start with 3 second delay
  onConnect: () => console.log("Connected"),
  onError: (err) => console.error("Error:", err),
  onDisconnect: () => console.log("Disconnected"),
});
```
