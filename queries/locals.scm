((function_definition) @local.scope
 (#set! local.scope-inherits false))

[
  (block)
  (code_block)
  (if_expression)
  (while_expression)
  (loop_expression)
] @local.scope

; Function parameters
(parameter (identifier) @local.definition)
(function_parameter (identifier) @local.definition)

; Variable declarations
(let_declaration
  name: (identifier) @local.definition)

; References to local variables
(identifier) @local.reference

; Variable assignments
(assignment
  left: (identifier) @local.definition)

; Pattern bindings in let statements
(pattern_binding
  name: (identifier) @local.definition)

; Struct fields in declarations
(field_declaration
  name: (identifier) @local.definition)

; Loop and block bindings
(loop_binding
  name: (identifier) @local.definition)

(block_binding
  name: (identifier) @local.definition)
