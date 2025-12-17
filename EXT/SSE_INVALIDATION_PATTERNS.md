# SSE Invalidation Quick Reference

Copy these patterns directly into your services.

---

## Pattern 1: Simple Resource Invalidation

Use when a **single resource changes**.

```typescript
// When user #3's profile updates
this.sseEmitterService.invalidateResource("users", 3);

// When a location is modified
this.sseEmitterService.invalidateResource("locations", 42);

// When warehouse requirement status changes
this.sseEmitterService.invalidateResource("warehouse_requirements", 100);
```

**Broadcasts:**

```javascript
{ type: 'INVALIDATE', resource: 'users', resourceId: 3, timestamp: '...' }
```

---

## Pattern 2: Cross-Resource Invalidation

Use when **one ID affects multiple resource types** (e.g., user is deleted).

```typescript
// When user #3 is deleted or deactivated
this.sseEmitterService.invalidateAllSubscriptionsForResourceId(3);

// Broadcasts invalidation for:
// - { resource: 'users', resourceId: 3 }
// - { resource: 'locations', resourceId: 3 } (if user #3 is a location)
// - Any other resource where ID = 3
```

---

## Pattern 3: Batch Invalidation

Use when **multiple resources/users are affected**.

```typescript
// When roles [1, 2, 3] are deactivated
const roleIds = [1, 2, 3];
this.sseEmitterService.invalidateMultipleResourceIds(roleIds);

// Equivalent to calling:
// invalidateAllSubscriptionsForResourceId(1);
// invalidateAllSubscriptionsForResourceId(2);
// invalidateAllSubscriptionsForResourceId(3);
```

---

## Pattern 4: Find Affected & Invalidate

Use when you need to **query then invalidate**.

```typescript
async deactivateRole(roleId: number): Promise<void> {
  // Deactivate the role
  await this.roleRepository.update(roleId, { active: false });

  // Find all users with this role
  const affectedUsers = await this.userRepository.find({
    where: { roles: { id: roleId } }
  });

  // Invalidate all affected users
  if (affectedUsers.length > 0) {
    this.sseEmitterService.invalidateMultipleResourceIds(
      affectedUsers.map(u => u.id)
    );
  }
}
```

---

## Pattern 5: Permission Change

Use when **user's permissions/roles change**.

```typescript
async updateUserRoles(userId: number, roleIds: number[]): Promise<User> {
  // Update the user's roles
  const user = await this.userService.updateRoles(userId, roleIds);

  // Invalidate the user's subscriptions globally
  // This tells all clients that this user's permissions changed
  this.sseEmitterService.invalidateAllSubscriptionsForResourceId(userId);

  return user;
}
```

**Effect:**

- All browsers connected to `['users', userId]` get invalidation
- They refetch user data and see new role/permission state
- All other users see this user's updated permissions

---

## Real Service Examples

### UsersService

```typescript
constructor(
  private userRepository: Repository<User>,
  private sseEmitterService: SSEEmitterService
) {}

async deactivateUser(userId: number): Promise<void> {
  await this.userRepository.update(userId, { active: false });

  // Notify all clients about this user change
  this.sseEmitterService.invalidateAllSubscriptionsForResourceId(userId);
}

async updateUserPermissions(userId: number, permissions: any[]): Promise<User> {
  const user = await this.userRepository.save({ id: userId, permissions });

  // Invalidate so all clients refetch this user
  this.sseEmitterService.invalidateAllSubscriptionsForResourceId(userId);

  return user;
}
```

### RolesService

```typescript
async deactivateRole(roleId: number): Promise<void> {
  // Deactivate role
  await this.roleRepository.update(roleId, { active: false });

  // Get all users with this role
  const affectedUsers = await this.userRepository.find({
    where: { roles: { id: roleId } }
  });

  // Invalidate all affected users
  this.sseEmitterService.invalidateMultipleResourceIds(
    affectedUsers.map(u => u.id)
  );
}
```

### ModulesService

```typescript
async toggleStatus(moduleId: number): Promise<void> {
  // Toggle status
  await this.moduleRepository.update(moduleId, {
    status_id: moduleId === 1 ? 2 : 1
  });

  // Get all users with roles that have this module
  const affectedUsers = await this.getUsersAffectedByModule(moduleId);

  // Invalidate all affected users' subscriptions
  this.sseEmitterService.invalidateMultipleResourceIds(
    affectedUsers.map(u => u.id)
  );
}

private async getUsersAffectedByModule(moduleId: number): Promise<User[]> {
  // Query: find users whose roles include this module
  return await this.userRepository.query(`
    SELECT DISTINCT u.* FROM users u
    INNER JOIN user_roles ur ON u.id = ur.user_id
    INNER JOIN role_modules rm ON ur.role_id = rm.role_id
    WHERE rm.module_id = ?
  `, [moduleId]);
}
```

### LocationsService

```typescript
async updateLocation(id: number, data: any): Promise<Location> {
  const location = await this.locationRepository.save({ id, ...data });

  // Invalidate this specific location's subscriptions
  this.sseEmitterService.invalidateResource('locations', id);

  return location;
}

async transferLocationToWarehouse(locationId: number, warehouseId: number): Promise<void> {
  await this.locationRepository.update(locationId, { warehouse_id: warehouseId });

  // Invalidate location so clients see new warehouse
  this.sseEmitterService.invalidateResource('locations', locationId);
}
```

---

## Frontend Receives

When backend calls any invalidation method, React Query automatically receives:

```javascript
// When invalidateResource('users', 3) called
{
  type: 'INVALIDATE',
  resource: 'users',
  resourceId: 3,
  timestamp: '2025-12-17T10:30:45.123Z'
}

// useSSEWithCookies hook does:
queryClient.invalidateQueries({
  queryKey: ['users', 3]
});
```

**Result:** React Query refetches user #3 automatically, UI updates.

---

## Injection Template

```typescript
import { SSEEmitterService } from "./sse-emitter.service";

@Injectable()
export class YourService {
  constructor(
    @InjectRepository(YourEntity)
    private repository: Repository<YourEntity>,
    private sseEmitterService: SSEEmitterService // ← Add this
  ) {}

  async yourMethod(): Promise<void> {
    // Do your logic

    // Then invalidate
    this.sseEmitterService.invalidateResource("resource-name", id);
  }
}
```

---

## Debugging Commands

```typescript
// Check total subscriptions
const count = this.sseEmitterService.getActiveSubscriptionsCount();
console.log(`Active subscriptions: ${count}`);

// Check breakdown by resource
const stats = this.sseEmitterService.getSubscriptionStats();
console.log(stats.subscriptionsPerResource);
// { users: 3, locations: 2, warehouse_requirements: 1 }

// Check who's listening to user #3
const user3Listeners = this.sseEmitterService.listSubscriptionsByResource(
  "users",
  3
);
console.log(`${user3Listeners.length} clients listening to user #3`);

// List all subscriptions
const all = this.sseEmitterService.listAllSubscriptions();
all.forEach((sub) => {
  console.log(`${sub.resource}:${sub.resourceId} since ${sub.subscribedAt}`);
});
```

---

## Decision Tree

```
Does change affect ONE resource?
├─ YES → invalidateResource('type', id)
└─ NO → Does it affect ONE entity across multiple types?
       ├─ YES → invalidateAllSubscriptionsForResourceId(id)
       └─ NO → Is it multiple entities?
              └─ YES → invalidateMultipleResourceIds([id1, id2, ...])
```

---

## Common Mistakes

❌ **Don't:** Emit and invalidate the same resource twice

```typescript
this.sseEventEmitter.emitUpdateSignal("users", id); // ← Unnecessary
this.sseEmitterService.invalidateResource("users", id);
```

✅ **Do:** Use invalidate alone (it broadcasts the event)

```typescript
this.sseEmitterService.invalidateResource("users", id);
```

---

❌ **Don't:** Forget to update the related entities first

```typescript
// WRONG - invalidate before change
this.sseEmitterService.invalidateResource("users", 3);
await this.updateUser(3, data); // Too late!
```

✅ **Do:** Update first, then invalidate

```typescript
// RIGHT - change first, then notify
await this.userRepository.update(3, data);
this.sseEmitterService.invalidateResource("users", 3);
```

---

❌ **Don't:** Invalidate all resources on every change

```typescript
// WRONG - inefficient
this.sseEmitterService.invalidateAllSubscriptionsForResourceId(id);
```

✅ **Do:** Be specific

```typescript
// RIGHT - only affect what changed
this.sseEmitterService.invalidateResource("users", id);
```

---
