# Oxided
Oxided is a programming with its main target being [URCL](https://github.com/ModPunchtree/URCL). 

> [!CAUTION]
> This project is in very stages of development. Not all the features are working properly at this point in time. And if they do work, they are most likely not optimized

## 📖 Syntax example
Simple hello world:
```
import "std"; # import statement (no support yet)
fn main(argc word, argv *str) word { # a function with a word return type (URCL is word-addressed assembly, which means there cannot be any other way to represent primitive data other than a word)
    let y str = "hello world"; # variable definition
    printf("%s\n", str); # function call
    return 0; # return statement
}
```

## 📜 Goals in the near future for this project

- Full compiler support
- Allow for recursive code
- AST Folding
- Assembly optimization