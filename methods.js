console.log(`methods.js called at ${Date()}`)

const name='Jonas'

function hello(){
    let x = 1234
    console.log(`hello ${name} mSig at ${Date()}`)
}



export {
    hello,
    name
}