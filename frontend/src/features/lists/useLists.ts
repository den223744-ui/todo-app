import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../api';
import { createListMutation } from './listMutations';
import { listsQueryOptions } from './listQueries';

export function useLists() {
  return useQuery(listsQueryOptions(api));
}

export function useCreateList() {
  const queryClient = useQueryClient();
  return useMutation(createListMutation({ api, queryClient }));
}
