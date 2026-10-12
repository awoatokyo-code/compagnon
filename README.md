# Compagnon — étape 1 (Axo, chat, voix et écrit)

## 1. Supabase (une fois, tout dans le navigateur)
1. supabase.com > New project.
2. **SQL Editor** : colle `supabase/schema.sql` > Run.
3. **Authentication > Sign In / Providers** : active *Anonymous sign-ins*.
4. **Edge Functions > Secrets** : ajoute `ANTHROPIC_API_KEY` et `OPENAI_API_KEY`.
5. **Edge Functions > Deploy a new function > Via Editor** : nom `chat`, colle `supabase/functions/chat/index.ts`, Deploy. Pareil avec `tts`.
6. **Project Settings > API** : copie l'URL et la clé `anon` dans `.env` de l'appli.

## 2. L'appli
```
npx create-expo-app@latest compagnon
cd compagnon
npm run reset-project        # vide le modèle (réponds "non" pour garder/supprimer l'exemple)
```
Puis copie dans le projet : `app/`, `src/`, `assets/axo/`, `app.json`, `eas.json`, et crée `.env` d'après `.env.example`. Ensuite :
```
npx expo install expo-linear-gradient expo-haptics expo-audio expo-file-system \
  expo-speech-recognition react-native-reanimated @react-native-async-storage/async-storage \
  react-native-url-polyfill @supabase/supabase-js
```

## 3. Tester
- **Mode écrit** : `npx expo start` + Expo Go (le micro n'y marche pas).
- **Voix complète** : build de développement.
  - Android (gratuit) : `npx eas-cli build --profile development --platform android` puis installe l'APK, puis `npx expo start --dev-client`.
  - iPhone : même chose avec `--platform ios` (compte Apple Developer, 99 €/an, obligatoire).

## Pas encore fait (étapes suivantes)
Contacts/agenda/rappels et actions (2), gyroscope (4), apparition Android (5), widgets iPhone (6), abonnement RevenueCat et suppression complète du compte (7). Seul Axo existe pour l'instant : les 7 autres personnages arrivent quand tu auras leurs PNG.
