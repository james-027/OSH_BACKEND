# SSE Pure Broadcast Architecture

## Overview

The refactored SSE module uses a **pure broadcast** architecture where all events are sent to ALL connected clients in real-time. This is simpler, faster, and more scalable than per-user routing.

## How It Works

```
┌──────────────────────────────────────────────────────────────────┐
│                         BROWSER CLIENTS                          │
│                                                                  │
│  User 1          User 2          User 3          User 4          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│  │EventSource│   │EventSource│   │EventSource│   │EventSource│  │
│  │  /sse/   │   │  /sse/   │   │  /sse/   │   │  /sse/   │   │
│  │broadcast │   │broadcast │   │broadcast │   │broadcast │   │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘    │
│       │              │              │              │            │
│       └──────────────┼──────────────┼──────────────┘            │
│                      │ HTTP         │ (Long Polling)            │
└──────────────────────┼──────────────┼────────────────────────────┘
                       │              │
                       │              ▼
                  ┌─────────────────────────────┐
                  │    NESTJS BACKEND SERVER    │
                  │                             │
                  │  SSEEmitterService          │
                  │  ┌─────────────────────┐   │
                  │  │ broadcastSubject    │   │
                  │  │ (RxJS Subject)      │   │
                  │  │                     │   │
                  │  │ All clients listen  │   │
                  │  │ to same stream      │   │
                  │  └────────┬────────────┘   │
                  │           │                │
                  │  When event happens:       │
                  │  1. Service emits event    │
                  │  2. broadcastSubject.next()
                  │  3. All clients receive    │
                  │     (in real-time)         │
                  │                             │
                  └─────────────────────────────┘
```

## Event Flow Example: Admin Adds Renewal Type

```
Admin creates renewal_types with ID=5
     ↓
RenewalTypesService.create()
     ↓
this.sseEventEmitter.emitCreate(
  'renewal_types',
  5,
  { id: 5, name: 'Monthly', ... }
)
     ↓
SSEEventEmitterHelper.emitCreate()
     ↓
SSEEmitterService.broadcastEvent(event)
     ↓
broadcastSubject.next({
  type: 'CREATE',
  resource: 'renewal_types',
  resourceId: 5,
  data: { ... },
  timestamp: '2025-12-13T10:30:00Z'
})
     ↓
ALL connected clients receive event
     ↓
React Query on client:
  - User 1 has ['renewal_types'] query → UPDATES
  - User 2 has ['renewal_types'] query → UPDATES
  - User 3 has ['renewal_types', 5] query → UPDATES
  - User 4 has no renewal_types query → NO UPDATE (smart match)
```

## Advantages

| Aspect            | Benefit                                            |
| ----------------- | -------------------------------------------------- |
| **Simplicity**    | No per-user routing logic, single broadcast stream |
| **Scalability**   | O(1) event routing vs O(n) per-user routing        |
| **Real-time**     | All users see updates simultaneously               |
| **Bandwidth**     | Smart React Query matching prevents wasted updates |
| **Code**          | Simpler helper methods, less boilerplate           |
| **Admin Changes** | Admin permissions/settings affect users instantly  |

## Service Integration

### Pattern 1: CREATE Operations

```typescript
// In RenewalTypesService.create()
const newRenewalType = await this.renewalTypesRepository.save(renewalTypeData);

// Emit broadcast event
try {
  const response = await this.findOne(newRenewalType.id);
  this.sseEventEmitter.emitCreate("renewal_types", newRenewalType.id, response);
} catch (sseError) {
  logger.warn("SSE emission failed:", sseError);
}
```

### Pattern 2: UPDATE Operations

```typescript
// In UsersService.update()
const updated = await this.usersRepository.save(userToUpdate);

// Emit broadcast event
try {
  const response = await this.createFlattenedResponse(updated);
  this.sseEventEmitter.emitUpdate("users", updated.id, response);
} catch (sseError) {
  logger.warn("SSE emission failed:", sseError);
}
```

### Pattern 3: DELETE Operations

```typescript
// In WarehouseRequirementsService.delete()
await this.warehouseRequirementsRepository.remove(requirement);

// Emit broadcast event
try {
  this.sseEventEmitter.emitDelete("warehouse_requirements", id);
} catch (sseError) {
  logger.warn("SSE emission failed:", sseError);
}
```

### Pattern 4: Complex Operations (INVALIDATE)

```typescript
// For complex operations that are hard to sync partially
try {
  this.sseEventEmitter.emitInvalidate("dashboard_stats");
  // Client will do full refetch instead of partial update
} catch (sseError) {
  logger.warn("SSE emission failed:", sseError);
}
```

## Frontend Integration

### Connect to Broadcast Stream

```typescript
const eventSource = new EventSource("/sse/broadcast", {
  withCredentials: true, // Include JWT cookie
});

eventSource.onmessage = (event) => {
  const sseEvent = JSON.parse(event.data);

  // React Query automatically matches:
  // sseEvent.resource to your query keys
  handleSSEEvent(sseEvent);
};
```

### React Query Smart Matching

```typescript
// Event arrives: { type: 'CREATE', resource: 'renewal_types', resourceId: 5 }

// React Query checks all cached queries:
if (hasQuery(["renewal_types"])) {
  // Match! Invalidate list to refetch
  queryClient.invalidateQueries(["renewal_types"]);
}

if (hasQuery(["renewal_types", 5])) {
  // Match! Update single item
  queryClient.setQueryData(["renewal_types", 5], newData);
}

if (hasQuery(["dashboard"])) {
  // No match. Ignore event (no wasted update)
}
```

## Resource Types (Examples)

These are commonly broadcast resources:

### Global Resources (All Users Need)

- `'renewal_types'` - Created/updated by admin, all users see
- `'requirements'` - Master data, shared
- `'warehouse_types'` - Configuration, all users see
- `'status'` - Status master data
- `'roles'` - Role definitions
- `'locations'` - Location hierarchy

### User-Specific Resources (User's Data)

- `'users'` - User profiles (admin changes permissions → user sees it)
- `'user_permissions'` - When admin updates, user's permissions change
- `'user_locations'` - When admin updates, user's accessible locations change

### Transaction Resources (All Users)

- `'warehouse_requirements'` - Warehouse-level data, broadcast updates
- `'req_transaction_headers'` - Transaction data, broadcast updates
- `'req_transaction_dues'` - Due dates, broadcast updates

## Performance Considerations

### Message Throughput

```
1 Broadcast Event → 100 Connected Users
├─ Sent to all 100 users simultaneously
├─ React Query matches intelligently
├─ Only 40 users have that query key → 40 updates
└─ No wasted bandwidth for the other 60 users
```

### CPU Usage

- Pure broadcast: **O(1)** - One `broadcastSubject.next(event)`
- Per-user routing: **O(n)** - Loop through n user subjects

## Backward Compatibility

The old `/sse/users/:user_id` endpoint still works but now returns the broadcast stream for all users:

```typescript
@Sse("users/:user_id")
subscribeToUserEvents(@Param("user_id") user_id: number): Observable<any> {
  // Returns broadcast stream regardless of user_id
  // (In pure broadcast, user_id is just for auth verification)
  return this.sseEmitterService.subscribeToEvents().pipe(...);
}
```

## When to Use emitInvalidate()

Use `emitInvalidate()` when:

1. Update is very complex with multiple related entities
2. You can't easily serialize the changed data
3. You want to guarantee data freshness
4. Performance is not critical (forces full refetch)

```typescript
// Example: Complex permission update affecting multiple relations
try {
  await this.updateComplexPermissions(userId, permissions);
  this.sseEventEmitter.emitInvalidate("user_permissions");
  // Client will do full refetch of user_permissions queries
} catch (error) {
  // Handle error
}
```

## Monitoring & Debugging

### Health Check Endpoint

```bash
curl http://localhost:3000/sse/health

{
  "status": "healthy",
  "activeSubscriptions": 42  # Current connected clients
}
```

### Browser DevTools

1. Open Network tab
2. Look for request to `/sse/broadcast`
3. Message tab shows incoming events:
   ```
   data: {"type":"UPDATE","resource":"users",...}
   ```

### Server Logging

Check application logs for SSE emissions:

```
[INFO] SSE event emission failed for user creation: ...
```

## Security Considerations

1. **JWT Authentication Required** - Only authenticated users can subscribe
2. **All Clients Receive All Events** - Frontend filters by resource type
3. **No Sensitive Data in Events** - Data is broadcast to all, apply field-level access control on frontend
4. **Rate Limiting** - Consider rate-limiting rapid events if needed
5. **CORS** - EventSource respects CORS, only same-origin by default

## Best Practices

1. ✅ Always wrap SSE emissions in try-catch
2. ✅ Log failures to help diagnose issues
3. ✅ Keep event payloads small (send IDs, let client fetch full data)
4. ✅ Use appropriate event types (CREATE, UPDATE, DELETE, INVALIDATE)
5. ✅ Match resource names to your entity types
6. ❌ Don't send sensitive data in events
7. ❌ Don't emit events synchronously in hot paths
8. ❌ Don't send entire objects, just IDs + necessary fields
