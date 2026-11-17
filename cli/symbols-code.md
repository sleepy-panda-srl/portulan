# C# and Python outlines

`node cli/symbols.mjs path/to/File.cs path/to/module.py` prints declarations with
inclusive `start-end` line ranges, including single-line declarations as `N-N`.
Pass a range directly to the local runner's `--lines`. `--find Class.member`
searches tracked files only and retains immediate-owner lookup semantics.
Extensionless Python scripts are recognized from a Python shebang.

These are bounded lexical outlines, with no compiler or Python runtime dependency.
They locate declarations rather than type-checking or proving valid syntax.
Malformed literals, unmatched brackets and unbounded declarations refuse with a
file-qualified error and exit 2. Unsupported files suggest a bounded `rg -n`
declaration search. A refusal never asks the caller to read the whole file.

C# follows the [member declaration shapes](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/classes)
and [literal forms](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/lexical-structure):
block/file-scoped namespaces, classes, structs, interfaces, records, enums and
delegates; constructors, finalizers, methods, fields, events, properties, indexers,
operators and conversions. Attributes open the span. Generic constraints, tuple
returns, expression bodies, constructor/object/collection/property initializers
and lambda-valued fields stay within their declaration. Accessors stay inside the
property/event; local functions stay inside the method. Multiple field declarators
share one complete declaration span and expose all their names to `--find`.
Enums expose each named value. Explicit-interface methods use their member name.
Escaped C# identifiers use names without the leading `@` for lookup.
Same-line siblings have disjoint source offsets even when their line ranges touch;
selecting either whole line necessarily includes its neighbor.

Comments and regular, verbatim and raw literals hide declaration-shaped text.
Interpolation is scanned lexically, not evaluated. `#region` and nonconditional
directives do not create symbols. Conditional compilation (`#if`/`#elif`/`#else`/
`#endif`) explicitly refuses: inactive source can be lexically invalid. Use a
preprocessed source view for an outline or a bounded declaration search on the
original. Top-level executable statements and unrecognized declarations refuse.

Python follows [3.14 lexical structure](https://docs.python.org/3.14/reference/lexical_analysis.html)
and [definition suites](https://docs.python.org/3.14/reference/compound_stmts.html):
`class`, `def`, `async def`, nested definitions and decorators. Bracket and explicit
backslash continuations form logical statements; indentation determines the end.
Blank/comment lines do not open definitions, while string-only bodies do occupy
their suites. Prefixes, escaped/triple literals and interpolation hide false
declarations; a UTF-8 BOM is ignored at the start. Tabs use eight-column stops; inconsistent dedents and ambiguous
tab/space spellings refuse. Definitions inside `if`/`try` suites remain under their
enclosing definition, if any, rather than a preceding sibling. This is not a full
Python grammar validator; novel or ambiguous syntax may require declaration search.

Fixtures in `symbols-code.test.mjs` assert complete original-source slices and
consume their ranges through the production runner parser, including CRLF and EOF
without a newline. Existing live checks still compile JavaScript and shell spans;
they do not claim C# or Python compilation. No language runtime is required by CI.
