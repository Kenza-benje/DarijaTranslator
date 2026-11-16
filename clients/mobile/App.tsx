import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import { encode } from 'base-64';

const statusErrors: Record<number, string> = {
  400: 'The server rejected this text. Check your input and try again.',
  401: 'Authentication failed. Check your WildFly username and password.',
  403: 'Access denied. Your WildFly account needs permission to translate.',
  502: 'The translation service is unavailable. Try again later.',
  503: 'The translation service is busy or unavailable. Try again later.',
};

// Convert Unicode credentials to UTF-8 bytes before Base64 encoding.
function credentials(username: string, password: string) {
  return encode(encodeURIComponent(`${username}:${password}`).replace(/%([0-9A-F]{2})/g,
    (_, hex: string) => String.fromCharCode(parseInt(hex, 16))));
}

export default function App() {
  const [backend, setBackend] = useState('http://192.168.1.4:8080');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [text, setText] = useState('');
  const [translation, setTranslation] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  function clear() {
    active.current?.abort();
    active.current = null;
    setLoading(false);
    setText(''); setTranslation(''); setPassword(''); setError(''); setNotice('');
  }

  async function translate() {
    if (active.current) return;
    setError(''); setNotice('');
    if (!text.trim()) { setError('Enter some English text to translate.'); return; }
    if (!username || !password) { setError('Enter your WildFly username and password.'); return; }
    if (username.includes(':')) { setError('A Basic Authentication username cannot contain a colon.'); return; }
    let origin: string;
    try {
      const url = new URL(backend.trim());
      if (['localhost', '127.0.0.1', '[::1]', '0.0.0.0', '10.0.2.2'].includes(url.hostname.toLowerCase())) {
        setError('On iPhone, use your Windows computer’s LAN IPv4 address, such as http://192.168.1.4:8080.');
        return;
      }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
          url.search || url.hash || !['', '/'].includes(url.pathname)) throw new Error();
      origin = url.origin;
    } catch { setError('Enter a base URL such as http://192.168.1.4:8080, without an API path.'); return; }
    setTranslation(''); setLoading(true);
    const controller = new AbortController();
    active.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 30_000);
    try {
      const response = await fetch(`${origin}/DarijaTranslator/api/translator/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json',
          Authorization: `Basic ${credentials(username, password)}` },
        body: JSON.stringify({ text: text.trim() }), signal: controller.signal,
        credentials: 'omit', redirect: 'error',
      });
      if (!response.ok) throw new Error(statusErrors[response.status] ?? `Translation failed (HTTP ${response.status}). Please try again.`);
      let result: unknown;
      try { result = await response.json(); } catch { throw new Error('The server returned an invalid response.'); }
      if (!result || typeof result !== 'object' || !('translation' in result) ||
          typeof result.translation !== 'string' || !result.translation.trim()) {
        throw new Error('The server returned no valid translation.');
      }
      if (active.current === controller && !timedOut) setTranslation(result.translation);
    } catch (failure) {
      if (active.current !== controller) return;
      setError(timedOut ? 'The request timed out after 30 seconds. Please try again.' :
        failure instanceof TypeError ? 'Cannot reach the backend. Check the Windows LAN IP, same Wi-Fi, Expo Go Local Network permission, and firewall. iOS may block HTTP; see the mobile README for HTTPS setup.' :
        failure instanceof Error ? failure.message : 'Translation failed. Please try again.');
    } finally {
      clearTimeout(timer);
      if (active.current === controller) { active.current = null; setLoading(false); }
    }
  }

  async function copy() {
    try { setNotice(await Clipboard.setStringAsync(translation) ? 'Translation copied.' : 'Could not copy. Try again.'); }
    catch { setNotice('Could not copy. Try again.'); }
  }

  return (
    <SafeAreaProvider><SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>ENGLISH → MOROCCAN DARIJA</Text>
          <Text style={styles.title}>A little closer.{'\n'}كلامنا</Text>
          <Text style={styles.subtitle}>Turn your English words into everyday Darija.</Text>
          <View style={styles.card}>
            <Text style={styles.heading}>Connection</Text>
            <Text style={styles.label}>Backend URL</Text>
            <TextInput accessibilityLabel="Backend URL" style={styles.input} value={backend} onChangeText={setBackend} editable={!loading} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
            <Text style={styles.hint}>iPhone: use your Windows computer’s Wi-Fi IPv4 address. Run ipconfig if it changes.</Text>
            <Text style={styles.hint}>Allow Local Network access for Expo Go in iPhone Settings. HTTP depends on Expo Go’s iOS policy; use trusted HTTPS if blocked.</Text>
            <Text style={styles.label}>WildFly username</Text>
            <TextInput accessibilityLabel="WildFly username" style={styles.input} value={username} onChangeText={setUsername} editable={!loading} autoCapitalize="none" autoCorrect={false} autoComplete="off" />
            <Text style={styles.label}>Password</Text>
            <TextInput accessibilityLabel="WildFly password" style={styles.input} value={password} onChangeText={setPassword} editable={!loading} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" />
            <Text style={styles.hint}>Credentials stay in memory. Use HTTPS outside trusted local testing.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.heading}>Your English text</Text>
            <TextInput accessibilityLabel="English text to translate" style={[styles.input, styles.editor]} value={text} onChangeText={setText} editable={!loading} multiline placeholder="What would you like to say?" placeholderTextColor="#75847f" textAlignVertical="top" />
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" disabled={loading} onPress={translate} style={({ pressed }) => [styles.primary, (loading || pressed) && styles.dim]}>
                {loading && <ActivityIndicator color="#fff" />}
                <Text style={styles.primaryText}>{loading ? 'Translating…' : 'Translate'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={clear} style={styles.secondary}><Text style={styles.secondaryText}>Clear</Text></Pressable>
            </View>
            {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
          </View>
          <View style={[styles.card, styles.result]}>
            <Text style={styles.heading}>Moroccan Darija · الدارجة</Text>
            {translation ? <Text selectable style={styles.translation}>{translation}</Text> : <Text style={styles.placeholder}>Your translation will appear here.</Text>}
            <Pressable accessibilityRole="button" disabled={!translation || loading} onPress={copy} style={[styles.secondary, (!translation || loading) && styles.dim]}><Text style={styles.secondaryText}>Copy Translation</Text></Pressable>
            {!!notice && <Text accessibilityLiveRegion="polite" style={styles.hint}>{notice}</Text>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView></SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: '#f2f6f2' },
  page: { padding: 22, gap: 18, maxWidth: 680, width: '100%', alignSelf: 'center', paddingBottom: 40 },
  eyebrow: { color: '#327564', fontSize: 11, fontWeight: '800', letterSpacing: 1.7, marginTop: 12 },
  title: { color: '#173f35', fontSize: 38, lineHeight: 49, fontWeight: '800' },
  subtitle: { color: '#52675f', fontSize: 16, lineHeight: 24, marginBottom: 6 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 12, borderWidth: 1, borderColor: '#dce7df' },
  heading: { color: '#173f35', fontSize: 18, fontWeight: '700' },
  label: { color: '#344f45', fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#cbdad2', borderRadius: 12, padding: 13, color: '#193b30', backgroundColor: '#fbfdfb', fontSize: 16 },
  hint: { color: '#5f7168', fontSize: 12, lineHeight: 19 }, editor: { minHeight: 140, lineHeight: 24 },
  actions: { flexDirection: 'row', gap: 12 },
  primary: { flex: 1, flexDirection: 'row', gap: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: '#226b54', padding: 15, borderRadius: 12, minHeight: 50 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: { padding: 14, borderRadius: 12, backgroundColor: '#eaf1ec', alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  secondaryText: { color: '#245a46', fontWeight: '700', fontSize: 14 }, dim: { opacity: 0.5 },
  error: { color: '#a32828', lineHeight: 22, fontSize: 14 }, result: { backgroundColor: '#fafff8' },
  translation: { color: '#173f35', fontSize: 28, lineHeight: 46, textAlign: 'right', writingDirection: 'rtl', paddingVertical: 12 },
  placeholder: { color: '#6c7e73', lineHeight: 23, paddingVertical: 16 },
});
