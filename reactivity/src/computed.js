import { effect, track, trigger } from './effect.js'
import { isFunction, NOOP } from '../../shared/index.js'
import { TriggerOpTypes, TrackOpTypes } from './operations.js'
import { __DEV__ } from '../../global.js'
/*
computed用法：
  1. 参数为 函数
      const count = ref(1)
      const plusOne = computed(() => count.value + 1)

      console.log(plusOne.value) // 2

      plusOne.value++ // error

  2. 参数为 对象
      const count = ref(1)
      const plusOne = computed({
        get: () => count.value + 1,
        set: val => { count.value = val - 1 }
      })

      plusOne.value = 1
      console.log(count.value) // 0
*/


export function computed(getterOrOptions) {
   let getter
   let setter

   // 判断 getterOrOptions 是 函数/对象 ?
   if (isFunction(getterOrOptions)) {
      getter = getterOrOptions
      setter = __DEV__ ? () => {
         console.warn('Write operation failed: computed value is readonly')
      } : NOOP
   } else {
      getter = getterOrOptions.get
      setter = getterOrOptions.set
   }

   let dirty = true
   let value
   let computed

   const runner = effect(getter, {
      lazy: true,
      // mark effect as computed so that it gets priority during trigger
      computed: true,
      scheduler: () => {
         if (!dirty) {
            dirty = true
            trigger(computed, TriggerOpTypes.SET, 'value')
         }
      }
   })

   computed = {
      _isRef: true,
      // expose effect so computed can be stopped
      effect: runner,
      get value() {
         if (dirty) {
            value = runner()
            dirty = false
         }
         track(computed, TrackOpTypes.GET, 'value')
         return value
      },

      set value(newValue) {
         setter(newValue)
      }
   }

   return computed
}

// computed: {
//      _isRef: true,
//      effect: [Function: reativeEffect] {
//      _isEffect: true,
//       active: true,
//       raw: [Function],
//       deps: [],
//       options: { lazy: true, computed: true, scheduler: [Function: scheduler] }
//       },
//       value: [Getter/Setter]
//  }