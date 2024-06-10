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

    _statement: ($) => choice($.unification, $.predicate, $._block_statement),

    _block_statement: ($) => choice(
      $.timeline_statement,
      $.when_statement,
      $.match_statement,
      $.with_statement,
      $.typedef_statement,
    ),

    timeline_statement: ($) => seq("timeline", optional($.identifier), ':', $._suite),

    when_statement: ($) => seq("when", $.expression, ":", $._suite),

    match_statement: ($) => seq("match", $.expression, ":", $._match_suite),

    _match_suite: ($) => choice(
      seq($._indent, $.match_block),
      alias($._newline, $.match_block)
    ),

    match_block: ($) => repeat1($.match_case),

    match_case: ($) => seq("case", $.expression, ":", $._suite),

    with_statement: ($) => seq("with", $.expression, ":", $._suite),

    typedef_statement: ($) => seq($.identifier, "::", $.type_definition),

    type_definition: ($) => choice(
      // $.type_union,
      // $.type_intersection,
      $.binary_type_operator,
      $.type_object,
      $.type_list,
      // $.type_dictionary,
      $.type_identifier,
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
        [prec.left, '<<', PREC.shift],
        [prec.left, '>>', PREC.shift],
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
        [prec.left, '<<', PREC.shift],
        [prec.left, '>>', PREC.shift],
      ];

      // @ts-ignore
      return choice(...table.map(([fn, operator, precedence]) => fn(precedence, seq(
        field('left', $.primary_expression),
        // @ts-ignore
        field('operator', operator),
        field('right', $.primary_expression),
      ))));
    },


    unification: ($) =>
      seq($.expression, "=", choice($.expression, $.predicate_definition)),

    identifier: (_) => /[_\p{XID_Start}][_\p{XID_Continue}]*/,

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

    argument_list: ($) =>
      seq(
        "(",
        optional(
          commaSep1(
            choice(
              $.expression,
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

    keyword_argument: ($) =>
      seq(
        field("name", choice($.identifier, $.keyword_identifier)),
        "=",
        field("value", $.expression)
      ),

    predicate_definition: ($) =>
      seq(
        "(",
        // list of arguments
        optional(commaSep1($.identifier)),
        ")",
        "=>",
        $._suite
      ),

    predicate: ($) =>
      seq(
        $.primary_expression,
        // list of expressions
        $.argument_list,
      ),

    block: ($) => seq(repeat($._statement), $._dedent),


    // Expressions

    expression: ($) => choice($.primary_expression),

    primary_expression: ($) =>
      choice(
        $.identifier,
        $.keyword_identifier,
        $.string,
        $.number,
        $.list,
        $.dictionary,
        $.attribute
        // $.parenthesized_expression
      ),

      attribute: $ => prec(PREC.call, seq(
        field('object', $.primary_expression),
        '.',
        field('attribute', $.identifier),
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

    list: ($) =>
      seq(
        "[",
        optional(commaSep1($.expression)),
        optional(","),
        "]"
      ),

    dictionary: ($) =>
      seq(
        "{",
        optional(commaSep1($.key_value_pair)),
        optional(","),
        "}"
      ),

    key_value_pair: ($) => seq($.expression, ":", $.expression),

    // parenthesized_expression: ($) =>
    //   prec(
    //     1,
    //     seq("(", $.expression, ")")
    //   ),

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
