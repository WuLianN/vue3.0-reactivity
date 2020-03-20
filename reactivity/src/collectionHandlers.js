import { toRaw, reactive, readonly } from './reactive.js'
import { track, trigger, ITERATE_KEY } from './effect.js'
import { TrackOpTypes, TriggerOpTypes } from './operations.js'
import { LOCKED } from './lock.js'
import { isObject, capitalize, hasOwn, hasChanged } from '../../shared/index.js'

const toReactive = (value) =>
  isObject(value) ? reactive(value) : value

const toReadonly = (value) =>
  isObject(value) ? readonly(value) : value

const getProto = (v) =>
  Reflect.getPrototypeOf(v)

function get(
  target,
  key,
  wrap
) {
  target = toRaw(target)
  const rawKey = toRaw(key)
  track(target, TrackOpTypes.GET, rawKey)
  const { has, get } = getProto(target)
  if (has.call(target, key)) {
    return wrap(get.call(target, key))
  } else if (has.call(target, rawKey)) {
    return wrap(get.call(target, rawKey))
  }
}

// function has(this, key) {
//   const target = toRaw(this)
//   const rawKey = toRaw(key)
//   track(target, TrackOpTypes.HAS, rawKey)
//   const has = getProto(target).has
//   return has.call(target, key) || has.call(target, rawKey)
// }

// function size(target) {
//   target = toRaw(target)
//   track(target, TrackOpTypes.ITERATE, ITERATE_KEY)
//   return Reflect.get(getProto(target), 'size', target)
// }

// function add(this, value) {
//   value = toRaw(value)
//   const target = toRaw(this)
//   const proto = getProto(target)
//   const hadKey = proto.has.call(target, value)
//   const result = proto.add.call(target, value)
//   if (!hadKey) {
//     trigger(target, TriggerOpTypes.ADD, value, value)
//   }
//   return result
// }

// function set(this, key, value) {
//   value = toRaw(value)
//   key = toRaw(key)
//   const target = toRaw(this)
//   const proto = getProto(target)
//   const hadKey = proto.has.call(target, key)
//   const oldValue = proto.get.call(target, key)
//   const result = proto.set.call(target, key, value)
//   if (!hadKey) {
//     trigger(target, TriggerOpTypes.ADD, key, value)
//   } else if (hasChanged(value, oldValue)) {
//     trigger(target, TriggerOpTypes.SET, key, value, oldValue)
//   }
//   return result
// }

// function deleteEntry(this, key) {
//   const target = toRaw(this)
//   const { has, get, delete: del } = getProto(target)
//   let hadKey = has.call(target, key)
//   if (!hadKey) {
//     key = toRaw(key)
//     hadKey = has.call(target, key)
//   }
//   const oldValue = get ? get.call(target, key) : undefined
//   // forward the operation before queueing reactions
//   const result = del.call(target, key)
//   if (hadKey) {
//     trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
//   }
//   return result
// }

// function clear(this) {
//   const target = toRaw(this)
//   const hadItems = target.size !== 0
//   const oldTarget = __DEV__
//     ? target instanceof Map
//       ? new Map(target)
//       : new Set(target)
//     : undefined
//   // forward the operation before queueing reactions
//   const result = getProto(target).clear.call(target)
//   if (hadItems) {
//     trigger(target, TriggerOpTypes.CLEAR, undefined, undefined, oldTarget)
//   }
//   return result
// }

// function createForEach(isReadonly) {
//   return function forEach(
//     this,
//     callback,
//     thisArg
//   ) {
//     const observed = this
//     const target = toRaw(observed)
//     const wrap = isReadonly ? toReadonly : toReactive
//     track(target, TrackOpTypes.ITERATE, ITERATE_KEY)
//     // important: create sure the callback is
//     // 1. invoked with the reactive map as `this` and 3rd arg
//     // 2. the value received should be a corresponding reactive/readonly.
//     function wrappedCallback(value, key) {
//       return callback.call(observed, wrap(value), wrap(key), observed)
//     }
//     return getProto(target).forEach.call(target, wrappedCallback, thisArg)
//   }
// }

// function createIterableMethod(method, isReadonly) {
//   return function (this, ...args) {
//     const target = toRaw(this)
//     const isPair =
//       method === 'entries' ||
//       (method === Symbol.iterator && target instanceof Map)
//     const innerIterator = getProto(target)[method].apply(target, args)
//     const wrap = isReadonly ? toReadonly : toReactive
//     track(target, TrackOpTypes.ITERATE, ITERATE_KEY)
//     // return a wrapped iterator which returns observed versions of the
//     // values emitted from the real iterator
//     return {
//       // iterator protocol
//       next() {
//         const { value, done } = innerIterator.next()
//         return done
//           ? { value, done }
//           : {
//             value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
//             done
//           }
//       },
//       // iterable protocol
//       [Symbol.iterator]() {
//         return this
//       }
//     }
//   }
// }

// function createReadonlyMethod(
//   method,
//   type
// ) {
//   return function (this, ...args) {
//     if (LOCKED) {
//       if (__DEV__) {
//         const key = args[0] ? `on key "${args[0]}" ` : ``
//         console.warn(
//           `${capitalize(type)} operation ${key}failed: target is readonly.`,
//           toRaw(this)
//         )
//       }
//       return type === TriggerOpTypes.DELETE ? false : this
//     } else {
//       return method.apply(this, args)
//     }
//   }
// }

// const mutableInstrumentations = {
//   get(this, key) {
//     return get(this, key, toReactive)
//   },
//   get size() {
//     return size(this)
//   },
//   has,
//   add,
//   set,
//   delete: deleteEntry,
//   clear,
//   forEach: createForEach(false)
// }

// const readonlyInstrumentations = {
//   get(this, key) {
//     return get(this, key, toReadonly)
//   },
//   get size() {
//     return size(this)
//   },
//   has,
//   add: createReadonlyMethod(add, TriggerOpTypes.ADD),
//   set: createReadonlyMethod(set, TriggerOpTypes.SET),
//   delete: createReadonlyMethod(deleteEntry, TriggerOpTypes.DELETE),
//   clear: createReadonlyMethod(clear, TriggerOpTypes.CLEAR),
//   forEach: createForEach(true)
// }

// const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator]
// iteratorMethods.forEach(method => {
//   mutableInstrumentations[method] = createIterableMethod(
//     method,
//     false
//   )
//   readonlyInstrumentations[method] = createIterableMethod(
//     method,
//     true
//   )
// })

function createInstrumentationGetter(
  instrumentations
) {
  return (
    target,
    key,
    receiver
  ) =>
    Reflect.get(
      hasOwn(instrumentations, key) && key in target
        ? instrumentations
        : target,
      key,
      receiver
    )
}

export const mutableCollectionHandlers = {
  // get: createInstrumentationGetter(mutableInstrumentations)
}

export const readonlyCollectionHandlers = {
  // get: createInstrumentationGetter(readonlyInstrumentations)
}
