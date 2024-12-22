Name: []

## Question 1

In the following code-snippet from `Num2Bits`, it looks like `sum_of_bits`
might be a sum of products of signals, making the subsequent constraint not
rank-1. Explain why `sum_of_bits` is actually a _linear combination_ of
signals.

```
        sum_of_bits += (2 ** i) * bits[i];
```

## Answer 1
sum_of_bits 实际上只是输入信号 bits[i] 的加权和，因为 2**i 只是一个常量值（由 i 和 n 决定），并不是一个信号

## Question 2

Explain, in your own words, the meaning of the `<==` operator.

## Answer 2
<== 运算符可以看作是 <-- 和 === 运算符的结合体，它不仅为信号分配一个值，还确保从分配中衍生出的约束成立。简而言之，它是一种快捷方式，允许我们在为信号分配线性组合的值时，避免使用两个运算符。

## Question 3

Suppose you're reading a `circom` program and you see the following:

```
    signal input a;
    signal input b;
    signal input c;
    (a & 1) * b === c;
```

Explain why this is invalid.

## Answer 3

这个表达式 (a & 1) * b === c 是无效的，因为它使用了按位与运算符 &，该运算符在电路约束的上下文中不能产生输入信号的线性组合。因此，这个约束无法简化为rank-1形式的 a*b + c = 0。因此，这个表达式违反了在此上下文中有效约束的要求。