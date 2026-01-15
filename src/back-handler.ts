import type { App } from 'vue'

export interface BackHandlerEntry {
  /**
   * Handler to be executed when the back press is triggered.
   * Return `false` or reject to prevent removal from the stack.
   */
  handler: () => void | boolean | Promise<void | boolean>
}

export interface BackHandlerOptions {
  /**
   * Called when the back button is pressed and the stack is empty.
   */
  fallback: () => void
  /**
   * Called when a handler entry is pushed to the stack.
   */
  onPush?: (entry: BackHandlerEntry) => void
  /**
   * Called when a handler entry is removed from the stack.
   */
  onRemove?: (entry: BackHandlerEntry) => void
}

/**
 * A static class for managing the back press handler stack.
 * Must be initialized via `init()` before use.
 */
export class BackHandler {
  /**
   * Stack of back handlers.
   */
  static stack: BackHandlerEntry[] = []

  private static _options: BackHandlerOptions | null = null
  /**
   * The options.
   */
  static get options(): BackHandlerOptions {
    if (!this._options) {
      throw new Error('BackHandler is not initialized!')
    }
    return this._options
  }

  /**
   * Whether the back handler is initialized.
   */
  static isInitialized = false

  /**
   * Manually initialize the back handler.
   *
   * Use this method when you need low-level control over initialization,
   * such as in non-Vue environments or custom setups. For standard Vue
   * applications, prefer using `BackHandler.install()` instead.
   *
   * @see {@link BackHandler.install} for Vue application integration.
   */
  static init = (options: BackHandlerOptions): void => {
    if (this.isInitialized) {
      console.warn('BackHandler is already initialized!')
      return
    }
    this.isInitialized = true
    this._options = options
  }

  /**
   * Destroy the back handler.
   */
  static destroy = (): void => {
    this.stack = []
    this._options = null
    this.isInitialized = false
  }

  /**
   * Handle the back press event.
   */
  static onBackPress = async (): Promise<void> => {
    if (this.stack.length) {
      const entry = this.stack[this.stack.length - 1]
      if (entry) {
        try {
          const result = await entry.handler()
          if (result !== false) {
            this.remove(entry)
          }
        }
        catch {
          // reject means do not remove
        }
      }
    }
    else {
      this.options.fallback()
    }
  }

  /**
   * Push a handler entry to the stack.
   */
  static push = (entry: BackHandlerEntry): void => {
    this.stack.push(entry)
    this.options.onPush?.(entry)
  }

  /**
   * Remove a handler entry from the stack.
   */
  static remove = (entry: BackHandlerEntry): void => {
    const index = this.stack.indexOf(entry)
    if (index > -1) {
      this.stack.splice(index, 1)
      this.options.onRemove?.(entry)
    }
  }

  /**
   * Install the back handler to a Vue application.
   *
   * This is the recommended way to initialize BackHandler in Vue applications.
   * It automatically:
   * - Initializes the handler with the provided options
   * - Binds to platform-specific back press events via the `bind` callback
   * - Cleans up when the Vue app is unmounted
   *
   * @see {@link BackHandler.init} for manual initialization without Vue.
   */
  static install = (
    app: App,
    options: BackHandlerOptions & {
      /**
       * Register platform-specific back press listener.
       * This callback receives a handler function that should be invoked
       * when the platform's back button/gesture is triggered.
       *
       * @param handler - The function to call on back press events.
       */
      bind: (handler: () => void) => void
    },
  ): void => {
    if (this.isInitialized) {
      return
    }
    this.init(options)
    options.bind(() => this.onBackPress())
    app.onUnmount(() => this.destroy())
  }
}
