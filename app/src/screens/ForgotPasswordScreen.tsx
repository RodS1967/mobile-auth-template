// Part of mobile-auth-template (MIT) — github.com/RodS1967/mobile-auth-template - Team RodZilla LLC
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { lookupForgotPassword, requestPasswordReset } from "../api";

interface Props {
  onBack: () => void;
}

// Three steps: (1) enter the account's username or email, (2) see a masked hint of the
// real email and type it in full -- the server never confirms whether it's right, (3) a
// generic confirmation. The actual reset happens on a hosted page reached by the emailed
// link (api/src/authPages.ts), not in the app itself.
export default function ForgotPasswordScreen({ onBack }: Props) {
  const [identifier, setIdentifier] = useState("");
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function resetAll() {
    setIdentifier("");
    setMaskedEmail(null);
    setEmail("");
    setError(null);
    setDone(false);
  }

  async function handleLookup() {
    setError(null);
    setSubmitting(true);
    const trimmed = identifier.trim();
    try {
      if (trimmed.includes("@")) {
        // They typed the full email as the identifier itself -- that already proves
        // what step 2 would otherwise ask them to prove, so skip straight to sending.
        await requestPasswordReset(trimmed, trimmed);
        setDone(true);
        return;
      }
      const result = await lookupForgotPassword(trimmed);
      setMaskedEmail(result.maskedEmail);
    } catch {
      setError("Couldn't reach the server. Check that it's running and you're on the same Wi-Fi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendReset() {
    setSubmitting(true);
    try {
      await requestPasswordReset(identifier.trim(), email.trim());
      setDone(true);
    } catch {
      setError("Couldn't reach the server. Check that it's running and you're on the same Wi-Fi.");
    } finally {
      setSubmitting(false);
    }
  }

  // Step 3: confirmation. Deliberately the same wording no matter what was typed above.
  if (done) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.body}>
          If that matches our records, we've sent a password reset link. Open it to set a new password, then come
          back and log in.
        </Text>
        <Pressable style={[styles.button, styles.primaryButton]} onPress={onBack}>
          <Text style={styles.primaryButtonText}>Back to Log In</Text>
        </Pressable>
      </View>
    );
  }

  // Step 2: the masked hint, plus the real input the user has to get right.
  if (maskedEmail) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Confirm your email</Text>
          <Text style={styles.body}>
            The account for "{identifier.trim()}" uses an email that looks like{" "}
            <Text style={styles.maskedEmail}>{maskedEmail}</Text>. Type the full address below.
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
          />

          <Pressable
            style={[styles.button, styles.primaryButton, submitting && styles.buttonDisabled]}
            onPress={handleSendReset}
            disabled={submitting || !email.trim()}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Send reset link</Text>}
          </Pressable>

          <Pressable onPress={resetAll} disabled={submitting}>
            <Text style={styles.startOverLink}>That's not right, start over</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Step 1: ask for the username or email to look up.
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.body}>
          Enter your username or email. If you enter your username, we'll show you a hint about which email to
          confirm; if you enter your email directly, we'll send the reset link right away.
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.label}>Username or email</Text>
        <TextInput
          style={styles.input}
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Pressable
          style={[styles.button, styles.primaryButton, submitting && styles.buttonDisabled]}
          onPress={handleLookup}
          disabled={submitting || !identifier.trim()}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Continue</Text>}
        </Pressable>

        <Pressable onPress={onBack} disabled={submitting}>
          <Text style={styles.startOverLink}>Back to Log In</Text>
        </Pressable>
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
    marginBottom: 16,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    color: "#444",
    lineHeight: 20,
    marginBottom: 8,
  },
  maskedEmail: {
    fontWeight: "700",
    color: "#2e7d32",
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
  startOverLink: {
    textAlign: "center",
    marginTop: 16,
    color: "#666",
    textDecorationLine: "underline",
  },
});
