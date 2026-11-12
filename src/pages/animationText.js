export const sentenceCase = (value) => {
  const text = String(value ?? "");
  if (!text) return text;
  return text.charAt(0).toLocaleUpperCase("bs-Latn") + text.slice(1).toLocaleLowerCase("bs-Latn");
};
