import { TrackOpTypes, TriggerOpTypes } from './operations.js'
import { isArray, extend } from '../../shared/index.js'
import { __DEV__ } from '../../global.js'

const targetMap = new WeakMap()

const effectStack = []
let activeEffect // run()中对activeEffect赋值

export function isEffect(fn) {
    return fn != null && fn._isEffect === true
}

// effect是一个函数，其下挂载了一些属性，用于描述其依赖和状态
export function effect(fn, options = {}) {
    if (isEffect(fn)) {
        fn = fn.raw
    }

    const effect = createReactiveEffect(fn, options)

    // 默认调用一次
    if (!options.lazy) {
        effect()
    }

    return effect
}

function createReactiveEffect(fn, options) {
    
    const effect = function reativeEffect(...args) {
        return run(effect, fn, args)
    }

    // 给 effect(effect is function) 添加属性  
    effect._isEffect = true
    effect.active = true
    effect.raw = fn
    effect.deps = []
    effect.options = options

    return effect
}

function run(effect, fn, args) {
    if (!effect.active) {
        return fn(...args)
    }

    if (!effectStack.includes(effect)) {
        cleanup(effect)

        try {
            enableTracking()
            effectStack.push(effect)
            activeEffect = effect
            return fn(...args)
        } finally {
            effectStack.pop()
            resetTracking()
            activeEffect = effectStack[effectStack.length - 1]
        }
    }
}

function cleanup(effect) {
    const { deps } = effect
    if (deps.length) {
        for (let i = 0; i < deps.length; i++) {
            deps[i].delete(effect)
        }
        deps.length = 0
    }
}

let shouldTrack = true
const trackStack = []

export function enableTracking() {
    trackStack.push(shouldTrack)
    shouldTrack = true
}

export function resetTracking() {
    const last = trackStack.pop()
    shouldTrack = last === undefined ? true : last
}

// 以下的 变量/函数 对外使用（即不存在 effect.js 逻辑中，但会使用本模块的变量）
export function stop(effect) {
    if (effect.active) {
        cleanup(effect)
        if (effect.options.onStop) {
            effect.options.onStop()
        }
        effect.active = false
    }
}

export function pauseTracking() {
    trackStack.push(shouldTrack)
    shouldTrack = false
}

// track 追踪 -> 收集依赖
export function track(target, type, key) {
    if (!shouldTrack || activeEffect === undefined) {
        return 
    }

    let depsMap = targetMap.get(target)
    if (depsMap === void 0) {
        targetMap.set(target, depsMap = new Map())
    }

    let dep = depsMap.get(key)
    if (dep === void 0) {
        depsMap.set(key, dep = new Set())
    }

    if (!dep.has(activeEffect)) {
        dep.add(activeEffect)

        activeEffect.deps.push(dep)

        if (__DEV__ && activeEffect.options.onTrack) {
            activeEffect.options.onTrack({
                effect: activeEffect,
                target,
                type,
                key
            })
        }
    }
}

export const ITERATE_KEY = Symbol('iterate')

// trigger 触发 -> 更新依赖
export function trigger(target, type, key, newValue, oldValue, oldTarget) {
    const depsMap = targetMap.get(target)
    
    if (depsMap === void 0) {
        // never been tracked
        return
    }

    const effects = new Set()
    const computedRunners = new Set()

    if (type === TriggerOpTypes.CLEAR) {
        // collection being cleared
        // trigger all effects for target
        depsMap.forEach(dep => {
            addRunners(effects, computedRunners, dep)
        })
    } else if (key === 'length' && isArray(target)) {
        depsMap.forEach((dep, key) => {
            if (key === 'length' || key >= newValue) {
                addRunners(effects, computedRunners, dep)
            }
        })
    } else {
        // schedule runs for SET | ADD | DELETE
        if (key !== void 0) {
            addRunners(effects, computedRunners, depsMap.get(key))
        }
        // also run for iteration key on ADD | DELETE | Map.SET
        if (
            type === TriggerOpTypes.ADD ||
            (type === TriggerOpTypes.DELETE && !isArray(target)) ||
            (type === TriggerOpTypes.SET && target instanceof Map)
        ) {
            const iterationKey = isArray(target) ? 'length' : ITERATE_KEY
            addRunners(effects, computedRunners, depsMap.get(iterationKey))
        }
    }

    const run = (effect) => {
        scheduleRun(
            effect,
            target,
            type,
            key,
            __DEV__
                ? {
                    newValue,
                    oldValue,
                    oldTarget
                } : undefined
        )
    }

    // Important: computed effects must be run first so that computed getters
    // can be invalidated before any normal effects that depend on them are run.
    computedRunners.forEach(run)
    effects.forEach(run)
}

function addRunners(
    effects,
    computedRunners,
    effectsToAdd
) {
    if (effectsToAdd !== void 0) {
        effectsToAdd.forEach(effect => {
            if (effect !== activeEffect || !shouldTrack) {
                if (effect.options.computed) {
                    computedRunners.add(effect)
                } else {
                    effects.add(effect)
                }
            } else {
                // the effect mutated its own dependency during its execution.
                // this can be caused by operations like foo.value++
                // do not trigger or we end in an infinite loop
            }
        })
    }
}

function scheduleRun(
    effect,
    target,
    type,
    key,
    extraInfo
) {
    if (__DEV__ && effect.options.onTrigger) {
        const event = {
            effect,
            target,
            key,
            type
        }
        effect.options.onTrigger(extraInfo ? extend(event, extraInfo) : event)
    }

    if (effect.options.scheduler !== void 0) {
        effect.options.scheduler(effect)
    } else {
        effect()
    }
}

/* track 的作用：形成 targetMap 结构，dep存储effect
     targetMap: {
         target: {
           key: dep
         }
     }

     targetMap: new WeakMap()
     target: new Map()
     dep: new Set()
*/

/* trigger 的作用：获取dep的effect，进行更新
   addRunners() -> 提取依赖
   scheduleRun() -> 更新依赖
*/
