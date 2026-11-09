import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { createQueryClient } from '../api/queryClient';
import { mutationErrorToast } from '../features/toasts/mutationToast';
import { useToastStore } from '../store/toastStore';

export function AppProviders({ children }: { children: ReactNode }) {
  // One client per app instance (not per render).
  const [queryClient] = useState(() =>
    createQueryClient({
      onMutationError: (error, mutation) => {
        const message = mutationErrorToast(mutation.meta, mutation.state.variables, error);
        if (message) useToastStore.getState().showToast(message);
      },
    }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
