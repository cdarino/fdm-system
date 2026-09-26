'use client';

import { useState } from 'react';
import type { UseFormSetError, FieldValues, Path } from 'react-hook-form';
import { toast } from 'sonner';
import type { ActionResult } from '@/lib/actions/action-result';

export type MutationState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'success' }
  | { status: 'error'; error: string };

type ExtractActionResultData<T> = T extends ActionResult<infer D> ? D : T;

export interface UseMutationOptions<TResult, TFieldValues extends FieldValues = any> {
  setError?: UseFormSetError<TFieldValues>;
  onSuccess?: (data: ExtractActionResultData<TResult>) => void;
  onError?: (error: string) => void;
  toastOnError?: boolean;
}

export function useMutation<
  TArgs extends unknown[],
  TResult = void,
  TFieldValues extends FieldValues = any
>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
  options?: UseMutationOptions<TResult, TFieldValues>
) {
  const [state, setState] = useState<MutationState>({ status: 'idle' });

  async function execute(...args: TArgs): Promise<boolean> {
    setState({ status: 'pending' });
    try {
      const result = await mutationFn(...args);

      if (
        result !== null &&
        typeof result === 'object' &&
        'success' in result &&
        typeof (result as { success: unknown }).success === 'boolean'
      ) {
        const actionResult = result as ActionResult<unknown>;
        if (!actionResult.success) {
          const errorMessage = actionResult.error || 'An error occurred';
          setState({ status: 'error', error: errorMessage });

          let hasPipedFieldError = false;
          if (options?.setError && actionResult.fieldErrors) {
            for (const [field, messages] of Object.entries(actionResult.fieldErrors)) {
              if (messages && messages.length > 0) {
                options.setError(field as Path<TFieldValues>, {
                  type: 'server',
                  message: messages[0],
                });
                hasPipedFieldError = true;
              }
            }
          }

          // Wire generic errors (non-field errors) to toast notifications
          if (options?.toastOnError !== false && !hasPipedFieldError) {
            toast.error(errorMessage);
          }

          options?.onError?.(errorMessage);
          return false;
        }

        setState({ status: 'success' });
        options?.onSuccess?.(actionResult.data as ExtractActionResultData<TResult>);
        return true;
      }

      setState({ status: 'success' });
      options?.onSuccess?.(result as ExtractActionResultData<TResult>);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setState({ status: 'error', error: message });
      if (options?.toastOnError !== false) {
        toast.error(message);
      }
      options?.onError?.(message);
      return false;
    }
  }

  function reset() {
    setState({ status: 'idle' });
  }

  return { state, execute, reset };
}
