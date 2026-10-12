import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { getProfile } from '../src/lib/session';

export default function Index() {
  const [to, setTo] = useState<string | null>(null);
  useEffect(() => {
    getProfile()
      .then((p) => setTo(p ? '/home' : '/onboarding'))
      .catch(() => setTo('/onboarding'));
  }, []);
  if (!to)
    return (
      <View style={{ flex: 1, backgroundColor: '#3b2e7e', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  return <Redirect href={to as any} />;
}
