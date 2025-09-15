支持 for (i in 0..n) {}
```move
script {
    fun range_sum(n: u64): u64 {
        let sum = 0;
        // for (i in 0..n) {
        //     sum = sum + i
        //     };
        sum
    }
}
```

支持 address
```move
address 0x42{}
```

acquires 关键字

```move
public fun extract_balance(addr: address): u64 acquires Balance {
    let Balance { value } = move_from<Balance>(addr); // 需要 acquires 声明
    value
}
```

# Lambda 支持

内联函数支持_函数参数_，可以接受 lambda 表达式（即匿名函数）作为参数。 这个特性使得编写某些常见编程模式更加优雅。 与内联函数类似，lambda 表达式也会在调用点展开。

一个 lambda 表达式包含参数列表（用||包裹）和函数体。 简单示例：|x| x + 1、|x, y| x + y、|| 1、|| { 1 }。 lambda 函数体可以引用定义时所在作用域的变量：这被称为捕获。 这些变量可以被 lambda 表达式读取或写入（如果可变）。

函数参数的类型写作 |<参数类型列表>| <返回类型>。 例如，当函数参数类型为 |u64, u64| bool 时，任何接受两个u64参数并返回bool值的lambda表达式都可以作为参数。

下面是一个展示这些概念的实例（示例取自std::vector模块）：

```move
module 0x42::example {
    /// Fold the function over the elements.
    /// E.g, `fold(vector[1,2,3], 0, f)` is the same as `f(f(f(0, 1), 2), 3)`.
    public inline fun fold<Accumulator, Element>(
        v: vector<Element>,
        init: Accumulator,
        f: |Accumulator, Element|Accumulator
    ): Accumulator {
        let accu = init;
        // Note: `for_each` is an inline function, but is not shown here.
        for_each(v, |elem| accu = f(accu, elem));
        accu
    }
}
```
