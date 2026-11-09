// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { AutosizeTextarea } from './AutosizeTextarea';

afterEach(() => {
  vi.restoreAllMocks();
});

it('grows for long text and shrinks after replacing it, keeping two native rows', () => {
  let height = 60;
  vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockImplementation(() => height);
  const { rerender } = render(<AutosizeTextarea aria-label="Заметки" value="Коротко" readOnly />);
  const field = screen.getByRole('textbox');
  expect(field).toHaveAttribute('rows', '2');
  expect(field).toHaveStyle({ height: '60px' });
  height = 180;
  rerender(<AutosizeTextarea aria-label="Заметки" value="Много строк" readOnly />);
  expect(field).toHaveStyle({ height: '180px' });
  height = 60;
  rerender(<AutosizeTextarea aria-label="Заметки" value="" readOnly />);
  expect(field).toHaveStyle({ height: '60px' });
});
