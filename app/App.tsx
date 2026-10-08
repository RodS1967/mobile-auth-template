import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import AccountScreen from './src/screens/AccountScreen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';
import { LoginResult, logout as apiLogout, resendVerification } from './src/api';
import { clearSession, loadSession, saveSession, SessionUser } from './src/storage';

type Route = 'checking' | 'login' | 'signup' | 'forgotPassword' | 'loggedIn' | 'account' | 'changePassword';

export default function App() {
  const [route, setRoute] = useState<Route>('checking');
  const [user, setUser] = useState<SessionUser | null>(null);
  // Kept in state, not just secure storage -- the account/change-password screens need it
  // on hand to send as a bearer token, and re-reading from storage on every render would
  // just be a slower way to get the same value.
  const [token, setToken] = useState<string | null>(null);

  // On launch, check secure storage for a session saved by a previous login -- so closing
  // and reopening the app doesn't force logging in again every time.
  useEffect(() => {
    loadSession().then((session) => {
      if (session) {
        setUser(session.user);
        setToken(session.token);
        setRoute('loggedIn');
      } else {
        setRoute('login');
      }
    });
  }, []);

  async function handleLoggedIn(result: LoginResult) {
    await saveSession(result.token, result.user);
    setUser(result.user);
    setToken(result.token);
    setRoute('loggedIn');
  }

  async function handleLogout() {
    // Revokes the session server-side too, not just on-device -- see api.ts's logout().
    // Best-effort: the device forgets its session regardless of whether this succeeds, so a
    // network blip can't trap someone in a logged-in state they're trying to leave.
    if (token) {
      try {
        await apiLogout(token);
      } catch {
        // ignored -- local session is cleared below either way
      }
    }
    await clearSession();
    setUser(null);
    setToken(null);
    setRoute('login');
  }

  async function handleResendVerification() {
    if (!user) return;
    await resendVerification(user.email);
    Alert.alert('Check your email', 'If a verification link was needed, a new one was just sent.');
  }

  if (route === 'checking') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (route === 'signup') {
    return (
      <>
        <SignUpScreen onSwitchToLogin={() => setRoute('login')} />
        <StatusBar style="auto" />
      </>
    );
  }

  if (route === 'forgotPassword') {
    return (
      <>
        <ForgotPasswordScreen onBack={() => setRoute('login')} />
        <StatusBar style="auto" />
      </>
    );
  }

  if (route === 'account' && user) {
    return (
      <>
        <AccountScreen
          user={user}
          onBack={() => setRoute('loggedIn')}
          onChangePassword={() => setRoute('changePassword')}
          onLogout={handleLogout}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  if (route === 'changePassword' && user && token) {
    return (
      <>
        <ChangePasswordScreen token={token} user={user} onDone={() => setRoute('account')} />
        <StatusBar style="auto" />
      </>
    );
  }

  if (route === 'loggedIn' && user) {
    return (
      <View style={styles.centered}>
        <Pressable style={styles.accountButton} onPress={() => setRoute('account')}>
          <Text style={styles.accountButtonText}>{user.username.charAt(0).toUpperCase()}</Text>
        </Pressable>
        <Text style={styles.welcome}>Welcome, {user.username}!</Text>
        <Text style={styles.subtext}>{user.email}</Text>
        {!user.emailVerified && (
          <View style={styles.verifyBanner}>
            <Text style={styles.verifyBannerText}>Your email isn't verified yet.</Text>
            <Pressable onPress={handleResendVerification}>
              <Text style={styles.resendLink}>Resend verification email</Text>
            </Pressable>
          </View>
        )}
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <>
      <LoginScreen
        onLoggedIn={handleLoggedIn}
        onCreateAccount={() => setRoute('signup')}
        onForgotPassword={() => setRoute('forgotPassword')}
      />
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    position: 'relative',
  },
  accountButton: {
    position: 'absolute',
    top: 56,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2e7d32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  welcome: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  verifyBanner: {
    marginTop: 20,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  verifyBannerText: {
    color: '#664d03',
    fontSize: 13,
  },
  resendLink: {
    color: '#664d03',
    fontWeight: '700',
    marginTop: 6,
    textDecorationLine: 'underline',
  },
});
