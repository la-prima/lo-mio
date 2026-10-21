import { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import { useSession } from "./session.tsx";

export function LoginScreen() {
  const { login } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    setFailed(!(await login(email.trim(), password)));
    setPending(false);
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">
        lo-mio
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Correo"
        accessibilityLabel="Correo"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        testID="login-email"
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        accessibilityLabel="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        testID="login-password"
      />
      {failed && (
        <Text accessibilityRole="alert" style={styles.error}>
          Correo o contraseña incorrectos.
        </Text>
      )}
      <Button
        title="Ingresar"
        onPress={submit}
        disabled={pending || !email || !password}
        testID="login-submit"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: "700", textAlign: "center", marginBottom: 24 },
  input: { borderWidth: 1, borderColor: "#9ca3af", borderRadius: 8, padding: 12, fontSize: 16 },
  error: { color: "#b91c1c" },
});
