// Moderators review reviews that students reported (auto-hidden after 3 reports).
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api } from '../api';
import { Button, Card } from '../components/ui';
import { colors, space } from '../theme';

export default function ModerationScreen({ navigation }) {
  const [queue, setQueue] = useState([]);
  const load = useCallback(() => { api.modQueue().then((d) => setQueue(d.queue)).catch(() => {}); }, []);
  useEffect(() => navigation.addListener('focus', load), [navigation, load]);
  useEffect(load, [load]);

  async function act(id, action) {
    await api.modAction(id, action);
    load();
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space(5), maxWidth: 640, width: '100%', alignSelf: 'center' }}>
      {!queue.length && <Text style={{ color: colors.muted, textAlign: 'center' }}>Nothing to review 🎉</Text>}
      {queue.map((q) => (
        <Card key={q.id} style={{ marginBottom: space(3) }}>
          <Text style={{ fontWeight: '700', color: colors.text }}>{q.professor}</Text>
          <Text style={{ color: colors.muted, marginBottom: space(2) }}>{q.reports} reports: {q.reasons.join(', ')}</Text>
          <Text style={{ color: colors.text, marginBottom: space(3) }}>{q.body}</Text>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, marginRight: space(2) }}><Button title="Restore" variant="secondary" onPress={() => act(q.id, 'restore')} /></View>
            <View style={{ flex: 1 }}><Button title="Remove" onPress={() => act(q.id, 'remove')} /></View>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
