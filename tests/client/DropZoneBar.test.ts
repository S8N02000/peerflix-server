import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import DropZoneBar from '../../src/client/components/DropZoneBar.vue';

describe('DropZoneBar.vue Component', () => {
  it('should emit "add-link" event upon submitting a valid magnet link in form', async () => {
    const wrapper = mount(DropZoneBar);
    const magnet = 'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567';

    const input = wrapper.find('.input-link');
    await input.setValue(magnet);

    const form = wrapper.find('.add-form');
    await form.trigger('submit');

    expect(wrapper.emitted('add-link')).toBeTruthy();
    expect(wrapper.emitted('add-link')![0]).toEqual([magnet]);
    expect((wrapper.find('.input-link').element as HTMLInputElement).value).toBe('');
  });

  it('should emit "upload-files" event when dropping multiple .torrent files', async () => {
    const wrapper = mount(DropZoneBar);

    const mockFile1 = new File(['content1'], 'test1.torrent', { type: 'application/x-bittorrent' });
    const mockFile2 = new File(['content2'], 'test2.torrent', { type: 'application/x-bittorrent' });

    // Trigger drop event on window
    const dropEvent = new Event('drop') as any;
    dropEvent.preventDefault = vi.fn();
    dropEvent.dataTransfer = {
      files: [mockFile1, mockFile2]
    };

    window.dispatchEvent(dropEvent);

    expect(wrapper.emitted('upload-files')).toBeTruthy();
    const emittedFiles = wrapper.emitted('upload-files')![0][0] as File[];
    expect(emittedFiles.length).toBe(2);
    expect(emittedFiles[0].name).toBe('test1.torrent');
    expect(emittedFiles[1].name).toBe('test2.torrent');
  });

  it('should display error toast when error prop is provided', () => {
    const wrapper = mount(DropZoneBar, {
      props: {
        error: 'Espace disque insuffisant sur le serveur'
      }
    });

    const toast = wrapper.find('.error-toast');
    expect(toast.exists()).toBe(true);
    expect(toast.text()).toContain('Espace disque insuffisant sur le serveur');
  });
});
