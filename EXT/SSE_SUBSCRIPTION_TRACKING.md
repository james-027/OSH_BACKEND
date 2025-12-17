# SSE Subscription Tracking & Invalidation Guide

## Overview

The updated `SSEEmitterService` now provides **real subscription tracking** with the ability to:

1. ✅ **Track all active subscriptions globally** (total count)
2. ✅ **Track subscriptions per resource type** (e.g., "3 clients listening to 'users'")
3. ✅ **Invalidate specific resource subscriptions** (e.g., when user #3 permissions change)
4. ✅ **List all subscription details** (timestamp, resource, resourceId)

---

## New Methods

### 1. `getSubscriptionStats(): SubscriptionStats`

Get comprehensive subscription statistics.

**Returns:**

```typescript
{
  totalActiveSubscriptions: number;
  subscriptionsPerResource: Record<string, number>;
  allSubscriptions: SubscriptionDetail[];
}
```

**Example:**

```typescript
const stats = this.sseEmitterService.getSubscriptionStats();
console.log(stats);
// {
//   totalActiveSubscriptions: 5,
//   subscriptionsPerResource: {
//     broadcast: 5,
//     users: 2,
//     locations: 3
//   },
//   allSubscriptions: [
//     { subscriptionId: "...", resource: "users", subscribedAt: Date, ... }
//   ]
// }
```

---

### 2. `getActiveSubscriptionsCount(): number`

Get total count of active subscriptions globally.

**Example:**

```typescript
const count = this.sseEmitterService.getActiveSubscriptionsCount();
console.log(`Active subscriptions: ${count}`); // Active subscriptions: 5
```

---

### 3. `listAllSubscriptions(): SubscriptionDetail[]`

List all active subscriptions with full details.

**Example:**

```typescript
const allSubs = this.sseEmitterService.listAllSubscriptions();
allSubs.forEach((sub) => {
  console.log(
    `[${sub.subscriptionId}] ${sub.resource}:${sub.resourceId} since ${sub.subscribedAt}`
  );
});
```

---

### 4. `listSubscriptionsByResource(resource: string, resourceId?: number): SubscriptionDetail[]`

Filter subscriptions by resource type and optional resource ID.

**Examples:**

```typescript
// Get all subscriptions listening to 'users'
const userSubs = this.sseEmitterService.listSubscriptionsByResource("users");
console.log(`${userSubs.length} clients listening to users`);

// Get subscriptions for specific user (e.g., user #3)
const user3Subs = this.sseEmitterService.listSubscriptionsByResource(
  "users",
  3
);
console.log(`${user3Subs.length} clients listening to user #3`);

// Get all subscriptions for locations
const locationSubs =
  this.sseEmitterService.listSubscriptionsByResource("locations");
```

---

### 5. `invalidateResource(resource: string, resourceId?: number): void`

Broadcast invalidation event for a specific resource.

**When to use:**

- When a resource is updated and clients need to refetch
- When permissions change for a specific resource
- When a module is deactivated

**Examples:**

```typescript
// Invalidate all subscriptions for 'users' resource
this.sseEmitterService.invalidateResource("users");
// Broadcasts: { type: 'INVALIDATE', resource: 'users', timestamp: '...' }

// Invalidate subscriptions for specific user (user #3)
this.sseEmitterService.invalidateResource("users", 3);
// Broadcasts: { type: 'INVALIDATE', resource: 'users', resourceId: 3, timestamp: '...' }

// When a location's warehouse assignment changes
this.sseEmitterService.invalidateResource("locations", 42);
```

---

### 6. `invalidateAllSubscriptionsForResourceId(resourceId: number): void`

Invalidate all subscriptions for a specific resource ID across ALL resource types.

**When to use:**

- When a user's permissions/roles change
- When a user is deactivated
- When any entity with ID is globally affected

**Example:**

```typescript
// User #3's permissions changed - invalidate all subscriptions listening to user #3
// This will broadcast invalidation for:
// - ['users', 3]
// - ['roles', 3] (if this user is also a role)
// - Any other resource with ID 3
this.sseEmitterService.invalidateAllSubscriptionsForResourceId(3);
```

---

### 7. `invalidateMultipleResourceIds(resourceIds: number[]): void`

Invalidate subscriptions for multiple resource IDs.

**When to use:**

- When multiple roles are deactivated
- When multiple users' permissions change
- Batch invalidations

**Example:**

```typescript
// Roles [1, 2, 3] were deactivated
const affectedRoleIds = [1, 2, 3];
this.sseEmitterService.invalidateMultipleResourceIds(affectedRoleIds);
```

---

## Implementation Pattern: ModulesService Example

### Location in Code

[src/services/modules.service.ts](../src/services/modules.service.ts)

### Current Code (toggleStatus method)

```typescript
async toggleStatus(id: number, authenticatedUserId: number): Promise<any> {
  // ... existing code ...

  const statusText = newStatusId === 1 ? "activated" : "deactivated";
  logger.info(`Module ${statusText} successfully with ID: ${id}`);

  // SSE Events
  try {
    this.sseEventEmitter.emitUpdateSignal("modules", updatedModule.id);
  } catch (err) {
    logger.error("SSE event failed for update:", err);
  }

  /**
   * EXAMPLE: Invalidate subscriptions for users affected by this module change
   *
   * When a module is toggled (activated/deactivated), any user viewing this module
   * in their UI needs to refresh. The module affects those users whose roles have
   * this module assigned.
   *
   * Find users with roles that have this module, then invalidate their subscriptions:
   *
   * const affectedUsers = await this.getUsersAffectedByModule(updatedModule.id);
   * if (affectedUsers.length > 0) {
   *   // Invalidate all subscriptions for these users so all other connected clients
   *   // see that these user's permissions/access have changed
   *   this.sseEmitterService.invalidateMultipleResourceIds(
   *     affectedUsers.map(u => u.id)
   *   );
   * }
   *
   * This will broadcast INVALIDATE events for ['users', userId] for each affected user,
   * prompting all connected clients to refetch user data and detect permission changes.
   */

  return { /* response */ };
}
```

---

## Real-World Use Cases

### Use Case 1: User Permissions Change

**Scenario:** User #3's roles are updated, adding new module access.

**Implementation in UsersService:**

```typescript
async updateUserRoles(userId: number, newRoleIds: number[], authenticatedUserId: number): Promise<any> {
  // ... validate and update roles ...

  // Notify all clients listening to this user that their data changed
  this.sseEmitterService.invalidateAllSubscriptionsForResourceId(userId);

  return updatedUser;
}
```

**Result:**

- All browsers connected to user #3's data receive invalidation
- React Query knows to refetch user #3's details and roles
- All other connected users see the permission change reflected

---

### Use Case 2: Role Deactivation

**Scenario:** Role #5 is deactivated, affecting 12 users.

**Implementation in RolesService:**

```typescript
async deactivateRole(roleId: number, authenticatedUserId: number): Promise<any> {
  // ... deactivate role logic ...

  // Get all users with this role
  const affectedUsers = await this.getUsersByRoleId(roleId);

  // Invalidate subscriptions for all affected users
  this.sseEmitterService.invalidateMultipleResourceIds(
    affectedUsers.map(u => u.id)
  );

  return { message: "Role deactivated" };
}
```

**Result:**

- All 12 users' subscriptions are invalidated across all resource types
- Every browser sees the permission changes immediately
- No manual page refresh needed

---

### Use Case 3: Resource-Specific Update

**Scenario:** A warehouse requirement's status changes.

**Implementation in WarehouseRequirementsService:**

```typescript
async updateStatus(id: number, newStatusId: number): Promise<any> {
  // ... update logic ...

  // Emit change event
  this.sseEventEmitter.emitUpdateSignal('warehouse_requirements', id);

  // Invalidate specific resource
  this.sseEmitterService.invalidateResource('warehouse_requirements', id);

  return updated;
}
```

**Result:**

- Clients listening to this warehouse requirement get invalidation
- React Query refetches and UI updates

---

### Use Case 4: Module Deactivation

**Scenario:** Module "Inventory" is deactivated, affecting 8 users.

**Implementation in ModulesService:**

```typescript
async toggleStatus(id: number, authenticatedUserId: number): Promise<any> {
  // ... toggle logic ...

  // Find users affected by this module's change
  const affectedUsers = await this.getUsersAffectedByModule(id);

  if (affectedUsers.length > 0) {
    // Invalidate all subscriptions for affected users
    this.sseEmitterService.invalidateMultipleResourceIds(
      affectedUsers.map(u => u.id)
    );
  }

  return { message: "Module toggled" };
}
```

---

## Subscription Details Interface

```typescript
interface SubscriptionDetail {
  subscriptionId: string; // Unique ID for this connection
  subscribedAt: Date; // When client connected
  resource: string; // e.g., "users", "locations"
  resourceId?: number; // e.g., userId, locationId
  queryKey: string; // Human-readable key
}
```

---

## Frontend Integration

The frontend doesn't need changes - it continues using the existing hook:

```typescript
import { useSSEWithCookies } from "@/hooks/useSSEWithCookies";

function MyComponent() {
  useSSEWithCookies((event) => {
    if (event.type === "INVALIDATE" && event.resource === "users") {
      // Invalidate React Query cache
      queryClient.invalidateQueries({
        queryKey: ["users", event.resourceId],
      });
    }
  });
}
```

When the backend calls:

```typescript
this.sseEmitterService.invalidateAllSubscriptionsForResourceId(3);
```

All browsers receive:

```typescript
{
  type: 'INVALIDATE',
  resource: 'users',
  resourceId: 3,
  timestamp: '2025-12-17T...'
}
```

---

## Implementation Checklist

For each service that needs invalidation:

- [ ] Inject `SSEEmitterService` in constructor
- [ ] Identify trigger points (deactivate, permission change, etc.)
- [ ] Determine affected resource IDs
- [ ] Call appropriate invalidation method:
  - `invalidateResource(resource, resourceId)` - for single resource
  - `invalidateAllSubscriptionsForResourceId(id)` - for cross-resource
  - `invalidateMultipleResourceIds([ids])` - for batch operations
- [ ] Test that React Query refetches on invalidation

---

## Monitoring & Debugging

### Check active subscriptions:

```typescript
const stats = this.sseEmitterService.getSubscriptionStats();
console.log(`Total connections: ${stats.totalActiveSubscriptions}`);
console.log(`Breakdown:`, stats.subscriptionsPerResource);
```

### Debug specific resource subscriptions:

```typescript
const userSubs = this.sseEmitterService.listSubscriptionsByResource("users", 3);
console.log(`Subscriptions for user #3: ${userSubs.length}`);
```

### Clear all (emergency only):

```typescript
this.sseEmitterService.clearAllSubscriptions();
```

---

## File Locations

- **Service:** [src/services/sse-emitter.service.ts](../src/services/sse-emitter.service.ts)
- **Example:** [src/services/modules.service.ts](../src/services/modules.service.ts) - toggleStatus method
- **Frontend Hook:** [src/hooks/useSSEWithCookies.ts](../src/hooks/useSSEWithCookies.ts)

---

## Summary

| Requirement                | Method                                        | Example                    |
| -------------------------- | --------------------------------------------- | -------------------------- |
| Track total count          | `getActiveSubscriptionsCount()`               | Get "5 total active"       |
| Track per resource         | `getSubscriptionStats()`                      | Get "3 listening to users" |
| Invalidate single resource | `invalidateResource(resource, id)`            | User #3 permissions change |
| Invalidate cross-resource  | `invalidateAllSubscriptionsForResourceId(id)` | User #3 deleted            |
| Invalidate multiple        | `invalidateMultipleResourceIds([ids])`        | Roles [1,2,3] deactivated  |
| List subscriptions         | `listSubscriptionsByResource(resource, id)`   | Debug who's listening      |
