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
} from "react-native";
import { ApiError, changePassword } from "../api";
import { PASSWORD_MIN_LENGTH, evaluatePassword } from "../passwordPolicy";
import PasswordRequirements from "../components/PasswordRequirements";
import { SessionUser } from "../storage";

interface Props {
  token: string;
  user: SessionUser;
  onDone: () => void;
}

// The app's first screen that calls an authenticated endpoint -- `token` is the session
// token from login/signup, sent as a bearer token by api.ts's changePassword().
export default function ChangePasswordScreen({ token, user, onDone }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordChecks = evaluatePassword(newPassword, user.username, user.email);

  async function handleSubmit() {
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(token, currentPassword, newPassword, confirmPassword);
      Alert.alert("Password changed", "You've been logged out on every other device.", [
        { text: "OK", onPress: onDone },
      ]);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.errors[0]?.message ?? "Could not change password.");
      } else {
        setError("Couldn't reach the server. Check that it's running and you're on the same Wi-Fi.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Change Password</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.label}>Current password</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <Text style={styles.label}>New password</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder={`at least ${PASSWORD_MIN_LENGTH} characters`}
        />
        {newPassword.length > 0 ? <PasswordRequirements checks={passwordChecks} /> : null}

        <Text style={styles.label}>Confirm new password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <Pressable
          style={[styles.button, styles.primaryButton, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Update Password</Text>}
        </Pressable>

        <Pressable onPress={onDone} disabled={submitting}>
          <Text style={styles.cancelLink}>Cancel</Text>
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
    marginBottom: 12,
    fontSize: 13,
    textAlign: "center",
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
  cancelLink: {
    textAlign: "center",
    marginTop: 16,
    color: "#666",
    textDecorationLine: "underline",
  },
});
