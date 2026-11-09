/**
 * React hooks over the task queries and mutations. Thin on purpose: the logic
 * lives in taskMutations.ts / taskQueries.ts and is tested without React.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../api';

import {
  createTaskMutation,
  deleteTaskMutation,
  restoreTaskMutation,
  updateTaskMutation,
} from './taskMutations';
import { tasksQueryOptions } from './taskQueries';

export function useTasks() {
  const queryClient = useQueryClient();
  return useQuery(tasksQueryOptions(api, queryClient));
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation(createTaskMutation({ api, queryClient }));
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation(updateTaskMutation({ api, queryClient }));
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation(deleteTaskMutation({ api, queryClient }));
}

export function useRestoreTask() {
  const queryClient = useQueryClient();
  return useMutation(restoreTaskMutation({ api, queryClient }));
}
