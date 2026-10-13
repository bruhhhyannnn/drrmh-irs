// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PeopleDrawer } from './people-drawer';

const CONDITIONS = [
  { id: 'minor', name: 'Minor injuries' },
  { id: 'serious', name: 'Serious injuries' },
];

function renderDrawer(props: Partial<React.ComponentProps<typeof PeopleDrawer>> = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <PeopleDrawer
      kind="missing"
      open
      people={[]}
      conditions={CONDITIONS}
      onSave={onSave}
      onClose={onClose}
      {...(props as object)}
    />
  );
  return { onSave, onClose, user: userEvent.setup() };
}

describe('PeopleDrawer', () => {
  it('adds a missing person and saves the list on Done', async () => {
    const { onSave, onClose, user } = renderDrawer({ audience: 'ert' });

    await user.type(screen.getByLabelText(/Name/), 'Maria Santos');
    await user.type(screen.getByLabelText(/Age/), '3a4');
    await user.click(screen.getByRole('radio', { name: 'Female' }));
    await user.click(screen.getByRole('button', { name: 'Add to list' }));

    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('Female · 34 yrs')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Done (1)' }));
    expect(onSave).toHaveBeenCalledWith([{ name: 'Maria Santos', age: 34, sex: 'female' }]);
    expect(onClose).toHaveBeenCalled();
  });

  it('needs a name from ERT members', async () => {
    const ert = renderDrawer({ audience: 'ert' });
    await ert.user.click(screen.getByRole('button', { name: 'Add to list' }));
    expect(screen.getByText('Enter a name.')).toBeInTheDocument();
  });

  it('lists a bystander’s unnamed person as unknown', async () => {
    const { user } = renderDrawer();
    await user.click(screen.getByRole('button', { name: 'Add to list' }));

    expect(screen.queryByText('Enter a name.')).not.toBeInTheDocument();
    expect(screen.getByText('Unknown person')).toBeInTheDocument();
  });

  it('rejects an age over 130', async () => {
    const { onSave, user } = renderDrawer();
    await user.type(screen.getByLabelText(/Age/), '150');
    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.getByText('Enter an age from 0 to 130.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps a filled casualty on Done once it has a condition', async () => {
    const { onSave, user } = renderDrawer({ kind: 'casualty' });

    await user.type(screen.getByLabelText(/What you can see/), 'Cut on the left arm');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByText('Pick a condition.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole('radio', { name: 'Minor injuries' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onSave).toHaveBeenCalledWith([
      {
        name: '',
        age: null,
        sex: 'unknown',
        condition_id: 'minor',
        diagnosis: 'Cut on the left arm',
      },
    ]);
  });

  it('drops this visit’s changes on Cancel', async () => {
    const { onSave, onClose, user } = renderDrawer({
      people: [{ name: 'Maria Santos', age: 34, sex: 'female' }],
    });

    await user.click(screen.getByRole('button', { name: 'Remove Maria Santos' }));
    expect(screen.queryByText('Maria Santos')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
