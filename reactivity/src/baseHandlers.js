import { reactive, readonly, toRaw } from './reactive.js'
import { TrackOpTypes, TriggerOpTypes } from './operations.js'
import { track, trigger, ITERATE_KEY } from './effect.js'
import { LOCKED } from './lock.js'
import { isObject, hasOwn, isSymbol, hasChanged, isArray } from '../../shared/index.js'
import { isRef } from './ref.js'

const builtInSymbols = new Set(
    Object.getOwnPropertyNames(Symbol)
        .map(key => Symbol[key])
        .filter(isSymbol)
)

const get = createGetter()
const shallowReactiveGet = createGetter(false, true)
const readonlyGet = createGetter(true)
const shallowReadonlyGet = createGetter(true, true)

const arrayInstrumentations = {};

['includes', 'indexOf', 'lastIndexOf'].forEach(key => {
    arrayInstrumentations[key] = function (...args) {
        const arr = toRaw(this)
        for (let i = 0, l = (this).length; i < l; i++) {
            track(arr, TrackOpTypes.GET, i + '')
        }
        // we run the method using the original args first (which may be reactive)
        const res = arr[key](...args)
        if (res === -1 || res === false) {
            // if that didn't work, run it again using raw values.
            return arr[key](...args.map(toRaw))
        } else {
            return res
        }
    }
})

function createGetter(isReadonly = false, shallow = false) {
    return function get(target, key, receiver) {
        if (isArray(target) && hasOwn(arrayInstrumentations, key)) {
            return Reflect.get(arrayInstrumentations, key, receiver)
        }

        // Reflect
        const res = Reflect.get(target, key, receiver)

        if (isSymbol(key) && builtInSymbols.has(key)) {
            return res
        }
        if (shallow) {
            track(target, TrackOpTypes.GET, key)
            // TODO strict mode that returns a shallow-readonly version of the value
            return res
        }
        // ref unwrapping, only for Objects, not for Arrays.
        if (isRef(res) && !isArray(target)) {
            return res.value
        }

        // track
        track(target, TrackOpTypes.GET, key)

        return isObject(res)
            ? isReadonly
                ? // need to lazy access readonly and reactive here to avoid
                // circular dependency
                readonly(res)
                : reactive(res)
            : res
    }
}

const set = createSetter()
const shallowReactiveSet = createSetter(false, true)
const readonlySet = createSetter(true)
const shallowReadonlySet = createSetter(true, true)

function createSetter(isReadonly = false, shallow = false) {
    return function set(
        target,
        key,
        value,
        receiver
    ) {
        if (isReadonly && LOCKED) {
            if (__DEV__) {
                console.warn(
                    `Set operation on key "${String(key)}" failed: target is readonly.`,
                    target
                )
            }
            return true
        }

        const oldValue = target[key]
        if (!shallow) {
            value = toRaw(value)
            if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
                oldValue.value = value
                return true
            }
        } else {
            // in shallow mode, objects are set as-is regardless of reactive or not
        }

        const hadKey = hasOwn(target, key)
        
        // Reflect
        const result = Reflect.set(target, key, value, receiver)

        // don't trigger if target is something up in the prototype chain of original
        if (target === toRaw(receiver)) {
            if (!hadKey) {
                trigger(target, TriggerOpTypes.ADD, key, value)
            } else if (hasChanged(value, oldValue)) {
                trigger(target, TriggerOpTypes.SET, key, value, oldValue)
            }
        }

        return result
    }
}

function deleteProperty(target, key) {
    const hadKey = hasOwn(target, key)
    const oldValue = target[key]
    const result = Reflect.deleteProperty(target, key)
    if (result && hadKey) {
        trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
    }
    return result
}

function has(target, key) {
    const result = Reflect.has(target, key)
    track(target, TrackOpTypes.HAS, key)
    return result
}

function ownKeys(target) {
    track(target, TrackOpTypes.ITERATE, ITERATE_KEY)
    return Reflect.ownKeys(target)
}

export const mutableHandlers = {
    get,
    set,
    deleteProperty,
    has,
    ownKeys
}

export const readonlyHandlers = {
    get: readonlyGet,
    set: readonlySet,
    has,
    ownKeys,
    deleteProperty(target, key) {
        if (LOCKED) {
            if (__DEV__) {
                console.warn(
                    `Delete operation on key "${String(
                        key
                    )}" failed: target is readonly.`,
                    target
                )
            }
            return true
        } else {
            return deleteProperty(target, key)
        }
    }
}

export const shallowReactiveHandlers = {
    ...mutableHandlers,
    get: shallowReactiveGet,
    set: shallowReactiveSet
}

// Props handlers are special in the sense that it should not unwrap top-level
// refs (in order to allow refs to be explicitly passed down), but should
// retain the reactivity of the normal readonly object.
export const shallowReadonlyHandlers = {
    ...readonlyHandlers,
    get: shallowReadonlyGet,
    set: shallowReadonlySet
}