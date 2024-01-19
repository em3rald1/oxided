const { Type } = require("./type");

/**
 * Abstract class representing a type of a value
 * @abstract
 */
class Value {
    /**
     * @param {Type} type
     */
    constructor(type) {
        this.type = type;
    }
}

/**
 * Class representing an rvalue
 * @see {@link https://en.wikipedia.org/wiki/Value_(computer_science)}
 */
class RValue extends Value {
    /**
     * 
     * @param {Type} type 
     */
    constructor(type) {
        super(type);
        this.value_type = 'R';
    }
}

/**
 * Class representing an lvalue
 * @see {@link https://en.wikipedia.org/wiki/Value_(computer_science)}
 */
class LValue extends Value {
    /**
     * 
     * @param {Type} type 
     */
    constructor(type) {
        super(type);
        this.value_type = 'L';
    }
}

module.exports = { Value, RValue, LValue };