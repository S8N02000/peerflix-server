<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  isSubmitting?: boolean;
  error?: string | null;
}>();

const emit = defineEmits<{
  (e: 'add-link', link: string): void;
  (e: 'upload-files', files: FileList | File[]): void;
}>();

const linkInput = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const isDraggingOverWindow = ref(false);

const handleLinkSubmit = () => {
  const trimmed = linkInput.value.trim();
  if (!trimmed || props.isSubmitting) return;
  emit('add-link', trimmed);
  linkInput.value = '';
};

const triggerFileInput = () => {
  fileInput.value?.click();
};

const onFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    emit('upload-files', target.files);
    target.value = '';
  }
};

// Window-wide drag and drop
const onWindowDragOver = (e: DragEvent) => {
  e.preventDefault();
  isDraggingOverWindow.value = true;
};

const onWindowDragLeave = (e: DragEvent) => {
  e.preventDefault();
  if (e.relatedTarget === null) {
    isDraggingOverWindow.value = false;
  }
};

const onWindowDrop = (e: DragEvent) => {
  e.preventDefault();
  isDraggingOverWindow.value = false;
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    emit('upload-files', e.dataTransfer.files);
  }
};

// Window-wide paste (Ctrl+V) for magnet links
const onWindowPaste = (e: ClipboardEvent) => {
  const activeElement = document.activeElement;
  if (
    activeElement &&
    (activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      (activeElement as HTMLElement).isContentEditable)
  ) {
    return;
  }

  const pastedText = e.clipboardData?.getData('text')?.trim();
  if (
    pastedText &&
    (pastedText.startsWith('magnet:?') ||
      /^[0-9a-fA-F]{40}$/.test(pastedText) ||
      /^[2-7a-zA-Z]{32}$/.test(pastedText))
  ) {
    emit('add-link', pastedText);
  }
};

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('dragover', onWindowDragOver);
    window.addEventListener('dragleave', onWindowDragLeave);
    window.addEventListener('drop', onWindowDrop);
    window.addEventListener('paste', onWindowPaste);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('dragover', onWindowDragOver);
    window.removeEventListener('dragleave', onWindowDragLeave);
    window.removeEventListener('drop', onWindowDrop);
    window.removeEventListener('paste', onWindowPaste);
  }
});
</script>

<template>
  <div class="dropzone-bar-wrapper">
    <!-- Global Fullscreen Drag Overlay -->
    <div v-if="isDraggingOverWindow" class="fullscreen-drag-overlay" @drop="onWindowDrop">
      <div class="drag-overlay-card">
        <div class="drag-icon">📥</div>
        <h3>Relâchez vos fichiers .torrent ici</h3>
        <p>Ils seront ajoutés automatiquement au serveur</p>
      </div>
    </div>

    <!-- Error Toast -->
    <div v-if="error" class="error-toast" role="alert">
      <span class="error-icon">⚠️</span>
      <span class="error-msg">{{ error }}</span>
    </div>

    <!-- Main Add Bar -->
    <div class="add-bar">
      <form class="add-form" @submit.prevent="handleLinkSubmit">
        <div class="input-group">
          <span class="input-icon">🔗</span>
          <input
            v-model="linkInput"
            type="text"
            class="input-link"
            placeholder="Coller un lien Magnet ou InfoHash (ou glisser un .torrent n'importe où)"
            :disabled="isSubmitting"
          />
        </div>
        <button type="submit" class="btn-submit" :disabled="!linkInput.trim() || isSubmitting">
          {{ isSubmitting ? 'Ajout en cours...' : 'Ajouter' }}
        </button>
      </form>

      <div class="file-browse-group">
        <input
          ref="fileInput"
          type="file"
          multiple
          accept=".torrent"
          class="hidden-file-input"
          @change="onFileChange"
        />
        <button
          type="button"
          class="btn-browse"
          :disabled="isSubmitting"
          @click="triggerFileInput"
        >
          📂 Parcourir (.torrent)
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dropzone-bar-wrapper {
  margin: 1.25rem auto;
  max-width: 1100px;
  padding: 0 1rem;
}

.add-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #1e293b;
  padding: 0.5rem 0.75rem;
  border-radius: 0.625rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
  flex-wrap: wrap;
}

.add-form {
  display: flex;
  flex: 1;
  gap: 0.5rem;
  min-width: 280px;
}

.input-group {
  display: flex;
  align-items: center;
  flex: 1;
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
  padding: 0 0.75rem;
  transition: border-color 0.2s;
}

.input-group:focus-within {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.input-icon {
  margin-right: 0.5rem;
  opacity: 0.6;
}

.input-link {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #f3f4f6;
  font-size: 0.875rem;
  padding: 0.6rem 0;
}

.input-link::placeholder {
  color: #64748b;
}

.btn-submit {
  background: #10b981;
  color: white;
  border: none;
  border-radius: 0.375rem;
  padding: 0.6rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
}

.btn-submit:hover:not(:disabled) {
  background: #059669;
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.file-browse-group {
  display: flex;
  align-items: center;
}

.hidden-file-input {
  display: none;
}

.btn-browse {
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
  padding: 0.6rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.btn-browse:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
}

.fullscreen-drag-overlay {
  position: fixed;
  inset: 0;
  background: rgba(11, 15, 25, 0.88);
  backdrop-filter: blur(8px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px dashed #10b981;
  pointer-events: all;
}

.drag-overlay-card {
  text-align: center;
  color: #f3f4f6;
  background: #1e293b;
  padding: 2.5rem 3.5rem;
  border-radius: 1rem;
  border: 1px solid rgba(16, 185, 129, 0.4);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
}

.drag-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.error-toast {
  margin-bottom: 0.75rem;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  padding: 0.6rem 1rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

@media (max-width: 640px) {
  .add-bar {
    flex-direction: column;
    align-items: stretch;
  }
  .add-form {
    flex-direction: column;
  }
  .btn-browse {
    width: 100%;
    text-align: center;
  }
}
</style>
