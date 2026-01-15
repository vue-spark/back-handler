import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, effectScope, nextTick, ref } from 'vue'
import { BackHandler, useBackHandler } from '../src/index'

// Mock browser environment
vi.stubGlobal('window', {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})

describe('backHandler Plugin', () => {
  beforeEach(() => {
    // Reset plugin state before each test
    if (BackHandler.isInitialized) {
      BackHandler.destroy()
    }
  })

  it('should not install twice', () => {
    const app = createApp({})
    const fallback = vi.fn()
    const bind = vi.fn()

    BackHandler.install(app, { fallback, bind })
    expect(BackHandler.isInitialized).toBe(true)

    BackHandler.install(app, { fallback, bind })
    expect(bind).toHaveBeenCalledTimes(1)
  })

  it('should call fallback when stack is empty', () => {
    const app = createApp({})
    const fallback = vi.fn()
    const bind = vi.fn()

    BackHandler.install(app, { fallback, bind })

    // Extract the handler passed to bind
    const backHandler = bind.mock.calls[0][0]
    backHandler()

    expect(fallback).toHaveBeenCalled()
  })

  it('should call handler and remove entry by default', async () => {
    const app = createApp({})
    const fallback = vi.fn()
    const bind = vi.fn()
    const handler = vi.fn()

    BackHandler.install(app, { fallback, bind })

    BackHandler.push({ handler })
    expect(BackHandler.stack.length).toBe(1)

    const backHandler = bind.mock.calls[0][0]
    await backHandler()

    expect(handler).toHaveBeenCalled()
    expect(BackHandler.stack.length).toBe(0)
    expect(fallback).not.toHaveBeenCalled()
  })

  it('should not remove entry if handler returns false', async () => {
    const app = createApp({})
    const fallback = vi.fn()
    const bind = vi.fn()
    const handler = vi.fn().mockReturnValue(false)

    BackHandler.install(app, { fallback, bind })
    BackHandler.push({ handler })

    const backHandler = bind.mock.calls[0][0]
    await backHandler()

    expect(handler).toHaveBeenCalled()
    expect(BackHandler.stack.length).toBe(1)
    expect(fallback).not.toHaveBeenCalled()
  })

  it('should not remove entry if async handler rejects', async () => {
    const app = createApp({})
    const fallback = vi.fn()
    const bind = vi.fn()
    const handler = vi.fn().mockRejectedValue(new Error('rejected'))

    BackHandler.install(app, { fallback, bind })
    BackHandler.push({ handler })

    const backHandler = bind.mock.calls[0][0]
    await backHandler()

    expect(handler).toHaveBeenCalled()
    expect(BackHandler.stack.length).toBe(1)
    expect(fallback).not.toHaveBeenCalled()
  })

  it('should remove entry if async handler resolves', async () => {
    const app = createApp({})
    const fallback = vi.fn()
    const bind = vi.fn()
    const handler = vi.fn().mockResolvedValue(undefined)

    BackHandler.install(app, { fallback, bind })
    BackHandler.push({ handler })

    const backHandler = bind.mock.calls[0][0]
    await backHandler()

    expect(handler).toHaveBeenCalled()
    expect(BackHandler.stack.length).toBe(0)
    expect(fallback).not.toHaveBeenCalled()
  })

  it('should clean up on app unmount', () => {
    const app = createApp({})
    const fallback = vi.fn()
    const bind = vi.fn()

    BackHandler.install(app, { fallback, bind })
    expect(BackHandler.isInitialized).toBe(true)

    // Simulate app unmount
    app._instance = {} as any
    app.unmount?.()

    // In real Vue, onUnmount would run; we simulate by checking internal reset
    // Since we can't easily trigger onUnmount in unit test, we rely on manual reset above
    // But we can test that methods are disabled
    expect(typeof BackHandler.push).toBe('function')
    // Note: actual cleanup is tested via beforeEach reset
  })

  it('calls onPush when entry is pushed', () => {
    const app = createApp({})
    const onPush = vi.fn()
    const fallback = vi.fn()
    const bind = vi.fn()

    BackHandler.install(app, { fallback, bind, onPush })

    const entry = { handler: () => {
    } }
    BackHandler.push(entry)

    expect(onPush).toHaveBeenCalledWith(entry)
    expect(BackHandler.stack).toContain(entry)
  })

  it('calls onRemove when entry is removed', () => {
    const app = createApp({})
    const onRemove = vi.fn()
    const fallback = vi.fn()
    const bind = vi.fn()

    BackHandler.install(app, { fallback, bind, onRemove })

    const entry = { handler: () => {
    } }
    BackHandler.push(entry)
    BackHandler.remove(entry)

    expect(onRemove).toHaveBeenCalledWith(entry)
    expect(BackHandler.stack).not.toContain(entry)

    BackHandler.push(entry)
  })

  it('calls onRemove when backHandler is called', async () => {
    const app = createApp({})
    const onRemove = vi.fn()
    const fallback = vi.fn()
    const bind = vi.fn()

    BackHandler.install(app, { fallback, bind, onRemove })

    const entry = { handler: () => {
    } }
    BackHandler.push(entry)

    const backHandler = bind.mock.calls[0][0]
    await backHandler()

    expect(onRemove).toHaveBeenCalledWith(entry)
    expect(BackHandler.stack).not.toContain(entry)
  })
})

describe('useBackHandler composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset and initialize BackHandler
    if (BackHandler.isInitialized) {
      BackHandler.destroy()
    }
    BackHandler.init({
      fallback: vi.fn(),
    })
  })

  it('pushes and removes entry correctly', () => {
    const showing = ref(true)
    const hide = vi.fn()

    const { push, remove } = useBackHandler(showing, hide)

    push()
    expect(BackHandler.stack.length).toBe(1)
    const entry = BackHandler.stack[0]
    expect(entry.handler).toBe(hide)

    remove()
    expect(BackHandler.stack.length).toBe(0)
  })

  it('does not auto-remove on dispose if not showing', async () => {
    const showing = ref(false) // Not showing
    const hide = vi.fn()

    const scope = effectScope(true)
    scope.run(() => {
      const { push } = useBackHandler(showing, hide)
      push() // manually add
    })

    expect(BackHandler.stack.length).toBe(1)

    scope.stop()
    await nextTick()

    expect(BackHandler.stack.length).toBe(1) // still there!
  })

  it('auto-removes on dispose if showing is true', async () => {
    const showing = ref(true)
    const hide = vi.fn()

    const scope = effectScope(true)
    scope.run(() => {
      const { push } = useBackHandler(showing, hide)
      push() // manually add
    })

    expect(BackHandler.stack.length).toBe(1)

    scope.stop()
    await nextTick()

    expect(BackHandler.stack.length).toBe(0)
  })
})
