// App entry: sets up navigation. Logged-out users only see the Auth screen;
// logged-in users get Search -> Professor -> Review, plus Profile.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/AuthContext';
import AuthScreen from './src/screens/AuthScreen';
import ProfessorScreen from './src/screens/ProfessorScreen';
import ModerationScreen from './src/screens/ModerationScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import RecommendScreen from './src/screens/RecommendScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import SearchScreen from './src/screens/SearchScreen';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator();

function Routes() {
  const { user, loading } = useAuth();
  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" /></View>;
  }
  return (
    <Stack.Navigator screenOptions={{ headerTintColor: colors.primary, headerTitleStyle: { fontWeight: '700' } }}>
      {!user ? (
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen
            name="Search"
            component={SearchScreen}
            options={({ navigation }) => ({
              title: 'ProfMatch',
              headerRight: () => (
                <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={10}>
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>Profile</Text>
                </Pressable>
              ),
            })}
          />
          <Stack.Screen name="Professor" component={ProfessorScreen} options={({ route }) => ({ title: route.params.name })} />
          <Stack.Screen name="Review" component={ReviewScreen}
            options={({ route }) => ({ title: route.params.existing ? 'Edit review' : 'Write a review', presentation: 'modal' })} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Recommend" component={RecommendScreen} options={{ title: 'Best professor for…' }} />
          <Stack.Screen name="Moderation" component={ModerationScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <Routes />
        </NavigationContainer>
        <StatusBar style="dark" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
