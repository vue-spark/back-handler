# @vue-spark/back-handler

Stack-based back button handler for Vue mobile applications.

[简体中文](./README.zh-CN.md)

## Introduction

When developing mobile H5 applications with hybrid frameworks like UniApp, Cordova, or Capacitor, you often encounter back button handling challenges:

- When overlays (Modal, Dialog, Popup) are visible, pressing back should close the overlay instead of navigating away
- Multi-level components like pickers and step wizards need to handle back events in hierarchical order
- Different platforms have inconsistent back button behaviors that need a unified solution

`@vue-spark/back-handler` provides a stack-based back button handling mechanism that makes it easy to manage multi-level back events.

## Features

- **Stack-based Management** - LIFO (Last In, First Out) automatic multi-level handling
- **Async Support** - Handlers support Promises for async confirmation
- **Composition API** - Provides `useBackHandler` composable
- **Cross-platform** - Works with UniApp, Cordova, Capacitor, and more
- **Lightweight** - Only depends on Vue 3

## Installation

```bash
npm install @vue-spark/back-handler
```

## Quick Start

### 1. Install the Plugin

```ts
import { BackHandler } from '@vue-spark/back-handler'
// main.ts
import { createApp } from 'vue'
import App from './App.vue'

createApp(App)
  .use(BackHandler, {
    fallback: () => {
      // Fallback when stack is empty (usually navigate back)
      history.back()
    },
    bind: (handler) => {
      // Bind platform back event
    },
  })
  .mount('#app')
```

### 2. Use in Components

```html
<script
  setup
  lang="ts"
>
  import { useBackHandler } from '@vue-spark/back-handler'
  import { ref } from 'vue'

  const visible = ref(false)
  const { push, remove } = useBackHandler(visible, () => {
    visible.value = false
  })

  function open() {
    visible.value = true
    push()
  }

  function close() {
    visible.value = false
    remove()
  }
</script>
```

## API

### BackHandler

Static class for managing the back button handler stack.

#### Properties

| Property        | Type                 | Description                                       |
| --------------- | -------------------- | ------------------------------------------------- |
| `stack`         | `BackHandlerEntry[]` | Handler stack                                     |
| `isInitialized` | `boolean`            | Whether initialized                               |
| `options`       | `BackHandlerOptions` | Configuration options (throws if not initialized) |

#### Methods

| Method                  | Description                                     |
| ----------------------- | ----------------------------------------------- |
| `install(app, options)` | Install to Vue app (recommended)                |
| `init(options)`         | Manual init (for non-Vue or custom scenarios)   |
| `destroy()`             | Destroy and reset state                         |
| `onBackPress()`         | Handle back event (called by platform listener) |
| `push(entry)`           | Push a handler entry                            |
| `remove(entry)`         | Remove a handler entry                          |

#### BackHandler.install(app, options)

Install to Vue application. Recommended approach. Automatically binds back events and cleans up on app unmount.

| Parameter          | Type                            | Required | Description                     |
| ------------------ | ------------------------------- | :------: | ------------------------------- |
| `app`              | `App`                           |    ✅    | Vue application instance        |
| `options.fallback` | `() => void`                    |    ✅    | Fallback when stack is empty    |
| `options.bind`     | `(handler: () => void) => void` |    ✅    | Register platform back listener |
| `options.onPush`   | `(entry) => void`               |    ❌    | Callback when entry is pushed   |
| `options.onRemove` | `(entry) => void`               |    ❌    | Callback when entry is removed  |

#### BackHandlerEntry

```ts
interface BackHandlerEntry {
  handler: () => void | boolean | Promise<void | boolean>
}
```

**Handler return value behavior:**

| Return Value         | Behavior     |
| -------------------- | ------------ |
| `undefined` / `true` | Remove entry |
| `false`              | Keep entry   |
| `Promise<reject>`    | Keep entry   |

---

### useBackHandler(showing, onHide)

Composable for managing component back button handling.

**Parameters**

| Parameter | Type                                                | Description                                                         |
| --------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| `showing` | `MaybeRefOrGetter<boolean>`                         | Component visibility state; auto-removes on scope dispose if `true` |
| `onHide`  | `() => void \| boolean \| Promise<void \| boolean>` | Callback on back press; return `false` or reject to prevent removal |

**Return Value**

| Property | Type         | Description  |
| -------- | ------------ | ------------ |
| `push`   | `() => void` | Push entry   |
| `remove` | `() => void` | Remove entry |

## Platform Integration

### UniApp

```ts
import { BackHandler } from '@vue-spark/back-handler'
// main.ts
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

createApp(App)
  // Adapt according to your business needs
  .use((app) => {
    const routerHistory = router.options.history

    let initialPosition = 0
    const hasRouterHistory = () => {
      return routerHistory.state.position !== initialPosition
    }

    router.isReady().then(() => {
      initialPosition = routerHistory.state.position as number

      // Sync back button interception state on route change
      router.afterEach(() => {
        uni.postMessage({
          type: 'preventBackPress',
          data: hasRouterHistory(),
        })
      })
    })

    // Install BackHandler
    BackHandler.install(app, {
      onPush() {
        // Sync back button interception state
        uni.postMessage({
          type: 'preventBackPress',
          data: true,
        })
      },

      onRemove() {
        // Sync back button interception state
        uni.postMessage({
          type: 'preventBackPress',
          data: BackHandler.stack.length > 0 || hasRouterHistory(),
        })
      },

      fallback() {
        // Navigate back if router history exists
        hasRouterHistory() && router.back()
      },

      bind(handler) {
        // Bind platform back event
        window.addEventListener('uni:backbutton', handler)
      },
    })
  })

  // Install router
  .use(router)

  // Mount app
  .mount('#app')
```

## Vant Integration

[Vant](https://vant-ui.github.io/vant/) is a lightweight, customizable Vue mobile component library. By adapting the `Popup` component, all Popup-based components (`ActionSheet`, `ShareSheet`, `Picker`, etc.) can support back button closing.

### Popup

```ts
import { useBackHandler } from '@vue-spark/back-handler'
import { Dialog, Popup } from 'vant'
import { callInterceptor } from 'vant/es/utils'
import { getCurrentInstance, watch } from 'vue'

const { setup } = Popup

// Change closeOnPopstate default to true
Popup.props.closeOnPopstate = {
  type: Boolean,
  default: true,
}

Popup.setup = (props, ctx) => {
  const { emit } = ctx

  const vm = getCurrentInstance()!
  // Exclude Dialog component (based on Popup) to avoid duplicate registration
  if (vm.parent?.type !== Dialog) {
    const close = () => {
      return new Promise<void>((resolve, reject) => {
        if (!props.show) {
          return resolve()
        }

        callInterceptor(props.beforeClose, {
          done() {
            emit('close')
            emit('update:show', false)
            resolve()
          },

          canceled() {
            reject(new Error('canceled'))
          },
        })
      })
    }

    const { push, remove } = useBackHandler(
      () => props.show,
      // closeOnPopstate controls whether to respond to back button
      () => !!props.closeOnPopstate && close(),
    )

    watch(
      () => props.show,
      (value) => (value ? push() : remove()),
      { immediate: true, flush: 'sync' },
    )
  }

  return setup!(props, ctx)
}
```

### Dialog

```ts
import { useBackHandler } from '@vue-spark/back-handler'
import { Dialog, showLoadingToast } from 'vant'
import { callInterceptor } from 'vant/es/utils'
import { watch } from 'vue'

// Dialog's closeOnPopstate defaults to true, no need to change
const { setup } = Dialog

Dialog.setup = (props, ctx) => {
  const { emit } = ctx

  const updateShow = (value: boolean) => emit('update:show', value)

  const close = (action: 'cancel') => {
    updateShow(false)
    props.callback?.(action)
  }

  const getActionHandler = (action: 'cancel') => () => {
    return new Promise<void>((resolve, reject) => {
      if (!props.show) {
        return resolve()
      }

      emit(action)

      if (props.beforeClose) {
        // Use LoadingToast instead of internal button loading
        const toast = showLoadingToast({})
        callInterceptor(props.beforeClose, {
          args: [action],
          done() {
            close(action)
            toast.close()
            resolve()
          },
          canceled() {
            toast.close()
            reject(new Error('canceled'))
          },
        })
      } else {
        close(action)
        resolve()
      }
    })
  }

  const { push, remove } = useBackHandler(
    () => props.show,
    // closeOnPopstate controls whether to respond to back button
    () => !!props.closeOnPopstate && getActionHandler('cancel')(),
  )

  watch(
    () => props.show,
    (value) => (value ? push() : remove()),
    { immediate: true, flush: 'sync' },
  )

  return setup!(props, ctx)
}
```

## Example: Step Wizard

Return `false` to prevent removal and implement "go back one step":

```html
<script
  setup
  lang="ts"
>
  import { useBackHandler } from '@vue-spark/back-handler'
  import { ref } from 'vue'

  const step = ref(1)
  const visible = ref(false)

  const { push, remove } = useBackHandler(visible, () => {
    if (step.value > 1) {
      step.value--
      return false
    }
    visible.value = false
  })

  function open() {
    step.value = 1
    visible.value = true
    push()
  }
  function next() {
    step.value < 3 ? step.value++ : ((visible.value = false), remove())
  }
</script>
```

## Notes

1. **Initialization Timing** - Call `BackHandler.install()` before `app.mount()`
2. **Paired Calls** - `push` / `remove` should be called in pairs
3. **Auto Cleanup** - When `showing` is `true`, removal happens automatically on scope dispose

## Sponsors

Your support keeps this project going! If this project helps you, consider buying the author a juice 🍹:

| WeChat                                  | Alipay                                   |
| --------------------------------------- | ---------------------------------------- |
| <img src="./public/wx.png" width="200"> | <img src="./public/zfb.png" width="200"> |

## License

[MIT](./LICENSE) License © 2025 [leihaohao](https://github.com/l246804)
