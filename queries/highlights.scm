(identifier) @variable
((identifier) @function
 (#is-not? local))

[
  "abort"
  "acquires"
  "as"
  "break"
  "const"
  "continue"
  "copy"
  "else"
  "false"
  "fun"
  "if"
  "let"
  "loop"
  "module"
  "move"
  "native"
  "public"
  "return"
  "script"
  "spec"
  "struct"
  "true"
  "use"
  "while"
] @keyword

((identifier) @keyword
 (#match? @keyword "^(public|entry)$"))

(constant) @constructor

; Function calls
(call
  function: [(identifier) (constant)] @function)

; Function definitions
(function_definition
  name: [(identifier) (constant)] @function)

; Identifiers
[
  (address)
  (module_identifier)
] @namespace

((constant) @constant
 (#match? @constant "^[A-Z][A-Z\\d_]*$"))

[
  (self)
] @variable.builtin

(parameter (identifier) @variable.parameter)
(function_parameter (identifier) @variable.parameter)

; Types
(type_annotation
  type: (identifier) @type)
(struct_definition
  name: (identifier) @type)

; Literals
[
  (string_literal)
  (byte_string_literal)
] @string

[
  (address_literal)
  (number_literal)
] @number

[
  (true)
  (false)
] @constant.builtin

(comment) @comment

; Operators
[
  "="
  "=="
  "!="
  "<"
  "<="
  ">"
  ">="
  "+"
  "-"
  "*"
  "/"
  "&"
  "|"
  "^"
  "!"
  "::"
] @operator

[
  ","
  ";"
  "."
] @punctuation.delimiter

[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket
