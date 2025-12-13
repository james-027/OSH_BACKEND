# How to Include JWT Token in EventSource Request

## The Problem

EventSource (used for SSE) doesn't support custom headers like:

```typescript
// ❌ This doesn't work with EventSource
headers: {
  Authorization: `Bearer ${token}`;
}
```

So you need to pass the token as a **query parameter** in the URL instead.

---

## Solution: Two Approaches

### Approach A: Simple Query Parameter (Easiest)

**Frontend:**

```typescript
// Get token from your auth storage
const token = localStorage.getItem("access_token"); // or however you store it

// Add to EventSource URL
const eventSource = new EventSource(`/sse/broadcast?token=${token}`);
```

**Backend - Update SSE Controller:**

You need to extract token from query param instead of header. Update your SSEController:

```typescript
@Sse("broadcast")
subscribeToEvents(
  @Query('token') token: string,
  @Request() req
): Observable<any> {
  // Token is now available as query parameter
  // JwtAuthGuard will use it from request context

  const authenticatedUserId = req.user?.id;
  if (!authenticatedUserId) {
    throw new Error("Unauthorized");
  }

  return this.sseEmitterService.subscribeToEvents().pipe(
    map((event: SSEEvent) => ({
      data: event,
      id: `${event.timestamp}-${Math.random()}`,
    }))
  );
}
```

---

### Approach B: Custom JWT Strategy (More Secure)

Create a custom JWT strategy that checks both headers and query params.

**Backend - Create Custom Middleware:**

```typescript
// src/middleware/sse-jwt.middleware.ts
import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

@Injectable()
export class SSEJwtMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Check if token is in query params
    if (req.query.token && typeof req.query.token === "string") {
      // Move query param token to Authorization header
      req.headers.authorization = `Bearer ${req.query.token}`;
    }
    next();
  }
}
```

**Backend - Apply Middleware to App:**

```typescript
// src/app.module.ts
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { SSEJwtMiddleware } from './middleware/sse-jwt.middleware';
import { SSEController } from './controllers/sse.controller';

@Module({
  imports: [...],
  controllers: [...],
  providers: [...],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SSEJwtMiddleware)
      .forRoutes(
        { path: 'sse/*', method: RequestMethod.GET }
      );
  }
}
```

**Frontend - Same Simple Code:**

```typescript
const token = localStorage.getItem("access_token");
const eventSource = new EventSource(`/sse/broadcast?token=${token}`);
```

**Benefit:** Your existing JwtAuthGuard works without changes!

---

## Full Frontend Hook Example (with Token)

Here's the complete `useLocationData` hook with token support:

```typescript
// src/hooks/useLocationData.ts
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export interface Location {
  id: number;
  location_name: string;
  status: string;
}

export const useLocationData = (initialData?: Location[]) => {
  const [locations, setLocations] = useState<Location[]>(initialData || []);
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Get token from your auth storage
    const token = localStorage.getItem("access_token");

    if (!token) {
      console.warn("No token found, SSE connection requires authentication");
      return;
    }

    // Add token as query parameter
    const eventSourceUrl = `/sse/broadcast?token=${encodeURIComponent(token)}`;

    const eventSource = new EventSource(eventSourceUrl);

    eventSource.addEventListener("open", () => {
      console.log("✅ SSE Connected");
      setIsConnected(true);
    });

    eventSource.addEventListener("message", (event) => {
      try {
        const sseEvent = JSON.parse(event.data);

        if (sseEvent.resource !== "locations") return;

        console.log("📨 Location Update:", sseEvent.type);

        if (sseEvent.type === "CREATE") {
          setLocations((prev) => [...prev, sseEvent.data]);
        } else if (sseEvent.type === "UPDATE") {
          setLocations((prev) =>
            prev.map((loc) =>
              loc.id === sseEvent.resourceId ? sseEvent.data : loc
            )
          );
        } else if (sseEvent.type === "DELETE") {
          setLocations((prev) =>
            prev.filter((loc) => loc.id !== sseEvent.resourceId)
          );
        }
      } catch (error) {
        console.error("Error parsing SSE:", error);
      }
    });

    eventSource.addEventListener("error", () => {
      console.warn("SSE Connection lost");
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

---

## Full useSSEBroadcast Hook Example (with Token + Retry)

If you're using Approach 2 with React Query:

```typescript
// src/hooks/useSSEBroadcast.ts
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface SSEBroadcastOptions {
  baseUrl?: string;
  maxRetries?: number;
  initialRetryDelay?: number;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useSSEBroadcast(options: SSEBroadcastOptions = {}) {
  const {
    baseUrl = process.env.REACT_APP_API_URL || "http://localhost:3000",
    maxRetries = 5,
    initialRetryDelay = 3000,
    onError,
    onConnect,
    onDisconnect,
  } = options;

  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef<number>(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const connectToSSE = () => {
      try {
        // Get token from storage
        const token = localStorage.getItem("access_token");

        if (!token) {
          const error = new Error("No authentication token found");
          onError?.(error);
          return;
        }

        // Build URL with token
        const eventSourceUrl = `${baseUrl}/sse/broadcast?token=${encodeURIComponent(token)}`;

        eventSourceRef.current = new EventSource(eventSourceUrl);

        eventSourceRef.current.onmessage = (event) => {
          try {
            const sseEvent = JSON.parse(event.data);
            handleSSEEvent(sseEvent);
            retryCountRef.current = 0; // Reset retry count
          } catch (parseError) {
            console.error("Failed to parse SSE event:", parseError);
          }
        };

        eventSourceRef.current.onerror = (error) => {
          console.error("SSE connection error:", error);
          eventSourceRef.current?.close();

          if (retryCountRef.current < maxRetries) {
            const delay =
              initialRetryDelay * Math.pow(1.5, retryCountRef.current);
            console.log(
              `Reconnecting (${retryCountRef.current + 1}/${maxRetries}) in ${delay}ms...`
            );

            retryTimeoutRef.current = setTimeout(() => {
              retryCountRef.current++;
              connectToSSE();
            }, delay);
          } else {
            const maxRetriesError = new Error(
              `SSE connection failed after ${maxRetries} retries`
            );
            onError?.(maxRetriesError);
          }

          onDisconnect?.();
        };

        onConnect?.();
        console.log(`SSE broadcast connected at ${eventSourceUrl}`);
      } catch (error) {
        const connectError =
          error instanceof Error ? error : new Error(String(error));
        onError?.(connectError);
      }
    };

    connectToSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [
    baseUrl,
    maxRetries,
    initialRetryDelay,
    onError,
    onConnect,
    onDisconnect,
  ]);

  const handleSSEEvent = (event: any) => {
    const { type, resource, resourceId, data } = event;

    switch (type) {
      case "UPDATE":
        handleUpdateEvent(resource, resourceId, data);
        break;
      case "CREATE":
        handleCreateEvent(resource, resourceId, data);
        break;
      case "DELETE":
        handleDeleteEvent(resource, resourceId);
        break;
      case "INVALIDATE":
        handleInvalidateEvent(resource);
        break;
    }
  };

  const handleUpdateEvent = (
    resource: string,
    resourceId?: number,
    data?: any
  ) => {
    try {
      if (resourceId) {
        queryClient.setQueryData([resource, resourceId], (oldData) => {
          if (oldData) {
            return { ...oldData, ...data };
          }
          return oldData;
        });
      }
      queryClient.invalidateQueries({
        queryKey: [resource],
        refetchType: "active",
      });
    } catch (error) {
      console.error(`Failed to handle UPDATE event for ${resource}:`, error);
    }
  };

  const handleCreateEvent = (
    resource: string,
    resourceId?: number,
    data?: any
  ) => {
    try {
      queryClient.invalidateQueries({
        queryKey: [resource],
        refetchType: "active",
      });
    } catch (error) {
      console.error(`Failed to handle CREATE event for ${resource}:`, error);
    }
  };

  const handleDeleteEvent = (resource: string, resourceId?: number) => {
    try {
      if (resourceId) {
        queryClient.removeQueries({ queryKey: [resource, resourceId] });
      }
      queryClient.invalidateQueries({
        queryKey: [resource],
        refetchType: "active",
      });
    } catch (error) {
      console.error(`Failed to handle DELETE event for ${resource}:`, error);
    }
  };

  const handleInvalidateEvent = (resource: string) => {
    try {
      queryClient.invalidateQueries({
        queryKey: [resource],
        refetchType: "all",
      });
    } catch (error) {
      console.error(
        `Failed to handle INVALIDATE event for ${resource}:`,
        error
      );
    }
  };
}

export function useSSE() {
  return useSSEBroadcast();
}
```

---

## Frontend Implementation (Choose One)

### If Using Approach 1 (Pure SSE):

**src/hooks/useLocationData.ts** (See full example above)

### If Using Approach 2 (SSE + React Query):

**src/hooks/useSSEBroadcast.ts** (See full example above)

Then in your **src/App.tsx**:

```typescript
import { useSSE } from '@/hooks/useSSEBroadcast';

export default function App() {
  useSSE(); // Connects with token automatically
  return <AppRoutes />;
}
```

---

## Backend Implementation (Choose One)

### Option 1: Simple Query Parameter (No Backend Changes)

Just update your frontend to add `?token=...` to the URL. Your existing JwtAuthGuard will need to be configured to read from query params, which might require middleware.

### Option 2: Middleware (Recommended - Cleanest)

Add the SSEJwtMiddleware to convert query param to Authorization header. This works with your existing JwtAuthGuard without changes.

**Steps:**

1. Create `src/middleware/sse-jwt.middleware.ts` (code above)
2. Add to `app.module.ts` (code above)
3. Frontend just adds `?token=...` to URL
4. Middleware handles the rest!

---

## Token Storage Options

Depending on how you store your token:

```typescript
// Option 1: localStorage
const token = localStorage.getItem("access_token");

// Option 2: sessionStorage
const token = sessionStorage.getItem("access_token");

// Option 3: From Redux/Zustand state
const token = useSelector((state) => state.auth.token);
const token = useAuthStore((state) => state.token);

// Option 4: From Context
const { token } = useAuth();

// Then use:
const eventSourceUrl = `/sse/broadcast?token=${encodeURIComponent(token)}`;
```

---

## Security Considerations

### ⚠️ Token in URL (Current Approach)

- **Pros:** Simple, works with EventSource
- **Cons:** Token visible in logs, history, browser dev tools
- **Risk:** Medium (depends on token expiration)

### ✅ Solutions

1. **Use short-lived tokens** for SSE (expiring in 15-30 min)
2. **Use HTTPS only** (token is encrypted in transit)
3. **Secure cookies** as alternative:

   ```typescript
   // If using secure HTTP-only cookies:
   const eventSource = new EventSource("/sse/broadcast", {
     withCredentials: true,
   });
   ```

4. **Refresh token before expiry:**
   ```typescript
   useEffect(() => {
     const token = localStorage.getItem("access_token");
     const refreshToken = async () => {
       const newToken = await refreshAccessToken();
       // Reconnect EventSource with new token
     };

     // Refresh every 10 minutes
     const interval = setInterval(refreshToken, 10 * 60 * 1000);
     return () => clearInterval(interval);
   }, []);
   ```

---

## Summary

| Aspect            | Approach 1 (Query Param)      | Approach 2 (Middleware)        |
| ----------------- | ----------------------------- | ------------------------------ |
| **Frontend**      | Add `?token=...` to URL       | Add `?token=...` to URL        |
| **Backend**       | Update SSEController `@Query` | Add SSEJwtMiddleware           |
| **Existing code** | Needs changes                 | No changes needed              |
| **Security**      | Simple                        | Better (moves token to header) |
| **Complexity**    | Low                           | Medium                         |

**Recommended:** Use **Approach 2 (Middleware)** for best security and cleanest integration.

---

## Implementation Checklist

- [ ] Get token from storage in frontend hook
- [ ] Add token to EventSource URL: `?token=${encodeURIComponent(token)}`
- [ ] Choose: Query param or Middleware approach
- [ ] If Middleware: Create `sse-jwt.middleware.ts`
- [ ] If Middleware: Update `app.module.ts`
- [ ] Test: Open 2 browsers, verify token is sent
- [ ] Test: Verify SSE connects and receives events
- [ ] Optional: Implement token refresh logic

Done! Your EventSource will now be authenticated with your JWT token!
