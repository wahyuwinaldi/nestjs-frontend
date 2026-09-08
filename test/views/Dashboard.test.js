import { mount } from '@vue/test-utils';
import Dashboard from '@/views/Dashboard.vue';
import { APP_TITLE } from '@/composables/useHelper';

describe('Dashboard.vue', () => {
  it('renders welcome copy with app title', () => {
    const wrapper = mount(Dashboard);
    expect(wrapper.text()).toContain('Selamat datang');
    expect(wrapper.text()).toContain(APP_TITLE);
    wrapper.unmount();
  });
});
