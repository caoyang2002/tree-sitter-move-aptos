//运算符优先级 (1 最小)
const PRECEDENCE = {
  // 赋值运算符 (优先级 1) - 更新左侧值
  assign: 1, //
  add_assign: 1, // += (执行加法并赋值)
  sub_assign: 1, // -= (执行减法并赋值)
  mul_assign: 1, // *= (执行乘法并赋值)
  div_assign: 1, // /= (执行截断除法并赋值)
  mod_assign: 1, // %= (执行取模运算并赋值)
  band_assign: 1, // &= (执行按位与并赋值)
  bor_assign: 1, // |= (执行按位或并赋值)
  xor_assign: 1, // ^= (执行按位异或并赋值)
  shl_assign: 1, // <<= (执行左移位并赋值)
  shr_assign: 1, // >>= (执行右移位并赋值)

  or: 2, // || (逻辑或)
  and: 3, // && (逻辑与)

  // 比较运算符 (优先级 5)
  eq: 4, // == (等于)
  neq: 4, // != (不等于)
  lt: 4, // < (小于)
  gt: 4, // > (大于)
  le: 4, // <= (小于等于)
  ge: 4, // >= (大于等于)

  range: 6, // .. (范围)

  // 位运算符
  bitor: 5, // | (按位或 - 对每一位执行布尔或运算)
  xor: 6, // ^ (按位异或 - 对每一位执行布尔异或运算)
  bitand: 7, // & (按位与 - 对每一位执行布尔与运算)

  // 移位运算符 (优先级 10)
  shl: 8, // << (左移 - 移位数大于整数类型大小时报错)
  shr: 8, // >> (右移 - 移位数大于整数类型大小时报错)

  // 算术运算符
  add: 9, // + (加法 - 结果超出整数类型范围时报错)
  sub: 9, // - (减法 - 结果小于零时报错)
  mul: 10, // * (乘法 - 结果超出整数类型范围时报错)
  div: 10, // / (截断除法 - 除数为0时报错)
  mod: 10, // % (取模运算 - 除数为0时报错)

  // 最高优先级运算符
  unary: 11, // 一元运算符
  field: 12, // 字段访问
  call: 13, // 函数调用
  apply_type: 13, // 类型应用
  as: 14, // 类型转换
};
// 语法结构定义
module.exports = grammar({
  name: "move", // 语言名称
  // 额外规则
  extras: ($) => [
    $._whitespace,
    $.line_comment,
    $.block_comment,
    $.newline,
    $.annotation,
  ],
  // 标识符
  word: ($) => $.identifier,
  // 类型
  supertypes: ($) => [$._spec_block_target],

  // 冲突定义
  conflicts: ($) => [
    // 三元冲突：注解、模块标识符、模块访问
    // 例如：@std::vector 可能被解析为注解表达式或模块访问
    // [$._module_identifier, $.annotation_expr, $.module_access],

    // 注解表达式 vs 模块访问
    // 例如：@module::function 的解析歧义
    // [$.annotation_expr, $.module_access],

    // 表达式 vs 表达式项
    // 简单表达式可能同时符合两种规则的情况
    [$._expression, $._expression_term],

    // 函数类型参数内部歧义
    // 例如：<T, U> 在不同上下文中的解析差异
    // [$.function_type_parameters],

    // 模块访问 vs 变量标识符
    // 例如：std 可能是模块名(std::vector)或变量名
    // [$.module_access, $._variable_identifier],

    // 模块访问 vs 模块标识符
    // 例如：module 既可能是关键字也可能是标识符的一部分
    [$.module_access, $._module_identifier],

    // 注释掉的修饰符冲突
    [$.visibility_modifier, $.native_struct_definition],

    // 绑定列表 vs 或绑定列表
    // 例如：(a, b) vs a | b 的模式匹配歧义
    [$.bind_list, $.or_bind_list],

    // 重复的函数类型参数冲突声明
    // [$.function_type_parameters],

    // 逗号绑定列表 vs 或绑定列表
    // 例如：let (a, b) = ... vs let a | b = ... 的绑定模式歧义
    [$.comma_bind_list, $.or_bind_list],

    // break表达式 vs 块标识符
    // 例如：break 'label 中 'label 的解析歧义
    [$.break_expression, $.block_identifier],

    [$.pack_expression, $._expression_term],

    // 元组 vs 参数列表
    [$.tuple_type, $.arg_list],

    // lambda 表达式 vs 闭包
    [$.lambda_expression, $.closure],

    //
    [$.arg_list, $.expression_list],

    // 或绑定列表内部歧义
    // 复杂的或模式匹配中的递归歧义
    [$.or_bind_list],

    // 可变绑定变量 vs 普通绑定
    // 例如：mut var vs var 的绑定声明歧义
    [$.mut_bind_var, $._bind],

    // 函数类型参数 vs 表达式
    [$.function_type_parameters, $._expression],
    // 元组和表达式()冲突
    //  [$.tuple_type, $.unit_expression],

    // 给 visibility_modifier 更高的优先级
    // [$.package_use_declaration, $.visibility_modifier],

    // 模块访问内部歧义
    // 复杂的模块路径解析中的递归歧义
    [$.module_access],

    // break表达式内部歧义
    // break语句的不同形式（带值/不带值/带标签）
    [$.break_expression],

    // abort表达式内部歧义
    // abort语句的不同形式的解析冲突
    [$.abort_expression],
  ],
  // 主要语法规则
  rules: {
    // 源文件：模块文件、脚本文件、地址文件
    source_file: ($) =>
      choice($.module_definition, $.script_definition, $.address_definition),

    // 定义 address 规则
    address_definition: ($) => {
      return seq(
        "address",
        field("address_name", choice($.num_literal, $._module_identifier)),
        field("address_body", $.address_body),
      );
    },

    // address 体，可以包含多个模块和脚本
    address_body: ($) => {
      return seq(
        "{",
        repeat(
          choice(
            $.simple_module_definition, // 简化的模块定义（不需要完整的 module_identity）
            $.script_definition, // 脚本定义
            $.package_use_declaration, // 包使用声明
            $.friend_declaration,
          ),
        ),
        "}",
      );
    },

    // 简化的模块定义（用于 address 内部）
    simple_module_definition: ($) => {
      return seq(
        "module",
        field("name", $._module_identifier), // 只需要模块名，不需要完整的 address::module 格式
        field("module_body", $.module_body),
      );
    },

    // 包使用声明
    //use <address>::<module name>;
    // use <address>::<module name> as <module alias name>;
    package_use_declaration: ($) =>
      seq(
        "use",
        choice($.use_module, $.use_module_member, $.use_module_members),
        ";",
      ),
    // 处理函数修饰符，包括public和inline的组合
    function_modifier: ($) =>
      choice("public", "inline", seq("public", "inline")),

    use_fun: ($) =>
      seq(
        "fun",
        $.module_access,
        "as",
        field("alias", seq($.module_access, ".", $._function_identifier)),
      ),
    use_module: ($) =>
      seq(
        $.module_identity,
        optional(seq("as", field("alias", $._module_identifier))),
      ),
    use_module_member: ($) =>
      seq($.module_identity, "::", field("use_member", $.use_member)),
    use_module_members: ($) =>
      choice(
        seq(
          field("address", choice($.num_literal, $._module_identifier)),
          "::",
          "{",
          sepBy1(",", field("use_member", $.use_member)),
          "}",
        ),
        seq(
          $.module_identity,
          "::",
          "{",
          sepBy1(",", field("use_member", $.use_member)),
          "}",
        ),
      ),

    // 语法：
    // std::{Vec, HashMap, String}
    // std::Vec 或 std::Vec as Vector
    use_member: ($) =>
      choice(
        seq(
          field("module", $.identifier),
          "::",
          "{",
          sepBy1(",", field("use_member", $.use_member)),
          "}",
        ),
        seq(
          field("module", $.identifier),
          "::",
          field("member", $.identifier),
          optional(seq("as", field("alias", $.identifier))),
        ),
        seq(
          field("member", $.identifier),
          optional(seq("as", field("alias", $.identifier))),
        ),
      ),

    // 1. 将修饰符按功能分类
    // 可见性修饰符
    visibility_modifier: ($) =>
      seq("public", optional(seq("(", choice("package", "friend"), ")"))),

    // 实现类型修饰符
    implementation_modifier: ($) => choice("native", "inline"),

    // 函数行为修饰符
    function_behavior_modifier: ($) => field("entry", "entry"),

    // 2. 组合修饰符用于不同场景
    // 函数修饰符组合
    function_modifiers: ($) =>
      choice(
        // 单个修饰符
        $.visibility_modifier,
        $.implementation_modifier,
        $.function_behavior_modifier,

        // 两个修饰符的组合
        seq($.visibility_modifier, $.implementation_modifier),
        seq($.visibility_modifier, $.function_behavior_modifier),
        seq($.implementation_modifier, $.function_behavior_modifier),

        // 三个修饰符的组合
        seq(
          $.visibility_modifier,
          $.implementation_modifier,
          $.function_behavior_modifier,
        ),
      ),

    // 结构体修饰符组合
    struct_modifiers: ($) =>
      choice(
        $.visibility_modifier,
        $.implementation_modifier,
        seq($.visibility_modifier, $.implementation_modifier),
      ),

    // 3. 保持不变的声明
    // 友元声明
    friend_declaration: ($) =>
      seq("friend", field("module", $.friend_access), ";"),

    // 类型能力声明（不需要修改）
    ability: ($) => choice("copy", "drop", "store", "key"),
    // ability: ($) => choice("copy", "drop", "store", "key"),

    // 脚本定义
    script_definition: ($) => {
      return seq("script", field("script_body", $.script_body));
    },

    // 脚本体
    script_body: ($) => {
      return choice(
        // 当使用分号结束时
        ";",

        // 当使用大括号时，确保它们是配对的
        seq(
          "{",
          repeat(
            choice(
              $.package_use_declaration,
              $.friend_declaration,
              $.constant,
              $._function_item,
              $._struct_item,
              $._enum_item,
              $.spec_block,
            ),
          ),
          "}",
        ),
      );
    },

    // 定义 module 规则
    module_definition: ($) => {
      return seq(
        "module",
        field("module_identity", $.module_identity),
        field("module_body", $.module_body),
      );
    },

    // 模块体
    module_body: ($) => {
      return choice(
        // 空模块体，以分号结束
        ";",

        // 非空模块体，以大括号包围
        seq(
          "{",
          repeat(
            choice(
              // use 导入声明
              $.package_use_declaration,
              // friend 声明
              $.friend_declaration,
              // 模块级常量定义
              $.constant,
              // 函数定义
              $._function_item,
              // 结构体定义
              $._struct_item,
              // 枚举类型定义
              $._enum_item,
              // 规范块
              // $.spec_block,
            ),
          ),
          "}", // 非可选的右大括号
        ),
      );
    },

    // 注释
    annotation: ($) => seq("#[", sepBy1(",", $.annotation_item), "]"),

    // 注释表达式
    annotation_expr: ($) =>
      prec.dynamic(
        5,
        choice(
          field("name", $.identifier),
          seq(
            field("name", $.identifier),
            "=",
            field(
              "value",
              choice(
                field("local_const", seq("::", $.module_access)),
                $.module_access,
                $._literal_value,
              ),
            ),
          ),
        ),
      ),
    // 注释列表
    annotation_list: ($) =>
      seq(
        field("name", $.identifier),
        "(",
        sepBy1(
          ",",
          choice(
            $._literal_value,
            $.annotation_item,
            $.module_access,
            field("local_const", seq("::", $.module_access)),
          ),
        ),
        ")",
      ),

    // 注释项
    annotation_item: ($) =>
      choice(
        field("annotation_expr", $.annotation_expr),
        field("annotation_list", $.annotation_list),
      ),

    // 常量
    constant: ($) =>
      // const <名称>: <类型> = <表达式>;
      // const MY_ERROR_CODE: u64 = 0;
      seq(
        "const",
        field("name", alias($.identifier, $.constant_identifier)),
        ":",
        field("type", $._type),
        "=",
        field("expr", $._expression),
        ";",
      ),

    // 数据类型字段的常见解析器

    // 数据类型
    datatype_fields: ($) => choice($.positional_fields, $.named_fields),
    positional_fields: ($) => seq("(", sepBy(",", $._type), ")"),
    named_fields: ($) => seq("{", sepBy(",", $.field_annotation), "}"),

    // 枚举
    _enum_item: ($) => choice($.enum_definition),
    enum_definition: ($) =>
      seq(
        optional("public"),
        $._enum_signature,
        field("enum_variants", $.enum_variants),
        optional(
          field("postfix_ability_declarations", $.postfix_ability_decls),
        ),
      ),
    _enum_signature: ($) =>
      seq(
        "enum",
        field("name", $._enum_identifier),
        optional(field("type_parameters", $.type_parameters)), // 形参
        optional(field("ability_declarations", $.ability_decls)),
      ),
    enum_variants: ($) => seq("{", sepBy(",", $.variant), "}"),
    variant: ($) =>
      seq(
        field("variant_name", $._variant_identifier),
        optional(field("fields", $.datatype_fields)),
      ),

    // 结构体
    _struct_item: ($) =>
      choice($.native_struct_definition, $.struct_definition),
    native_struct_definition: ($) =>
      seq(optional("public"), "native", $._struct_signature, ";"),
    struct_definition: ($) =>
      seq(
        optional("public"),
        $._struct_signature,
        field("struct_fields", $.datatype_fields),
        optional(
          field("postfix_ability_declarations", $.postfix_ability_decls),
        ),
      ),
    // 字段注释
    field_annotation: ($) =>
      seq(field("field", $._field_identifier), ":", field("type", $._type)),
    ability_decls: ($) => seq("has", sepBy(",", $.ability)),
    postfix_ability_decls: ($) => seq("has", sepBy(",", $.ability), ";"),

    // 结构体签名
    _struct_signature: ($) =>
      seq(
        "struct",
        field("name", $._struct_identifier),
        optional(field("type_parameters", $.type_parameters)),
        optional(field("ability_declarations", $.ability_decls)),
      ),

    // 函数项
    _function_item: ($) =>
      // fun <identifier><[type_parameters: constraint],*>([identifier: type],*): <return_type> <acquires [identifier],*> <function_body>
      // 函数使用 fun 关键字声明，后跟函数名、类型参数、参数、返回类型、acquires注解，最后是函数体。
      choice(
        $.native_function_definition, // 原生函数定义
        $.macro_function_definition, // 宏定义
        $.function_definition, // 函数定义
      ),
    // 原生函数定义
    // native public fun empty<Element>(): vector<Element>;
    native_function_definition: ($) => seq($._function_signature, ";"),
    // 宏函数定义
    macro_function_definition: ($) =>
      seq(
        // optional($.modifier),
        "macro",
        $._macro_signature,
        field("body", $.block),
      ),

    // 宏函数签名
    _macro_signature: ($) =>
      seq(
        // optional($.modifier),
        "fun",
        field("name", $._function_identifier),
        optional(field("type_parameters", $.type_parameters)),
        field("parameters", $.function_parameters),
        optional(field("return_type", $.ret_type)),
      ),

    // 函数定义
    function_definition: ($) =>
      // public fun name<T>(){}
      // public(friend)
      // enrty public(friend) fun name<T>(){}
      // public entry fun foo() {}
      // 函数签名 函数体
      seq($._function_signature, field("body函数体", $.block)),
    // 函数签名
    _function_signature: ($) =>
      seq(
        // 函数修饰符
        optional($.function_modifiers),
        // 函数标识
        "fun",
        // 函数名
        field("name", $._function_identifier),
        // 函数类型
        optional(field("type_parameters类型参数", $.type_parameters)),
        // 参数
        field("parameters参数", $.function_parameters),
        // 返回类型
        optional(field("return_type返回类型", $.ret_type)),
        // 访问修饰符
        optional(field("specifier访问修饰", $.specifier)),
      ),
    // 函数参数
    function_parameters: ($) =>
      seq(
        "(",
        sepBy(",", choice($.mut_function_parameter, $.function_parameter)),
        ")",
      ),

    // Spec block start
    spec_block: ($) =>
      seq(
        "spec",
        choice(
          seq(
            optional(field("target", $._spec_block_target)),
            field("body", $.spec_body),
          ),
          $._spec_function,
        ),
      ),
    _spec_block_target: ($) =>
      choice(
        $.identifier,
        alias("module", $.spec_block_target_module),
        $.spec_block_target_schema,
      ),
    spec_block_target_fun: ($) => seq("fun", $._function_identifier),
    spec_block_target_struct: ($) => seq("struct", $._struct_identifier),
    spec_block_target_schema: ($) =>
      seq(
        "schema",
        field("name", $._struct_identifier),
        optional(field("type_parameters", $.type_parameters)),
      ),

    spec_body: ($) =>
      seq(
        "{",
        repeat($.package_use_declaration),
        repeat($._spec_block_memeber),
        "}",
      ),
    _spec_block_memeber: ($) =>
      choice(
        $.spec_invariant,
        $._spec_function,
        $.spec_condition,
        $.spec_include,
        $.spec_apply,
        $.spec_pragma,
        $.spec_variable,
        $.spec_let,
      ),
    spec_let: ($) =>
      seq(
        "let",
        optional("post"),
        field("name", $.identifier),
        "=",
        field("def", $._expression),
        ";",
      ),
    spec_condition: ($) =>
      choice(
        $._spec_condition,
        $._spec_abort_if,
        $._spec_abort_with_or_modifies,
      ),
    _spec_condition_kind: ($) =>
      choice("assert", "assume", "decreases", "ensures", "succeeds_if"),
    _spec_condition: ($) =>
      seq(
        choice(
          field("kind", alias($._spec_condition_kind, $.condition_kind)),
          seq(
            field("kind", alias("requires", $.condition_kind)),
            optional("module"),
          ),
        ),
        optional(field("condition_properties", $.condition_properties)),
        field("expr", $._expression),
        ";",
      ),
    _spec_abort_if: ($) =>
      seq(
        field("kind", alias("aborts_if", $.condition_kind)),
        optional(field("condition_properties", $.condition_properties)),
        field("expr", $._expression),
        optional(seq("with", field("additional_exp", $._expression))),
        ";",
      ),
    _spec_abort_with_or_modifies: ($) =>
      seq(
        field(
          "kind",
          alias(choice("aborts_with", "modifies"), $.condition_kind),
        ),
        optional(field("condition_properties", $.condition_properties)),
        sepBy1(",", field("additional_exp", $._expression)),
        ";",
      ),

    // 断言
    spec_invariant: ($) =>
      seq(
        field("kind", alias("invariant", $.condition_kind)),
        optional(
          field(
            "modifier",
            alias(
              choice("update", "pack", "unpack", "module"),
              $.invariant_modifier,
            ),
          ),
        ),
        optional(field("condition_properties", $.condition_properties)),
        field("expr", $._expression),
        ";",
      ),

    condition_properties: ($) => seq("[", sepBy(",", $.spec_property), "]"),

    spec_include: ($) => seq("include", $._expression, ";"),

    spec_apply: ($) =>
      seq(
        "apply",
        field("expr", $._expression),
        "to",
        sepBy1(",", $.spec_apply_pattern),
        optional(seq("except", sepBy1(",", $.spec_apply_pattern))),
        ";",
      ),

    // 规范应用模式
    spec_apply_pattern: ($) =>
      seq(
        optional(choice("public", "internal")),
        field("name_pattern", $.spec_apply_name_pattern),
        optional(field("type_parameters", $.type_parameters)),
      ),
    // 规范应用名称模式
    spec_apply_name_pattern: ($) => /[0-9a-zA-Z_*]+/,

    // 规范属性
    spec_pragma: ($) => seq("pragma", sepBy(",", $.spec_property), ";"),
    spec_property: ($) =>
      seq($.identifier, optional(seq("=", $._literal_value))),

    // 规范变量
    spec_variable: ($) =>
      seq(
        optional(choice("global", "local")),
        field("name", $.identifier), // 变量名称
        optional(field("type_parameters", $.type_parameters)), // 类型参数
        ":",
        field("type", $._type), // 类型
        ";",
      ),

    _spec_function: ($) =>
      choice(
        $.native_spec_function,
        $.usual_spec_function,
        $.uninterpreted_spec_function,
      ),

    uninterpreted_spec_function: ($) =>
      seq("fun", $._spec_function_signature, ";"),
    native_spec_function: ($) =>
      seq("native", "fun", $._spec_function_signature, ";"),
    usual_spec_function: ($) =>
      seq("fun", $._spec_function_signature, field("body", $.block)),
    _spec_function_signature: ($) =>
      // 顺序匹配
      seq(
        // 名称
        field("name", $._function_identifier),
        // 可选的参数类型
        optional(field("type_parameters", $.type_parameters)),
        // 参数
        field("parameters", $.function_parameters),
        // field("return_type", $.ret_type),
        // 返回类型 :u64
        optional(seq(":", field("return_type", $.ret_type))),
        // 访问修饰列表  acquires R1,R2
        optional(field("specifier", $.specifier)),
      ),
    // 访问修饰符
    specifier: ($) => seq("acquires", $.access_list),
    // 访问列表
    access_list: ($) => $.comma_sep_resources,
    // 逗号表达式
    comma_sep_resources: ($) =>
      seq(sepBy1(",", $.resource_name), optional(",")),
    resource_name: ($) => /[A-Z][a-zA-Z0-9_]*/,
    //---------------
    // 类型语法
    _type: ($) =>
      choice(
        $.apply_type, // 类型应用
        $.ref_type, // 引用类型
        $.tuple_type, // 元组类型
        $.function_type, // 函数类型
        $.primitive_type, // 原始类型
      ),
    // 类型应用
    apply_type: ($) =>
      // Vector<u8> - 单个泛型类型带有一个类型参数
      // HashMap<address, u64> - 泛型类型带有多个类型参数
      // std::vector::Vector<u8> - 带模块路径的泛型类型
      // MyType - 不带类型参数的普通类型（因为类型参数是可选的）
      // Option<vector<u8>> - 嵌套泛型类型
      prec.left(
        // 处理连续应用时从左到右解析的优先级
        PRECEDENCE.apply_type, // 首先匹配一个模块访问表达式（类型名称，可能带有模块路径）
        seq(
          $.module_access,
          optional(field("type_arguments", $.type_arguments)), // 可选
        ),
      ),
    // 引用类型
    ref_type: ($) => seq($._reference, $._type),
    // 元组类型
    tuple_type: ($) => seq("(", sepBy(",", $._type), ")"),
    // 原始类型
    primitive_type: ($) =>
      choice(
        "u8",
        "u16",
        "u32",
        "u64",
        "u128",
        "u256",
        "bool",
        "address",
        "signer",
        "bytearray",
      ),
    // 返回类型
    ret_type: ($) => seq(":", $._type),

    // 模块访问
    module_access: ($) =>
      prec(
        4,
        choice(
          // 特殊前缀访问
          seq("$", field("member", $.identifier)), // 宏变量访问
          seq("@", field("member", $.identifier)), // 地址访问

          // 基本标识符
          field("member", alias($._reserved_identifier, $.identifier)),
          seq(
            field("member", $.identifier),
            optional(field("type_arguments", $.type_arguments)),
          ),

          // 模块标识符访问
          seq(
            field("module", choice($._module_identifier, $.module_identity)),
            optional(field("type_arguments", $.type_arguments)),
            optional(
              seq(
                "::",
                field("member", $.identifier),
                optional(field("type_arguments", $.type_arguments)),
              ),
            ),
          ),

          // 枚举变体访问
          seq(
            $.module_identity,
            "::",
            field("enum_name", $.identifier),
            optional(field("type_arguments", $.type_arguments)),
            "::",
            field("variant", $.identifier),
          ),
        ),
      ),

    // 友元访问
    friend_access: ($) =>
      choice(
        field("local_module", $.identifier),
        field("fully_qualified_module", $.module_identity),
      ),

    macro_module_access: ($) => seq(field("access", $.module_access), "!"),

    module_identity: ($) =>
      seq(
        field("address", choice($.num_literal, $._module_identifier)),
        "::",
        field("module", $._module_identifier),
      ),

    type_arguments: ($) => seq("<", sepBy1(",", $._type), ">"),

    // 函数类型
    function_type: ($) =>
      prec.right(
        seq(
          field("param_types", $.function_type_parameters),
          // optional(seq("->", field("return_type", $._type))),
        ),
      ),
    // 函数类型参数
    // function_type_parameters: ($) => seq("|", sepBy(",", $._type), "|"),
    // 函数类型参数
    function_type_parameters: ($) =>
      field("lambda_parameter", $.lambda_expression),

    // `mut <function_parameter>`
    mut_function_parameter: ($) => seq("mut", $.function_parameter),

    // 函数参数语法
    function_parameter: ($) =>
      seq(
        choice(
          field("name", $._variable_identifier),
          seq("$", field("name", $._variable_identifier)),
        ),
        ":",
        field("type", $._type),
      ),

    // 类型参数语法
    type_parameters: ($) => seq("<", sepBy1(",", $.type_parameter), ">"),
    type_parameter: ($) =>
      seq(
        optional("$"),
        optional("phantom"),
        $._type_parameter_identifier,
        optional(seq(":", sepBy1("+", $.ability))),
      ),

    // Block

    block: ($) =>
      seq(
        "{",
        repeat($.package_use_declaration),
        repeat($.block_item),
        optional($._expression),
        "}",
      ),
    block_item: ($) => seq(choice($._expression, $.let_statement), ";"),
    let_statement: ($) =>
      seq(
        "let",
        field("binds", $.bind_list),
        optional(seq(":", field("type", $._type))),
        optional(seq("=", field("expr", $._expression))),
      ),
    // Block end

    // 表达式
    _expression: ($) =>
      choice(
        $.function_call_expression, // 函数调用表达式
        $.macro_function_call_expression, // 宏调用表达式
        $.if_expression, // if 表达式
        $.while_expression, // while 循环
        $.return_expression,
        $.abort_expression,
        $.assignment_expression,
        // unary expression is included in binary_op,
        $._unary_expression,
        $.binary_expression,
        $.cast_expression,
        $.quantifier_expression,
        $.match_expression, // match 表达式
        $.vector_expression, // 向量表达式
        $.loop_expression, // loop 循环
        $.identified_expression, // 标识符表达式
        $.for_expression, // for 循环
        $.lambda_expression, // lambda 表达式
        $.closure, // 闭包表达式
      ),

    identified_expression: ($) =>
      seq(field("expression_id", $.block_identifier), $._expression),

    vector_expression: ($) =>
      seq(
        choice("vector[", seq("vector<", sepBy1(",", $._type), ">", "[")),
        sepBy(",", $._expression),
        "]",
      ),

    quantifier_expression: ($) =>
      prec.right(
        seq(
          choice($._forall, $._exists),
          $.quantifier_bindings,
          optional(seq("where", $._expression)),
          ":",
          $._expression,
        ),
      ),
    quantifier_bindings: ($) => sepBy1(",", $.quantifier_binding),
    quantifier_binding: ($) =>
      choice(
        seq($.identifier, ":", $._type),
        seq($.identifier, "in", $._expression),
      ),

    // if-else 表达式
    if_expression: ($) =>
      prec.right(
        seq(
          "if",
          "(",
          field("eb", $._expression),
          ")",
          field("et", $._expression),
          optional(seq("else", field("ef", $._expression))),
        ),
      ),

    // while expression
    while_expression: ($) =>
      seq(
        "while",
        "(",
        field("eb", $._expression),
        ")",
        field("body", $._expression),
      ),

    // loop expression
    loop_expression: ($) => seq("loop", field("body", $._expression)),

    for_expression: ($) =>
      seq(
        "for",
        "(",
        field("iterator", $._variable_identifier),
        "in",
        field("range", $.range_expression),
        ")",
        field("body", $._expression),
      ),

    // 3. 添加 range_expression 规则用于处理范围表达式
    range_expression: ($) =>
      prec.left(
        PRECEDENCE.range,
        seq(field("start", $._expression), "..", field("end", $._expression)),
      ),
    // return expression
    return_expression: ($) =>
      prec.left(
        seq(
          "return",
          optional(field("label", $.label)),
          optional(field("return", $._expression)),
        ),
      ),

    // abort expression
    abort_expression: ($) =>
      seq("abort", optional(field("abort", $._expression))),

    match_expression: ($) =>
      seq(
        "match",
        "(",
        field("match_scrutiny", $._expression),
        ")",
        $._match_body,
      ),

    _match_body: ($) => seq("{", sepBy(",", $.match_arm), "}"),

    match_condition: ($) =>
      seq("if", "(", field("condition", $._expression), ")"),

    match_arm: ($) =>
      seq($.bind_list, optional($.match_condition), "=>", $._expression),

    // 函数调用表达式
    function_call_expression: ($) =>
      prec.dynamic(1, seq($.name_expression, field("args", $.arg_list))),
    // 宏函数调用表达式
    macro_function_call_expression: ($) =>
      seq(
        field("access", $.macro_module_access),
        optional(field("type_arguments", $.type_arguments)),
        field("args", $.arg_list), // 实参列表
      ),

    pack_expression: ($) =>
      seq($.name_expression, field("body", $.field_initialize_list)),

    // 名称表达式
    name_expression: ($) =>
      seq(optional("::"), field("access", $.module_access)),

    // 函数类型中的参数类型
    function_type: ($) =>
      seq(
        field("param_types", $.function_type_parameters),
        // optional(seq("->", field("return_type", $._type))),
      ),

    // lambda 表达式 (函数参数可以使用 Lambda 表达式)
    lambda_expression: ($) =>
      // |<参数类型列表>| <返回类型>
      // |Accumulator, Element|Accumulator
      // |x| x + 1
      // |x, y| x + y
      // || 1
      // || { 1 }
      prec.left(
        field(
          "lambda_parameter",
          choice(
            // |<参数类型列表>| <返回类型>
            // 参数类型列表，至少有一个参数，返回类型
            seq(
              "|",
              sepBy1(",", field("param_type", $._type)),
              "|",
              field("return_type", $._type),
            ), //
            // |x|{a+b}
            // ||{let c = a+b; c+d};
            // || fun()
            seq(
              "|",
              optional(sepBy(",", $._variable_identifier)),
              "|",
              field("expression", $._expression),
            ), // 闭包
          ),
        ),
      ),

    // 闭包表达式
    closure: ($) =>
      seq(
        "|",
        field("args", optional($.arg_list)), // 实参列表
        "|",
        field("body", $._expression),
      ),

    // 赋值表达式 assignment_expression
    assignment_expression: ($) =>
      prec.left(
        PRECEDENCE.assign,
        seq(
          field("lhs", $._unary_expression),
          "=",
          field("rhs", $._expression),
        ),
      ),

    // 二进制表达式
    binary_expression: ($) => {
      const table = [
        // 赋值运算符 (优先级 1)
        [PRECEDENCE.assign, "="],
        [PRECEDENCE.add_assign, "+="],
        [PRECEDENCE.sub_assign, "-="],
        [PRECEDENCE.mul_assign, "*="],
        [PRECEDENCE.div_assign, "/="],
        [PRECEDENCE.mod_assign, "%="],
        [PRECEDENCE.band_assign, "&="],
        [PRECEDENCE.bor_assign, "|="],
        [PRECEDENCE.xor_assign, "^="],
        [PRECEDENCE.shl_assign, "<<="],
        [PRECEDENCE.shr_assign, ">>="],

        // 逻辑运算符
        // [PRECEDENCE.implies, '==>'],  // 蕴含
        [PRECEDENCE.or, "||"], // 逻辑或
        [PRECEDENCE.and, "&&"], // 逻辑与

        // 比较运算符 (优先级 5)
        [PRECEDENCE.eq, "=="], // 等于
        [PRECEDENCE.neq, "!="], // 不等于
        [PRECEDENCE.lt, "<"], // 小于
        [PRECEDENCE.gt, ">"], // 大于
        [PRECEDENCE.le, "<="], // 小于等于
        [PRECEDENCE.ge, ">="], // 大于等于

        [PRECEDENCE.range, ".."], // 范围

        // 位运算符
        [PRECEDENCE.bitor, "|"], // 按位或
        [PRECEDENCE.xor, "^"], // 按位异或
        [PRECEDENCE.bitand, "&"], // 按位与

        // 移位运算符
        [PRECEDENCE.shl, "<<"], // 左移
        [PRECEDENCE.shr, ">>"], // 右移

        // 算术运算符
        [PRECEDENCE.add, "+"], // 加法
        [PRECEDENCE.sub, "-"], // 减法
        [PRECEDENCE.mul, "*"], // 乘法
        [PRECEDENCE.div, "/"], // 除法
        [PRECEDENCE.mod, "%"], // 取模
      ];

      let binary_expression = choice(
        ...table.map(([precedence, operator]) =>
          prec.left(
            precedence,
            seq(
              field("lhs", $._expression),
              field("operator", alias(operator, $.binary_operator)),
              field("rhs", $._expression),
            ),
          ),
        ),
      );

      return binary_expression;
    },

    _unary_expression: ($) =>
      prec(
        10,
        choice(
          $.unary_expression,
          $.borrow_expression,
          $.dereference_expression,
          $.move_or_copy_expression,
          $._expression_term,
        ),
      ),
    unary_expression: ($) =>
      seq(field("op", $.unary_op), field("expr", $._expression)),
    unary_op: ($) => "!",

    // 解引用表达式
    dereference_expression: ($) =>
      prec.right(PRECEDENCE.unary, seq("*", field("expr", $._expression))),
    // borrow 表达式
    borrow_expression: ($) =>
      prec(PRECEDENCE.unary, seq($._reference, field("expr", $._expression))),
    // move 和 copy 表达式
    move_or_copy_expression: ($) =>
      prec(
        PRECEDENCE.unary,
        seq(choice("move", "copy"), field("expr", $._expression)),
      ),

    // 引用
    _reference: ($) => choice($.imm_ref, $.mut_ref),

    // 访问表达式
    _expression_term: ($) =>
      choice(
        $.function_call_expression, // 函数调用表达式
        $.break_expression, // break 表达式
        $.continue_expression, // continue 表达式
        $.name_expression, // 命名表达式
        $.macro_function_call_expression, // 宏表达式
        $.pack_expression, // 包表达式
        $._literal_value, // 字面量
        $.unit_expression, // 单位表达式
        $.expression_list, // 表达式列表
        $.annotation_expression, // 注释表达式
        $.block, // 块表达式
        $.spec_block, // 规范块
        $.if_expression,

        $.dot_expression,
        $.index_expression,
        $.vector_expression,
        $.match_expression,
      ),
    // 中断表达式
    break_expression: ($) =>
      seq(
        "break",
        optional(field("label", $.label)),
        optional(field("break", $._expression)),
      ),
    // continue 表达式
    continue_expression: ($) =>
      seq("continue", optional(field("label", $.label))),

    field_initialize_list: ($) => seq("{", sepBy(",", $.exp_field), "}"),

    // 参数列表
    arg_list: ($) => seq("(", sepBy(",", $._expression), ")"),

    // 表达式列表
    expression_list: ($) => seq("(", sepBy1(",", $._expression), ")"),
    unit_expression: ($) => prec(1, seq("(", ")")),
    cast_expression: ($) =>
      prec.left(
        PRECEDENCE.as,
        seq(field("expr", $._expression), "as", field("ty", $._type)),
      ),
    annotation_expression: ($) =>
      seq("(", field("expr", $._expression), ":", field("ty", $._type), ")"),

    // 点表达式 a.b
    dot_expression: ($) =>
      prec.left(
        PRECEDENCE.field,
        seq(
          field("expr", $._expression_term),
          ".",
          field("access", $._expression_term),
        ),
      ),
    // 索引表达式 a[1]
    index_expression: ($) =>
      prec.left(
        PRECEDENCE.call,
        seq(
          field("expr", $._expression_term),
          "[",
          sepBy(",", field("idx", $._expression)),
          "]",
        ),
      ),

    // ================================================================================= Fields and Bindings - Start
    exp_field: ($) =>
      seq(
        field("field", $._field_identifier),
        optional(seq(":", field("expr", $._expression))),
      ),

    // 绑定列表
    bind_list: ($) => choice($._bind, $.comma_bind_list, $.or_bind_list),

    // @ 绑定
    at_bind: ($) => seq($._variable_identifier, "@", $.bind_list),
    // , 绑定列表
    comma_bind_list: ($) => seq("(", sepBy(",", $._bind), ")"),
    // | 绑定列表
    or_bind_list: ($) =>
      seq(
        optional("("),
        sepBy1("|", seq(optional("("), $._bind, optional(")"))),
        optional(")"),
      ),

    // mut 绑定变量
    mut_bind_var: ($) => seq("mut", alias($._variable_identifier, $.bind_var)),

    _bind: ($) =>
      choice(
        choice($.mut_bind_var, alias($._variable_identifier, $.bind_var)),
        $.bind_unpack,
        $.at_bind,
        $._literal_value,
      ),

    bind_unpack: ($) =>
      seq($.name_expression, optional(field("bind_fields", $.bind_fields))),
    bind_fields: ($) => choice($.bind_positional_fields, $.bind_named_fields),
    // 展开操作符
    _spread_operator: (_$) => "..",
    //
    bind_positional_fields: ($) =>
      seq("(", sepBy(",", choice($.bind_field, $.mut_bind_field)), ")"),
    //绑定命名字段
    bind_named_fields: ($) =>
      seq("{", sepBy(",", choice($.bind_field, $.mut_bind_field)), "}"),

    mut_bind_field: ($) => seq("mut", $.bind_field),

    //
    bind_field: ($) =>
      choice(
        seq(
          field("field", $.bind_list), // direct bind
          optional(seq(":", field("bind", $.bind_list))),
        ),
        $._spread_operator,
      ),
    // ================================================================================= Fields and Bindings - End

    // 字面量
    _literal_value: ($) =>
      choice(
        $.address_literal,
        $.bool_literal,
        $.num_literal,
        $.hex_string_literal,
        $.byte_string_literal,
        // $.vector_literal,
      ),
    // 引用规则
    imm_ref: ($) => "&",
    mut_ref: ($) => seq("&", "mut"),
    // 块标识符和标签
    block_identifier: ($) => seq($.label, ":"),
    label: ($) => seq("'", $.identifier),
    // 各种字面量定义
    address_literal: ($) => /@(0x[a-fA-F0-9]+|[0-9]+)/,
    bool_literal: ($) => choice("true", "false"),
    // 数字字面量
    num_literal: ($) =>
      choice(/[0-9][0-9_]*(?:u8|u16|u32|u64|u128|u256)?/, /0x[a-fA-F0-9_]+/),
    hex_string_literal: ($) => /x"[0-9a-fA-F]*"/,
    byte_string_literal: ($) => /b"(\\.|[^\\"])*"/,
    // 各种标识符类型定义
    _module_identifier: ($) => alias($.identifier, $.module_identifier),
    _struct_identifier: ($) => alias($.identifier, $.struct_identifier),
    _enum_identifier: ($) => alias($.identifier, $.enum_identifier),
    _variant_identifier: ($) => alias($.identifier, $.variant_identifier),
    _function_identifier: ($) => alias($.identifier, $.function_identifier),
    _variable_identifier: ($) => alias($.identifier, $.variable_identifier), //变量
    _field_identifier: ($) => alias($.identifier, $.field_identifier),
    _type_identifier: ($) => alias($.identifier, $.type_identifier),
    _type_parameter_identifier: ($) =>
      alias($.identifier, $.type_parameter_identifier),
    // 基本标识符规则
    identifier: ($) => /(`)?[a-zA-Z_][0-9a-zA-Z_]*(`)?/,
    macro_identifier: ($) => /[a-zA-Z_][0-9a-zA-Z_]*!/,
    _reserved_identifier: ($) => choice($._forall, $._exists),
    // 量词关键字
    _forall: ($) => "forall",
    _exists: ($) => "exists",
    // 行注释
    line_comment: ($) => token(seq("//", /.*/)),
    // 换行
    newline: ($) => token(/\n/),
    // 空格
    _whitespace: ($) => /\s/,
    // http://stackoverflow.com/questions/13014947/regex-to-match-a-c-style-multiline-comment/36328890#36328890
    // 块注释
    block_comment: ($) => token(seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),
  },
});

// 用分隔符分隔的规则序列，允许尾部有分隔符
function sepBy(sep, rule) {
  return seq(repeat(seq(rule, sep)), optional(rule));
}

// 至少有一个元素的、用分隔符分隔的规则序列
function sepBy1(sep, rule) {
  return seq(rule, repeat(seq(sep, rule)), optional(sep));
}
