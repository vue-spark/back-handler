import type { MaybeRefOrGetter } from 'vue'
import type { BackHandlerEntry } from './back-handler'
import { onScopeDispose, toValue } from 'vue'
import { BackHandler } from './back-handler'

export interface UseBackHandlerReturn {
  push: () => void
  remove: () => void
}

/**
 * A composable for managing back press handler.
 * @param showing Whether the component is visible. If `true`, the handler will be automatically removed on scope dispose.
 * @param onHide Handler to be executed when the back press is triggered. Return `false` or reject to prevent removal from the stack.
 */
export function useBackHandler(
  showing: MaybeRefOrGetter<boolean>,
  onHide: () => void | boolean | Promise<void | boolean>,
): UseBackHandlerReturn {
  let entry: BackHandlerEntry | null = null
  function remove(): void {
    if (entry) {
      BackHandler.remove(entry)
      entry = null
    }
  }

  onScopeDispose(() => {
    toValue(showing) && remove()
  }, true)

  return {
    remove,
    push() {
      entry = { handler: onHide }
      BackHandler.push(entry)
    },
  }
}
