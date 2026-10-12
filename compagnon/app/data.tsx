import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../src/lib/supabase';
import { GRADIENT, glass } from '../src/theme';

type Memory = { id: number; content: string };

export default function Data() {
  const router = useRouter();
  const [memories, setMemories] = useState<Memory[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('memories').select('id,content').order('created_at', { ascending: false });
    setMemories((data as Memory[]) ?? []);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const del = async (id: number) => {
    await supabase.from('memories').delete().eq('id', id);
    load();
  };

  const clearChat = () =>
    Alert.alert('Effacer la conversation ?', 'Tous les messages seront supprimés.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Effacer', style: 'destructive', onPress: async () => { await supabase.from('messages').delete().gt('id', 0); } },
    ]);

  const clearMemories = () =>
    Alert.alert('Tout oublier ?', 'Tout ce que le compagnon a retenu sur toi sera supprimé.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Tout oublier', style: 'destructive', onPress: async () => { await supabase.from('memories').delete().gt('id', 0); load(); } },
    ]);

  const exportAll = async () => {
    const [p, m, k] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('messages').select('role,content,created_at').order('created_at'),
      supabase.from('memories').select('content,created_at').order('created_at'),
    ]);
    await Share.share({ message: JSON.stringify({ profil: p.data, messages: m.data, memoire: k.data }, null, 2) });
  };

  return (
    <LinearGradient colors={GRADIENT} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
          <Pressable onPress={() => router.back()}>
            <Text style={s.back}>‹ Retour</Text>
          </Pressable>
          <Text style={s.title}>Mes données</Text>

          <Text style={s.label}>Ce que je retiens sur toi</Text>
          {memories.length === 0 && <Text style={s.note}>Rien pour l'instant.</Text>}
          {memories.map((m) => (
            <View key={m.id} style={s.card}>
              <Text style={s.txt}>{m.content}</Text>
              <Pressable onPress={() => del(m.id)}>
                <Text style={{ fontSize: 20 }}>🗑</Text>
              </Pressable>
            </View>
          ))}

          <Pressable onPress={clearMemories} style={s.btn}><Text style={s.btnTxt}>Tout oublier</Text></Pressable>
          <Pressable onPress={clearChat} style={s.btn}><Text style={s.btnTxt}>Effacer la conversation</Text></Pressable>
          <Pressable onPress={exportAll} style={s.btn}><Text style={s.btnTxt}>Exporter mes données</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  back: { color: '#fff', fontSize: 17 },
  title: { color: '#fff', fontSize: 30, fontWeight: '800' },
  label: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 8 },
  note: { color: '#fffc' },
  card: { ...glass, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, gap: 12 },
  txt: { color: '#fff', flex: 1, fontSize: 15 },
  btn: { ...glass, alignItems: 'center', padding: 14 },
  btnTxt: { color: '#fff', fontWeight: '700' },
});
