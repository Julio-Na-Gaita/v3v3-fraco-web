// Igual Android: trim + lowercase + removePrefix("@") + remove espaços
export function normalizeUser(input: string) {
  return input.trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, "");
}
