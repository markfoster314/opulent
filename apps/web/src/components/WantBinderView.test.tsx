import { render, screen } from '@testing-library/react';
import type { WantItem } from '@opulent/shared';
import { describe, expect, it } from 'vitest';
import { WantBinderView } from './WantBinderView';

function want(id: string, quantity: number): WantItem {
  return {
    id,
    userId: '00000000-0000-4000-8000-000000000000',
    oracleId: '00000000-0000-4000-8000-000000000001',
    cardName: 'Test Card',
    quantity,
    priority: 2,
    notes: null,
    wantedLanguages: [],
    wantedFinishes: [],
    wantedConditions: [],
    wantedSets: [],
    lists: [],
  };
}

describe('WantBinderView', () => {
  it('shows the quantity sticker only above one copy', () => {
    render(<WantBinderView items={[want('one', 1), want('two', 2)]} />);
    expect(screen.queryByText('×1')).not.toBeInTheDocument();
    expect(screen.getByText('×2')).toBeInTheDocument();
  });
});
