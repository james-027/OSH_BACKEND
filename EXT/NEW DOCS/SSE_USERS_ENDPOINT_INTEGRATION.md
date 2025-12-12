# SSE Integration with /users/nested-per-access-key/:user_id

## Overview

This guide shows how to integrate SSE with your existing `/users/nested-per-access-key/:user_id` endpoint so that when user data changes, React Query automatically receives updates via SSE.

## Architecture

```
React Frontend
    ↓
useQuery(['users', userId], () => api.get(`/users/nested-per-access-key/${userId}`))
    ↓
useSSEUpdates(userId) ← Listens for changes
    ↓
React Query automatically updates cache when SSE events arrive
```

## Implementation

### 1. Find Your UsersService and Add SSE

Locate your `src/services/users.service.ts` (or wherever your user operations are):

```typescript
import { SSEEventEmitterHelper } from "src/services/sse-event-emitter.helper";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private sseEventEmitter: SSEEventEmitterHelper // ← ADD THIS
  ) {}

  // ... existing methods ...

  // Modify your update method
  async update(id: number, updateDto: UpdateUserDto, userId: number) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException("User not found");

    Object.assign(user, updateDto);
    const saved = await this.usersRepository.save(user);

    // ← ADD THIS: Emit SSE event so frontend cache updates
    this.sseEventEmitter.emitUserUpdate(
      userId,
      "users", // React Query key
      id,
      saved
    );

    return saved;
  }

  // Modify your create method
  async create(createDto: CreateUserDto, userId: number) {
    const newUser = this.usersRepository.create(createDto);
    const saved = await this.usersRepository.save(newUser);

    // ← ADD THIS: Broadcast new user to all connected users
    this.sseEventEmitter.emitBroadcastUpdate("users", saved.id, saved);

    return saved;
  }

  // Modify your delete method
  async delete(id: number, userId: number) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException("User not found");

    await this.usersRepository.remove(user);

    // ← ADD THIS: Notify about deletion
    this.sseEventEmitter.emitUserDelete(userId, "users", id);
  }

  // For nested-per-access-key, if you have updates to access key related data
  async updateUserAccessKey(userId: number, updateDto: any) {
    // ... update logic
    const updated = await this.usersRepository.save(updateDto);

    // Emit update with users query key (since you're using /users/nested-per-access-key/:user_id)
    this.sseEventEmitter.emitUserUpdate(userId, "users", userId, updated);

    return updated;
  }
}
```

### 2. Set Up Frontend Hook

Create `src/hooks/useSSESubscription.ts` in your React project (copy from `REACT_FRONTEND_SSE_HOOK.ts`).

### 3. Use in Your App

```typescript
// App.tsx or Layout.tsx
import { useSSEUpdates } from '@/hooks/useSSESubscription';
import { useAuth } from '@/hooks/useAuth'; // Your auth hook

export function AppLayout() {
  const { user } = useAuth();

  // This connects to SSE and listens for all changes
  useSSEUpdates(user?.id);

  return (
    <div>
      {/* Your app content */}
    </div>
  );
}
```

### 4. Use Your Existing React Query Hook

No changes needed! Your existing query will auto-update:

```typescript
import { useQuery } from '@tanstack/react-query';

export function UsersList() {
  const { user } = useAuth();

  // Standard React Query - no SSE-specific code needed
  const { data: usersList, isLoading } = useQuery({
    queryKey: ['users', user.id], // This key matches SSE event resource
    queryFn: () => api.get(`/users/nested-per-access-key/${user.id}`),
  });

  return (
    <div>
      {usersList?.map(userData => (
        <UserCard key={userData.id} user={userData} />
      ))}
    </div>
  );
}
```

**That's it!** When you call:

```typescript
this.sseEventEmitter.emitUserUpdate(userId, "users", id, updatedData);
```

The frontend automatically:

1. Updates React Query cache for `['users', id]`
2. Invalidates the list query `['users']`
3. Components re-render with fresh data

## Event Flow Example

### Scenario: User updates their profile

**Frontend (React):**

```typescript
const updateProfile = async (updates) => {
  await api.put(`/users/${userId}`, updates);
  // Don't refetch! SSE will handle it
};
```

**Backend (NestJS):**

```typescript
@Put('/:id')
async update(@Param('id') id: number, @Body() updateDto: UpdateUserDto, @Request() req) {
  const userId = req.user.id;

  // Your existing logic
  const updatedUser = await this.usersService.update(id, updateDto, userId);

  // NEW: Emit SSE event
  this.sseEventEmitter.emitUserUpdate(userId, 'users', id, updatedUser);

  return updatedUser;
}
```

**Frontend receives SSE event and React Query cache auto-updates:**

```
1. Backend emits: { type: 'UPDATE', resource: 'users', resourceId: userId, data: {...} }
2. Frontend receives event
3. React Query: setQueryData(['users', userId], {...updatedData})
4. React Query: invalidateQueries(['users'])
5. Component re-renders with fresh data
```

## Complete Example: User Profile Update

### Backend - UsersController

```typescript
@Put(':id')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions({ module: 'USERS', action: 'EDIT' })
async update(
  @Param('id', ParseIntPipe) id: number,
  @Body() updateDto: UpdateUserDto,
  @Request() req
) {
  const userId = req.user.id;
  const updated = await this.usersService.update(id, updateDto, userId);

  // ← ADD THIS: Emit SSE event
  this.sseEventEmitter.emitUserUpdate(userId, 'users', id, updated);

  return updated;
}
```

### Frontend - ProfilePage

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

export function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user data
  const { data: userProfile } = useQuery({
    queryKey: ['users', user.id],
    queryFn: () => api.get(`/users/nested-per-access-key/${user.id}`),
  });

  // Update profile
  const { mutate: updateProfile } = useMutation({
    mutationFn: (updates) => api.put(`/users/${user.id}`, updates),
    onSuccess: () => {
      // No need to invalidate! SSE will handle it
      // queryClient.invalidateQueries(['users'])
    },
  });

  return (
    <div>
      <h1>{userProfile?.name}</h1>
      <button onClick={() => updateProfile({ name: 'New Name' })}>
        Update Profile
      </button>
    </div>
  );
}
```

## Benefits for Your Use Case

With `/users/nested-per-access-key/:user_id`:

✅ When user's access keys change → SSE event → React Query updates  
✅ When user's permissions change → SSE event → React Query updates  
✅ When user's locations change → SSE event → React Query updates  
✅ When nested data changes → Single event invalidates list  
✅ No refetch button needed → Always in sync

## Testing SSE

### Test from Backend

```typescript
// Inject SSEEventEmitterHelper
constructor(private sseEventEmitter: SSEEventEmitterHelper) {}

// In any method, emit an event
this.sseEventEmitter.emitUserUpdate(123, 'users', 456, { name: 'Test' });
```

### Test from Frontend

```typescript
// Console - you should see the event
useSSEUpdates(userId, "http://localhost:3000", {
  onEvent: (event) => console.log("SSE Event:", event),
});
```

## Debugging

### Check active SSE connections:

```bash
curl http://localhost:3000/sse/health
# { "status": "healthy", "activeSubscriptions": 5 }
```

### Check browser Network tab:

- Look for request to `/sse/users/123` (status 200)
- Should show `text/event-stream` Content-Type
- Messages should stream in as events happen

### Check React Query DevTools:

- Should see cache updates without API calls
- Query status should remain "success"

## Summary

With just a few additions to your existing UsersService, your React frontend gets real-time updates:

```typescript
// All you need to add to each create/update/delete method:
this.sseEventEmitter.emitUserUpdate(userId, "users", id, data);
```

And on the frontend:

```typescript
useSSEUpdates(userId); // One line in your app
// React Query queries automatically stay in sync!
```
