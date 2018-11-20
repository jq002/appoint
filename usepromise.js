var Promise = require('./appoint');
console.log(Promise);
function doSomething() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve('something')
        }, 1000)
    })
}

function doSomethingElse() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve('somethingElse')
        }, 1500)
    })
}

console.time('case 1')
doSomething().then(() => {
    return doSomethingElse()
}).then(function finalHandler(res) {
    console.log(res)
    console.timeEnd('case 1')
})