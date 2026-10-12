import { supabase } from './supabase';

export type Profile = {
  id: string;
  companion: string;
  companion_name: string;
  character: string;
  voice_mode: 'voice' | 'text';
  plan: 'free' | 'premium';
  consented_at: string | null;
};

export async function ensureSession(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: d, error } = await supabase.auth.signInAnonymously();
  if (error || !d.user) throw error ?? new Error('auth');
  return d.user.id;
}

export async function getProfile(): Promise<Profile | null> {
  const uid = await ensureSession();
  const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
  return data && data.consented_at ? (data as Profile) : null;
}
