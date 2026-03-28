/** Browser text-to-speech for low-literacy / low-vision support. */

export function speechSupported(): boolean {
  return typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";
}

export function speakText(text: string): void {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  u.lang = "en-US";
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}
