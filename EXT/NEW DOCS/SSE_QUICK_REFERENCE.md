# SSE Pure Broadcast - Quick Reference

## The Simplest Explanation

**Before:** User 1 subscribes to User 1 events, User 2 subscribes to User 2 events

- ❌ User 1 creates renewal type → User 2 doesn't see it

**After:** All users subscribe to ONE broadcast stream

- ✅ User 1 creates renewal type → User 2 sees it immediately

## Backend: How to Emit Events

### In Your Service

```typescript
// After creating resource
this.sseEventEmitter.emitCreate("resource_name", resourceId, data);

// After updating resource
this.sseEventEmitter.emitUpdate("resource_name", resourceId, data);

// After deleting resource
this.sseEventEmitter.emitDelete("resource_name", resourceId);

// For complex updates (force refetch)
this.sseEventEmitter.emitInvalidate("resource_name");
```

### Real Examples

```typescript
// RenewalTypesService.create()
const created = await this.renewalTypesRepository.save(newType);
this.sseEventEmitter.emitCreate("renewal_types", created.id, created);

// UsersService.update()
const updated = await this.usersRepository.save(user);
this.sseEventEmitter.emitUpdate("users", user.id, updated);

// WarehouseRequirementsService.delete()
await this.repository.remove(requirement);
this.sseEventEmitter.emitDelete("warehouse_requirements", id);
```

## Frontend: How to Setup

### Step 1: Copy Hook

Copy content of `REACT_BROADCAST_SSE_HOOK_V2.ts` to `src/hooks/useSSEBroadcast.ts`

### Step 2: Use in App

```typescript
import { useSSEBroadcast } from '@/hooks/useSSEBroadcast';

export default function App() {
  // Enable real-time updates (one line!)
  useSSEBroadcast();

  return <YourApp />;
}
```

### Step 3: That's It!

React Query automatically updates when events arrive. No additional code needed.

## How It Works

```
Event Flow:
┌─────────────────────────────────────────────┐
│ Service creates/updates/deletes resource    │
│ Example: RenewalTypesService.create()       │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ Emits SSE event to ALL connected clients    │
│ emitCreate('renewal_types', 5, data)        │
└──────────────┬──────────────────────────────┘
               │
               ▼ (Broadcast to all users in browser)
┌─────────────────────────────────────────────┐
│ User 1's Browser    User 2's Browser        │
│ Receives event      Receives event          │
│ ↓                   ↓                        │
│ Has ['renewal_types']  Has ['renewal_types']│
│ query? YES          query? YES              │
│ → Invalidate        → Invalidate            │
│ → Refetch new list  → Refetch new list      │
│ → Renewal type 5    → Renewal type 5       │
│   appears            appears                │
└─────────────────────────────────────────────┘
```

## Common Resource Names

Use these in your emit calls:

- `'users'` - User profiles & permissions
- `'renewal_types'` - Renewal type master data
- `'requirements'` - Requirements master data
- `'warehouse_requirements'` - Warehouse requirements
- `'req_transaction_headers'` - Transaction requests
- `'warehouse_types'` - Warehouse type master
- `'locations'` - Location hierarchy
- `'roles'` - Role definitions
- `'status'` - Status master data

## Event Types

### CREATE

When you add a new resource (admin adds renewal type)

```typescript
this.sseEventEmitter.emitCreate("renewal_types", id, data);
```

React Query: Invalidates the list → refetches to show new item

### UPDATE

When you modify an existing resource (admin changes permissions)

```typescript
this.sseEventEmitter.emitUpdate("users", userId, updatedData);
```

React Query: Updates single item cache + invalidates list

### DELETE

When you remove a resource

```typescript
this.sseEventEmitter.emitDelete("warehouse_requirements", id);
```

React Query: Removes from cache + invalidates list

### INVALIDATE

When update is complex (use rarely)

```typescript
this.sseEventEmitter.emitInvalidate("dashboard_stats");
```

React Query: Forces full refetch of all matching queries

## Real-World Example: Admin Adds Renewal Type

### Backend Flow

```typescript
// renewal-types.service.ts
async create(createDto: CreateRenewalTypeDto): Promise<any> {
  const newType = this.renewalTypesRepository.create(createDto);
  const saved = await this.renewalTypesRepository.save(newType);

  // NEW: Emit to all users
  try {
    const response = await this.findOne(saved.id);
    this.sseEventEmitter.emitCreate('renewal_types', saved.id, response);
  } catch (err) {
    logger.warn('SSE emit failed:', err);
  }

  return response;
}
```

### Frontend Flow

```typescript
// App.tsx
export default function App() {
  // Hook setup
  useSSEBroadcast();

  // React Query query in component
  const { data: renewalTypes } = useQuery({
    queryKey: ['renewal_types'],
    queryFn: () => api.get('/renewal-types')
  });

  // When admin creates renewal type:
  // 1. Server emits SSE event
  // 2. Hook receives it
  // 3. Detects resource: 'renewal_types'
  // 4. Invalidates query ['renewal_types']
  // 5. Component refetches
  // 6. New renewal type appears in UI
  // (All automatic, no manual code needed)

  return (
    <div>
      {renewalTypes?.map(rt => (
        <div key={rt.id}>{rt.name}</div>
      ))}
    </div>
  );
}
```

## What Changed From Original

| What                            | Before                        | After               |
| ------------------------------- | ----------------------------- | ------------------- |
| Endpoint                        | `/sse/users/:userId`          | `/sse/broadcast`    |
| Who gets events                 | Only that user                | All connected users |
| Method calls                    | `emitUserCreate(userId, ...)` | `emitCreate(...)`   |
| Per-user routing                | Yes                           | No                  |
| Admin changes visible instantly | No                            | Yes ✅              |
| Code complexity                 | Higher                        | Lower               |
| Performance                     | O(n)                          | O(1) ✅             |

## Troubleshooting

### Events not showing up

1. Check browser console for SSE connection
2. Verify `/sse/broadcast` endpoint exists
3. Check React Query DevTools to see if cache updated
4. Ensure service is emitting events (check server logs)

### React Query not updating

1. Verify event resource matches your query key
2. Check React Query DevTools for active queries
3. Ensure hook is called at app root level

### Connection drops

1. Check browser network tab for connection errors
2. Verify JWT authentication is valid
3. Hook auto-retries with exponential backoff (up to 5 times)

## Files to Know

- **Backend Core**: `src/services/sse-emitter.service.ts`
- **Backend Helper**: `src/services/sse-event-emitter.helper.ts`
- **Backend Endpoint**: `src/controllers/sse.controller.ts`
- **Frontend Hook**: `src/hooks/useSSEBroadcast.ts` (you create this)
- **Documentation**: See `SSE_PURE_BROADCAST_ARCHITECTURE.md`

## Next 5 Minutes

1. ✅ Read this (done)
2. Copy React hook file
3. Paste into `src/hooks/useSSEBroadcast.ts`
4. Add `useSSEBroadcast()` to your App component
5. Test: Create renewal type, see it appear in all browsers

Done! You now have real-time updates.
