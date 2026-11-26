// "Who should I take for CS 146?" Pick a course and what you want (easy / balanced /
// challenging); the API scores each professor and explains why.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { Card, Field, RatingBadge } from '../components/ui';
import { colors, space } from '../theme';

const PREFS = [['easy', '😌 Easy A'], ['balanced', '⚖️ Balanced'], ['challenging', '🧠 Learn the most']];
const LABELS = { quality: 'Quality', retake: 'Would retake', ease: 'Easiness', rigor: 'Rigor' };

function Bar({ label, value }) {
  return (
    <View style={{ marginTop: space(1.5) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.barLabel}>{label}</Text><Text style={styles.barLabel}>{value}</Text>
      </View>
      <View style={styles.track}><View style={[styles.fill, { width: `${value}%` }]} /></View>
    </View>
  );
}

export default function RecommendScreen({ navigation }) {
  const [q, setQ] = useState('');
  const [courses, setCourses] = useState([]);
  const [course, setCourse] = useState(null);
  const [pref, setPref] = useState('balanced');
  const [recs, setRecs] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.courses(q).then((d) => setCourses(d.courses)).catch(() => {}); }, [q]);
  useEffect(() => {
    if (!course) return;
    setRecs(null);
    api.recommendations(course, pref).then((d) => setRecs(d.recommendations)).catch((e) => setError(e.message));
  }, [course, pref]);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.wrap}>
      <Field label="Course" value={q} onChangeText={(t) => { setQ(t); setCourse(null); }} placeholder="e.g. CS 146" autoCapitalize="characters" />
      {!course && (
        <View style={styles.courseList}>
          {courses.map((c) => (
            <Pressable key={c.code} onPress={() => { setCourse(c.code); setQ(c.code); }} style={styles.course}>
              <Text style={styles.courseCode}>{c.code}</Text>
              <Text style={styles.meta}>{c.professors} professors · {c.reviews} reviews</Text>
            </Pressable>
          ))}
        </View>
      )}
      {course && (
        <>
          <Text style={styles.label}>What do you want from this class?</Text>
          <View style={{ flexDirection: 'row', marginBottom: space(4) }}>
            {PREFS.map(([k, label]) => (
              <Pressable key={k} onPress={() => setPref(k)} style={[styles.pref, pref === k && styles.prefOn]} testID={`pref-${k}`}>
                <Text style={[styles.prefText, pref === k && { color: '#fff' }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {error ? <Text style={{ color: colors.bad }}>{error}</Text> : null}
          {!recs ? <ActivityIndicator /> : recs.map((p, i) => (
            <Pressable key={p.id} onPress={() => navigation.navigate('Professor', { id: p.id, name: p.name })}>
              <Card style={{ marginBottom: space(3) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.rank}>#{i + 1}</Text>
                  <RatingBadge value={p.review_count ? p.bayes_rating : null} size={40} />
                  <View style={{ marginLeft: space(3), flex: 1 }}>
                    <Text style={styles.name}>{p.name}</Text>
                    <Text style={styles.meta}>{p.review_count} reviews · confidence {p.confidence}%</Text>
                  </View>
                  <View style={styles.match}><Text style={styles.matchText}>{p.match}%</Text><Text style={styles.matchLabel}>match</Text></View>
                </View>
                {Object.entries(p.why).map(([k, v]) => <Bar key={k} label={LABELS[k]} value={v} />)}
              </Card>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space(5), maxWidth: 600, width: '100%', alignSelf: 'center' },
  label: { fontWeight: '700', color: colors.text, marginBottom: space(2) },
  courseList: { flexDirection: 'row', flexWrap: 'wrap' },
  course: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: space(3), marginRight: space(2), marginBottom: space(2) },
  courseCode: { fontWeight: '800', color: colors.primary },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  pref: { flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 10, paddingVertical: space(2.5), marginRight: space(2), alignItems: 'center' },
  prefOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  prefText: { fontWeight: '700', color: colors.text, fontSize: 13 },
  rank: { fontWeight: '800', color: colors.muted, width: 32, fontSize: 16 },
  name: { fontWeight: '800', color: colors.text, fontSize: 16 },
  match: { alignItems: 'center' },
  matchText: { fontSize: 22, fontWeight: '900', color: colors.primary },
  matchLabel: { fontSize: 11, color: colors.muted },
  barLabel: { fontSize: 12, color: colors.muted },
  track: { height: 6, backgroundColor: colors.border, borderRadius: 3, marginTop: 3 },
  fill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
});
