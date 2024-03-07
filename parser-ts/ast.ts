import { None, Option, Some } from '../util-ts/option';
export enum StmtType {
    Program, StructDecl, IfStmt, BreakStmt, ReturnStmt,
    ImportStmt,
    WhileStmt, FnDecl, VarDecl, Block,
    Expr, AssignExpr, CompExpr, BinExpr, CastExpr,
    UnaryExpr, CallExpr, MemberExpr, ParenBlock, LitExpr
};

export interface Stmt {
    type: StmtType;
    position: [number, number];
    toString(): string;
}

export class Program implements Stmt {
    body: Stmt[];
    type = StmtType.Program;
    position: [number, number] = [0, 0];
    constructor(body: Stmt[]) {
        this.body = body;
    }
    toString(): string {
        return `[Program: body = [... ${this.body.length} elements] ]`;
    }
}

export class ImportStmt implements Stmt {
    type = StmtType.ImportStmt;
    position: [number, number];
    is_all: boolean;
    alias: Option<string>;
    file: string;
    imports: Option<string[]>;
    constructor(file: string, is_all: boolean, position: [number, number], alias?: string, imports?: string[]) {
        this.position = position;
        this.is_all = is_all;
        this.alias = alias ? new Some(alias) : new None;
        this.file = file;
        this.imports = imports ? new Some(imports) : new None;
    }
    toString(): string {
        return `[ImportStmt: file = ${this.file}]`;
    }
}

export class StructDecl implements Stmt {
    type = StmtType.StructDecl;
    name: string;
    name_pos: [number, number];
    properties: [TypeExpr, string][];
    position: [number, number];
    constructor(name: string, properties: [TypeExpr, string][], position: [number, number], name_pos: [number, number]) {
        this.name = name;
        this.properties = properties;
        this.position = position;
        this.name_pos = name_pos;
    }
    toString(): string {
        return `[StructDecl: name = ${this.name}, properties = ... ${this.properties.length} elements]`;
    }
}

export class IfStmt implements Stmt {
    type = StmtType.IfStmt;
    condition: Expr;
    body: Block;
    elsebody: Option<Block | IfStmt>;
    position: [number, number];
    constructor(condition: Expr, body: Block, position: [number, number], elsebody?: Block | IfStmt) {
        this.condition = condition;
        this.body = body;
        this.elsebody = elsebody ? new Some(elsebody) : new None;
        this.position = position;
    }
    toString(): string {
        if (this.elsebody.is_some()) {
            const elsebody = this.elsebody.unwrap();
            return `[IfStmt: condition = ${this.condition.toString()}, body = ${this.body.toString()}, else body = ${elsebody.toString()}]`;
        }
        return `[IfStmt: condition = ${this.condition.toString()}, body = ${this.body.toString()}]`;
    }
}

export class BreakStmt implements Stmt {
    type = StmtType.BreakStmt;
    position: [number, number];
    constructor(position: [number, number]) {
        this.position = position;
    }

    toString(): string {
        return `[BreakStmt]`;
    }
}

export class ReturnStmt implements Stmt {
    type = StmtType.ReturnStmt;
    value: Option<Expr>;
    position: [number, number];
    constructor(position: [number, number], value?: Expr) {
        this.value = value ? new Some(value) : new None;
        this.position = position;
    }

    toString(): string {
        return this.value ? `[ReturnStmt: value = ${this.value.toString()}]` : `[ReturnStmt]`;
    }
}

export class WhileStmt implements Stmt {
    type = StmtType.WhileStmt;
    condition: Expr;
    body: Block;
    position: [number, number];
    constructor(condition: Expr, body: Block, position: [number, number]) {
        this.condition = condition;
        this.body = body;
        this.position = position;
    }

    toString(): string {
        return `[WhileStmt: condition: ${this.condition.toString()}, body: ${this.body.toString()}]`;
    }
}

export class FnDecl implements Stmt {
    type = StmtType.FnDecl;
    name: string;
    parameters: [TypeExpr, string][];
    return_type: TypeExpr;
    body: Option<Block>;
    extern: boolean;
    position: [number, number];
    constructor(name: string, parameters: [TypeExpr, string][], return_type: TypeExpr, extern: boolean, position: [number, number], body?: Block) {
        this.name = name;
        this.parameters = parameters;
        this.return_type = return_type;
        this.body = body ? new Some(body) : new None;
        this.position = position;
        this.extern = extern;
    }

    toString(): string {
        const parameters = this.parameters.map((v, i) => `${i + 1}. ${v[0].toString()} ${v[1]}`);
        return `[FnDecl: name = ${this.name}, parameters = ${parameters.join(", ")}, return_type = ${this.return_type.toString()}, body = ${this.body.toString()}]`;
    }
}

export class VarDecl implements Stmt {
    type = StmtType.VarDecl;
    name: string;
    value: Option<Expr>;
    value_type: Option<TypeExpr>;
    position: [number, number];
    constructor(name: string, position: [number, number], value?: Expr, value_type?: TypeExpr) {
        this.name = name;
        this.value = value ? new Some(value) : new None;
        this.value_type = value_type ? new Some(value_type) : new None;
        this.position = position;
    }

    toString(): string {
        return `[VarDecl: name = ${this.name}, value = ${this.value.toString()}(${this.value_type.is_some() ? this.value_type.unwrap().toString() : 'no type specified'})]`;
    }
}

export class Block implements Stmt {
    type = StmtType.Block;
    body: Stmt[];
    position: [number, number];
    constructor(body: Stmt[], position: [number, number]) {
        this.body = body;
        this.position = position;
    }
    toString(): string {
        return `[Block: body = [... ${this.body.length} elements] ]`;
    }
}

export interface Expr extends Stmt {
    type: StmtType;
    toString(): string;
    position: [number, number];
}

export class AssignExpr implements Expr {
    type = StmtType.AssignExpr;
    assignee: Expr;
    value: Expr;
    operator: string;
    position: [number, number];
    constructor(assignee: Expr, value: Expr, operator: string, position: [number, number]) {
        this.assignee = assignee;
        this.value = value;
        this.operator = operator;
        this.position = position;
    }
    toString() {
        return `[AssignExpr: assignee = ${this.assignee.toString()}, value = ${this.value.toString()}, operator = ${this.operator}]`;
    }
}

export class CompExpr implements Expr {
    type = StmtType.CompExpr;
    left: Expr;
    right: Expr;
    operator: string;
    position: [number, number];
    constructor(left: Expr, right: Expr, operator: string, position: [number, number]) {
        this.left = left;
        this.right = right;
        this.operator = operator;
        this.position = position;
    }
    toString() {
        return `[CompExpr: left = ${this.left.toString()}, right = ${this.right.toString()}, operator = ${this.operator}]`;
    }
}

export class BinExpr implements Expr {
    type = StmtType.BinExpr;
    left: Expr;
    right: Expr;
    operator: string;
    position: [number, number];
    constructor(left: Expr, right: Expr, operator: string, position: [number, number]) {
        this.left = left;
        this.right = right;
        this.operator = operator;
        this.position = position;
    }
    toString() {
        return `[BinExpr: left = ${this.left.toString()}, right = ${this.right.toString()}, operator = ${this.operator}]`;
    }
}

export class CastExpr implements Expr {
    type = StmtType.CastExpr;
    operand: Expr;
    value_type: TypeExpr;
    position: [number, number];
    constructor(operand: Expr, type: TypeExpr, position: [number, number]) {
        this.operand = operand;
        this.value_type = type;
        this.position = position;
    }

    toString(): string {
        return `[CastExpr: ${this.operand.toString()} to ${this.value_type.toString()}]`;
    }
}

export class UnaryExpr implements Expr {
    type = StmtType.UnaryExpr;
    operand: Expr;
    operator: string;
    position: [number, number];
    constructor(operand: Expr, operator: string, position: [number, number]) {
        this.operand = operand;
        this.operator = operator;
        this.position = position;
    }

    toString(): string {
        return `[UnaryExpr: operand = ${this.operand.toString()}, operator = ${this.operator.toString()}]`;
    }
}

export class CallExpr implements Expr {
    type = StmtType.CallExpr;
    callee: Expr;
    args: Expr[];
    position: [number, number];
    constructor(callee: Expr, args: Expr[], position: [number, number]) {
        this.callee = callee;
        this.args = args;
        this.position = position;
    }
    toString(): string {
        return `[CallExpr: callee = ${this.callee.toString()}, arguments = [${this.args.map((v, i) => `${i + 1}. ${v.toString()}`).join(", ")}]]`;
    }
}

export class MemberExpr implements Expr {
    type = StmtType.MemberExpr;
    computed: boolean;
    object: Expr;
    property: Expr | string;
    position: [number, number];
    constructor(object: Expr, property: Expr | string, computed: boolean, position: [number, number]) {
        this.object = object;
        this.property = property;
        this.computed = computed;
        this.position = position;
    }
    toString(): string {
        return `[MemberExpr: object = ${this.object.toString()}, property = ${typeof this.property == 'string' ? this.property : this.property.toString()}]`;
    }
}

export class ParenBlock implements Expr {
    type = StmtType.ParenBlock;
    value: Expr;
    position: [number, number];
    constructor(value: Expr, position: [number, number]) {
        this.value = value;
        this.position = position;
    }
    toString(): string {
        return `[ParenBlock: value = ${this.value.toString()}]`;
    }
}

export class LitExpr implements Expr {
    type = StmtType.LitExpr;
    value: string;
    value_type: "string" | "number" | "boolean" | "identifier";
    position: [number, number];
    constructor(value: string, value_type: "string" | "number" | "boolean" | "identifier", position: [number, number]) {
        this.value = value;
        this.value_type = value_type;
        this.position = position;
    }
    toString(): string {
        return `[LitExpr: ${this.value} as ${this.value_type}]`;
    }
}

export class TypeExpr {
    name: string;
    pointers: number;
    position: [number, number];
    constructor(name: string, pointers: number, position: [number, number]) {
        this.name = name;
        this.pointers = pointers;
        this.position = position;
    }
    toString() {
        return `${'*'.repeat(this.pointers)}${this.name}`;
    }
}