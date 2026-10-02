import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from './supabaseClient';

export default function useResponderResponses() {
  const { user, isResponder } = useAuth();
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user || !isResponder || !supabase) {
      setResponses([]);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);

    const loadResponses = async () => {
      const { data, error: responseError } = await supabase.rpc('get_responder_safety_responses');
      if (!active) return;
      setResponses(data || []);
      setError(responseError?.message || null);
      setLoading(false);
    };

    loadResponses();
    const channel = supabase
      .channel('responder-safety-responses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_requests' }, loadResponses)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resident_safety_status' }, loadResponses)
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [user?.id, isResponder]);

  return { responses, loading, error };
}