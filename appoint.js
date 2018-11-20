function INTERNAL () {}
function isFunction (func) {
  return typeof func === 'function'
}
function isObject (obj) {
  return typeof obj === 'object'
}
function isArray (arr) {
  return Array.isArray(arr)
}

const PENDING = 'pending'
const FULFILLED = 'fulfilled'
const REJECTED = 'rejected'

module.exports = Promise

function Promise (resolver) {
  if (!isFunction(resolver)) {
    throw new TypeError('resolver must be a function')
  }
  this.state = PENDING
  this.value = void 0
  this.queue = []
  if (resolver !== INTERNAL) {//内部创建的promise，不会执行函数，状态一直pending，直到调用doResolve()
    safelyResolveThen(this, resolver)
  }
}
//参数不是函数，则值穿透
Promise.prototype.then = function (onFulfilled, onRejected) {
  if ((!isFunction(onFulfilled) && this.state === FULFILLED) ||
    (!isFunction(onRejected) && this.state === REJECTED)) {
    return this
  }
  //创建then返回的新的promise函数
  const promise = new this.constructor(INTERNAL)
  if (this.state !== PENDING) {
    //异步执行函数已经执行完毕
    const resolver = this.state === FULFILLED ? onFulfilled : onRejected
    unwrap(promise, resolver, this.value)
  } else {
    //异步函数还未执行完毕，promise加入当前回调队列queue
    this.queue.push(new QueueItem(promise, onFulfilled, onRejected))
  }
  return promise
}

Promise.prototype.catch = function (onRejected) {
  return this.then(null, onRejected)
}

function QueueItem (promise, onFulfilled, onRejected) {
  //
  this.promise = promise
  this.callFulfilled = function (value) {
    doResolve(this.promise, value)
  }
  this.callRejected = function (error) {
    doReject(this.promise, error)
  }
  if (isFunction(onFulfilled)) {
    this.callFulfilled = function (value) {
      unwrap(this.promise, onFulfilled, value)
    }
  }
  if (isFunction(onRejected)) {
    this.callRejected = function (error) {
      unwrap(this.promise, onRejected, error)
    }
  }
}
//保证then异步执行，且执行then()的promise，即子promise
function unwrap (promise, func, value) {
  process.nextTick(function () {//then方法一定异步执行
    let returnValue
    try {
      returnValue = func(value)
    } catch (error) {
      return doReject(promise, error)
    }
    if (returnValue === promise) {
      doReject(promise, new TypeError('Cannot resolve promise with itself'))
    } else {
      doResolve(promise, returnValue)
    }
  })
}

//设置异步执行函数的状态和值，调用成功回调（或执行父回调返回的promise，或执行子promise）
function doResolve (self, value) {//value ===promise立即执行函数
  try {
    const then = getThen(value)
    if (then) {
      safelyResolveThen(self, then)
    } else {
      self.state = FULFILLED
      self.value = value
      //执行then注册的成功函数回调
      self.queue.forEach(function (queueItem) {
        queueItem.callFulfilled(value)//callFulfilled===then注册的成功回调函数
      })
    }
    return self
  } catch (error) {
    return doReject(self, error)
  }
}
//设置异步执行函数的状态和值，调用失败回调
function doReject (self, error) {
  self.state = REJECTED
  self.value = error
  //执行then注册的失败函数回调
  self.queue.forEach(function (queueItem) {
    queueItem.callRejected(error)
  })
  return self
}

function getThen (promise) {
  const then = promise && promise.then
  if (promise && (isObject(promise) || isFunction(promise)) && isFunction(then)) {
    return function applyThen () {
      then.apply(promise, arguments)
    }
  }
}
//执行promise的立即执行函数，调用doResolve，doReject方法
function safelyResolveThen (self, then) {
  
  let called = false//保证只执行一次成功回调或者失败回调，多次调用promise.then没事
  try {
    //promise的立即执行的函数
    then(function (value) {//异步操作成功的resolve()调用
      if (called) {
        return
      }
      called = true
      doResolve(self, value)
    }, function (error) {//异步操作失败调用的函数
      if (called) {
        return
      }
      called = true
      doReject(self, error)
    })
  } catch (error) {//调用立即执行函数报错的捕获
    if (called) {
      return
    }
    called = true
    doReject(self, error)
  }
}

Promise.resolve = resolve
function resolve (value) {
  if (value instanceof this) {
    return value
  }
  return doResolve(new this(INTERNAL), value)
}

Promise.reject = reject
function reject (reason) {
  return doReject(new this(INTERNAL), reason)
}

Promise.all = all
function all (iterable) {
  const self = this
  if (!isArray(iterable)) {
    return this.reject(new TypeError('must be an array'))
  }

  const len = iterable.length
  let called = false
  if (!len) {
    return this.resolve([])
  }

  const values = new Array(len)
  let resolved = 0
  let i = -1
  const promise = new this(INTERNAL)

  while (++i < len) {
    allResolver(iterable[i], i)
  }
  return promise
  function allResolver (value, i) {
    self.resolve(value).then(resolveFromAll, function (error) {
      if (!called) {
        called = true
        doReject(promise, error)
      }
    })
    function resolveFromAll (outValue) {
      values[i] = outValue
      if (++resolved === len && !called) {
        called = true
        doResolve(promise, values)
      }
    }
  }
}

Promise.race = race
function race (iterable) {
  const self = this
  if (!isArray(iterable)) {
    return this.reject(new TypeError('must be an array'))
  }

  const len = iterable.length
  let called = false
  if (!len) {
    return this.resolve([])
  }

  let i = -1
  const promise = new this(INTERNAL)

  while (++i < len) {
    resolver(iterable[i])
  }
  return promise
  function resolver (value) {
    self.resolve(value).then(function (response) {
      if (!called) {
        called = true
        doResolve(promise, response)
      }
    }, function (error) {
      if (!called) {
        called = true
        doReject(promise, error)
      }
    })
  }
}
