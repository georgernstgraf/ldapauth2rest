function inplace(o: { a: number }): void {
    o.a = 1;
}

const o = { a: 0 };
inplace(o);
console.log(o.a); // 1
