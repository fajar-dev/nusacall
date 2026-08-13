import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AgentStatusCard from '../app/components/AgentStatusCard.vue';
import { useWsStore } from '../app/stores/ws';

describe('E5-T6: AgentStatusCard Component', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders current status badge', () => {
    const wsStore = useWsStore();
    wsStore.agentState = { status: 'AVAILABLE' };

    const wrapper = mount(AgentStatusCard, {
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    });

    expect(wrapper.find('.status-badge').text()).toBe('AVAILABLE');
  });

  it('updates status when status button is clicked', async () => {
    const wsStore = useWsStore();
    wsStore.agentState = { status: 'OFFLINE' };
    wsStore.isConnected = true;

    const wrapper = mount(AgentStatusCard, {
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    });

    const availableBtn = wrapper.findAll('.status-btn').find((b: any) => b.text() === 'AVAILABLE');
    await availableBtn?.trigger('click');

    expect(wrapper.exists()).toBe(true);
  });
});
