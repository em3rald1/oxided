const { Type, FunctionType } = require("./type");
const Result = require("../util/result");

/**
 * Class representing a state of the typechecker
 */
class State {
    constructor() {
        /** @type {Map<string, FunctionType>} */
        this.functions = new Map();
        /** @type {Map<string, Type>} */
        this.types = new Map();
        this.code = "";
    }
    /**
     * 
     * @param {string} name 
     * @param {FunctionType} ftype
     * @returns {Result<undefined, string>}
     */
    function_create(name, ftype) {
        if(this.functions.has(name)) return Result.Err("Function already exists");
        this.functions.set(name, ftype);
        return Result.Ok();
    }

    /**
     * 
     * @param {string} name
     * @param {Type} type
     * @returns {Result<undefined, string>}
     */
    type_create(name, type) {
        if(this.types.has(name)) return Result.Err("Type already exists");
        this.types.set(name, type);
        return Result.Ok();
    }
}

module.exports = State;