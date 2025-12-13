# Approach 1 vs Approach 2: Complete Working Examples

## Current Status: Your Backend is Approach 1

Your backend `SSEEventEmitterHelper` already emits **full data**:

```typescript
emitCreate('locations', id, { id, name, status, ... }) // Full data
emitUpdate('locations', id, { id, name, status, ... }) // Full data
emitDelete('locations', id) // Just ID
```

So you have **Approach 1 backend**. Now the question: **How do you use it in components?**

---

# APPROACH 1: Pure SSE (Full Data in Events)

## Frontend Hook for Approach 1

### Step 1: Create Hook (One Time Setup)

**File: `src/hooks/useLocationsSSE.ts`**

```typescript
import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

export interface Location {
  id: number;
  location_name: string;
  status: string;
  // ... other fields
}

export const useLocationsSSE = (initialData?: Location[]) => {
  const [locations, setLocations] = useState<Location[]>(initialData || []);
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const eventSource = new EventSource("/sse/broadcast");

    eventSource.addEventListener("open", () => {
      console.log("✅ SSE Connected for Locations");
      setIsConnected(true);
    });

    eventSource.addEventListener("message", (event) => {
      try {
        const sseEvent = JSON.parse(event.data);

        // Only handle 'locations' resource
        if (sseEvent.resource !== "locations") return;

        console.log("📨 Location SSE Event:", sseEvent.type, sseEvent.data);

        // CREATE: Add new location
        if (sseEvent.type === "CREATE") {
          setLocations((prev) => [...prev, sseEvent.data]);
          queryClient.setQueryData(["locations"], (old: Location[]) => [
            ...(old || []),
            sseEvent.data,
          ]);
        }

        // UPDATE: Modify existing location
        else if (sseEvent.type === "UPDATE") {
          setLocations((prev) =>
            prev.map((loc) =>
              loc.id === sseEvent.resourceId ? sseEvent.data : loc
            )
          );
          queryClient.setQueryData(["locations"], (old: Location[]) =>
            (old || []).map((loc) =>
              loc.id === sseEvent.resourceId ? sseEvent.data : loc
            )
          );
        }

        // DELETE: Remove location
        else if (sseEvent.type === "DELETE") {
          setLocations((prev) =>
            prev.filter((loc) => loc.id !== sseEvent.resourceId)
          );
          queryClient.setQueryData(["locations"], (old: Location[]) =>
            (old || []).filter((loc) => loc.id !== sseEvent.resourceId)
          );
        }

        // INVALIDATE: Full refetch (if needed)
        else if (sseEvent.type === "INVALIDATE") {
          queryClient.invalidateQueries({ queryKey: ["locations"] });
        }
      } catch (error) {
        console.error("❌ Error parsing SSE event:", error);
      }
    });

    eventSource.addEventListener("error", () => {
      console.warn("⚠️ SSE Connection lost");
      setIsConnected(false);
      eventSource.close();
    });

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [queryClient]);

  return { locations, isConnected };
};
```

### Step 2: Use in App Component

**File: `src/App.tsx`**

```typescript
import { useEffect, useState } from 'react';
import { useLocationsSSE } from '@/hooks/useLocationsSSE';
import { useApi } from '@/hooks/useApi';
import LocationsList from '@/components/LocationsList';

export default function App() {
  const { get } = useApi();
  const [initialData, setInitialData] = useState([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);

  // Load initial data once
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const res = await get('/locations');
        setInitialData(res.data || res);
        setIsLoadingInitial(false);
      } catch (error) {
        console.error('Failed to load initial locations:', error);
        setIsLoadingInitial(false);
      }
    };

    loadInitialData();
  }, [get]);

  // Setup SSE with initial data
  const { locations, isConnected } = useLocationsSSE(initialData);

  if (isLoadingInitial) return <div>Loading...</div>;

  return (
    <div>
      <div style={{ padding: '10px', background: isConnected ? '#90EE90' : '#FFB6C6' }}>
        SSE Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>
      <LocationsList locations={locations} />
    </div>
  );
}
```

### Step 3: Use in Components

**File: `src/components/LocationsList.tsx`**

```typescript
import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { Location } from '@/hooks/useLocationsSSE';

interface Props {
  locations: Location[];
}

export default function LocationsList({ locations }: Props) {
  const { post, put, delete: deleteAPI } = useApi();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  // CREATE: Just call API, SSE updates state automatically
  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await post('/locations', { location_name: newName });
      setNewName('');
      // ❌ NO refetch(), NO invalidateQueries()
      // ✅ SSE hook automatically updates locations state
    } catch (error) {
      console.error('Failed to create location:', error);
    }
  };

  // UPDATE: Just call API, SSE updates state automatically
  const handleUpdate = async (id: number) => {
    try {
      await put(`/locations/${id}`, { location_name: editName });
      setEditingId(null);
      // ❌ NO refetch(), NO invalidateQueries()
      // ✅ SSE hook automatically updates locations state
    } catch (error) {
      console.error('Failed to update location:', error);
    }
  };

  // DELETE: Just call API, SSE updates state automatically
  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this location?')) return;
    try {
      await deleteAPI(`/locations/${id}`);
      // ❌ NO refetch(), NO invalidateQueries()
      // ✅ SSE hook automatically updates locations state
    } catch (error) {
      console.error('Failed to delete location:', error);
    }
  };

  // TOGGLE: Just call API, SSE updates state automatically
  const handleToggle = async (id: number) => {
    try {
      await put(`/locations/${id}/toggle-status`, {});
      // ❌ NO refetch(), NO invalidateQueries()
      // ✅ SSE hook automatically updates locations state
    } catch (error) {
      console.error('Failed to toggle status:', error);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Locations ({locations.length})</h2>

      {/* CREATE FORM */}
      <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc' }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New location name"
          onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button onClick={handleCreate}>Add Location</button>
      </div>

      {/* LIST */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>ID</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Name</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Status</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {locations.map((location) => (
            <tr key={location.id}>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                {location.id}
              </td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                {editingId === location.id ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === 'Enter' && handleUpdate(location.id)
                    }
                  />
                ) : (
                  location.location_name
                )}
              </td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                {location.status}
              </td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                {editingId === location.id ? (
                  <>
                    <button onClick={() => handleUpdate(location.id)}>
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditingId(location.id);
                        setEditName(location.location_name);
                      }}
                    >
                      Edit
                    </button>
                    <button onClick={() => handleToggle(location.id)}>
                      Toggle Status
                    </button>
                    <button onClick={() => handleDelete(location.id)}>
                      Delete
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {locations.length === 0 && (
        <p style={{ textAlign: 'center', color: '#999' }}>
          No locations yet. Create one above!
        </p>
      )}
    </div>
  );
}
```

### Result: Approach 1 Complete

```
Initial Load: GET /locations (once)
    ↓
App loads with data
    ↓
SSE hook connects
    ↓
User creates location → POST /locations
    ↓
Backend saves → Emits SSE with full data
    ↓
SSE hook receives → Updates state
    ↓
Component re-renders
    ↓
❌ NO refetch
❌ NO GET /locations call
✅ Data from SSE event
```

**Summary:**

- ✅ One initial `/locations` fetch (page load)
- ✅ Zero refetch calls
- ✅ All data from SSE
- ✅ Instant updates across all browsers
- ✅ No polling

---

# APPROACH 2: SSE + React Query (Cache Invalidation)

If you want **Approach 2** instead, it's completely different:

## Step 1: Keep Your Hook Unchanged

**File: `src/hooks/useLocationsQuery.ts`** (NO CHANGES)

```typescript
import { useQuery } from "@tanstack/react-query";
import { useApi } from "./useApi";

export const useLocationsQuery = () => {
  const { get } = useApi();

  return useQuery({
    queryKey: ["locations"],
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

## Step 2: Modify Backend to Send Only Signals

**File: `src/services/sse-event-emitter.helper.ts`** (CHANGE)

```typescript
// For Approach 2, send minimal data (or null)
emitCreate(resource: string, resourceId: number, data?: any) {
  // Don't send full data, just signal
  this.sseEmitter.broadcastEvent({
    type: 'CREATE',
    resource,
    resourceId,
    // ❌ Remove: data: data,
  });
}

emitUpdate(resource: string, resourceId: number, data?: any) {
  // Don't send full data, just signal
  this.sseEmitter.broadcastEvent({
    type: 'UPDATE',
    resource,
    resourceId,
    // ❌ Remove: data: data,
  });
}

emitDelete(resource: string, resourceId: number) {
  this.sseEmitter.broadcastEvent({
    type: 'DELETE',
    resource,
    resourceId,
  });
}
```

## Step 3: Setup SSE Invalidation Hook

**File: `src/hooks/useSSEInvalidation.ts`** (NEW)

```typescript
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export const useSSEInvalidation = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const eventSource = new EventSource("/sse/broadcast");

    eventSource.addEventListener("message", (event) => {
      try {
        const sseEvent = JSON.parse(event.data);

        console.log("📨 SSE Event:", sseEvent.resource, sseEvent.type);

        // Invalidate based on resource
        if (sseEvent.resource === "locations") {
          queryClient.invalidateQueries({ queryKey: ["locations"] });
        } else if (sseEvent.resource === "users") {
          queryClient.invalidateQueries({ queryKey: ["users"] });
        } else if (sseEvent.resource === "renewal_types") {
          queryClient.invalidateQueries({ queryKey: ["renewal_types"] });
        }
        // Add more as needed
      } catch (error) {
        console.error("Error parsing SSE:", error);
      }
    });

    eventSource.addEventListener("error", () => {
      console.warn("SSE connection lost");
      eventSource.close();
    });

    return () => eventSource.close();
  }, [queryClient]);
};
```

## Step 4: Setup in App

**File: `src/App.tsx`** (NEW)

```typescript
import { useSSEInvalidation } from '@/hooks/useSSEInvalidation';
import LocationsList from '@/components/LocationsList';

export default function App() {
  // Setup SSE invalidation once in App
  useSSEInvalidation();

  return (
    <div>
      <LocationsList />
    </div>
  );
}
```

## Step 5: Use in Components

**File: `src/components/LocationsList.tsx`** (SAME AS BEFORE)

```typescript
import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useLocationsQuery } from '@/hooks/useLocationsQuery';

export default function LocationsList() {
  const { data: locations = [] } = useLocationsQuery();
  const { post, put, delete: deleteAPI } = useApi();
  const [newName, setNewName] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await post('/locations', { location_name: newName });
      setNewName('');
      // ❌ NO refetch() calls
      // ✅ SSE hook invalidates, React Query auto-refetches
    } catch (error) {
      console.error('Failed to create location:', error);
    }
  };

  const handleUpdate = async (id: number, newName: string) => {
    try {
      await put(`/locations/${id}`, { location_name: newName });
      // ❌ NO refetch() calls
      // ✅ SSE hook invalidates, React Query auto-refetches
    } catch (error) {
      console.error('Failed to update location:', error);
    }
  };

  // ... rest same as Approach 1

  return (
    <div>
      {/* Same component code */}
    </div>
  );
}
```

### Result: Approach 2 Complete

```
Initial Load: GET /locations (once)
    ↓
App loads with data
    ↓
SSE invalidation hook connects
    ↓
User creates location → POST /locations
    ↓
Backend saves → Emits SSE SIGNAL (no data)
    ↓
SSE hook receives → Invalidates React Query cache
    ↓
React Query → Auto-refetches GET /locations
    ↓
Component re-renders
    ↓
✅ One extra GET /locations call
✅ React Query handles cache
```

**Summary:**

- ✅ One initial `/locations` fetch
- ⚠️ One refetch call per action (create/update/delete)
- ✅ All data from API (fresh)
- ✅ Instant updates across all browsers
- ✅ Simpler to understand

---

# Comparison Table

| Aspect                | Approach 1 (Your Backend Now) | Approach 2              |
| --------------------- | ----------------------------- | ----------------------- |
| **Backend sends**     | Full data in event            | Only signal (no data)   |
| **Frontend receives** | Data directly from SSE        | Signal, then refetch    |
| **API calls**         | 1 initial load only           | 1 initial + N refetches |
| **Network traffic**   | HIGH (full data in event)     | MEDIUM (refetch API)    |
| **Speed**             | Fastest ⚡                    | Fast 🚀                 |
| **Code complexity**   | Medium                        | Low ✅                  |
| **React Query**       | Optional                      | Required ✅             |
| **Manual state**      | YES                           | NO (React Query)        |
| **Best for**          | Real-time, high-frequency     | Standard CRUD           |

---

# Decision Guide

## Choose Approach 1 If:

```
You want: ZERO API refetch calls
You have: Your backend already set up
You need: Maximum real-time performance
You're willing: To manage state in hook
Implementation: useLocationsSSE hook + App + Components
```

## Choose Approach 2 If:

```
You want: Simple, familiar React Query
You have: Standard CRUD operations
You need: Less code complexity
You like: React Query patterns
Implementation: useSSEInvalidation hook + App + Components (same)
```

---

# Your Next Step

**You currently have Approach 1 backend. Choose:**

### Option A: Complete Approach 1

- Use `useLocationsSSE` hook in App
- Zero refetch calls
- Best real-time performance
- ~50 lines of code

### Option B: Switch to Approach 2

- Modify backend to not send data
- Use `useSSEInvalidation` hook in App
- Familiar React Query patterns
- ~30 lines of code

**Which approach do you prefer?**

I can:

1. **Give you the complete Approach 1 implementation guide** (copy-paste ready)
2. **Give you the complete Approach 2 implementation guide** (copy-paste ready)
3. **Help you choose between them**

What's your preference?
