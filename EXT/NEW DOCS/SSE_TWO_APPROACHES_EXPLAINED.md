# SSE Integration: Two Approaches Explained

## The Confusion

You asked: "If SSE handles everything by listening, why do we still fetch /locations?"

**Answer:** There are **2 completely different SSE approaches**. The docs mixed them up. Let me clarify both.

---

## Approach 1: Pure SSE (No API Calls - Full Data in Event)

### How It Works

```
User 1: Create Location "New York"
    ↓
POST /locations { name: 'New York' }
    ↓
Backend saves to DB
    ↓
Backend fetches fresh data: { id: 3, name: 'New York', status: 'active' }
    ↓
Backend emits SSE: { resource: 'locations', data: { id: 3, name: 'New York', status: 'active' } }
    ↓
ALL connected users receive event with FULL DATA
    ↓
User 2 state updates directly from SSE: locations = [..., newLocation]
    ↓
Component re-renders instantly
    ↓
NO /locations fetch needed ✅
```

### Backend Code (Emit Full Data)

```typescript
// LocationsService.create()
async create(dto: CreateLocationDto): Promise<any> {
  const newLoc = this.locationsRepository.create(dto);
  const saved = await this.locationsRepository.save(newLoc);

  // Fetch the FULL data
  const fullData = await this.findOne(saved.id);

  // Emit with FULL DATA
  this.sseEventEmitter.emitCreate('locations', saved.id, fullData);

  return fullData;
}
```

### Frontend Code (Pure SSE - No Refetch)

```typescript
// Create custom hook that uses SSE directly
export const useLocationsSSE = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = subscribeToSSEEvents((event) => {
      if (event.resource === "locations") {
        if (event.type === "CREATE") {
          // Add directly from SSE data
          setLocations((prev) => [...prev, event.data]);
          // Also update React Query cache
          queryClient.setQueryData(["locations"], (prev) => [
            ...prev,
            event.data,
          ]);
        } else if (event.type === "UPDATE") {
          // Update directly from SSE data
          setLocations((prev) =>
            prev.map((loc) => (loc.id === event.resourceId ? event.data : loc))
          );
          queryClient.setQueryData(["locations"], (prev) =>
            prev.map((loc) => (loc.id === event.resourceId ? event.data : loc))
          );
        } else if (event.type === "DELETE") {
          // Remove directly from SSE
          setLocations((prev) =>
            prev.filter((loc) => loc.id !== event.resourceId)
          );
          queryClient.setQueryData(["locations"], (prev) =>
            prev.filter((loc) => loc.id !== event.resourceId)
          );
        }
      }
    });

    return unsubscribe;
  }, [queryClient]);

  return locations;
};
```

### Usage (No Refetch, No API Calls)

```typescript
function LocationsList() {
  const locations = useLocationsSSE(); // Pure SSE, no API calls

  return (
    <div>
      {locations.map(loc => (
        <div key={loc.id}>{loc.name}</div>
      ))}
    </div>
  );
}
```

### Result

- ✅ No /locations fetch needed
- ✅ Instant updates across all browsers
- ✅ Real-time sync without any API calls (except initial load)
- ⚠️ More complex (manual state management)

---

## Approach 2: SSE + React Query (Invalidate + Refetch - Current Docs)

### How It Works

```
User 1: Create Location "New York"
    ↓
POST /locations { name: 'New York' }
    ↓
Backend saves to DB
    ↓
Backend emits SSE: { resource: 'locations', type: 'CREATE', resourceId: 3 }
    ↓
ALL connected users receive event (NO data in event)
    ↓
React Query cache: "Oh, locations cache is stale"
    ↓
React Query auto-invalidates
    ↓
User 2 component refetches: GET /locations
    ↓
Component re-renders with fresh data
    ↓
Still fetches /locations ✅ (but only when needed)
```

### Backend Code (Emit Only Signal)

```typescript
// LocationsService.create()
async create(dto: CreateLocationDto): Promise<any> {
  const newLoc = this.locationsRepository.create(dto);
  const saved = await this.locationsRepository.save(newLoc);

  const fullData = await this.findOne(saved.id);

  // Emit signal (no data in event)
  this.sseEventEmitter.emitCreate('locations', saved.id, fullData);

  return fullData;
}
```

### Frontend Code (React Query Cache Invalidation)

```typescript
// Same hook as before - NO CHANGES
export const useLocationsQuery = () => {
  const { get } = useApi();
  return useQuery({
    queryKey: ["locations"],
    queryFn: () => get("/locations"),
  });
};

// SSE hook in App invalidates cache
useSSEBroadcast((event) => {
  if (event.resource === "locations") {
    queryClient.invalidateQueries(["locations"]);
    // React Query auto-refetches
  }
});
```

### Usage (Same as Before)

```typescript
function LocationsList() {
  const { data: locations } = useLocationsQuery(); // Auto-refetch from React Query

  return (
    <div>
      {locations?.map(loc => (
        <div key={loc.id}>{loc.name}</div>
      ))}
    </div>
  );
}
```

### Result

- ✅ Uses React Query (familiar pattern)
- ✅ Automatic cache management
- ⚠️ Still fetches /locations (but smart invalidation)
- ⚠️ Simpler code, cleaner architecture

---

## Side-by-Side Comparison

| Feature                   | Approach 1 (Pure SSE)  | Approach 2 (SSE + React Query) |
| ------------------------- | ---------------------- | ------------------------------ |
| **Data in SSE event?**    | YES (full data)        | NO (just signal)               |
| **/locations API calls?** | NONE (except init)     | YES (when cache invalidates)   |
| **Real-time speed**       | Fastest ⚡             | Fast (< 100ms refetch)         |
| **Code complexity**       | Complex ❌             | Simple ✅                      |
| **React Query usage**     | Not used               | Used fully ✅                  |
| **Best for**              | High-frequency updates | Standard CRUD                  |
| **Network traffic**       | Low                    | Medium                         |
| **Memory usage**          | Higher (manual state)  | Lower (React Query)            |

---

## Which Approach Should You Use?

### Use **Approach 1 (Pure SSE)** If:

- You want ZERO API calls after initial load
- You have very high frequency updates (stock prices, live scores)
- You need maximum speed
- You're willing to manage state manually

### Use **Approach 2 (SSE + React Query)** If:

- You like React Query's simplicity
- You have normal CRUD operations
- You want automatic cache management
- You prefer familiar patterns
- **You're not 100% sure yet** ← Recommended for learning

---

## The Real Answer: Choose Based on Your Needs

### Your Question: "Can I use SSE without fetching /locations?"

**YES!** But only with **Approach 1**. Here's what changes:

#### Step 1: Backend - Emit Full Data

```typescript
async create(dto: CreateLocationDto) {
  const newLoc = this.locationsRepository.create(dto);
  const saved = await this.locationsRepository.save(newLoc);

  // Always fetch full data before emitting
  const fullData = await this.findOne(saved.id);

  // Backend already does this - so no change needed!
  this.sseEventEmitter.emitCreate('locations', saved.id, fullData);

  return fullData;
}
```

**Backend Change: 0 lines** (Already emitting full data!)

#### Step 2: Frontend - Use SSE Data Directly

```typescript
// Instead of useLocationsQuery, use pure SSE
export const useLocationsSSE = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const eventSource = new EventSource("/sse/broadcast");

  useEffect(() => {
    eventSource.addEventListener("message", (e) => {
      const event = JSON.parse(e.data);

      if (event.resource === "locations") {
        if (event.type === "CREATE") {
          setLocations((prev) => [...prev, event.data]);
        } else if (event.type === "UPDATE") {
          setLocations((prev) =>
            prev.map((l) => (l.id === event.resourceId ? event.data : l))
          );
        } else if (event.type === "DELETE") {
          setLocations((prev) => prev.filter((l) => l.id !== event.resourceId));
        }
      }
    });

    return () => eventSource.close();
  }, []);

  return locations;
};
```

#### Step 3: Component - No Refetch Needed

```typescript
function LocationsList() {
  // Initial load: GET /locations (one time)
  const { data: initialLocations } = useLocationsQuery();

  // Real-time updates: From SSE (no /locations calls)
  const liveLocations = useLocationsSSE();

  // Use whichever is available (live > initial)
  const locations = liveLocations.length > 0 ? liveLocations : initialLocations;

  return (
    <div>
      {locations?.map(loc => (
        <div key={loc.id}>{loc.name}</div>
      ))}
    </div>
  );
}
```

**Result:**

- 1 initial `/locations` fetch (page load)
- 0 refetch calls after that
- All updates from SSE with full data
- ✅ No polling, no unnecessary refetches!

---

## Summary

| What You Asked                         | What I Explained Before                    | What I Should Have Said                                       |
| -------------------------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| "Do I still need /locations fetch?"    | "Cache invalidates, React Query refetches" | "That's Approach 2. You can use Approach 1 for ZERO fetches!" |
| "Can SSE handle all without fetching?" | "No, React Query manages cache"            | "YES! With Approach 1: Pure SSE"                              |
| "What does 'no refresh' mean?"         | Misleading (still had refetch)             | "Approach 1 = no API refetch, just SSE data"                  |

---

## Your Next Step

**Choose one:**

1. **Keep Approach 2** (Current - Simpler, familiar React Query)

   - Less learning
   - Familiar patterns
   - Still efficient (smart cache invalidation)
   - Trade: ~100ms refetch call

2. **Switch to Approach 1** (Pure SSE - Fastest, real real-time)
   - Zero API refetch
   - True real-time (data in event)
   - More code complexity
   - Trade: Manual state management

**My recommendation:** Start with **Approach 2** to learn SSE, then switch to **Approach 1** once you're comfortable if you need maximum performance.

The current docs (LOCATIONS_SSE_EXAMPLE.md) describe **Approach 2**, which is why you see the /locations refetch. That's correct and efficient! But if you want zero refetches, you need **Approach 1**.

Does this clarify the confusion?
