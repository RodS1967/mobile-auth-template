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
import { ApiError, signUp, SignUpResult } from "../api";
import { PASSWORD_MIN_LENGTH, evaluatePassword } from "../passwordPolicy";
import PasswordRequirements from "../components/PasswordRequirements";

type FieldErrors = Partial<Record<"username" | "email" | "password" | "form", string>>;

interface Props {
  onSwitchToLogin: () => void;
}

export default function SignUpScreen({ onSwitchToLogin }: Props) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<SignUpResult | null>(null);

  function resetAll() {
    setTermsAccepted(false);
    setUsername("");
    setEmail("");
    setPassword("");
    setErrors({});
    setResult(null);
  }

  function handleCancelConsent() {
    resetAll();
    onSwitchToLogin();
  }

  async function handleSubmit() {
    setErrors({});
    setSubmitting(true);
    try {
      const created = await signUp(username.trim(), email.trim(), password, termsAccepted);
      setResult(created);
    } catch (err) {
      if (err instanceof ApiError) {
        const next: FieldErrors = {};
        for (const e of err.errors) {
          next[e.field as keyof FieldErrors] = e.message;
        }
        setErrors(next);
      } else {
        setErrors({ form: "Couldn't reach the server. Check that it's running and you're on the same Wi-Fi." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Step 1: the consent placeholder. No real Terms of Service/Privacy Policy text exists
  // yet (blocked on lawyer review) -- this is a working hook for it, not the real thing.
  if (!termsAccepted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Create Account</Text>
        <View style={styles.consentBox}>
          <Text style={styles.consentHeading}>Terms of Service &amp; Privacy Policy</Text>
          <Text style={styles.consentBody}>
            [Placeholder] The real terms and privacy policy aren't written yet. By tapping
            Accept, you're agreeing to a stand-in for now -- this screen exists so the real
            text can be dropped in later without changing how sign-up works.
          </Text>
        </View>
        <View style={styles.buttonRow}>
          <Pressable style={[styles.button, styles.secondaryButton]} onPress={handleCancelConsent}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.primaryButton, { flex: 1 }]}
            onPress={() => setTermsAccepted(true)}
          >
            <Text style={styles.primaryButtonText}>Accept</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Step 3: confirmation after a successful sign-up.
  if (result) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Account Created</Text>
        <Text style={styles.consentBody}>
          Welcome, {result.username}! Check {result.email} for a verification link, then log in below.
        </Text>
        <Pressable style={[styles.button, styles.primaryButton]} onPress={onSwitchToLogin}>
          <Text style={styles.primaryButtonText}>Log In Now</Text>
        </Pressable>
        <Pressable onPress={resetAll}>
          <Text style={styles.startOverLink}>Create another account</Text>
        </Pressable>
      </View>
    );
  }

  const passwordChecks = evaluatePassword(password, username, email);

  // Step 2: the actual sign-up form, shown only after accepting the placeholder terms.
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Account</Text>

        {errors.form ? <Text style={styles.errorText}>{errors.form}</Text> : null}

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="letters and digits only"
        />
        {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}

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
        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder={`at least ${PASSWORD_MIN_LENGTH} characters`}
        />
        {password.length > 0 ? <PasswordRequirements checks={passwordChecks} /> : null}
        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

        <Pressable
          style={[styles.button, styles.primaryButton, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Create Account</Text>
          )}
        </Pressable>

        <Pressable onPress={resetAll} disabled={submitting}>
          <Text style={styles.startOverLink}>Start over</Text>
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
    paddingTop: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 24,
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
    marginTop: 6,
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
  secondaryButton: {
    backgroundColor: "#eee",
    marginRight: 12,
    flex: 1,
  },
  secondaryButtonText: {
    color: "#333",
    fontWeight: "600",
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: "row",
  },
  consentBox: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 16,
  },
  consentHeading: {
    fontWeight: "700",
    marginBottom: 8,
  },
  consentBody: {
    fontSize: 14,
    color: "#444",
    lineHeight: 20,
  },
  startOverLink: {
    textAlign: "center",
    marginTop: 16,
    color: "#666",
    textDecorationLine: "underline",
  },
});
