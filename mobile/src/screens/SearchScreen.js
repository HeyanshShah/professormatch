// Search + browse professors, ranked fairly with a Bayesian average.
// Debounced search (waits 300ms after typing) and a virtualized FlatList.
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

const SORTS = [['best', 'Top rated'], ['most_reviewed', 'Most reviewed'], ['easiest', 'Easiest']];

function Chip({ label, on, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.filter, on && styles.filterOn]}>
      <Text style={[styles.filterText, on && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const ProfessorRow = memo(({ item, onPress }) => (
  <Pressable onPress={() => onPress(item)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
    <RatingBadge value={item.review_count ? item.bayes_rating : null} />
    <View style={{ flex: 1, marginLeft: space(3) }}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.meta}>{item.department}</Text>
      <Text style={styles.meta}>
        {item.review_count} review{item.review_count === 1 ? '' : 's'}
        {item.review_count ? ` · ${item.take_again_pct}% retake · difficulty ${item.avg_difficulty}` : ''}
      </Text>
    </View>
    <Text style={styles.chev}>›</Text>
  </Pressable>
));

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState('');
  const [sort, setSort] = useState('best');
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
      // A query that looks like a course code ("cs146") searches by course instead of name.
      const isCourse = /^[a-z]{2,5}\s?-?\d{1,3}[a-z]?$/i.test(q.trim());
      const data = await api.searchProfessors(isCourse ? { course: q.trim(), department: dept, sort }
        : { q: q.trim(), department: dept, sort });
      setItems(data.professors);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [q, dept, sort]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => navigation.addListener('focus', load), [navigation, load]);
  const open = useCallback((p) => navigation.navigate('Professor', { id: p.id, name: p.name }), [navigation]);

  return (
    <View style={styles.wrap}>
      <View style={{ paddingHorizontal: space(4), paddingTop: space(4) }}>
        <Field value={query} onChangeText={setQuery} placeholder="Search a professor or a course (CS 146)…" autoCorrect={false} />
        <Pressable onPress={() => navigation.navigate('Recommend')} style={styles.recommend} testID="open-recommend">
          <Text style={styles.recommendText}>✨ Find the best professor for a course</Text>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space(2) }}>
          {SORTS.map(([k, label]) => <Chip key={k} label={label} on={sort === k} onPress={() => setSort(k)} />)}
          <View style={styles.sep} />
          {['', ...departments].map((d) => <Chip key={d || 'all'} label={d || 'All'} on={dept === d} onPress={() => setDept(d)} />)}
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
          ListFooterComponent={items.length ? <Text style={styles.note}>Ratings use a Bayesian average, so professors with very few reviews aren't over-ranked.</Text> : null}
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
  sep: { width: 1, backgroundColor: colors.border, marginRight: space(2), marginVertical: space(1) },
  recommend: { backgroundColor: colors.chip, borderRadius: 12, padding: space(3), marginBottom: space(3), marginTop: -space(1) },
  recommendText: { color: colors.primary, fontWeight: '700', textAlign: 'center' },
  error: { color: colors.bad, paddingHorizontal: space(4) },
  empty: { textAlign: 'center', color: colors.muted, marginTop: space(10) },
  note: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: space(4) },
});
