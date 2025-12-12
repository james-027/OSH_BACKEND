# SSE/Real-Time Integration Summary

## What Was Created

I've created a complete Server-Sent Events (SSE) infrastructure for your NestJS backend that integrates seamlessly with React Query on the frontend. This eliminates the need for constant polling and keeps your React Query cache synchronized in real-time.

## Files Created

### Backend (NestJS)

1. **`src/services/sse-emitter.service.ts`**

   - Core service managing SSE subscriptions
   - Methods to emit events to users
   - Support for single user, multiple users, and broadcast events

2. **`src/services/sse-event-emitter.helper.ts`**

   - Helper service for easy event emission from business logic
   - Methods: `emitUserUpdate()`, `emitUserCreate()`, `emitUserDelete()`, `emitQueryInvalidation()`
   - Use this in your existing services

3. **`src/controllers/sse.controller.ts`**

   - SSE endpoint: `GET /sse/users/:user_id`
   - Health check endpoint: `GET /sse/health`
   - Handles EventSource connections from frontend

4. **`src/modules/sse/sse.module.ts`**
   - NestJS module exporting SSE services
   - Ready to import in `app.module.ts`

### Frontend (React)

5. **`REACT_FRONTEND_SSE_HOOK.ts`**
   - React hook: `useSSESubscription()` and `useSSEUpdates()`
   - Handles EventSource connection
   - Auto-reconnection with exponential backoff
   - Automatic React Query cache updates

### Documentation

6. **`SSE_INTEGRATION_GUIDE.md`**

   - Complete setup and usage guide
   - Event types explanation
   - Examples for different scenarios
   - Troubleshooting tips

7. **`SSE_INTEGRATION_EXAMPLES.ts`**
   - Code examples showing how to add SSE to existing services
   - Shows before/after patterns

## How It Works

```
1. User opens app in React
   ↓
2. useSSEUpdates(userId) hook connects to EventSource
   ↓
3. Backend establishes SSE connection for that user
   ↓
4. When data changes (create/update/delete), service calls:
   this.sseEventEmitter.emitUserUpdate(userId, resource, id, data)
   ↓
5. Backend sends SSE event to frontend
   ↓
6. Frontend receives event and automatically updates React Query cache:
   - UPDATE event → setQueryData()
   - CREATE event → invalidateQueries()
   - DELETE event → removeQueries()
   - INVALIDATE event → invalidateQueries({ refetchType: 'all' })
   ↓
7. React components re-render with fresh data (no polling!)
```

## Quick Start

### Backend

1. **Add SSEModule to app.module.ts:**

```typescript
import { SSEModule } from "./modules/sse/sse.module";

@Module({
  imports: [SSEModule /* ... */],
})
export class AppModule {}
```

2. **Inject SSEEventEmitterHelper in your services:**

```typescript
constructor(
  private sseEventEmitter: SSEEventEmitterHelper,
  // ... other dependencies
) {}

async update(id: number, updateDto: UpdateDto, userId: number) {
  const updated = await this.repository.save(updateDto);

  // Emit event
  this.sseEventEmitter.emitUserUpdate(userId, 'resource-name', id, updated);

  return updated;
}
```

### Frontend

1. **Copy React hook to your project:**

   - Copy code from `REACT_FRONTEND_SSE_HOOK.ts`
   - Place in `src/hooks/useSSESubscription.ts`

2. **Use in your app:**

```typescript
import { useSSEUpdates } from '@/hooks/useSSESubscription';

function AppLayout() {
  const { user } = useAuth();
  useSSEUpdates(user.id); // That's it!

  return <>{/* your app */}</>;
}
```

3. **React Query queries auto-update:**

```typescript
const { data: users } = useQuery({
  queryKey: ["users", userId],
  queryFn: () => api.get(`/users/nested-per-access-key/${userId}`),
  // Data updates automatically via SSE!
});
```

## Event Types

| Event Type     | What it does              | React Query Operation                       |
| -------------- | ------------------------- | ------------------------------------------- |
| **UPDATE**     | Updates existing resource | `setQueryData()` + `invalidateQueries()`    |
| **CREATE**     | New resource created      | `invalidateQueries()` to fetch it           |
| **DELETE**     | Resource deleted          | `removeQueries()` + `invalidateQueries()`   |
| **INVALIDATE** | Force full refresh        | `invalidateQueries({ refetchType: 'all' })` |

## Usage Examples

### Simple Update

```typescript
// In your service
async toggleUserStatus(id: number, userId: number) {
  const user = await this.usersRepository.save({ id, status_id: 2 });
  this.sseEventEmitter.emitUserUpdate(userId, 'users', id, user);
}

// Frontend receives event and cache updates automatically
```

### Complex Operation

```typescript
// When you need full refresh of a resource
async syncWarehouseData(userId: number) {
  await this.complexSyncOperation();
  // Tell client to refetch everything
  this.sseEventEmitter.emitQueryInvalidation(userId, 'warehouse-requirements');
}
```

### Multi-User Notification

```typescript
// Update multiple affected users
async createSharedWarehouse(warehouse: any, affectedUserIds: number[]) {
  const saved = await this.warehousesRepository.save(warehouse);
  this.sseEventEmitter.emitMultipleUsersUpdate(
    affectedUserIds,
    'warehouses',
    saved.id,
    saved
  );
}
```

## Key Benefits

✅ **No polling** - Real-time updates without constant API calls  
✅ **Better UX** - Data updates instantly when changed  
✅ **Reduced server load** - No repeated polling requests  
✅ **Automatic cache sync** - React Query stays synchronized  
✅ **Flexible** - Use UPDATE for single items, INVALIDATE for complex changes  
✅ **Secure** - JWT authentication required on SSE endpoint  
✅ **Auto-reconnect** - Client handles connection failures automatically

## Next Steps

1. ✅ Backend infrastructure is ready
2. Add SSEModule to your app.module.ts
3. Copy React hook to your frontend
4. Start injecting SSEEventEmitterHelper in your services
5. Add `emitUserUpdate/Create/Delete` calls after create/update/delete operations
6. Use `useSSEUpdates()` in your React app
7. Your React Query queries will automatically update in real-time!

## Security Features

- ✅ JWT authentication required on SSE endpoint
- ✅ Users can only subscribe to their own events
- ✅ EventSource sends credentials via `withCredentials: true`
- ✅ Server-side authorization check before sending events
- ✅ No data leakage between users

## Performance Considerations

- Use **UPDATE** for single resource changes
- Use **INVALIDATE** sparingly (only when you need full refresh)
- **Batch updates** when possible
- Set `refetchType: 'inactive'` to avoid interrupting users
- Monitor active subscriptions via `/sse/health` endpoint

For detailed instructions, see `SSE_INTEGRATION_GUIDE.md`
For code examples, see `SSE_INTEGRATION_EXAMPLES.ts`
