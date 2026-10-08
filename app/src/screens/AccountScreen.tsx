// Part of mobile-auth-template (MIT) — github.com/RodS1967/mobile-auth-template - Team RodZilla LLC
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SessionUser } from "../storage";

interface Props {
  user: SessionUser;
  onBack: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
}

// A small menu, not a dashboard -- account info plus a short, growing list of account-level
// actions (Change Password today; subscription management, etc. land here later rather than
// cluttering the main screen).
export default function AccountScreen({ user, onBack, onChangePassword, onLogout }: Props) {
  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} style={styles.backRow}>
        <Text style={styles.backLink}>‹ Back</Text>
      </Pressable>

      <Text style={styles.title}>Account</Text>
      <Text style={styles.username}>{user.username}</Text>
      <Text style={styles.email}>{user.email}</Text>

      <View style={styles.menu}>
        <Pressable style={styles.row} onPress={onChangePassword}>
          <Text style={styles.rowText}>Change Password</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={onLogout}>
          <Text style={[styles.rowText, styles.logoutText]}>Log Out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  backRow: {
    marginBottom: 16,
  },
  backLink: {
    color: "#2e7d32",
    fontWeight: "600",
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  username: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 16,
  },
  email: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  menu: {
    marginTop: 32,
    borderTopWidth: 1,
    borderColor: "#eee",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  rowText: {
    fontSize: 16,
    color: "#222",
  },
  rowChevron: {
    fontSize: 18,
    color: "#ccc",
  },
  logoutText: {
    color: "#c0392b",
  },
});
