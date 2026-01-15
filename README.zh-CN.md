# @vue-spark/back-handler

移动端 Vue 返回键处理方案，基于栈管理多层级返回事件。

[English](./README.md)

## 简介

在移动端 H5 开发中，使用 UniApp、Cordova、Capacitor 等混合开发框架时会遇到返回键处理的问题：

- 弹出层（Modal、Dialog、Popup）显示时，用户按返回键应该关闭弹出层而不是退出页面
- 多层页面选择器、步骤向导等组件需要按层级顺序处理返回事件
- 不同平台的返回键行为不一致，需要统一的处理方案

`@vue-spark/back-handler` 提供了一个基于栈的返回键处理机制，让你可以轻松管理多层级的返回事件。

## 特性

- **栈式管理** - 后进先出，自动处理多层级返回
- **异步支持** - handler 支持 Promise，可进行异步确认
- **组合式 API** - 提供 `useBackHandler` 组合式函数
- **跨平台** - 适配 UniApp、Cordova、Capacitor 等框架
- **轻量** - 仅依赖 Vue 3

## 安装

```bash
npm install @vue-spark/back-handler
```

## 快速开始

### 1. 安装插件

```ts
import { BackHandler } from '@vue-spark/back-handler'
// main.ts
import { createApp } from 'vue'
import App from './App.vue'

createApp(App)
  .use(BackHandler, {
    fallback: () => {
      // 栈为空时的回退处理（通常是返回上一页）
      history.back()
    },
    bind: (handler) => {
      // 绑定平台的返回事件
    },
  })
  .mount('#app')
```

### 2. 在组件中使用

```html
<script setup lang="ts">
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

静态类，用于管理返回键处理栈。

#### 属性

| 属性            | 类型                 | 说明                             |
| --------------- | -------------------- | -------------------------------- |
| `stack`         | `BackHandlerEntry[]` | 处理器栈                         |
| `isInitialized` | `boolean`            | 是否已初始化                     |
| `options`       | `BackHandlerOptions` | 配置选项（未初始化时访问会抛错） |

#### 方法

| 方法                    | 说明                                      |
| ----------------------- | ----------------------------------------- |
| `install(app, options)` | 安装到 Vue 应用（推荐）                   |
| `init(options)`         | 手动初始化（用于非 Vue 环境或自定义场景） |
| `destroy()`             | 销毁并重置状态                            |
| `onBackPress()`         | 处理返回事件（由平台监听器调用）          |
| `push(entry)`           | 推入一个 handler entry                    |
| `remove(entry)`         | 移除一个 handler entry                    |

#### BackHandler.install(app, options)

安装到 Vue 应用，推荐使用方式。自动绑定返回事件并在应用卸载时清理。

| 参数               | 类型                            | 必填 | 说明               |
| ------------------ | ------------------------------- | :--: | ------------------ |
| `app`              | `App`                           |  ✅  | Vue 应用实例       |
| `options.fallback` | `() => void`                    |  ✅  | 栈为空时的回退处理 |
| `options.bind`     | `(handler: () => void) => void` |  ✅  | 注册平台返回监听器 |
| `options.onPush`   | `(entry) => void`               |  ❌  | entry 入栈时回调   |
| `options.onRemove` | `(entry) => void`               |  ❌  | entry 出栈时回调   |

#### BackHandlerEntry

```ts
interface BackHandlerEntry {
  handler: () => void | boolean | Promise<void | boolean>
}
```

**handler 返回值行为：**

| 返回值               | 行为       |
| -------------------- | ---------- |
| `undefined` / `true` | 移除 entry |
| `false`              | 保留 entry |
| `Promise<reject>`    | 保留 entry |

---

### useBackHandler(showing, onHide)

组合式函数，管理组件的返回键处理。

**参数**

| 参数      | 类型                                                | 说明                                              |
| --------- | --------------------------------------------------- | ------------------------------------------------- |
| `showing` | `MaybeRefOrGetter<boolean>`                         | 组件可见状态，为 `true` 时作用域销毁会自动 remove |
| `onHide`  | `() => void \| boolean \| Promise<void \| boolean>` | 返回键触发的回调，返回 `false` 或 reject 阻止移除 |

**返回值**

| 属性     | 类型         | 说明 |
| -------- | ------------ | ---- |
| `push`   | `() => void` | 入栈 |
| `remove` | `() => void` | 出栈 |

## 平台集成

### UniApp

```ts
import { BackHandler } from '@vue-spark/back-handler'
// main.ts
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

createApp(App)
  // 实际项目中可根据业务需要自行适配
  .use((app) => {
    const routerHistory = router.options.history

    let initialPosition = 0
    const hasRouteHistory = () => {
      return routerHistory.state.position !== initialPosition
    }

    router.isReady().then(() => {
      initialPosition = routerHistory.state.position as number

      // 路由变化时，同步更新是否拦截返回键
      router.afterEach(() => {
        uni.postMessage({
          type: 'preventBackPress',
          data: hasRouteHistory(),
        })
      })
    })

    // 安装 BackHandler
    BackHandler.install(app, {
      onPush() {
        // 同步更新是否拦截返回键
        uni.postMessage({
          type: 'preventBackPress',
          data: true,
        })
      },

      onRemove() {
        // 同步更新是否拦截返回键
        uni.postMessage({
          type: 'preventBackPress',
          data: BackHandler.stack.length > 0 || hasRouteHistory(),
        })
      },

      fallback() {
        // 有路由历史时，返回上一页
        hasRouteHistory() && router.back()
      },

      bind(handler) {
        // 绑定平台的返回事件
        window.addEventListener('uni:backbutton', handler)
      },
    })
  })

  // 安装路由
  .use(router)

  // 挂载应用
  .mount('#app')
```

## 适配 Vant 组件库

[Vant](https://vant-ui.github.io/vant/) 是一个轻量、可定制的移动端 Vue 组件库。通过适配 `Popup` 组件，可以让所有基于 `Popup` 的组件（`ActionSheet`、`ShareSheet`、`Picker` 等）都支持返回键关闭。

### Popup

```ts
import { useBackHandler } from '@vue-spark/back-handler'
import { Dialog, Popup } from 'vant'
import { callInterceptor } from 'vant/es/utils'
import { getCurrentInstance, watch } from 'vue'

const { setup } = Popup

// 变更 closeOnPopstate 默认值为 true
Popup.props.closeOnPopstate = {
  type: Boolean,
  default: true,
}

Popup.setup = (props, ctx) => {
  const { emit } = ctx

  const vm = getCurrentInstance()!
  // Dialog 组件基于 Popup，这里需要排除，否则会重复注册
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
      // closeOnPopstate 用于控制是否响应返回键
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

// Dialog 的 closeOnPopstate 默认为 true，可以不修改默认值
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
        // 使用 LoadingToast 代替内部按钮的 loading
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
      }
      else {
        close(action)
        resolve()
      }
    })
  }

  const { push, remove } = useBackHandler(
    () => props.show,
    // closeOnPopstate 用于控制是否响应返回键
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

## 示例：步骤向导

返回 `false` 可阻止出栈，实现返回上一步：

```html
<script setup lang="ts">
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

## 注意事项

1. **初始化时机** - 在 `app.mount()` 前调用 `BackHandler.install()`
2. **成对调用** - `push` / `remove` 应成对调用
3. **自动清理** - `showing` 为 `true` 时，作用域销毁会自动 remove

## 赞助

您的支持是我持续改进的动力！如果该项目对您有帮助，可以考虑请作者喝杯果汁🍹：

| 微信                                    | 支付宝                                   |
| --------------------------------------- | ---------------------------------------- |
| <img src="./public/wx.png" width="200"> | <img src="./public/zfb.png" width="200"> |

## 许可证

[MIT](./LICENSE) 许可证 © 2025 [leihaohao](https://github.com/l246804)
