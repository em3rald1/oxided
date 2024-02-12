import * as AST from "../parser-ts/ast";
import Scope from './scope';
import { Option, Some, None } from "../util-ts/option";
import { Result, Ok, Err } from '../util-ts/result';
import { LiteralValue, Value, RegisterValue, ValueType, LabelValue } from './value';
import { CompilerType, PointerType, PrimitiveType, ZeroType, FunctionType, StructType } from "./type";
import _ from "lodash";

type CompilerErr = { position: [number, number], message: string };
type CompilerValue = { type: CompilerType, value: Value };
//

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

    state: {
        while_loops: number,
        if_stmts: number
    };

    registers: boolean[];
    constructor(src: string, ast: AST.Program, registers = 8) {
        this.src = src.split("\n");
        this.ast = ast;
        this.types = new Map();
        this.fns = new Map();
        this.registers = new Array(registers).fill(FREE);

        this.state = { while_loops: 0, if_stmts: 0 };

        this.types.set('word', new PrimitiveType('word'));
        this.types.set('uword', new PrimitiveType('uword'));
        this.types.set('bool', new PrimitiveType('bool'));
        this.types.set('void', new ZeroType());
        this.types.set('str', new PointerType(this.types.get('uword')!, 1));
    }

    reg_alloc(): Option<number> {
        const index = this.registers.indexOf(FREE);
        if (index == -1) return new None;
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
        const scope = new Scope('start');
        for (const stmt of this.ast.body) {
            const _value = this.compile_stmt(scope, stmt);
            if (_value.is_some()) return this.log_error(_value.unwrap());
        }
        if (!this.fns.has('main')) this.log_error({ position: [0, 0], message: `Function main doesn't exist` });
        return starting_code + scope.code + 'CAL .oxided_main\nHLT\n';
    }

    compile_stmt(scope: Scope, stmt: AST.Stmt): Option<CompilerErr> {

        this.reg_free_all();

        if (stmt instanceof AST.VarDecl) return this.compile_var_decl(scope, stmt);
        else if (stmt instanceof AST.FnDecl) return this.compile_fn_decl(scope, stmt);
        else if (stmt instanceof AST.WhileStmt) return this.compile_while_stmt(scope, stmt);
        else if (stmt instanceof AST.ReturnStmt) return this.compile_return_stmt(scope, stmt);
        else if (stmt instanceof AST.IfStmt) return this.compile_if_stmt(scope, stmt);
        else if (stmt instanceof AST.BreakStmt) return this.compile_break_stmt(scope, stmt);
        else if (stmt instanceof AST.StructDecl) return this.compile_struct_stmt(scope, stmt);
        return this.compile_expr(scope, stmt).err();
    }

    compile_struct_stmt(scope: Scope, stmt: AST.StructDecl): Option<CompilerErr> {
        if (scope.name != 'start') return new Some({ position: stmt.position, message: `Cannot declare a structure outside of global scope` });
        let properties: [CompilerType, string][] = [];
        // let type = new StructType(stmt.name, []);
        for (let i = 0; i < stmt.properties.length; i++) {
            const _prop_type = this.to_type(stmt.properties[i][0]);
            if (_prop_type.is_none()) return new Some({ position: stmt.properties[i][0].position, message: `Cannot reconstruct the type` });
            const prop_type = _prop_type.unwrap();
            properties.push([prop_type, stmt.properties[i][1]]);
        }
        const type = new StructType(stmt.name, properties);
        this.types.set(stmt.name, type);
        return new None;
    }

    compile_break_stmt(scope: Scope, stmt: AST.BreakStmt): Option<CompilerErr> {
        if (scope.name == 'start') return new Some({ position: stmt.position, message: `Cannot use break statement in a global scope` });

        let current_scope = scope;

        while (!current_scope.name.endsWith('.while')) {
            if (current_scope.name == 'start') return new Some({ position: stmt.position, message: `Cannot use break statement outside of while statement` });
            current_scope = current_scope.parent.unwrap();
        }

        scope.code += `JMP .oxided_while_${current_scope.value.unwrap()}_end\n`;
    }

    compile_if_stmt(scope: Scope, stmt: AST.IfStmt): Option<CompilerErr> {
        if (scope.name == 'start') return new Some({ position: stmt.position, message: `Cannot use conditional logic in a global scope` });

        const _condition = this.compile_expr(scope, stmt.condition);
        if (_condition.is_err()) return _condition.err();
        const condition = _condition.unwrap();

        const current_if = ++this.state.if_stmts;

        if (stmt.elsebody.is_some()) {
            scope.code += `BRZ .oxided_if_${current_if}_else ${condition.value.compile()}\n`;

            const n_scope = new Scope('if', scope);
            const _err = this.compile_block(n_scope, stmt.body);
            if (_err.is_some()) return _err;
            scope.code += n_scope.code;

            scope.code += `JMP .oxided_if_${current_if}_end\n`;
            scope.code += `.oxided_if_${current_if}_else\n`;

            const elsebody = stmt.elsebody.unwrap();
            if (elsebody instanceof AST.Block) {
                const else_block = new Scope('else', scope);
                const _err = this.compile_block(else_block, elsebody);
                if (_err.is_some()) return _err;
            } else {
                const _err = this.compile_if_stmt(scope, elsebody);
                if (_err.is_some()) return _err;
            }
            scope.code += `.oxided_if_${current_if}_end\n`;
        } else {
            scope.code += `BRZ .oxided_if_${current_if}_end ${condition.value.compile()}\n`;

            const n_scope = new Scope('if', scope);
            const _err = this.compile_block(n_scope, stmt.body);
            if (_err.is_some()) return _err;
            scope.code += n_scope.code;
            scope.code += `.oxided_if_${current_if}_end\n`;

        }

        return new None;
    }

    compile_return_stmt(scope: Scope, stmt: AST.ReturnStmt): Option<CompilerErr> {
        let current_scope = scope;
        if (stmt.value.is_some()) {
            const _value = this.compile_expr(scope, stmt.value.unwrap());
            if (_value.is_err()) return _value.err();
            let value = _value.unwrap();

            if (value.value.get_value_type() == ValueType.LVALUE) {
                scope.code += `LOD ${value.value.compile()} ${value.value.compile()}\n`;
                value = this.to_rvalue(value);
            }


            while (!current_scope.name.endsWith(".fn")) {
                if (current_scope.parent.is_none()) return new Some({ position: stmt.position, message: `Cannot return from a non-function` });
                current_scope = current_scope.parent.unwrap();
                if (current_scope.name.endsWith(".while"))
                    scope.code += `LOD R2 R2\n`;
            }

            scope.code += `MOV R1 ${value.value.compile()}\n`;
        } else {
            while (!current_scope.name.endsWith(".fn")) {
                if (current_scope.parent.is_none()) return new Some({ position: stmt.position, message: `Cannot return from a non-function` });
                current_scope = current_scope.parent.unwrap();
                scope.code += `LOD R2 R2\n`;
            }
        }

        scope.code += `RET\n`;

        return new None;

    }

    compile_while_stmt(scope: Scope, stmt: AST.WhileStmt): Option<CompilerErr> {
        if (scope.name == 'start') return new Some({ position: stmt.position, message: `Cannot use a while statement outside of a function` });

        const n_scope = new Scope('while', scope, (++this.state.while_loops).toString());
        n_scope.code += `.oxided_while_${this.state.while_loops}\n`;

        const _scope_reg = this.reg_alloc();
        if (_scope_reg.is_none()) return new Some({ position: stmt.position, message: `Cannot allocate a register` });
        const scope_reg = _scope_reg.unwrap();

        n_scope.code += `MOV R${scope_reg} R2\n`;
        n_scope.code += `ADD R2 R2 ${scope.top}\n`;
        n_scope.code += `STR R2 R${scope_reg}\n`;

        this.reg_free(scope_reg);

        let current_loop = this.state.while_loops;

        const _condition = this.compile_expr(n_scope, stmt.condition);
        if (_condition.is_err()) return _condition.err();
        let condition = _condition.unwrap();

        if (condition.value.get_value_type() == ValueType.LVALUE) {
            n_scope.code += `LOD ${condition.value.compile()} ${condition.value.compile()}\n`;
            condition = this.to_rvalue(condition);
        }

        n_scope.code += `BRZ .oxided_while_${current_loop}_end ${condition.value.compile()}\n`;

        this.compile_block(n_scope, stmt.body);

        n_scope.code += `LOD R2 R2\n`;
        n_scope.code += `JMP .oxided_while_${current_loop}\n`;
        n_scope.code += `.oxided_while_${current_loop}_end\n`;
        n_scope.code += `LOD R2 R2\n`;

        scope.code += n_scope.code;
        return new None;
    }

    compile_fn_decl(scope: Scope, stmt: AST.FnDecl): Option<CompilerErr> {

        if (scope.name != 'start') return new Some({ position: stmt.position, message: `Functions cannot be inside of a block` });

        const parameters: [CompilerType, string][] = [];
        for (let i = 0; i < stmt.parameters.length; i++) {
            const param_name = stmt.parameters[i][1];
            const _param_type = this.to_type(stmt.parameters[i][0]);
            if (_param_type.is_none()) return new Some({ position: stmt.parameters[i][0].position, message: `Type doesn't exist` });
            const param_type = _param_type.unwrap();

            parameters.push([param_type, param_name]);
        }
        const _return_type = this.to_type(stmt.return_type);
        if (_return_type.is_none()) return new Some({ position: stmt.return_type.position, message: `Type doesn't exist` });
        const return_type = _return_type.unwrap();

        if (stmt.extern) {
            this.fns.set(stmt.name, { name: stmt.name, parameters, return_type } as FunctionType);
            return new None;
        } else {
            this.fns.set(stmt.name, { name: stmt.name, parameters, return_type } as FunctionType);
            const n_scope = new Scope('fn', scope);
            n_scope.code += `JMP .oxided_${stmt.name}_end\n`;
            n_scope.code += `.oxided_${stmt.name}\n`;

            const _return_reg = this.reg_alloc();
            if (_return_reg.is_none()) return new Some({ position: stmt.position, message: `Cannot allocate a register` });
            const return_reg = _return_reg.unwrap();

            n_scope.code += `POP R${return_reg}\n`;

            const r_parameters = [...parameters].reverse();

            const _param_reg = this.reg_alloc();
            if (_param_reg.is_none()) return new Some({ position: stmt.position, message: `Cannot allocate a register` });
            const param_reg = _param_reg.unwrap();
            for (let i = 0; i < parameters.length; i++) {
                const param = r_parameters[i];
                if (param[0].get_size() > 1) return new Some({ position: stmt.position, message: `Cannot use non-primitive or non-pointer types as a parameters` });
                if (param[0].get_size() == 0) continue;
                const _offset = n_scope.var_new(param[1], param[0]);
                if (_offset.is_none()) return new Some({ position: stmt.position, message: `Variable ${param[1]} already exists` });
                const offset = _offset.unwrap();
                n_scope.code += `POP R${param_reg}\n`;
                n_scope.code += `LSTR R2 ${offset} R${param_reg}\n`;
            }
            this.reg_free(param_reg);
            n_scope.code += `PSH R${return_reg}\n`;
            this.reg_free(return_reg);

            n_scope.code += `// BODY\n`;

            const _err = this.compile_block(n_scope, stmt.body.unwrap());
            if (_err.is_some()) return _err;

            n_scope.code += `// END OF BODY\n`;

            // n_scope.code += `.oxided_${stmt.name}_return\n`;
            n_scope.code += `RET\n`;
            n_scope.code += `.oxided_${stmt.name}_end\n`;
            scope.code += n_scope.code;

            return new None;
        }
    }

    compile_block(scope: Scope, stmt: AST.Block): Option<CompilerErr> {
        for (const innerStmt of stmt.body) {
            const _err = this.compile_stmt(scope, innerStmt);
            if (_err.is_some()) return _err;
        }
        return new None;
    }

    compile_var_decl(scope: Scope, stmt: AST.VarDecl): Option<CompilerErr> {
        if (scope.var_has(stmt.name)) return new Some({ position: stmt.position, message: `Variable ${stmt.name} already exists` });
        if (stmt.value.is_some()) {
            const _value = this.compile_expr(scope, stmt.value.unwrap(), true);
            if (_value.is_err()) return _value.err();
            const value = _value.unwrap();
            if (value.value.get_value_type() == ValueType.LVALUE) {
                scope.code += `LOD ${value.value.compile()} ${value.value.compile()}\n`;
            }
            const offset = scope.var_new(stmt.name, value.type).unwrap();
            scope.code += `LSTR R2 ${offset} ${value.value.compile()}\n`;
        } else {
            const _type = this.to_type(stmt.value_type.unwrap());
            if (_type.is_none()) return new Some({ position: stmt.value_type.unwrap().position, message: `Couldn't reconstruct a type` });
            const type = _type.unwrap();
            scope.var_new(stmt.name, type);
        }
        return new None;
    }

    compile_expr(scope: Scope, expr: AST.Expr, ignore = false): Result<CompilerValue, CompilerErr> {
        if (scope.name == 'start' && !ignore) return new Err({ position: expr.position, message: `Cannot use expression statements in the global scope` });
        return this.compile_assignment_expr(scope, expr);
    }

    compile_assignment_expr(scope: Scope, expr: AST.Expr): Result<CompilerValue, CompilerErr> {
        if (expr instanceof AST.AssignExpr) {
            const _value = this.compile_assignment_expr(scope, expr.value);
            if (_value.is_err()) return _value;
            let value = _value.unwrap();
            if (value.value.get_value_type() == ValueType.LVALUE) {
                value = this.to_rvalue(value);
                scope.code += `LOD ${value.value.compile()} ${value.value.compile()}\n`;
            }

            const _dest = this.compile_boolean_expr(scope, expr.assignee);
            if (_dest.is_err()) return _dest;
            const dest = _dest.unwrap();

            let set_value = value;

            if (expr.operator != '=') {
                const _op_reg = this.reg_alloc();
                if (_op_reg.is_none()) return new Err({ position: expr.position, message: `Cannot allocate a register` });
                const op_reg = _op_reg.unwrap();
                scope.code += `LOD R${op_reg} ${dest.value.compile()}\n`;
                scope.code += `${OPERATOR_MAP[expr.operator.slice(0, -1)]} R${op_reg} R${op_reg} ${value.value.compile()}\n`;
                set_value = { value: new RegisterValue(op_reg, ValueType.RVALUE), type: value.type };
            }

            scope.code += `STR ${dest.value.compile()} ${set_value.value.compile()}\n`;

            return new Ok(set_value);
        } else return this.compile_boolean_expr(scope, expr);
    }

    compile_boolean_expr(scope: Scope, expr: AST.Expr): Result<CompilerValue, CompilerErr> {
        if (expr instanceof AST.BinExpr && ['&&', '||'].includes(expr.operator)) {
            const _left = this.compile_expr(scope, expr.left);
            if (_left.is_err()) return _left;
            let left = _left.unwrap();

            const _right = this.compile_expr(scope, expr.right);
            if (_right.is_err()) return _right;
            let right = _right.unwrap();

            if (left.value.get_value_type() == ValueType.LVALUE) {
                left = this.to_rvalue(left);
                scope.code += `LOD ${left.value.compile()} ${left.value.compile()}\n`;
            }
            if (right.value.get_value_type() == ValueType.LVALUE) {
                right = this.to_rvalue(right);
                scope.code += `LOD ${right.value.compile()} ${right.value.compile()}\n`;
            }

            switch (expr.operator) {
                case '&&': {
                    const _register = this.reg_alloc();
                    if (_register.is_none()) return new Err({ position: expr.position, message: `Cannot allocate a register` });
                    const register = _register.unwrap();
                    scope.code += `SETG R${register} ${left.value.compile()} 0\nSETGE R${register} R${register} ${right.value.compile()}\n`;
                    return new Ok({ type: _.cloneDeep(left.type), value: new RegisterValue(register, ValueType.RVALUE) });
                }
                case '||': {
                    const _register = this.reg_alloc();
                    if (_register.is_none()) return new Err({ position: expr.position, message: `Cannot allocate a register` });
                    const register = _register.unwrap();
                    scope.code += `OR R${register} ${left.value.compile()} ${right.value.compile()}\n`;
                    return new Ok({ type: _.cloneDeep(left.type), value: new RegisterValue(register, ValueType.RVALUE) });
                }
            }
        } else return this.compile_comparison(scope, expr);
    }

    compile_comparison(scope: Scope, expr: AST.Expr): Result<CompilerValue, CompilerErr> {
        if (expr instanceof AST.CompExpr) {
            const _left = this.compile_bin_expr(scope, expr.left);
            if (_left.is_err()) return _left;
            let left = _left.unwrap();
            if (left.value.get_value_type() == ValueType.LVALUE) {
                left = this.to_rvalue(left);
                scope.code += `LOD ${left.value.compile()} ${left.value.compile()}\n`;
            }

            const _right = this.compile_bin_expr(scope, expr.right);
            if (_right.is_err()) return _right;
            let right = _right.unwrap();
            if (right.value.get_value_type() == ValueType.LVALUE) {
                right = this.to_rvalue(right);
                scope.code += `LOD ${right.value.compile()} ${right.value.compile()}\n`;
            }


            const _register = this.reg_alloc();
            if (_register.is_none()) return new Err({ position: expr.position, message: `Cannot allocate a register` });
            const register = _register.unwrap();

            scope.code += `${OPERATOR_MAP[expr.operator]} R${register} ${left.value.compile()} ${right.value.compile()}\n`;

            return new Ok({ type: this.types.get("bool"), value: new RegisterValue(register, ValueType.RVALUE) });

        } else return this.compile_bin_expr(scope, expr);
    }

    compile_bin_expr(scope: Scope, expr: AST.Expr): Result<CompilerValue, CompilerErr> {
        if (expr instanceof AST.BinExpr) {
            const _left = this.compile_bin_expr(scope, expr.left);
            if (_left.is_err()) return _left;
            let left = _left.unwrap();

            const _right = this.compile_bin_expr(scope, expr.right);
            if (_right.is_err()) return _right;
            let right = _right.unwrap();

            if (left.value.get_value_type() == ValueType.LVALUE) {
                left = this.to_rvalue(left);
                scope.code += `LOD ${left.value.compile()} ${left.value.compile()}\n`;
            }
            if (right.value.get_value_type() == ValueType.LVALUE) {
                right = this.to_rvalue(right);
                scope.code += `LOD ${right.value.compile()} ${right.value.compile()}\n`;
            }

            switch (expr.operator) {
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
                    const _register = this.reg_alloc();
                    if (_register.is_none()) return new Err({ position: expr.position, message: `Cannot allocate a register` });
                    const register = _register.unwrap();
                    scope.code += `${OPERATOR_MAP[expr.operator]} R${register} ${left.value.compile()} ${right.value.compile()}\n`;
                    return new Ok({ type: _.cloneDeep(left.type), value: new RegisterValue(register, ValueType.RVALUE) });
                }
                case '&&': {
                    const _register = this.reg_alloc();
                    if (_register.is_none()) return new Err({ position: expr.position, message: `Cannot allocate a register` });
                    const register = _register.unwrap();
                    scope.code += `SETG R${register} ${left.value.compile()} 0\nSETGE R${register} R${register} ${right.value.compile()}\n`;
                    return new Ok({ type: _.cloneDeep(left.type), value: new RegisterValue(register, ValueType.RVALUE) });
                }
                case '||': {
                    const _register = this.reg_alloc();
                    if (_register.is_none()) return new Err({ position: expr.position, message: `Cannot allocate a register` });
                    const register = _register.unwrap();
                    scope.code += `OR R${register} ${left.value.compile()} ${right.value.compile()}\n`;
                    return new Ok({ type: _.cloneDeep(left.type), value: new RegisterValue(register, ValueType.RVALUE) });
                }
                default: new Err({ position: expr.position, message: `Unknown operator: ${expr.operator}` });
            }
        } else return this.compile_cast_expr(scope, expr);
    }

    compile_cast_expr(scope: Scope, expr: AST.Expr): Result<CompilerValue, CompilerErr> {
        if (expr instanceof AST.CastExpr) {
            const _type = this.to_type(expr.value_type);
            if (_type.is_none()) return new Err({ position: expr.value_type.position, message: `Type doesn't exist` });
            const type = _type.unwrap();
            const _value = this.compile_unary_expr(scope, expr.operand);
            if (_value.is_err()) return _value;
            const value = _value.unwrap();
            return new Ok({ type, value: value.value });
        } else return this.compile_unary_expr(scope, expr);
    }

    compile_unary_expr(scope: Scope, expr: AST.Expr): Result<CompilerValue, CompilerErr> {
        if (expr instanceof AST.UnaryExpr) {
            const _operand = this.compile_call_expr(scope, expr.operand);
            if (_operand.is_err()) return _operand;
            let operand = _operand.unwrap();
            switch (expr.operator) {
                case '-': {
                    if (operand.value.get_value_type() == ValueType.LVALUE) {
                        operand = this.to_rvalue(operand);
                        scope.code += `LOD ${operand.value.compile()} ${operand.value.compile()}\n`;
                    }
                    const _register = this.reg_alloc();
                    if (_register.is_none()) return new Err({ position: expr.position, message: `Compiler Error: Couldn't allocate a register` });
                    const register = _register.unwrap();
                    scope.code += `NEG R${register} ${operand.value.compile()}\n`;
                    return new Ok({ type: _.cloneDeep(operand.type), value: new RegisterValue(register, ValueType.RVALUE) });
                }
                case '*': {
                    if (operand.value.get_value_type() == ValueType.LVALUE) {
                        operand = this.to_rvalue(operand);
                        scope.code += `LOD ${operand.value.compile()} ${operand.value.compile()}\n`;
                    }
                    let n_type = _.cloneDeep(operand.type);
                    if (!(n_type instanceof PointerType)) return new Err({ position: expr.operand.position, message: `Compiler Error: UNARYEXPR` });
                    n_type.pointers -= 1;
                    if (n_type.pointers == 0) n_type = n_type.type;
                    const value = _.cloneDeep(operand.value);
                    if (value instanceof RegisterValue) value.value_type = ValueType.RVALUE;
                    return new Ok({ type: n_type, value: value });
                }
                case '&': {
                    if (operand.value.get_value_type() != ValueType.LVALUE) return new Err({ position: expr.position, message: `Compiler Error: UNARYEXPR2` });
                    const value = _.cloneDeep(operand.value);
                    if (value instanceof RegisterValue) value.value_type = ValueType.RVALUE;
                    let n_type = _.cloneDeep(operand.type);
                    if (!(n_type instanceof PointerType)) n_type = new PointerType<typeof n_type>(n_type, 1);
                    else n_type.pointers += 1;
                    return new Ok({ type: n_type, value });
                }
                case '!': {
                    if (operand.value.get_value_type() == ValueType.LVALUE) {
                        operand = this.to_rvalue(operand);
                        scope.code += `LOD ${operand.value.compile()} ${operand.value.compile()}\n`;
                    }
                    const _register = this.reg_alloc();
                    if (_register.is_none()) return new Err({ position: expr.position, message: `Compiler Error: Couldn't allocate a register` });
                    const register = _register.unwrap();

                    scope.code += `SETE R${register} ${operand.value.compile()} 0\n`;

                    return new Ok({ type: this.types.get("bool")!, value: new RegisterValue(register, ValueType.RVALUE) });
                }
                default: return new Err({ position: expr.position, message: `Compiler Error: UNARYEXPR3` });
            }
        } else return this.compile_call_expr(scope, expr);
    }

    compile_call_expr(scope: Scope, expr: AST.Expr): Result<CompilerValue, CompilerErr> {
        if (expr instanceof AST.CallExpr) {
            const used_registers = [...this.registers];


            for (let i = 0; i < used_registers.length; i++) {
                if (used_registers[i] == USED) {
                    scope.code += `PSH R${i + 3}\n`;
                    this.registers[i] = FREE;
                }
            }
            if (!(expr.callee instanceof AST.LitExpr)) return new Err({ position: expr.position, message: `Callee cannot be a non-string value` });
            if (expr.callee.value_type != 'identifier') return new Err({ position: expr.position, message: `Callee cannot be a non-string value` });
            const callee = expr.callee.value;
            if (!this.fns.has(callee)) return new Err({ position: expr.position, message: `Function ${callee} doesn't exist` });
            const fn = this.fns.get(callee)!;
            if (expr.args.length != fn.parameters.length) return new Err({ position: expr.position, message: `Function ${callee} accepts ${fn.parameters.length}, got ${expr.args.length}` });
            for (let i = 0; i < fn.parameters.length; i++) {
                const _arg = this.compile_expr(scope, expr.args[i]);
                if (_arg.is_err()) return _arg;
                let arg = _arg.unwrap();
                if (arg.value.get_value_type() == ValueType.LVALUE) {
                    arg = this.to_rvalue(arg);
                    scope.code += `LOD ${arg.value.compile()} ${arg.value.compile()}\n`;
                }
                scope.code += `PSH ${arg.value.compile()}\n`;
            }
            scope.code += `MOV R1 R2\n`;
            scope.code += `ADD R2 R2 ${scope.top}\n`;
            scope.code += `STR R2 R1\n`;
            scope.code += `CAL .oxided_${callee}\n`;
            for (let i = used_registers.length - 1; i >= 0; i--) {
                if (used_registers[i] == USED) {
                    scope.code += `POP R${i + 3}\n`;
                    this.registers[i] = USED;
                }
            }

            scope.code += `LOD R2 R2\n`;

            const _result_reg = this.reg_alloc();
            if (_result_reg.is_none()) return new Err({ position: expr.position, message: `Cannot allocate a register` });
            const result_reg = _result_reg.unwrap();

            scope.code += `MOV R${result_reg} R1\n`;

            return new Ok({ type: _.cloneDeep(fn.return_type), value: new RegisterValue(result_reg, ValueType.RVALUE) });
        } else return this.compile_member_expr(scope, expr);
    }

    compile_member_expr(scope: Scope, expr: AST.Expr): Result<CompilerValue, CompilerErr> {
        if (expr instanceof AST.MemberExpr) {
            const _object = this.compile_literal(scope, expr.object);
            if (_object.is_err()) return _object;
            let object = _object.unwrap();
            if (expr.computed) {
                if (object.value.get_value_type() == ValueType.LVALUE) {
                    object = this.to_rvalue(object);
                    scope.code += `LOD ${object.value.compile()} ${object.value.compile()}\n`;
                }
                if (typeof expr.property == 'string') return new Err({ position: expr.position, message: `Compiler error: MEMBEREXPR1` });
                const _property = this.compile_expr(scope, expr.property);
                if (_property.is_err()) return _property;
                let property = _property.unwrap();
                if (property.value.get_value_type() == ValueType.LVALUE) {
                    property = this.to_rvalue(property);
                    scope.code += `LOD ${property.value.compile()} ${property.value.compile()}\n`;
                }
                const _register = this.reg_alloc();
                if (_register.is_none()) return new Err({ position: expr.position, message: `Couldn't reconstruct a type` });
                const register = _register.unwrap();
                scope.code += `ADD R${register} ${object.value.compile()} ${property.value.compile()}\n`;
                let n_type = _.cloneDeep(object.type);
                if (!(n_type instanceof PointerType)) return new Err({ position: expr.position, message: `Compiler error: MEMBEREXPRNPTR` });
                n_type.pointers -= 1;
                if (n_type.pointers == 0) n_type = n_type.type;
                return new Ok({ type: _.cloneDeep(n_type), value: new RegisterValue(register, ValueType.LVALUE) });
            } else {
                if(typeof expr.property != 'string') return new Err({ position: expr.position, message: `Compiler err: MEMBEREXPR2` });
                if(object.value.get_value_type() != ValueType.LVALUE) return new Err({ position: expr.position, message: `If you encounter this error contact the dev (hwyc on discord)` });
                const property = expr.property;
                const type = object.type as StructType;
                let offset = 0;
                let prop: [CompilerType, string];
                for(let i = 0; i < type.properties.length; i++) {
                    const current_property = type.properties[i];
                    if(current_property[1] != property) offset += current_property[0].get_size();
                    else {
                        prop = current_property;
                        break;
                    }
                }
                const _reg = this.reg_alloc();
                if(_reg.is_none()) return new Err({ position: expr.position, message: `Cannot allocate a register` });
                const reg = _reg.unwrap();
                scope.code += `ADD R${reg} ${object.value.compile()} ${offset}\n`;
                return new Ok({ type: prop[0], value: new RegisterValue(reg, ValueType.LVALUE) });
            }
        } else return this.compile_literal(scope, expr);
    }

    compile_literal(scope: Scope, expr: AST.Expr): Result<CompilerValue, CompilerErr> {
        if (expr instanceof AST.LitExpr) {
            switch (expr.value_type) {
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
                    if (this.fns.has(expr.value)) return new Ok({ type: this.fns.get(expr.value)!, value: new LabelValue(`oxided_${expr.value}`) });
                    if (!scope.var_has(expr.value)) return new Err({ position: expr.position, message: `Variable ${expr.value} doesn't exist` });

                    const [[type, offset], depth] = scope.var_get(expr.value).unwrap();

                    const _register = this.reg_alloc();
                    if (_register.is_none()) return new Err({ position: expr.position, message: `No register left for allocation` });
                    const reg = _register.unwrap();

                    if (depth > 0) {
                        let current_scope = scope;

                        let is_r2_used = false;
                        for (let i = 0; i < depth; i++) {
                            if (current_scope.name.endsWith('.while')) {
                                scope.code += `LOD R${reg} ${!is_r2_used ? 'R2' : `R${reg}`}\n`;
                                is_r2_used = true;
                            }
                            current_scope = current_scope.parent.unwrap();
                        }

                        scope.code += `ADD R${reg} R${!is_r2_used ? 2 : reg} ${offset}\n`;
                    } else {
                        scope.code += `ADD R${reg} R2 ${offset}\n`;
                    }
                    return new Ok({ type, value: new RegisterValue(reg, ValueType.LVALUE) });
                }
                default: return new Err({ position: expr.position, message: `COMPILERERR: LITERALTYPE` });
            }
        } else if (expr instanceof AST.ParenBlock) {
            return this.compile_expr(scope, expr.value);
        } else {
            return new Err({ position: expr.position, message: `COMPILERERR: LITERAL` });
        }
    }

    to_type(expr: AST.TypeExpr): Option<CompilerType> {
        let type = _.cloneDeep(this.types.get(expr.name));
        if (!type) return new None;
        if (expr.pointers > 0) {
            type = new PointerType<typeof type>(type, expr.pointers);
        }
        return new Some(type);
    }

    to_rvalue(value: CompilerValue): CompilerValue {
        if (value.value.get_value_type() == ValueType.LVALUE) {
            (value.value as RegisterValue).value_type = ValueType.RVALUE;
        }
        return value;
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