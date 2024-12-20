; 基本标识符
(identifier) @variable

; 基本关键字
[
  "public"
  "fun"
  "struct"
  "module"

  "use"
  "let"
  "if"
  "else"
  "loop"
  "while"
  "break"
  "continue"
  "return"
] @keyword

; 函数相关
(function_definition
  (identifier) @function)

(comment) @comment

; 字面量
(number_literal) @number

; 括号和分隔符
[ "(" ")" "[" "]" "{" "}" ] @punctuation.bracket
[ ";" "," ] @punctuation.delimiter

; 运算符
[
  "="
  "+"
  "-"
  "*"
  "/"
  "=="
  "!="
  "<"
  ">"
  "<="
  ">="
] @operator