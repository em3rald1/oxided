export interface CompilerType {
    get_name(): string;
    get_size(): number; 
}

export class ZeroType implements CompilerType {
    constructor() {}
    get_name() { return "void"; }
    get_size() { return 0; }
}

export class PrimitiveType implements CompilerType {
    name: string;
    constructor(name: string) {
        this.name = name;
    }
    get_name() { return this.name; }
    get_size() { return 1; }
}

export class StructType implements CompilerType {
    name: string;
    size: number;
    properties: [CompilerType, string][];
    constructor(name: string, properties: [CompilerType, string][]) {
        this.name = name;
        this.properties = properties;
        this.size = properties.map(v => v[0].get_size()).reduce((acc, v) => acc + v, 0);
    }
    get_name() { return this.name; }
    get_size() { return this.size; }
}

export class PointerType<T extends CompilerType> implements CompilerType {
    type: T;
    pointers: number;
    constructor(type: T, pointers: number) {
        this.type = type;
        this.pointers = pointers;
    }
    get_name() { return this.type.get_name(); }
    get_size() { return 1; }
}

export class FunctionType {
    name: string;
    parameters: [CompilerType, string][];
    return_type: CompilerType;
    constructor(name: string, parameters: [CompilerType, string][], return_type: CompilerType = new ZeroType()) {
        this.name = name;
        this.parameters = parameters;
        this.return_type = return_type;
    }
}