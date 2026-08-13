import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import SoftphoneDock from '../app/components/SoftphoneDock.vue';
import { useSoftphoneStore } from '../app/stores/softphone';

describe('E7-T7: SoftphoneDock.vue Component & Keyboard Shortcuts', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should render IDLE state UI correctly', () => {
    const wrapper = mount(SoftphoneDock);
    expect(wrapper.text()).toContain('IDLE');
    expect(wrapper.text()).toContain('Siap Menerima Panggilan');
  });

  it('should render RINGING_IN state UI with Answer and Reject buttons', () => {
    const store = useSoftphoneStore();
    store.handleOffer({
      callId: 'call_100',
      fromNumber: '628123456789',
      toNumber: '628987654321',
      direction: 'INBOUND',
    });

    const wrapper = mount(SoftphoneDock);
    expect(wrapper.text()).toContain('RINGING_IN');
    expect(wrapper.find('.btn-success').text()).toContain('Jawab');
    expect(wrapper.find('.btn-danger').text()).toContain('Tolak');
  });

  it('should answer call when Answer button is clicked', async () => {
    const store = useSoftphoneStore();
    store.handleOffer({
      callId: 'call_100',
      fromNumber: '628123456789',
      toNumber: '628987654321',
      direction: 'INBOUND',
    });

    const wrapper = mount(SoftphoneDock);
    await wrapper.find('.btn-success').trigger('click');

    expect(store.currentState).toBe('CONNECTING');
  });

  it('should handle keyboard shortcut Alt+A to answer call in RINGING_IN state', () => {
    const store = useSoftphoneStore();
    store.handleOffer({
      callId: 'call_100',
      fromNumber: '628123456789',
      toNumber: '628987654321',
      direction: 'INBOUND',
    });

    mount(SoftphoneDock);

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'KeyA',
        altKey: true,
      })
    );

    expect(store.currentState).toBe('CONNECTING');
  });
});
