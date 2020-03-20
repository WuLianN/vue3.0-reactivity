import { isObject } from '../../shared/index.js'
import { track, trigger } from './effect.js'
import { TrackOpTypes, TriggerOpTypes } from './operations.js'
import { reactive, isReactive } from './reactive.js'
import { __DEV__ } from '../../global.js'


// 转化为响应式对象 还是要通过 reactive()
const convert = (val) =>
    isObject(val) ? reactive(val) : val

export function isRef(r) {
    return r ? r._isRef === true : false
}

export function ref(value) {
    return createRef(value)
}

export function shallowRef(value) {
    return shallowRef(value, true)
}

function createRef(value, shallow = false) {
    if (isRef(value)) {
        return value
    }

    if (!shallow) {
        value = convert(value)
    }

    const r = {
        _isRef: true,
        get value() {
            track(r, TrackOpTypes.GET, 'value')
            return value
        },
        set value(newVal) {
            value = shallow ? newVal : convert(newVal)
            trigger(r, TriggerOpTypes.SET, 'value', __DEV__ ? {
                newValue: newVal
            } : void 0
            )
        }
    }

    return r
}


// 以下的 变量/函数 对外使用

export function unref(ref) {
    return isRef(ref) ? ref.value : ref
}

export function toRefs(object) {
    if (__DEV__ && isReactive(object)) {
        console.warn(`toRefs() expects a reactive object but received a plain one.`)
    }
    const ret = {}
    for (const key in object) {
        ret[key] = toProxyRef(object, key)
    }
    return ret
}

function toProxyRef(object, key) {
    return {
        _isRef: true,
        get value() {
            return object[key]
        },
        set value(newVal) {
            object[key] = newVal
        }
    }
}