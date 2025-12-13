# LocationsService: Using Both SSE Approaches

## ✅ Implementation Complete

You now have **both options** in your LocationsService. Each method (create, update, toggleStatus) has TWO commented options:

### Option 1: WITH Data (Default - Uncomment to Use)

```typescript
// In create(), update(), toggleStatus()
this.sseEventEmitter.emitCreate("locations", id, locationResponse);
this.sseEventEmitter.emitUpdate("locations", id, locationResponse);
```

**Use when:** You're using **Approach 1** (Pure SSE on frontend)

- Frontend hook: `useLocationData.ts` (manual state management)
- No React Query refetch needed
- Data comes from SSE event
- Fastest: ~0-10ms update

---

### Option 2: WITHOUT Data (Available - Uncomment to Use)

```typescript
// In create(), update(), toggleStatus()
// this.sseEventEmitter.emitCreateSignal('locations', id);
// this.sseEventEmitter.emitUpdateSignal('locations', id);
```

**Use when:** You're using **Approach 2** (SSE + React Query on frontend)

- Frontend hook: `useSSEBroadcast.ts` + `useQuery` hooks
- React Query auto-refetches /locations
- No data in event (cleaner network)
- Speed: ~100-500ms (includes refetch)

---

## How to Switch Between Approaches

### Currently Active (Option 1 - WITH Data)

**File: `src/services/locations.service.ts`**

```typescript
// In create() method - Line ~205
try {
  // ✅ OPTION 1: WITH data (ACTIVE)
  this.sseEventEmitter.emitCreate(
    "locations",
    locationResponse.id,
    locationResponse
  );

  // ❌ OPTION 2: WITHOUT data (disabled)
  // this.sseEventEmitter.emitCreateSignal('locations', locationResponse.id);
} catch (err) {
  console.warn("SSE event failed:", err);
}
```

---

## To Switch to Approach 2 (Option 2)

Edit the 4 places in LocationsService and **swap the commented lines**:

### 1. In `create()` method

```typescript
try {
  // ❌ OPTION 1: WITH data (DISABLED)
  // this.sseEventEmitter.emitCreate('locations', locationResponse.id, locationResponse);

  // ✅ OPTION 2: WITHOUT data (ACTIVE)
  this.sseEventEmitter.emitCreateSignal("locations", locationResponse.id);
} catch (err) {
  console.warn("SSE event failed:", err);
}
```

### 2. In `update()` method

```typescript
try {
  // ❌ OPTION 1: WITH data (DISABLED)
  // this.sseEventEmitter.emitUpdate('locations', id, locationResponse);

  // ✅ OPTION 2: WITHOUT data (ACTIVE)
  this.sseEventEmitter.emitUpdateSignal("locations", id);
} catch (err) {
  console.warn("SSE event failed:", err);
}
```

### 3. In `remove()` method

```typescript
try {
  // ❌ OPTION 1: WITH data (DISABLED)
  // this.sseEventEmitter.emitDelete('locations', id);

  // ✅ OPTION 2: WITHOUT data (ACTIVE)
  this.sseEventEmitter.emitDeleteSignal("locations", id);
} catch (err) {
  console.warn("SSE event failed:", err);
}
```

### 4. In `toggleStatus()` method

```typescript
try {
  // ❌ OPTION 1: WITH data (DISABLED)
  // this.sseEventEmitter.emitUpdate('locations', id, locationResponse);

  // ✅ OPTION 2: WITHOUT data (ACTIVE)
  this.sseEventEmitter.emitUpdateSignal("locations", id);
} catch (err) {
  console.warn("SSE event failed:", err);
}
```

---

## Available Methods in SSEEventEmitterHelper

### WITH Data Methods (Approach 1)

```typescript
this.sseEventEmitter.emitCreate(resource, resourceId, fullData);
this.sseEventEmitter.emitUpdate(resource, resourceId, fullData);
this.sseEventEmitter.emitDelete(resource, resourceId);
this.sseEventEmitter.emitInvalidate(resource);
```

### WITHOUT Data Methods (Approach 2)

```typescript
this.sseEventEmitter.emitCreateSignal(resource, resourceId);
this.sseEventEmitter.emitUpdateSignal(resource, resourceId);
this.sseEventEmitter.emitDeleteSignal(resource, resourceId);
this.sseEventEmitter.emitInvalidateSignal(resource);
```

---

## Frontend Usage (No Changes Needed)

### For Approach 1 (WITH Data)

Frontend file: `src/hooks/useLocationData.ts`

```typescript
const { locations, isConnected } = useLocationData(initialData);
// Use locations directly, no refetch
```

### For Approach 2 (WITHOUT Data)

Frontend file: `src/hooks/useSSEBroadcast.ts` + `src/hooks/useLocationsQuery.ts`

```typescript
// In App.tsx
useSSEBroadcast(); // Setup once

// In components
const { data: locations } = useLocationsQuery();
// React Query auto-refetches when invalidation signal arrives
```

---

## Summary

| Aspect              | Approach 1 (WITH Data)       | Approach 2 (WITHOUT Data)                    |
| ------------------- | ---------------------------- | -------------------------------------------- |
| **Backend methods** | `emitCreate/Update/Delete`   | `emitCreateSignal/UpdateSignal/DeleteSignal` |
| **Frontend hook**   | `useLocationData`            | `useSSEBroadcast` + `useQuery`               |
| **Network calls**   | 1 initial load               | 1 initial + N refetch                        |
| **Speed**           | Fastest                      | Fast                                         |
| **Default in code** | ✅ Active                    | 💬 Commented                                 |
| **How to switch**   | Comment out, uncomment other | Comment out, uncomment other                 |

---

## Quick Test

### Test Approach 1 (Current)

1. Frontend uses `useLocationData` hook
2. Open 2 browsers
3. Create location in browser 1
4. Watch browser 2 update instantly (no refetch)

### Test Approach 2 (After switching)

1. Frontend uses `useSSEBroadcast` + `useLocationsQuery`
2. Open 2 browsers
3. Create location in browser 1
4. Watch browser 2 refetch /locations endpoint
5. See update appear

---

## Done! ✅

You now have:

- ✅ Both SSE methods in SSEEventEmitterHelper
- ✅ Both options in LocationsService (create/update/delete/toggleStatus)
- ✅ Easy to switch between approaches by uncommenting/commenting
- ✅ Zero forced choice - use what you prefer

**Next:** Choose your approach and uncomment the matching options in LocationsService!
