import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import C411TorrentDetailsModal from '../../src/client/components/C411TorrentDetailsModal.vue';
import type { C411SearchResultDTO } from '../../src/shared/types.js';

const { mockDetails } = vi.hoisted(() => ({
  mockDetails: {
    id: 'civil3d_id_12345',
    title: 'Autodesk.Civil.3D.v2027.MAGNiTUDE.[WIN.X64.MULTI.CRACK]',
    size: 4724464025,
    descriptionHtml: `
      <div style="text-align:center;">
        <h3>AUTODESK CIVIL 3D 2027</h3>
        <img src="https://img.c411.org/covers/civil3d.png" alt="cover" />
      </div>
      <p>Logiciel de conception et de documentation pour le génie civil.</p>
    `,
    nfo: '1. Installer Civil 3D 2027\n2. Remplacer les DLL dans le dossier d\'installation\n3. Enjoy !',
    comments: [
      {
        author: 'IngenieurTP',
        avatarUrl: 'https://img.c411.org/avatars/ing.jpg',
        date: 'hier',
        content: 'Fonctionne impeccablement avec Windows 11 23H2 ! Merci pour le partage.'
      }
    ],
    c411PageUrl: 'https://c411.org/torrents/9999'
  }
}));

vi.mock('../../src/client/services/api.js', () => ({
  fetchC411Details: vi.fn().mockImplementation(() => Promise.resolve(mockDetails)),
  addC411Torrent: vi.fn().mockImplementation(() => Promise.resolve({ infoHash: 'hash_789' }))
}));

describe('C411TorrentDetailsModal.vue', () => {
  const sampleItem: C411SearchResultDTO = {
    id: 'civil3d_id_12345',
    title: 'Autodesk.Civil.3D.v2027.MAGNiTUDE.[WIN.X64.MULTI.CRACK]',
    size: 4724464025,
    pubDate: '2025-03-01T12:00:00Z',
    seeders: 42,
    leechers: 8,
    completed: 95,
    isFreeleech: false,
    categoryName: 'Applications',
    posterUrl: 'https://img.c411.org/covers/civil3d.png'
  };

  it('renders nothing when isOpen is false', () => {
    const wrapper = mount(C411TorrentDetailsModal, {
      props: {
        isOpen: false,
        item: sampleItem
      }
    });

    expect(wrapper.find('.c411-modal-overlay').exists()).toBe(false);
  });

  it('renders modal with rich description, NFO, and comments when isOpen is true', async () => {
    const wrapper = mount(C411TorrentDetailsModal, {
      props: {
        isOpen: true,
        item: sampleItem
      }
    });

    // Wait for async loadDetails
    await new Promise((r) => setTimeout(r, 60));

    expect(wrapper.find('.c411-modal-window').exists()).toBe(true);
    expect(wrapper.text()).toContain('Autodesk');
    expect(wrapper.text()).toContain('Seeders :');
    expect(wrapper.text()).toContain('42');

    // Tab 1: Presentation / Description
    expect(wrapper.html()).toContain('AUTODESK CIVIL 3D 2027');
    expect(wrapper.html()).toContain('génie civil');

    // Switch to Tab 2: Comments
    const tabs = wrapper.findAll('.modal-tab-btn');
    const commentsTab = tabs.find((t) => t.text().includes('Commentaires'));
    expect(commentsTab).toBeDefined();
    await commentsTab!.trigger('click');

    expect(wrapper.text()).toContain('IngenieurTP');
    expect(wrapper.text()).toContain('Windows 11 23H2');

    // Switch to Tab 3: NFO
    const nfoTab = tabs.find((t) => t.text().includes('NFO'));
    expect(nfoTab).toBeDefined();
    await nfoTab!.trigger('click');

    expect(wrapper.text()).toContain('Remplacer les DLL');

    // Emits add on button click
    const addBtn = wrapper.find('.btn-modal-add');
    await addBtn.trigger('click');
    expect(wrapper.emitted('add')).toBeTruthy();
    expect(wrapper.emitted('add')![0]).toEqual(['civil3d_id_12345']);

    // Emits close on close button click
    const closeBtn = wrapper.find('.btn-modal-close');
    await closeBtn.trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });
});
