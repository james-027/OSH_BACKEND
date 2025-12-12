/**
 * REACT FRONTEND HOOK - useSSESubscription
 * 
 * This file should be created in your React frontend project at:
 * src/hooks/useSSESubscription.ts
 * 
 * Copy the code below to your React project
 */

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * SSE Event types (must match backend)
 */
export type SSEEventType = "UPDATE" | "CREATE" | "DELETE" | "INVALIDATE";

export interface SSEEvent {
  type: SSEEventType;
  resource: string;
  resourceId?: number;
  data?: any;
  timestamp: string;
  userId?: number;
}

interface UseSSESubscriptionOptions {
  userId: number;
  baseUrl?: string;
  onEvent?: (event: SSEEvent) => void;
  onError?: (error: Error) => void;
  autoReconnect?: boolean;
  maxRetries?: number;
  reconnectDelay?: number;
}

/**
 * Hook to subscribe to SSE events and automatically update React Query cache
 * 
 * USAGE:
 * ------
 * In your React component:
 * 
 * ```jsx
 * import { useSSEUpdates } from '@/hooks/useSSESubscription';
 * 
 * function MyComponent() {
 *   const { user } = useAuth(); // or however you get current user
 *   
 *   // Subscribe to SSE updates
 *   useSSEUpdates(user.id, 'http://localhost:3000');
 *   
 *   // Your React Query queries will automatically update when SSE events arrive
 *   const { data: users } = useQuery({
 *     queryKey: ['users', user.id],
 *     queryFn: () => api.get(`/users/nested-per-access-key/${user.id}`),
 *   });
 *   
 *   return <div>{/* Your UI */}</div>;
 * }
 * ```
 */
export const useSSESubscription = ({
  userId,
  baseUrl = process.env.REACT_APP_API_URL || "http://localhost:3000",
  onEvent,
  onError,
  autoReconnect = true,
  maxRetries = 5,
  reconnectDelay = 3000,
}: UseSSESubscriptionOptions) => {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSSEEvent = useCallback(
    (event: MessageEvent) => {
      try {
        const parsedEvent: SSEEvent = JSON.parse(event.data);

        // Call custom handler if provided
        if (onEvent) {
          onEvent(parsedEvent);
        }

        // Handle different event types
        switch (parsedEvent.type) {
          case "UPDATE":
            handleUpdateEvent(parsedEvent);
            break;
          case "CREATE":
            handleCreateEvent(parsedEvent);
            break;
          case "DELETE":
            handleDeleteEvent(parsedEvent);
            break;
          case "INVALIDATE":
            handleInvalidateEvent(parsedEvent);
            break;
        }
      } catch (error) {
        console.error("Failed to parse SSE event:", error);
      }
    },
    [onEvent]
  );

  const handleUpdateEvent = (event: SSEEvent) => {
    const { resource, resourceId, data } = event;

    // Update single resource
    if (resourceId) {
      queryClient.setQueryData([resource, resourceId], (oldData: any) => ({
        ...oldData,
        ...data,
      }));
    }

    // Also invalidate list queries for this resource to keep them fresh
    queryClient.invalidateQueries({
      queryKey: [resource],
      refetchType: "inactive",
    });
  };

  const handleCreateEvent = (event: SSEEvent) => {
    const { resource } = event;

    // Invalidate list queries so new item appears
    queryClient.invalidateQueries({
      queryKey: [resource],
      refetchType: "inactive",
    });
  };

  const handleDeleteEvent = (event: SSEEvent) => {
    const { resource, resourceId } = event;

    // Remove from single query cache
    if (resourceId) {
      queryClient.removeQueries({
        queryKey: [resource, resourceId],
      });
    }

    // Invalidate list queries
    queryClient.invalidateQueries({
      queryKey: [resource],
      refetchType: "inactive",
    });
  };

  const handleInvalidateEvent = (event: SSEEvent) => {
    const { resource } = event;

    // Force refetch of all queries for this resource
    queryClient.invalidateQueries({
      queryKey: [resource],
      refetchType: "all",
    });
  };

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      return; // Already connected
    }

    const eventSourceUrl = `${baseUrl}/sse/users/${userId}`;

    try {
      const eventSource = new EventSource(eventSourceUrl, {
        withCredentials: true, // Send cookies with request
      });

      eventSource.addEventListener("message", handleSSEEvent);

      eventSource.addEventListener("error", (event: Event) => {
        console.error("SSE connection error:", event);

        if (eventSource.readyState === EventSource.CLOSED) {
          // Connection failed
          if (autoReconnect && retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            console.log(
              `Attempting to reconnect (${retryCountRef.current}/${maxRetries})...`
            );

            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, reconnectDelay * retryCountRef.current); // Exponential backoff
          } else {
            const error = new Error(
              "SSE connection failed: max retries exceeded"
            );
            if (onError) {
              onError(error);
            }
          }
        }
      });

      eventSource.addEventListener("open", () => {
        console.log(`SSE connected for user ${userId}`);
        retryCountRef.current = 0; // Reset retry count on successful connection
      });

      eventSourceRef.current = eventSource;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Failed to create EventSource:", err);
      if (onError) {
        onError(err);
      }
    }
  }, [userId, baseUrl, handleSSEEvent, autoReconnect, maxRetries, reconnectDelay, onError]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [userId]); // Reconnect if userId changes

  return { connect, disconnect };
};

/**
 * Simplified hook for basic SSE functionality
 */
export const useSSEUpdates = (userId: number, baseUrl?: string) => {
  return useSSESubscription({
    userId,
    baseUrl,
  });
};
