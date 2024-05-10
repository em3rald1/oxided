# Oxided
Oxided is a programming with its main target being [URCL](https://github.com/ModPunchtree/URCL). 

> [!CAUTION]
> This project is NOT maintained.

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

## Usage

Firstly, clone the repository and install the dependencies:

```sh
$ git clone https://github.com/em3rald1/oxided
$ cd oxided
$ npm i
```

Next, write some code:

```
fn main() void {
    let x = 5;
}
```

And compile it:

```sh
$ ts-node index.ts --file "<your file>" --outfile "<output file>" --regs <amount of registers, default is 8>
```