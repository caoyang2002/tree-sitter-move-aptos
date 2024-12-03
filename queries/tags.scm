; Function definitions
(
  (comment)* @doc
  .
  (function_definition
    name: (identifier) @name) @definition.function
  (#strip! @doc "^//\\s*")
  (#select-adjacent! @doc @definition.function)
)

; Module definitions
(
  (comment)* @doc
  .
  (module_definition
    name: [
      (module_identifier) @name
      (address_identifier
        name: (_) @name)
    ]) @definition.module
  (#strip! @doc "^//\\s*")
  (#select-adjacent! @doc @definition.module)
)

; Struct definitions
(
  (comment)* @doc
  .
  (struct_definition
    name: (identifier) @name) @definition.struct
  (#strip! @doc "^//\\s*")
  (#select-adjacent! @doc @definition.struct)
)

; Function calls
(call
  function: (identifier) @name) @reference.call

; Type definitions/references
(type_annotation
  type: (identifier) @name) @reference.type

; Module uses and imports
(use_declaration
  module: [
    (module_identifier) @name
    (address_identifier
      name: (_) @name)
  ]) @reference.module

; Struct instantiations
(struct_instantiation
  type: (identifier) @name) @reference.struct

; Address definitions
(address_definition
  name: (identifier) @name) @definition.address
