import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Companion from '../src/components/Companion';
import { CHARACTERS, COMPANIONS } from '../src/lib/companions';
import { ensureSession } from '../src/lib/session';
import { supabase } from '../src/lib/supabase';
import { sttAvailable } from '../src/hooks/useVoice';
import { GRADIENT, glass } from '../src/theme';

export default function Onboarding() {
  const router = useRouter();
  const [companion, setCompanion] = useState('axo');
  const [name, setName] = useState('Axo');
  const [character, setCharacter] = useState('joyeux');
  const [mode, setMode] = useState<'voice' | 'text'>(sttAvailable ? 'voice' : 'text');
  const [age, setAge] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hopKey, setHopKey] = useState(0);

  const ready = age && consent && name.trim().length > 0 && !busy;

  const go = async () => {
    setBusy(true);
    try {
      const uid = await ensureSession();
      const { error } = await supabase.from('profiles').upsert({
        id: uid,
        companion,
        companion_name: name.trim().slice(0, 20),
        character,
        voice_mode: mode,
        age_confirmed: true,
        consented_at: new Date().toISOString(),
      });
      if (error) throw error;
      router.replace('/home');
    } catch {
      Alert.alert('Oups', "Impossible d'enregistrer. Vérifie ta connexion.");
    }
    setBusy(false);
  };

  const Chip = ({ label, on, onPress, disabled }: any) => (
    <Pressable
      onPress={() => {
        if (disabled) return;
        Haptics.selectionAsync();
        onPress();
      }}
      style={[s.chip, on && s.chipOn, disabled && { opacity: 0.4 }]}
    >
      <Text style={s.chipTxt}>{label}</Text>
    </Pressable>
  );

  const Check = ({ on, onPress, label }: any) => (
    <Pressable onPress={() => { Haptics.selectionAsync(); onPress(); }} style={s.check}>
      <Text style={s.box}>{on ? '☑' : '☐'}</Text>
      <Text style={s.checkTxt}>{label}</Text>
    </Pressable>
  );

  return (
    <LinearGradient colors={GRADIENT} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Text style={s.title}>Choisis ton compagnon</Text>

          <Pressable onPress={() => setHopKey((k) => k + 1)} style={{ alignItems: 'center' }}>
            <Companion width={150} hopKey={hopKey} />
          </Pressable>
          <Text style={s.note}>C'est une IA, pas un humain.</Text>

          <View style={s.row}>
            {COMPANIONS.map((c) => (
              <Chip
                key={c.id}
                label={c.available ? c.name : `${c.name} · bientôt`}
                on={companion === c.id}
                disabled={!c.available}
                onPress={() => { setCompanion(c.id); setName(c.name); }}
              />
            ))}
          </View>

          <Text style={s.label}>Son prénom</Text>
          <TextInput value={name} onChangeText={setName} maxLength={20} style={s.input} placeholderTextColor="#fff9" />

          <Text style={s.label}>Son caractère</Text>
          <View style={s.row}>
            {CHARACTERS.map((c) => (
              <Chip key={c.id} label={c.label} on={character === c.id} onPress={() => setCharacter(c.id)} />
            ))}
          </View>

          <Text style={s.label}>Comment tu lui parles ?</Text>
          <View style={s.row}>
            <Chip label="🎤 Voix" on={mode === 'voice'} onPress={() => setMode('voice')} />
            <Chip label="⌨️ Écrit" on={mode === 'text'} onPress={() => setMode('text')} />
          </View>
          {!sttAvailable && mode === 'voice' && (
            <Text style={s.note}>Le micro demande l'appli installée (pas Expo Go). Il répondra quand même à voix haute.</Text>
          )}
          <Text style={s.note}>Tu pourras changer à tout moment.</Text>

          <Check on={age} onPress={() => setAge(!age)} label="J'ai 15 ans ou plus." />
          <Check
            on={consent}
            onPress={() => setConsent(!consent)}
            label="J'accepte que mes messages soient traités par une IA (Anthropic) pour me répondre et enregistrés. Je peux tout voir, exporter et supprimer à tout moment."
          />

          <Pressable disabled={!ready} onPress={go} style={[s.cta, !ready && { opacity: 0.4 }]}>
            <Text style={s.ctaTxt}>{busy ? '…' : 'Commencer'}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  title: { color: '#fff', fontSize: 30, fontWeight: '800' },
  label: { color: '#fff', fontSize: 16, fontWeight: '700' },
  note: { color: '#fffc', fontSize: 13, textAlign: 'left' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { ...glass, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  chipOn: { backgroundColor: 'rgba(255,255,255,0.4)' },
  chipTxt: { color: '#fff', fontWeight: '600' },
  input: { ...glass, color: '#fff', fontSize: 18, padding: 14 },
  check: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  box: { color: '#fff', fontSize: 22 },
  checkTxt: { color: '#fff', flex: 1, fontSize: 14 },
  cta: { ...glass, backgroundColor: '#fff', alignItems: 'center', padding: 16, marginTop: 6 },
  ctaTxt: { color: '#3b2e7e', fontSize: 18, fontWeight: '800' },
});
