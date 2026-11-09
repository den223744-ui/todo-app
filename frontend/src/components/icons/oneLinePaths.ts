/*
 * Icons drawn as one continuous line, as if the pen never left the paper:
 * a 20px grid, round caps and joins, no fills. Where a shape needs a second
 * stroke (an arrow head, a tab) the line runs back over itself instead.
 */
export const ONE_LINE = {
  // A sun: the line runs round the disc and out along each ray and back.
  sun: 'M16.4 10L13.2 10A3.2 3.2 0 0 1 12.26 12.26L14.03 14.03L12.26 12.26A3.2 3.2 0 0 1 10 13.2L10 16.4L10 13.2A3.2 3.2 0 0 1 7.74 12.26L5.97 14.03L7.74 12.26A3.2 3.2 0 0 1 6.8 10L3.6 10L6.8 10A3.2 3.2 0 0 1 7.74 7.74L5.97 5.97L7.74 7.74A3.2 3.2 0 0 1 10 6.8L10 3.6L10 6.8A3.2 3.2 0 0 1 12.26 7.74L14.03 5.97L12.26 7.74A3.2 3.2 0 0 1 13.2 10',
  // A tray with its notch, outline and rim in one pass.
  inbox:
    'M3 11.5H6.6C7.1 11.5 7.4 11.8 7.6 12.2L7.9 12.8C8.1 13.2 8.4 13.5 8.9 13.5H11.1C11.6 13.5 11.9 13.2 12.1 12.8L12.4 12.2C12.6 11.8 12.9 11.5 13.4 11.5H17L15 5.6C14.7 4.9 14.1 4.5 13.4 4.5H6.6C5.9 4.5 5.3 4.9 5 5.6L3 11.5V14.4C3 15.6 3.9 16.5 5.1 16.5H14.9C16.1 16.5 17 15.6 17 14.4V11.5',
  // A calendar page; the arrow forward grows out of its left edge.
  upcoming:
    'M13 2.8V4.4H14.8C15.9 4.4 16.8 5.3 16.8 6.4V14.6C16.8 15.7 15.9 16.6 14.8 16.6H5.2C4.1 16.6 3.2 15.7 3.2 14.6V11.4H12.2L10.4 9.6L12.2 11.4L10.4 13.2L12.2 11.4H3.2V6.4C3.2 5.3 4.1 4.4 5.2 4.4H7V2.8V4.4H13',
  // An hourglass as a figure of eight.
  overdue:
    'M5.6 3H14.4C14.4 6.2 10 7.6 10 10C10 12.4 14.4 13.8 14.4 17H5.6C5.6 13.8 10 12.4 10 10C10 7.6 5.6 6.2 5.6 3Z',
  // A tick that runs on into its box, leaving the corner open.
  completed:
    'M6.8 9.8L9.2 12.2L16.4 5C16.6 5.6 16.6 6.4 16.6 7V13C16.6 15 15 16.6 13 16.6H7C5 16.6 3.4 15 3.4 13V7C3.4 5 5 3.4 7 3.4H13',
  moon: 'M17 12.5A7.5 7.5 0 0 1 7.5 3 7.5 7.5 0 1 0 17 12.5Z',
  // Screen and stand without lifting: the stem is drawn twice.
  monitor:
    'M6.4 17H10V14H4C2.9 14 2 13.1 2 12V5C2 3.9 2.9 3 4 3H16C17.1 3 18 3.9 18 5V12C18 13.1 17.1 14 16 14H10V17H13.6',
} as const;
