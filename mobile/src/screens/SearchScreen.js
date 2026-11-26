// Search + browse professors. Uses a debounced search (waits 300ms after typing stops
// before calling the API) and FlatList, which only renders rows visible on screen.
import { memo, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { Field, RatingBadge } from '../components/ui';
import { colors, space } from '../theme';

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

const ProfessorRow = memo(({ item, onPress }) => (
  <Pressable onPress={() => onPress(item)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
    <RatingBadge value={item.avg_rating} />
    <View style={{ flex: 1, marginLeft: space(3) }}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.meta}>{item.department}</Text>
      <Text style={styles.meta}>
        {item.review_count} review{item.review_count === 1 ? '' : 's'}
        {item.review_count ? ` · ${item.take_again_pct}% would take again · difficulty ${item.avg_difficulty}` : ''}
      </Text>
    </View>
    <Text style={styles.chev}>›</Text>
  </Pressable>
));

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState('');
  const [departments, setDepartments] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const q = useDebounced(query);

  useEffect(() => { api.departments().then((d) => setDepartments(d.departments)).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.searchProfessors(q.trim(), dept);
      setItems(data.professors);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [q, dept]);

  useEffect(() => { load(); }, [load]);
  // Refresh when coming back from a professor page (ratings may have changed).
  useEffect(() => navigation.addListener('focus', load), [navigation, load]);

  const open = useCallback((p) => navigation.navigate('Professor', { id: p.id, name: p.name }), [navigation]);

  return (
    <View style={styles.wrap}>
      <View style={{ paddingHorizontal: space(4), paddingTop: space(4) }}>
        <Field value={query} onChangeText={setQuery} placeholder="Search professors by name…" autoCorrect={false} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space(2) }}>
          {['', ...departments].map((d) => (
            <Pressable key={d || 'all'} onPress={() => setDept(d)} style={[styles.filter, dept === d && styles.filterOn]}>
              <Text style={[styles.filterText, dept === d && { color: '#fff' }]}>{d || 'All'}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && !items.length ? <ActivityIndicator style={{ marginTop: space(8) }} /> : (
        <FlatList
          data={items}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) => <ProfessorRow item={item} onPress={open} />}
          contentContainerStyle={{ padding: space(4), paddingTop: space(1) }}
          ItemSeparatorComponent={() => <View style={{ height: space(2.5) }} />}
          ListEmptyComponent={<Text style={styles.empty}>No professors match “{query}”.</Text>}
          initialNumToRender={12}
          windowSize={7}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, padding: space(3.5), borderWidth: 1, borderColor: colors.border },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  meta: { color: colors.muted, marginTop: 2, fontSize: 13 },
  chev: { fontSize: 26, color: colors.muted, marginLeft: space(2) },
  filter: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: space(3.5), paddingVertical: space(2), marginRight: space(2) },
  filterOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.text, fontWeight: '600' },
  error: { color: colors.bad, paddingHorizontal: space(4) },
  empty: { textAlign: 'center', color: colors.muted, marginTop: space(10) },
});
