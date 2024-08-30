module.exports = grammar({
  name: "move",

  extras: ($) => [$.comment, /\s/],

  conflicts: ($) => [[$._definition, $.function_definition], [$.module_path]],

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
