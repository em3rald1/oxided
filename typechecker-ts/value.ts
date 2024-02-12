import { TypecheckerType } from "./type";

export interface Value {
    is_rvalue(): boolean;
    is_lvalue(): boolean;
    get_type(): TypecheckerType;
}

export class RValue implements Value {
    type: TypecheckerType;
    constructor(type: TypecheckerType) {
        this.type = type;
    }
    is_rvalue(): boolean {
        return true;
    }
    is_lvalue(): boolean {
        return false;
    }
    get_type(): TypecheckerType {
        return this.type;
    }
}

export class LValue implements Value {
    type: TypecheckerType;
    constructor(type: TypecheckerType) {
        this.type = type;
    }
    is_rvalue(): boolean {
        return false;
    }
    is_lvalue(): boolean {
        return true;
    }
    get_type(): TypecheckerType {
        return this.type;
    }
}