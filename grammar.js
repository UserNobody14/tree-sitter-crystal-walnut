// TODO: define rules for:
// - comments
// - string interpolation (?)
// - timeline
// - when/match
// - objects
// - either/and
// - type defs?

const PREC = {
  // this resolves a conflict between the usage of ':' in a lambda vs in a
  // typed parameter. In the case of a lambda, we don't allow typed parameters.
  lambda: -2,
  typed_parameter: -1,
  conditional: -1,

  parenthesized_expression: 1,
  parenthesized_list_splat: 1,
  or: 10,
  and: 11,
  coalesce: 12,
  not: 12,
  compare: 13,
  bitwise_or: 14,
  bitwise_and: 15,
  xor: 16,
  shift: 17,
  plus: 18,
  times: 19,
  unary: 20,
  power: 21,
  call: 22,
};

module.exports = grammar({
  name: "cwal",

  extras: $ => [
    $.comment,
    /[\s\f\uFEFF\u2060\u200B]|\r?\n/,
    $.line_continuation,
  ],

  externals: ($) => [
    $._newline,
    $._indent,
    $._dedent,
    $.string_start,
    $._string_content,
    $.escape_interpolation,
    $.string_end,

    // Mark comments as external tokens so that the external scanner is always
    // invoked, even if no external token is expected. This allows for better
    // error recovery, because the external scanner can maintain the overall
    // structure by returning dedent tokens whenever a dedent occurs, even
    // if no dedent is expected.
    $.comment,

    // Allow the external scanner to check for the validity of closing brackets
    // so that it can avoid returning dedent tokens between brackets.
    "]",
    ")",
    "}",
    "except",
  ],

  rules: {
    // source_file: $ => 'hello',
    module: ($) => repeat($._statement),

    _suite: ($) =>
      choice(
        // alias($._simple_statements, $.block),
        seq($._indent, $.block),
        alias($._newline, $.block)
      ),

    _simple_statement: ($) => choice($.unification, $.predicate,
      $.statement_binary_operator,
      $.typedef_statement,
      $.type_assignment_statement,
    ),
    _statement: ($) => choice(
      // $.statement_binary_operator,
      // $.unification,
      // $.predicate,
      $._simple_statement,
      $._block_statement
    ),

    _block_statement: ($) => choice(
      $.data_statement,
      $.timeline_statement,
      $.when_statement,
      $.match_statement,
      $.with_statement,
      // $.typedef_statement,
      $.all_statement,
      $.either_statement,
      $.for_control_statement,
      $.test_statement,
      $.fresh_statement,
    ),

    _data_statement_head: ($) => seq("data", $.identifier, ":"),
    data_statement: ($) => seq($._data_statement_head, $._suite),

    _timeline_statement_head: ($) => seq("timeline", optional($.identifier), ':'),
    timeline_statement: ($) => seq($._timeline_statement_head,$._suite),

    _when_statement_head: ($) => seq("when", $.predicate, ":"),
    when_statement: ($) => seq($._when_statement_head,$._suite),

    match_statement: ($) => seq("match", $.expression, ":", $._match_suite),

    control_type: ($) => choice(
      'all',
      'any',
    ),

    _for_control_statement_head: ($) => seq(
      "for",
      field("control_type", $.control_type),
      field("variable", $.destructuring_expression),
      "in",
      field("iterable", $.expression),
      ":",
    ),
    for_control_statement: ($) => seq($._for_control_statement_head, $._suite),
    _fresh_statement_head: ($) => seq("fresh",
      field("is_nominal", optional("nominal")),
      field("variables", commaSep1($.identifier)), ":"),
    fresh_statement: ($) => seq($._fresh_statement_head, $._suite),

    /// Other important statement types to play around with

    // Encodes nominal logic programming (?)
    // nominal_statement: ($) => seq("nominal", commaSep1($.expression), ":", $._suite),

    ///

    _match_suite: ($) => choice(
      seq($._indent, $.match_block),
      alias($._newline, $.match_block)
    ),

    match_block: ($) => repeat1($.match_case),
    match_case: ($) => seq("case", $.expression, ":", $._suite),

    _with_statement_head: ($) => seq("with", $.predicate, ":"),
    with_statement: ($) => seq($._with_statement_head, $._suite),

    _all_statement_head: ($) => seq("all", ":"),
    all_statement: ($) => seq($._all_statement_head, $._suite),

    _either_statement_head: ($) => seq("either", ":"),
    either_statement: ($) => seq($._either_statement_head, $._suite),

    _test_statement_head: ($) => seq("test", optional($.identifier), ":"),
    test_statement: ($) => seq($._test_statement_head, $._suite),


    statement_head: ($) => choice(
      field("data", alias($._data_statement_head, $.data_statement)),
      field("timeline", alias($._timeline_statement_head, $.timeline_statement)),
      field("when", alias($._when_statement_head, $.when_statement)),
      field("with", alias($._with_statement_head, $.with_statement)),
      field("all", alias($._all_statement_head, $.all_statement)),
      field("either", alias($._either_statement_head, $.either_statement)),
      field("for", alias($._for_control_statement_head, $.for_control_statement)),
      field("test", alias($._test_statement_head, $.test_statement)),
      field("fresh", alias($._fresh_statement_head, $.fresh_statement)),
    ),

    _sameline_block: ($) => choice(
      $._simple_statement,
      seq(optional($.statement_head), $._suite),
    ),

    // Assigns a type definition to a variable
    type_assignment_statement: ($) => seq("type", $.identifier, optional(
      seq(
        "<",
        commaSep1($.type_definition),
        ">"
      )
    ), "=", $.type_definition),
    // Assigns a variable to an already defined type
    typedef_statement: ($) => seq($.identifier, "::", $.type_definition),

    type_definition: ($) => choice(
      $.binary_type_operator,
      $.type_object,
      $.type_list,
      $.type_application,
    ),

    type_application: ($) => seq(
      alias($.identifier, $.type_identifier),
      optional(
        seq(
          "<",
          commaSep1($.type_definition),
          ">"
        )
      )
  ),



    // type_union: ($) => seq($.type_definition, "|", $.type_definition),
    // type_union: ($) => prec.left(
    //   PREC.type_union,
    //   seq(
    //     $.
    //   )
    // )

    // type_intersection: ($) => seq($.type_definition, "&", $.type_definition),

    type_object: ($) => seq("{", optional(commaSep1($.type_key_value_pair)), "}"),

    type_key_value_pair: ($) => seq($.identifier, ":", $.type_definition),

    type_list: ($) => seq("[", $.type_definition, "]"),

    // type_dictionary: ($) => seq("{", $.type_definition, ":", $.type_definition, "}"),

    type_identifier: ($) => $.identifier,


    binary_type_operator: $ => {
      const table = [
        [prec.left, '+', PREC.plus],
        [prec.left, '-', PREC.plus],
        [prec.left, '*', PREC.times],
        [prec.left, '@', PREC.times],
        [prec.left, '/', PREC.times],
        [prec.left, '%', PREC.times],
        [prec.left, '//', PREC.times],
        [prec.right, '**', PREC.power],
        [prec.left, '|', PREC.bitwise_or],
        [prec.left, '&', PREC.bitwise_and],
        [prec.left, '^', PREC.xor],
        // [prec.left, '<<', PREC.shift],
        // [prec.left, '>>', PREC.shift],
      ];

      // @ts-ignore
      return choice(...table.map(([fn, operator, precedence]) => fn(precedence, seq(
        field('left', $._primary_type_expression),
        // @ts-ignore
        field('operator', operator),
        field('right', $._primary_type_expression),
      ))));
    },

    _primary_type_expression: ($) =>
      choice(
        $.type_identifier,
        $.type_object,
        $.type_list,
        // $.type_dictionary,
      ),


    binary_operator: $ => {
      const table = [
        [prec.left, '||', PREC.or],
        [prec.left, '&&', PREC.and],
        [prec.left, '??', PREC.coalesce],
        [prec.left, '+', PREC.plus],
        [prec.left, '-', PREC.plus],
        [prec.left, '*', PREC.times],
        [prec.left, '@', PREC.times],
        [prec.left, '/', PREC.times],
        [prec.left, '%', PREC.times],
        [prec.left, '//', PREC.times],
        [prec.right, '**', PREC.power],
        // TODO: make || and && act as conj/disj on the var level (?)
        [prec.left, '|', PREC.bitwise_or],
        [prec.left, '&', PREC.bitwise_and],
        [prec.left, '^', PREC.xor],
      ];

      // @ts-ignore
      return choice(...table.map(([fn, operator, precedence]) => fn(precedence, seq(
        field('left', $.expression),
        // @ts-ignore
        field('operator', operator),
        field('right', $.expression),
      ))));
    },


    statement_binary_operator: $ => {
      const table = [
        // [prec.left, '+', PREC.plus],
        // [prec.left, '-', PREC.plus],
        // [prec.left, '*', PREC.times],
        // [prec.left, '@', PREC.times],
        // [prec.left, '/', PREC.times],
        // [prec.left, '%', PREC.times],
        // [prec.left, '//', PREC.times],
        // [prec.right, '**', PREC.power],
        // TODO: make | and & above unification, and act as conj/disj
        [prec.left, 'and', PREC.and],
        [prec.left, 'or', PREC.or],
        // [prec.left, '^', PREC.xor],
      ];

      // @ts-ignore
      return choice(...table.map(([fn, operator, precedence]) => fn(precedence, seq(
        field('left', $._simple_statement),
        // @ts-ignore
        field('operator', operator),
        field('right', $._simple_statement),
      ))));
    },



    unification: ($) =>
      seq(
        field("lhs", $.expression),
        field("operator", choice("=", "==", "!=", "<<", ">>")),
        field("rhs",
          choice($.expression, $.predicate_definition)
        )
      ),

    identifier: (_) => /[_\p{XID_Start}][_\p{XID_Continue}]*/,

    destructuring_expression: ($) => choice(
      $.identifier,
      $.parenthesized_destructuring_expression,
      $.list,
      $.dictionary
    ),

    parenthesized_destructuring_expression: ($) => seq("(", $.destructuring_expression, ")"),

    keyword_identifier: ($) =>
      choice(
        prec(
          -3,
          alias(
            choice("print", "exec", "async", "await", "match"),
            $.identifier
          )
        ),
        alias("type", $.identifier)
      ),

    unary_operator: ($) =>
      seq(
        field("operator",
        choice("not", "try", "import", "env", "file", "url", "linear"),

        ),
        field("operand", $.expression)
      ),

    argument_list: ($) =>
      seq(
        "(",
        optional(
          commaSep1(
            choice(
              $.expression,
              $.splat,
              // $.list_splat,
              // $.dictionary_splat,
              // alias($.parenthesized_list_splat, $.parenthesized_expression),
              $.keyword_argument
            )
          )
        ),
        optional(","),
        ")"
      ),

    splat: ($) => seq("...", choice($.primary_expression, $.parenthesized_expression)),

    keyword_argument: ($) =>
      seq(
        field("name", choice($.identifier, $.keyword_identifier)),
        "=",
        field("value", $.expression)
      ),

    argument_definition: ($) => seq($.destructuring_expression, optional(seq(":", $.type_definition)), ),

    predicate_definition: ($) =>
      seq(
        "(",
        // list of arguments
        field("arguments", commaSep1($.argument_definition)),
        optional(
          seq(
            ",",
            field("default_args", commaSep1($.keyword_argument))
          )
        ),
        optional(
          seq(
            ",",
            field("rest_args", $.splat)
          )
        ),
        ")",
        field("determinacy",
        optional($.type_definition)),
        "=>",
        // This allows the user to (optionally) start the statement on the same line
        field("body", $._sameline_block),
      ),

    predicate: ($) =>
      seq(
        $.primary_expression,
        // list of expressions
        $.argument_list,
      ),

    block: ($) => seq(repeat($._statement), $._dedent),


    // Expressions

    expression: ($) => choice($.binary_operator, $.unary_operator, $.primary_expression),

    primary_expression: ($) =>
      choice(
        $.identifier,
        $.keyword_identifier,
        $.string,
        $.number,
        $.boolean,
        $.null,
        $.list,
        $.dictionary,
        $.attribute,
        $.slice,
        // $.parenthesized_expression
      ),

      attribute: $ => prec(PREC.call, seq(
        field('object', $.primary_expression),
        '.',
        field('attribute', $.identifier),
      )),

    slice: $ => prec(PREC.call, seq(
      field('object', $.primary_expression),
      '[',
      field('slice',
        commaSep1(
          choice(
            $.expression,
            $.splat
          )
        ),
      ),
      optional(","),
      ']',
    )),


    string: ($) =>
      seq(
        $.string_start,
        // repeat(choice($.escape_sequence, $.string_content)),
        repeat($.string_content),
        $.string_end
      ),

    string_content: $ => prec.right(repeat1(
        choice(
          $.escape_interpolation,
          $.escape_sequence,
          $._not_escape_sequence,
          $._string_content,
        ))),

    number: (_) => /\d+/,

    boolean: (_) => choice("true", "false"),

    null: (_) => "null",

    list: ($) =>
      seq(
        "[",
        optional(commaSep1(
          choice(
            $.expression,
            $.splat
          )
        )),
        optional(","),
        "]"
      ),

    dictionary: ($) =>
      seq(
        "{",
        optional(
          commaSep1(
            choice(
              $.key_value_pair,
              $.splat,
              $.identifier
            )
        )),
        optional(","),
        "}"
      ),

    key_value_pair: ($) => seq($.expression, ":", $.expression),

    parenthesized_expression: ($) => seq("(", $.expression, ")"),

    escape_sequence: _ => token.immediate(prec(1, seq(
      '\\',
      choice(
        /u[a-fA-F\d]{4}/,
        /U[a-fA-F\d]{8}/,
        /x[a-fA-F\d]{2}/,
        /\d{3}/,
        /\r?\n/,
        /['"abfrntv\\]/,
        /N\{[^}]+\}/,
      ),
    ))),
    _not_escape_sequence: _ => token.immediate('\\'),

    line_continuation: _ => token(seq('\\', choice(seq(optional('\r'), '\n'), '\0'))),
    comment: _ => token(seq(choice(
      '#', '//'
    ), /.*/)),
  },
});


/**
 * Creates a rule to match one or more of the rules separated by a comma
 *
 * @param {RuleOrLiteral} rule
 *
 * @return {SeqRule}
 *
 */
function commaSep1(rule) {
  return sep1(rule, ',');
}

/**
 * Creates a rule to match one or more occurrences of `rule` separated by `sep`
 *
 * @param {RuleOrLiteral} rule
 *
 * @param {RuleOrLiteral} separator
 *
 * @return {SeqRule}
 *
 */
function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}
