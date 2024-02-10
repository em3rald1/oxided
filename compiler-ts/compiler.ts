import * as AST from "../parser-ts/ast";
import Scope from './scope';
import { Option, Some, None } from "../util-ts/option";
import { Result, Ok, Err } from '../util-ts/result';
import { LiteralValue, Value, RegisterValue, ValueType } from './value';
import { CompilerType, PointerType, PrimitiveType, ZeroType } from "./type";
import _ from "lodash";

type CompilerErr = { position: [number, number], message: string };
type CompilerValue = { type: CompilerType, value: Value };
type FunctionType = { name: string, parameters: [CompilerType, string][], return_type: CompilerType };

const OPERATOR_MAP = {
    '+': 'ADD',
    '-': 'SUB',
    '*': 'MLT',
    '/': 'DIV',
    '%': 'MOD',
    '>>': 'BSR',
    '<<': 'BSL',
    '&': 'AND',
    '|': 'OR',
    '^': 'XOR',

    '==': 'SETE',
    '>=': 'SETGE',
    '<=': 'SETLE',
    '>': 'SETG',
    '<': 'SETL',
    '!=': 'SETNE'
}

const FREE = true, USED = false;

export default class Compiler {
    src: string[];
    ast: AST.Program;
    types: Map<string, CompilerType>;
    fns: Map<string, FunctionType>;

    registers: boolean[];
    constructor(src: string, ast: AST.Program, registers = 8) {
        this.src = src.split("\n");
        this.ast = ast;
        this.types = new Map();
        this.fns = new Map();
        this.registers = new Array(registers).fill(FREE);

        this.types.set('word', new PrimitiveType('word'));
        this.types.set('uword', new PrimitiveType('uword'));
        this.types.set('bool', new PrimitiveType('bool'));
        this.types.set('void', new ZeroType());
    }

    reg_alloc(): Option<number> {
        const index = this.registers.indexOf(FREE);
        if(index == -1) return new None;
        this.registers[index] = USED;
        return new Some(index + 3);
    }

    reg_free(index: number): void {
        this.registers[index - 3] = FREE;
    }

    reg_free_all(): void {
        this.registers.fill(FREE);
    }

    compile() {
        const starting_code = `BITS 32\nMINREG ${this.registers.length + 3}\nMINHEAP 0xffff\nMINSTACK 0xffff\nMOV R2 M0\n`;
        const scope = new Scope();
        for(const stmt of this.ast.body) {
            const _value = this.compile_stmt(scope, stmt);
            if(_value.is_some()) return this.log_error(_value.unwrap());
            this.reg_free_all();
        }
        return starting_code + scope.code;
    }

    compile_stmt(scope: Scope, stmt: AST.Stmt): Option<CompilerErr> {
        if(stmt instanceof AST.VarDecl) return this.compile_var_decl(scope, stmt);
        else if(stmt instanceof AST.FnDecl) return this.compile_fn_decl(scope, stmt);
        return this.compile_expr(scope, stmt).err();
    }

    compile_fn_decl(scope: Scope, stmt: AST.FnDecl): Option<CompilerErr> {
        if(stmt.extern) {
            const parameters: [CompilerType, string][] = [];
            for(let i = 0; i < stmt.parameters.length; i++) {
                const param_name = stmt.parameters[i][1];
                const _param_type = this.to_type(stmt.parameters[i][0]);
                if(_param_type.is_none()) return new Some({ position: stmt.parameters[i][0].position, message: `Type doesn't exist` });
                const param_type = _param_type.unwrap();

                parameters.push([param_type, param_name]);
            }
            const _return_type = this.to_type(stmt.return_type);
            if(_return_type.is_none()) return new Some({ position: stmt.return_type.position, message: `Type doesn't exist` });
            const return_type = _return_type.unwrap();

            this.fns.set(stmt.name, { name: stmt.name, parameters, return_type });
            return new None;
        } else return new Some({ position: stmt.position, message: "Non-extern functions are not supported" });
    }

    compile_var_decl(scope: Scope, stmt: AST.VarDecl): Option<CompilerErr> {
        if(scope.var_has(stmt.name)) return new Some({ position: stmt.position, message: `Variable ${stmt.name} already exists`});
        if(stmt.value.is_some()) {
            const _value = this.compile_expr(scope, stmt.value.unwrap());
            if(_value.is_err()) return _value.err();
            const value = _value.unwrap();
            if(value.value.get_value_type() == ValueType.LVALUE) {
                scope.code += `LOD ${value.value.compile()} ${value.value.compile()}\n`;
            }
            const offset = scope.var_new(stmt.name, value.type).unwrap();
            scope.code += `LSTR R2 -${offset} ${value.value.compile()}\n`;
        } else {
            const _type = this.to_type(stmt.value_type.unwrap());
            if(_type.is_none()) return new Some({ position: stmt.value_type.unwrap().position, message: `Couldn't reconstruct a type` });
            const type = _type.unwrap();
            scope.var_new(stmt.name, type);
        }
        return new None;
    }

    compile_expr(scope: Scope, expr: AST.Expr): Result<CompilerValue, CompilerErr> {
        return this.compile_bin_expr(scope, expr);
    }

    compile_boolean_expr(scope: Scope, expr: AST.Expr): Result<CompilerValue, CompilerErr> {
        if(expr instanceof AST.BinExpr && ['&&', '||'].includes(expr.operator)) {
            const _left = this.compile_bin_expr(scope, expr.left);
            if(_left.is_err()) return _left;
            const left = _left.unwrap();

            const _right = this.compile_bin_expr(scope, expr.right);
            if(_right.is_err()) return _right;
            const right = _right.unwrap();

            switch(expr.operator) {
                case '&&': {
                    if(left.value.get_value_type() == ValueType.LVALUE)
                        scope.code += `LOD ${left.value.compile()} ${left.value.compile()}\n`;
                    if(right.value.get_value_type() == ValueType.LVALUE) 
                        scope.code += `LOD ${right.value.compile()} ${right.value.compile()}\n`;
                    const _register = this.reg_alloc();
                    if(_register.is_none()) return new Err({ position: expr.position, message: `Cannot allocate a register` });
                    const register = _register.unwrap();
                    scope.code += `SETG R${register} ${left.value.compile()} 0\nSETGE R${register} R${register} ${right.value.compile()}\n`;
                    return new Ok({ type: _.cloneDeep(left.type), value: new RegisterValue(register, ValueType.RVALUE)});
                }
                case '||': {
                    if(left.value.get_value_type() == ValueType.LVALUE)
                        scope.code += `LOD ${left.value.compile()} ${left.value.compile()}\n`;
                    if(right.value.get_value_type() == ValueType.LVALUE) 
                        scope.code += `LOD ${right.value.compile()} ${right.value.compile()}\n`;
                    const _register = this.reg_alloc();
                    if(_register.is_none()) return new Err({ position: expr.position, message: `Cannot allocate a register` });
                    const register = _register.unwrap();
                    scope.code += `OR R${register} ${left.value.compile()} ${right.value.compile()}\n`;
                    return new Ok({ type: _.cloneDeep(left.type), value: new RegisterValue(register, ValueType.RVALUE ) });
                }
            }
        } else return this.compile_comparison(scope, expr);
    }

    compile_comparison(scope: Scope, expr: AST.Expr): Result<CompilerValue, CompilerErr> {
        if(expr instanceof AST.CompExpr) {
            const _left = this.compile_bin_expr(scope, expr.left);
            if(_left.is_err()) return _left;
            const left = _left.unwrap();
            if(left.value.get_value_type() == ValueType.LVALUE) {
                scope.code += `LOD ${left.value.compile()} ${left.value.compile()}\n`;
            }

            const _right = this.compile_bin_expr(scope, expr.right);
            if(_right.is_err()) return _right;
            const right = _right.unwrap();
            if(right.value.get_value_type() == ValueType.LVALUE) {
                scope.code += `LOD ${right.value.compile()} ${right.value.compile()}\n`;
            }

            
            const _register = this.reg_alloc();
            if(_register.is_none()) return new Err({ position: expr.position, message: `Cannot allocate a register` });
            const register = _register.unwrap();

            scope.code += `${OPERATOR_MAP[expr.operator]} R${register} ${left.value.compile()} ${right.value.compile()}\n`;

            return new Ok({ type: this.types.get("bool"), value: new RegisterValue(register, ValueType.RVALUE) });
        
        } else return this.compile_bin_expr(scope, expr);
    }

    compile_bin_expr(scope: Scope, expr: AST.Expr): Result<CompilerValue, CompilerErr> {
        if(expr instanceof AST.BinExpr) {
            const _left = this.compile_bin_expr(scope, expr.left);
            if(_left.is_err()) return _left;
            const left = _left.unwrap();

            const _right = this.compile_bin_expr(scope, expr.right);
            if(_right.is_err()) return _right;
            const right = _right.unwrap();

            switch(expr.operator) {
                case '>>':
                case '<<': 
                case '+':
                case '-':
                case '&':
                case '|':
                case '^':
                case '/':
                case '*':
                case '%': {
                    if(left.value.get_value_type() == ValueType.LVALUE)
                        scope.code += `LOD ${left.value.compile()} ${left.value.compile()}\n`;
                    if(right.value.get_value_type() == ValueType.LVALUE) 
                        scope.code += `LOD ${right.value.compile()} ${right.value.compile()}\n`;
                    const _register = this.reg_alloc();
                    if(_register.is_none()) return new Err({ position: expr.position, message: `Cannot allocate a register` });
                    const register = _register.unwrap();
                    scope.code += `${OPERATOR_MAP[expr.operator]} R${register} ${left.value.compile()} ${right.value.compile()}\n`;
                    return new Ok({ type: _.cloneDeep(left.type), value: new RegisterValue(register, ValueType.RVALUE) });
                }
                case '&&': {
                    if(left.value.get_value_type() == ValueType.LVALUE)
                        scope.code += `LOD ${left.value.compile()} ${left.value.compile()}\n`;
                    if(right.value.get_value_type() == ValueType.LVALUE) 
                        scope.code += `LOD ${right.value.compile()} ${right.value.compile()}\n`;
                    const _register = this.reg_alloc();
                    if(_register.is_none()) return new Err({ position: expr.position, message: `Cannot allocate a register` });
                    const register = _register.unwrap();
                    scope.code += `SETG R${register} ${left.value.compile()} 0\nSETGE R${register} R${register} ${right.value.compile()}\n`;
                    return new Ok({ type: _.cloneDeep(left.type), value: new RegisterValue(register, ValueType.RVALUE)});
                }
                case '||': {
                    if(left.value.get_value_type() == ValueType.LVALUE)
                        scope.code += `LOD ${left.value.compile()} ${left.value.compile()}\n`;
                    if(right.value.get_value_type() == ValueType.LVALUE) 
                        scope.code += `LOD ${right.value.compile()} ${right.value.compile()}\n`;
                    const _register = this.reg_alloc();
                    if(_register.is_none()) return new Err({ position: expr.position, message: `Cannot allocate a register` });
                    const register = _register.unwrap();
                    scope.code += `OR R${register} ${left.value.compile()} ${right.value.compile()}\n`;
                    return new Ok({ type: _.cloneDeep(left.type), value: new RegisterValue(register, ValueType.RVALUE ) });
                }
                default: new Err({ position: expr.position, message: `Unknown operator: ${expr.operator}` });
            }
        } else return this.compile_cast_expr(scope, expr);
    }

    compile_cast_expr(scope: Scope, expr: AST.Expr): Result<CompilerValue, CompilerErr> {
        if(expr instanceof AST.CastExpr) {
            const _type = this.to_type(expr.value_type);
            if(_type.is_none()) return new Err({ position: expr.value_type.position, message: `Type doesn't exist`});
            const type = _type.unwrap();
            const _value = this.compile_unary_expr(scope, expr.operand);
            if(_value.is_err()) return _value;
            const value = _value.unwrap();
            return new Ok({ type, value: value.value });
        } else return this.compile_unary_expr(scope, expr);
    }

    compile_unary_expr(scope: Scope, expr: AST.Expr): Result<CompilerValue, CompilerErr> {
        if(expr instanceof AST.UnaryExpr) {
            const _operand = this.compile_call_expr(scope, expr.operand);
            if(_operand.is_err()) return _operand;
            const operand = _operand.unwrap();
            switch(expr.operator) {
                case '-': {
                    if(operand.value.get_value_type() == ValueType.LVALUE) scope.code += `LOD ${operand.value.compile()} ${operand.value.compile()}\n`;
                    const _register = this.reg_alloc();
                    if(_register.is_none()) return new Err({ position: expr.position, message: `Compiler Error: Couldn't allocate a register`});
                    const register = _register.unwrap();
                    scope.code += `NEG R${register} ${operand.value.compile()}\n`;
                    return new Ok({ type: _.cloneDeep(operand.type), value: new RegisterValue(register, ValueType.RVALUE) });
                }
                case '*': {
                    if(operand.value.get_value_type() == ValueType.LVALUE) scope.code += `LOD ${operand.value.compile()} ${operand.value.compile()}\n`;
                    let n_type = _.cloneDeep(operand.type);
                    if(!(n_type instanceof PointerType)) return new Err({ position: expr.operand.position, message: `Compiler Error: UNARYEXPR` });
                    n_type.pointers -= 1;
                    if(n_type.pointers == 0) n_type = n_type.type;
                    const value = _.cloneDeep(operand.value);
                    if(value instanceof RegisterValue) value.value_type = ValueType.RVALUE;
                    return new Ok({ type: n_type, value: value });
                }
                case '&': {
                    if(operand.value.get_value_type() != ValueType.LVALUE) return new Err({ position: expr.position, message: `Compiler Error: UNARYEXPR2` });
                    const value = _.cloneDeep(operand.value);
                    if(value instanceof RegisterValue) value.value_type = ValueType.RVALUE;
                    let n_type = _.cloneDeep(operand.type);
                    if(!(n_type instanceof PointerType)) n_type = new PointerType<typeof n_type>(n_type, 1);
                    else n_type.pointers += 1;
                    return new Ok({ type: n_type, value });
                }
                case '!': {
                    if(operand.value.get_value_type() == ValueType.LVALUE) scope.code += `LOD ${operand.value.compile()} ${operand.value.compile()}\n`;
                    const _register = this.reg_alloc();
                    if(_register.is_none()) return new Err({ position: expr.position, message: `Compiler Error: Couldn't allocate a register`});
                    const register = _register.unwrap();

                    scope.code += `SETE R${register} ${operand.value.compile()} 0\n`;

                    return new Ok({ type: this.types.get("bool")!, value: new RegisterValue(register, ValueType.RVALUE) });
                }
                default: return new Err({ position: expr.position, message: `Compiler Error: UNARYEXPR3` });
            }
        } else return this.compile_call_expr(scope, expr);
    }

    compile_call_expr(scope: Scope, expr: AST.Expr): Result<CompilerValue, CompilerErr> {
        if(expr instanceof AST.CallExpr) {
            if(!(expr.callee instanceof AST.LitExpr)) return new Err({ position: expr.position, message: `Callee cannot be a non-string value` });
            if(expr.callee.value_type != 'identifier') return new Err({ position: expr.position, message: `Callee cannot be a non-string value` });
            const callee = expr.callee.value;
            if(!this.fns.has(callee)) return new Err({ position: expr.position, message: `Function ${callee} doesn't exist` });
            const fn = this.fns.get(callee)!;
            if(expr.args.length != fn.parameters.length) return new Err({ position: expr.position, message: `Function ${callee} accepts ${fn.parameters.length}, got ${expr.args.length}` });
            for(let i = 0; i < fn.parameters.length; i++) {
                const param = fn.parameters[i];
                const _arg = this.compile_expr(scope, expr.args[i]);
                if(_arg.is_err()) return _arg;
                const arg = _arg.unwrap();
                if(arg.value.get_value_type() == ValueType.LVALUE) {
                    scope.code += `LOD ${arg.value.compile()} ${arg.value.compile()}\n`;
                }
                scope.code += `PSH ${arg.value.compile()}\n`;
            }
            scope.code += `CAL .${callee}\n`;
            return new Ok({ type: _.cloneDeep(fn.return_type), value: new RegisterValue(1, ValueType.RVALUE) });
        } else return this.compile_member_expr(scope, expr);
    }

    compile_member_expr(scope: Scope, expr: AST.Expr): Result<CompilerValue, CompilerErr> {
        if(expr instanceof AST.MemberExpr) {
            const _object = this.compile_literal(scope, expr.object);
            if(_object.is_err()) return _object;
            const object = _object.unwrap();
            if(expr.computed) {
                if(object.value.get_value_type() == ValueType.LVALUE) {
                    scope.code += `LOD ${object.value.compile()} ${object.value.compile()}\n`;
                }
                if(typeof expr.property == 'string') return new Err({ position: expr.position, message: `Compiler error: MEMBEREXPR1` });
                const _property = this.compile_expr(scope, expr.property);
                if(_property.is_err()) return _property;
                const property = _property.unwrap();
                if(property.value.get_value_type() == ValueType.LVALUE) {
                    scope.code += `LOD ${property.value.compile()} ${property.value.compile()}\n`;
                }
                const _register = this.reg_alloc();
                if(_register.is_none()) return new Err({ position: expr.position, message: `Couldn't reconstruct a type` });
                const register = _register.unwrap();
                scope.code += `ADD R${register} ${object.value.compile()} ${property.value.compile()}\n`;
                let n_type = _.cloneDeep(object.type);
                if(!(n_type instanceof PointerType)) return new Err({ position: expr.position, message: `Compiler error: MEMBEREXPRNPTR` });
                n_type.pointers -= 1;
                if(n_type.pointers == 0) n_type = n_type.type;
                return new Ok({ type: _.cloneDeep(n_type), value: new RegisterValue(register, ValueType.LVALUE) });
            } else {
                return new Err({ position: expr.position, message: `Compiler error: MEMBEREXPR2` });
            }
        } else return this.compile_literal(scope, expr);
    }

    compile_literal(scope: Scope, expr: AST.Expr): Result<CompilerValue, CompilerErr> {
        if(expr instanceof AST.LitExpr) {
            switch(expr.value_type) {
                case 'number': {
                    return new Ok({ type: this.types.get("word")!, value: new LiteralValue(parseInt(expr.value)) });
                }
                case 'string': {
                    return new Err({ position: expr.position, message: `String is not supported yet` });
                }
                case 'boolean': {
                    return new Ok({ type: this.types.get("bool")!, value: new LiteralValue(expr.value == 'true' ? 1 : 0) });
                }
                case 'identifier': {
                    if(!scope.var_has(expr.value)) return new Err({ position: expr.position, message: `Variable ${expr.value} doesn't exist` });
                    
                    const [[type, offset], depth] = scope.var_get(expr.value).unwrap();
                    if(depth > 0) return new Err({ position: expr.position, message: `WIP OUTER IDENT LOGIC` });
                    
                    const _register = this.reg_alloc();
                    if(_register.is_none()) return new Err({ position: expr.position, message: `No register left for allocation` });
                    const reg = _register.unwrap();
                    
                    scope.code += `SUB R${reg} R2 ${offset}\n`;
                    
                    return new Ok({ type, value: new RegisterValue(reg, ValueType.LVALUE) });
                }
                default: return new Err({ position: expr.position, message: `COMPILERERR: LITERALTYPE` });
            }
        } else return new Err({ position: expr.position, message: `COMPILERERR: LITERAL` });
    }

    to_type(expr: AST.TypeExpr): Option<CompilerType> {
        let type = _.cloneDeep(this.types.get(expr.name));
        if(!type) return new None;
        if(expr.pointers > 0) {
            type = new PointerType<typeof type>(type, expr.pointers);
        }
        return new Some(type);
    }
    log_error(error: CompilerErr): void {
        console.log(error);
        const line = error.position[1];
        const src_line = this.src[line - 1].replace(/\t/g, ' ');
        console.log(`${line}: ${src_line}`);
        const offset = line.toString().length + error.position[0];
        console.log(`${' '.repeat(offset)}^ ${error.message}`);
    }
}