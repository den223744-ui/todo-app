import { LIST_TITLES } from '../../constants/texts';
import type { View } from '../../domain/view';

export function viewTitle(view: View): string {
  return view.kind === 'list' ? LIST_TITLES[view.list] : `#${view.tag}`;
}
