# Oxided

Oxided will be a programming language with a couple of the features such as lifetimes (at least a bit close to them) being taken from Rust.
It will be a (poorly optimized) compiled language with it's main target being URCL.

## Syntax example

```
include "file.ox";

fn main(argc word, argv *str) word {
    let x word = 5;
    let y str = "hello world";
    printf("%s", str);
    return 0;
}
```

## TODO

- Compiler
- Imports

## Currently implemented features

- Lexer / tokenizer
- Parser into AST
- Typechecker with verbose error messages