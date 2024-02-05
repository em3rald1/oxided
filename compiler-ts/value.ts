export enum ValueType {
    RVALUE, LVALUE
}

export interface Value {
    compile(): string;
    get_value_type(): ValueType;
}

export class RegisterValue implements Value {
    index: number;
    value_type: ValueType;
    constructor(index: number, value_type: ValueType) {
        this.index = index;
        this.value_type = value_type;
    }
    get_value_type(): ValueType {
        return this.value_type;
    }
    compile() {
        return `R${this.index}`;
    }
}

export class MemoryValue implements Value {
    address: number;
    constructor(address: number) {
        this.address = address;
    }
    get_value_type(): ValueType {
        return ValueType.RVALUE;
    }
    compile() {
        return `M${this.address}`; 
    }
}

export class LiteralValue implements Value {
    value: number;
    constructor(value: number) {
        this.value = value;
    }
    get_value_type(): ValueType {
        return ValueType.RVALUE;
    }
    compile() {
        return `${this.value}`;
    }
}