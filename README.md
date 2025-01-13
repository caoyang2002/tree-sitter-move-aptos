# Tree-sitter-move-aptos

测试

```bash
./run_test.sh ./test  
# tree-sitter parse ./test/sources/example.move
```

ui

```bash
tree-sitter build --wasm
tree-sitter  playground
```

#  Tree-sitter 使用教程

项目地址: 
- docs: https://tree-sitter.github.io/tree-sitter
- repo: https://github.com/tree-sitter/tree-sitter

> Tree-sitter 是一个解析器生成工具和增量解析库。它能够为源文件构建具体的语法树，并且能够高效地更新语法树，即使在源文件被编辑时也是如此。Tree-sitter 旨在：

- 通用性：能够解析任何编程语言。
- 快速性：能够在文本编辑器中每次按键时进行解析。
- 健壮性：即使在存在语法错误的情况下也能提供有用的结果。
- 无依赖性：运行时库（用纯 C 编写）可以嵌入到任何应用程序中。
- 项目快速启动

## 安装

首先，你需要安装 Tree-sitter。你可以通过以下命令安装：

```bash
git clone https://github.com/tree-sitter/tree-sitter.git
cd tree-sitter
make
sudo make install
```

## 使用示例

以下是一个简单的使用示例，展示如何使用 Tree-sitter 解析一个简单的 C 语言文件：

```c
#include <stdio.h>

int main() {
    printf("Hello, World!\n");
    return 0;
}
```


你可以使用以下命令来解析这个文件：

```bash
tree-sitter parse example.c
```


## 应用案例

Tree-sitter 广泛应用于各种文本编辑器和 IDE 中，例如：

- Atom 编辑器：使用 Tree-sitter 进行语法高亮和代码折叠。

- Neovim：使用 Tree-sitter 进行语法分析和代码导航。


## 最佳实践

- 增量解析：利用 Tree-sitter 的增量解析功能，可以在编辑器中实时更新语法树，提高性能。

- 错误恢复：即使在存在语法错误的情况下，Tree-sitter 也能提供有用的结果，确保编辑器在遇到错误时仍能正常工作。

## 典型生态项目

Tree-sitter 的生态系统包含多个相关的项目，这些项目扩展了 Tree-sitter 的功能：

- py-tree-sitter：Python 绑定，允许在 Python 项目中使用 Tree-sitter。
- java-tree-sitter：Java 绑定，允许在 Java 项目中使用 Tree-sitter
- tree-sitter-c：C 语言的语法定义，用于解析 C 代码。
- tree-sitter-cpp：C++ 语言的语法定义，用于解析 C++ 代码。

这些项目共同构成了一个强大的生态系统，支持多种编程语言和平台。

原文链接：https://blog.csdn.net/gitblog_01056/article/details/141042501

---



# tree-sitter 自定义语法参考

https://blog.zeromake.com/pages/tree-sitter-syntax/

## 前言

最近发现很多终端编辑器 (helix) 都在使用 `tree-sitter` 做语法高亮和代码提示功能，去看了一下感觉语法比起之前的 `bison`, `antlr4` 简单太多了，而且使用 js 来描述可以做出比较复杂的逻辑，这里做一个简单的创建解析器入门，具体的使用可以参考官网文档。

## 一、环境准备

### 安装 tree-sitter-cil

可以使用 node, rust 的包管理器去安装，如果都没有可以参考下面的下载预编译二进制放到 bin 目录里。

repo: https://github.com/tree-sitter/tree-sitter/releases

> Mac

```bash
brew install tree-sitter
```

> Linux-ubutu

```bash
sudo apt install tree-sitter
```

> Windows

```bash
URL=https://github.com/tree-sitter/tree-sitter/releases

VERSION=$(curl -w '%{url_effective}' -I -L -s -S ${URL}/latest -o /dev/null | sed -e 's|.*/||')

curl -L ${URL}/download/${VERSION}/tree-sitter-windows-x64.gz -o tree-sitter.exe.gz

gzip -d ./tree-sitter.exe.gz

mv tree-sitter.exe ~/bin
```

检查

```bash
tree-sitter -h
```

### 准备一个 c 编译器环境

tree-sitter 底层生成的代码是 c，最少需要一个类 gcc 编译器 (msvc 应该也行，但是没有试过)

- windows: `mingw64`, `llvm-mingw`, `msvc-clang`
- unix: `gcc`, `clang`

**node 环境**

tree-sitter 的 grammar 用的 js 描述的，需要 node 来解析生成 tree-sitter 使用的 json。



## 二、创建 tree-sitter-calc 解析器

> 这里我们先做一个计算器的语法解析器，来试试手，[代码仓库](https://github.com/zeromake/tree-sitter-calc)

### 创建项目

```bash
mkdir tree-sitter-calc

cd tree-sitter-calc

# 这是 node 绑定需要的，可以不用整，可以用 tree-sitter 命令
# npm init
# npm install --save nan
```

> nan 是一个 Node.js 的原生抽象层，它提供了一个简单的方法来写 Node.js 的 C/C++ 插件。

### `grammar.js` 编写

```js
module.exports = grammar({
  name: "calc",
  // 跳过空白符号
  extras: () => [/\s/],
  rules: {
    // 第一个表达式会作为解析起始
    // 数字或者表达式
    expression: ($) => choice($.number, $.binary_expression),
    // 表达式 +,-,*,/ 左右再次引用 expression，然后就自带重复效果
    // 记得必须要使用 prec.left，或者 prec.right 否则无法生成代码
    binary_expression: ($) =>
      choice(
        ...[["+"], ["-"], ["*"], ["/"]].map(([operator]) =>
          prec.left(
            0,
            seq(
              field("left", $.expression),
              field("op", operator),
              field("right", $.expression)
            )
          )
        )
      ),
    // 支持下划线的数字
    number: ($) => seq(/\d(_?\d)*/),
  },
});
```

### 测试 parse 效果

```bash
tree-sitter generate

echo '10 - 10 * 10' > test.move

tree-sitter parse test.move
```

输出

```lisp
(expression [0, 0] - [0, 12]
  (binary_expression [0, 0] - [0, 12]
    left: (expression [0, 0] - [0, 7]
      (binary_expression [0, 0] - [0, 7]
        left: (expression [0, 0] - [0, 2]
          (number [0, 0] - [0, 2]))
        right: (expression [0, 5] - [0, 7]
          (number [0, 5] - [0, 7]))))
    right: (expression [0, 10] - [0, 12]
      (number [0, 10] - [0, 12]))))
```

可以看到正确的解析了一个计算器表达式，不过和我们想要的带运算符优先级的效果不太相同，修改一下 grammar.js 的 prec.left 优先级。

```js
module.exports = grammar({
  name: "calc",
  // 跳过空白符号
  extras: () => [/\s/],
  rules: {
    // 第一个表达式会作为解析起始
    // 数字或者表达式
    expression: ($) => choice($.number, $.binary_expression),
    // 表达式 +,-,*,/ 左右再次引用 expression，然后就自带重复效果
    // 记得必须要使用 prec.left，或者 prec.right 否则无法生成代码
    // 给 * / 添加更高的优先级，就能支持符号优先级了
    binary_expression: ($) =>
      choice(
        ...[
          ["+", 0],
          ["-", 0],
          ["*", 1],
          ["/", 1],
        ].map(([operator, r]) =>
          prec.left(
            r,
            seq(
              field("left", $.expression),
              field("op", operator),
              field("right", $.expression)
            )
          )
        )
      ),
    // 支持下划线的数字
    number: ($) => seq(/\d(_?\d)*/),
  },
});
```

测试

```bash
tree-sitter generate
➜ echo '10 - 10 * 10' > calc.txt
➜ tree-sitter parse calc.txt
```

输出

```lisp
(expression [0, 0] - [0, 12]
  (binary_expression [0, 0] - [0, 12]
    left: (expression [0, 0] - [0, 2]
      (number [0, 0] - [0, 2]))
    right: (expression [0, 5] - [0, 12]
      (binary_expression [0, 5] - [0, 12]
        left: (expression [0, 5] - [0, 7]
          (number [0, 5] - [0, 7]))
        right: (expression [0, 10] - [0, 12]
          (number [0, 10] - [0, 12]))))))
```

这次可以看到后面的两个数字作为了一个表达式，符合了我们的要求。

## 三、参考 tree-sitter-json 说明每行的语法效果

> [tree-sitter-json](https://github.com/tree-sitter/tree-sitter-json)

```js
// , 分割的重复效果 [1,2,3], [1]
function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

// , 分割的重复效果，但是不是必须的，可以支持类似 [1,2,3], []
function commaSep(rule) {
  return optional(commaSep1(rule));
}
module.exports = grammar({
  name: "json",

  // 跳过注释和空白符号（注释在 json 标准是不支持的，这个应该是 json5 才支持的）
  extras: ($) => [/\s/, $.comment],
  // 不知道干啥用的
  supertypes: ($) => [$._value],

  rules: {
    // 重复 _value 规则，如果是 json 应该改成 $._value, jsonl 应该是 repeat1($._value)
    document: ($) => repeat($._value),

    // 每种 json 的表达式构成了一个 item
    _value: ($) =>
      choice($.object, $.array, $.number, $.string, $.true, $.false, $.null),

    // object {}, {"1": 1}
    object: ($) => seq("{", commaSep($.pair), "}"),

    // "1": 1
    pair: ($) =>
      seq(
        field("key", choice($.string, $.number)),
        ":",
        field("value", $._value)
      ),

    // array [], [1]
    array: ($) => seq("[", commaSep($._value), "]"),

    // 空白的字符串与有内容的字符串
    string: ($) => choice(seq('"', '"'), seq('"', $.string_content, '"')),

    // 使用 prec 优先命中除 \,",\n 这些符号
    string_content: ($) =>
      repeat1(choice(token.immediate(prec(1, /[^\\"\n]+/)), $.escape_sequence)),

    // 匹配中 \n 之类的转义效果
    escape_sequence: ($) =>
      token.immediate(seq("\\", /(\"|\\|\/|b|f|n|r|t|u)/)),

    // 多种数字匹配，这个就不说了，太常见了
    number: ($) => {
      const hex_literal = seq(choice("0x", "0X"), /[\da-fA-F]+/);

      const decimal_digits = /\d+/;
      const signed_integer = seq(optional(choice("-", "+")), decimal_digits);
      const exponent_part = seq(choice("e", "E"), signed_integer);

      const binary_literal = seq(choice("0b", "0B"), /[0-1]+/);

      const octal_literal = seq(choice("0o", "0O"), /[0-7]+/);

      const decimal_integer_literal = seq(
        optional(choice("-", "+")),
        choice("0", seq(/[1-9]/, optional(decimal_digits)))
      );

      const decimal_literal = choice(
        seq(
          decimal_integer_literal,
          ".",
          optional(decimal_digits),
          optional(exponent_part)
        ),
        seq(".", decimal_digits, optional(exponent_part)),
        seq(decimal_integer_literal, optional(exponent_part))
      );

      return token(
        choice(hex_literal, decimal_literal, binary_literal, octal_literal)
      );
    },

    // 三个常量表达式
    true: ($) => "true",

    false: ($) => "false",

    null: ($) => "null",
    // json5 的注释支持
    comment: ($) =>
      token(
        choice(seq("//", /.*/), seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/"))
      ),
  },
});
```

由于 json 里 object, array 并没有直接再次引用自己，所以无需使用 prec 处理重复的情况。

## 四、语法参考表

> [官方参考](http://tree-sitter.github.io/tree-sitter/creating-parsers#the-grammar-dsl)

### 额外表达式

| 名称               | 表达式          | 示例                                                   | 说明                                                                                                                                                 |
| ------------------ | --------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 语法函数的参数 `$` | `$ => {}`       | `{rules: {document: $ => choice($.string, $.number)}}` | 每个语法规则都是一个函数，函数的参数是名一般为 `$`。`$` 是一个 object 规则中的所有符号都在这个 `$` 参数上，`$.string` 就是引用 `rules` 的 `string`。 |
| 字面量             | `"true", /\w+/` | `'"', /\[0-1\]+/`                                      | 字符串和正则(正则与 js 书写方式一致，但是最终到 c 代码里效果并不是正则)                                                                              |

### 公共字段


| 名称       | 说明                                                      |
| ---------- | -------------------------------------------------------- |
| extras     | 可能出现在语言中任何地方的符号数组，空格换行之类的字符。     |
| inline     | 一组规则名称，应通过将其所有用法替换为其定义的副本来自动从语法中删除。这对于在多个地方使用但不想在运行时创建语法树节点的规则很有用。 |
| conflicts  | 规则名称数组的数组。                                       |
| externals  | 可以由外部扫描器返回的符号名称数组。                       |
| word       | 关键字一般用于编程语言里的操作符与变量连接区分         |
| supertypes | 把隐藏的规则放置到 supertypes 里                  |


### 内置函数

| 名称            | 表达式                     | 示例                                  | 说明                                                         |
| --------------- | -------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| seq             | seq(rule1, rule2, …)       | `seq("(", /w+,?/, ")")`               | 使用其他的规则构建一个新的规则，按顺序拼接下去               |
| choice          | choice(rule1, rule2, …)    | `choice("'", "\"")`                   | 使用其他规则创建一个新规则，顺序无关，类似于正则里 `|` 效果  |
| repeat          | repeat(rule)               | `repeat(" ")`                         | 重复 0-n 该规则，类似于正则里的 `*` 效果                     |
| repeat1         | repeat1(rule)              | `repeat1("0x")`                       | 重复 1-n 该规则，类似于正则里的 `+` 效果                     |
| optional        | optional(rule)             | `optional("0x")`                      | 重复 0-1 该规则，类似于正则里的 `?` 效果                     |
| prec            | prec(number, rule)         | `prec(1, /\+-\*\\/)`                  | 指定规则优先级。默认优先级为 0。一般用于 choice 有叠加的情况 |
| prec.left       | prec.left(number, rule)    | `prec.left(1, /\+-\*\\/)`             | 出现相同规则优先级时，优先执行左侧规则。                     |
| prec.right      | prec.right(number, rule)   | `prec.right(1, /\+-\*\\/)`            | 出现相同规则优先级时，优先执行右侧规则。                     |
| prec.dynamic    | prec.dynamic(number, rule) | `prec.dynamic(1, /\+-\*\\/)`          | 优先级在动态运行时有效。动态运行处理语法冲突时，才有必要。   |
| token           | token(rule)                | `token(prec(1, /\+-\*\\/))`           | 将规则输出的内容标记为单个符号。默认是将字符串或正则标记为单独的符号。本函数可以将复杂表达式，标记为单个符号(在 c 里有优化效果，多个字符作为一个分支，否则会每个规则都需要一个分支代码)。 |
| token.immediate | token.immediate(rule)      | `token.immediate(prec(1, /\+-\*\\/))` | 只有在前面没有空格时，进行符号化。                           |
| alias           | alias(rule, name)          | `alias($.string, "commit")`           | 语法树中以替代名称出现。                                     |
| field           | field(name, rule)          | `field("key", choice($.string))`      | 将字段名称分配给规则，解析后可以用该名命中规则匹配。         |



## 参考

- [tree-sitter 官方文档](ttps://tree-sitter.github.io)
- [创建解析器](https://tree-sitter.github.io/tree-sitter/creating-parsers)



# 创建解析器


开发Tree-sitter语法可能有一个困难的学习曲线，但是一旦你掌握了它的窍门，它就会很有趣，甚至像禅宗一样。本文档将帮助您开始并开发一个有用的心理模型。

## 入门

### 依赖关系

为了开发 Tree-Sitter 解析器，需要安装两个依赖项：

- **Node.js**- Tree-sitter语法是用JavaScript编写的，Tree-sitter使用[Node.js](https://nodejs.org/)来解释JavaScript文件。它要求`node`命令位于[`PATH`](https://en.wikipedia.org/wiki/PATH_(variable))中的一个目录中。您需要Node.js 6.0或更高版本。
- **C语言解析器**- Tree-sitter创建用C语言编写的解析器。为了使用`tree-sitter parse`或`tree-sitter test`命令运行和测试这些解析器，必须安装C编译器。Tree-sitter将尝试在每个平台的标准位置查找这些编译器。

### 安装

要创建Tree-Sitter解析器，需要使用 [`Tree-Sitter`CLI](https://github.com/tree-sitter/tree-sitter/tree/master/cli)。您可以通过几种不同的方式安装CLI：

- 使用Rust包管理器cargo从源[`代码`](https://doc.rust-lang.org/cargo/getting-started/installation.html)构建`树型结构的`[Rust crate](https://crates.io/crates/tree-sitter-cli)。这适用于任何平台。更多信息请参见[贡献文档](https://tree-sitter.github.io/tree-sitter/contributing#developing-tree-sitter)。
- 使用[`npm`](https://docs.npmjs.com/)（Node包管理器）安装`tree-sitter-`[code.js模块](https://www.npmjs.com/package/tree-sitter-cli)。这种方法速度很快，但仅适用于某些平台，因为它依赖于预构建的二进制文件。
- 从[最新的GitHub版本](https://github.com/tree-sitter/tree-sitter/releases/latest)下载一个适合你的平台的二进制文件，并将其放在`PATH`上的一个目录中。

### 项目设置

首选的约定是将解析器存储库命名为“tree-sitter-”，后跟语言名称。

```
mkdir tree-sitter-${YOUR_LANGUAGE_NAME}
cd tree-sitter-${YOUR_LANGUAGE_NAME}
```

您可以使用`tree-sitter`CLI工具来设置您的项目，并允许您的解析器从多种语言中使用。

```
# This will prompt you for input
tree-sitter init
```

安装CLI并运行`init`命令的提示符后，应该存在一个名为`grammar.js的`文件，其中包含以下内容：

```js
/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: 'YOUR_LANGUAGE_NAME',

  rules: {
    // TODO: add the actual grammar rules
    source_file: $ => 'hello'
  }
});
```

现在，运行以下命令：

```
tree-sitter generate
```

这将生成解析这个简单语言所需的C代码，以及编译和加载这个本地解析器作为Node.js模块所需的一些文件。

你可以通过创建一个包含“hello”内容的源文件并解析它来测试这个解析器：

```
echo 'hello' > example-file
tree-sitter parse example-file
```

在Windows PowerShell中：

```pwsh
"hello" | Out-File example-file -Encoding utf8
tree-sitter parse example-file
```

这将打印以下内容：

```
(source_file [0, 0] - [1, 0])
```

现在您有了一个可以工作的解析器。

最后，回顾一下 `grammar.js` 中的[三重斜杠](https://www.typescriptlang.org/docs/handbook/triple-slash-directives.html)和[`@ts-check`](https://www.typescriptlang.org/docs/handbook/intro-to-js-ts.html)注释;这些注释告诉编辑器在编辑语法时提供文档和类型信息。要使这些工作，您必须从npm下载Tree-sitter的TypeScript API到项目中的`node_modules`目录中：

```
npm install
```

## 工具概述

让我们回顾一下 `tree-sitter` 命令行工具的所有功能。

### [Command: init 命令：init](https://tree-sitter.github.io/tree-sitter/creating-parsers#command-init)

您可能会运行的第一个命令是`init`命令。这个命令设置一个空的存储库，其中包含语法存储库所需的所有内容。它只有一个可选参数-`-update`，如果需要，它将更新过时的生成文件。

用户需要配置的主要文件是`tree-sitter.json`，它告诉CLI有关语法的信息，例如查询。

#### Structure of `tree-sitter.json` `tree-sitter.json`的结构

##### The `grammars` field `语法`领域

这个字段是一个对象数组，你通常只需要一个对象在这个数组中，除非你的仓库有多个语法（例如，像`Typescript`和`TSX`）

###### Basics 基础知识

这些键指定了有关解析器的基本信息：

- `scope`（required）-一个类似`“source.js”的`字符串，用于标识语言。目前，我们努力匹配流行的[TextMate语法](https://macromates.com/manual/en/language_grammars)和[Linguist](https://github.com/github/linguist)库使用的作用域名称。
- `path`-从包含`tree-sitter.json`的目录到另一个包含`src/`文件夹的目录的相对路径，其中包含实际生成的解析器。默认值为`“。“`（因此`src/`与tree-sitter.json在同一个文件夹中``），并且很少需要重写。
- `external-files`-从解析器的根目录到在重新编译期间应检查修改的文件的相对路径列表。这在开发过程中很有用，因为除了scanner.c之外，其他文件的更改也会被MySQL拾取。

###### 语言检测

这些键有助于决定语言是否适用于给定的文件：

- `file-types`-文件名后缀字符串数组。语法将用于名称以这些后缀之一结尾的文件。请注意，后缀可以匹配*整个*文件名。
- `first-line-regex`-一个正则表达式模式，将针对文件的第一行进行测试，以确定该语言是否适用于该文件。如果存在的话，这个正则表达式将用于任何语言与任何语法的`文件类型`都不匹配的文件。
- `content-regex`-一个正则表达式模式，将根据文件的内容进行测试，以便在多个语法使用上述两个标准匹配文件的情况下打破联系。如果正则表达式匹配，则此语法将优先于另一个没有`内容的语法-正则`表达式。如果正则表达式不匹配，则无`内容正则表达式`的语法将优先于此语法。
- `injection-regex`-将针对*语言名称*进行测试的正则表达式模式，以确定该语言是否应用于潜在的*语言注入*站点。语言注入将在[后面的章节中](https://tree-sitter.github.io/tree-sitter/creating-parsers#language-injection)详细描述。

###### 查询路径

这些键指定从包含`tree-sitter.json`的目录到控制语法高亮显示的文件的相对路径：

- `highlights`-*突出显示查询*的路径 。默认值：`queries/highlights.scm`
- `locals`-*局部变量查询*的路径 。默认值：`queries/locals.scm`。
- `injection`-*进样查询*的路径 。默认值：`queries/injections.scm`。
- `tags`-*标记查询*的路径 。默认值：`queries/`tags.scm.

下一节将介绍这三个文件的行为。

##### `metadata` 字段

这个字段包含了tree-sitter用来填充相关绑定文件的信息，尤其是它们的版本。未来的`bump-version`和`publish`子命令也将利用此版本信息。通常，这些都是在运行`tree-sitter init`时设置的，但欢迎您根据需要进行更新。

- `version`（必需）-语法的当前版本，应该跟在[semver](https://semver.org/)之后
- `license`-语法的许可证，应该是有效的[SPDX许可证](https://spdx.org/licenses)
- `description`-语法的简要描述
- `authors`（必填）-包含`name`字段以及可选的`email`和`url`字段的对象数组。每个字段都是一个字符串
- `links`-包含`repository`字段和`homepage`字段（可选）的对象。每个字段都是一个字符串
- `namespace`-`Java` 和`kotlin`绑定的命名空间，如果没有提供，默认为`io.github.tree-sitter`

##### `bindings` 字段

此字段控制运行`init`命令时生成的绑定。每个键都是一个语言名称，值是布尔值。

- `c` (default: `true`)
- `go` (default: `true`)
- `java` (default: `false`)
- `kotlin` (default: `false`)
- `node` (default: `true`)
- `python` (default: `true`)
- `rust` (default: `true`)
- `swift` (default: `false`)

### 命令: version

`version`命令打印您安装的`tree-sitter`CLI工具的版本。

```
tree-sitter version 1.0.0
```

唯一的参数是版本本身，这是第一个位置参数。这将更新多个文件中的版本（如果存在）：

- tree-sitter.json
- Cargo.toml
- package.json
- Makefile
- CMakeLists.txt
- pyproject.toml

作为语法作者，您应该在不同的绑定之间保持语法版本的同步。但是，手动执行此操作容易出错且繁琐，因此此命令可以解决此问题。

### [Command: generate 命令：生成](https://tree-sitter.github.io/tree-sitter/creating-parsers#command-generate)

您将使用的最重要的命令是`tree-sitter generate`。此命令读取当前工作目录中的`grammar.js`文件，并创建一个名为`src/parser. c的`文件，该文件实现了解析器。修改语法后，只需再次运行`tree-sitter generate`。

第一次运行`tree-sitter generate时`，它还将为以下语言的绑定生成一些其他文件：

#### C/C++

- `Makefile`-这个文件告诉`make`如何编译你的语言。
- `bindings/c/tree-sitter-language.h`-此文件提供您的语言的C接口。
- `bindings/c/tree-sitter-language.pc`-此文件提供有关语言的C库的pkg-config元数据。
- `src/tree_siter/parser. h`-此文件提供了一些基本的C定义，用于生成的`parser. c`文件。
- `src/tree_siter/alloc. h`-此文件提供了一些内存分配宏，如果您有外部扫描程序，则会在外部扫描程序中使用这些宏。
- `src/tree_siter/array. h`-此文件提供了一些将在外部扫描仪中使用的数组宏（如果有）。

#### Go

- `bindings/go/binding.go`-这个文件将你的语言包装在一个Go模块中。
- `bindings/go/binding_test.go`-此文件包含Go包的测试。

#### Node

- `binding.gyp`-这个文件告诉Node.js如何编译你的语言。
- `bindings/node/index.js`-这是Node.js在使用您的语言时最初加载的文件。
- `bindings/node/binding.cc`-此文件将您的语言包装在Node.js的JavaScript模块中。

#### Python

- `pyproject.toml`这个文件是Python包的清单。
- `setup.py`-这个文件告诉Python如何编译你的语言。
- `bindings/python/binding.c`-这个文件将你的语言包装在一个Python模块中。
- `bindings/python/tree_sitter_language/__init__.py`-这个文件告诉Python如何加载你的语言。
- `bindings/python/tree_sitter_language/__init__.pyi`-当在Python中使用时，此文件为解析器提供类型提示。
- `bindings/python/tree_sitter_language/py.typed`-当在Python中使用时，此文件为解析器提供类型提示。

#### Rust

- `Cargo.toml`-这个文件是Rust包的清单。
- `bindings/rust/lib.rs`-在Rust中使用时，此文件将您的语言包装在Rust crate中。
- `bindings/rust/build.rs`-这个文件包装了Rust crate的构建过程。

#### Swift

  `Package.swift`-这个文件告诉Swift如何编译你的语言。
  `bindings/swift/TreeSitterlanguage/language.h`-在Swift中使用时，此文件将您的语言包装在Swift模块中。

如果语法中存在歧义或 *局部歧义*，Tree-sitter 将在解析器生成期间检测到它，并将退出，并显示`Unresolved conflict`错误消息。有关这些错误的更多信息，请参见下文。


### 命令：build

`build`命令将解析器编译成一个动态编译库，可以是一个共享对象（`.so`、`.dylib`或`.dll`），也可以是一个WASM模块。

您可以通过`CC`环境变量更改编译器可执行文件，并通过`CFLAGS`添加额外的标志。对于macOS或iOS，您可以分别设置`MACOSX_DEPLOYMENT_TARGET`或`IPHONEOS_DEPLOYMENT_TARGET`来定义支持的最低版本。

你可以使用`--wasm`/`-w`标志来指定是否将其编译为wasm模块，你也可以选择使用docker或podman来为emscripten提供`--docker`/`-d`标志。这样就不需要在本地机器上安装emscripten。

您可以使用`--output`/`-o`标志指定将共享对象文件（native或WASM）输出到何处，该标志接受绝对路径或相对路径。请注意，如果您不提供此标志，CLI将尝试根据父目录找出用于输出文件的语言名称（因此构建`tree-sitter-JavaScript`将解析为`JavaScript`）。如果它不能弄清楚，它将默认为`parser`，从而在当前工作目录中生成`parser.so`或`parser.wasm`。

最后，您还可以指定实际语法目录的路径，以防您当前不在其中。这是通过提供路径作为第一个*位置*参数来实现的。

例子：

```
tree-sitter build --wasm --output ./build/parser.wasm tree-sitter-javascript
```

注意`tree-sitter-JavaScript`参数是如何成为第一个位置参数的。

### 命令：test

`tree-sitter test` 命令允许您轻松测试解析器是否正常工作。

对于添加到语法中的每个规则，您应该首先创建一个*test*，描述语法树在解析该规则时的外观。这些测试是使用解析器根文件夹中的`test/corpus/`目录中的特殊格式的文本文件编写的。

例如，您可能有一个名为`test/corpus/statements.txt的`文件，其中包含一系列如下条目：

```
==================
Return statements
==================

func x() int {
  return 1;
}

---

(source_file
  (function_definition
    (identifier)
    (parameter_list)
    (primitive_type)
    (block
      (return_statement (number)))))
```

  每个测试的**名字**写在两行之间，只包含`=`（等号）字符。

  然后编写**输入源代码**，后跟一行包含三个或更多`-`（破折号）字符。

  然后，将**预期的输出语法树**写成[S表达式](https://en.wikipedia.org/wiki/S-expression)。空格在S表达式中的确切位置并不重要，但理想情况下语法树应该清晰易读。请注意，S表达式没有显示像`func`、`（`和`;这样的`语法节点，它们在语法中表示为字符串和正则表达式。它只显示*命名*的节点，如[本页](https://tree-sitter.github.io/tree-sitter/using-parsers#named-vs-anonymous-nodes)中关于解析器使用的部分所述。

  预期输出部分还可以*选择*显示与每个子节点关联的[*字段名称*](https://tree-sitter.github.io/tree-sitter/using-parsers#node-field-names)。要在测试中包含字段名称，请在S表达式中的节点本身之前写入节点的字段名称，后跟冒号：

```
(source_file
  (function_definition
    name: (identifier)
    parameters: (parameter_list)
    result: (primitive_type)
    body: (block
      (return_statement (number)))))
```

- 如果您的语言的语法`===`和`---`test分隔符冲突，您可以选择添加任意相同的后缀（在下面的示例中，`||| `）来消除它们的歧义：

```
==================|||
Basic module
==================|||

---- MODULE Test ----
increment(n) == n + 1
====

---|||

(source_file
  (module (identifier)
    (operator (identifier)
      (parameter_list (identifier))
      (plus (identifier_ref) (number)))))
```

这些测试很重要。它们充当解析器的API文档，并且可以在每次更改语法时运行它们，以验证所有内容仍然正确解析。

默认情况下，`tree-sitter test`命令运行`test/corpus/`文件夹中的所有测试。要运行特定的测试，您可以使用`-f`标志：

```
tree-sitter test -f 'Return statements'
```

建议在添加测试时要全面。如果它是一个可见的节点，将其添加到`test/corpus`目录下的测试文件中。测试每种语言结构的所有排列通常是一个好主意。这增加了测试的覆盖率，但同时也为读者提供了一种检查预期输出和理解语言“边缘”的方法。

#### 属性

测试可以用一些`属性`进行注释。属性必须放在测试名称下面的标题中，并以：开头。``一些属性也接受一个参数，这需要使用括号。

**注意**：如果你想提供多个参数，例如在多个平台上运行测试或测试多种语言，你可以在新的一行重复属性。

以下属性可用：

- `：skip`-此属性将在运行`tree-sitter test`时跳过测试。当您想要暂时禁止执行测试而不删除它时，这很有用。
- `：error`-此属性将断言解析树包含错误。只验证某个输入是无效的而不显示整个解析树是很有用的，因此您应该省略`-`行下面的解析树。
- `：fail-fast`-如果用此属性标记的测试失败，此属性将停止测试其他测试。
- `：language（LANG）`-此属性将使用指定语言的解析器运行测试。这对于多解析器存储库很有用，比如XML和DTD，或者Typescript和TSX。所使用的默认解析器将始终是`tree-sitter.json`配置文件中`语法`字段的第一个条目，因此选择第二个甚至第三个解析器的方法很有用。
- `：platform（PLATFORM）`-此属性指定测试应运行的平台。测试特定于平台的行为是很有用的（例如，Windows换行符与Unix不同）。此属性必须与Rust的[`std：：env：：consts：：OS`](https://doc.rust-lang.org/std/env/consts/constant.OS.html)匹配。

使用属性的示例：

```
=========================
Test that will be skipped
:skip
=========================

int main() {}

-------------------------

====================================
Test that will run on Linux or macOS

:platform(linux)
:platform(macos)
====================================

int main() {}

------------------------------------

========================================================================
Test that expects an error, and will fail fast if there's no parse error
:fail-fast
:error
========================================================================

int main ( {}

------------------------------------------------------------------------

=================================================
Test that will parse with both Typescript and TSX
:language(typescript)
:language(tsx)
=================================================

console.log('Hello, world!');

-------------------------------------------------
```

#### Automatic Compilation 自动编译

您可能会注意到，在重新生成解析器后第一次运行`tree-sitter test`，需要花费一些额外的时间。这是因为Tree-sitter会自动将您的C代码编译为动态可加载的库。每当您通过重新运行`tree-sitter generate更新`解析器时，它都会根据需要重新编译解析器。

#### Syntax Highlighting Tests 突出显示测试

`tree-sitter test`命令*还*将运行`test/highlight`文件夹中的任何语法突出显示测试（如果存在）。有关语法突出显示测试的详细信息，请参阅[语法突出显示页](https://tree-sitter.github.io/tree-sitter/syntax-highlighting#unit-testing)。

### 命令：parse

您可以使用`tree-sitter parse`在任意文件上运行解析器。这将打印生成的语法树，包括节点的范围和字段名称，如下所示：

```
(source_file [0, 0] - [3, 0]
  (function_declaration [0, 0] - [2, 1]
    name: (identifier [0, 5] - [0, 9])
    parameters: (parameter_list [0, 9] - [0, 11])
    result: (type_identifier [0, 12] - [0, 15])
    body: (block [0, 16] - [2, 1]
      (return_statement [1, 2] - [1, 10]
        (expression_list [1, 9] - [1, 10]
          (int_literal [1, 9] - [1, 10]))))))
```

您可以将任意数量的文件路径和glob模式传递给`tree-sitter parse`，它将解析所有给定的文件。如果发生任何分析错误，该命令将以非零状态代码退出。传递-`-cst`标志将输出一个漂亮的CST，而不是正常的S表达式表示。您还可以使用`--quiet`标志防止打印语法树。此外，`--stat`标志打印出所有已处理文件的聚合解析成功/失败信息。这使得`tree-sitter解析可以`作为辅助测试策略：您可以检查大量文件的解析没有错误：

```
tree-sitter parse 'examples/**/*.go' --quiet --stat
```

### 命令：highlight

您可以使用`tree-sitter highlight`在任意文件上运行语法突出显示。这可以使用ansi转义码直接将颜色输出到您的终端，或者生成HTML（如果传递`了--html`标志）。有关详细信息，请参阅[语法突出显示页](https://tree-sitter.github.io/tree-sitter/syntax-highlighting)。

### 语法 DSL

下面是一个完整的内置函数列表，您可以在`grammar.js`中使用这些函数来定义规则。这些函数中的一些函数的用例将在后面的部分中更详细地解释。

  **Symbols（`$`对象）**--每个语法规则都被编写为一个JavaScript函数，该函数接受一个通常称为`$`的参数。语法`$.identifier`是在规则中引用另一个语法符号的方式。应该避免使用以`$.MISSING`或`$.UNEXPECTED`开头的名称，因为它们对`tree-sitter test`命令有特殊意义。
  **字符串和正则表达式**-语法中的终止符使用JavaScript字符串和正则表达式进行描述。当然，在解析过程中，Tree-sitter实际上并不使用JavaScript的正则表达式引擎来计算这些正则表达式;它生成自己的正则表达式匹配逻辑作为每个解析器的一部分。正则表达式字面量只是作为在语法中编写正则表达式的一种方便方法。
  **Regex限制**-目前，只有Regex引擎的一个子集实际上得到支持。这是由于某些特性，如lookahead和lookaround断言在LR（1）语法中不可行，以及某些标志对于树坐器是不必要的。但是，默认情况下支持大量功能：
  - Character classes 字符类
  - Character ranges 字符范围
  - Character sets 字符集
  - Quantifiers 量词
  - Alternation 交替
  - Grouping 分组
  - Unicode character escapes
    Unicode字符转义
  - Unicode property escapes Unicode属性转义
- **Sequences : `seq(rule1, rule2, ...)`** - This function creates a rule that matches any number of other rules, one after another. It is analogous to simply writing multiple symbols next to each other in [EBNF notation](https://en.wikipedia.org/wiki/Extended_Backus–Naur_form).
  **序列：`seq（rule 1，rule 2，.）`**此函数创建一个规则，该规则一个接一个地匹配任何数量的其他规则。这类似于简单地在[EBNF表示法](https://en.wikipedia.org/wiki/Extended_Backus–Naur_form)中将多个符号彼此相邻地写入。
- **Alternatives : `choice(rule1, rule2, ...)`** - This function creates a rule that matches *one* of a set of possible rules. The order of the arguments does not matter. This is analogous to the `|` (pipe) operator in EBNF notation.
  **备选方案：`选择（规则1，规则2，...）`**- 此函数创建与一组可能的规则之一匹配的规则。参数的顺序并不重要。这类似于`|`EBNF表示法中的（管道）运算符。
- **Repetitions : `repeat(rule)`** - This function creates a rule that matches *zero-or-more* occurrences of a given rule. It is analogous to the `{x}` (curly brace) syntax in EBNF notation.
  **Repetitions：`repeat（rule）`**-此函数创建一个匹配给定规则的*零次或多次*出现的规则。它类似于EBNF表示法中的`{x}`（花括号）语法。
- **Repetitions : `repeat1(rule)`** - This function creates a rule that matches *one-or-more* occurrences of a given rule. The previous `repeat` rule is implemented in terms of `repeat1` but is included because it is very commonly used.
  **Repetitions：`repeat 1（rule）`**-此函数创建与给定规则的*一个或多个*实例匹配的规则。前面的`repeat`规则是根据`repeat 1`实现的，但也包括在内，因为它非常常用。
- **Options : `optional(rule)`** - This function creates a rule that matches *zero or one*occurrence of a given rule. It is analogous to the `[x]` (square bracket) syntax in EBNF notation.
  **Options：`optional（rule）`**-此函数创建与给定规则的*零次或一*次匹配的规则。它类似于EBNF表示法中的`[x]`（方括号）语法。
- **Precedence : `prec(number, rule)`** - This function marks the given rule with a numerical precedence which will be used to resolve [*LR(1) Conflicts*](https://en.wikipedia.org/wiki/LR_parser#Conflicts_in_the_constructed_tables) at parser-generation time. When two rules overlap in a way that represents either a true ambiguity or a *local* ambiguity given one token of lookahead, Tree-sitter will try to resolve the conflict by matching the rule with the higher precedence. The default precedence of all rules is zero. This works similarly to the [precedence directives](https://docs.oracle.com/cd/E19504-01/802-5880/6i9k05dh3/index.html) in Yacc grammars.
  **`prec（number，rule）`**--这个函数用一个数字优先级来标记给定的规则，这个优先级将用于在解析器生成时解决[*LR（1）冲突*](https://en.wikipedia.org/wiki/LR_parser#Conflicts_in_the_constructed_tables)。当两个规则重叠时，如果给定一个lookahead标记，则表示真正的模糊性或*局部*模糊性，Tree-sitter将尝试通过匹配具有更高优先级的规则来解决冲突。所有规则的默认优先级为零。这类似于Yacc语法中的[优先指令](https://docs.oracle.com/cd/E19504-01/802-5880/6i9k05dh3/index.html)。
- **Left Associativity : `prec.left([number], rule)`** - This function marks the given rule as left-associative (and optionally applies a numerical precedence). When an LR(1) conflict arises in which all of the rules have the same numerical precedence, Tree-sitter will consult the rules’ associativity. If there is a left-associative rule, Tree-sitter will prefer matching a rule that ends *earlier*. This works similarly to [associativity directives](https://docs.oracle.com/cd/E19504-01/802-5880/6i9k05dh3/index.html) in Yacc grammars.
  **Left Associativity：`prec.left（[number]，rule）`**-此函数将给定规则标记为左关联（并可选应用数字优先级）。当LR（1）冲突发生时，所有规则都具有相同的数值优先级，Tree-sitter将参考规则的结合性。如果存在左关联规则，Tree-sitter将优先匹配*较早*结束的规则。这类似于Yacc语法中[的结合性指令](https://docs.oracle.com/cd/E19504-01/802-5880/6i9k05dh3/index.html)。
- **Right Associativity : `prec.right([number], rule)`** - This function is like `prec.left`, but it instructs Tree-sitter to prefer matching a rule that ends *later*.
  **Right Associativity：`prec.right（[number]，rule）`**-该函数类似于`prec.left`，但它指示Tree-sitter优先匹配*稍后*结束的规则。
- **Dynamic Precedence : `prec.dynamic(number, rule)`** - This function is similar to `prec`, but the given numerical precedence is applied at *runtime* instead of at parser generation time. This is only necessary when handling a conflict dynamically using the `conflicts` field in the grammar, and when there is a genuine *ambiguity*: multiple rules correctly match a given piece of code. In that event, Tree-sitter compares the total dynamic precedence associated with each rule, and selects the one with the highest total. This is similar to [dynamic precedence directives](https://www.gnu.org/software/bison/manual/html_node/Generalized-LR-Parsing.html) in Bison grammars.
  **dynamicPrecedence：`prec.dynamic（number，rule）`**--这个函数类似于`prec`，但是给定的数字优先级是在*运行时*应用的，而不是在解析器生成时应用的。只有当使用语法中的`conflicts`字段动态处理冲突时，以及当存在真正的*二义性时*（多个规则正确匹配给定的代码段），才需要这样做。在这种情况下，Tree-Sitter比较与每个规则关联的总动态优先级，并选择具有最高总优先级的规则。这类似于野牛语法中[的动态优先指令](https://www.gnu.org/software/bison/manual/html_node/Generalized-LR-Parsing.html)。
- **Tokens : `token(rule)`** - This function marks the given rule as producing only a single token. Tree-sitter’s default is to treat each String or RegExp literal in the grammar as a separate token. Each token is matched separately by the lexer and returned as its own leaf node in the tree. The `token` function allows you to express a complex rule using the functions described above (rather than as a single regular expression) but still have Tree-sitter treat it as a single token. The token function will only accept terminal rules, so `token($.foo)` will not work. You can think of it as a shortcut for squashing complex rules of strings or regexes down to a single token.
  **Tokens：`token（rule）`**--这个函数将给定的规则标记为只生成一个token。Tree-sitter的默认设置是将语法中的每个String或RegExp字面量视为单独的标记。每个标记由lexer单独匹配，并作为树中自己的叶节点返回。`token`函数允许您使用上面描述的函数（而不是作为单个正则表达式）来表达复杂的规则，但Tree-sitter仍然将其视为单个token。token函数只接受终端规则，所以`token（$.foo）`将不起作用。您可以将其视为将字符串或正则表达式的复杂规则压缩为单个标记的快捷方式。
- **Immediate Tokens : `token.immediate(rule)`** - Usually, whitespace (and any other extras, such as comments) is optional before each token. This function means that the token will only match if there is no whitespace.
  **immediate`（规则）`**-通常，在每个token之前，空格（以及任何其他额外的内容，如注释）是可选的。这个函数意味着只有在没有空格的情况下，标记才会匹配。
- **Aliases : `alias(rule, name)`** - This function causes the given rule to *appear* with an alternative name in the syntax tree. If `name` is a *symbol*, as in `alias($.foo, $.bar)`, then the aliased rule will *appear* as a [named node](https://tree-sitter.github.io/tree-sitter/using-parsers#named-vs-anonymous-nodes) called `bar`. And if `name`is a *string literal*, as in `alias($.foo, 'bar')`, then the aliased rule will appear as an [anonymous node](https://tree-sitter.github.io/tree-sitter/using-parsers#named-vs-anonymous-nodes), as if the rule had been written as the simple string.
  **Aliases：`alias（rule，name）`**-此函数使给定规则在语法树中以替代名称*出现*。如果`name`是一个*符号*，如`alias（$.foo，$.bar）`，那么别名规则将*显示*为一个名为`bar的`[命名节点](https://tree-sitter.github.io/tree-sitter/using-parsers#named-vs-anonymous-nodes)。如果`name`是一个*字符串文字*，如`alias（$.foo，'bar'）`，那么别名规则将显示为[匿名节点](https://tree-sitter.github.io/tree-sitter/using-parsers#named-vs-anonymous-nodes)，就好像规则被写为简单字符串一样。
- **Field Names : `field(name, rule)`** - This function assigns a *field name* to the child node(s) matched by the given rule. In the resulting syntax tree, you can then use that field name to access specific children.
  **Field Names：`field（name，rule）`**-此函数为给定规则匹配的子节点分配*字段名称*。在生成的语法树中，可以使用该字段名访问特定的子级。

In addition to the `name` and `rules` fields, grammars have a few other optional public fields that influence the behavior of the parser.
除了`name`和`rules`字段之外，语法还有其他一些可选的公共字段，它们会影响解析器的行为。

- **`extras`** - an array of tokens that may appear *anywhere* in the language. This is often used for whitespace and comments. The default value of `extras` is to accept whitespace. To control whitespace explicitly, specify `extras: $ => []` in your grammar.
  **`extras`**-一个可以出现在语言中*任何地方*的标记数组。这通常用于空白和注释。`extras`的默认值是接受空白。要显式控制空白，请在语法中指定`extra：$ => []`。
- **`inline`** - an array of rule names that should be automatically *removed* from the grammar by replacing all of their usages with a copy of their definition. This is useful for rules that are used in multiple places but for which you *don’t* want to create syntax tree nodes at runtime.
  **`inline`**-一个规则名称数组，应该通过用其定义的副本替换其所有用法来自动从语法中*删除*。这对于在多个地方使用但您*不*想在运行时为其创建语法树节点的规则很有用。
- **`conflicts`** - an array of arrays of rule names. Each inner array represents a set of rules that’s involved in an *LR(1) conflict* that is *intended to exist* in the grammar. When these conflicts occur at runtime, Tree-sitter will use the GLR algorithm to explore all of the possible interpretations. If *multiple* parses end up succeeding, Tree-sitter will pick the subtree whose corresponding rule has the highest total *dynamic precedence*.
  **`conflicts`**-一个规则名称数组的数组。每个内部数组表示一组规则，这些规则涉及语法中*存在*的*LR（1）冲突*。当这些冲突在运行时发生时，Tree-sitter将使用GLR算法来探索所有可能的解释。如果*多个*解析都成功了，Tree-sitter将选择其相应规则具有最高总*动态优先级*的子树。
- **`externals`** - an array of token names which can be returned by an [*external scanner*](https://tree-sitter.github.io/tree-sitter/creating-parsers#external-scanners). External scanners allow you to write custom C code which runs during the lexing process in order to handle lexical rules (e.g. Python’s indentation tokens) that cannot be described by regular expressions.
  **`externals`**-一个由[*外部扫描器*](https://tree-sitter.github.io/tree-sitter/creating-parsers#external-scanners)返回的标记名数组。外部扫描器允许您编写自定义C代码，在词法分析过程中运行，以处理无法用正则表达式描述的词法规则（例如Python的缩进标记）。
- **`precedences`** - an array of array of strings, where each array of strings defines named precedence levels in descending order. These names can be used in the `prec` functions to define precedence relative only to other names in the array, rather than globally. Can only be used with parse precedence, not lexical precedence.
  **`precedences`**-字符串数组的数组，其中每个字符串数组按降序定义命名的优先级。这些名称可以在`prec`函数中使用，以定义仅相对于数组中其他名称的优先级，而不是全局优先级。只能与分析优先级一起使用，而不能与词法优先级一起使用。
- **`word`** - the name of a token that will match keywords for the purpose of the [keyword extraction](https://tree-sitter.github.io/tree-sitter/creating-parsers#keyword-extraction) optimization.
  **`word`**-将匹配关键字的令牌的名称，用于[关键字提取](https://tree-sitter.github.io/tree-sitter/creating-parsers#keyword-extraction)优化。
- **`supertypes`** an array of hidden rule names which should be considered to be ‘supertypes’ in the generated [*node types* file](https://tree-sitter.github.io/tree-sitter/using-parsers#static-node-types).
  **`supertypes`**隐藏规则名称的数组，在生成的[*节点类型*文件](https://tree-sitter.github.io/tree-sitter/using-parsers#static-node-types)中应将其视为“超类型”。

## [Writing the Grammar 写作语法](https://tree-sitter.github.io/tree-sitter/creating-parsers#writing-the-grammar)

Writing a grammar requires creativity. There are an infinite number of CFGs (context-free grammars) that can be used to describe any given language. In order to produce a good Tree-sitter parser, you need to create a grammar with two important properties:
写语法需要创造力。有无数的CFG（上下文无关语法）可以用来描述任何给定的语言。为了生成一个好的Tree-sitter解析器，你需要创建一个具有两个重要属性的语法：

1. **An intuitive structure** - Tree-sitter’s output is a [concrete syntax tree](https://en.wikipedia.org/wiki/Parse_tree); each node in the tree corresponds directly to a [terminal or non-terminal symbol](https://en.wikipedia.org/wiki/Terminal_and_nonterminal_symbols) in the grammar. So in order to produce an easy-to-analyze tree, there should be a direct correspondence between the symbols in your grammar and the recognizable constructs in the language. This might seem obvious, but it is very different from the way that context-free grammars are often written in contexts like [language specifications](https://en.wikipedia.org/wiki/Programming_language_specification) or [Yacc](https://en.wikipedia.org/wiki/Yacc)/[Bison](https://en.wikipedia.org/wiki/GNU_bison) parsers.
   **一个直观的结构**- Tree-sitter的输出是一个[具体的语法树](https://en.wikipedia.org/wiki/Parse_tree);树中的每个节点直接对应于语法中的一个[终结符或非终结符](https://en.wikipedia.org/wiki/Terminal_and_nonterminal_symbols)。因此，为了生成一个易于分析的树，语法中的符号和语言中可识别的结构之间应该有直接的对应关系。这似乎是显而易见的，但它与[在语言规范](https://en.wikipedia.org/wiki/Programming_language_specification)或[Yacc](https://en.wikipedia.org/wiki/Yacc)/[野牛](https://en.wikipedia.org/wiki/GNU_bison)解析器等上下文中编写上下文无关语法的方式非常不同。
2. **A close adherence to LR(1)** - Tree-sitter is based on the [GLR parsing](https://en.wikipedia.org/wiki/GLR_parser) algorithm. This means that while it can handle any context-free grammar, it works most efficiently with a class of context-free grammars called [LR(1) Grammars](https://en.wikipedia.org/wiki/LR_parser). In this respect, Tree-sitter’s grammars are similar to (but less restrictive than) [Yacc](https://en.wikipedia.org/wiki/Yacc) and [Bison](https://en.wikipedia.org/wiki/GNU_bison)grammars, but *different* from [ANTLR grammars](https://www.antlr.org/), [Parsing Expression Grammars](https://en.wikipedia.org/wiki/Parsing_expression_grammar), or the [ambiguous grammars](https://en.wikipedia.org/wiki/Ambiguous_grammar) commonly used in language specifications.
   **LR（1）**- Tree-sitter是基于[GLR解析](https://en.wikipedia.org/wiki/GLR_parser)算法的。这意味着，虽然它可以处理任何上下文无关文法，但它最有效地处理一类称为[LR（1）文法的](https://en.wikipedia.org/wiki/LR_parser)上下文无关文法。在这方面，Tree-sitter的语法类似于[Yacc](https://en.wikipedia.org/wiki/Yacc)和[野牛](https://en.wikipedia.org/wiki/GNU_bison)语法（但限制较少），但不同于[ANTLR语法](https://www.antlr.org/)、[解析表达式语法](https://en.wikipedia.org/wiki/Parsing_expression_grammar)或语言规范中常用的[二义性语法](https://en.wikipedia.org/wiki/Ambiguous_grammar)

It’s unlikely that you’ll be able to satisfy these two properties just by translating an existing context-free grammar directly into Tree-sitter’s grammar format. There are a few kinds of adjustments that are often required. The following sections will explain these adjustments in more depth.
仅仅通过将现有的上下文无关语法直接转换为Tree-sitter的语法格式，不太可能满足这两个属性。有几种调整是经常需要的。以下部分将更深入地解释这些调整。

### [The First Few Rules 最初的几条规则](https://tree-sitter.github.io/tree-sitter/creating-parsers#the-first-few-rules)

为您试图解析的语言找到正式的规范通常是一个好主意。该规范很可能包含上下文无关语法。当你阅读这个CFG的规则时，你可能会发现一个复杂的循环关系图。在定义语法时，您可能不清楚应该如何浏览此图。

虽然语言有非常不同的结构，但它们的结构通常可以分为类似的组，如*声明*，*定义*，*语句*，*表达式*，*类型*和*模式*。在编写语法时，好的第一步是创建足够的结构来包含所有这些基本的符号*组*。对于像Go这样的语言，你可以这样开始：

```
{
  // ...

  rules: {
    source_file: $ => repeat($._definition),

    _definition: $ => choice(
      $.function_definition
      // TODO: other kinds of definitions
    ),

    function_definition: $ => seq(
      'func',
      $.identifier,
      $.parameter_list,
      $._type,
      $.block
    ),

    parameter_list: $ => seq(
      '(',
       // TODO: parameters
      ')'
    ),

    _type: $ => choice(
      'bool'
      // TODO: other kinds of types
    ),

    block: $ => seq(
      '{',
      repeat($._statement),
      '}'
    ),

    _statement: $ => choice(
      $.return_statement
      // TODO: other kinds of statements
    ),

    return_statement: $ => seq(
      'return',
      $._expression,
      ';'
    ),

    _expression: $ => choice(
      $.identifier,
      $.number
      // TODO: other kinds of expressions
    ),

    identifier: $ => /[a-z]+/,

    number: $ => /\d+/
  }
}
```

Some of the details of this grammar will be explained in more depth later on, but if you focus on the `TODO` comments, you can see that the overall strategy is *breadth-first*. Notably, this initial skeleton does not need to directly match an exact subset of the context-free grammar in the language specification. It just needs to touch on the major groupings of rules in as simple and obvious a way as possible.
稍后将更深入地解释这种语法的一些细节，但是如果您关注`TODO`注释，您可以看到总体策略是*宽度优先*的。值得注意的是，这个初始框架不需要直接匹配语言规范中上下文无关语法的精确子集。它只需要以尽可能简单和明显的方式触及主要的规则分组。

With this structure in place, you can now freely decide what part of the grammar to flesh out next. For example, you might decide to start with *types*. One-by-one, you could define the rules for writing basic types and composing them into more complex types:
有了这个结构，你现在可以自由地决定下一步要充实语法的哪一部分。例如，您可能决定从*类型*开始。一个接一个地，你可以定义写基本类型的规则，并将它们组合成更复杂的类型：

```
{
  // ...

  _type: $ => choice(
    $.primitive_type,
    $.array_type,
    $.pointer_type
  ),

  primitive_type: $ => choice(
    'bool',
    'int'
  ),

  array_type: $ => seq(
    '[',
    ']',
    $._type
  ),

  pointer_type: $ => seq(
    '*',
    $._type
  )
}
```

在进一步开发类型子语言之后，您可能会决定转而处理*语句*或*表达式*。尝试使用`tree-sitter parse`一些真实的代码来检查进度通常很有用。

**并且记得在`test/corpus`文件夹中为每个规则添加测试！**

### 良好地构建规则

假设您刚刚开始使用[Tree-sitter JavaScript解析器](https://github.com/tree-sitter/tree-sitter-javascript)。简单地说，您可能会尝试直接镜像[ECMAScript语言规范](https://262.ecma-international.org/6.0/)的结构。为了说明这种方法的问题，请考虑以下代码行：

```
return x + y;
```

根据规范，这一行是一个`ReturnStatement`，片段`x + y`是一个`AdditiveExpression`，`x`和`y`都是`IdentifierReferences`。这些构造之间的关系由一系列复杂的产生式规则捕获：

```
ReturnStatement          ->  'return' Expression
Expression               ->  AssignmentExpression
AssignmentExpression     ->  ConditionalExpression
ConditionalExpression    ->  LogicalORExpression
LogicalORExpression      ->  LogicalANDExpression
LogicalANDExpression     ->  BitwiseORExpression
BitwiseORExpression      ->  BitwiseXORExpression
BitwiseXORExpression     ->  BitwiseANDExpression
BitwiseANDExpression     ->  EqualityExpression
EqualityExpression       ->  RelationalExpression
RelationalExpression     ->  ShiftExpression
ShiftExpression          ->  AdditiveExpression
AdditiveExpression       ->  MultiplicativeExpression
MultiplicativeExpression ->  ExponentiationExpression
ExponentiationExpression ->  UnaryExpression
UnaryExpression          ->  UpdateExpression
UpdateExpression         ->  LeftHandSideExpression
LeftHandSideExpression   ->  NewExpression
NewExpression            ->  MemberExpression
MemberExpression         ->  PrimaryExpression
PrimaryExpression        ->  IdentifierReference
```

语言规范使用`IdentifierReference`和`Expression`之间的20个间接级别对JavaScript表达式的20个不同优先级进行编码。如果我们根据语言规范创建一个具体的语法树来表示这个语句，它将有20层嵌套，并且它将包含名称为`BitwiseXORExpression的`节点，这些节点与实际代码无关。

### 使用优先

为了生成一个可读的语法树，我们想使用一个更扁平的结构来建模JavaScript表达式，如下所示：

```js
{
  // ...

  _expression: $ => choice(
    $.identifier,
    $.unary_expression,
    $.binary_expression,
    // ...
  ),

  unary_expression: $ => choice(
    seq('-', $._expression),
    seq('!', $._expression),
    // ...
  ),

  binary_expression: $ => choice(
    seq($._expression, '*', $._expression),
    seq($._expression, '+', $._expression),
    // ...
  ),
}
```

当然，这种扁平结构是高度模糊的。如果我们尝试生成一个解析器，Tree-sitter会给我们一个错误消息：

```js
Error: Unresolved conflict for symbol sequence:

  '-'  _expression  •  '*'  …

Possible interpretations:

  1:  '-'  (binary_expression  _expression  •  '*'  _expression)
  2:  (unary_expression  '-'  _expression)  •  '*'  …

Possible resolutions:

  1:  Specify a higher precedence in `binary_expression` than in the other rules.
  2:  Specify a higher precedence in `unary_expression` than in the other rules.
  3:  Specify a left or right associativity in `unary_expression`
  4:  Add a conflict for these rules: `binary_expression` `unary_expression`
```

注意事项：错误消息中的·字符表示解析过程中冲突发生的确切位置，或者换句话说，解析器遇到二义性的位置。

对于像`-a * B`这样的表达式，不清楚`-`运算符是应用于`a * B`还是仅应用于`a`。这就是[上面描述](https://tree-sitter.github.io/tree-sitter/creating-parsers#the-grammar-dsl)的`prec`函数发挥作用的地方。通过使用`prec`包装规则，我们可以表明某些符号序列应该比其他符号序列*更紧密地相互绑定*。例如，'`-'，$._ unary_expression中的表达式`序列``应该比`$._ expression，'+'，$._ binary`_expression中的表达式序列``：

```
{
  // ...

  unary_expression: $ => prec(2, choice(
    seq('-', $._expression),
    seq('!', $._expression),
    // ...
  ))
}
```

###  使用关联性

在`unary_expression`中应用更高的优先级可以修复该冲突，但仍然存在另一个冲突：

```
Error: Unresolved conflict for symbol sequence:

  _expression  '*'  _expression  •  '*'  …

Possible interpretations:

  1:  _expression  '*'  (binary_expression  _expression  •  '*'  _expression)
  2:  (binary_expression  _expression  '*'  _expression)  •  '*'  …

Possible resolutions:

  1:  Specify a left or right associativity in `binary_expression`
  2:  Add a conflict for these rules: `binary_expression`
```

对于像`a * B * c` 这样的表达式，我们不清楚是指`a *（B * c）`还是`（a * B）* c`。这就是使用`prec.left`和`prec.right的`地方。我们想选择第二种解释，所以我们使用`prec.left`。

```
{
  // ...

  binary_expression: $ => choice(
    prec.left(2, seq($._expression, '*', $._expression)),
    prec.left(1, seq($._expression, '+', $._expression)),
    // ...
  ),
}
```

### [Hiding Rules 隐藏规则](https://tree-sitter.github.io/tree-sitter/creating-parsers#hiding-rules)

在上面的例子中，你可能已经注意到一些语法规则名称，如`_expression`和`_type`，是以下划线开头的。规则名称以下划线开头会导致该规则在语法树中*隐藏*。这对于像上面语法中`的_expression`这样的规则很有用，它总是只包装一个子节点。如果这些节点没有被隐藏，它们会给语法树增加大量的深度和噪音，而不会使它更容易理解。

### [Using Fields 使用字段](https://tree-sitter.github.io/tree-sitter/creating-parsers#using-fields)

Often, it’s easier to analyze a syntax node if you can refer to its children by *name* instead of by their position in an ordered list. Tree-sitter grammars support this using the `field`function. This function allows you to assign unique names to some or all of a node’s children:
通常，如果您可以通过*名称而*不是通过它们在有序列表中的位置来引用它的子节点，那么分析语法节点会更容易。树保姆语法使用`field`函数来支持这一点。此函数允许您为节点的部分或全部子节点分配唯一名称：

```
function_definition: $ => seq(
  'func',
  field('name', $.identifier),
  field('parameters', $.parameter_list),
  field('return_type', $._type),
  field('body', $.block)
)
```

Adding fields like this allows you to retrieve nodes using the [field APIs](https://tree-sitter.github.io/tree-sitter/using-parsers#node-field-names).
像这样添加字段允许您使用[字段API](https://tree-sitter.github.io/tree-sitter/using-parsers#node-field-names)检索节点。

## [Lexical Analysis 词法分析](https://tree-sitter.github.io/tree-sitter/creating-parsers#lexical-analysis)

Tree-sitter’s parsing process is divided into two phases: parsing (which is described above) and [lexing](https://en.wikipedia.org/wiki/Lexical_analysis) - the process of grouping individual characters into the language’s fundamental *tokens*. There are a few important things to know about how Tree-sitter’s lexing works.
Tree-Sitter的解析过程分为两个阶段：解析（如上所述）和[词法分析（lexing）](https://en.wikipedia.org/wiki/Lexical_analysis)-将单个字符分组为语言的基本*标记*的过程。有几件重要的事情要知道如何 ts的lexing工程。

### [Conflicting Tokens 加密货币](https://tree-sitter.github.io/tree-sitter/creating-parsers#conflicting-tokens)

Grammars often contain multiple tokens that can match the same characters. For example, a grammar might contain the tokens (`"if"` and `/[a-z]+/`). Tree-sitter differentiates between these conflicting tokens in a few ways.
语法通常包含多个可以匹配相同字符的标记。例如，语法可能包含标记（`“if”`和`/[a-z]+/`）。Tree-sitter通过几种方式区分这些冲突的标记。

1. **Context-aware Lexing** - Tree-sitter performs lexing on-demand, during the parsing process. At any given position in a source document, the lexer only tries to recognize tokens that are *valid* at that position in the document.
   **上下文感知词法分析**- Tree-sitter在解析过程中按需执行词法分析。在源文档中的任何给定位置，lexer只尝试识别在文档中该位置*有效*的标记。
2. **Lexical Precedence** - When the precedence functions described [above](https://tree-sitter.github.io/tree-sitter/creating-parsers#the-grammar-dsl) are used *within* the `token` function, the given explicit precedence values serve as instructions to the lexer. If there are two valid tokens that match the characters at a given position in the document, Tree-sitter will select the one with the higher precedence.
   **词法优先级**-当在`token`函数*中*使用如果有两个有效标记与文档中给定位置的字符匹配，Tree-sitter将选择优先级较高的一个。
3. **Match Length** - If multiple valid tokens with the same precedence match the characters at a given position in a document, Tree-sitter will select the token that matches the [longest sequence of characters](https://en.wikipedia.org/wiki/Maximal_munch).
   **匹配长度**-如果多个具有相同优先级的有效标记匹配文档中给定位置的字符，Tree-sitter将选择匹配[最长字符序列](https://en.wikipedia.org/wiki/Maximal_munch)的标记。
4. **Match Specificity** - If there are two valid tokens with the same precedence and which both match the same number of characters, Tree-sitter will prefer a token that is specified in the grammar as a `String` over a token specified as a `RegExp`.
   **匹配特定性**-如果有两个具有相同优先级的有效标记，并且它们都匹配相同数量的字符，Tree-sitter将优先选择在语法中指定为`String的`标记，而不是指定为`RegExp的`标记。
5. **Rule Order** - If none of the above criteria can be used to select one token over another, Tree-sitter will prefer the token that appears earlier in the grammar.
   **规则顺序**--如果上述条件都不能用来选择一个标记而不是另一个标记，Tree-sitter将优先选择语法中出现在前面的标记。

If there is an external scanner it may have [an additional impact](https://tree-sitter.github.io/tree-sitter/creating-parsers#other-external-scanner-details) over regular tokens defined in the grammar.
如果有外部扫描器，它可能会对语法中定义的常规标记产生[额外的影响](https://tree-sitter.github.io/tree-sitter/creating-parsers#other-external-scanner-details)。

### [Lexical Precedence vs. Parse Precedence 词汇优先级与解析优先级](https://tree-sitter.github.io/tree-sitter/creating-parsers#lexical-precedence-vs-parse-precedence)

One common mistake involves not distinguishing *lexical precedence* from *parse precedence*. Parse precedence determines which rule is chosen to interpret a given sequence of tokens. *Lexical precedence* determines which token is chosen to interpret at a given position of text and it is a lower-level operation that is done first. The above list fully captures Tree-sitter’s lexical precedence rules, and you will probably refer back to this section of the documentation more often than any other. Most of the time when you really get stuck, you’re dealing with a lexical precedence problem. Pay particular attention to the difference in meaning between using `prec` inside of the `token` function versus outside of it. The *lexical precedence* syntax is `token(prec(N, ...))`.
一个常见的错误是没有区分*词法优先*和*解析优先*。解析优先级确定选择哪个规则来解释给定的标记序列。*词法优先级*决定了在文本的给定位置选择哪个标记来解释，它是一个先完成的较低级别的操作。上面的列表完全捕获了Tree-sitter的词汇优先级规则，您可能会比其他任何部分更经常地参考文档的这一部分。大多数情况下，当你真正陷入困境时，你正在处理一个词汇优先级问题。要特别注意在token函数内部和外部使用prec的意义上的区别````。*词法优先级*语法是`token（prec（N，...））`.

### [Keywords 关键词](https://tree-sitter.github.io/tree-sitter/creating-parsers#keywords)

Many languages have a set of *keyword* tokens (e.g. `if`, `for`, `return`), as well as a more general token (e.g. `identifier`) that matches any word, including many of the keyword strings. For example, JavaScript has a keyword `instanceof`, which is used as a binary operator, like this:
许多语言都有一组*关键字*标记（例如`if`，`for`，`return`），以及一个更通用的标记（例如`identifier`），它匹配任何单词，包括许多关键字字符串。例如，JavaScript有一个关键字`instanceof`，它被用作二元运算符，如下所示：

```
if (a instanceof Something) b();
```


但是，以下代码不是有效的JavaScript：

```
if (a instanceofSomething) b();
```


像`instanceof这样`的关键字不能紧跟另一个字母，因为这样它就会被标记为`标识符`，**即使标识符在该位置无效**。由于Tree-sitter使用上下文感知词汇分析，如上所述，因此它通常不会施加此限制。默认情况下，Tree-sitter将把`instanceofSomething`识别为两个单独的标记：`instanceof`关键字后跟一个`标识符`。

### [Keyword Extraction 关键字提取](https://tree-sitter.github.io/tree-sitter/creating-parsers#keyword-extraction)


幸运的是，Tree-sitter有一个功能可以让您解决这个问题，这样您就可以匹配其他标准解析器的行为：`单词`标记。如果你在语法中指定了一个`单词`标记，Tree-sitter将找到与该`单词`标记匹配的字符串相匹配的*关键字*标记集。然后，在词法分析期间，Tree-sitter将通过两步过程匹配关键字，而不是单独匹配这些关键字中的每*一个，首先*匹配`单词`标记。

For example, suppose we added `identifier` as the `word` token in our JavaScript grammar:
例如，假设我们在JavaScript语法中添加`了identifier`作为`wo` token：

```
grammar({
  name: 'javascript',

  word: $ => $.identifier,

  rules: {
    _expression: $ => choice(
      $.identifier,
      $.unary_expression,
      $.binary_expression
      // ...
    ),

    binary_expression: $ => choice(
      prec.left(1, seq($._expression, 'instanceof', $._expression))
      // ...
    ),

    unary_expression: $ => choice(
      prec.left(2, seq('typeof', $._expression))
      // ...
    ),

    identifier: $ => /[a-z_]+/
  }
});
```

Tree-sitter would identify `typeof` and `instanceof` as keywords. Then, when parsing the invalid code above, rather than scanning for the `instanceof` token individually, it would scan for an `identifier` first, and find `instanceofSomething`. It would then correctly recognize the code as invalid.
Tree-sitter将`typeof`和`instanceof`作为关键字。然后，当解析上面的无效代码时，它将首先扫描`标识符`，然后找到`instanceofSomething，而不是单独扫描instanceof令牌`。``然后，它会正确地将代码识别为无效。

Aside from improving error detection, keyword extraction also has performance benefits. It allows Tree-sitter to generate a smaller, simpler lexing function, which means that **the parser will compile much more quickly**.
除了改进错误检测之外，关键字提取还具有性能优势。它允许Tree-sitter生成一个更小、更简单的词法分析函数，这意味**着解析器将编译得更快**。

### [External Scanners 外部扫描器](https://tree-sitter.github.io/tree-sitter/creating-parsers#external-scanners)


许多语言都有一些标记，它们的结构不可能或不方便用正则表达式来描述。以下是一些示例：

- Python中[的Indent和dedent](https://en.wikipedia.org/wiki/Off-side_rule)标记
  
- Bash和Ruby中的[Heredocs](https://en.wikipedia.org/wiki/Here_document)
  
- Ruby中的[字符串百分比](https://docs.ruby-lang.org/en/2.5.0/doc/syntax/literals_rdoc.html#label-Percent+Strings)
  

Tree-sitter允许您使用*外部扫描器*处理这些类型的令牌。外部扫描器是一组C函数，语法作者可以手工编写这些函数，以便添加用于识别某些标记的自定义逻辑。

To use an external scanner, there are a few steps. First, add an `externals` section to your grammar. This section should list the names of all of your external tokens. These names can then be used elsewhere in your grammar.
要使用外部扫描仪，有几个步骤。首先，在语法中添加一个`外部`部分。本节应列出所有外部令牌的名称。这些名称可以在语法中的其他地方使用。

```
grammar({
  name: 'my_language',

  externals: $ => [
    $.indent,
    $.dedent,
    $.newline
  ],

  // ...
});
```

Then, add another C source file to your project. Currently, its path must be `src/scanner.c` for the CLI to recognize it. Be sure to add this file to the `sources` section of your `binding.gyp` file so that it will be included when your project is compiled by Node.js and uncomment the appropriate block in your `bindings/rust/build.rs` file so that it will be included in your Rust crate.
然后，将另一个C源文件添加到项目中。目前，它的路径必须是`src/scanner.c`，CLI才能识别它。请确保将此文件添加到`binding.gyp`文件的`sources`部分，以便在Node.js编译项目时包含它，并取消注释`bindings/rust/build.rs`文件中的相应块，以便它将包含在Rust crate中。

In this new source file, define an [`enum`](https://en.wikipedia.org/wiki/Enumerated_type#C) type containing the names of all of your external tokens. The ordering of this enum must match the order in your grammar’s `externals`array; the actual names do not matter.
在这个新的源文件中，定义一个包含所有外部标记名称[`的枚举`](https://en.wikipedia.org/wiki/Enumerated_type#C)类型。这个枚举的顺序必须与语法的`外部`数组中的顺序相匹配;实际名称无关紧要。

```
#include "tree_sitter/parser.h"
#include "tree_sitter/alloc.h"
#include "tree_sitter/array.h"

enum TokenType {
  INDENT,
  DEDENT,
  NEWLINE
}
```


最后，您必须根据语言名称和五个操作定义五个具有特定名称的函数：*创建*、*销毁*、*序列化*、*重命名*和*扫描*。

#### Create 创建

```
void *tree_sitter_my_language_external_scanner_create(void) {
  // ...
}
```


此函数应创建扫描仪对象。在解析器上设置语言时，它只会被调用一次。通常，你会想在堆上分配内存并返回一个指向它的指针。如果你的外部扫描器不需要维护任何状态，返回`NULL也`是可以的。

#### Destroy 摧毁

```
void tree_sitter_my_language_external_scanner_destroy(void *payload) {
  // ...
}
```


此函数将释放扫描仪使用的所有内存。当一个解析器被删除或者被分配了一种不同的语言时，它被调用一次。它接收从*create*函数返回的指针作为参数。如果你*的create*函数没有分配任何内存，这个函数可以是一个noop。

#### Serialize 序列化

```
unsigned tree_sitter_my_language_external_scanner_serialize(
  void *payload,
  char *buffer
) {
  // ...
}
```


这个函数应该将扫描仪的完整状态复制到给定的字节缓冲区中，并返回写入的字节数。每当外部扫描器成功识别令牌时，都会调用该函数。它接收指向扫描仪的指针和指向缓冲区的指针。可以写入的最大字节数由`TREE_SITTER_SERIALIZATION_BUFFER_SIZE`常量给出，该常量在`tree_sitter/parser. h`头文件中定义。


该函数写入的数据最终将存储在语法树中，以便扫描器在处理编辑或歧义时可以恢复到正确的状态。为了使解析器正常工作，`serialize`函数必须存储其整个状态，而`realize`必须恢复整个状态。为了获得良好的性能，您应该设计扫描程序，使其状态可以尽可能快速和紧凑地序列化。

#### Deserialize

```
void tree_sitter_my_language_external_scanner_deserialize(
  void *payload,
  const char *buffer,
  unsigned length
) {
  // ...
}
```

This function should *restore* the state of your scanner based the bytes that were previously written by the `serialize` function. It is called with a pointer to your scanner, a pointer to the buffer of bytes, and the number of bytes that should be read. It is good practice to explicitly erase your scanner state variables at the start of this function, before restoring their values from the byte buffer.
这个函数应该根据先前由`serialize`函数写入的字节*恢复*扫描器的状态。它是用指向扫描器的指针、指向字节缓冲区的指针以及应该读取的字节数来调用的。在从字节缓冲区恢复扫描仪状态变量的值之前，在此函数开始时明确擦除扫描仪状态变量是一种良好的做法。

#### Scan 扫描

```
bool tree_sitter_my_language_external_scanner_scan(
  void *payload,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  // ...
}
```

This function is responsible for recognizing external tokens. It should return `true` if a token was recognized, and `false` otherwise. It is called with a “lexer” struct with the following fields:
此函数负责识别外部令牌。如果标识被识别，则返回`true`，否则返回`false`。它是用一个“lexer”结构体调用的，该结构体包含以下字段：

- **`int32_t lookahead`** - The current next character in the input stream, represented as a 32-bit unicode code point.
  **`int32_t lookahead`**-输入流中的当前下一个字符，表示为32位unicode代码点。
- **`TSSymbol result_symbol`** - The symbol that was recognized. Your scan function should *assign* to this field one of the values from the `TokenType` enum, described above.
  **`TSSymbol result_symbol`**-已识别的符号。您的扫描函数应该为该字段*分配*来自`TokenType`枚举的值之一，如上所述。
- **`void (\*advance)(TSLexer \*, bool skip)`** - A function for advancing to the next character. If you pass `true` for the second argument, the current character will be treated as whitespace; whitespace won’t be included in the text range associated with tokens emitted by the external scanner.
  **`void（\*advance）（TSLexer \*，bool skip）`**-用于前进到下一个字符的函数。如果为第二个参数传递`true`，则当前字符将被视为空白字符;空白字符不会包含在与外部扫描程序发出的标记相关联的文本范围中。
- **`void (\*mark_end)(TSLexer \*)`** - A function for marking the end of the recognized token. This allows matching tokens that require multiple characters of lookahead. By default (if you don’t call `mark_end`), any character that you moved past using the `advance` function will be included in the size of the token. But once you call `mark_end`, then any later calls to `advance` will *not* increase the size of the returned token. You can call `mark_end` multiple times to increase the size of the token.
  **`void（\*mark_end）（TSLexer \*）`**-用于标记已识别令牌的结束的函数。这允许匹配需要多个先行字符的标记。默认情况下（如果不调用`mark_end`），使用`advance`函数移动过去的任何字符都将包含在标记的大小中。但一旦您调用`mark_end`，那么任何后续的`advance`调用都*不会*增加返回令牌的大小。您可以多次调用`mark_end`来增加令牌的大小。
- **`uint32_t (\*get_column)(TSLexer \*)`** - A function for querying the current column position of the lexer. It returns the number of codepoints since the start of the current line. The codepoint position is recalculated on every call to this function by reading from the start of the line.
  **`uint32_t（\*get_column）（TSLexer \*）`**-用于查询词法分析器的当前列位置的函数。它返回自当前行开始以来的代码点数。每次调用此函数时，通过从行首开始阅读，重新计算代码点位置。
- **`bool (\*is_at_included_range_start)(const TSLexer \*)`** - A function for checking whether the parser has just skipped some characters in the document. When parsing an embedded document using the `ts_parser_set_included_ranges` function (described in the [multi-language document section](https://tree-sitter.github.io/tree-sitter/using-parsers#multi-language-documents)), the scanner may want to apply some special behavior when moving to a disjoint part of the document. For example, in [EJS documents](https://ejs.co/), the JavaScript parser uses this function to enable inserting automatic semicolon tokens in between the code directives, delimited by `<%` and `%>`.
  **`bool（\*is_at_included_range_start）（const TSLexer \*）`**-用于检查解析器是否跳过了文档中的某些字符的函数。使用`ts_parser_set_included_ranges`函数（在[多语言文档部分](https://tree-sitter.github.io/tree-sitter/using-parsers#multi-language-documents)中进行了说明）解析嵌入文档时，扫描仪可能希望在移动到文档的不相交部分时应用某些特殊行为。例如，在[EJS文档](https://ejs.co/)中，JavaScript解析器使用此函数在代码指令之间插入自动启用标记，由`%3 C %`和`%%3 E`分隔。
- **`bool (\*eof)(const TSLexer \*)`** - A function for determining whether the lexer is at the end of the file. The value of `lookahead` will be `0` at the end of a file, but this function should be used instead of checking for that value because the `0` or “NUL” value is also a valid character that could be present in the file being parsed.
  **`bool（\*eof）（const TSLexer \*）`**-用于确定lexer是否位于文件末尾的函数。`lookahead`的值在文件的结尾处为`0`，但应该使用此函数而不是检查该值，因为`0`或“NUL”值也是可能存在于正在解析的文件中的有效字符。
- **`void (\*log)(const TSLexer \*, const char \* format, ...)`** - A `printf`-like function for logging. The log is viewable through e.g. `tree-sitter parse --debug` or the browser’s console after checking the `log` option in the [Playground](https://tree-sitter.github.io/tree-sitter/playground).
  **`void（\*log）（const TSLexer \*，const char \* format，.）`**- 一个类似`printf`的日志记录函数。日志可以通过`tree-sitter parse --debug`或浏览器的控制台查看，检查[Playground](https://tree-sitter.github.io/tree-sitter/playground)中的`log`选项后。

The third argument to the `scan` function is an array of booleans that indicates which of external tokens are currently expected by the parser. You should only look for a given token if it is valid according to this array. At the same time, you cannot backtrack, so you may need to combine certain pieces of logic.
`scan`函数的第三个参数是一个布尔数组，它指示解析器当前需要哪些外部标记。您应该只查找根据此数组有效的给定令牌。同时，您无法回溯，因此可能需要将某些逻辑片段联合收割机组合起来。

```
if (valid_symbols[INDENT] || valid_symbols[DEDENT]) {

  // ... logic that is common to both `INDENT` and `DEDENT`

  if (valid_symbols[INDENT]) {

    // ... logic that is specific to `INDENT`

    lexer->result_symbol = INDENT;
    return true;
  }
}
```

#### External Scanner Helpers 外部扫描仪助手

##### Allocator 分配器

不应该使用libc的`malloc`、`calloc`、`realloc`和`free`，而应该使用前缀为`ts_`from`tree_sitter/alloc.h`的版本。这些宏允许潜在的使用者用自己的实现覆盖默认分配器，但默认情况下将使用libc函数。

作为tree-sitter核心库以及任何可能使用分配的解析器库的消费者，您可以启用重写默认分配器，并让它使用与库分配器相同的分配器，您可以使用`ts_set_allocator`设置库分配器。要在扫描器中启用此重写，您必须使用定义的`TREE_SITTER_REUSE_ALLOCATOR`宏编译它们，并且必须将库动态链接到最终应用程序中，因为它需要在运行时解析内部函数。如果你正在编译一个使用核心库的可执行二进制文件，但是想在运行时动态加载解析器，那么你必须在Unix上使用一个特殊的链接器标志。对于非达尔文系统，这将是`--dynamic-list`，而对于达尔文系统，这将是`-exports_symbols_list`。CLI正是这样做的，所以你可以把它作为参考（查看`WEB/build.rs`）。

例如，假设你想为你的扫描仪分配100个字节，你会像下面的例子一样这样做：

```
#include "tree_sitter/parser.h"
#include "tree_sitter/alloc.h"

// ...

void *tree_sitter_my_language_external_scanner_create(void) {
  return ts_calloc(100, 1); // or ts_malloc(100)
}

// ...
```

##### Arrays 阵列

If you need to use array-like types in your scanner, such as tracking a stack of indentations or tags, you should use the array macros from `tree_sitter/array.h`.
如果您需要在扫描仪中使用类似数组的类型，例如跟踪一堆缩进或标签，则应使用`tree_sitter/array.h`中的数组宏。

There are quite a few of them provided for you, but here’s how you could get started tracking some . Check out the header itself for more detailed documentation.
有相当多的他们为您提供，但这里是如何你可以开始跟踪一些。查看标题本身以获得更详细的文档。

**NOTE**: Do not use any of the array functions or macros that are prefixed with an underscore and have comments saying that it is not what you are looking for. These are internal functions used as helpers by other macros that are public. They are not meant to be used directly, nor are they what you want.
**注意**：不要使用任何以下划线为前缀的数组函数或宏，并且不要使用注释说它不是您正在寻找的。这些是内部函数，被其他公共宏用作帮助器。它们并不意味着直接使用，也不是你想要的。

```c
#include "tree_sitter/parser.h"
#include "tree_sitter/array.h"

enum TokenType {
  INDENT,
  DEDENT,
  NEWLINE,
  STRING,
}

// Create the array in your create function

void *tree_sitter_my_language_external_scanner_create(void) {
  return ts_calloc(1, sizeof(Array(int)));

  // or if you want to zero out the memory yourself

  Array(int) *stack = ts_malloc(sizeof(Array(int)));
  array_init(&stack);
  return stack;
}

bool tree_sitter_my_language_external_scanner_scan(
  void *payload,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  Array(int) *stack = payload;
  if (valid_symbols[INDENT]) {
    array_push(stack, lexer->get_column(lexer));
    lexer->result_symbol = INDENT;
    return true;
  }
  if (valid_symbols[DEDENT]) {
    array_pop(stack); // this returns the popped element by value, but we don't need it
    lexer->result_symbol = DEDENT;
    return true;
  }

  // we can also use an array on the stack to keep track of a string

  Array(char) next_string = array_new();

  if (valid_symbols[STRING] && lexer->lookahead == '"') {
    lexer->advance(lexer, false);
    while (lexer->lookahead != '"' && lexer->lookahead != '\n' && !lexer->eof(lexer)) {
      array_push(&next_string, lexer->lookahead);
      lexer->advance(lexer, false);
    }

    // assume we have some arbitrary constraint of not having more than 100 characters in a string
    if (lexer->lookahead == '"' && next_string.size <= 100) {
      lexer->advance(lexer, false);
      lexer->result_symbol = STRING;
      return true;
    }
  }

  return false;
}
```

#### Other External Scanner Details 其他外部扫描仪详细信息


如果`externals`数组中的标记在解析中的给定位置有效，则在执行任何其他操作之前，将首先调用外部扫描程序。这意味着外部扫描器可以作为Tree-sitter的词法分析行为的强大覆盖，并可用于解决普通词法、解析或动态优先级无法解决的问题。


如果在常规解析过程中遇到语法错误，Tree-sitter在错误恢复过程中的第一个动作将是调用外部扫描程序的`扫描`函数，并将所有标记标记为有效。扫描仪应检测到这种情况并进行适当处理。一种简单的检测方法是将一个未使用的令牌添加到`externals`数组的末尾，例如`externals：$ => [$.token1，$.token2，$.error_sentinel]`，然后检查该令牌是否标记为有效，以确定Tree-sitter是否处于纠错模式。


如果您将终端关键字放在`外部`数组中，例如`externals：$ => 'if'，'then'，'else']`，那么无论何时这些终端出现在语法中，它们都将被外部扫描程序标记化。这类似于编写`外部变量：[$.if_keyword，$.then_keyword，$.else_keyword]`然后在语法中使用`别名（$.if_keyword，'if'）`。


如果在`externals`数组中使用文字关键字，那么词法分析分为两步进行，首先调用外部扫描器，如果它设置了一个结果标记并返回`true`，那么该标记被认为是已识别的，Tree-sitter移动到下一个标记。但是外部扫描器可能返回`false`，在这种情况下，Tree-sitter回退到内部词法分析机制。

如果在`externals`中以规则引用形式（如`$.if_keyword`）定义了一些关键字，并且在语法规则中没有该规则的附加定义，例如，`if_keyword：$ => 'if'`然后回退到内部词法分析器是不可能的，因为Tree-sitter不知道实际的关键字，并且它完全是外部扫描器负责识别这样的标记。

外部扫描器是无限循环的常见原因。从外部扫描器发出零宽度标记时要非常小心，如果在循环中使用字符，请确保使用`eof`函数检查您是否处于文件的末尾。




# Move 解析器代码

<details>

<summary>语法代码</summary>

```js
module.exports = grammar({
  name: "move",

  // extras: ($) => [$.comment, /\s/],

  // conflicts: ($) => [[$._definition, $.function_definition], [$.module_path]],

  rules: {
    source_file: ($) => $.module_definition,

    module_definition: ($) =>
      seq(
        "module",
        $.module_address,
        $.identifier,
        "{",
        repeat($._definition),
        "}"
      ),

    module_address: ($) => seq($.identifier, "::"),

    _definition: ($) =>
      choice(
        $.use_declaration,
        $.function_definition,
        $.struct_definition,
        $.const_definition,
        $.spec_block
      ),

    use_declaration: ($) =>
      seq(
        // use aptos::aptos_framework::token;
        // use aptos::aptos_framework::token::{Token, TokenData};
        "use",
        $.module_path,
        optional(
          seq(
            "::",
            choice($.identifier, seq("{", commaSep1($.identifier), "}"))
          )
        ),
        ";"
      ),

    module_path: ($) => prec.right(sep1($.identifier, "::")),

    function_definition: ($) =>
      seq(
        repeat($.attribute),
        optional("public"),
        "fun",
        $.identifier,
        "(",
        optional($.parameter_list),
        ")",
        optional(seq("->", $.type)),
        choice($.block, ";")
      ),

    struct_definition: ($) =>
      seq(
        repeat($.attribute),
        optional("public"),
        "struct",
        $.identifier,
        optional($.generic_type_params),
        choice(seq("{", commaSep($.struct_field), "}"), ";")
      ),

    generic_type_params: ($) => seq("<", commaSep1($.type_param), ">"),

    type_param: ($) => seq($.identifier, optional(seq(":", $.type_constraint))),

    type_constraint: ($) => choice("copyable", "resource", $.type),

    struct_field: ($) => seq($.identifier, ":", $.type),

    const_definition: ($) =>
      seq(
        repeat($.attribute),
        "const",
        $.identifier,
        ":",
        $.type,
        "=",
        $.expression,
        ";"
      ),

    spec_block: ($) =>
      seq("spec", $.identifier, "{", repeat($._spec_block_member), "}"),

    _spec_block_member: ($) =>
      choice($.pragma, $.condition, $.invariant, $.apply, $.let_declaration),

    pragma: ($) => seq("pragma", $.identifier, "=", $.expression, ";"),

    condition: ($) =>
      seq(choice("pre", "post", "aborts_if", "succeeds_if"), $.expression, ";"),

    invariant: ($) => seq("invariant", $.expression, ";"),

    apply: ($) =>
      seq("apply", $.identifier, "to", commaSep1($.identifier), ";"),

    let_declaration: ($) => seq("let", $.identifier, "=", $.expression, ";"),

    attribute: ($) =>
      seq(
        "#[",
        $.identifier,
        optional(seq("(", commaSep1($.expression), ")")),
        "]"
      ),

    parameter_list: ($) => commaSep1($.parameter),

    parameter: ($) => seq($.identifier, ":", $.type),

    block: ($) => seq("{", repeat($._statement), "}"),

    _statement: ($) =>
      choice(
        $.let_statement,
        $.assignment_statement,
        $.expression_statement,
        $.return_statement,
        $.if_statement,
        $.while_statement,
        $.loop_statement,
        $.break_statement,
        $.continue_statement
      ),

    let_statement: ($) =>
      seq(
        "let",
        $.identifier,
        optional(seq(":", $.type)),
        "=",
        $.expression,
        ";"
      ),

    assignment_statement: ($) => seq($.expression, "=", $.expression, ";"),

    expression_statement: ($) => seq($.expression, ";"),

    return_statement: ($) => seq("return", optional($.expression), ";"),

    if_statement: ($) =>
      seq(
        "if",
        "(",
        $.expression,
        ")",
        $.block,
        optional(seq("else", choice($.block, $.if_statement)))
      ),

    while_statement: ($) => seq("while", "(", $.expression, ")", $.block),

    loop_statement: ($) => seq("loop", $.block),

    break_statement: ($) => seq("break", ";"),

    continue_statement: ($) => seq("continue", ";"),

    expression: ($) =>
      choice(
        $.function_call,
        $.string_literal,
        $.number_literal,
        $.boolean_literal,
        $.identifier,
        $.reference_expression,
        $.dereference_expression,
        $.binary_expression,
        $.unary_expression,
        $.parenthesized_expression,
        $.move_expression,
        $.copy_expression,
        $.vector_literal
      ),

    function_call: ($) =>
      seq($.module_access, "(", optional(commaSep1($.expression)), ")"),

    module_access: ($) => sep1($.identifier, "::"),

    reference_expression: ($) => seq("&", optional("mut"), $.expression),

    dereference_expression: ($) => seq("*", $.expression),

    binary_expression: ($) =>
      prec.left(
        1,
        seq(
          $.expression,
          choice(
            "+",
            "-",
            "*",
            "/",
            "%",
            "==",
            "!=",
            "<",
            ">",
            "<=",
            ">=",
            "&&",
            "||"
          ),
          $.expression
        )
      ),

    unary_expression: ($) => prec(2, seq(choice("!", "-"), $.expression)),

    parenthesized_expression: ($) => seq("(", $.expression, ")"),

    move_expression: ($) => seq("move", $.expression),

    copy_expression: ($) => seq("copy", $.expression),

    vector_literal: ($) => seq("vector", "[", commaSep($.expression), "]"),

    type: ($) => choice($.identifier, $.generic_type, "&", seq("&", "mut")),

    generic_type: ($) => seq($.identifier, "<", commaSep1($.type), ">"),

    string_literal: ($) =>
      seq(
        'b"',
        /[^"]*/, // This is a simplification. You might want to handle escapes.
        '"'
      ),

    number_literal: ($) => /\d+/,

    boolean_literal: ($) => choice("true", "false"),

    identifier: ($) => /[a-zA-Z_][a-zA-Z0-9_]*/,

    comment: ($) =>
      token(
        choice(seq("//", /.*/), seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/"))
      ),
  },
});

function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}

function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

function commaSep(rule) {
  return optional(commaSep1(rule));
}
```

</details>
