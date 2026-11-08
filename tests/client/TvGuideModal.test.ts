import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import TvGuideModal from '../../src/client/components/TvGuideModal.vue';

describe('TvGuideModal.vue', () => {
  const systemStatus = {
    disk: {
      totalBytes: 1000000000000,
      freeBytes: 850000000000,
      usedBytes: 150000000000,
      usedPercent: 15,
    },
    nextCleanAt: 'Lundi 09:00',
    totalDownSpeed: 2000000,
  };

  it('renders nothing when isOpen is false', () => {
    const wrapper = mount(TvGuideModal, {
      props: {
        isOpen: false,
        systemStatus: systemStatus as any,
        currentUser: 'Alex'
      }
    });

    expect(wrapper.find('.tv-modal-overlay').exists()).toBe(false);
  });

  it('renders TV guide with all platforms (Android TV, Apple TV, Kodi, Plex) and personalized M3U URL when isOpen is true', () => {
    const wrapper = mount(TvGuideModal, {
      props: {
        isOpen: true,
        systemStatus: systemStatus as any,
        currentUser: 'Alex'
      }
    });

    expect(wrapper.find('.tv-modal-overlay').exists()).toBe(true);
    expect(wrapper.text()).toContain('Guide Télévision & Lecteurs M3U (2026)');
    expect(wrapper.text()).toContain('TiviMate');
    expect(wrapper.text()).toContain('Apple TV');
    expect(wrapper.text()).toContain('Kodi');
    expect(wrapper.text()).toContain('Plex');

    const m3uInput = wrapper.find('.url-input');
    expect(m3uInput.exists()).toBe(true);
    expect((m3uInput.element as HTMLInputElement).value).toContain('/playlist.m3u');
    expect((m3uInput.element as HTMLInputElement).value).toContain('user=Alex');
  });

  it('emits close event when close button is clicked', async () => {
    const wrapper = mount(TvGuideModal, {
      props: {
        isOpen: true,
        systemStatus: systemStatus as any,
        currentUser: 'Alex'
      }
    });

    await wrapper.find('.btn-close').trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('includes login and password in M3U URL when authenticatedOrigin is provided', () => {
    const authStatus = {
      ...systemStatus,
      authenticatedOrigin: 'https://monuser:monpass123@peerflix.domain.com'
    };

    const wrapper = mount(TvGuideModal, {
      props: {
        isOpen: true,
        systemStatus: authStatus as any,
        currentUser: 'PC-Linux-Aigle'
      }
    });

    const m3uInput = wrapper.find('.url-input');
    expect(m3uInput.exists()).toBe(true);
    const value = (m3uInput.element as HTMLInputElement).value;
    expect(value).toBe('https://monuser:monpass123@peerflix.domain.com/playlist.m3u?user=PC-Linux-Aigle');
  });

  it('preserves login and password in M3U URL even if systemStatus authenticatedOrigin is temporarily omitted', () => {
    // When previous authenticatedOrigin was stored/cached, new render without authenticatedOrigin still uses it
    const wrapper = mount(TvGuideModal, {
      props: {
        isOpen: true,
        systemStatus: { ...systemStatus, authenticatedOrigin: undefined } as any,
        currentUser: 'PC-Linux-Aigle'
      }
    });

    const m3uInput = wrapper.find('.url-input');
    expect(m3uInput.exists()).toBe(true);
    const value = (m3uInput.element as HTMLInputElement).value;
    expect(value).toContain('monuser:monpass123@');
    expect(value).toContain('/playlist.m3u?user=PC-Linux-Aigle');
  });
});
