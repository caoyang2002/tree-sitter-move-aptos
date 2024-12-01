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
module.exports = grammar({
  name: "move", // Move 语言语法定义

  // 定义额外的语法元素（注释和空白字符）
  // extras: ($) => [$.comment, /\s/],

  // 定义语法冲突规则
  // conflicts: ($) => [[$._definition, $.function_definition], [$.module_path]],

  rules: {
    // 源文件由一个模块定义组成
    source_file: ($) => $.module_definition,

    // 模块定义 module <address>::<anme> { <definitions> }
    module_definition: ($) =>
      seq(
        "module",
        $.module_address,
        $.identifier,
        "{",
        // 可包含多个定义
        repeat($._definition),
        "}"
      ),

    // 模块地址 <identifier>::
    module_address: ($) => seq($.identifier, "::"),

    // 模块内可包含的定义类型
    _definition: ($) =>
      choice(
        $.use_declaration, // use 声明
        $.function_definition, // 函数定义
        $.struct_definition, // 结构体定义
        $.const_definition, // 常量定义
        $.spec_block // 规范块
      ),

    // use 声明语法
    // use aptos::aptos_framework::token;
    // use aptos::aptos_framework::token::{Token, TokenData};
    use_declaration: ($) =>
      seq(
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

    // 模块路径 a::b::c
    module_path: ($) => prec.right(sep1($.identifier, "::")),

    //  函数定义
    function_definition: ($) =>
      seq(
        repeat($.attribute), // 属性标注
        optional("public"), // 可见性
        "fun",
        $.identifier, // 函数名
        "(",
        optional($.parameter_list), // 参数列表
        ")",
        optional(seq("->", $.type)), // 返回类型
        choice($.block, ";") // 函数体或空函数
      ),

    // 结构体开一
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

    // 类型
    type_param: ($) => seq($.identifier, optional(seq(":", $.type_constraint))),

    type_constraint: ($) => choice("copyable", "resource", $.type),

    // 结构体字段
    struct_field: ($) => seq($.identifier, ":", $.type),

    // 常量定义
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

// 用分隔符分割的一个或多个规则
function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}

// 用逗号分隔的一个或多个规则
function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

// 用逗号分隔的零个或多个规则
function commaSep(rule) {
  return optional(commaSep1(rule));
}
