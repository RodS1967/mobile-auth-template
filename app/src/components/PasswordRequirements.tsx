// Part of mobile-auth-template (MIT) — github.com/RodS1967/mobile-auth-template - Team RodZilla LLC
import { StyleSheet, Text, View } from "react-native";
import { PASSWORD_MIN_LENGTH, PasswordChecks } from "../passwordPolicy";

interface Props {
  checks: PasswordChecks;
}

// The live checklist shown under a "new password" field -- same four checks as the
// hosted reset-password page's JS meter (api/src/authPages.ts), just a native equivalent
// since there's no DOM here to attach to.
export default function PasswordRequirements({ checks }: Props) {
  return (
    <View style={styles.requirements}>
      <Text style={[styles.requirement, checks.length && styles.requirementMet]}>
        {checks.length ? "✓" : "•"} At least {PASSWORD_MIN_LENGTH} characters
      </Text>
      <Text style={[styles.requirement, checks.variety && styles.requirementMet]}>
        {checks.variety ? "✓" : "•"} At least 3 of: lowercase, uppercase, number, symbol
      </Text>
      <Text style={[styles.requirement, checks.common && styles.requirementMet]}>
        {checks.common ? "✓" : "•"} Not a commonly used password
      </Text>
      <Text style={[styles.requirement, checks.username && styles.requirementMet]}>
        {checks.username ? "✓" : "•"} Doesn't contain your username or email
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  requirements: {
    marginTop: 8,
  },
  requirement: {
    fontSize: 12,
    color: "#888",
    marginBottom: 2,
  },
  requirementMet: {
    color: "#2e7d32",
  },
});
