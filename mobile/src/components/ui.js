// Small reusable building blocks (component-driven UI).
import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, ratingColor, space } from '../theme';

export function Button({ title, onPress, disabled, loading, variant = 'primary', testID }) {
  const secondary = variant === 'secondary';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {loading ? <ActivityIndicator color={secondary ? colors.primary : '#fff'} />
        : <Text style={[styles.buttonText, secondary && { color: colors.primary }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...props }) {
  return (
    <View style={{ marginBottom: space(3) }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />
    </View>
  );
}

export function ErrorText({ children }) {
  return children ? <Text style={styles.error}>{children}</Text> : null;
}

export const RatingBadge = memo(({ value, size = 44 }) => (
  <View style={[styles.badge, { width: size, height: size, backgroundColor: ratingColor(value) }]}>
    <Text style={[styles.badgeText, { fontSize: size * 0.38 }]}>{value == null ? '–' : value.toFixed(1)}</Text>
  </View>
));

export const Tag = memo(({ text, count }) => (
  <View style={styles.tag}>
    <Text style={styles.tagText}>{text}{count ? ` · ${count}` : ''}</Text>
  </View>
));

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  button: { backgroundColor: colors.primary, paddingVertical: space(3.5), borderRadius: 12, alignItems: 'center' },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  buttonText: { color: colors.primaryText, fontWeight: '700', fontSize: 16 },
  label: { color: colors.text, fontWeight: '600', marginBottom: space(1.5) },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: space(3), fontSize: 16, color: colors.text },
  error: { color: colors.bad, marginBottom: space(3) },
  badge: { borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontWeight: '800' },
  tag: { backgroundColor: colors.chip, borderRadius: 999, paddingHorizontal: space(3), paddingVertical: space(1.5), marginRight: space(2), marginBottom: space(2) },
  tagText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: space(4), borderWidth: 1, borderColor: colors.border },
});
