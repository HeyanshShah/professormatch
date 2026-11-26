// Write or edit a review. Validation runs here for instant feedback,
// and again on the server (never trust the client).
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { api } from '../api';
import { Button, ErrorText, Field } from '../components/ui';
import { colors, space } from '../theme';

function Scale({ label, value, onChange, low, high }) {
  return (
    <View style={{ marginBottom: space(5) }}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: 'row' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} accessibilityLabel={`${label} ${n}`} onPress={() => onChange(n)}
            style={[styles.dot, value === n && styles.dotOn]}>
            <Text style={[styles.dotText, value === n && { color: '#fff' }]}>{n}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.ends}><Text style={styles.endText}>{low}</Text><Text style={styles.endText}>{high}</Text></View>
    </View>
  );
}

export default function ReviewScreen({ route, navigation }) {
  const { id, existing } = route.params;
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [difficulty, setDifficulty] = useState(existing?.difficulty ?? 0);
  const [again, setAgain] = useState(existing?.would_take_again ?? true);
  const [course, setCourse] = useState(existing?.course_code ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!rating || !difficulty) return setError('Pick a rating and a difficulty');
    if (body.trim().length < 10) return setError('Write at least 10 characters');
    setBusy(true);
    setError('');
    const review = { rating, difficulty, wouldTakeAgain: again, courseCode: course, body };
    try {
      if (existing) await api.updateReview(id, review);
      else await api.createReview(id, review);
      navigation.goBack();
    } catch (e) {
      setError(e.message);  // includes moderation reasons, e.g. "offensive language"
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try { await api.deleteReview(id); navigation.goBack(); } catch (e) { setError(e.message); setBusy(false); }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.wrap}>
      <Scale label="Overall rating" value={rating} onChange={setRating} low="Awful" high="Awesome" />
      <Scale label="Difficulty" value={difficulty} onChange={setDifficulty} low="Very easy" high="Very hard" />
      <View style={styles.switchRow}>
        <Text style={styles.label}>Would you take this professor again?</Text>
        <Switch value={again} onValueChange={setAgain} />
      </View>
      <Field label="Course code" value={course} onChangeText={setCourse} placeholder="CS 146" autoCapitalize="characters" />
      <Field label="Your review" value={body} onChangeText={setBody} multiline maxLength={1000}
        placeholder="How were the lectures, exams, and grading?" style={[styles.multi]} />
      <Text style={styles.count}>{body.length}/1000 · Tags like “Clear lectures” are added automatically. Profanity and personal info (emails, phone numbers) are blocked.</Text>
      <ErrorText>{error}</ErrorText>
      <Button title={existing ? 'Save changes' : 'Post review'} onPress={save} loading={busy} testID="post-review" />
      {existing ? <View style={{ marginTop: space(3) }}><Button title="Delete review" variant="secondary" onPress={remove} /></View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space(5), maxWidth: 560, width: '100%', alignSelf: 'center' },
  label: { fontWeight: '700', color: colors.text, marginBottom: space(2), flexShrink: 1 },
  dot: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginRight: space(2.5) },
  dotOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotText: { fontWeight: '700', color: colors.text, fontSize: 16 },
  ends: { flexDirection: 'row', justifyContent: 'space-between', width: 290, marginTop: space(1) },
  endText: { color: colors.muted, fontSize: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(5) },
  multi: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: space(3), fontSize: 16, minHeight: 130, textAlignVertical: 'top', color: colors.text },
  count: { color: colors.muted, fontSize: 12, marginTop: -space(2), marginBottom: space(4) },
});
