// Supabase Realtime subscriptions (client-side).
// env가 비어있으면 no-op을 반환해 호출 측에서 폴링 fallback으로 자연스럽게 전환.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from './supabase';

export { isSupabaseConfigured };

export function subscribeToHospitalDispatches(
  hospitalId: string,
  onChange: () => void,
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};

  const channel: RealtimeChannel = sb
    .channel(`dispatches:hospital:${hospitalId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'goldenlink',
        table: 'dispatches',
        filter: `hospital_id=eq.${hospitalId}`,
      },
      onChange,
    )
    .subscribe();

  return () => {
    sb.removeChannel(channel);
  };
}

export function subscribeToDispatch(
  dispatchId: string,
  onChange: () => void,
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};

  const channel: RealtimeChannel = sb
    .channel(`dispatch:${dispatchId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'goldenlink',
        table: 'dispatches',
        filter: `id=eq.${dispatchId}`,
      },
      onChange,
    )
    .subscribe();

  return () => {
    sb.removeChannel(channel);
  };
}
