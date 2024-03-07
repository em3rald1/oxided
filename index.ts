import Compiler from "./compiler-ts/compiler";
import Parser from "./parser-ts/parser";
import tokenize from "./lexer-ts/lexer";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { readFileSync, writeFileSync } from "fs";
import Typechecker from "./typechecker-ts/typechecker";

function main() {
    const argv = yargs(hideBin(process.argv))
        .usage('Usage: $0 --file [filename] --outfile [filename] --regs [registers amount]')
        .demandOption(['file'])
        .default('outfile', 'a.out.urcl')
        .default('regs', 8)
        .parseSync();
    const src = readFileSync(argv.file as string, 'utf-8');
    const tokens = tokenize(src);
    const parser = new Parser(src, tokens);
    const ast = parser.parse();
    const typechecker = new Typechecker(src, ast);
    const tc_error = typechecker.validate();
    if (tc_error.is_some()) return;
    const compiler = new Compiler(src, ast, argv.regs);
    const code = compiler.compile();
    if (!code) return;
    writeFileSync(argv.outfile, code);
}

main();