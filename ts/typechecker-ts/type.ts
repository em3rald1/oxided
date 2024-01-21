export interface TypecheckerType {
    toString(): string; 
    get_name(): string;
    get_pointers(): number;
    set_pointers(x: number);
}

export class Type implements TypecheckerType {
    name: string;
    pointers: number;
    constructor(name: string, pointers: number) {
        this.name = name;
        this.pointers = pointers;
    }

    get_name(): string {
        return this.name;
    }

    get_pointers(): number {
        return this.pointers;
    }

    set_pointers(x: number) {
        this.pointers = x;
    }

    toString(): string {
        return `${'*'.repeat(this.pointers)}${this.name}`;
    }
}

export class StructType implements TypecheckerType {
    name: string;
    pointers: number;
    properties: [TypecheckerType, string][];
    constructor(name: string, pointers: number, properties: [TypecheckerType, string][]) {
        this.properties = properties;
        this.name = name;
        this.pointers = pointers;
    }
    get_name(): string {
        return this.name;
    }
    get_pointers(): number {
        return this.pointers;
    }

    set_pointers(x: number) {
        this.pointers = x;
    }
    get_properties(): [TypecheckerType, string][] {
        return this.properties;
    }
    toString(): string {
        return `${'*'.repeat(this.pointers)}${this.name}, ... ${this.properties.length} properties`;
    }
}

export class FunctionType implements TypecheckerType {
    name: string;
    params: [TypecheckerType, string][];
    return_type: TypecheckerType;
    constructor(name: string, params: [TypecheckerType, string][], return_value: TypecheckerType) {
        this.name = name;
        this.params = params;
        this.return_type = return_value;
    }

    get_name(): string {
        return this.name;
    }

    get_pointers() { return -1; }

    set_pointers(_) {}

    get_params(): [TypecheckerType, string][] {
        return this.params;
    }

    toString(): string {
        const args = this.params.map(v => `${v[1]} ${v[0]}`);
        return `${this.name}(${args.join(", ")})`;
    }
}