// Professor page: stats, auto-generated tags, and all reviews.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Button, Card, RatingBadge, Tag } from '../components/ui';
import { colors, space } from '../theme';

function Stat({ label, value }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ReviewItem({ r }) {
  return (
    <Card style={{ marginBottom: space(3) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space(2) }}>
        <RatingBadge value={r.rating} size={34} />
        <View style={{ marginLeft: space(3), flex: 1 }}>
          <Text style={styles.course}>{r.course_code}</Text>
          <Text style={styles.meta}>
            {r.author} · {new Date(r.created_at).toLocaleDateString()} · difficulty {r.difficulty}/5
          </Text>
        </View>
        <Text style={[styles.again, { color: r.would_take_again ? colors.good : colors.bad }]}>
          {r.would_take_again ? 'Would retake' : "Wouldn't retake"}
        </Text>
      </View>
      <Text style={styles.body}>{r.body}</Text>
      {r.tags.length ? (
        <View style={styles.tags}>{r.tags.map((t) => <Tag key={t} text={t} />)}</View>
      ) : null}
    </Card>
  );
}

export default function ProfessorScreen({ route, navigation }) {
  const { id } = route.params;
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.professor(id).then(setData).catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => navigation.addListener('focus', load), [navigation, load]);
  useEffect(load, [load]);

  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!data) return <ActivityIndicator style={{ marginTop: space(10) }} />;

  const p = data.professor;
  const mine = data.reviews.find((r) => r.user_id === user?.id);

  const header = (
    <View>
      <Card style={{ marginBottom: space(4) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <RatingBadge value={p.avg_rating} size={64} />
          <View style={{ marginLeft: space(4), flex: 1 }}>
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.meta}>{p.department}</Text>
          </View>
        </View>
        <View style={styles.stats}>
          <Stat label="reviews" value={p.review_count} />
          <Stat label="would retake" value={p.review_count ? `${p.take_again_pct}%` : '–'} />
          <Stat label="difficulty" value={p.avg_difficulty ?? '–'} />
        </View>
        {data.topTags.length ? (
          <View style={styles.tags}>{data.topTags.map((t) => <Tag key={t.tag} text={t.tag} count={t.count} />)}</View>
        ) : null}
      </Card>
      <Button
        testID="write-review"
        title={mine ? 'Edit your review' : 'Write a review'}
        onPress={() => navigation.navigate('Review', { id, name: p.name, existing: mine || null })}
      />
      <Text style={styles.section}>Reviews</Text>
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space(4) }}
      data={data.reviews}
      keyExtractor={(r) => String(r.id)}
      ListHeaderComponent={header}
      renderItem={({ item }) => <ReviewItem r={item} />}
      ListEmptyComponent={<Text style={styles.metaCenter}>No reviews yet. Be the first!</Text>}
    />
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 22, fontWeight: '800', color: colors.text },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  metaCenter: { color: colors.muted, textAlign: 'center', marginTop: space(4) },
  stats: { flexDirection: 'row', marginVertical: space(4) },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  statLabel: { color: colors.muted, fontSize: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space(2) },
  section: { fontSize: 18, fontWeight: '800', marginTop: space(6), marginBottom: space(3), color: colors.text },
  course: { fontWeight: '700', color: colors.text },
  again: { fontSize: 12, fontWeight: '700' },
  body: { color: colors.text, lineHeight: 21 },
  error: { color: colors.bad, padding: space(4) },
});
