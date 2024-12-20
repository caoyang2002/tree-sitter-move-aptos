//运算符优先级

const PRECEDENCE = {
  // 赋值运算符 (优先级 1) - 更新左侧值
  assign: 1,    // = 
  add_assign: 1,    // += (执行加法并赋值)
  sub_assign: 1,    // -= (执行减法并赋值)  
  mul_assign: 1,    // *= (执行乘法并赋值)
  div_assign: 1,    // /= (执行截断除法并赋值)
  mod_assign: 1,    // %= (执行取模运算并赋值)
  band_assign: 1,   // &= (执行按位与并赋值)
  bor_assign: 1,    // |= (执行按位或并赋值)
  xor_assign: 1,    // ^= (执行按位异或并赋值)
  shl_assign: 1,    // <<= (执行左移位并赋值)
  shr_assign: 1,    // >>= (执行右移位并赋值)

  // implies: 2,       // ==> (蕴含)
  or: 2,           // || (逻辑或)
  and: 3,          // && (逻辑与)

  // 比较运算符 (优先级 5)
  eq: 4,           // == (等于)
  neq: 4,          // != (不等于)
  lt: 4,           // < (小于)
  gt: 4,           // > (大于)
  le: 4,           // <= (小于等于)
  ge: 4,           // >= (大于等于)

  // range: 6,        // .. (范围)

  // 位运算符
  bitor: 5,        // | (按位或 - 对每一位执行布尔或运算)
  xor: 6,          // ^ (按位异或 - 对每一位执行布尔异或运算)
  bitand: 7,       // & (按位与 - 对每一位执行布尔与运算)

  // 移位运算符 (优先级 10)
  shl: 8,         // << (左移 - 移位数大于整数类型大小时报错)
  shr: 8,         // >> (右移 - 移位数大于整数类型大小时报错)

  // 算术运算符
  add: 9,         // + (加法 - 结果超出整数类型范围时报错)
  sub: 9,         // - (减法 - 结果小于零时报错)
  mul: 10,         // * (乘法 - 结果超出整数类型范围时报错)
  div: 10,         // / (截断除法 - 除数为0时报错)
  mod: 10,         // % (取模运算 - 除数为0时报错)

  // 最高优先级运算符
  unary: 11,       // 一元运算符
  field: 12,       // 字段访问
  call: 13,        // 函数调用
  apply_type: 13,  // 类型应用
  as: 14          // 类型转换
}

module.exports = grammar({
  name: 'move', // 语言名称
  // 额外规则
  extras: $ => [$._whitespace, $.line_comment, $.block_comment, $.newline, $.annotation],
  // 标识符 
  word: $ => $.identifier,
  // 类型
  supertypes: $ => [$._spec_block_target],
  // 冲突定义 
  conflicts: $ => [
    [$.annotation_expr, $.module_access],
    [$._expression, $._expression_term],
    [$.function_type_parameters],
    [$.module_access, $._variable_identifier],
    [$.module_access, $._module_identifier],
    [$.modifier, $.native_struct_definition],
    [$.bind_list, $.or_bind_list],
    [$.comma_bind_list, $.or_bind_list],
    [$.break_expression, $.block_identifier],
    [$.or_bind_list],
    [$.mut_bind_var, $._bind],
    [$.module_access],
    [$.break_expression],
    [$.abort_expression],
  ],
  // 规则定义
  rules: {
    // 源文件
    source_file: $ => choice(
      $.module_definition,
      $.script_definition
    ),
    // source_file: $ => repeat($.script_definition),

    // 声明 
    use_declaration: $ => seq(
      optional('public'),
      'use', choice($.use_fun, $.use_module, $.use_module_member, $.use_module_members), ';'),

    use_fun: $ => seq(
      'fun',
      $.module_access,
      'as',
      field('alias', seq($.module_access, '.', $._function_identifier))
    ),
    use_module: $ => seq($.module_identity, optional(seq('as', field('alias', $._module_identifier)))),
    use_module_member: $ => seq($.module_identity, '::', field('use_member', $.use_member)),
    use_module_members: $ => choice(
      seq(field('address', choice($.num_literal, $._module_identifier)), '::', '{', sepBy1(',', field('use_member', $.use_member)), '}'),
      seq($.module_identity, '::', '{', sepBy1(',', field('use_member', $.use_member)), '}'),
    ),
    // 语法：
    // std::{Vec, HashMap, String}
    // std::Vec 或 std::Vec as Vector
    use_member: $ => choice(
      seq(
        field('module', $.identifier),
        '::',
        '{',
        sepBy1(',', field('use_member', $.use_member)),
        '}'
      ),
      seq(field('module', $.identifier), '::', field('member', $.identifier), optional(seq('as', field('alias', $.identifier)))),
      seq(
        field('member', $.identifier),
        optional(seq('as', field('alias', $.identifier)))
      ),
    ),

    // parse top-level decl modifiers
    friend_declaration: $ => seq('friend', field('module', $.friend_access), ';'),
    modifier: $ => choice(
      seq(
        'public',
        optional(seq(
          '(',
          choice(
            'package',
            'friend',
          ),
          ')',
        ))),
      'entry',
      'native',
    ),
    ability: $ => choice(
      'copy',
      'drop',
      'store',
      'key',
    ),

    // 脚本定义
    script_definition: $ => {
      return seq('script', field('script_body', $.script_body),);
    },

    script_body: $ => {
      return seq(
        choice(';', '{'),
        repeat(
          choice(
            $.use_declaration,
            $.friend_declaration,
            $.constant,
            $._function_item,
            $._struct_item,
            $._enum_item,
            $.spec_block,
          )),
        optional('}'),
      );
    },


    // 模块定义
    module_definition: $ => {
      return seq(
        'module',
        field('module_identity', $.module_identity),
        field('module_body', $.module_body),
      );
    },

    module_body: $ => {
      return seq(
        choice(';', '{'),
        repeat(
          choice(
            $.use_declaration,
            $.friend_declaration,
            $.constant,
            $._function_item,
            $._struct_item,
            $._enum_item,
            $.spec_block,
          )),
        optional('}'),
      );
    },

    // Annotations
    annotation: $ => seq(
      "#[",
      sepBy1(",", $.annotation_item),
      "]"
    ),

    annotation_expr: $ => choice(
      field("name", $.identifier),
      seq(
        field("name", $.identifier), "=", field("value", choice(field("local_const", seq('::', $.module_access)), $.module_access, $._literal_value))
      ),
    ),

    annotation_list: $ => seq(
      field("name", $.identifier),
      "(",
      sepBy1(",", choice($._literal_value, $.annotation_item, $.module_access, field("local_const", seq('::', $.module_access)))),
      ")"
    ),

    annotation_item: $ => choice(
      field("annotation_expr", $.annotation_expr),
      field("annotation_list", $.annotation_list),
    ),

    // Constants
    constant: $ => seq(
      'const',
      field('name', alias($.identifier, $.constant_identifier)),
      ':',
      field('type', $._type),
      '=', field('expr', $._expression),
      ";"
    ),

    // Common parsers for datatype fields

    datatype_fields: $ => choice(
      $.positional_fields,
      $.named_fields,
    ),
    positional_fields: $ => seq(
      '(',
      sepBy(',', $._type),
      ')'
    ),
    named_fields: $ => seq(
      '{',
      sepBy(',', $.field_annotation),
      '}'
    ),

    // Enum definitions
    _enum_item: $ => choice(
      $.enum_definition,
    ),
    enum_definition: $ => seq(
      optional('public'),
      $._enum_signature,
      field('enum_variants', $.enum_variants),
      optional(field('postfix_ability_declarations', $.postfix_ability_decls)),
    ),
    _enum_signature: $ => seq(
      'enum',
      field('name', $._enum_identifier),
      optional(field('type_parameters', $.type_parameters)),
      optional(field('ability_declarations', $.ability_decls)),
    ),
    enum_variants: $ => seq(
      '{',
      sepBy(',', $.variant),
      '}'
    ),
    variant: $ => seq(
      field('variant_name', $._variant_identifier),
      optional(field('fields', $.datatype_fields)),
    ),

    // Struct definitions
    _struct_item: $ => choice(
      $.native_struct_definition,
      $.struct_definition,
    ),
    native_struct_definition: $ => seq(
      optional('public'),
      'native',
      $._struct_signature,
      ';',
    ),
    struct_definition: $ => seq(
      optional('public'),
      $._struct_signature,
      field('struct_fields', $.datatype_fields),
      optional(field('postfix_ability_declarations', $.postfix_ability_decls)),
    ),
    field_annotation: $ => seq(
      field('field', $._field_identifier),
      ':',
      field('type', $._type),
    ),
    ability_decls: $ => seq(
      'has',
      sepBy(',', $.ability),
    ),
    postfix_ability_decls: $ => seq(
      'has',
      sepBy(',', $.ability),
      ';',
    ),

    _struct_signature: $ => seq(
      'struct',
      field('name', $._struct_identifier),
      optional(field('type_parameters', $.type_parameters)),
      optional(field('ability_declarations', $.ability_decls)),
    ),

    // Function definitions
    _function_item: $ => choice(
      $.native_function_definition,
      $.macro_function_definition,
      $.function_definition,
    ),
    native_function_definition: $ => seq(
      $._function_signature,
      ';'
    ),
    macro_function_definition: $ => seq(
      optional($.modifier),
      'macro',
      $._macro_signature,
      field('body', $.block)
    ),
    _macro_signature: $ => seq(
      optional($.modifier),
      'fun',
      field('name', $._function_identifier),
      optional(field('type_parameters', $.type_parameters)),
      field('parameters', $.function_parameters),
      optional(field('return_type', $.ret_type)),
    ),
    function_definition: $ => seq(
      $._function_signature,
      field('body', $.block)
    ),
    _function_signature: $ => seq(
      optional($.modifier),
      optional($.modifier),
      optional($.modifier),
      'fun',
      field('name', $._function_identifier),
      optional(field('type_parameters', $.type_parameters)),
      field('parameters', $.function_parameters),
      optional(field('return_type', $.ret_type)),
    ),
    function_parameters: $ => seq(
      '(',
      sepBy(',', choice($.mut_function_parameter, $.function_parameter)),
      ')',
    ),

    // Spec block start
    spec_block: $ => seq(
      'spec',
      choice(
        seq(optional(field('target', $._spec_block_target)), field('body', $.spec_body)),
        $._spec_function,
      )
    ),
    _spec_block_target: $ => choice(
      $.identifier,
      alias('module', $.spec_block_target_module),
      $.spec_block_target_schema,
    ),
    spec_block_target_fun: $ => seq('fun', $._function_identifier),
    spec_block_target_struct: $ => seq('struct', $._struct_identifier),
    spec_block_target_schema: $ => seq(
      'schema',
      field('name', $._struct_identifier),
      optional(field('type_parameters', $.type_parameters)),
    ),
    spec_body: $ => seq(
      '{',
      repeat($.use_declaration),
      repeat($._spec_block_memeber),
      '}'
    ),
    _spec_block_memeber: $ => choice(
      $.spec_invariant,
      $._spec_function,
      $.spec_condition,
      $.spec_include,
      $.spec_apply,
      $.spec_pragma,
      $.spec_variable,
      $.spec_let,
    ),
    spec_let: $ => seq(
      'let',
      optional('post'),
      field('name', $.identifier),
      '=',
      field('def', $._expression),
      ';'
    ),
    spec_condition: $ => choice(
      $._spec_condition,
      $._spec_abort_if,
      $._spec_abort_with_or_modifies,
    ),
    _spec_condition_kind: $ => choice(
      'assert',
      'assume',
      'decreases',
      'ensures',
      'succeeds_if',
    ),
    _spec_condition: $ => seq(
      choice(
        field('kind', alias($._spec_condition_kind, $.condition_kind)),
        seq(
          field('kind', alias('requires', $.condition_kind)),
          optional('module'),
        )
      ),
      optional(field('condition_properties', $.condition_properties)),
      field('expr', $._expression),
      ';'
    ),
    _spec_abort_if: $ => seq(
      field('kind', alias('aborts_if', $.condition_kind)),
      optional(field('condition_properties', $.condition_properties)),
      field('expr', $._expression),
      optional(seq('with', field('additional_exp', $._expression))),
      ';'
    ),
    _spec_abort_with_or_modifies: $ => seq(
      field('kind', alias(choice(
        'aborts_with',
        'modifies'
      ), $.condition_kind)),
      optional(field('condition_properties', $.condition_properties)),
      sepBy1(',', field('additional_exp', $._expression)),
      ';'
    ),

    spec_invariant: $ => seq(
      field('kind', alias('invariant', $.condition_kind)),
      optional(field('modifier', alias(choice('update', 'pack', 'unpack', 'module'), $.invariant_modifier))),
      optional(field('condition_properties', $.condition_properties)),
      field('expr', $._expression),
      ';'
    ),
    condition_properties: $ => seq('[', sepBy(',', $.spec_property), ']'),
    spec_include: $ => seq('include', $._expression, ';'),

    spec_apply: $ => seq(
      'apply',
      field('expr', $._expression),
      'to',
      sepBy1(',', $.spec_apply_pattern),
      optional(seq('except', sepBy1(',', $.spec_apply_pattern))),
      ';'
    ),
    spec_apply_pattern: $ => seq(
      optional(choice('public', 'internal')),
      field('name_pattern', $.spec_apply_name_pattern),
      optional(field('type_parameters', $.type_parameters)),
    ),
    spec_apply_name_pattern: $ => /[0-9a-zA-Z_*]+/,

    spec_pragma: $ => seq(
      'pragma',
      sepBy(',', $.spec_property),
      ';'
    ),
    spec_property: $ => seq($.identifier, optional(seq('=', $._literal_value))),

    spec_variable: $ => seq(
      optional(choice('global', 'local')),
      field('name', $.identifier),
      optional(field('type_parameters', $.type_parameters)),
      ':',
      field('type', $._type),
      ';'
    ),

    _spec_function: $ => choice(
      $.native_spec_function,
      $.usual_spec_function,
      $.uninterpreted_spec_function,
    ),

    uninterpreted_spec_function: $ => seq('fun', $._spec_function_signature, ';'),
    native_spec_function: $ => seq('native', 'fun', $._spec_function_signature, ';'),
    usual_spec_function: $ => seq(
      'fun',
      $._spec_function_signature,
      field('body', $.block)
    ),
    _spec_function_signature: $ => seq(
      field('name', $._function_identifier),
      optional(field('type_parameters', $.type_parameters)),
      field('parameters', $.function_parameters),
      field('return_type', $.ret_type),
    ),

    // Spec block end


    // 类型语法
    _type: $ => choice(
      $.apply_type,
      $.ref_type,
      $.tuple_type,
      $.function_type,
      $.primitive_type,
    ),
    // 
    apply_type: $ => prec.left(PRECEDENCE.apply_type, seq(
      $.module_access,
      optional(field('type_arguments', $.type_arguments)),
    )),
    // 引用类型
    ref_type: $ => seq(
      $._reference,
      $._type
    ),
    // 元组类型
    tuple_type: $ => seq('(', sepBy(',', $._type), ')'),
    primitive_type: $ => choice(
      'u8',
      'u16',
      'u32',
      'u64',
      'u128',
      'u256',
      'bool',
      'address',
      'signer',
      'bytearray',
    ),
    ret_type: $ => seq(':', $._type),

    // 模块访问
    module_access: $ => choice(
      // macro variable access
      seq('$', field('member', $.identifier)),
      // address access
      seq('@', field('member', $.identifier)),
      field('member', alias($._reserved_identifier, $.identifier)),
      seq(
        field('member', $.identifier),
        optional(field('type_arguments', $.type_arguments)),
      ),
      seq(
        field('module', $._module_identifier),
        optional(field('type_arguments', $.type_arguments)),
        '::',
        field('member', $.identifier)
      ),
      seq(
        $.module_identity,
        optional(field('type_arguments', $.type_arguments)),
      ),
      seq(
        $.module_identity,
        optional(field('type_arguments', $.type_arguments)),
        '::',
        field('member', $.identifier)
      ),
      seq(
        $.module_identity,
        '::',
        field('enum_name', $.identifier),
        optional(field('type_arguments', $.type_arguments)),
        '::',
        field('variant', $.identifier)
      ),
    ),

    // 友元访问
    friend_access: $ => choice(
      field('local_module', $.identifier),
      field('fully_qualified_module', $.module_identity),
    ),

    macro_module_access: $ => seq(field("access", $.module_access), "!"),

    module_identity: $ =>
      seq(
        field('address', choice($.num_literal, $._module_identifier)),
        '::',
        field('module', $._module_identifier)
      ),

    type_arguments: $ => seq(
      '<',
      sepBy1(',', $._type),
      '>'
    ),

    function_type: $ => seq(
      field('param_types', $.function_type_parameters),
      optional(
        seq(
          '->',
          field('return_type', $._type)
        )
      )
    ),
    function_type_parameters: $ => seq('|', sepBy(',', $._type), '|'),

    // `mut <function_parameter>`
    mut_function_parameter: $ => seq(
      'mut',
      $.function_parameter,
    ),

    // function parameter grammar
    function_parameter: $ => seq(
      choice(
        field('name', $._variable_identifier),
        seq('$', field('name', $._variable_identifier)),
      ),
      ':',
      field('type', $._type),
    ),

    // type parameter grammar
    type_parameters: $ => seq('<', sepBy1(',', $.type_parameter), '>'),
    type_parameter: $ => seq(
      optional('$'),
      optional('phantom'),
      $._type_parameter_identifier,
      optional(seq(':',
        sepBy1('+', $.ability)
      ))
    ),

    // Block

    block: $ => seq(
      '{',
      repeat($.use_declaration),
      repeat($.block_item),
      optional($._expression),
      '}'
    ),
    block_item: $ => seq(
      choice(
        $._expression,
        $.let_statement,
      ),
      ';'
    ),
    let_statement: $ => seq(
      'let',
      field('binds', $.bind_list),
      optional(seq(':', field('type', $._type))),
      optional(seq('=', field('expr', $._expression)))
    ),
    // Block end


    // Expression

    _expression: $ => choice(
      $.call_expression,
      $.macro_call_expression,
      $.lambda_expression,
      $.if_expression,
      $.while_expression,
      $.return_expression,
      $.abort_expression,
      $.assign_expression,
      // unary expression is included in binary_op,
      $._unary_expression,
      $.binary_expression,
      $.cast_expression,
      $.quantifier_expression,
      $.match_expression,
      $.vector_expression,
      $.loop_expression,
      $.identified_expression,
    ),

    identified_expression: $ => seq(
      field('expression_id', $.block_identifier),
      $._expression,
    ),

    vector_expression: $ => seq(
      choice(
        "vector[",
        seq(
          "vector<",
          sepBy1(',', $._type),
          '>',
          '[',
        )
      ),
      sepBy(",", $._expression),
      "]"
    ),

    quantifier_expression: $ => prec.right(seq(
      choice($._forall, $._exists),
      $.quantifier_bindings,
      optional(seq('where', $._expression)),
      ':',
      $._expression
    )),
    quantifier_bindings: $ => sepBy1(',', $.quantifier_binding),
    quantifier_binding: $ => choice(
      seq($.identifier, ':', $._type),
      seq($.identifier, 'in', $._expression)
    ),
    lambda_expression: $ => seq(
      field('bindings', $.lambda_bindings),
      optional(seq('->', $._type)),
      field('expr', $._expression)
    ),
    lambda_binding: $ => choice(
      $.comma_bind_list,
      field('bind', $._bind),
      seq(field('bind', $._bind), optional(seq(':', field('ty', $._type)))),
    ),
    lambda_bindings: $ => seq(
      '|',
      sepBy(',', $.lambda_binding),
      '|'
    ),
    // if-else expression
    if_expression: $ => prec.right(
      seq(
        'if',
        '(',
        field('eb', $._expression),
        ')',
        field('et', $._expression),
        optional(seq(
          'else',
          field('ef', $._expression)
        )),
      )
    ),

    // while expression
    while_expression: $ => seq(
      'while',
      '(',
      field('eb', $._expression),
      ')',
      field('body', $._expression),
    ),

    // loop expression
    loop_expression: $ => seq('loop', field('body', $._expression)),

    // return expression
    return_expression: $ => prec.left(seq(
      'return',
      optional(field('label', $.label)),
      optional(field('return', $._expression))
    )),

    // abort expression
    abort_expression: $ => seq('abort', optional(field('abort', $._expression))),

    match_expression: $ => seq(
      'match',
      '(',
      field('match_scrutiny', $._expression),
      ')',
      $._match_body,
    ),

    _match_body: $ => seq(
      '{',
      sepBy(',', $.match_arm),
      '}',
    ),

    match_condition: $ => seq(
      'if',
      '(',
      field('condition', $._expression),
      ')',
    ),

    match_arm: $ => seq(
      $.bind_list,
      optional($.match_condition),
      '=>',
      $._expression,
    ),

    call_expression: $ => prec.dynamic(1, seq(
      $.name_expression,
      field('args', $.arg_list),
    )),
    macro_call_expression: $ => seq(
      field('access', $.macro_module_access),
      optional(field('type_arguments', $.type_arguments)),
      field('args', $.arg_list),
    ),
    pack_expression: $ => seq(
      $.name_expression,
      field('body', $.field_initialize_list),
    ),

    // 名称表达式
    name_expression: $ => seq(
      optional('::'),
      field('access', $.module_access),
    ),

    // 赋值表达式
    assign_expression: $ => prec.left(PRECEDENCE.assign,
      seq(
        field('lhs', $._unary_expression),
        '=',
        field('rhs', $._expression)
      )
    ),

    // 二进制表达式
    binary_expression: $ => {
      const table = [
        // 赋值运算符 (优先级 1)
        [PRECEDENCE.assign, '='],
        [PRECEDENCE.add_assign, '+='],
        [PRECEDENCE.sub_assign, '-='],
        [PRECEDENCE.mul_assign, '*='],
        [PRECEDENCE.div_assign, '/='],
        [PRECEDENCE.mod_assign, '%='],
        [PRECEDENCE.band_assign, '&='],
        [PRECEDENCE.bor_assign, '|='],
        [PRECEDENCE.xor_assign, '^='],
        [PRECEDENCE.shl_assign, '<<='],
        [PRECEDENCE.shr_assign, '>>='],

        // 逻辑运算符
        // [PRECEDENCE.implies, '==>'],  // 蕴含
        [PRECEDENCE.or, '||'],        // 逻辑或
        [PRECEDENCE.and, '&&'],       // 逻辑与

        // 比较运算符 (优先级 5)
        [PRECEDENCE.eq, '=='],        // 等于
        [PRECEDENCE.neq, '!='],       // 不等于
        [PRECEDENCE.lt, '<'],         // 小于
        [PRECEDENCE.gt, '>'],         // 大于
        [PRECEDENCE.le, '<='],        // 小于等于
        [PRECEDENCE.ge, '>='],        // 大于等于

        // [PRECEDENCE.range, '..'],     // 范围

        // 位运算符
        [PRECEDENCE.bitor, '|'],      // 按位或
        [PRECEDENCE.xor, '^'],        // 按位异或
        [PRECEDENCE.bitand, '&'],     // 按位与

        // 移位运算符
        [PRECEDENCE.shl, '<<'],       // 左移
        [PRECEDENCE.shr, '>>'],       // 右移

        // 算术运算符
        [PRECEDENCE.add, '+'],        // 加法
        [PRECEDENCE.sub, '-'],        // 减法
        [PRECEDENCE.mul, '*'],        // 乘法
        [PRECEDENCE.div, '/'],        // 除法
        [PRECEDENCE.mod, '%']         // 取模
      ];

      let binary_expression = choice(...table.map(
        ([precedence, operator]) => prec.left(precedence, seq(
          field('lhs', $._expression),
          field('operator', alias(operator, $.binary_operator)),
          field('rhs', $._expression),
        ))
      ));

      return binary_expression;
    },

    _unary_expression: $ => prec(10, choice(
      $.unary_expression,
      $.borrow_expression,
      $.dereference_expression,
      $.move_or_copy_expression,
      $._expression_term,
    )),
    unary_expression: $ => seq(
      field('op', $.unary_op),
      field('expr', $._expression)
    ),
    unary_op: $ => choice('!'),

    // dereference
    dereference_expression: $ => prec.right(PRECEDENCE.unary, seq(
      '*',
      field('expr', $._expression),
    )),
    // borrow
    borrow_expression: $ => prec(PRECEDENCE.unary, seq(
      $._reference,
      field('expr', $._expression),
    )),
    // move or copy
    move_or_copy_expression: $ => prec(PRECEDENCE.unary, seq(
      choice('move', 'copy'),
      field('expr', $._expression),
    )),

    _reference: $ => choice(
      $.imm_ref,
      $.mut_ref,
    ),

    _expression_term: $ => choice(
      $.call_expression,
      $.break_expression,
      $.continue_expression,
      $.name_expression,
      $.macro_call_expression,
      $.pack_expression,
      $._literal_value,
      $.unit_expression,
      $.expression_list,
      $.annotation_expression,
      $.block,
      $.spec_block,
      $.if_expression,

      $.dot_expression,
      $.index_expression,
      $.vector_expression,
      $.match_expression,
    ),
    // 中断表达式
    break_expression: $ => seq(
      'break',
      optional(field('label', $.label)),
      optional(field('break', $._expression))
    ),
    // continue 表达式
    continue_expression: $ => seq(
      'continue',
      optional(field('label', $.label)),
    ),

    field_initialize_list: $ => seq(
      '{',
      sepBy(',', $.exp_field),
      '}'
    ),

    // 参数列表
    arg_list: $ => seq(
      '(',
      sepBy(',', $._expression),
      ')'
    ),

    // 表达式列表
    expression_list: $ => seq('(', sepBy1(',', $._expression), ')'),
    unit_expression: $ => seq('(', ')'),
    cast_expression: $ => prec.left(PRECEDENCE.as, seq(
      field('expr', $._expression),
      'as',
      field('ty', $._type),
    )),
    annotation_expression: $ => seq(
      '(',
      field('expr', $._expression),
      ':',
      field('ty', $._type),
      ')'
    ),


    // 点表达式
    dot_expression: $ => prec.left(PRECEDENCE.field, seq(
      field('expr', $._expression_term),
      '.',
      field('access', $._expression_term),
    )),
    index_expression: $ => prec.left(PRECEDENCE.call, seq(
      field('expr',
        $._expression_term,
      ),
      '[', sepBy(',', field('idx', $._expression)), ']'
    )),

    // Expression end

    // Fields and Bindings
    exp_field: $ => seq(
      field('field', $._field_identifier),
      optional(seq(
        ':',
        field('expr', $._expression)
      ))
    ),

    bind_list: $ => choice(
      $._bind,
      $.comma_bind_list,
      $.or_bind_list,
    ),
    at_bind: $ => seq($._variable_identifier, '@', $.bind_list),
    comma_bind_list: $ => seq('(', sepBy(',', $._bind), ')'),
    or_bind_list: $ => seq(optional('('), sepBy1('|', seq(optional('('), $._bind, optional(')'))), optional(')')),

    mut_bind_var: $ => seq(
      'mut',
      alias($._variable_identifier, $.bind_var),
    ),

    _bind: $ => choice(
      choice(
        $.mut_bind_var,
        alias($._variable_identifier, $.bind_var)
      ),
      $.bind_unpack,
      $.at_bind,
      $._literal_value,
    ),
    bind_unpack: $ => seq(
      $.name_expression,
      optional(field('bind_fields', $.bind_fields)),
    ),
    bind_fields: $ => choice(
      $.bind_positional_fields,
      $.bind_named_fields,
    ),
    _spread_operator: _$ => '..',
    bind_positional_fields: $ => seq(
      '(', sepBy(',', choice($.bind_field, $.mut_bind_field)), ')'
    ),
    bind_named_fields: $ => seq(
      '{', sepBy(',', choice($.bind_field, $.mut_bind_field)), '}'
    ),

    mut_bind_field: $ => seq(
      'mut',
      $.bind_field,
    ),

    // 
    bind_field: $ => choice(seq(
      field('field', $.bind_list), // direct bind
      optional(seq(
        ':',
        field('bind', $.bind_list)
      ))
    ), $._spread_operator),
    // Fields and Bindings - End

    // 字面量
    _literal_value: $ => choice(
      $.address_literal,
      $.bool_literal,
      $.num_literal,
      $.hex_string_literal,
      $.byte_string_literal,
      // $.vector_literal,
    ),

    imm_ref: $ => '&',
    mut_ref: $ => seq('&', 'mut'),
    block_identifier: $ => seq($.label, ':'),
    label: $ => seq('\'', $.identifier),
    address_literal: $ => /@(0x[a-fA-F0-9]+|[0-9]+)/,
    bool_literal: $ => choice('true', 'false'),
    num_literal: $ => choice(/[0-9][0-9_]*(?:u8|u16|u32|u64|u128|u256)?/, /0x[a-fA-F0-9_]+/),
    hex_string_literal: $ => /x"[0-9a-fA-F]*"/,
    byte_string_literal: $ => /b"(\\.|[^\\"])*"/,
    _module_identifier: $ => alias($.identifier, $.module_identifier),
    _struct_identifier: $ => alias($.identifier, $.struct_identifier),
    _enum_identifier: $ => alias($.identifier, $.enum_identifier),
    _variant_identifier: $ => alias($.identifier, $.variant_identifier),
    _function_identifier: $ => alias($.identifier, $.function_identifier),
    _variable_identifier: $ => alias($.identifier, $.variable_identifier),
    _field_identifier: $ => alias($.identifier, $.field_identifier),
    _type_identifier: $ => alias($.identifier, $.type_identifier),
    _type_parameter_identifier: $ => alias($.identifier, $.type_parameter_identifier),
    identifier: $ => /(`)?[a-zA-Z_][0-9a-zA-Z_]*(`)?/,
    macro_identifier: $ => /[a-zA-Z_][0-9a-zA-Z_]*!/,
    _reserved_identifier: $ => choice($._forall, $._exists),

    _forall: $ => 'forall',
    _exists: $ => 'exists',
    // 行注释
    line_comment: $ => token(seq(
      '//', /.*/
    )),
    // 换行
    newline: $ => token(/\n/),
    // 空格
    _whitespace: $ => /\s/,
    // http://stackoverflow.com/questions/13014947/regex-to-match-a-c-style-multiline-comment/36328890#36328890
    // 块注释
    block_comment: $ => token(seq(
      '/*',
      /[^*]*\*+([^/*][^*]*\*+)*/,
      '/'
    ))
  }
});

//      (<rule> 'sep')* <rule>?
// Note that this allows an optional trailing `sep`.
function sepBy (sep, rule) {
  return seq(repeat(seq(rule, sep)), optional(rule));
}
function sepBy1 (sep, rule) {
  return seq(rule, repeat(seq(sep, rule)), optional(sep));
}


