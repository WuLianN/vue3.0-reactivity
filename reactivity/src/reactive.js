import { isObject, toRawType, makeMap } from '../../shared/index.js'
import { isRef } from './ref.js'
import {
    mutableHandlers,
    readonlyHandlers,
    shallowReadonlyHandlers,
    shallowReactiveHandlers
} from './baseHandlers.js'
import {
    mutableCollectionHandlers,
    readonlyCollectionHandlers
} from './collectionHandlers.js'
import {__DEV__} from '../../global.js'

// WeakMaps that store {raw <-> observed} pairs.
const rawToReactive = new WeakMap()
const reactiveToRaw = new WeakMap()
const rawToReadonly = new WeakMap()
const readonlyToRaw = new WeakMap()

// WeakSets for values that are marked readonly or non-reactive during
// observable creation.
const readonlyValues = new WeakSet()
const nonReactiveValues = new WeakSet()

const collectionTypes = new Set([Set, Map, WeakMap, WeakSet])
const isObservableType = makeMap(
    'Object,Array,Map,Set,WeakMap,WeakSet'
)

const canObserve = (value) => {
    return (
        !value._isVue &&
        !value._isVNode &&
        isObservableType(toRawType(value)) &&
        !nonReactiveValues.has(value)
    )
}

export function reactive(target) {
    // if trying to observe a readonly proxy, return the readonly version.
    if (readonlyToRaw.has(target)) {
        return target
    }
    // target is explicitly marked as readonly by user
    if (readonlyValues.has(target)) {
        return readonly(target)
    }

    if (isRef(target)) {
        return target
    }

    return createReactiveObject(
        target, // 原始数据
        rawToReactive, // 原始数据 -> 响应式数据 映射
        reactiveToRaw, // 响应式数据 -> 原始数据 映射
        mutableHandlers, // 可变数据的代理劫持方法
        mutableCollectionHandlers // 可变集合数据的代理劫持方法
    )
}

function createReactiveObject(
    target,
    toProxy,
    toRaw,
    baseHandlers,
    collectionHandlers) {
    if (!isObject(target)) {
        if (__DEV__) {
            console.warn(`value cannot be made reactive: ${String(target)}`)
        }
        return target
    }

    // target already has corresponding Proxy
    let observed = toProxy.get(target)
    if (observed !== void 0) {
        return observed
    }
    // target is already a Proxy
    if (toRaw.has(target)) {
        return target
    }
    // only a whitelist of value types can be observed.
    if (!canObserve(target)) {
        return target
    }

    const handlers = collectionTypes.has(target.constructor)
        ? collectionHandlers
        : baseHandlers
    observed = new Proxy(target, handlers)
    toProxy.set(target, observed)
    toRaw.set(observed, target)
    return observed
}

// 以下的 变量/函数 对外使用

export function readonly(target) {
    // value is a mutable observable, retrieve its original and return
    // a readonly version.
    if (reactiveToRaw.has(target)) {
        target = reactiveToRaw.get(target)
    }
    return createReactiveObject(
        target,
        rawToReadonly,
        readonlyToRaw,
        readonlyHandlers,
        readonlyCollectionHandlers
    )
}

// Return a reactive-copy of the original object, where only the root level
// properties are readonly, and does NOT unwrap refs nor recursively convert
// returned properties.
// This is used for creating the props proxy object for stateful components.
export function shallowReadonly(target) {
    return createReactiveObject(
        target,
        rawToReadonly,
        readonlyToRaw,
        shallowReadonlyHandlers,
        readonlyCollectionHandlers
    )
}

// Return a reactive-copy of the original object, where only the root level
// properties are reactive, and does NOT unwrap refs nor recursively convert
// returned properties.
export function shallowReactive(target) {
    return createReactiveObject(
        target,
        rawToReactive,
        reactiveToRaw,
        shallowReactiveHandlers,
        mutableCollectionHandlers
    )
}

export function isReactive(value) {
    return reactiveToRaw.has(value) || readonlyToRaw.has(value)
}

export function isReadonly(value) {
    return readonlyToRaw.has(value)
}

export function toRaw(observed) {
    return reactiveToRaw.get(observed) || readonlyToRaw.get(observed) || observed
}

export function markReadonly(value) {
    readonlyValues.add(value)
    return value
}

export function markNonReactive(value) {
    nonReactiveValues.add(value)
    return value
}


// let obj = { name: 'Bob', money: [10, 50, 100] }

// toProxy -> 针对target
// let p1 = reactive(obj)
// let p2 = reactive(obj)

// toRaw -> 针对observed
// let p1 = reactive(obj)
// let p2 = reactive(p1)