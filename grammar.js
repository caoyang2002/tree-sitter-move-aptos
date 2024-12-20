{/* <reference types="tree-sitter-cli/dsl" /> */}
const sepBy1 = (sep, rule) => seq(rule, repeat(seq(sep, rule)));
const sepBy = (sep, rule) => optional(sepBy1(sep, rule));
const sepByComma = rule => seq(sepBy(',', rule), optional(','));
const escaped_sequence = token.immediate(seq('\\', choice(/x[0-9a-fA-F]{2}/, /[ntr0\\"]/)));
const binary_operators = [
  [], // 1 (no binary operators have precedence 1)
  [
      ['==>', 'equal_equal_greater'],
      ['<==>', 'less_equal_equal_greater'],
  ], // 2
  [['||', 'pipe_pipe']], // 3
  [['&&', 'amp_amp']], // 4
  [
      ['==', 'equal_equal'],
      ['!=', 'exclaim_equal'],
      ['<', 'less'],
      ['>', 'greater'],
      ['<=', 'less_equal'],
      ['>=', 'greater_equal'],
  ], // 5
  [['..', 'period_period']], // 6
  [['|', 'pipe']], // 7
  [['^', 'caret']], // 8
  [['&', 'amp']], // 9
  [
      ['<<', 'less_less'],
      ['>>', 'greater_greater'],
  ], // 10
  [
      ['+', 'plus'],
      ['-', 'minus'],
  ], // 11
  [
      ['*', 'star'],
      ['/', 'slash'],
      ['%', 'percent'],
  ], // 12
];
const expr_precedence = {
  DEFAULT: 1,
  LAST: -1,

  // immediately after the multiplicative operators (*, /, %)
  UNARY: 13,
  FIELD: 14,
  CALL: 15,
  RANGE: 16,
};
module.exports = grammar({
  name: 'move',

  word: $ => $.identifier,

  conflicts: $ => [
      [$._reuseable_keywords, $.for_loop_expr],
      [$.discouraged_name, $._type],
      [$.var, $.pack_expr],
      [$._quantifier_directive, $.quantifier],
      [$.var, $.call_expr],
      [$._reuseable_keywords, $.match_expr],
      [$.enum_decl, $._enum_signature],
      [$.struct_decl, $._struct_signature],
      [$._variant, $._variant_last],
  ],

  extras: $ => [
      // `$.comments` will crash tree-sitter somehow.
      $.line_comment,
      $.block_comment,
      /\s/,
  ],

  inline: $ => [$._name_expr, $._dot_or_index_chain, $._ident_or_wildcard],

  externals: $ => [
      $._block_doc_comment_marker,
      $._block_comment_content,
      $._doc_line_comment,

      // If a syntax error is encountered during regular parsing, Tree-sitter’s first action during error
      // recovery will be to call the external scanner’s scan function with all tokens marked valid.
      $._error_sentinel,
  ],

  precedences: $ => [
      [$.vector_value_expr, $.primitive_type],
      [$.var_name, $.name_access_chain],
  ],

  rules: {
      // Parse a file:
      //  File = (<Attributes> (<AddressBlock> | <Module> | <Script>))*
      source_file: $ =>
          repeat(
              seq(
                  // Attributes = ("#" "[" Comma<Attribute> "]")*
                  optional($.attributes),
                  // <AddressBlock> | <Module> | <Script>
                  choice($.module, $.script, $.address_block)
              )
          ),

      number_type: _ => choice('u8', 'u16', 'u32', 'u64', 'u128', 'u256'),

      /// `signer` is quite special: it is used externally as a type, but internally can be a variable.
      signer: _ => 'signer',
      _quantifier_directive: _ => choice('exists', 'forall', 'choose', 'min'),

      primitive_type: $ => choice($.number_type, 'bool', 'address', 'vector'),

      identifier: _ => /[a-zA-Z_]\w*/,
      var_name: $ => choice($.identifier, $.discouraged_name),
      // FIXME: this is a workaround for the existing chaotic naming scheme. Keywords are not supposed to be identifiers.
      discouraged_name: $ =>
          choice($.primitive_type, $._quantifier_directive, $._reuseable_keywords),
      _reuseable_keywords: _ => choice('for', 'while', 'friend', 'match'),

      number: _ =>
          choice(
              /\d[\d_]*/,
              seq(/0[xX]/, /[\da-fA-F][\da-fA-F_]*/),
              seq(/0[bB]/, /[01][01_]*/),
              seq(/0[oO]/, /[0-7][0-7_]*/)
          ),
      numerical_addr: $ => $.number,
      bool_literal: $ => choice('true', 'false'),
      typed_number: $ => seq($.number, $.number_type),
      byte_string: _ =>
          choice(
              token(seq('x"', /[\da-fA-F]*/, '"')),
              token(seq('b"', repeat(choice(escaped_sequence, /[^\\"]/)), '"'))
          ),

      // When `wildcard = true`, the identifier can be `*`.
      _ident_or_wildcard: $ => choice($.identifier, '*'),

      // LeadingNameAccess = <NumericalAddress> | <Identifier>
      // `Identifier` can be `*` if `wildcard = true`
      _leading_name_access: $ => choice($.numerical_addr, $.identifier),
      _leading_name_access_wildcard: $ => choice($.numerical_addr, $._ident_or_wildcard),

      // NameAccessChain = <Identifier>
      //                 | <LeadingNameAccess> "::" <Identifier> ( "::" <Identifier> ( "::" <Identifier> )? )?
      // `Identifier` can be `*` if `wildcard = true`
      name_access_chain: $ =>
          choice(
              field('name', choice($.identifier, $.discouraged_name)),
              seq(
                  choice($._leading_name_access, $.discouraged_name),
                  seq('::', field('access_two', $.identifier)),
                  optional(
                      seq(
                          '::',
                          field('access_three', $.identifier),
                          optional(seq('::', field('access_four', $.identifier)))
                      )
                  )
              )
          ),
      name_access_chain_wildcard: $ =>
          choice(
              field('name', choice($._ident_or_wildcard, $.discouraged_name)),
              seq(
                  choice($._leading_name_access_wildcard, $.discouraged_name),
                  seq('::', field('access_two', $._ident_or_wildcard)),
                  optional(
                      seq(
                          '::',
                          field('access_three', $._ident_or_wildcard),
                          optional(seq('::', field('access_four', $._ident_or_wildcard)))
                      )
                  )
              )
          ),

      // Parse a Type:
      //         Type = _Type | _RefType
      //
      //         _Type =
      //          <NameAccessChain> <TypeArgs>?
      //          | "|" Comma<Type> "|" <Type>?
      //          | "(" Comma<Type> ")"
      //
      //         _RefType =  "&" <_Type> | "&mut" <_Type>
      // **Double** ('&&') reference is not allowed.
      type: $ => choice($._type, $._ref_type),
      _type: $ =>
          choice(
              seq(choice($.name_access_chain, $.primitive_type), optional($.type_args)),
              // `||' is treated as an empty param type list in this context.
              // TODO: verify the associativity
              $.closure_type,
              $.tuple_type
          ),
      tuple_type: $ => seq('(', sepByComma($.type), ')'),
      closure_type: $ =>
          prec.right(
              expr_precedence.DEFAULT,
              seq(
                  '|',
                  field('param_types', sepByComma($.type)),
                  '|',
                  field('return_type', optional($.type))
              )
          ),
      _ref_type: $ =>
          choice(seq('&', field('ref', $._type)), seq('&mut', field('ref_mut', $._type))),

      // Parse an expression:
      //      Exp =
      //            <LambdaBindList> <Exp>
      //          | <Quantifier>                  spec only
      //          | <BinOpExp>
      //          | <UnaryExp> "=" <Exp>
      _expr: $ =>
          choice(
              $.assignment,
              $._op_expr,
              $.quantifier,
              alias(seq($.lambda_bind_list, $._expr), $.lambda)
          ),
      assignment: $ =>
          prec.left(
              expr_precedence.DEFAULT,
              seq(field('target', $._unary_expr), '=', field('value', $._expr))
          ),

      // Parse a list of bindings for lambda.
      //      LambdaBindList = "|" Comma<Bind> "|"
      lambda_bind_list: $ => seq('|', sepByComma($._bind), '|'),

      // Parses a quantifier expressions
      //
      //   <Quantifier> =
      //       ( "forall" | "exists" ) <QuantifierBindings>? <Triggers>? ("where" <Exp>)? ":" Exp
      //     | ( "choose" [ "min" ] ) <QuantifierBind> "where" <Exp>
      //   <QuantifierBindings>   = <QuantifierBind> ("," <QuantifierBind>)*
      //   <QuantifierBind>       = <Identifier> ":" <Type> | <Identifier> "in" <Exp>
      //   <Triggers>             = ("{" Comma<Exp> "}")+
      quantifier: $ =>
          choice(
              seq(
                  field('scope', choice('forall', 'exists')),
                  sepBy1(',', $.quantifier_bind),
                  optional(field('triggers', $.triggers)),
                  optional(seq('where', field('where', $._expr))),
                  ':',
                  field('assertion', $._expr)
              ),
              seq(
                  'choose',
                  optional('min'),
                  $.quantifier_bind,
                  'where',
                  field('condition', $._expr)
              )
          ),
      quantifier_bind: $ =>
          choice(
              field('type_bind', seq(field('var', $.identifier), ':', $.type)),
              field('value_bind', seq(field('var', $.identifier), 'in', field('scope', $._expr)))
          ),
      triggers: $ => repeat1(seq('{', sepByComma(field('trigger', $._expr)), '}')),

      // Old grammar:
      //      BinOpExp = <BinOpExp> <BinOp> <BinOpExp>
      //               | <UnaryExp>
      // Now grammar:
      //      OpExp = <BinOpExp>      # anonymous
      //            | <UnaryExp>
      //      BinOpExp = <OpExp> <BinOp> <OpExp>
      _op_expr: $ => choice($._unary_expr, $.bin_op_expr),
      bin_op_expr: $ =>
          choice(
              // binary operators
              ...binary_operators.flatMap((level, index) =>
                  level.map(([symbol, name]) =>
                      prec.left(
                          index + 2,
                          seq(
                              field('lhs', $._op_expr),
                              alias(symbol, $.binary_operator),
                              field('rhs', $._op_expr)
                          )
                      )
                  )
              )
          ),

      // Parse a unary expression:
      //      UnaryExp =
      //          "!" <UnaryExp>
      //          | "&mut" <UnaryExp>
      //          | "&" <UnaryExp>
      //          | "*" <UnaryExp>
      //          | "move" <Var>
      //          | "copy" <Var>
      //          | <DotOrIndexChain>
      _unary_expr: $ =>
          choice(
              $.not_expr,
              $.ref_expr,
              $.ref_mut_expr,
              $.deref_expr,
              $.move_expr,
              $.copy_expr,

              $._dot_or_index_chain
          ),
      not_expr: $ => prec(expr_precedence.UNARY, seq('!', $._unary_expr)),
      ref_expr: $ => prec(expr_precedence.UNARY, seq('&', $._unary_expr)),
      ref_mut_expr: $ => prec(expr_precedence.UNARY, seq('&mut', $._unary_expr)),
      deref_expr: $ => prec(expr_precedence.UNARY, seq('*', $._unary_expr)),
      move_expr: $ => prec(expr_precedence.UNARY, seq('move', field('variable', $.identifier))),
      copy_expr: $ => prec(expr_precedence.UNARY, seq('copy', field('variable', $.identifier))),

      // Parse an expression term optionally followed by a chain of dot or index accesses:
      //      DotOrIndexChain =
      //          <DotOrIndexChain> "." <IdentifierOrAnonField> [ ["::" <TypeArgs>]  <CallArgs> ]
      //          | <DotOrIndexChain> "[" <Exp> "]"
      //          | <Term>
      _dot_or_index_chain: $ =>
          choice($.access_field, $.receiver_call, $.mem_access, alias($.term, 'expr_term')),
      receiver_call: $ =>
          prec.left(
              expr_precedence.CALL,
              seq(
                  field('receiver', $._dot_or_index_chain),
                  '.',
                  field('func', $._identifier_or_anon_field),
                  optional(field('type_generics', seq('::', $.type_args))),
                  field('arguments', $.call_args)
              )
          ),
      mem_access: $ =>
          prec.left(
              expr_precedence.CALL,
              seq($._dot_or_index_chain, '[', field('index', $._expr), ']')
          ),
      access_field: $ =>
          prec.left(
              expr_precedence.FIELD,
              seq(
                  field('object', $._dot_or_index_chain),
                  '.',
                  field('field', $._identifier_or_anon_field)
              )
          ),

      // Parse an identifier or an positional field
      //      IdentifierOrAnonField = <Identifier> | (0-9)+
      _identifier_or_anon_field: $ => choice($.identifier, $.anon_field_index),
      anon_field_index: $ => /\d+/,

      // Parse an expression term:
      //      Term =
      //          "break"
      //          | "continue"
      //          | "vector" ('<' Comma<Type> ">")? "[" Comma<Exp> "]"
      //          | <Value>
      //          | "(" Comma<Exp> ")"
      //          | "(" <Exp> ":" <Type> ")"
      //          | "(" <Exp> "as" <Type> ")"
      //          | <Sequence>
      //          | "if" "(" <Exp> ")" <Exp> "else" "{" <Exp> "}"
      //          | "if" "(" <Exp> ")" "{" <Exp> "}"
      //          | "if" "(" <Exp> ")" <Exp> ("else" <Exp>)?
      //          | "while" "(" <Exp> ")" "{" <Exp> "}"
      //          | "while" "(" <Exp> ")" <Exp> <SpecLoopInvariant>?
      //          | "loop" <Exp>
      //          | "loop" "{" <Exp> "}"
      //          | <Match>
      //          | "return" "{" <Exp> "}"
      //          | "return" <Exp>?
      //          | "abort" "{" <Exp> "}"
      //          | "abort" <Exp>
      //          | "for" "(" <Exp> "in" <Exp> ".." <Exp> <SpecLoopInvariant>? ")" "{" <Exp> "}"
      //          | <SpecBlock>
      //          | <NameExp>
      //
      // The conflict resolution is based on `tree-sitter-javascript`'s approach.
      // TODO: make sure this behaves the same as the `move-compiler`.
      //       `lambda_bind_list` might also be involved.
      term: $ =>
          choice(
              alias('break', $.break_expr),
              alias('continue', $.continue_expr),
              $.vector_value_expr,
              $.value,
              $.tuple_expr,
              $.type_hint_expr,
              $.cast_expr,

              $.block,
              $._name_expr,

              $.spec_block,

              // control flow expressions
              $.if_expr,
              $.match_expr,
              $.while_expr,
              $.loop_expr,
              $.return_expr,
              $.abort_expr,
              $.for_loop_expr
          ),

      vector_value_expr: $ => seq('vector', optional($.type_args), '[', sepByComma($._expr), ']'),
      tuple_expr: $ => seq('(', sepByComma($._expr), ')'),
      type_hint_expr: $ => seq('(', $._expr, ':', $.type, ')'),
      cast_expr: $ => seq('(', $._expr, 'as', $.type, ')'),
      parenthesized_expr: $ => seq('(', $._expr, ')'),

      // Match = "match" "(" <Exp> ")" "{" ( <MatchArm> ","? )* "}"
      match_expr: $ =>
          seq(
              'match',
              '(',
              field('value', $._expr),
              ')',
              '{',
              repeat(seq($.match_arm, optional(','))),
              '}'
          ),

      // MatchArm = <Bind> ( "if" <Exp> )? "=>" <Exp>
      match_arm: $ =>
          seq(
              alias($.bind_list, $.pattern),
              optional(seq('if', alias($._expr, $.condition))),
              '=>',
              alias($._control_body, $.result)
          ),

      // Control flow expressions:
      if_expr: $ =>
          prec.right(
              seq(
                  'if',
                  field('condition', $.parenthesized_expr),
                  field('then', $._control_body),
                  optional(seq('else', field('else', $._control_body)))
              )
          ),
      while_expr: $ =>
          prec.left(
              expr_precedence.DEFAULT,
              seq(
                  'while',
                  field('condition', $.parenthesized_expr),
                  field('body', $._control_body),
                  optional($.spec_loop_invariant)
              )
          ),
      loop_expr: $ => seq('loop', field('body', $._control_body)),
      return_expr: $ =>
          choice(
              prec(expr_precedence.DEFAULT, 'return'),
              prec.left(seq('return', field('value', $._expr)))
          ),
      abort_expr: $ => seq('abort', field('condition', $._expr)),
      for_loop_expr: $ =>
          seq(
              'for',
              '(',
              field('var', $.var_name),
              'in',
              field('begin', $._unary_expr),
              '..',
              field('end', $._unary_expr),
              optional($.spec_loop_invariant),
              ')',
              field('body', $.block)
          ),

      // The body of `if`, `while`, `loop` expressions.
      //      ControlBody = <Sequence> | <Exp>
      // This rule is useful to conform the cases like this:
      //      if (a) {x}.f else c => (if (a) {x}).f else c => gives a parse error
      //
      // `{ }` is treated immediately after `if` or `while` or `loop` keyword.
      // So `if (a) {x}.f` is parsed as `(if (a) {x}).f` instead of `if (a) ({x}.f)`.
      _control_body: $ => choice(prec(expr_precedence.DEFAULT, $.block), $._expr),

      // Parse a pack, call, or other reference to a name:
      //      NameExp =
      //          <NameAccessChain> <OptionalTypeArgs> "{" Comma<ExpField> "}"
      //          | <NameAccessChain> <OptionalTypeArgs> <CallArgs>
      //          | <NameAccessChain> "!" <CallArgs>
      //          | <NameAccessChain> <OptionalTypeArgs>
      _name_expr: $ => choice($.var, $.call_expr, $.pack_expr, $.macro_call_expr),
      var: $ => seq($.name_access_chain, optional(field('type_arguments', $.type_args))),
      call_expr: $ =>
          seq(
              field('func_name', $.name_access_chain),
              optional(field('type_arguments', $.type_args)),
              field('arguments', $.call_args)
          ),
      pack_expr: $ =>
          seq(
              field('struct_name', $.name_access_chain),
              optional(field('type_arguments', $.type_args)),
              '{',
              sepByComma($.expr_field),
              '}'
          ),
      macro_call_expr: $ =>
          seq(field('macro_name', $.name_access_chain), '!', field('arguments', $.call_args)),

      call_args: $ => seq('(', sepByComma($._expr), ')'),

      // OptionalTypeArgs = '<' Comma<Type> ">" | <empty>
      type_args: $ => seq(token.immediate('<'), sepByComma($.type), '>'),

      // Parse a field name optionally followed by a colon and an expression argument:
      //      ExpField = <Field> <":" <Exp>>?
      expr_field: $ =>
          choice(
              field('field', alias($.identifier, $.shorthand_field_identifier)),
              seq(field('field', $.identifier), seq(':', field('value', $._expr)))
          ),

      // Parse a value:
      //      Value =
      //          "@" <LeadingNameAccess>
      //          | "true"
      //          | "false"
      //          | <Number>
      //          | <NumberTyped>
      //          | <ByteString>
      value: $ =>
          prec(
              expr_precedence.DEFAULT,
              choice(
                  seq('@', $._leading_name_access),
                  $.bool_literal,
                  $.number,
                  $.typed_number,
                  $.byte_string
              )
          ),

      // Attributes = ("#" "[" Comma<Attribute> "]")*
      // However, tree sitter does not allow empty matching. Thus, `attributes` only
      // accepts non-empty attribute list.
      attributes: $ => repeat1(seq('#', '[', sepByComma($.attribute), ']')),

      // Parse a single attribute
      //      Attribute =
      //          <AttributeName>
      //          | <AttributeName> "=" <AttributeValue>
      //          | <AttributeName> "(" Comma<Attribute> ")"
      //      AttributeName = <Identifier> ( "::" Identifier )* // merged into one identifier
      attribute: $ =>
          choice(
              field('attribute', $._attribute_name),
              seq(field('attribute', $._attribute_name), '=', field('value', $._attribute_val)),
              seq(field('attribute', $._attribute_name), '(', sepByComma($.attribute), ')')
          ),
      _attribute_name: $ => sepBy1('::', field('attr_path', $.identifier)),

      // Parse an attribute value. Either a value literal or a module access
      //  AttributeValue = <Value> | <NameAccessChain>
      _attribute_val: $ => choice(prec(expr_precedence.DEFAULT, $.value), $.name_access_chain),

      // AddressBlock = "address" <LeadingNameAccess> "{" (<Attributes> <Module>)* "}"
      address_block: $ =>
          seq('address', $._leading_name_access, '{', repeat($._address_member), '}'),
      _address_member: $ => seq(optional($.attributes), $.module),

      // Parse a module:
      //   Module =
      //       <DocComments> ( "spec" | "module") (<LeadingNameAccess>::)?<ModuleName> "{"
      //           ( <Attributes>
      //               ( <UseDecl> | <FriendDecl> |
      //                 <SpecFunction> | <SpecBlock> | <Invariant>
      //                 <DocComments> <ModuleMemberModifiers>
      //                     (<ConstantDecl> | <StructDecl> | <FunctionDecl>) )
      //               )
      //           )*
      //       "}"
      //   ModuleMemberModifiers = <ModuleMemberModifier>*
      _module_keyword: $ => 'module',

      // (<LeadingNameAccess>::)?<ModuleName>
      _module_path: $ =>
          seq(
              optional(seq(field('path', $._leading_name_access), '::')),
              field('name', $.identifier)
          ),
      module: $ =>
          seq(
              // TODO(doc): doc comments are not supported by now.
              choice('spec', $._module_keyword),
              $._module_path,
              '{',
              repeat($.declaration),
              '}'
          ),

      declaration: $ =>
          seq(
              optional($.attributes),
              choice(
                  $.use_decl,
                  $.friend_decl,

                  prec(expr_precedence.DEFAULT, seq('spec', $.spec_func)),
                  $.spec_block,
                  $.spec_invariant,

                  // TODO(doc): doc comments
                  seq(
                      repeat($.module_member_modifier),
                      choice($.constant_decl, $._struct_or_enum_decl, $.function_decl)
                  )
              )
          ),

      // Parse an optional specification block:
      //     SpecBlockTarget =
      //          <Identifier> <SpecTargetSignatureOpt>?
      //        |  "fun" <Identifier>  # deprecated
      //        | "struct <Identifier> # deprecated
      //        | "module"
      //        | "schema" <Identifier> <TypeParameters>?
      //     SpecBlock =
      //        <DocComments> "spec" ( <SpecFunction> | <SpecBlockTarget>? "{" <UseDecl>* <SpecBlockMember>* "}" )
      //     TypeParameters = '<' Comma<TypeParameter> ">"
      spec_block: $ =>
          seq(
              // TODO(doc): doc comments, might reconsider doc matching
              'spec',
              choice(
                  $.spec_func,
                  seq(
                      optional($.spec_block_target),
                      field(
                          'body',
                          seq(
                              '{',
                              repeat($.use_decl),
                              field('member', repeat($._spec_block_member)),
                              '}'
                          )
                      )
                  )
              )
          ),
      spec_block_target: $ =>
          choice(
              field(
                  'signature',
                  seq(field('func_name', $.identifier), optional($._spec_target_signature_opt))
              ),
              'module',
              field(
                  'schema',
                  seq('schema', field('schema_name', $.identifier), optional($.type_params))
              )
          ),

      // SpecTargetSignatureOpt = (TypeParameters)? "(" Comma<Parameter> ")" (":" <Type>)?
      _spec_target_signature_opt: $ =>
          seq(
              optional($.type_params),
              field('parameters', $.parameters),
              optional(seq(':', field('return_type', $.type)))
          ),

      // FIXME: It's too complicated to enforce invariant-only rule.
      spec_loop_invariant: $ => alias($.spec_block, $.spec_loop_invariant),

      // Parse a spec block member:
      //    SpecBlockMember = <DocComments> ( <Invariant> | <Condition> | <SpecFunction> | <SpecVariable>
      //                                   | <SpecInclude> | <SpecApply> | <SpecPragma> | <SpecLet>
      //                                   | <SpecUpdate> | <SpecAxiom> )
      // TODO(doc): doc comments
      _spec_block_member: $ =>
          choice(
              $.spec_invariant,
              $.spec_condition,
              $.spec_func,
              $.spec_variable,
              $.spec_include,
              $.spec_apply,
              $.spec_pragma,
              $.spec_let,
              $.spec_update,
              $.spec_axiom
          ),

      // Invariant = "invariant" <OptionalTypeParameters> [ "update" ] <ConditionProperties> <Exp> ";"
      spec_invariant: $ =>
          seq(
              'invariant',
              field('type_params', optional($.type_params)),
              field('update', optional('update')),
              optional($.condition_props),
              $._expr,
              ';'
          ),

      // Parse a specification condition:
      //    SpecCondition =
      //        ("assert" | "assume" | "ensures" | "requires" ) <ConditionProperties> <Exp> ";"
      //      | "aborts_if" <ConditionProperties> <Exp> ["with" <Exp>] ";"
      //      | ("aborts_with" | "modifies") <ConditionProperties> <Exp> [Comma <Exp>]* ";"
      //      | "decreases" <ConditionProperties> <Exp> ";"
      //      | "emits" <ConditionProperties> <Exp> "to" <Exp> [If <Exp>] ";"
      //    ConditionProperties = ( "[" Comma<SpecPragmaProperty> "]" )?
      spec_condition: $ =>
          seq(choice($.asserts, $.aborts_if, $.aborts_with_or_modifies, $.emits), ';'),
      asserts: $ =>
          seq(
              field('kind', choice('assert', 'assume', 'ensures', 'requires')),
              optional($.condition_props),
              field('condition', $._expr)
          ),
      aborts_if: $ =>
          seq(
              'aborts_if',
              optional($.condition_props),
              field('condition', $._expr),
              optional(seq('with', field('with', $._expr)))
          ),
      aborts_with_or_modifies: $ =>
          seq(
              field('kind', choice('aborts_with', 'modifies')),
              optional($.condition_props),
              sepBy1(',', $._expr)
          ),
      emits: $ =>
          seq(
              'emits',
              optional($.condition_props),
              field('emission', $._expr),
              'to',
              field('target', $._expr),
              optional(seq('if', field('condition', $._expr)))
          ),

      condition_props: $ => seq('[', field('property', sepByComma($._spec_pragma_prop)), ']'),

      // Parse a specification variable.
      //     SpecVariable = ( "global" | "local" )?
      //                    <Identifier> <OptionalTypeParameters>
      //                    ":" <Type>
      //                    [ "=" Exp ]  // global only
      //                    ";"
      spec_variable: $ =>
          seq(
              optional(field('scope', choice('global', 'local'))),
              field('variable', $.identifier),
              optional($.type_params),
              ':',
              $.type,
              optional(seq('=', field('value', $._expr))),
              ';'
          ),

      // Parse a specification function.
      //     SpecFunction = "fun" <SpecFunctionSignature> ( "{" <Sequence> "}" | ";" )
      //                  | "native" "fun" <SpecFunctionSignature> ";"
      //     SpecFunctionSignature =
      //         <Identifier> <OptionalTypeParameters> "(" Comma<Parameter> ")" ":" <Type>
      spec_func: $ =>
          choice(
              seq(
                  'fun',
                  field('signature', $._spec_func_signatures),
                  choice(field('body', $.block), ';')
              ),
              seq('native', 'fun', field('signature', $._spec_func_signatures), ';')
          ),
      _spec_func_signatures: $ =>
          seq(
              field('spec_func_name', $.identifier),
              optional($.type_params),
              field('parameters', $.parameters),
              ':',
              field('return_type', $.type)
          ),

      // Parse a specification schema include.
      //    SpecInclude = "include" <Exp> ";"
      spec_include: $ => seq('include', optional($.condition_props), $._expr, ';'),

      // Parse a specification schema apply.
      //    SpecApply = "apply" <Exp> "to" Comma<SpecApplyPattern>
      //                                   ( "except" Comma<SpecApplyPattern> )? ";"
      spec_apply: $ =>
          seq(
              'apply',
              field('expression', $._expr),
              'to',
              field('targets', sepByComma($._spec_apply_pattern)),
              optional(seq('except', field('exclusions', sepByComma($._spec_apply_pattern)))),
              ';'
          ),
      // Parse a function pattern:
      //     SpecApplyPattern = ( "public" | "internal" )? <SpecApplyFragment>+ <OptionalTypeArgs>
      //     SpecApplyFragment = <Identifier> | "*"
      _spec_apply_pattern: $ =>
          seq(
              optional(field('visibility', choice('public', 'internal'))),
              // TODO: weird pattern: name fragments followed by each other without space
              field('name_pattern', repeat1($._spec_apply_fragment)),
              field('type_params', optional($.type_params))
          ),
      _spec_apply_fragment: $ => choice('*', $.identifier),

      // Parse a specification pragma:
      //    SpecPragma = "pragma" Comma<SpecPragmaProperty> ";"
      //    SpecPragmaProperty = (<Identifier> | 'friend') ( "=" <Value> | <NameAccessChain> )?
      // NOTICE: `friend` here is not a keyword but an identifier name.
      spec_pragma: $ => seq('pragma', field('properties', sepByComma($._spec_pragma_prop)), ';'),
      _spec_pragma_prop: $ =>
          seq(
              field('prop_name', $.var_name),
              optional(seq('=', field('value', choice($.value, $.name_access_chain))))
          ),

      // Parse a specification let.
      //     SpecLet =  "let" [ "post" ] <Identifier> "=" <Exp> ";"
      spec_let: $ =>
          seq(
              'let',
              optional(field('post_state', 'post')),
              field('variable', $.var_name),
              '=',
              field('value', $._expr),
              ';'
          ),

      // Parse a specification update.
      //     SpecUpdate = "update" <UnaryExp> "=" <Exp> ";"
      spec_update: $ => seq('update', $.assignment, ';'),

      // Parse an axiom:
      //     a = "axiom" <OptionalTypeParameters> <ConditionProperties> <Exp> ";"
      spec_axiom: $ =>
          seq(
              'axiom',
              field('kind', optional($.type_params)),
              optional($.condition_props),
              field('expression', $._expr),
              ';'
          ),

      // Visibility = "public" ( "(" "script" | "friend" | "package" ")" )?
      visibility: $ =>
          seq('public', optional(seq('(', choice('script', 'friend', 'package'), ')'))),

      // ModuleMemberModifier = <Visibility> | "native"
      module_member_modifier: $ => choice($.visibility, 'native', 'entry'),

      // ModuleIdent = <LeadingNameAccess>(wildcard = false) "::" <ModuleName>
      module_ident: $ => seq($._leading_name_access, '::', field('module_name', $.identifier)),

      // Parse a use declaration:
      //      UseDecl =
      //          "use" <ModuleIdent> <UseAlias> ";" |
      //          "use" <ModuleIdent> :: <UseMember> ";" |
      //          "use" <ModuleIdent> :: "{" Comma<UseMember> "}" ";"
      use_decl: $ =>
          seq(
              'use',
              field('path', $.module_ident),
              choice(
                  optional($._use_alias),
                  seq('::', field('member', alias($._use_member, $.member))),
                  seq(
                      '::',
                      seq('{', field('member', sepByComma(alias($._use_member, $.member))), '}')
                  )
              ),
              ';'
          ),

      // UseAlias = ("as" <Identifier>)?
      _use_alias: $ => seq('as', alias($.identifier, $.alias)),

      // UseMember = <Identifier> <UseAlias>
      _use_member: $ => seq($.identifier, optional($._use_alias)),

      // FriendDecl = "friend" <NameAccessChain>(wildcard: false) ";"
      friend_decl: $ => seq('friend', field('name', $.name_access_chain), ';'),

      // ConstantDecl = "const" <Identifier> ":" <Type> "=" <Exp> ";"
      constant_decl: $ =>
          seq(
              'const',
              field('name', $.identifier),
              ':',
              field('type', $.type),
              '=',
              field('value', $._expr),
              ';'
          ),

      // Parse a function declaration:
      //      FunctionDecl =
      //          [ "inline" ] "fun" <FunctionDefName>
      //          <OptionalTypeParameters>
      //          "(" Comma<Parameter> ")"
      //          (":" <Type>)?
      //          "pure" | ( ( "!" )? ("acquires" | "reads" | "writes" ) <AccessSpecifierList> )*
      //          ("{" <Sequence> "}" | ";")
      //      OptionalTypeParameters = '<' Comma<TypeParameter> ">" | <empty>
      //      Sequence = <UseDecl>* (<SequenceItem> ";")* <Exp>?
      function_decl: $ =>
          seq(
              $._function_signature,
              // Sequence
              choice(field('body', $.block), ';')
          ),
      _function_signature: $ =>
          seq(
              optional('inline'),
              'fun',
              field('name', $.identifier),
              field('type_parameters', optional($.type_params)),
              field('parameters', $.parameters),
              optional(seq(':', field('return_type', $.type))),
              optional(field('specifier', $._specifier))
          ),
      _specifier: $ =>
          choice(
              field('pure', alias('pure', $.pure)),
              repeat1(
                  seq(
                      optional(field('negated', '!')),
                      choice('acquires', 'reads', 'writes'),
                      $.access_specifier_list
                  )
              )
          ),
      // `Block` is `Sequence`.
      block: $ =>
          seq('{', seq(repeat($.use_decl), repeat($._sequence_item), optional($._expr)), '}'),

      // Parameters = "(" Comma<Parameter> ")"
      parameters: $ => seq('(', sepByComma($.parameter), ')'),

      // Parse a type parameter:
      //  TypeParameter   = <Identifier> <Constraint>?
      //  TypeParameters = '<' Comma<TypeParameter> ">"
      //  Constraint      = ":" <Ability> (+ <Ability>)*
      type_param: $ => seq(field('type', $.identifier), optional($.constraints)),
      type_params: $ => seq('<', sepByComma($.type_param), '>'),
      constraints: $ => seq(':', sepBy1('+', $.ability)),

      // Parameter = <Var> ":" <Type>
      parameter: $ => seq(field('variable', $.identifier), ':', $.type),

      // AccessSpecifierList  = <AccessSpecifier> ( "," <AccessSpecifier> )* ","?
      // AccessSpecifier      = <NameAccessChainWithWildcard> <TypeArgs>? <AddressSpecifier>
      // AddressSpecifier     = <empty> | "(" <AddressSpecifierArg> ")"
      // AddressSpecifierArg  = "*" | <AddressBytes> | <NameAccessChain> [ <TypeArgs>? "(" <Identifier> ")" ]?
      access_specifier_list: $ => seq(sepBy1(',', $.access_specifier), optional(',')),
      access_specifier: $ =>
          seq(
              $.name_access_chain_wildcard,
              optional($.type_args),
              optional(seq('(', $._address_specifier, ')'))
          ),
      _address_specifier: $ =>
          choice(
              '*',
              // NumericalAddress = <Number>
              field('literal_address', $.numerical_addr),
              seq(
                  field('func', $.name_access_chain),
                  optional(
                      seq(
                          optional($.type_args),
                          // FIXME: only optional when NameAccessChain_::One(name) = chain.value.
                          seq('(', field('arg', $.identifier), ')')
                      )
                  )
              )
          ),

      // StructOrEnumDecl = <StructDecl> | <EnumDecl>
      _struct_or_enum_decl: $ => choice($.struct_decl, $.enum_decl),

      // StructDecl =
      //     | "struct" <StructDefName> <Abilities>? (<StructBody> | ";")
      //     | "struct" <StructDefName> <StructBody> <Abilities>? ";"                 // alternative syntax
      //     | "struct" <StructDefName> "(" Comma<Type> ")" <Abilities>? ";"          // positional fields
      //
      // StructBody = "{" Comma<FieldAnnot> "}"
      // StructDefName        = <Identifier> <StructTypeParameter>?
      // StructTypeParameter  = '<' Comma<TypeParameterWithPhantomDecl> '>'
      // TypeParameterWithPhantomDecl = "phantom"? <TypeParameter>
      struct_decl: $ =>
          choice(
              seq($._struct_signature, choice(alias($.struct_body, $.body), ';')),
              seq('struct', $._struct_def_name, $.struct_body, optional($.abilities), ';'),
              seq('struct', $._struct_def_name, $.anon_fields, optional($.abilities), ';')
          ),
      _struct_signature: $ => seq('struct', $._struct_def_name, optional($.abilities)),

      struct_body: $ => seq('{', sepByComma($.field_annot), '}'),
      anon_fields: $ => seq('(', sepByComma($.type), ')'), // a.k.a. positional fields

      _struct_def_name: $ =>
          seq(field('name', $.identifier), optional(alias($._struct_type_params, $.type_params))),
      _struct_type_params: $ =>
          seq('<', sepByComma(alias($._struct_type_parameter, $.type_param)), '>'),
      _struct_type_parameter: $ => seq(optional($.phantom), $.type_param),
      phantom: _ => 'phantom',

      // FieldAnnot = <DocComments> <Field> ":" <Type>
      field_annot: $ =>
          seq(
              // TODO(doc): doc comments,
              field('field', $.identifier),
              ':',
              $.type
          ),

      // EnumDecl =
      //     "enum" <StructDefName> <Abilities>? "{" Comma<EnumVariant> "}"
      //   | "enum" <StructDefName> "{" Comma<EnumVariant> "}" <Abilities>? ";"
      // Notice:
      //     If the variant is based on a block, we allow but do not require
      //     a `,`. Otherwise, a comma is required.
      enum_decl: $ =>
          choice(
              seq($._enum_signature, $.enum_body),
              seq('enum', $._struct_def_name, $.enum_body, optional($.abilities), ';')
          ),

      _enum_signature: $ => seq('enum', $._struct_def_name, optional($.abilities)),

      enum_body: $ => seq('{', repeat($._variant), optional($._variant_last), '}'),
      _variant: $ =>
          choice(
              seq($.enum_variant_struct, optional(',')),
              seq($.enum_variant, ','),
              seq($.enum_variant_posit, ',')
          ),
      _variant_last: $ =>
          seq(choice($.enum_variant, $.enum_variant_struct, $.enum_variant_posit), optional(',')),

      // EnumVariant =
      //       <Identifier> "{" Comma<FieldAnnot> "}"
      //     | <Identifier> "(" Comma<Type> ")"    // positional fields
      //     | <Identifier>
      enum_variant_struct: $ => seq(field('variant', $.identifier), $.struct_body),
      enum_variant_posit: $ => seq(field('variant', $.identifier), $.anon_fields),
      enum_variant: $ => $.identifier,

      // Parse a type ability
      //      Ability =
      //            "copy"
      //          | "drop"
      //          | "store"
      //          | "key"
      //
      //      Abilities = "has" Comma<Ability>
      ability: $ => choice('copy', 'drop', 'store', 'key'),
      abilities: $ => seq('has', sepBy1(',', $.ability)),

      // SequenceItem = <Exp> | "let" <BindList> (":" <Type>)? ("=" <Exp>)?
      _sequence_item: $ => seq(choice($._expr, $.let_expr), ';'),

      let_expr: $ =>
          seq(
              'let',
              field('bind', $.bind_list),
              optional(seq(':', field('type', $.type))),
              optional(seq('=', field('value', $._expr)))
          ),

      // BindList = <Bind> | "(" Comma<Bind> ")"
      bind_list: $ => choice($._bind, seq('(', sepByComma($._bind), ')')),

      // Bind = <Var>
      //      | <NameAccessChain> <OptionalTypeArgs> "{" Comma<BindField> "}"
      //      | <NameAccessChain> <OptionalTypeArgs> "(" Comma<Bind> "," ")"      enum & positional fields, v2 only
      //      | <NameAccessChain> <OptionalTypeArgs>                              enum, v2 only
      _bind: $ =>
          choice(
              field('variable', $.var_name),
              seq(
                  field('struct', $.name_access_chain),
                  optional($.type_args),
                  optional(choice(alias($._bind_fields, $.fields), alias($._bind_tuple, $.tuple)))
              )
          ),
      _bind_tuple: $ => seq('(', sepByComma($._bind), ')'),
      _bind_fields: $ => seq('{', sepByComma($.bind_field), '}'),

      // BindField    = <Field> <":" <Bind>>?
      // Field        = <Identifier>
      bind_field: $ =>
          choice(
              field('field', alias($.var_name, $.shorthand_field_identifier)),
              seq(field('field', $.var_name), ':', field('bind', $._bind))
          ),

      // Parse a script:
      //      Script = "script" "{"
      //              (<Attributes> <UseDecl>)*
      //              (<Attributes> <ConstantDecl>)*
      //              <Attributes> <DocComments> <ModuleMemberModifiers> <FunctionDecl>
      //              (<Attributes> <SpecBlock>)*
      //      "}"
      script: $ =>
          seq(
              'script',
              '{',
              repeat(alias($._script_use_decl, $.declaration)),
              repeat(alias($._script_constant_decl, $.declaration)),
              alias($._script_func_decl, $.declaration),
              repeat(alias($._script_spec_block, $.declaration)),
              '}'
          ),
      _script_use_decl: $ => seq(optional($.attributes), $.use_decl),
      _script_constant_decl: $ => seq(optional($.attributes), $.constant_decl),
      _script_func_decl: $ =>
          seq(
              optional($.attributes),
              // TODO(doc): doc comments
              repeat($.module_member_modifier),
              $.function_decl
          ),
      _script_spec_block: $ => seq(optional($.attributes), $.spec_block),

      // Comments
      comments: $ => choice($.line_comment, $.block_comment),

      // https://github.com/tree-sitter/tree-sitter-rust/blob/9c84af007b0f144954adb26b3f336495cbb320a7/grammar.js#L1527
      //
      // To differentiate between doc line comments and regular line comments, we need an external scanner.
      // Although it is possible to use regex to extract doc comments, tree-sitter behaves weirdly.
      line_comment: $ =>
          seq(
              '//',
              choice(
                  seq(token.immediate(prec(2, '//')), /.*/),
                  // _doc_line_comment is essentially `/.*/` with trailing `\n`.
                  // However, using regex to match `_doc_line_comment` is problematic due to confusion with '////xxx'
                  seq(token.immediate(prec(2, '/')), alias($._doc_line_comment, $.doc_comment)),
                  token.immediate(prec(1, /.*/))
              )
          ),

      // External scanners are needed to match nested block (doc) comments.
      block_comment: $ =>
          seq(
              '/*',
              optional(
                  choice(
                      // Documentation block comments: /** docs */
                      seq(
                          $._block_doc_comment_marker,
                          optional(alias($._block_comment_content, $.doc_comment))
                      ),
                      // Non-doc block comments
                      $._block_comment_content
                  )
              ),
              '*/'
          ),
  },
});



// -----------------

// 运算符优先级
// const PRECEDENCE = {
//   assign: 1,
//   implies: 2, // ==>
//   or: 3, // ||
//   and: 4, // &&
//   eq: 5, // ==
//   neq: 5, // !=
//   lt: 5, // <
//   gt: 5, // >
//   le: 5, // <=
//   ge: 5, // >=
//   range: 6, // ..
//   bitor: 7, // |
//   xor: 8, // ^
//   bitand: 9, // &
//   shl: 10, // <<
//   shr: 10, // >>
//   add: 11, // +
//   sub: 11, // -
//   mul: 12, // *
//   div: 12, // /
//   mod: 12, // %,
//   unary: 13,
//   field: 14,
//   call: 15,
//   apply_type: 15,
//   as: 16,
// }

// module.exports = grammar({
//   name: 'move', // 语言名称
//   // 额外规则
//   extras: $ => [$._whitespace, $.line_comment, $.block_comment, $.newline, $.annotation],
//   // 标识符 
//   word: $ => $.identifier,
//   // 类型
//   supertypes: $ => [$._spec_block_target],
//   // 冲突 
//   conflicts: $ => [
//     [$.annotation_expr, $.module_access],
//     [$._expression, $._expression_term],
//     [$.function_type_parameters],
//     [$.module_access, $._variable_identifier],
//     [$.module_access, $._module_identifier],
//     [$.modifier, $.native_struct_definition],
//     [$.bind_list, $.or_bind_list],
//     [$.comma_bind_list, $.or_bind_list],
//     [$.break_expression, $.block_identifier],
//     [$.or_bind_list],
//     [$.mut_bind_var, $._bind],
//     [$.module_access],
//     [$.break_expression],
//     [$.abort_expression],
//   ],
// // 规则定义
//   rules: {
//     // 源文件
//     source_file: $ => repeat($.module_definition),

//     // 声明 
//     use_declaration: $ => seq(
//       optional('public'),
//       'use', choice($.use_fun, $.use_module, $.use_module_member, $.use_module_members), ';'),

//     use_fun: $ => seq(
//       'fun',
//       $.module_access,
//       'as',
//       field('alias', seq($.module_access, '.', $._function_identifier))
//     ),
//     use_module: $ => seq($.module_identity, optional(seq('as', field('alias', $._module_identifier)))),
//     use_module_member: $ => seq($.module_identity, '::', field('use_member', $.use_member)),
//     use_module_members: $ => choice(
//       seq(field('address', choice($.num_literal, $._module_identifier)), '::', '{', sepBy1(',', field('use_member', $.use_member)), '}'),
//       seq($.module_identity, '::', '{', sepBy1(',', field('use_member', $.use_member)), '}'),
//     ),
//     use_member: $ => choice(
//       seq(
//         field('module', $.identifier),
//         '::',
//         '{',
//         sepBy1(',', field('use_member', $.use_member)),
//         '}'
//       ),
//       seq(field('module', $.identifier), '::', field('member', $.identifier), optional(seq('as', field('alias', $.identifier)))),
//       seq(
//         field('member', $.identifier),
//         optional(seq('as', field('alias', $.identifier)))
//       ),
//     ),

//     // parse top-level decl modifiers
//     friend_declaration: $ => seq('friend', field('module', $.friend_access), ';'),
//     modifier: $ => choice(
//       seq(
//         'public',
//         optional(seq(
//           '(',
//           choice(
//             'package',
//             'friend',
//           ),
//           ')',
//         ))),
//       'entry',
//       'native',
//     ),
//     ability: $ => choice(
//       'copy',
//       'drop',
//       'store',
//       'key',
//     ),

//     module_definition: $ => {
//       return seq(
//         'module',
//         field('module_identity', $.module_identity),
//         field('module_body', $.module_body),
//       );
//     },
//     module_body: $ => {
//       return seq(
//         choice(';', '{'),
//         repeat(
//           choice(
//             $.use_declaration,
//             $.friend_declaration,
//             $.constant,
//             $._function_item,
//             $._struct_item,
//             $._enum_item,
//             $.spec_block,
//           )),
//         optional('}'),
//       );
//     },

//     // Annotations
//     annotation: $ => seq(
//       "#[",
//       sepBy1(",", $.annotation_item),
//       "]"
//     ),

//     annotation_expr: $ => choice(
//       field("name", $.identifier),
//       seq(
//         field("name", $.identifier), "=", field("value", choice(field("local_const", seq('::', $.module_access)), $.module_access, $._literal_value))
//       ),
//     ),

//     annotation_list: $ => seq(
//       field("name", $.identifier),
//       "(",
//       sepBy1(",", choice($._literal_value, $.annotation_item, $.module_access, field("local_const", seq('::', $.module_access)))),
//       ")"
//     ),

//     annotation_item: $ => choice(
//       field("annotation_expr", $.annotation_expr),
//       field("annotation_list", $.annotation_list),
//     ),

//     // Constants
//     constant: $ => seq(
//       'const',
//       field('name', alias($.identifier, $.constant_identifier)),
//       ':',
//       field('type', $._type),
//       '=', field('expr', $._expression),
//       ";"
//     ),

//     // Common parsers for datatype fields

//     datatype_fields: $ => choice(
//       $.positional_fields,
//       $.named_fields,
//     ),
//     positional_fields: $ => seq(
//       '(',
//       sepBy(',', $._type),
//       ')'
//     ),
//     named_fields: $ => seq(
//       '{',
//       sepBy(',', $.field_annotation),
//       '}'
//     ),

//     // Enum definitions
//     _enum_item: $ => choice(
//       $.enum_definition,
//     ),
//     enum_definition: $ => seq(
//       optional('public'),
//       $._enum_signature,
//       field('enum_variants', $.enum_variants),
//       optional(field('postfix_ability_declarations', $.postfix_ability_decls)),
//     ),
//     _enum_signature: $ => seq(
//       'enum',
//       field('name', $._enum_identifier),
//       optional(field('type_parameters', $.type_parameters)),
//       optional(field('ability_declarations', $.ability_decls)),
//     ),
//     enum_variants: $ => seq(
//       '{',
//       sepBy(',', $.variant),
//       '}'
//     ),
//     variant: $ => seq(
//       field('variant_name', $._variant_identifier),
//       optional(field('fields', $.datatype_fields)),
//     ),

//     // Struct definitions
//     _struct_item: $ => choice(
//       $.native_struct_definition,
//       $.struct_definition,
//     ),
//     native_struct_definition: $ => seq(
//       optional('public'),
//       'native',
//       $._struct_signature,
//       ';',
//     ),
//     struct_definition: $ => seq(
//       optional('public'),
//       $._struct_signature,
//       field('struct_fields', $.datatype_fields),
//       optional(field('postfix_ability_declarations', $.postfix_ability_decls)),
//     ),
//     field_annotation: $ => seq(
//       field('field', $._field_identifier),
//       ':',
//       field('type', $._type),
//     ),
//     ability_decls: $ => seq(
//       'has',
//       sepBy(',', $.ability),
//     ),
//     postfix_ability_decls: $ => seq(
//       'has',
//       sepBy(',', $.ability),
//       ';',
//     ),

//     _struct_signature: $ => seq(
//       'struct',
//       field('name', $._struct_identifier),
//       optional(field('type_parameters', $.type_parameters)),
//       optional(field('ability_declarations', $.ability_decls)),
//     ),

//     // Function definitions
//     _function_item: $ => choice(
//       $.native_function_definition,
//       $.macro_function_definition,
//       $.function_definition,
//     ),
//     native_function_definition: $ => seq(
//       $._function_signature,
//       ';'
//     ),
//     macro_function_definition: $ => seq(
//       optional($.modifier),
//       'macro',
//       $._macro_signature,
//       field('body', $.block)
//     ),
//     _macro_signature: $ => seq(
//       optional($.modifier),
//       'fun',
//       field('name', $._function_identifier),
//       optional(field('type_parameters', $.type_parameters)),
//       field('parameters', $.function_parameters),
//       optional(field('return_type', $.ret_type)),
//     ),
//     function_definition: $ => seq(
//       $._function_signature,
//       field('body', $.block)
//     ),
//     _function_signature: $ => seq(
//       optional($.modifier),
//       optional($.modifier),
//       optional($.modifier),
//       'fun',
//       field('name', $._function_identifier),
//       optional(field('type_parameters', $.type_parameters)),
//       field('parameters', $.function_parameters),
//       optional(field('return_type', $.ret_type)),
//     ),
//     function_parameters: $ => seq(
//       '(',
//       sepBy(',', choice($.mut_function_parameter, $.function_parameter)),
//       ')',
//     ),

//     // Spec block start
//     spec_block: $ => seq(
//       'spec',
//       choice(
//         seq(optional(field('target', $._spec_block_target)), field('body', $.spec_body)),
//         $._spec_function,
//       )
//     ),
//     _spec_block_target: $ => choice(
//       $.identifier,
//       alias('module', $.spec_block_target_module),
//       $.spec_block_target_schema,
//     ),
//     spec_block_target_fun: $ => seq('fun', $._function_identifier),
//     spec_block_target_struct: $ => seq('struct', $._struct_identifier),
//     spec_block_target_schema: $ => seq(
//       'schema',
//       field('name', $._struct_identifier),
//       optional(field('type_parameters', $.type_parameters)),
//     ),
//     spec_body: $ => seq(
//       '{',
//       repeat($.use_declaration),
//       repeat($._spec_block_memeber),
//       '}'
//     ),
//     _spec_block_memeber: $ => choice(
//       $.spec_invariant,
//       $._spec_function,
//       $.spec_condition,
//       $.spec_include,
//       $.spec_apply,
//       $.spec_pragma,
//       $.spec_variable,
//       $.spec_let,
//     ),
//     spec_let: $ => seq(
//       'let',
//       optional('post'),
//       field('name', $.identifier),
//       '=',
//       field('def', $._expression),
//       ';'
//     ),
//     spec_condition: $ => choice(
//       $._spec_condition,
//       $._spec_abort_if,
//       $._spec_abort_with_or_modifies,
//     ),
//     _spec_condition_kind: $ => choice(
//       'assert',
//       'assume',
//       'decreases',
//       'ensures',
//       'succeeds_if',
//     ),
//     _spec_condition: $ => seq(
//       choice(
//         field('kind', alias($._spec_condition_kind, $.condition_kind)),
//         seq(
//           field('kind', alias('requires', $.condition_kind)),
//           optional('module'),
//         )
//       ),
//       optional(field('condition_properties', $.condition_properties)),
//       field('expr', $._expression),
//       ';'
//     ),
//     _spec_abort_if: $ => seq(
//       field('kind', alias('aborts_if', $.condition_kind)),
//       optional(field('condition_properties', $.condition_properties)),
//       field('expr', $._expression),
//       optional(seq('with', field('additional_exp', $._expression))),
//       ';'
//     ),
//     _spec_abort_with_or_modifies: $ => seq(
//       field('kind', alias(choice(
//         'aborts_with',
//         'modifies'
//       ), $.condition_kind)),
//       optional(field('condition_properties', $.condition_properties)),
//       sepBy1(',', field('additional_exp', $._expression)),
//       ';'
//     ),

//     spec_invariant: $ => seq(
//       field('kind', alias('invariant', $.condition_kind)),
//       optional(field('modifier', alias(choice('update', 'pack', 'unpack', 'module'), $.invariant_modifier))),
//       optional(field('condition_properties', $.condition_properties)),
//       field('expr', $._expression),
//       ';'
//     ),
//     condition_properties: $ => seq('[', sepBy(',', $.spec_property), ']'),
//     spec_include: $ => seq('include', $._expression, ';'),

//     spec_apply: $ => seq(
//       'apply',
//       field('expr', $._expression),
//       'to',
//       sepBy1(',', $.spec_apply_pattern),
//       optional(seq('except', sepBy1(',', $.spec_apply_pattern))),
//       ';'
//     ),
//     spec_apply_pattern: $ => seq(
//       optional(choice('public', 'internal')),
//       field('name_pattern', $.spec_apply_name_pattern),
//       optional(field('type_parameters', $.type_parameters)),
//     ),
//     spec_apply_name_pattern: $ => /[0-9a-zA-Z_*]+/,

//     spec_pragma: $ => seq(
//       'pragma',
//       sepBy(',', $.spec_property),
//       ';'
//     ),
//     spec_property: $ => seq($.identifier, optional(seq('=', $._literal_value))),

//     spec_variable: $ => seq(
//       optional(choice('global', 'local')),
//       field('name', $.identifier),
//       optional(field('type_parameters', $.type_parameters)),
//       ':',
//       field('type', $._type),
//       ';'
//     ),

//     _spec_function: $ => choice(
//       $.native_spec_function,
//       $.usual_spec_function,
//       $.uninterpreted_spec_function,
//     ),

//     uninterpreted_spec_function: $ => seq('fun', $._spec_function_signature, ';'),
//     native_spec_function: $ => seq('native', 'fun', $._spec_function_signature, ';'),
//     usual_spec_function: $ => seq(
//       'fun',
//       $._spec_function_signature,
//       field('body', $.block)
//     ),
//     _spec_function_signature: $ => seq(
//       field('name', $._function_identifier),
//       optional(field('type_parameters', $.type_parameters)),
//       field('parameters', $.function_parameters),
//       field('return_type', $.ret_type),
//     ),

//     // Spec block end


//     // move type grammar
//     _type: $ => choice(
//       $.apply_type,
//       $.ref_type,
//       $.tuple_type,
//       $.function_type,
//       $.primitive_type,
//     ),
//     apply_type: $ => prec.left(PRECEDENCE.apply_type, seq(
//       $.module_access,
//       optional(field('type_arguments', $.type_arguments)),
//     )),
//     ref_type: $ => seq(
//       $._reference,
//       $._type
//     ),
//     tuple_type: $ => seq('(', sepBy(',', $._type), ')'),
//     primitive_type: $ => choice(
//       'u8',
//       'u16',
//       'u32',
//       'u64',
//       'u128',
//       'u256',
//       'bool',
//       'address',
//       'signer',
//       'bytearray',
//     ),
//     ret_type: $ => seq(':', $._type),

//     module_access: $ => choice(
//       // macro variable access
//       seq('$', field('member', $.identifier)),
//       // address access
//       seq('@', field('member', $.identifier)),
//       field('member', alias($._reserved_identifier, $.identifier)),
//       seq(
//         field('member', $.identifier),
//         optional(field('type_arguments', $.type_arguments)),
//       ),
//       seq(
//         field('module', $._module_identifier),
//         optional(field('type_arguments', $.type_arguments)),
//         '::',
//         field('member', $.identifier)
//       ),
//       seq(
//         $.module_identity,
//         optional(field('type_arguments', $.type_arguments)),
//       ),
//       seq(
//         $.module_identity,
//         optional(field('type_arguments', $.type_arguments)),
//         '::',
//         field('member', $.identifier)
//       ),
//       seq(
//         $.module_identity,
//         '::',
//         field('enum_name', $.identifier),
//         optional(field('type_arguments', $.type_arguments)),
//         '::',
//         field('variant', $.identifier)
//       ),
//     ),

//     friend_access: $ => choice(
//       field('local_module', $.identifier),
//       field('fully_qualified_module', $.module_identity),
//     ),

//     macro_module_access: $ => seq(field("access", $.module_access), "!"),

//     module_identity: $ =>
//       seq(
//         field('address', choice($.num_literal, $._module_identifier)),
//         '::',
//         field('module', $._module_identifier)
//       ),

//     type_arguments: $ => seq(
//       '<',
//       sepBy1(',', $._type),
//       '>'
//     ),

//     function_type: $ => seq(
//       field('param_types', $.function_type_parameters),
//       optional(
//         seq(
//           '->',
//           field('return_type', $._type)
//         )
//       )
//     ),
//     function_type_parameters: $ => seq('|', sepBy(',', $._type), '|'),

//     // `mut <function_parameter>`
//     mut_function_parameter: $ => seq(
//       'mut',
//       $.function_parameter,
//     ),

//     // function parameter grammar
//     function_parameter: $ => seq(
//       choice(
//         field('name', $._variable_identifier),
//         seq('$', field('name', $._variable_identifier)),
//       ),
//       ':',
//       field('type', $._type),
//     ),

//     // type parameter grammar
//     type_parameters: $ => seq('<', sepBy1(',', $.type_parameter), '>'),
//     type_parameter: $ => seq(
//       optional('$'),
//       optional('phantom'),
//       $._type_parameter_identifier,
//       optional(seq(':',
//         sepBy1('+', $.ability)
//       ))
//     ),

//     // Block

//     block: $ => seq(
//       '{',
//       repeat($.use_declaration),
//       repeat($.block_item),
//       optional($._expression),
//       '}'
//     ),
//     block_item: $ => seq(
//       choice(
//         $._expression,
//         $.let_statement,
//       ),
//       ';'
//     ),
//     let_statement: $ => seq(
//       'let',
//       field('binds', $.bind_list),
//       optional(seq(':', field('type', $._type))),
//       optional(seq('=', field('expr', $._expression)))
//     ),
//     // Block end


//     // Expression

//     _expression: $ => choice(
//       $.call_expression,
//       $.macro_call_expression,
//       $.lambda_expression,
//       $.if_expression,
//       $.while_expression,
//       $.return_expression,
//       $.abort_expression,
//       $.assign_expression,
//       // unary expression is included in binary_op,
//       $._unary_expression,
//       $.binary_expression,
//       $.cast_expression,
//       $.quantifier_expression,
//       $.match_expression,
//       $.vector_expression,
//       $.loop_expression,
//       $.identified_expression,
//     ),

//     identified_expression: $ => seq(
//       field('expression_id', $.block_identifier),
//       $._expression,
//     ),

//     vector_expression: $ => seq(
//       choice(
//         "vector[",
//         seq(
//           "vector<",
//           sepBy1(',', $._type),
//           '>',
//           '[',
//         )
//       ),
//       sepBy(",", $._expression),
//       "]"
//     ),

//     quantifier_expression: $ => prec.right(seq(
//       choice($._forall, $._exists),
//       $.quantifier_bindings,
//       optional(seq('where', $._expression)),
//       ':',
//       $._expression
//     )),
//     quantifier_bindings: $ => sepBy1(',', $.quantifier_binding),
//     quantifier_binding: $ => choice(
//       seq($.identifier, ':', $._type),
//       seq($.identifier, 'in', $._expression)
//     ),
//     lambda_expression: $ => seq(
//       field('bindings', $.lambda_bindings),
//       optional(seq('->', $._type)),
//       field('expr', $._expression)
//     ),
//     lambda_binding: $ => choice(
//       $.comma_bind_list,
//       field('bind', $._bind),
//       seq(field('bind', $._bind), optional(seq(':', field('ty', $._type)))),
//     ),
//     lambda_bindings: $ => seq(
//       '|',
//       sepBy(',', $.lambda_binding),
//       '|'
//     ),
//     // if-else expression
//     if_expression: $ => prec.right(
//       seq(
//         'if',
//         '(',
//         field('eb', $._expression),
//         ')',
//         field('et', $._expression),
//         optional(seq(
//           'else',
//           field('ef', $._expression)
//         )),
//       )
//     ),

//     // while expression
//     while_expression: $ => seq(
//       'while',
//       '(',
//       field('eb', $._expression),
//       ')',
//       field('body', $._expression),
//     ),

//     // loop expression
//     loop_expression: $ => seq('loop', field('body', $._expression)),

//     // return expression
//     return_expression: $ => prec.left(seq(
//       'return',
//       optional(field('label', $.label)),
//       optional(field('return', $._expression))
//     )),

//     // abort expression
//     abort_expression: $ => seq('abort', optional(field('abort', $._expression))),

//     match_expression: $ => seq(
//       'match',
//       '(',
//       field('match_scrutiny', $._expression),
//       ')',
//       $._match_body,
//     ),

//     _match_body: $ => seq(
//       '{',
//       sepBy(',', $.match_arm),
//       '}',
//     ),

//     match_condition: $ => seq(
//       'if',
//       '(',
//       field('condition', $._expression),
//       ')',
//     ),

//     match_arm: $ => seq(
//       $.bind_list,
//       optional($.match_condition),
//       '=>',
//       $._expression,
//     ),

//     call_expression: $ => prec.dynamic(1, seq(
//       $.name_expression,
//       field('args', $.arg_list),
//     )),
//     macro_call_expression: $ => seq(
//       field('access', $.macro_module_access),
//       optional(field('type_arguments', $.type_arguments)),
//       field('args', $.arg_list),
//     ),
//     pack_expression: $ => seq(
//       $.name_expression,
//       field('body', $.field_initialize_list),
//     ),
//     name_expression: $ => seq(
//       optional('::'),
//       field('access', $.module_access),
//     ),

//     // 指定表达式
//     assign_expression: $ => prec.left(PRECEDENCE.assign,
//       seq(
//         field('lhs', $._unary_expression),
//         '=',
//         field('rhs', $._expression)
//       )
//     ),

//     binary_expression: $ => {
//       const table = [
//         [PRECEDENCE.implies, '==>'],
//         [PRECEDENCE.or, '||'],
//         [PRECEDENCE.and, '&&'],
//         [PRECEDENCE.eq, '=='],
//         [PRECEDENCE.neq, '!='],
//         [PRECEDENCE.lt, '<'],
//         [PRECEDENCE.gt, '>'],
//         [PRECEDENCE.le, '<='],
//         [PRECEDENCE.ge, '>='],
//         [PRECEDENCE.range, '..'],
//         [PRECEDENCE.bitor, '|'],
//         [PRECEDENCE.xor, '^'],
//         [PRECEDENCE.bitand, '&'],
//         [PRECEDENCE.shl, '<<'],
//         [PRECEDENCE.shr, '>>'],
//         [PRECEDENCE.add, '+'],
//         [PRECEDENCE.sub, '-'],
//         [PRECEDENCE.mul, '*'],
//         [PRECEDENCE.div, '/'],
//         [PRECEDENCE.mod, '%']
//       ];

//       let binary_expression = choice(...table.map(
//         ([precedence, operator]) => prec.left(precedence, seq(
//           field('lhs', $._expression),
//           field('operator', alias(operator, $.binary_operator)),
//           field('rhs', $._expression),
//         ))
//       ));

//       return binary_expression;
//     },

//     _unary_expression: $ => prec(10, choice(
//       $.unary_expression,
//       $.borrow_expression,
//       $.dereference_expression,
//       $.move_or_copy_expression,
//       $._expression_term,
//     )),
//     unary_expression: $ => seq(
//       field('op', $.unary_op),
//       field('expr', $._expression)
//     ),
//     unary_op: $ => choice('!'),

//     // dereference
//     dereference_expression: $ => prec.right(PRECEDENCE.unary, seq(
//       '*',
//       field('expr', $._expression),
//     )),
//     // borrow
//     borrow_expression: $ => prec(PRECEDENCE.unary, seq(
//       $._reference,
//       field('expr', $._expression),
//     )),
//     // move or copy
//     move_or_copy_expression: $ => prec(PRECEDENCE.unary, seq(
//       choice('move', 'copy'),
//       field('expr', $._expression),
//     )),

//     _reference: $ => choice(
//       $.imm_ref,
//       $.mut_ref,
//     ),

//     _expression_term: $ => choice(
//       $.call_expression,
//       $.break_expression,
//       $.continue_expression,
//       $.name_expression,
//       $.macro_call_expression,
//       $.pack_expression,
//       $._literal_value,
//       $.unit_expression,
//       $.expression_list,
//       $.annotation_expression,
//       $.block,
//       $.spec_block,
//       $.if_expression,

//       $.dot_expression,
//       $.index_expression,
//       $.vector_expression,
//       $.match_expression,
//     ),
//     break_expression: $ => seq(
//       'break',
//       optional(field('label', $.label)),
//       optional(field('break', $._expression))
//     ),
//     continue_expression: $ => seq(
//       'continue',
//       optional(field('label', $.label)),
//     ),

//     field_initialize_list: $ => seq(
//       '{',
//       sepBy(',', $.exp_field),
//       '}'
//     ),

//     arg_list: $ => seq(
//       '(',
//       sepBy(',', $._expression),
//       ')'
//     ),

//     expression_list: $ => seq('(', sepBy1(',', $._expression), ')'),
//     unit_expression: $ => seq('(', ')'),
//     cast_expression: $ => prec.left(PRECEDENCE.as, seq(
//       field('expr', $._expression),
//       'as',
//       field('ty', $._type),
//     )),
//     annotation_expression: $ => seq(
//       '(',
//       field('expr', $._expression),
//       ':',
//       field('ty', $._type),
//       ')'
//     ),


//     dot_expression: $ => prec.left(PRECEDENCE.field, seq(
//       field('expr', $._expression_term),
//       '.',
//       field('access', $._expression_term),
//     )),
//     index_expression: $ => prec.left(PRECEDENCE.call, seq(
//       field('expr',
//         $._expression_term,
//       ),
//       '[', sepBy(',', field('idx', $._expression)), ']'
//     )),

//     // Expression end

//     // Fields and Bindings
//     exp_field: $ => seq(
//       field('field', $._field_identifier),
//       optional(seq(
//         ':',
//         field('expr', $._expression)
//       ))
//     ),

//     bind_list: $ => choice(
//       $._bind,
//       $.comma_bind_list,
//       $.or_bind_list,
//     ),
//     at_bind: $ => seq($._variable_identifier, '@', $.bind_list),
//     comma_bind_list: $ => seq('(', sepBy(',', $._bind), ')'),
//     or_bind_list: $ => seq(optional('('), sepBy1('|', seq(optional('('), $._bind, optional(')'))), optional(')')),

//     mut_bind_var: $ => seq(
//       'mut',
//       alias($._variable_identifier, $.bind_var),
//     ),

//     _bind: $ => choice(
//       choice(
//         $.mut_bind_var,
//         alias($._variable_identifier, $.bind_var)
//       ),
//       $.bind_unpack,
//       $.at_bind,
//       $._literal_value,
//     ),
//     bind_unpack: $ => seq(
//       $.name_expression,
//       optional(field('bind_fields', $.bind_fields)),
//     ),
//     bind_fields: $ => choice(
//       $.bind_positional_fields,
//       $.bind_named_fields,
//     ),
//     _spread_operator: _$ => '..',
//     bind_positional_fields: $ => seq(
//       '(', sepBy(',', choice($.bind_field, $.mut_bind_field)), ')'
//     ),
//     bind_named_fields: $ => seq(
//       '{', sepBy(',', choice($.bind_field, $.mut_bind_field)), '}'
//     ),

//     mut_bind_field: $ => seq(
//       'mut',
//       $.bind_field,
//     ),

//     bind_field: $ => choice(seq(
//       field('field', $.bind_list), // direct bind
//       optional(seq(
//         ':',
//         field('bind', $.bind_list)
//       ))
//     ), $._spread_operator),
//     // Fields and Bindings - End

//     // literals
//     _literal_value: $ => choice(
//       $.address_literal,
//       $.bool_literal,
//       $.num_literal,
//       $.hex_string_literal,
//       $.byte_string_literal,
//       // $.vector_literal,
//     ),

//     imm_ref: $ => '&',
//     mut_ref: $ => seq('&', 'mut'),
//     block_identifier: $ => seq($.label, ':'),
//     label: $ => seq('\'', $.identifier),
//     address_literal: $ => /@(0x[a-fA-F0-9]+|[0-9]+)/,
//     bool_literal: $ => choice('true', 'false'),
//     num_literal: $ => choice(/[0-9][0-9_]*(?:u8|u16|u32|u64|u128|u256)?/, /0x[a-fA-F0-9_]+/),
//     hex_string_literal: $ => /x"[0-9a-fA-F]*"/,
//     byte_string_literal: $ => /b"(\\.|[^\\"])*"/,
//     _module_identifier: $ => alias($.identifier, $.module_identifier),
//     _struct_identifier: $ => alias($.identifier, $.struct_identifier),
//     _enum_identifier: $ => alias($.identifier, $.enum_identifier),
//     _variant_identifier: $ => alias($.identifier, $.variant_identifier),
//     _function_identifier: $ => alias($.identifier, $.function_identifier),
//     _variable_identifier: $ => alias($.identifier, $.variable_identifier),
//     _field_identifier: $ => alias($.identifier, $.field_identifier),
//     _type_identifier: $ => alias($.identifier, $.type_identifier),
//     _type_parameter_identifier: $ => alias($.identifier, $.type_parameter_identifier),
//     identifier: $ => /(`)?[a-zA-Z_][0-9a-zA-Z_]*(`)?/,
//     macro_identifier: $ => /[a-zA-Z_][0-9a-zA-Z_]*!/,
//     _reserved_identifier: $ => choice($._forall, $._exists),

//     _forall: $ => 'forall',
//     _exists: $ => 'exists',
//     line_comment: $ => token(seq(
//       '//', /.*/
//     )),
//     newline: $ => token(/\n/),
//     _whitespace: $ => /\s/,
//     // http://stackoverflow.com/questions/13014947/regex-to-match-a-c-style-multiline-comment/36328890#36328890
//     block_comment: $ => token(seq(
//       '/*',
//       /[^*]*\*+([^/*][^*]*\*+)*/,
//       '/'
//     ))
//   }
// });

// //      (<rule> 'sep')* <rule>?
// // Note that this allows an optional trailing `sep`.
// function sepBy(sep, rule) {
//   return seq(repeat(seq(rule, sep)), optional(rule));
// }
// function sepBy1(sep, rule) {
//   return seq(rule, repeat(seq(sep, rule)), optional(sep));
// }