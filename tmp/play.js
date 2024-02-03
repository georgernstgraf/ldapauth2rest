function inplace(o) {
    o.a = 1;
}

var o = { a: 0 };
inplace(o);
console.log(o.a); // 1
