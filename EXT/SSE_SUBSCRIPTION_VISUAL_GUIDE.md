# SSE Subscription Tracking - Visual Guide

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER 1 (User A)                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ useSSEWithCookies Hook                                         │ │
│  │ - EventSource('/sse/broadcast', { withCredentials: true })     │ │
│  │ - Listening to: ['users', 3]                                   │ │
│  │ - On INVALIDATE event → invalidate React Query cache           │ │
│  └────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┬┘
                                  │
                    HTTP/SSE (withCredentials)
                                  │
        ┌─────────────────────────┴─────────────────────────┐
        │                                                   │
┌───────▼──────────────────────────────────────────────────▼──────────┐
│                      NESTJS BACKEND                                  │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ SSEEmitterService                                                │ │
│ │                                                                  │ │
│ │  subscriptionRegistry (Map)                                      │ │
│ │  ├─ Sub-ID-1: { resource: 'users', resourceId: 3, ... }       │ │
│ │  ├─ Sub-ID-2: { resource: 'users', resourceId: 3, ... }  ◄──┐ │ │
│ │  ├─ Sub-ID-3: { resource: 'locations', resourceId: 42, ... }│ │ │
│ │  └─ Sub-ID-4: { resource: 'locations', resourceId: 42, ... }│ │ │
│ │                                                            │ │ │ │
│ │  broadcastSubject (RxJS Subject)                          │ │ │ │
│ │  ├─ Emits to ALL subscribers                              │ │ │ │
│ │  └─ Events: CREATE, UPDATE, DELETE, INVALIDATE            │ │ │ │
│ │                                                            │ │ │ │
│ │  Methods:                                                  │ │ │ │
│ │  ├─ subscribeToEvents() ────────────────────────────────┐ │ │ │ │
│ │  ├─ broadcastEvent(event)                              │ │ │ │ │
│ │  ├─ getActiveSubscriptionsCount() → 4                  │ │ │ │ │
│ │  ├─ getSubscriptionStats() → stats                     │ │ │ │ │
│ │  ├─ listSubscriptionsByResource() → [Sub-ID-1, 2] ────┘ │ │ │
│ │  ├─ invalidateResource('users', 3)                      │ │ │ │
│ │  └─ invalidateAllSubscriptionsForResourceId(3)          │ │ │ │
│ │                                                          │ │ │ │
│ └──────────────────────────────────────────────────────────┘ │ │ │
│                            ▲                                  │ │ │
│                            │ Called from Services             │ │ │
│ ┌──────────────────────────┴───────────────────────────────┐ │ │ │
│ │  UsersService / RolesService / ModulesService / etc.     │ │ │ │
│ │                                                          │ │ │ │
│ │  updateUserRoles(3, [newRoles]):                        │ │ │ │
│ │  1. await userRepository.update(3, { roles: ... })     │ │ │ │
│ │  2. this.sseEmitterService                             │ │ │ │
│ │     .invalidateAllSubscriptionsForResourceId(3) ───────┴─┘ │ │
│ │     // Broadcasts to: Sub-ID-1, Sub-ID-2 (both users:3)   │ │
│ │                                                          │ │ │
│ └──────────────────────────────────────────────────────────┘ │ │
│                            ▲                                  │ │ │
│                            │                                  │ │ │
│  Event Flow:                                                  │ │ │
│  Service updates DB                                           │ │ │
│       ↓                                                        │ │ │
│  Service calls invalidation                                   │ │ │
│       ↓                                                        │ │ │
│  SSEEmitterService broadcasts to ALL clients                  │ │ │
│       ↓                                                        │ │ │
│  Browsers receive INVALIDATE event                            │ │ │
│       ↓                                                        │ │ │
│  React Query refetches                                        │ │ │
│       ↓                                                        │ │ │
│  UI updates everywhere                                        │ │ │
│                                                                │ │ │
└────────────────────────────────────────────────────────────────┘ │
                                                                    │
        ┌─────────────────────────────────────────────────────────┘
        │
┌───────▼──────────────────────────────────────────────────────────┐
│                      BROWSER 2 (Other User)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ useSSEWithCookies Hook                                     │ │
│  │ - EventSource('/sse/broadcast', { withCredentials: true }) │ │
│  │ - Also listening but NOT to ['users', 3]                   │ │
│  │ - Receives event but React Query doesn't match query key   │ │
│  │ - No cache invalidation (not affected)                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

---

## State Flow: User Role Change

```
TIME 0: Initial State
════════════════════════════════════════════════════════════════════════
Browser A: Connected to ['users', 3]  (Sub-ID-1)
Browser B: Connected to ['locations']  (Sub-ID-2)
Backend Registry:
  Sub-ID-1: { resource: 'users', resourceId: 3, subscribedAt: 09:00 }
  Sub-ID-2: { resource: 'locations', subscribedAt: 09:05 }

Total Subscriptions: 2
Per Resource: { users: 1, locations: 1 }


TIME 1: Backend Changes User #3's Role
════════════════════════════════════════════════════════════════════════
API Call: PUT /users/3/roles { roleIds: [2, 3] }

UsersService.updateUserRoles():
  ✓ await userRepository.update(3, { roles: [2, 3] })
  ✓ this.sseEmitterService.invalidateAllSubscriptionsForResourceId(3)


TIME 2: SSEEmitterService Processes Invalidation
════════════════════════════════════════════════════════════════════════
invalidateAllSubscriptionsForResourceId(3) called:

  1. Find subscriptions with resourceId = 3
     → Found: Sub-ID-1 (resource: 'users', resourceId: 3)

  2. Broadcast INVALIDATE event to ALL clients:
     {
       type: 'INVALIDATE',
       resource: 'users',
       resourceId: 3,
       timestamp: '2025-12-17T10:30:45Z'
     }


TIME 3: Browsers Receive Event
════════════════════════════════════════════════════════════════════════
Browser A (listening to users:3):
  ✓ onmessage event received
  ✓ event.resource === 'users' && event.resourceId === 3
  ✓ Match! → queryClient.invalidateQueries({ queryKey: ['users', 3] })
  ✓ React Query refetches: GET /users/3
  ✓ UI updates with new role

Browser B (listening to locations):
  ✓ onmessage event received
  ✗ event.resource !== 'locations'
  ✗ No match → React Query not triggered
  ✓ UI unchanged (correct - not affected)


TIME 4: React Query Refetch
════════════════════════════════════════════════════════════════════════
Browser A: GET /users/3
Response: { id: 3, name: 'User 3', roles: [2, 3], ... }
React Component re-renders with new role


TIME 5: Final State
════════════════════════════════════════════════════════════════════════
Backend Registry: (unchanged - same subscriptions)
  Sub-ID-1: { resource: 'users', resourceId: 3, subscribedAt: 09:00 }
  Sub-ID-2: { resource: 'locations', subscribedAt: 09:05 }

Browser A: Shows updated user #3 with new role
Browser B: Shows original data (not affected)
```

---

## Subscription Registry Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  subscriptionRegistry: Map<string, SubscriptionDetail>          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Key: "1702816245000-a1b2c3d4e"  (Generated ID)               │
│  Value: {                                                       │
│    subscriptionId: "1702816245000-a1b2c3d4e"                   │
│    subscribedAt: Date(2025-12-17T10:30:45.000Z)               │
│    resource: "users"                                           │
│    resourceId: 3                                               │
│    queryKey: "users:3"                                         │
│  }                                                              │
│                                                                 │
│  Key: "1702816250000-x9y8z7w6v"                                │
│  Value: {                                                       │
│    subscriptionId: "1702816250000-x9y8z7w6v"                   │
│    subscribedAt: Date(2025-12-17T10:30:50.000Z)               │
│    resource: "locations"                                       │
│    resourceId: 42                                              │
│    queryKey: "locations:42"                                    │
│  }                                                              │
│                                                                 │
│  Key: "1702816255000-p8o7i6u5y"                                │
│  Value: {                                                       │
│    subscriptionId: "1702816255000-p8o7i6u5y"                   │
│    subscribedAt: Date(2025-12-17T10:30:55.000Z)               │
│    resource: "users"                                           │
│    resourceId: 3                                               │
│    queryKey: "users:3"                                         │
│  }                                                              │
│                                                                 │
│  Size: 3 total subscriptions                                   │
│  Per Resource: { users: 2, locations: 1 }                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Invalidation Patterns - Visual

### Pattern 1: Single Resource

```
Service:  updateLocation(id: 42)
                   ↓
         invalidateResource('locations', 42)
                   ↓
      Find in registry: { resourceId: 42 }
                   ↓
      Broadcast to ALL: { type: 'INVALIDATE',
                          resource: 'locations',
                          resourceId: 42 }
                   ↓
      Browsers matching 'locations:42': refetch ✓
      Other browsers: ignore ✓
```

### Pattern 2: Cross-Resource (User Deleted)

```
Service:  deleteUser(id: 3)
                   ↓
     invalidateAllSubscriptionsForResourceId(3)
                   ↓
      Find in registry:
      ├─ { resourceId: 3, resource: 'users' }
      ├─ { resourceId: 3, resource: 'roles' }
      └─ { resourceId: 3, resource: 'permissions' }
                   ↓
      Broadcast 3 events:
      ├─ { type: 'INVALIDATE', resource: 'users', resourceId: 3 }
      ├─ { type: 'INVALIDATE', resource: 'roles', resourceId: 3 }
      └─ { type: 'INVALIDATE', resource: 'permissions', resourceId: 3 }
                   ↓
      All browsers listening to user#3 in any form: refetch ✓
```

### Pattern 3: Batch (Multiple Roles Deactivated)

```
Service:  deactivateRoles([1, 2, 3])
                   ↓
  invalidateMultipleResourceIds([1, 2, 3])
                   ↓
      For each ID, call:
      invalidateAllSubscriptionsForResourceId(id)
                   ↓
      Equivalent to:
      ├─ invalidateAllSubscriptionsForResourceId(1)
      ├─ invalidateAllSubscriptionsForResourceId(2)
      └─ invalidateAllSubscriptionsForResourceId(3)
                   ↓
      Multiple events broadcast to affected browsers ✓
```

---

## Monitoring Dashboard (Conceptual)

```
╔═══════════════════════════════════════════════════════════════════╗
║            SSE Subscription Monitoring Dashboard                  ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  Total Active Subscriptions:  45                                  ║
║                                                                   ║
║  ┌──────────────────────────────────────────────────────────────┐ ║
║  │ Per Resource Type                                            │ ║
║  ├──────────────────────────────────────────────────────────────┤ ║
║  │  users:                      ████████░░░░  12 subscriptions  │ ║
║  │  locations:                 ████████████░░  18 subscriptions │ ║
║  │  warehouse_requirements:    ██████░░░░░░░░   8 subscriptions │ ║
║  │  renewal_types:             ███░░░░░░░░░░░   3 subscriptions │ ║
║  │  req_transaction_headers:   ██░░░░░░░░░░░░   2 subscriptions │ ║
║  │  modules:                   ░░░░░░░░░░░░░░   2 subscriptions │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
║                                                                   ║
║  ┌──────────────────────────────────────────────────────────────┐ ║
║  │ Recent Invalidations (Last 10 min)                           │ ║
║  ├──────────────────────────────────────────────────────────────┤ ║
║  │  10:35  │ INVALIDATE │ users:3       │ 2 subscriptions      │ ║
║  │  10:34  │ INVALIDATE │ locations:42  │ 1 subscription       │ ║
║  │  10:32  │ INVALIDATE │ roles:5       │ 4 subscriptions      │ ║
║  │  10:30  │ CREATE     │ modules:100   │ broadcast            │ ║
║  │  10:28  │ INVALIDATE │ users:[1,2,3]│ 6 subscriptions      │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
║                                                                   ║
║  ┌──────────────────────────────────────────────────────────────┐ ║
║  │ Top Resources (Most Listened To)                             │ ║
║  ├──────────────────────────────────────────────────────────────┤ ║
║  │  1. locations      18 subs  (User Activity: High)            │ ║
║  │  2. users         12 subs  (User Activity: Medium)           │ ║
║  │  3. warehouse_req  8 subs  (User Activity: Low)              │ ║
║  │  4. renewal_types  3 subs  (User Activity: Low)              │ ║
║  │  5. transactions   2 subs  (User Activity: Low)              │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

## Integration Checklist

```
┌─ Service Layer Integration
│
├─ [ ] UsersService
│      └─ [ ] Inject SSEEmitterService
│      └─ [ ] Add invalidation to updateUserRoles()
│      └─ [ ] Add invalidation to updateUserPermissions()
│      └─ [ ] Add invalidation to deactivateUser()
│
├─ [ ] RolesService
│      └─ [ ] Inject SSEEmitterService
│      └─ [ ] Add invalidation to deactivateRole()
│      └─ [ ] Find affected users: getUsersByRole()
│      └─ [ ] Call invalidateMultipleResourceIds()
│
├─ [ ] ModulesService
│      ✓ Already done! See example
│
├─ [ ] WarehouseService
│      └─ [ ] Inject SSEEmitterService
│      └─ [ ] Add invalidation to updateWarehouse()
│
├─ [ ] LocationsService
│      └─ [ ] Inject SSEEmitterService
│      └─ [ ] Add invalidation to updateLocation()
│      └─ [ ] Add invalidation to transferWarehouse()
│
└─ [ ] All Other Services
       └─ [ ] Follow same pattern as ModulesService
```

---

## Code Template

```typescript
// BEFORE: Service with SSE events only
async updateSomething(id: number) {
  const item = await this.repository.update(id, data);
  this.sseEventEmitter.emitUpdateSignal('resource_name', id);
  return item;
}


// AFTER: Service with SSE events + invalidation
async updateSomething(id: number) {
  const item = await this.repository.update(id, data);

  // Emit update event (broadcasts change)
  this.sseEventEmitter.emitUpdateSignal('resource_name', id);

  // Invalidate subscription (triggers refetch)
  // → Choose one:
  this.sseEmitterService.invalidateResource('resource_name', id);

  return item;
}


// ADVANCED: Find affected entities and invalidate batch
async updateWithAffects(id: number) {
  const item = await this.repository.update(id, data);

  // Find entities affected by this change
  const affectedIds = await this.findAffectedEntities(id);

  if (affectedIds.length > 0) {
    this.sseEmitterService.invalidateMultipleResourceIds(affectedIds);
  }

  return item;
}
```

---
