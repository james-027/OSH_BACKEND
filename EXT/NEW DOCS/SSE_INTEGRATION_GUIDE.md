# SSE Integration Guide

## Overview

This guide shows how to integrate Server-Sent Events (SSE) with your NestJS backend and React Query frontend to enable real-time cache updates without constant polling.

## Architecture

```
┌─────────────────────┐
│   React Frontend    │
│  (React Query)      │
│                     │
│  useSSEUpdates()    │
│  ├─ setQueryData()  │
│  ├─ invalidateQueries()
│  └─ removeQueries() │
└──────────┬──────────┘
           │ EventSource SSE
           │
┌──────────▼──────────┐
│   NestJS Backend    │
│                     │
│  SSEEmitterService  │
│  + SSEEventEmitter  │
│       Helper        │
└─────────────────────┘
```

## Backend Setup

### 1. Import SSEModule in app.module.ts

```typescript
import { SSEModule } from "./modules/sse/sse.module";

@Module({
  imports: [
    // ... other imports
    SSEModule,
  ],
})
export class AppModule {}
```

### 2. Emit SSE Events from Services

In any service where you create/update/delete resources, inject the `SSEEventEmitterHelper`:

```typescript
import { SSEEventEmitterHelper } from "src/services/sse-event-emitter.helper";

@Injectable()
export class UsersService {
  constructor(
    private sseEventEmitter: SSEEventEmitterHelper
    // ... other dependencies
  ) {}

  async update(id: number, updateDto: UpdateUserDto, userId: number) {
    // Existing update logic
    const updatedUser = await this.usersRepository.save({
      ...existingUser,
      ...updateDto,
    });

    // Emit SSE event to the user
    this.sseEventEmitter.emitUserUpdate(userId, "users", id, updatedUser);

    return updatedUser;
  }

  async create(createDto: CreateUserDto, userId: number) {
    const newUser = await this.usersRepository.save(createDto);

    // Emit SSE event - broadcast to multiple users or all users
    this.sseEventEmitter.emitBroadcastUpdate("users", newUser.id, newUser);

    return newUser;
  }

  async delete(id: number, userId: number) {
    await this.usersRepository.remove(id);

    // Emit delete event
    this.sseEventEmitter.emitUserDelete(userId, "users", id);
  }
}
```

### 3. Example: WarehouseRequirementsService

```typescript
import { SSEEventEmitterHelper } from "src/services/sse-event-emitter.helper";

@Injectable()
export class WarehouseRequirementsService {
  constructor(
    private sseEventEmitter: SSEEventEmitterHelper
    // ... other dependencies
  ) {}

  async create(createDto: CreateWarehouseRequirementDto, userId: number) {
    const saved = await this.warehouseRequirementsRepository.save(newRecord);

    // Notify user about the new warehouse requirement
    this.sseEventEmitter.emitUserCreate(
      userId,
      "warehouse-requirements",
      saved.id,
      saved
    );

    return saved;
  }

  async updateWarehouseRequirementDue(
    dueId: number,
    updateDto: UpdateDto,
    userId: number
  ) {
    const updated =
      await this.warehouseRequirementDuesRepository.save(updateDto);

    // Notify the user about the update
    // Or notify multiple users if this affects them
    this.sseEventEmitter.emitUserUpdate(
      userId,
      "warehouse-requirement-dues",
      dueId,
      updated
    );

    return updated;
  }

  // Force client to refetch when you want a full refresh
  async complexOperation(userId: number) {
    // ... do complex operation

    // Tell client to refetch all warehouse-requirements data
    this.sseEventEmitter.emitQueryInvalidation(
      userId,
      "warehouse-requirements"
    );
  }
}
```

## Frontend Setup

### 1. Copy the React Hook

Copy `REACT_FRONTEND_SSE_HOOK.ts` to your React project at:

```
src/hooks/useSSESubscription.ts
```

### 2. Use in Your App Layout or Root Component

```typescript
import { useSSEUpdates } from '@/hooks/useSSESubscription';
import { useAuth } from '@/hooks/useAuth'; // Your auth hook

function AppLayout() {
  const { user } = useAuth();

  // Start SSE subscription when user is authenticated
  useSSEUpdates(user?.id);

  return (
    <div>
      {/* Your app content */}
    </div>
  );
}
```

### 3. Use with React Query

```typescript
import { useQuery } from '@tanstack/react-query';
import { useSSEUpdates } from '@/hooks/useSSESubscription';

function UsersList() {
  const { user } = useAuth();

  // Start SSE subscription
  useSSEUpdates(user.id);

  // Standard React Query usage - will auto-update when SSE events arrive
  const { data: users } = useQuery({
    queryKey: ['users', user.id],
    queryFn: () => api.get(`/users/nested-per-access-key/${user.id}`),
  });

  // Data updates automatically via SSE events!
  return (
    <div>
      {users?.map(user => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  );
}
```

## Event Types

The SSE system supports 4 event types:

### 1. UPDATE

Updates an existing resource in React Query cache

```typescript
this.sseEventEmitter.emitUserUpdate(userId, "users", userId, updatedUserData);
// → Calls: setQueryData(['users', userId], newData)
// → Also invalidates: ['users'] list queries
```

### 2. CREATE

Invalidates list queries to fetch new item

```typescript
this.sseEventEmitter.emitUserCreate(
  userId,
  "warehouses",
  newWarehouseId,
  warehouseData
);
// → Calls: invalidateQueries(['warehouses'])
// → Client will refetch the list
```

### 3. DELETE

Removes item from cache and invalidates lists

```typescript
this.sseEventEmitter.emitUserDelete(userId, "users", deletedUserId);
// → Calls: removeQueries(['users', deletedUserId])
// → Calls: invalidateQueries(['users'])
```

### 4. INVALIDATE

Forces complete refetch of all queries for a resource

```typescript
this.sseEventEmitter.emitQueryInvalidation(userId, "warehouse-requirements");
// → Calls: invalidateQueries(['warehouse-requirements'], { refetchType: 'all' })
// → Client will refetch ALL warehouse-requirements queries
```

## Advanced Usage

### Custom Event Handling

```typescript
useSSESubscription({
  userId: user.id,
  onEvent: (event) => {
    console.log("Received SSE event:", event);
    // Custom logic here
  },
  onError: (error) => {
    console.error("SSE error:", error);
    // Error handling
  },
});
```

### Broadcast to Multiple Users

```typescript
// Update all users about a shared resource
this.sseEventEmitter.emitMultipleUsersUpdate(
  [user1Id, user2Id, user3Id],
  "shared-warehouse",
  warehouseId,
  updatedData
);
```

### Broadcast to All Users

```typescript
// Update all connected users (e.g., system announcement)
this.sseEventEmitter.emitBroadcastUpdate("system-status", 1, {
  message: "Maintenance window",
  severity: "high",
});
```

## Configuration

### Environment Variables (React)

```bash
# .env
REACT_APP_API_URL=http://localhost:3000
```

### Hook Options

```typescript
useSSESubscription({
  userId: 123,
  baseUrl: "http://localhost:3000",
  autoReconnect: true, // Auto-reconnect on disconnect
  maxRetries: 5, // Max reconnection attempts
  reconnectDelay: 3000, // Initial delay in ms (exponential backoff)
  onEvent: (event) => {}, // Custom event handler
  onError: (error) => {}, // Error handler
});
```

## Monitoring

### Check Active Connections

```bash
curl http://localhost:3000/sse/health
# Response: { "status": "healthy", "activeSubscriptions": 5 }
```

## Troubleshooting

### Events not being received?

1. Check browser console for errors
2. Verify SSE endpoint: `GET /sse/users/:user_id`
3. Check that service is emitting events
4. Verify JWT token is valid
5. Check CORS settings if cross-origin

### Connection drops frequently?

1. Check network stability
2. Increase `reconnectDelay`
3. Increase `maxRetries`
4. Check server logs for errors

### React Query not updating?

1. Verify event query key matches React Query query key
2. Check that `resource` field in event matches query key
3. Verify data structure in event payload
4. Check browser React Query DevTools

## Performance Tips

1. **Use INVALIDATE sparingly** - only when full refetch is necessary
2. **Batch updates** - combine multiple updates into one event if possible
3. **Filter subscriptions** - only subscribe users who need real-time updates
4. **Set `refetchType: 'inactive'`** - lets users see updates without interrupting their work

## Security Notes

1. ✅ SSE endpoint requires JWT authentication
2. ✅ Users can only subscribe to their own events
3. ✅ EventSource uses `withCredentials: true` to send cookies
4. ✅ Events include user ID for server-side authorization
5. ✅ Consider rate-limiting SSE connections per user

## Next Steps

1. Add SSEModule to your app module
2. Inject SSEEventEmitterHelper in your services
3. Add SSE event emissions in create/update/delete methods
4. Copy React hook to your frontend
5. Use `useSSEUpdates()` in your app
6. Update your React Query hooks to benefit from real-time updates
