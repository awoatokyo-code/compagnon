import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Companion from '../src/components/Companion';
import { sendChat } from '../src/lib/api';
import { getProfile, Profile } from '../src/lib/session';
import { supabase } from '../src/lib/supabase';
import { sttAvailable, useListener, useSpeaker } from '../src/hooks/useVoice';
import { GRADIENT, glass } from '../src/theme';

type Msg = { id: string; role: 'user' | 'assistant'; content: string };

export default function Home() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [hopKey, setHopKey] = useState(0);
  const [happy, setHappy] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const { speak, stop, speaking } = useSpeaker();

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const p = await getProfile();
        if (!p) return router.replace('/onboarding');
        setProfile(p);
        const { data } = await supabase
          .from('messages')
          .select('id,role,content')
          .order('created_at', { ascending: false })
          .limit(20);
        setMsgs((data ?? []).reverse().map((m: any) => ({ ...m, id: String(m.id) })));
      })();
    }, []),
  );

  const joy = useCallback(() => {
    setHopKey((k) => k + 1);
    setHappy(true);
    setTimeout(() => setHappy(false), 900);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || thinking) return;
      stop();
      setInput('');
      setMsgs((m) => [...m, { id: 'u' + Date.now(), role: 'user', content: t }]);
      setThinking(true);
      let reply: string;
      let ok = true;
      try {
        reply = (await sendChat(t)).reply;
      } catch (e: any) {
        ok = false;
        reply =
          e?.message === 'QUOTA'
            ? "J'ai atteint ma limite de messages pour aujourd'hui. On se retrouve demain !"
            : "Oups, je n'arrive pas à te répondre. Réessaie dans un instant.";
      }
      setThinking(false);
      setMsgs((m) => [...m, { id: 'a' + Date.now(), role: 'assistant', content: reply }]);
      joy();
      if (ok && profile?.voice_mode === 'voice') speak(reply);
    },
    [thinking, profile, stop, speak, joy],
  );

  const { listening, partial, start, stop: stopListen } = useListener(send);

  const toggleMic = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (listening) return stopListen();
    stop();
    const ok = await start();
    if (!ok) Alert.alert('Micro', "Je n'ai pas accès au micro. Autorise-le dans les réglages du téléphone.");
  };

  const toggleMode = async () => {
    if (!profile) return;
    const voice_mode = profile.voice_mode === 'voice' ? 'text' : 'voice';
    if (voice_mode === 'text') stop();
    setProfile({ ...profile, voice_mode });
    await supabase.from('profiles').update({ voice_mode }).eq('id', profile.id);
  };

  if (!profile) return <LinearGradient colors={GRADIENT} style={{ flex: 1 }} />;

  const showMic = profile.voice_mode === 'voice' && sttAvailable;

  return (
    <LinearGradient colors={GRADIENT} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.header}>
            <Text style={s.name}>{profile.companion_name}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={toggleMode} style={s.pill}>
                <Text style={s.pillTxt}>{profile.voice_mode === 'voice' ? '🔊 Voix' : '⌨️ Écrit'}</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/data')} style={s.pill}>
                <Text style={s.pillTxt}>🔒 Mes données</Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              joy();
            }}
            style={{ alignItems: 'center', paddingVertical: 8 }}
          >
            <Companion width={width / 3} talking={speaking} thinking={thinking} happy={happy} hopKey={hopKey} />
          </Pressable>

          <ScrollView
            ref={scroll}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
          >
            {msgs.map((m) => (
              <View key={m.id} style={[s.bubble, m.role === 'user' ? s.me : s.bot]}>
                <Text style={s.txt}>{m.content}</Text>
              </View>
            ))}
            {thinking && (
              <View style={[s.bubble, s.bot]}>
                <Text style={s.txt}>…</Text>
              </View>
            )}
          </ScrollView>

          {showMic ? (
            <View style={s.bar}>
              <Text style={s.partial} numberOfLines={2}>
                {listening ? partial || 'Je t’écoute…' : 'Appuie pour parler'}
              </Text>
              <Pressable onPress={toggleMic} style={[s.mic, listening && { backgroundColor: '#ff5f7e' }]}>
                <Text style={{ fontSize: 28 }}>{listening ? '⏹' : '🎤'}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.bar}>
              <TextInput
                value={input}
                onChangeText={setInput}
                onSubmitEditing={() => send(input)}
                placeholder={`Écris à ${profile.companion_name}…`}
                placeholderTextColor="#fff9"
                returnKeyType="send"
                style={s.input}
              />
              <Pressable onPress={() => send(input)} style={s.send}>
                <Text style={{ fontSize: 20 }}>➤</Text>
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6 },
  name: { color: '#fff', fontSize: 26, fontWeight: '800' },
  pill: { ...glass, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  pillTxt: { color: '#fff', fontWeight: '600', fontSize: 13 },
  bubble: { ...glass, maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10 },
  me: { alignSelf: 'flex-end', backgroundColor: 'rgba(255,255,255,0.32)' },
  bot: { alignSelf: 'flex-start' },
  txt: { color: '#fff', fontSize: 16, lineHeight: 22 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  input: { ...glass, flex: 1, color: '#fff', fontSize: 16, paddingHorizontal: 16, paddingVertical: 12 },
  send: { ...glass, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  partial: { color: '#fff', flex: 1, fontSize: 16 },
  mic: { ...glass, width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.3)' },
});
