import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import AppHeader from '../../src/client/components/AppHeader.vue';
import type { SystemStatusDTO } from '../../src/shared/types.js';

describe('AppHeader.vue Component', () => {
  const makeStatus = (usedPercent: number): SystemStatusDTO => ({
    disk: {
      totalBytes: 200 * 1024 * 1024 * 1024, // 200 GB
      usedBytes: (200 * usedPercent / 100) * 1024 * 1024 * 1024,
      freeBytes: (200 * (100 - usedPercent) / 100) * 1024 * 1024 * 1024,
      usedPercent
    },
    nextCleanAt: '2026-11-09T09:00:00.000Z',
    totalDownSpeed: 0
  });

  it('should render storage info correctly with disk-normal class when disk usage is < 75%', () => {
    const wrapper = mount(AppHeader, {
      props: {
        systemStatus: makeStatus(50)
      }
    });

    expect(wrapper.text()).toContain('Stockage :');
    expect(wrapper.text()).toContain('100 Go / 200 Go (100 Go libres)');
    expect(wrapper.text()).toContain('50%');

    const gauge = wrapper.find('.disk-gauge-container');
    expect(gauge.classes()).toContain('disk-normal');
    expect(gauge.classes()).not.toContain('disk-danger');
  });

  it('should switch to disk-warning when usage is between 75% and 89%', () => {
    const wrapper = mount(AppHeader, {
      props: {
        systemStatus: makeStatus(80)
      }
    });

    const gauge = wrapper.find('.disk-gauge-container');
    expect(gauge.classes()).toContain('disk-warning');
  });

  it('should switch to disk-danger when usage is >= 90%', () => {
    const wrapper = mount(AppHeader, {
      props: {
        systemStatus: makeStatus(95)
      }
    });

    const gauge = wrapper.find('.disk-gauge-container');
    expect(gauge.classes()).toContain('disk-danger');
    expect(wrapper.text()).toContain('95%');
  });

  it('should render auto clean badge and playlist buttons', () => {
    const wrapper = mount(AppHeader, {
      props: {
        systemStatus: makeStatus(50)
      }
    });

    expect(wrapper.text()).toContain('Nettoyage auto : Lun. 09h00');
    expect(wrapper.find('.btn-playlist').exists()).toBe(true);
    expect(wrapper.find('.btn-copy-playlist').exists()).toBe(true);
  });

  it('should emit clean-unpinned when clean button is confirmed', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const wrapper = mount(AppHeader, {
      props: {
        systemStatus: makeStatus(50)
      }
    });

    const cleanBtn = wrapper.find('.clean-badge');
    await cleanBtn.trigger('click');

    expect(confirmSpy).toHaveBeenCalled();
    expect(wrapper.emitted('clean-unpinned')).toBeTruthy();

    confirmSpy.mockRestore();
  });
});
