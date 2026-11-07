import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import FileTree from '../../src/client/components/FileTree.vue';
import type { TorrentFileDTO } from '../../src/shared/types.js';

describe('FileTree.vue Component', () => {
  const sampleFiles: TorrentFileDTO[] = [
    {
      index: 0,
      name: 'Setup.exe',
      path: 'Game/Setup.exe',
      folderPath: 'Game',
      length: 50000000,
      selected: true,
      category: 'executable',
      isComplete: true,
      streamUrl: '',
      downloadUrl: ''
    },
    {
      index: 1,
      name: 'fix.dll',
      path: 'Game/Crack/fix.dll',
      folderPath: 'Game/Crack',
      length: 200000,
      selected: true,
      category: 'executable',
      isComplete: true,
      streamUrl: '',
      downloadUrl: ''
    },
    {
      index: 2,
      name: 'sample.mkv',
      path: 'Game/sample.mkv',
      folderPath: 'Game',
      length: 1000000,
      selected: false,
      category: 'video',
      isComplete: false,
      streamUrl: '',
      downloadUrl: ''
    },
    {
      index: 3,
      name: 'visit-site.url',
      path: 'Game/visit-site.url',
      folderPath: 'Game',
      length: 100,
      selected: false,
      category: 'other',
      isComplete: false,
      streamUrl: '',
      downloadUrl: ''
    }
  ];

  it('should build hierarchical tree structure and group by folders', () => {
    const wrapper = mount(FileTree, {
      props: {
        files: sampleFiles,
        infoHash: 'test_hash',
        hideJunkFiles: false
      }
    });

    const folderHeaders = wrapper.findAll('.folder-header');
    expect(folderHeaders.length).toBeGreaterThanOrEqual(2); // Game and Crack folders
    expect(wrapper.text()).toContain('Game');
    expect(wrapper.text()).toContain('Crack');
    expect(wrapper.text()).toContain('Setup.exe');
    expect(wrapper.text()).toContain('fix.dll');
  });

  it('should hide junk files (samples, .url) when hideJunkFiles is true', () => {
    const wrapper = mount(FileTree, {
      props: {
        files: sampleFiles,
        infoHash: 'test_hash',
        hideJunkFiles: true
      }
    });

    expect(wrapper.text()).toContain('Setup.exe');
    expect(wrapper.text()).toContain('fix.dll');
    expect(wrapper.text()).not.toContain('sample.mkv');
    expect(wrapper.text()).not.toContain('visit-site.url');
  });

  it('should render folder ZIP download link for each directory', () => {
    const wrapper = mount(FileTree, {
      props: {
        files: sampleFiles,
        infoHash: 'test_hash',
        hideJunkFiles: false
      }
    });

    const zipLinks = wrapper.findAll('.btn-folder-zip');
    expect(zipLinks.length).toBeGreaterThanOrEqual(1);
    expect(zipLinks[0].attributes('href')).toContain('/torrents/test_hash/archive?folder=');
  });

  it('should support deep folder nesting (4 levels A/B/C/D/file.exe) without crashing', () => {
    const deepFiles: TorrentFileDTO[] = [
      {
        index: 0,
        name: 'file.exe',
        path: 'A/B/C/D/file.exe',
        folderPath: 'A/B/C/D',
        length: 1024,
        selected: true,
        category: 'executable',
        isComplete: true,
        streamUrl: '',
        downloadUrl: ''
      }
    ];

    const wrapper = mount(FileTree, {
      props: {
        files: deepFiles,
        infoHash: 'deep_hash',
        hideJunkFiles: false
      }
    });

    expect(wrapper.text()).toContain('A');
    expect(wrapper.text()).toContain('B');
    expect(wrapper.text()).toContain('C');
    expect(wrapper.text()).toContain('D');
    expect(wrapper.text()).toContain('file.exe');
  });

  it('should render batch selection buttons when files.length > 1 and emit select-all / deselect-all', async () => {
    const wrapper = mount(FileTree, {
      props: {
        files: sampleFiles,
        infoHash: 'batch_hash',
        hideJunkFiles: false
      }
    });

    const toolbar = wrapper.find('.file-tree-toolbar');
    expect(toolbar.exists()).toBe(true);
    expect(wrapper.text()).toContain('2 / 4 fichiers sélectionnés');

    const buttons = wrapper.findAll('.btn-batch-select');
    expect(buttons.length).toBe(2);

    // Click "Tout cocher"
    await buttons[0].trigger('click');
    expect(wrapper.emitted('select-all')).toBeTruthy();

    // Click "Tout décocher"
    await buttons[1].trigger('click');
    expect(wrapper.emitted('deselect-all')).toBeTruthy();
  });
});
