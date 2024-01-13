const { Type } = require("./type");

class Value {
    /**
     * @param {Type} type
     */
    constructor(type) {
        this.type = type;
    }
}

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