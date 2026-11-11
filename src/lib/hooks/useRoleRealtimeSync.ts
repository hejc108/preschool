'use client';

import { useEffect, useRef } from 'react';
import { getBrowserSupabaseClient, syncRealtimeAuth } from '@/lib/supabase/client';

export interface RealtimeTableHandler {
  table: string;
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  filter?: string;
  match?: (payload: any) => boolean;
  onEvent: (payload: any) => void;
}

/**
 * Shared Supabase Realtime subscription hook scoped to an active portal role.
 * - Resolves runtime browser Supabase anon keys cleanly via getBrowserSupabaseClient()
 * - Synchronizes the WebSocket auth JWT with /api/auth/realtime-token (active_role claim)
 * - Runs synchronous payload filtering before optional debouncing
 */
export function useRoleRealtimeSync(params: {
  channelName: string | null;
  enabled: boolean;
  handlers: RealtimeTableHandler[];
  debounceMs?: number;
}) {
  const handlersRef = useRef<RealtimeTableHandler[]>(params.handlers);
  handlersRef.current = params.handlers;

  const tablesSignature = params.handlers
    .map((h) => `${h.table}:${h.event || '*'}:${h.filter || ''}`)
    .join('|');

  useEffect(() => {
    if (!params.enabled || !params.channelName || !tablesSignature) return;

    let cancelled = false;
    let activeClient: Awaited<ReturnType<typeof getBrowserSupabaseClient>> | null = null;
    let activeChannel: any = null;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const setup = async () => {
      const client = await getBrowserSupabaseClient();
      if (cancelled) return;
      activeClient = client;
      await syncRealtimeAuth(client);
      if (cancelled) return;

      let channel = client.channel(params.channelName!);
      handlersRef.current.forEach((handler, idx) => {
        const config: Record<string, any> = {
          event: handler.event || '*',
          schema: 'public',
          table: handler.table,
        };
        if (handler.filter) {
          config.filter = handler.filter;
        }
        channel = channel.on('postgres_changes', config as any, (payload: any) => {
          const currentHandler = handlersRef.current[idx];
          if (!currentHandler) return;
          if (currentHandler.match && !currentHandler.match(payload)) {
            return;
          }

          const delay = params.debounceMs ?? 200;
          if (delay <= 0) {
            currentHandler.onEvent(payload);
            return;
          }

          const debounceKey = `${idx}:${handler.table}`;
          const prevTimer = timers.get(debounceKey);
          if (prevTimer) clearTimeout(prevTimer);

          timers.set(
            debounceKey,
            setTimeout(() => {
              timers.delete(debounceKey);
              handlersRef.current[idx]?.onEvent(payload);
            }, delay)
          );
        });
      });

      activeChannel = channel.subscribe();
    };

    void setup();

    return () => {
      cancelled = true;
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      try {
        if (activeClient && activeChannel) {
          activeClient.removeChannel(activeChannel);
        }
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [params.enabled, params.channelName, params.debounceMs, tablesSignature]);
}
