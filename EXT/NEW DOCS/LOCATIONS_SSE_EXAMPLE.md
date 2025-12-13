# useLocationQuery + SSE Integration - Visual Flow

## The Magic Happens Automatically

### What You Have Now

```
Frontend: useLocationsQuery hook
    ↓
    Fetches: GET /locations
    ↓
    Returns: locations array
    ↓
    Component displays locations
```

### After SSE Integration

```
Frontend: useLocationsQuery hook
    ↓
    Fetches: GET /locations
    ↓
    Returns: locations array
    ↓
    Component displays locations
    ↓
    SSE HOOK (in App) listens for events
    ↓
    Event arrives: { resource: 'locations', type: 'UPDATE' }
    ↓
    React Query: "Oh, I have ['locations'] cached!"
    ↓
    Invalidates cache
    ↓
    useLocationsQuery auto-refetches
    ↓
    Component re-renders with new data
```

---

## Your Current Hook (No Changes Needed!)

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
    queryKey: ["locations"], // ← THIS matches SSE resource 'locations'
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

**IMPORTANT:** The `queryKey: ["locations"]` MUST match the backend resource name `'locations'` in SSE events!

---

## Event Flow Diagram

```
USER 1 (Browser)                    USER 2 (Browser)
┌──────────────────────┐            ┌──────────────────────┐
│ Create Location Form │            │ Locations List       │
│  [Name: "New York"]  │            │ 1. New Jersey        │
│  [Submit Button]     │            │ 2. Boston            │
└──────────┬───────────┘            └──────────┬───────────┘
           │                                    │
           │ POST /locations                    │ useLocationsQuery
           │ { location_name: 'New York' }      │ ↓ Shows: [NJ, Boston]
           │                                    │
           ▼                                    │
    ┌─────────────────────────────┐            │
    │  BACKEND (NestJS)           │            │
    │                             │            │
    │  LocationsService.create()  │            │
    │  ├─ Save to database        │            │
    │  └─ NEW: Emit SSE event     │            │
    │     emitCreate(              │            │
    │       'locations',           │            │
    │       newLocation.id,        │            │
    │       newLocationData        │            │
    │     )                        │            │
    │                             │            │
    │  Event: {                   │            │
    │    type: 'CREATE',          │            │
    │    resource: 'locations',   │──────────► │ Event received!
    │    resourceId: 3,           │            │
    │    data: {...}              │            │ SSE Hook (in App):
    │    timestamp: '...'         │            │ "Oh! Resource is 'locations'"
    │  }                          │            │
    └─────────────────────────────┘            │ React Query Check:
                                               │ "Do I have ['locations']?"
                                               │ "YES! I have it cached"
                                               │
                                               │ Invalidate:
                                               │ queryClient.invalidateQueries(
                                               │   ['locations']
                                               │ )
                                               │
                                               ▼
                                        GET /locations
                                               │
                                               ▼
                                        Updated: [
                                          {id: 1, name: "New Jersey"},
                                          {id: 2, name: "Boston"},
                                          {id: 3, name: "New York"}
                                        ]
                                               │
                                               ▼
                                        Cache updated
                                               │
                                               ▼
                                        Re-render list
                                               │
                                               ▼
                                        ┌──────────────────┐
                                        │ Locations List   │
                                        │ 1. New Jersey    │
                                        │ 2. Boston        │
                                        │ 3. New York ✨   │
                                        │ (NEW instantly!) │
                                        └──────────────────┘
```

---

## Side-by-Side Comparison

### Before SSE (Manual Refetch)

```typescript
// Component needs manual refetch
const { data: locations, refetch } = useLocationsQuery();

const handleCreateLocation = async () => {
  await post("/locations", { location_name: newName });
  refetch(); // ← Manual refetch needed
};

const handleUpdateLocation = async (id: number, newName: string) => {
  await put(`/locations/${id}`, { location_name: newName });
  refetch(); // ← Manual refetch needed
};

const handleToggleStatus = async (id: number) => {
  await put(`/locations/${id}/toggle-status`, {});
  refetch(); // ← Manual refetch needed
};
```

### After SSE (Automatic Refetch)

```typescript
// Component works automatically
const { data: locations } = useLocationsQuery();

const handleCreateLocation = async () => {
  await post("/locations", { location_name: newName });
  // SSE automatically refetches!
  // No refetch() call needed
};

const handleUpdateLocation = async (id: number, newName: string) => {
  await put(`/locations/${id}`, { location_name: newName });
  // SSE automatically refetches!
  // No refetch() call needed
};

const handleToggleStatus = async (id: number) => {
  await put(`/locations/${id}/toggle-status`, {});
  // SSE automatically refetches!
  // No refetch() call needed
};
```

**Difference:** SSE removes manual refetch calls!

---

## Query Key Matching Examples

### Example 1: All Locations

```typescript
// Hook
useQuery({
  queryKey: ["locations"],
  queryFn: () => get("/locations"),
});

// SSE Event
emitCreate("locations", id, data);

// Match: ✅ YES
// Action: Invalidates query, auto-refetch
```

### Example 2: Single Location

```typescript
// Hook
useQuery({
  queryKey: ["locations", 5],
  queryFn: () => get("/locations/5"),
});

// SSE Event
emitUpdate("locations", 5, data);

// Match: ✅ YES
// Action: Updates cache, invalidates
```

### Example 3: Filtered Locations

```typescript
// Hook
useQuery({
  queryKey: ["locations", { status: "active" }],
  queryFn: () => get("/locations?status=active"),
});

// SSE Event
emitUpdate("locations", id, data);

// Match: ✅ YES
// Action: Invalidates query, auto-refetch
```

### Example 4: Different Resource (No Match)

```typescript
// Hook
useQuery({
  queryKey: ["users"],
  queryFn: () => get("/users"),
});

// SSE Event
emitUpdate("locations", id, data);

// Match: ❌ NO
// Action: Ignored (different resource)
```

---

## Implementation Checklist

```
BACKEND SETUP:
  ☐ LocationsService has @Inject(SSEEventEmitterHelper)
  ☐ create() method calls: emitCreate('locations', id, data)
  ☐ update() method calls: emitUpdate('locations', id, data)
  ☐ toggleStatus() method calls: emitUpdate('locations', id, data)

FRONTEND SETUP:
  ☐ App.tsx has: useSSEBroadcast()
  ☐ useLocationsQuery.ts has queryKey: ["locations"]
  ☐ Components use useLocationsQuery (no changes needed)
  ☐ No refetch() calls in components (removed!)

TESTING:
  ☐ Open locations page in 2 browsers
  ☐ Create location in browser 1
  ☐ See it instantly in browser 2 (no refresh)
  ☐ Update location in browser 1
  ☐ See update instantly in browser 2
  ☐ Toggle status in browser 1
  ☐ See toggle instantly in browser 2
```

---

## Code Changes Summary

### Only 3 Files Need Changes

#### File 1: App.tsx (1 line)

```typescript
import { useSSEBroadcast } from '@/hooks/useSSEBroadcast';

export default function App() {
  useSSEBroadcast(); // ← ADD THIS LINE
  return <AppRoutes />;
}
```

#### File 2: LocationsService.ts (1-2 lines per method)

```typescript
async create(dto: CreateLocationDto): Promise<any> {
  const newLoc = this.locationsRepository.create(dto);
  const saved = await this.locationsRepository.save(newLoc);

  // ADD THESE LINES:
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

  // ADD THESE LINES:
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

  // ADD THESE LINES:
  try {
    const response = await this.findOne(saved.id);
    this.sseEventEmitter.emitUpdate('locations', id, response);
  } catch (err) {
    logger.warn('SSE failed:', err);
  }

  return response;
}
```

#### File 3: useLocationsQuery.ts

```typescript
// NO CHANGES NEEDED!
// Keep exactly as it is
```

**Total changes: 1 file (App.tsx) + 1 file (LocationsService.ts)**
**Total lines: ~4 lines (+ error handling)**

---

## Real Component Example

```typescript
import { useState } from 'react';
import { useLocationsQuery } from '@/hooks/useLocationsQuery';
import { useApi } from '@/hooks/useApi';

export function LocationManagement() {
  const { data: locations = [], isLoading } = useLocationsQuery();
  const { post, put } = useApi();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreate = async () => {
    if (!newName) return;
    await post('/locations', { location_name: newName });
    // That's it! SSE handles the rest
    setNewName('');
  };

  const handleUpdate = async (id: number) => {
    await put(`/locations/${id}`, { location_name: editName });
    // That's it! SSE handles the rest
    setEditingId(null);
  };

  const handleToggleStatus = async (id: number) => {
    await put(`/locations/${id}/toggle-status`, {});
    // That's it! SSE handles the rest
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Locations</h2>

      {/* Create */}
      <div style={{ marginBottom: '20px' }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New location name"
        />
        <button onClick={handleCreate}>Add Location</button>
      </div>

      {/* List */}
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Location Name</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {locations.map(location => (
            <tr key={location.id}>
              <td>{location.id}</td>
              <td>
                {editingId === location.id ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                ) : (
                  location.location_name
                )}
              </td>
              <td>
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
                    <button onClick={() => handleToggleStatus(location.id)}>
                      Toggle Status
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Notice:** No `refetch()` calls! No manual cache invalidation! Clean, simple, readable code.

---

## Summary Table

| Scenario                  | Before             | After        | Effort  |
| ------------------------- | ------------------ | ------------ | ------- |
| Create location           | Manual refetch     | Auto via SSE | -1 line |
| Update location           | Manual refetch     | Auto via SSE | -1 line |
| Toggle status             | Manual refetch     | Auto via SSE | -1 line |
| User sees others' changes | Never (no polling) | Instantly    | +1 hook |
| Code complexity           | Higher             | Lower        | Simpler |

**Result:** Better UX, simpler code, less bugs! 🎉
