import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../api';
import { createListMutation, updateListMutation, deleteListMutation } from './listMutations';
import { listsQueryOptions } from './listQueries';

export function useLists() {
  const queryClient = useQueryClient();
  return useQuery(listsQueryOptions(api, queryClient));
}

export function useUpdateList() {
  const queryClient = useQueryClient();
  return useMutation(updateListMutation({ api, queryClient }));
}

export function useDeleteList() {
  const queryClient = useQueryClient();
  return useMutation(deleteListMutation({ api, queryClient }));
}

export function useCreateList() {
  const queryClient = useQueryClient();
  return useMutation(createListMutation({ api, queryClient }));
}
