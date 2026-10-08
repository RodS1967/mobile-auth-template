import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError, login, LoginResult, resendUnlock, resendVerification } from "../api";
import { APP_NAME } from "../config";

interface Props {
  onLoggedIn: (result: LoginResult) => void;
  onCreateAccount: () => void;
  onForgotPassword: () => void;
}

// Which kind of resend link to offer, if any -- set from the server's error `code`, not
// guessed from the message text.
type ResendKind = "verification" | "unlock" | null;

export default function LoginScreen({ onLoggedIn, onCreateAccount, onForgotPassword }: Props) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendKind, setResendKind] = useState<ResendKind>(null);

  async function handleSubmit() {
    setError(null);
    setResendKind(null);
    setSubmitting(true);
    try {
      const result = await login(identifier.trim(), password);
      onLoggedIn(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.errors[0]?.message ?? "Could not log in.");
        if (err.code === "EMAIL_NOT_VERIFIED") setResendKind("verification");
        else if (err.code === "ACCOUNT_LOCKED") setResendKind("unlock");
      } else {
        setError("Couldn't reach the server. Check that it's running and you're on the same Wi-Fi.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resendKind === "verification") {
      await resendVerification(identifier.trim());
      Alert.alert("Check your email", "If that account exists and isn't verified yet, a new email was sent.");
    } else if (resendKind === "unlock") {
      await resendUnlock(identifier.trim());
      Alert.alert("Check your email", "If that account exists and is locked, a new unlock email was sent.");
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{APP_NAME}</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {resendKind ? (
          <Pressable onPress={handleResend} style={styles.resendButton}>
            <Text style={styles.resendButtonText}>
              {resendKind === "verification" ? "Resend verification email" : "Resend unlock email"}
            </Text>
          </Pressable>
        ) : null}

        <Text style={styles.label}>Username or email</Text>
        <TextInput
          style={styles.input}
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />

        <Pressable
          style={[styles.button, styles.primaryButton, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Log In</Text>}
        </Pressable>

        <View style={styles.linkRow}>
          <Pressable onPress={onForgotPassword}>
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>
          <Pressable onPress={onCreateAccount}>
            <Text style={styles.link}>Create account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingTop: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 32,
    textAlign: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 16,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  errorText: {
    color: "#c0392b",
    marginBottom: 12,
    fontSize: 13,
    textAlign: "center",
  },
  resendButton: {
    alignSelf: "center",
    marginBottom: 12,
  },
  resendButtonText: {
    color: "#2e7d32",
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButton: {
    backgroundColor: "#2e7d32",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  link: {
    color: "#2e7d32",
    fontWeight: "600",
  },
});
