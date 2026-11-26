// Securely store the login token. On phones we use the device keychain
// (expo-secure-store). On web, SecureStore doesn't exist, so fall back to localStorage.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'profmatch_token';

export async function saveToken(token) {
  if (Platform.OS === 'web') return globalThis.localStorage?.setItem(KEY, token);
  return SecureStore.setItemAsync(KEY, token);
}

export async function loadToken() {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
  return SecureStore.getItemAsync(KEY);
}

export async function clearToken() {
  if (Platform.OS === 'web') return globalThis.localStorage?.removeItem(KEY);
  return SecureStore.deleteItemAsync(KEY);
}
