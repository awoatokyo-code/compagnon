import { useCallback, useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { getSpeech } from '../lib/api';

/* ---------- Reconnaissance vocale (nécessite un build de développement) ---------- */
let Mod: any = null;
let useEvt: any = () => {};
try {
  // Absent dans Expo Go : l'appli reste utilisable en mode écrit
  const m = require('expo-speech-recognition');
  Mod = m.ExpoSpeechRecognitionModule;
  useEvt = m.useSpeechRecognitionEvent;
} catch {}

export const sttAvailable = !!Mod;

export function useListener(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEvt('result', (e: any) => {
    const t: string = e?.results?.[0]?.transcript ?? '';
    setPartial(t);
    if (e?.isFinal && t) cb.current(t);
  });
  useEvt('end', () => {
    setListening(false);
    setPartial('');
  });
  useEvt('error', () => setListening(false));

  const start = useCallback(async () => {
    if (!Mod) return false;
    const perm = await Mod.requestPermissionsAsync();
    if (!perm.granted) return false;
    Mod.start({ lang: 'fr-FR', interimResults: true, continuous: false });
    setListening(true);
    return true;
  }, []);

  const stop = useCallback(() => Mod?.stop(), []);
  return { listening, partial, start, stop };
}

/* ---------- Voix du compagnon (TTS neuronal via edge function) ---------- */
export function useSpeaker() {
  const [speaking, setSpeaking] = useState(false);
  const player = useRef<any>(null);

  const stop = useCallback(() => {
    try {
      player.current?.remove();
    } catch {}
    player.current = null;
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      stop();
      try {
        const { audio } = await getSpeech(text);
        const uri = FileSystem.cacheDirectory + 'tts-' + Date.now() + '.mp3';
        await FileSystem.writeAsStringAsync(uri, audio, { encoding: FileSystem.EncodingType.Base64 });
        await setAudioModeAsync({ playsInSilentMode: true });
        const p = createAudioPlayer({ uri });
        player.current = p;
        p.addListener('playbackStatusUpdate', (st: any) => {
          if (st.didJustFinish) {
            setSpeaking(false);
            try {
              p.remove();
            } catch {}
            FileSystem.deleteAsync(uri, { idempotent: true });
          }
        });
        setSpeaking(true);
        p.play();
      } catch {
        setSpeaking(false);
      }
    },
    [stop],
  );

  useEffect(() => stop, [stop]);
  return { speak, stop, speaking };
}
