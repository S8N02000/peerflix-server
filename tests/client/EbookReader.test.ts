import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import {
  isEbookFile,
  getEbookFormat,
  getReaderPreferences,
  saveReaderPreferences,
  getSavedEbookPosition,
  saveEbookPosition,
} from '../../src/client/utils/ebook-helper.js';
import FileTree from '../../src/client/components/FileTree.vue';
import EbookReaderModal from '../../src/client/components/EbookReaderModal.vue';
import type { TorrentFileDTO, TorrentDTO } from '../../src/shared/types.js';

describe('eBook & Comic Reader Module', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('ebook-helper.ts format detection', () => {
    it('identifies EPUB files correctly', () => {
      expect(isEbookFile('book.epub')).toBe(true);
      expect(getEbookFormat('book.epub')).toBe('epub');
      expect(getEbookFormat('book.mobi')).toBe('epub');
      expect(getEbookFormat('book.azw3')).toBe('epub');
      expect(getEbookFormat('book.fb2')).toBe('epub');
    });

    it('identifies PDF and DJVU files correctly', () => {
      expect(isEbookFile('document.pdf')).toBe(true);
      expect(getEbookFormat('document.pdf')).toBe('pdf');
      expect(getEbookFormat('scan.djvu')).toBe('pdf');
    });

    it('identifies CBZ and CBR comic archives correctly', () => {
      expect(isEbookFile('manga_vol_01.cbz')).toBe(true);
      expect(getEbookFormat('manga_vol_01.cbz')).toBe('comic');
      expect(getEbookFormat('comic_issue_1.cbr')).toBe('comic');
    });

    it('returns false and other for non-ebook files', () => {
      expect(isEbookFile('movie.mkv')).toBe(false);
      expect(isEbookFile('song.mp3')).toBe(false);
      expect(isEbookFile('archive.zip')).toBe(false);
      expect(getEbookFormat('movie.mkv')).toBe('other');
    });
  });

  describe('localStorage persistence', () => {
    it('saves and restores reading positions', () => {
      expect(getSavedEbookPosition('hash123', 0)).toBeNull();
      saveEbookPosition('hash123', 0, 'epubcfi(/6/4[chap01]!/4/2/10)');
      expect(getSavedEbookPosition('hash123', 0)).toBe('epubcfi(/6/4[chap01]!/4/2/10)');
    });

    it('saves and merges reader preferences', () => {
      const defaultPrefs = getReaderPreferences();
      expect(defaultPrefs.theme).toBe('dark');
      expect(defaultPrefs.fontSize).toBe(18);

      saveReaderPreferences({ theme: 'sepia', fontSize: 22 });
      const updated = getReaderPreferences();
      expect(updated.theme).toBe('sepia');
      expect(updated.fontSize).toBe(22);
      expect(updated.fontFamily).toBe('serif'); // Preserved default
    });
  });

  describe('FileTree integration with eBook files', () => {
    const ebookFiles: TorrentFileDTO[] = [
      {
        index: 0,
        name: 'Dune.epub',
        path: 'Books/Dune.epub',
        folderPath: 'Books',
        length: 2500000,
        selected: true,
        category: 'document',
        isComplete: true,
        streamUrl: '/torrents/hash_dune/files/0',
        downloadUrl: '/torrents/hash_dune/files/0/download',
      },
      {
        index: 1,
        name: 'Berserk_Tome_01.cbz',
        path: 'Books/Berserk_Tome_01.cbz',
        folderPath: 'Books',
        length: 85000000,
        selected: true,
        category: 'archive',
        isComplete: true,
        streamUrl: '/torrents/hash_dune/files/1',
        downloadUrl: '/torrents/hash_dune/files/1/download',
      },
      {
        index: 2,
        name: 'Notes.txt',
        path: 'Books/Notes.txt',
        folderPath: 'Books',
        length: 1200,
        selected: true,
        category: 'document',
        isComplete: true,
        streamUrl: '/torrents/hash_dune/files/2',
        downloadUrl: '/torrents/hash_dune/files/2/download',
      },
    ];

    it('renders 📖 Lire button for EPUB and CBZ files but not for TXT', () => {
      const wrapper = mount(FileTree, {
        props: {
          files: ebookFiles,
          infoHash: 'hash_dune',
          hideJunkFiles: false,
        },
      });

      const readButtons = wrapper.findAll('.btn-action.read');
      expect(readButtons.length).toBe(2); // Dune.epub & Berserk_Tome_01.cbz
    });

    it('emits read-ebook event when clicking 📖 Lire', async () => {
      const wrapper = mount(FileTree, {
        props: {
          files: ebookFiles,
          infoHash: 'hash_dune',
          hideJunkFiles: false,
        },
      });

      const readButtons = wrapper.findAll('.btn-action.read');
      await readButtons[0].trigger('click');

      expect(wrapper.emitted('read-ebook')).toBeTruthy();
      expect(wrapper.emitted('read-ebook')![0][0]).toEqual(ebookFiles[1]); // Alphabetical sort puts Berserk before Dune
    });
  });

  describe('EbookReaderModal.vue Component', () => {
    const mockTorrent: TorrentDTO = {
      infoHash: 'hash_dune',
      name: 'Dune Collection',
      totalLength: 87500000,
      downloaded: 87500000,
      uploaded: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      progress: 1,
      isFullyDownloaded: true,
      timeRemaining: 0,
      peers: 10,
      category: 'document',
      isPinned: false,
      isPrivate: false,
      files: [],
    };

    const mockEpubFile: TorrentFileDTO = {
      index: 0,
      name: 'Dune.epub',
      path: 'Dune.epub',
      folderPath: '',
      length: 2500000,
      selected: true,
      category: 'document',
      isComplete: true,
      streamUrl: '/torrents/hash_dune/files/0',
      downloadUrl: '/torrents/hash_dune/files/0/download',
    };

    it('renders header with EPUB format badge and controls', () => {
      const wrapper = mount(EbookReaderModal, {
        props: {
          file: mockEpubFile,
          torrent: mockTorrent,
        },
      });

      expect(wrapper.text()).toContain('EPUB');
      expect(wrapper.text()).toContain('Dune.epub');
      expect(wrapper.find('.theme-selector-group').exists()).toBe(true);
      expect(wrapper.find('.font-controls-group').exists()).toBe(true);
    });

    it('emits close event when clicking close button', async () => {
      const wrapper = mount(EbookReaderModal, {
        props: {
          file: mockEpubFile,
          torrent: mockTorrent,
        },
      });

      const closeBtn = wrapper.find('.btn-close');
      expect(closeBtn.exists()).toBe(true);
      await closeBtn.trigger('click');
      expect(wrapper.emitted('close')).toBeTruthy();
    });

    it('adapts comic mode controls for CBZ files', () => {
      const comicFile: TorrentFileDTO = {
        ...mockEpubFile,
        name: 'Berserk.cbz',
        path: 'Berserk.cbz',
      };

      const wrapper = mount(EbookReaderModal, {
        props: {
          file: comicFile,
          torrent: mockTorrent,
        },
      });

      expect(wrapper.text()).toContain('BD / Manga');
      expect(wrapper.find('.comic-mode-group').exists()).toBe(true);
      expect(wrapper.text()).toContain('Webtoon');
    });

    it('adapts controls and iframe stage for PDF files', () => {
      const pdfFile: TorrentFileDTO = {
        ...mockEpubFile,
        name: 'Report.pdf',
        path: 'Report.pdf',
      };

      const wrapper = mount(EbookReaderModal, {
        props: {
          file: pdfFile,
          torrent: mockTorrent,
        },
      });

      expect(wrapper.text()).toContain('PDF');
      expect(wrapper.find('iframe').exists()).toBe(true);
    });
  });
});
