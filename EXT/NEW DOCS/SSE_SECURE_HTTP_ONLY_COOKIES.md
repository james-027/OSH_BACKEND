# SSE with HTTP-Only Cookies: Complete Implementation Guide

## Overview

This guide shows how to use EventSource with secure HTTP-only cookies instead of query parameters, leveraging your existing axios config.

---

## Architecture

```
Frontend (EventSource)
  ↓
withCredentials: true
  ↓
Browser auto-sends access_token cookie
  ↓
Backend receives in request headers
  ↓
JWT middleware extracts from cookies
  ↓
JwtAuthGuard validates
  ↓
Stream broadcast events
```

---

## Part 1: Backend Setup

### Option 1: HTTP-Only Cookies on Login (Best Practice)

Your auth service should set HTTP-only cookies when user logs in:

**File: `src/services/auth.service.ts`** (Example - adjust to your code)

```typescript
import { Injectable } from "@nestjs/common";
import { Response } from "express";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(user: any, res: Response) {
    const accessToken = this.jwtService.sign(
      { id: user.id, email: user.email },
      { expiresIn: "15m" } // Short-lived
    );

    const refreshToken = this.jwtService.sign(
      { id: user.id },
      { expiresIn: "7d" } // Long-lived
    );

    // Set HTTP-only cookies
    res.cookie("access_token", accessToken, {
      httpOnly: true, // ✅ Can't be accessed by JavaScript
      secure: true, // ✅ HTTPS only (set to false for localhost dev)
      sameSite: "strict", // ✅ CSRF protection
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: "/",
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: true, // ✅ HTTPS only
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    return { message: "Logged in successfully" };
  }

  async refresh(req: any, res: Response) {
    const refreshToken = req.cookies.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException("No refresh token");
    }

    try {
      const payload = this.jwtService.verify(refreshToken);

      const newAccessToken = this.jwtService.sign(
        { id: payload.id, email: payload.email },
        { expiresIn: "15m" }
      );

      // Update access_token cookie
      res.cookie("access_token", newAccessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 15 * 60 * 1000,
        path: "/",
      });

      return { message: "Token refreshed" };
    } catch (error) {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }
}
```

### Option 2: Update Middleware for HTTP-Only Cookies

**File: `src/middleware/sse-jwt.middleware.ts`**

This middleware checks cookies FIRST, then falls back to query param:

```typescript
import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

@Injectable()
export class SSEJwtMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Priority 1: HTTP-Only Cookie (Recommended)
    const cookieAccessToken = req.cookies?.access_token;

    if (cookieAccessToken) {
      // Move cookie token to Authorization header
      req.headers.authorization = `Bearer ${cookieAccessToken}`;
      return next();
    }

    // Priority 2: Query Parameter (Fallback for testing/mobile)
    if (req.query.token && typeof req.query.token === "string") {
      req.headers.authorization = `Bearer ${req.query.token}`;
      return next();
    }

    // No token found, let JwtAuthGuard handle the error
    next();
  }
}
```

### Option 3: Update App Module

**File: `src/app.module.ts`**

```typescript
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import { SSEJwtMiddleware } from "./middleware/sse-jwt.middleware";
import * as cookieParser from "cookie-parser"; // Add this import

@Module({
  imports: [
    // ... other imports
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Parse cookies first
    consumer.apply(cookieParser()).forRoutes("*");

    // Then apply SSE JWT middleware
    consumer
      .apply(SSEJwtMiddleware)
      .forRoutes({ path: "sse/*", method: RequestMethod.GET });
  }
}
```

### Option 4: Update SSE Controller (No Changes Needed)

Your existing controller works as-is! The middleware handles token extraction:

```typescript
@Controller("sse")
@UseGuards(JwtAuthGuard)
export class SSEController {
  // Existing code - NO CHANGES
  @Sse("broadcast")
  subscribeToEvents(@Request() req): Observable<any> {
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
}
```

**That's it for backend!** Your JWT auth guard will validate the token extracted from cookies by the middleware.

---

## Part 2: Frontend Implementation

### Step 1: EventSource Hook with HTTP-Only Cookies

**File: `src/hooks/useSSEWithCookies.ts`**

```typescript
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface SSEOptions {
  baseUrl?: string;
  maxRetries?: number;
  initialRetryDelay?: number;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useSSEWithCookies(options: SSEOptions = {}) {
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
        // ✅ Key: withCredentials: true sends cookies automatically
        eventSourceRef.current = new EventSource(
          `${baseUrl}/sse/broadcast`,
          { withCredentials: true } // This sends HTTP-only cookies
        );

        eventSourceRef.current.onmessage = (event) => {
          try {
            const sseEvent = JSON.parse(event.data);
            handleSSEEvent(sseEvent);
            retryCountRef.current = 0; // Reset retry count on success
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
        console.log(`✅ SSE connected with HTTP-only cookies`);
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
        queryClient.removeQueries({
          queryKey: [resource, resourceId],
        });
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
  return useSSEWithCookies();
}
```

### Step 2: Use in App Component

**File: `src/App.tsx`**

```typescript
import { useSSE } from '@/hooks/useSSEWithCookies';

export default function App() {
  // Setup SSE with HTTP-only cookies (one line!)
  useSSE();

  return (
    <AppRoutes />
  );
}
```

**That's it!** Your axios config already has `withCredentials: true`, so cookies are automatically sent with EventSource.

### Step 3: Verify in DevTools

1. Open your app in browser
2. Open DevTools → Application → Cookies
3. Look for `access_token` and `refresh_token` cookies
4. Check that they have `HttpOnly` flag ✅
5. Open DevTools → Network → Filter "sse"
6. See SSE connection being made
7. Check request headers → Should include `Cookie: access_token=...`

---

## How HTTP-Only Cookies Work

### Login Flow

```
User clicks Login
  ↓
POST /auth/login with credentials
  ↓
Backend validates
  ↓
Backend sets HTTP-only cookies in response
  ↓
Browser stores cookies (JavaScript CAN'T access)
  ↓
Browser ready to send cookies with future requests
```

### SSE Connection Flow

```
EventSource('/sse/broadcast', { withCredentials: true })
  ↓
Browser sees withCredentials: true
  ↓
Browser automatically adds Cookie header with access_token
  ↓
Backend receives request with Authorization header (from middleware)
  ↓
JwtAuthGuard validates token
  ↓
SSE stream established
```

### Token Refresh Flow

```
Token expires in 15 minutes
  ↓
Any request (including SSE) receives 401 Unauthorized
  ↓
Your axios interceptor catches 401
  ↓
Interceptor calls POST /auth/refresh with refresh_token cookie
  ↓
Backend validates refresh_token
  ↓
Backend sets new access_token cookie
  ↓
Axios retries original request with new access_token
  ↓
Request succeeds ✅
```

---

## Security Benefits

| Feature               | HTTP-Only Cookies         | Query Parameter            |
| --------------------- | ------------------------- | -------------------------- |
| **JavaScript access** | ❌ Can't be stolen by XSS | ✅ Can be stolen by XSS    |
| **URL visibility**    | ✅ Hidden                 | ❌ Visible in logs/history |
| **CSRF protection**   | ✅ SameSite flag          | ⚠️ Vulnerable              |
| **Mobile support**    | ✅ Works                  | ✅ Works                   |
| **Token refresh**     | ✅ Automatic              | ⚠️ Manual                  |
| **Browser standard**  | ✅ Best practice          | ⚠️ Workaround              |

**HTTP-Only Cookies are the secure standard for web apps!**

---

## Troubleshooting

### Problem: EventSource connects but gets 401

**Solution:**

1. Check if cookies are being sent (DevTools → Network → Request Headers)
2. Verify middleware is loading: Add `console.log` in SSEJwtMiddleware
3. Check JwtAuthGuard validates correctly

### Problem: Cookies not being set

**Solution:**

1. Verify auth endpoint sets cookies with `res.cookie()`
2. Check `secure: false` if using localhost HTTP (not HTTPS)
3. Check `sameSite: 'none'` if frontend is different domain

### Problem: Token not refreshing

**Solution:**

1. Check axios response interceptor catches 401
2. Verify refresh endpoint exists and works
3. Check refresh_token cookie is valid

### Problem: CORS errors

**Solution:**

1. Backend must have `credentials: 'include'` in CORS config
2. Frontend must have `withCredentials: true`
3. Both must be set for cookies to work!

**Example backend CORS:**

```typescript
app.enableCors({
  origin: process.env.FRONTEND_URL,
  credentials: true, // ✅ Essential for cookies
});
```

---

## Development vs Production

### Development (Localhost)

```typescript
res.cookie("access_token", token, {
  httpOnly: true,
  secure: false, // ❌ false for HTTP (localhost)
  sameSite: "lax", // Can be 'lax' for dev
  maxAge: 15 * 60 * 1000,
});
```

### Production (HTTPS)

```typescript
res.cookie("access_token", token, {
  httpOnly: true,
  secure: true, // ✅ true for HTTPS (production)
  sameSite: "strict", // Strict for security
  maxAge: 15 * 60 * 1000,
});
```

---

## Complete Flow Example

### 1. User Logs In

```
Frontend: POST /auth/login { email, password }
  ↓
Backend: Validates credentials
  ↓
Backend: Sets access_token and refresh_token cookies
  ↓
Frontend: Redirects to dashboard
```

### 2. User Navigates to Locations Page

```
Frontend: useSSE() hook runs in App
  ↓
Frontend: EventSource('/sse/broadcast', { withCredentials: true })
  ↓
Browser: Auto-sends access_token cookie
  ↓
Backend: SSEJwtMiddleware extracts token
  ↓
Backend: JwtAuthGuard validates
  ↓
Backend: SSE stream established
  ↓
Frontend: Receives real-time location updates
```

### 3. Token Expires (15 minutes)

```
Frontend: Next location update comes
  ↓
Backend: 401 Token Expired error
  ↓
Frontend: axios interceptor catches 401
  ↓
Frontend: POST /auth/refresh with refresh_token cookie
  ↓
Backend: Validates refresh_token
  ↓
Backend: Sets new access_token cookie
  ↓
Frontend: EventSource reconnects
  ↓
Backend: New access_token validates
  ↓
Frontend: Updates continue ✅
```

---

## Summary Checklist

### Backend Setup

- [ ] Create/update auth service to set HTTP-only cookies on login
- [ ] Create SSEJwtMiddleware to extract token from cookies (fallback to query param)
- [ ] Add cookieParser() middleware
- [ ] Apply SSEJwtMiddleware to SSE routes
- [ ] Verify CORS has `credentials: true`
- [ ] Verify SSE Controller uses JwtAuthGuard

### Frontend Setup

- [ ] Create useSSEWithCookies hook with `withCredentials: true`
- [ ] Call useSSE() once in App component
- [ ] Verify axios already has `withCredentials: true`
- [ ] Verify axios interceptors handle token refresh
- [ ] Test in DevTools → Application → Cookies (see HttpOnly flag)

### Testing

- [ ] Login and verify cookies are set
- [ ] Check DevTools → Network → sse request has Cookie header
- [ ] Receive real-time SSE events
- [ ] Wait for token expiry, verify auto-refresh
- [ ] Test in incognito (no cache interference)

---

## You're Done! 🎉

Your SSE implementation now uses secure HTTP-only cookies with automatic token refresh. The frontend hook is simple (just `useSSE()`), and your axios config handles everything automatically.

**Key points:**

- ✅ `withCredentials: true` sends cookies automatically
- ✅ Middleware extracts token from cookies
- ✅ Query param fallback still works (for testing)
- ✅ Token refresh happens automatically
- ✅ No manual token management needed
- ✅ Secure (XSS-proof, CSRF-protected)
