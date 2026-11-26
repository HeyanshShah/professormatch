// Profile administration: change display name, see your reviews, log out.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Button, Card, ErrorText, Field, RatingBadge } from '../components/ui';
import { colors, space } from '../theme';

export default function ProfileScreen({ navigation }) {
  const { user, setUser, logout } = useAuth();
  const [name, setName] = useState(user.displayName);
  const [reviews, setReviews] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => { api.me().then((d) => setReviews(d.reviews)).catch(() => {}); }, []);
  useEffect(() => navigation.addListener('focus', load), [navigation, load]);

  async function saveName() {
    setError(''); setMsg('');
    try {
      const { user: u } = await api.updateMe(name);
      setUser(u);
      setMsg('Saved');
    } catch (e) { setError(e.message); }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.wrap}>
      <Card style={{ marginBottom: space(5) }}>
        <Text style={styles.email}>{user.email}</Text>
        <Field label="Display name" value={name} onChangeText={setName} />
        <ErrorText>{error}</ErrorText>
        {msg ? <Text style={{ color: colors.good, marginBottom: space(3) }}>{msg}</Text> : null}
        <Button title="Save" onPress={saveName} disabled={name.trim() === user.displayName} />
      </Card>
      <Text style={styles.section}>Your reviews ({reviews.length})</Text>
      {reviews.map((r) => (
        <Pressable key={r.id} onPress={() => navigation.navigate('Professor', { id: r.professor_id, name: r.professor_name })}>
          <Card style={styles.row}>
            <RatingBadge value={r.rating} size={34} />
            <View style={{ marginLeft: space(3) }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>{r.professor_name}</Text>
              <Text style={{ color: colors.muted }}>{r.course_code} · 👍 {r.helpful_count}{r.status !== 'visible' ? ` · ${r.status}` : ''}</Text>
            </View>
          </Card>
        </Pressable>
      ))}
      {user.role === 'moderator' && (
        <View style={{ marginTop: space(6) }}><Button title="Moderation queue" onPress={() => navigation.navigate('Moderation')} /></View>
      )}
      <View style={{ marginTop: space(3) }}><Button title="Log out" variant="secondary" onPress={logout} /></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space(5), maxWidth: 560, width: '100%', alignSelf: 'center' },
  email: { color: colors.muted, marginBottom: space(4) },
  section: { fontSize: 18, fontWeight: '800', marginBottom: space(3), color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: space(2.5), padding: space(3) },
});
