# SSE Integration with React Query Hooks - Step-by-Step Guide

## Overview

You have two approaches to integrate SSE with your React Query hooks:

1. **Automatic (Recommended)** - Hook automatically syncs via SSE
2. **Manual** - You control when to invalidate/update

We'll cover both, but recommend **Automatic** for simplicity.

---

## Approach 1: Automatic Integration (Recommended)

The SSE hook you added to App component automatically handles updates. Your existing React Query hooks work without modification!

### How It Works

```
Event Flow:
1. Server: emitUpdate('locations', 5, data)
2. Browser: Receives { type: 'UPDATE', resource: 'locations', ... }
3. SSE Hook: Matches resource 'locations' to query key ['locations']
4. React Query: Invalidates ['locations'] query
5. Your Hook: useLocationsQuery automatically refetches
6. Component: Re-renders with new data
```

### Step 1: Keep Your Hook As-Is

Your `useLocationsQuery.ts` needs **NO changes**:

```typescript
import { useQuery } from "@tanstack/react-query";
import { useApi } from "./useApi";

interface LocationType {
  id: number;
  location_name: string;
}

export const useLocationsQuery = () => {
  const { get } = useApi();

  return useQuery({
    queryKey: ["locations"], // ← Key matches SSE resource 'locations'
    queryFn: async () => {
      const res = await get("/locations");
      const data = Array.isArray(res)
        ? res
        : (res as { data: LocationType[] }).data;
      return data;
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
  });
};
```

### Step 2: Use Hook In Component

Exactly as you do now:

```typescript
import { useLocationsQuery } from '@/hooks/useLocationsQuery';

export function LocationsList() {
  const { data: locations, isLoading, error } = useLocationsQuery();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {locations?.map(location => (
        <li key={location.id}>{location.location_name}</li>
      ))}
    </ul>
  );
}
```

### Step 3: Ensure Backend Emits Events

In your `LocationsService` (backend):

```typescript
// locations.service.ts

async create(createDto: CreateLocationDto): Promise<any> {
  const newLocation = this.locationsRepository.create(createDto);
  const saved = await this.locationsRepository.save(newLocation);

  // NEW: Emit SSE event
  try {
    const response = await this.findOne(saved.id);
    this.sseEventEmitter.emitCreate('locations', saved.id, response);
  } catch (sseError) {
    logger.warn('SSE emission failed:', sseError);
  }

  return response;
}

async update(id: number, updateDto: UpdateLocationDto): Promise<any> {
  const location = await this.locationsRepository.findOne({ where: { id } });
  Object.assign(location, updateDto);
  const saved = await this.locationsRepository.save(location);

  // NEW: Emit SSE event
  try {
    const response = await this.findOne(saved.id);
    this.sseEventEmitter.emitUpdate('locations', id, response);
  } catch (sseError) {
    logger.warn('SSE emission failed:', sseError);
  }

  return response;
}

async toggleStatus(id: number): Promise<any> {
  const location = await this.locationsRepository.findOne({ where: { id } });
  location.status_id = location.status_id === 1 ? 2 : 1;
  const saved = await this.locationsRepository.save(location);

  // NEW: Emit SSE event
  try {
    const response = await this.findOne(saved.id);
    this.sseEventEmitter.emitUpdate('locations', id, response);
  } catch (sseError) {
    logger.warn('SSE emission failed:', sseError);
  }

  return response;
}
```

### That's It! 🎉

Now when any user:

- ✅ Creates location → All users see it instantly
- ✅ Updates location → All users see update instantly
- ✅ Toggles location status → All users see status change instantly

**No changes to your React code needed!**

---

## Approach 2: Manual Integration (Advanced)

If you want more control, you can manually handle SSE events in your hook.

### Step 1: Inject useQueryClient

```typescript
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./useApi";

interface LocationType {
  id: number;
  location_name: string;
}

export const useLocationsQuery = () => {
  const { get } = useApi();
  const queryClient = useQueryClient(); // NEW

  return useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const res = await get("/locations");
      const data = Array.isArray(res)
        ? res
        : (res as { data: LocationType[] }).data;
      return data;
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
  });
};
```

### Step 2: Export Helper Function

Add this to your hook file:

```typescript
// Function to manually invalidate location queries
export const invalidateLocationQueries = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({
    queryKey: ["locations"],
    refetchType: "active",
  });
};

// Function to manually update specific location
export const updateLocationCache = (
  queryClient: QueryClient,
  locationId: number,
  newData: LocationType
) => {
  // Update single location in cache
  queryClient.setQueryData(["locations", locationId], newData);

  // Invalidate list so it refetches
  queryClient.invalidateQueries({
    queryKey: ["locations"],
    refetchType: "active",
  });
};

// Function to remove location from cache
export const removeLocationFromCache = (
  queryClient: QueryClient,
  locationId: number
) => {
  queryClient.removeQueries({
    queryKey: ["locations", locationId],
  });

  queryClient.invalidateQueries({
    queryKey: ["locations"],
    refetchType: "active",
  });
};
```

### Step 3: Use In Component

```typescript
import {
  useLocationsQuery,
  invalidateLocationQueries,
  updateLocationCache,
  removeLocationFromCache,
} from "@/hooks/useLocationsQuery";
import { useQueryClient } from "@tanstack/react-query";

export function LocationsList() {
  const queryClient = useQueryClient();
  const { data: locations, isLoading, error } = useLocationsQuery();

  // Manual update from SSE (if you're not using automatic approach)
  useEffect(() => {
    // Listen for custom events if needed
    const handleSSEUpdate = (event: CustomEvent) => {
      const { resource, type, resourceId } = event.detail;

      if (resource === "locations") {
        if (type === "UPDATE" || type === "CREATE") {
          invalidateLocationQueries(queryClient);
        } else if (type === "DELETE") {
          removeLocationFromCache(queryClient, resourceId);
        }
      }
    };

    window.addEventListener("sse:event", handleSSEUpdate);
    return () => window.removeEventListener("sse:event", handleSSEUpdate);
  }, [queryClient]);

  // ... rest of component
}
```

---

## Comparison: Automatic vs Manual

| Aspect               | Automatic    | Manual                |
| -------------------- | ------------ | --------------------- |
| **Setup**            | Zero changes | Add functions to hook |
| **Simplicity**       | ✅ Simplest  | ❌ More complex       |
| **Control**          | Auto-handled | Full control          |
| **Code Duplication** | None         | Possible              |
| **Maintenance**      | Easier       | More work             |
| **Recommended**      | ✅ YES       | For special cases     |

---

## Resource Name Mapping

Make sure your backend resource names match your query keys:

| Backend Resource           | Query Key                    | Hook File                          |
| -------------------------- | ---------------------------- | ---------------------------------- |
| `'locations'`              | `['locations']`              | `useLocationsQuery.ts`             |
| `'users'`                  | `['users']`                  | `useUsersQuery.ts`                 |
| `'renewal_types'`          | `['renewal_types']`          | `useRenewalTypesQuery.ts`          |
| `'warehouse_requirements'` | `['warehouse_requirements']` | `useWarehouseRequirementsQuery.ts` |

**Important:** Backend resource name MUST match the first element of React Query key!

---

## Example: Multiple Locations Hooks

If you have multiple hooks for locations:

### Hook 1: All Locations

```typescript
export const useLocationsQuery = () => {
  return useQuery({
    queryKey: ["locations"], // Matches 'locations' resource
    queryFn: () => get("/locations"),
  });
};
```

### Hook 2: Single Location

```typescript
export const useLocationQuery = (id: number) => {
  return useQuery({
    queryKey: ["locations", id], // Matches 'locations' resource (subset)
    queryFn: () => get(`/locations/${id}`),
  });
};
```

### SSE Behavior

```
Event: { type: 'UPDATE', resource: 'locations', resourceId: 5, data: {...} }

React Query matches:
✅ ['locations'] → Invalidates (refetches all)
✅ ['locations', 5] → Updates + Invalidates
❌ ['locations', 6] → Ignored
```

---

## Real-World Example: Location Management Component

```typescript
import { useState } from 'react';
import { useLocationsQuery } from '@/hooks/useLocationsQuery';
import { useApi } from '@/hooks/useApi';

export function LocationManagement() {
  const { data: locations, isLoading } = useLocationsQuery();
  const { post, put } = useApi();
  const [newLocationName, setNewLocationName] = useState('');

  const handleCreateLocation = async () => {
    await post('/locations', { location_name: newLocationName });
    // NO manual refetch needed!
    // SSE automatically handles it:
    // 1. Server: emitCreate('locations', id, data)
    // 2. Hook: Receives event
    // 3. React Query: Invalidates ['locations']
    // 4. useLocationsQuery: Auto-refetches
    // 5. Component: Re-renders with new location
    setNewLocationName('');
  };

  const handleUpdateLocation = async (id: number, newName: string) => {
    await put(`/locations/${id}`, { location_name: newName });
    // NO manual refetch!
    // SSE automatically handles it:
    // 1. Server: emitUpdate('locations', id, data)
    // 2. Hook: Receives event
    // 3. React Query: Updates cache + invalidates
    // 4. useLocationsQuery: Auto-refetches if needed
    // 5. Component: Re-renders
  };

  const handleToggleStatus = async (id: number) => {
    await put(`/locations/${id}/toggle-status`, {});
    // NO manual refetch!
    // SSE automatically handles it
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Locations</h2>

      <div>
        <input
          value={newLocationName}
          onChange={(e) => setNewLocationName(e.target.value)}
          placeholder="New location name"
        />
        <button onClick={handleCreateLocation}>Add Location</button>
      </div>

      <ul>
        {locations?.map(location => (
          <li key={location.id}>
            {location.location_name}
            <button onClick={() => handleUpdateLocation(location.id, 'New Name')}>
              Edit
            </button>
            <button onClick={() => handleToggleStatus(location.id)}>
              Toggle Status
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Notice:** No `refetch()` calls! No `queryClient.invalidateQueries()`! SSE handles everything automatically.

---

## Step-by-Step Implementation for Locations

### 1. Verify App Component Has SSE Hook

```typescript
// App.tsx
import { useSSEBroadcast } from '@/hooks/useSSEBroadcast';

export default function App() {
  useSSEBroadcast(); // Add this if not already there

  return <AppRoutes />;
}
```

### 2. Keep Your useLocationsQuery Unchanged

```typescript
// hooks/useLocationsQuery.ts
import { useQuery } from "@tanstack/react-query";
import { useApi } from "./useApi";

export const useLocationsQuery = () => {
  const { get } = useApi();

  return useQuery({
    queryKey: ["locations"], // ← Key is important!
    queryFn: async () => {
      const res = await get("/locations");
      return Array.isArray(res) ? res : res.data;
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
  });
};
```

### 3. Use Hook In Components (No Changes)

```typescript
// components/LocationsList.tsx
import { useLocationsQuery } from '@/hooks/useLocationsQuery';

export function LocationsList() {
  const { data: locations, isLoading } = useLocationsQuery();

  return (
    <div>
      {locations?.map(loc => (
        <div key={loc.id}>{loc.location_name}</div>
      ))}
    </div>
  );
}
```

### 4. Backend: Add SSE Emissions

```typescript
// locations.service.ts
async create(dto: CreateLocationDto): Promise<any> {
  const newLoc = this.locationsRepository.create(dto);
  const saved = await this.locationsRepository.save(newLoc);

  try {
    const response = await this.findOne(saved.id);
    this.sseEventEmitter.emitCreate('locations', saved.id, response);
  } catch (err) {
    logger.warn('SSE failed:', err);
  }

  return response;
}

async update(id: number, dto: UpdateLocationDto): Promise<any> {
  const location = await this.locationsRepository.findOne({ where: { id } });
  Object.assign(location, dto);
  const saved = await this.locationsRepository.save(location);

  try {
    const response = await this.findOne(saved.id);
    this.sseEventEmitter.emitUpdate('locations', id, response);
  } catch (err) {
    logger.warn('SSE failed:', err);
  }

  return response;
}

async toggleStatus(id: number): Promise<any> {
  const location = await this.locationsRepository.findOne({ where: { id } });
  location.status_id = location.status_id === 1 ? 2 : 1;
  const saved = await this.locationsRepository.save(location);

  try {
    const response = await this.findOne(saved.id);
    this.sseEventEmitter.emitUpdate('locations', id, response);
  } catch (err) {
    logger.warn('SSE failed:', err);
  }

  return response;
}
```

### Done! 🎉

Now:

- ✅ User 1 creates location → User 2 sees it instantly
- ✅ User 1 updates location → User 2 sees update instantly
- ✅ User 1 toggles status → User 2 sees toggle instantly
- ✅ No manual refetch calls needed
- ✅ No code changes to your React hooks

---

## Common Query Key Patterns

### Pattern 1: List Query

```typescript
queryKey: ["locations"]; // Fetches all locations
```

### Pattern 2: Single Item

```typescript
queryKey: ["locations", id]; // Fetches specific location
```

### Pattern 3: Filtered List

```typescript
queryKey: ["locations", { status: "active" }]; // Filtered list
```

### Pattern 4: Paginated

```typescript
queryKey: ["locations", { page: 1, limit: 10 }]; // Paginated
```

**SSE automatically matches:**

- `'locations'` resource matches all above patterns
- Event invalidates all matching queries
- Perfect for syncing!

---

## Troubleshooting

### Issue: Data not updating

**Check:**

1. ✅ `useSSEBroadcast()` is in App component
2. ✅ Backend emits with correct resource name: `emitUpdate('locations', ...)`
3. ✅ React Query key matches: `['locations']`
4. ✅ Check browser console for errors

### Issue: Multiple refetches

**Normal!** React Query might refetch multiple times:

1. Cache invalidated by SSE
2. Query becomes stale
3. Component re-mounts or focuses
   This is expected behavior and ensures freshness.

### Issue: Stale data after toggle

**Solution:** Use `staleTime: 0` for critical data

```typescript
return useQuery({
  queryKey: ["locations"],
  queryFn: () => get("/locations"),
  staleTime: 0, // Always refetch on focus
  gcTime: 1000 * 60 * 60 * 24,
});
```

---

## Summary

| Task                 | Code Required                                      |
| -------------------- | -------------------------------------------------- |
| Setup SSE globally   | `useSSEBroadcast()` in App (done!)                 |
| Create location hook | `useLocationsQuery()` (existing, no changes!)      |
| Use in component     | `useLocationsQuery()` (existing, no changes!)      |
| Backend emit         | Add `emitCreate/Update` calls (3 lines per method) |
| Frontend refetch     | NONE! Automatic via SSE                            |

**Total effort: ~30 minutes for entire implementation**

That's it! Your React Query hooks automatically sync in real-time via SSE. 🚀
