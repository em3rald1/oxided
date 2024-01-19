class CompilerValue {}

class RegisterValue extends CompilerValue {
    /**
     * @param {number} register_index
     */
    constructor(register_index) {
        super();
        this.register_index = register_index;
    }

    toString() {
        return `R${this.register_index}`
    }
}

class NumberValue extends CompilerValue {
    /**
     * @param {string} value A number value, interpreted by a URCL compiler
     */
    constructor(value) {
        super();
        this.value = value;
    }
    toString() { return this.value; }
}

class MemoryValue extends CompilerValue {
    /**
     * @param {number} address
     */
    constructor(address, is_raw = false) {
        super();
        this.is_raw = is_raw;
        this.address = address;
    }
    toString() {
        return `${this.is_raw ? '' : 'M'}${this.address}`;
    }
}

module.exports = {
    CompilerValue, RegisterValue, NumberValue, MemoryValue
}