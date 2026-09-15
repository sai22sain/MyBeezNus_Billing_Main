jest.mock('../../supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'test-token' } } }),
    },
  },
}));

import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import Support from '../Support';

const TICKET = {
  id: 'a1b2c3d4-1111-4aaa-8bbb-ccccddddeeee',
  app: 'billing',
  subject: 'Bill PDF not opening',
  message: 'It fails when I click download.',
  status: 'open',
  admin_reply: 'We are looking into it.',
  created_at: '2026-09-15T10:00:00.000Z',
  replies: [{ id: 'r1', sender: 'user', message: 'Any update?', created_at: '2026-09-15T11:00:00.000Z' }],
};

describe('Support page – ticket ID badge', () => {
  let container;
  let root;
  let writeText;
  let originalFetch;

  beforeEach(async () => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ tickets: [TICKET] }),
    }));
    writeText = jest.fn(async () => {});
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });
    await act(async () => { root.render(<Support />); });
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
    global.fetch = originalFetch;
  });

  it('shows a "Ticket #<short id>" badge next to the subject', () => {
    expect(container.textContent).toContain('Bill PDF not opening');
    expect(container.textContent).toContain('Ticket #A1B2C3D4');
  });

  it('copies the full ticket id when the copy button is clicked', async () => {
    const btn = container.querySelector('.support-ticket-copy');
    expect(btn).not.toBeNull();
    await act(async () => { btn.click(); });
    expect(writeText).toHaveBeenCalledWith(TICKET.id);
    expect(container.querySelector('.support-ticket-copy-hint').textContent).toBe('Copied!');
  });

  it('leaves status, replies and the follow-up action intact', async () => {
    expect(container.querySelector('.support-ticket-status').textContent).toBe('open');
    expect(container.textContent).toContain('We are looking into it.');
    expect(container.textContent).toContain('Any update?');
    expect(container.querySelector('.support-followup-btn')).not.toBeNull();

    await act(async () => { container.querySelector('.support-followup-btn').click(); });
    expect(container.querySelector('.support-followup textarea')).not.toBeNull();
  });
});