/**
 * Updated React Hook for Pure Broadcast SSE
 *
 * This hook connects to the broadcast SSE endpoint
 * All users receive all events, React Query smartly filters by resource type
 *
 * Usage:
 * ------
 * In your AppLayout or root component:
 *
 * function AppLayout() {
 *   // Setup SSE broadcast listener (once at app level)
 *   useSSEBroadcast();
 *
 *   return <Outlet />;
 * }
 *
 * Or simplified:
 *
 * import { useSSEBroadcast } from '@/hooks/useSSEBroadcast';
 *
 * export default function App() {
 *   useSSEBroadcast(); // Enable real-time updates
 *   return <AppRoutes />;
 * }
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * SSE Event from server
 */
interface SSEEvent {
  type: "UPDATE" | "CREATE" | "DELETE" | "INVALIDATE";
  resource: string;
  resourceId?: number;
  data?: any;
  timestamp: string;
}

/**
 * Configuration for SSE subscription
 */
interface SSEBroadcastOptions {
  baseUrl?: string;
  maxRetries?: number;
  initialRetryDelay?: number; // ms
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * useSSEBroadcast - Pure Broadcast Hook
 *
 * Connects to /sse/broadcast endpoint and listens for all events
 * React Query automatically handles cache updates based on resource type
 *
 * @param options - Configuration options
 *
 * @example
 * function AppLayout() {
 *   useSSEBroadcast({
 *     baseUrl: 'http://localhost:3000',
 *     onConnect: () => console.log('SSE connected'),
 *     onError: (err) => console.error('SSE error:', err)
 *   });
 *
 *   return <AppRoutes />;
 * }
 */
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
        const eventSourceUrl = `${baseUrl}/sse/broadcast`;

        // Use EventSource for server-sent events
        // withCredentials: true to send JWT cookie
        eventSourceRef.current = new EventSource(eventSourceUrl, {
          withCredentials: true,
        });

        eventSourceRef.current.onmessage = (event) => {
          try {
            const sseEvent: SSEEvent = JSON.parse(event.data);
            handleSSEEvent(sseEvent);
            retryCountRef.current = 0; // Reset retry count on successful message
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
              `Attempting to reconnect (${retryCountRef.current + 1}/${maxRetries}) in ${delay}ms...`
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

        // Connection established
        onConnect?.();
        console.log(`SSE broadcast connected at ${eventSourceUrl}`);
      } catch (error) {
        const connectError =
          error instanceof Error ? error : new Error(String(error));
        onError?.(connectError);
      }
    };

    connectToSSE();

    // Cleanup on unmount
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

  /**
   * Handle incoming SSE events
   * React Query automatically matches resource type to cached queries
   */
  const handleSSEEvent = (event: SSEEvent) => {
    const { type, resource, resourceId, data, timestamp } = event;

    console.log(
      `[SSE] ${type} event for ${resource}${
        resourceId ? `:${resourceId}` : ""
      } at ${timestamp}`
    );

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

      default:
        console.warn(`Unknown SSE event type: ${type}`);
    }
  };

  /**
   * UPDATE event: Merge data into existing cache entries
   *
   * Matches both:
   * - ['resource', resourceId] - Single item
   * - ['resource'] - List (invalidates to refetch)
   */
  const handleUpdateEvent = (
    resource: string,
    resourceId?: number,
    data?: any
  ) => {
    try {
      // Update single item: ['resource', resourceId]
      if (resourceId) {
        queryClient.setQueryData([resource, resourceId], (oldData) => {
          if (oldData) {
            return {
              ...oldData,
              ...data,
              updated_at: new Date().toISOString(),
            };
          }
          return oldData;
        });
      }

      // Invalidate list: ['resource'] to refetch updated list
      queryClient.invalidateQueries({
        queryKey: [resource],
        refetchType: "active", // Only refetch active queries
      });

      console.log(
        `[SSE] Updated cache for ${resource}${
          resourceId ? `:${resourceId}` : ":*"
        }`
      );
    } catch (error) {
      console.error(`Failed to handle UPDATE event for ${resource}:`, error);
    }
  };

  /**
   * CREATE event: Invalidate list to show new item
   *
   * Matches:
   * - ['resource'] - List query (refetches to include new item)
   */
  const handleCreateEvent = (
    resource: string,
    resourceId?: number,
    data?: any
  ) => {
    try {
      // Invalidate list to refetch and include new item
      queryClient.invalidateQueries({
        queryKey: [resource],
        refetchType: "active",
      });

      console.log(`[SSE] Invalidated list for ${resource} due to CREATE event`);
    } catch (error) {
      console.error(`Failed to handle CREATE event for ${resource}:`, error);
    }
  };

  /**
   * DELETE event: Remove from cache and invalidate list
   *
   * Matches:
   * - ['resource', resourceId] - Removes from cache
   * - ['resource'] - List query (refetches without deleted item)
   */
  const handleDeleteEvent = (resource: string, resourceId?: number) => {
    try {
      if (resourceId) {
        // Remove single item from cache
        queryClient.removeQueries({
          queryKey: [resource, resourceId],
        });

        console.log(`[SSE] Removed ${resource}:${resourceId} from cache`);
      }

      // Invalidate list to refetch without deleted item
      queryClient.invalidateQueries({
        queryKey: [resource],
        refetchType: "active",
      });

      console.log(`[SSE] Invalidated list for ${resource} due to DELETE event`);
    } catch (error) {
      console.error(`Failed to handle DELETE event for ${resource}:`, error);
    }
  };

  /**
   * INVALIDATE event: Force full refetch
   *
   * Use when update is complex and partial sync isn't reliable
   * Refetches ALL queries matching the resource, even inactive ones
   */
  const handleInvalidateEvent = (resource: string) => {
    try {
      queryClient.invalidateQueries({
        queryKey: [resource],
        refetchType: "all", // Refetch all, even inactive
      });

      console.log(
        `[SSE] Full invalidation for ${resource} - refetching all queries`
      );
    } catch (error) {
      console.error(
        `Failed to handle INVALIDATE event for ${resource}:`,
        error
      );
    }
  };
}

/**
 * Alternative simplified hook for common usage
 *
 * @example
 * import { useSSE } from '@/hooks/useSSEBroadcast';
 *
 * export default function App() {
 *   useSSE(); // That's it!
 *   return <AppRoutes />;
 * }
 */
export function useSSE() {
  return useSSEBroadcast();
}

export type { SSEEvent, SSEBroadcastOptions };
