import { fireEvent, within } from '@testing-library/react';
import readExcelFile from 'read-excel-file/browser';
import { renderSpreadsheet } from './evidenceRenderers';

// The PDF / Word / Excel libraries can't run under Jest; only the worksheet tabs are tested here.
jest.mock('pdfjs-dist/build/pdf', () => ({ GlobalWorkerOptions: {}, version: 'test' }));
jest.mock('docx-preview', () => ({ renderAsync: jest.fn() }));
jest.mock('read-excel-file/browser', () => jest.fn());

async function draw(sheets) {
  readExcelFile.mockResolvedValue(sheets);
  const host = document.createElement('div');
  document.body.appendChild(host);
  await renderSpreadsheet(new Blob(['x']), host);
  const view = within(host);
  return {
    view,
    tabs: () => view.getAllByRole('tab'),
    // Hidden worksheets are still in the page, so ask for them explicitly.
    panels: () => view.getAllByRole('tabpanel', { hidden: true }),
  };
}

const visibility = (panels) => panels.map((panel) => !panel.hidden);

afterEach(() => {
  document.body.replaceChildren();
});

test('shows one worksheet at a time with a tab for each', async () => {
  const sheet = await draw([
    { sheet: 'Attendance', data: [['Name'], ['Ana']] },
    { sheet: 'Summary', data: [['Total'], [1]] },
    { sheet: 'Notes', data: [['Remark']] },
  ]);

  expect(sheet.tabs().map((tab) => tab.textContent)).toEqual(['Attendance', 'Summary', 'Notes']);
  expect(visibility(sheet.panels())).toEqual([true, false, false]);
  expect(sheet.tabs().map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
});

test('clicking a tab switches the visible worksheet', async () => {
  const sheet = await draw([
    { sheet: 'A', data: [['first']] },
    { sheet: 'B', data: [['second']] },
  ]);

  fireEvent.click(sheet.tabs()[1]);

  expect(visibility(sheet.panels())).toEqual([false, true]);
  expect(within(sheet.panels()[1]).getByRole('cell').textContent).toBe('second');
});

test('a worksheet table is only built when its tab is first opened', async () => {
  const sheet = await draw([
    { sheet: 'A', data: [['a']] },
    { sheet: 'B', data: [['b']] },
  ]);

  expect(within(sheet.panels()[0]).getByRole('table')).toBeTruthy();
  expect(within(sheet.panels()[1]).queryByRole('table', { hidden: true })).toBeNull();

  fireEvent.click(sheet.tabs()[1]);
  expect(within(sheet.panels()[1]).getByRole('table')).toBeTruthy();
});

test('arrow keys move between tabs and wrap around', async () => {
  const sheet = await draw([
    { sheet: 'A', data: [['a']] },
    { sheet: 'B', data: [['b']] },
    { sheet: 'C', data: [['c']] },
  ]);

  fireEvent.keyDown(sheet.tabs()[0], { key: 'ArrowRight' });
  expect(visibility(sheet.panels())).toEqual([false, true, false]);

  fireEvent.keyDown(sheet.tabs()[1], { key: 'End' });
  expect(visibility(sheet.panels())).toEqual([false, false, true]);

  fireEvent.keyDown(sheet.tabs()[2], { key: 'ArrowRight' });
  expect(visibility(sheet.panels())).toEqual([true, false, false]);
});

test('tabs are type=button so they never submit a surrounding form', async () => {
  const sheet = await draw([{ sheet: 'A', data: [['a']] }]);
  expect(sheet.tabs()[0].type).toBe('button');
});

test('cell text is inserted as text, not markup', async () => {
  const sheet = await draw([{ sheet: 'A', data: [['<img src=x onerror=alert(1)>']] }]);
  expect(sheet.view.queryByRole('img')).toBeNull();
  expect(sheet.view.getByRole('cell').textContent).toBe('<img src=x onerror=alert(1)>');
});

test('empty worksheets and workbooks get a message', async () => {
  const blank = await draw([{ sheet: 'Blank', data: [] }]);
  expect(blank.view.getByText('This worksheet is empty.')).not.toBeNull();

  const none = await draw([]);
  expect(none.view.getByText('This workbook has no worksheets.')).not.toBeNull();
});

test('a very long worksheet shows a truncation note', async () => {
  const rows = Array.from({ length: 1200 }, (_, i) => [i]);
  const sheet = await draw([{ sheet: 'Big', data: rows }]);
  expect(sheet.view.getAllByRole('row')).toHaveLength(1000);
  expect(sheet.view.getByText('Showing the first 1000 of 1200 rows.')).not.toBeNull();
});
