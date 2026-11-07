<script setup lang="ts">
// Informative static component displaying shortcut helper
</script>

<template>
  <div class="modal-footer">
    <div class="hotkeys-guide">
      <span class="hotkey"><kbd>Espace</kbd> Lecture / Pause</span>
      <span class="hotkey"><kbd>←</kbd> <kbd>→</kbd> Reculer / Avancer (10s)</span>
      <span class="hotkey"><kbd>M</kbd> Muet</span>
      <span class="hotkey"><kbd>F</kbd> Plein écran</span>
      <span class="hotkey"><kbd>Échap</kbd> Fermer</span>
    </div>
  </div>
</template>

<style scoped>
.modal-footer {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.2);
}

.hotkeys-guide {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  font-size: 0.75rem;
  color: #94a3b8;
  flex-wrap: wrap;
}

.hotkey {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

kbd {
  background: #334155;
  color: #f1f5f9;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 0.25rem;
  padding: 0.15rem 0.4rem;
  font-size: 0.7rem;
  font-family: ui-monospace, monospace;
}
</style>
