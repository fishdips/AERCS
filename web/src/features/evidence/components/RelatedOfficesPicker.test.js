import { fireEvent, render, screen } from '@testing-library/react';
import RelatedOfficesPicker from './RelatedOfficesPicker';

const search = () => screen.getByLabelText('Search related offices');

test('shows every office until something is typed', () => {
  render(<RelatedOfficesPicker selected={[]} onToggle={() => {}} />);
  expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(15);
});

test('filters by words in any order, case-insensitively', () => {
  render(<RelatedOfficesPicker selected={[]} onToggle={() => {}} />);
  fireEvent.change(search(), { target: { value: 'NURSING health' } });
  const boxes = screen.getAllByRole('checkbox');
  expect(boxes).toHaveLength(1);
  expect(screen.getByText('College of Nursing and Allied Health Sciences')).toBeInTheDocument();
});

test('shows an empty message when nothing matches', () => {
  render(<RelatedOfficesPicker selected={[]} onToggle={() => {}} />);
  fireEvent.change(search(), { target: { value: 'zzzz' } });
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  expect(screen.getByText(/No offices match/)).toBeInTheDocument();
});

test('toggling a filtered office reports its value, and the selected count stays', () => {
  const onToggle = jest.fn();
  render(<RelatedOfficesPicker selected={['FINANCE_OFFICE', 'LIBRARY']} onToggle={onToggle} />);
  fireEvent.change(search(), { target: { value: 'guidance' } });
  expect(screen.getByText('2 selected')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox'));
  expect(onToggle).toHaveBeenCalledWith('GUIDANCE_CENTER');
});
