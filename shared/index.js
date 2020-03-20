import { makeMap } from './makeMap.js'

export { makeMap }

export const NOOP = () => { }

export const isFunction = (val) => typeof val === 'function'
export const isString = (val) => typeof val === 'string'
export const isSymbol = (val) => typeof val === 'symbol'
export const isArray = Array.isArray
export const isObject = (val) =>
    val !== null && typeof val === 'object'

export const extend = (a, b) => {
    for (const key in b) {
        a[key] = b[key]
    }
    return a
}

const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (val, key) => hasOwnProperty.call(val, key)

// compare whether a value has changed, accounting for NaN.
export const hasChanged = (value, oldValue) =>
    value !== oldValue && (value === value || oldValue === oldValue)

export const objectToString = Object.prototype.toString

export const toTypeString = (value) =>
    objectToString.call(value)

export const toRawType = (value) => {
    return toTypeString(value).slice(8, -1)
}

const cacheStringFunction = (str) => (fn) => {
    const cache = Object.create(null)
    return str => {
        const hit = cache[str]
        return hit || (cache[str] = fn(str))
    }
}

export const capitalize = cacheStringFunction(
    str => {
        return str.charAt(0).toUpperCase() + str.slice(1)
    }
)