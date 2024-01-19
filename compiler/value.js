class Value {}

class LiteralValue extends Value {
    /**
     * 
     * @param {number} value TODO: Determine what values can be literal
     */
    constructor(value) {
        super();
        this.value = value;
    }
}

class RegisterValue extends Value {
    
}

module.exports = Value;