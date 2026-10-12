import { supabase } from './supabase';

async function call<T>(fn: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    const status = (error as any)?.context?.status;
    if (status === 429) throw new Error('QUOTA');
    throw error;
  }
  return data as T;
}

export const sendChat = (message: string) =>
  call<{ reply: string; remaining: number | null }>('chat', { message });

export const getSpeech = (text: string) => call<{ audio: string }>('tts', { text });
