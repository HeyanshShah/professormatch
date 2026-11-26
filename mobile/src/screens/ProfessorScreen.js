// Professor page: Bayesian rating, sentiment summary, tags, courses, and reviews with
// helpful votes, reporting, sorting, and infinite scroll (cursor pagination).
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Button, Card, RatingBadge, Tag } from '../components/ui';
import { colors, space } from '../theme';

const REASONS = [['offensive', 'Offensive'], ['personal_info', 'Personal info'], ['spam', 'Spam'], ['false_info', 'False info']];

function Stat({ label, value }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SentimentBar({ s }) {
  if (!s?.total) return null;
  const pos = Math.round((100 * s.positive) / s.total);
  const neg = Math.round((100 * s.negative) / s.total);
  return (
    <View style={{ marginTop: space(3) }}>
      <View style={styles.sentTrack}>
        <View style={{ flex: pos || 0.0001, backgroundColor: colors.good }} />
        <View style={{ flex: Math.max(0, 100 - pos - neg) || 0.0001, backgroundColor: colors.border }} />
        <View style={{ flex: neg || 0.0001, backgroundColor: colors.bad }} />
      </View>
      <Text style={styles.statLabel}>Review tone (NLP): {pos}% positive · {neg}% negative</Text>
    </View>
  );
}

function ReviewItem({ r, mine, onVote, onReport }) {
  const [reporting, setReporting] = useState(false);
  const [msg, setMsg] = useState('');
  return (
    <Card style={{ marginBottom: space(3) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space(2) }}>
        <RatingBadge value={r.rating} size={34} />
        <View style={{ marginLeft: space(3), flex: 1 }}>
          <Text style={styles.course}>{r.course_code}</Text>
          <Text style={styles.meta}>{r.author} · {new Date(r.created_at).toLocaleDateString()} · difficulty {r.difficulty}/5</Text>
        </View>
        <Text style={[styles.again, { color: r.would_take_again ? colors.good : colors.bad }]}>
          {r.would_take_again ? 'Would retake' : "Wouldn't retake"}
        </Text>
      </View>
      <Text style={styles.body}>{r.body}</Text>
      {r.tags.length ? <View style={styles.tags}>{r.tags.map((t) => <Tag key={t} text={t} />)}</View> : null}
      <View style={styles.actions}>
        <Pressable disabled={mine} onPress={() => onVote(r)} style={[styles.vote, r.voted && styles.voteOn]} testID={`vote-${r.id}`}>
          <Text style={[styles.voteText, r.voted && { color: '#fff' }]}>👍 Helpful · {r.helpful_count}</Text>
        </Pressable>
        {!mine && <Pressable onPress={() => setReporting(!reporting)}><Text style={styles.report}>Report</Text></Pressable>}
      </View>
      {reporting && (
        <View style={styles.tags}>
          {REASONS.map(([k, label]) => (
            <Pressable key={k} style={styles.reason} onPress={async () => {
              setMsg(await onReport(r, k));
              setReporting(false);
            }}><Text style={styles.reasonText}>{label}</Text></Pressable>
          ))}
        </View>
      )}
      {msg ? <Text style={styles.meta}>{msg}</Text> : null}
    </Card>
  );
}

export default function ProfessorScreen({ route, navigation }) {
  const { id } = route.params;
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [sort, setSort] = useState('recent');
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.professor(id, sort).then((d) => {
      setData(d);
      setReviews(d.reviews);
      setCursor(d.nextCursor);
    }).catch((e) => setError(e.message));
  }, [id, sort]);
  useEffect(() => navigation.addListener('focus', load), [navigation, load]);
  useEffect(load, [load]);

  async function more() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const d = await api.moreReviews(id, cursor, sort);
      setReviews((prev) => [...prev, ...d.reviews]);
      setCursor(d.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  async function vote(r) {
    const res = await api.vote(r.id);
    setReviews((prev) => prev.map((x) => (x.id === r.id ? { ...x, voted: res.voted, helpful_count: res.helpfulCount } : x)));
  }

  async function report(r, reason) {
    try {
      const res = await api.report(r.id, reason);
      if (res.hidden) setReviews((prev) => prev.filter((x) => x.id !== r.id));
      return 'Thanks, reported. Moderators will review it.';
    } catch (e) { return e.message; }
  }

  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!data) return <ActivityIndicator style={{ marginTop: space(10) }} />;
  const p = data.professor;

  const header = (
    <View>
      <Card style={{ marginBottom: space(4) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <RatingBadge value={p.review_count ? p.bayes_rating : null} size={64} />
          <View style={{ marginLeft: space(4), flex: 1 }}>
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.meta}>{p.department}</Text>
            {p.review_count ? <Text style={styles.meta}>Raw average {p.avg_rating} · adjusted for review count</Text> : null}
          </View>
        </View>
        <View style={styles.stats}>
          <Stat label="reviews" value={p.review_count} />
          <Stat label="would retake" value={p.review_count ? `${p.take_again_pct}%` : '–'} />
          <Stat label="difficulty" value={p.avg_difficulty ?? '–'} />
        </View>
        <SentimentBar s={data.sentiment} />
        {data.topTags.length ? <View style={styles.tags}>{data.topTags.map((t) => <Tag key={t.tag} text={t.tag} count={t.count} />)}</View> : null}
        {data.courses.length ? <Text style={[styles.meta, { marginTop: space(2) }]}>Teaches: {data.courses.join(' · ')}</Text> : null}
      </Card>
      <Button testID="write-review" title={data.myReview ? 'Edit your review' : 'Write a review'}
        onPress={() => navigation.navigate('Review', { id, name: p.name, existing: data.myReview })} />
      <View style={styles.sortRow}>
        <Text style={styles.section}>Reviews</Text>
        {[['recent', 'Newest'], ['helpful', 'Most helpful']].map(([k, label]) => (
          <Pressable key={k} onPress={() => setSort(k)}><Text style={[styles.sort, sort === k && styles.sortOn]}>{label}</Text></Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space(4), maxWidth: 720, width: '100%', alignSelf: 'center' }}
      data={reviews}
      keyExtractor={(r) => String(r.id)}
      ListHeaderComponent={header}
      renderItem={({ item }) => <ReviewItem r={item} mine={item.user_id === user?.id} onVote={vote} onReport={report} />}
      onEndReached={more}
      onEndReachedThreshold={0.5}
      ListFooterComponent={loadingMore ? <ActivityIndicator /> : null}
      ListEmptyComponent={<Text style={styles.metaCenter}>No reviews yet. Be the first!</Text>}
    />
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 22, fontWeight: '800', color: colors.text },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  metaCenter: { color: colors.muted, textAlign: 'center', marginTop: space(4) },
  stats: { flexDirection: 'row', marginTop: space(4) },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 3 },
  sentTrack: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space(2) },
  sortRow: { flexDirection: 'row', alignItems: 'center', marginTop: space(6), marginBottom: space(3) },
  section: { fontSize: 18, fontWeight: '800', color: colors.text, flex: 1 },
  sort: { marginLeft: space(3), color: colors.muted, fontWeight: '600' },
  sortOn: { color: colors.primary, textDecorationLine: 'underline' },
  course: { fontWeight: '700', color: colors.text },
  again: { fontSize: 12, fontWeight: '700' },
  body: { color: colors.text, lineHeight: 21 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space(3) },
  vote: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: space(3), paddingVertical: space(1.5) },
  voteOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  voteText: { fontWeight: '600', color: colors.text, fontSize: 13 },
  report: { color: colors.muted, fontSize: 13 },
  reason: { borderWidth: 1, borderColor: colors.bad, borderRadius: 999, paddingHorizontal: space(3), paddingVertical: space(1), marginRight: space(2), marginBottom: space(2) },
  reasonText: { color: colors.bad, fontSize: 12, fontWeight: '600' },
  error: { color: colors.bad, padding: space(4) },
});
