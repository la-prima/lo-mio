import { StyleSheet, TextInput } from "react-native";

/** Filtro local de una lista (mesas, catálogo): sin acentos ni mayúsculas. */
export const matches = (text: string, query: string) =>
  normalize(text).includes(normalize(query.trim()));
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function Search({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <TextInput
      style={styles.input}
      placeholder={label}
      accessibilityLabel={label}
      value={value}
      onChangeText={onChange}
      autoCorrect={false}
      testID="search"
    />
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: "#9ca3af", borderRadius: 8, padding: 10, fontSize: 16 },
});
