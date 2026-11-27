export function useMotionPreference() {
  const paused = useState('kojo-motion-paused', () => false);
  const systemReduced = useState('kojo-system-motion', () => false);
  function toggleMotion() {
    if (systemReduced.value) return;
    paused.value = !paused.value;
    try { localStorage.setItem('kojo:motion-paused', String(paused.value)); } catch { /* Optional preference. */ }
  }
  return { paused, systemReduced, toggleMotion };
}
